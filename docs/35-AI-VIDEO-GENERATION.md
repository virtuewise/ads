# 35 — AI Video Generation

**Status: 🟡 (concept generation is real; video/image generation is ⬜) · Code: `main/ipc.ts`, `hooks/useEngineData.ts` → target: `engine/ai/*`**

> The editor's AI surface today is **concept generation** — a brief becomes scored creative concepts
> via the `CreativeDirector` in World A. There is **no AI video generation**: no text-to-video, no
> image-to-video, no AI-generated b-roll. This document specifies the generation subsystem.

---

## 1. What exists today

### 1.1 Concept generation (real)

The **AI Concept Generator** in the left panel's **AI** tab:

```typescript
// hooks/useEngineData.ts
generateConcepts: (brief: Brief) => Promise<Concept[]>

// App.tsx — form with: objective, service, audience, emotional goal
window.studio.generateConcepts(brief)  // IPC → main → CreativeDirector.generateConcepts()
```

The `CreativeDirector` (in `packages/creative-engine`) produces scored concepts — each with a title,
rationale, and score ring — from the brief. This is real, working AI-assisted ideation.

### 1.2 AI Tools panel

The left panel's **AI** tab also exposes an **AI Tools** section (scene detection, auto-reframe,
transcript search) — these are UI stubs with no engine behind them.

---

## 2. The gap, precisely

| Capability | Today |
|---|---|
| Concept generation | ✅ brief → scored concepts |
| Text-to-video | ⬜ none |
| Image-to-video | ⬜ none |
| AI b-roll generation | ⬜ none |
| AI image generation | ⬜ none |
| AI audio/music generation | ⬜ none |
| AI voiceover / TTS | ⬜ none |
| Style transfer | ⬜ none |
| AI upscaling / enhancement | ⬜ none |
| Local inference | ⬜ no model runtime |

---

## 3. The generation model (target)

AI video generation in Virtue Studio is **local-first, deterministic, and composable** — generated
assets are first-class media that travel with the project.

### 3.1 Text-to-video

```typescript
interface TextToVideoRequest {
  prompt: string;
  negativePrompt?: string;
  /** Generation model */
  model: 'none' | 'animatediff' | 'stable-video' | 'wan21' | 'cogview';
  /** Visual style reference */
  styleRef?: string;          // image asset id
  /** Motion parameters */
  motion: {
    camera: 'static' | 'pan-left' | 'pan-right' | 'zoom-in' | 'zoom-out' | 'orbit';
    motionStrength: number;   // 0–1
  };
  duration: number;           // seconds
  fps: number;
  resolution: { width: number; height: number };
  seed?: number;              // for determinism
}

interface TextToVideoResult {
  assetId: string;            // registered media asset
  frames: ImageData[];        // the generated video
  seed: number;
  prompt: string;
}
```

### 3.2 Image-to-video

Animate a still image with a motion prompt:

```typescript
interface ImageToVideoRequest {
  imageAssetId: string;       // source still
  motionPrompt: string;       // "slow zoom in", "wind blows leaves"
  camera: CameraMotion;
  duration: number;
  fps: number;
}
```

### 3.3 Local inference

All generation runs **locally** — no cloud API, no data leaves the machine:

| Model class | Backend | Notes |
|---|---|---|
| **Stable Diffusion** | ONNX Runtime Web (WebGPU) | image generation, img2img |
| **AnimateDiff** | ONNX Runtime Web | text-to-video (short clips) |
| **Stable Video Diffusion** | ONNX Runtime Web | image-to-video |
| **WAN 2.1** | ONNX Runtime Web | high-quality text-to-video |
| **CogViewX** | ONNX Runtime Web | alternative text-to-video |
| **ESRGAN / Real-ESRGAN** | ONNX Runtime Web | upscaling |
| **RIFE** | ONNX Runtime Web | frame interpolation |

Models are downloaded on demand, cached locally, and run via ONNX Runtime Web with WebGPU
acceleration. The generation UI shows progress, ETA, and VRAM usage.

### 3.4 Determinism

Every generation takes a `seed`. The same prompt + seed + model + parameters produces the same
output — so:

- Generated assets are reproducible.
- Projects that use generated assets are reproducible.
- An agent can regenerate an asset and verify it matches.

---

## 4. The generation pipeline

```
brief → concept → storyboard → shot list → generation request
                                              │
                                              ▼
                                    [local inference]
                                              │
                                              ▼
                                    generated media asset
                                              │
                                              ▼
                                    registered in media index
                                              │
                                              ▼
                                    placed on timeline
                                              │
                                              ▼
                                    composited + graded + exported
```

### 4.1 From concept to generated video

1. User writes a brief → concept generation produces scored concepts.
2. User selects a concept → the system proposes a storyboard (shots with prompts).
3. User edits the storyboard → each shot has a generation prompt.
4. User selects shots → **Generate** runs local inference.
5. Generated clips are registered as media assets and placed on the timeline.
6. The rest of the pipeline (compositing, grading, captions, export) works unchanged.

### 4.2 Generation parameters

| Parameter | Range | Effect |
|---|---|---|
| `prompt` | text | what to generate |
| `negativePrompt` | text | what to avoid |
| `seed` | 0–2³² | determinism |
| `guidanceScale` | 1–20 | prompt adherence (CFG) |
| `steps` | 1–150 | inference steps (quality vs speed) |
| `motionStrength` | 0–1 | motion intensity |
| `camera` | enum | camera movement |
| `duration` | 1–10s | clip length |
| `resolution` | preset | output size |

---

## 5. AI image generation

Still-image generation for b-roll, backgrounds, and style references:

```typescript
interface TextToImageRequest {
  prompt: string;
  negativePrompt?: string;
  model: 'sdxl' | 'sd15' | 'flux' | 'none';
  width: number;
  height: number;
  seed?: number;
  steps?: number;
  guidanceScale?: number;
}
```

Images are registered as `MediaAsset` with `kind: 'image'` and placed on the timeline like any other
media.

---

## 6. AI audio generation

### 6.1 Music generation

```typescript
interface MusicGenerationRequest {
  prompt: string;             // "upbeat corporate background"
  duration: number;
  mood: 'upbeat' | 'tense' | 'calm' | 'dramatic' | 'sad';
  tempo: number;              // BPM
  instrumental: boolean;
}
```

Local models: MusicGen (ONNX) or a procedural fallback using the music engine.

### 6.2 Voiceover / TTS

```typescript
interface TTSRequest {
  text: string;
  voice: 'narrator-male' | 'narrator-female' | 'character-1' | …;
  speed: number;              // 0.5–2.0
  emotion: 'neutral' | 'excited' | 'serious' | 'warm';
}
```

Local models: Coqui TTS, Piper, or Bark (ONNX).

### 6.3 Sound effect generation

Text-to-audio for SFX: "footsteps on gravel", "door slam", "wind howling" — AudioGen-class, local.

---

## 7. AI-assisted editing (the bridge from generation to edit)

Generation is not a black box — generated assets are **editable objects**:

- A generated video is a clip on the timeline — trim it, grade it, caption it.
- A generated image is a media asset — composite it, mask it, animate it.
- A generated music track is an audio clip — J-cut it, duck it, mix it.

The agentic workflow ([17](17-AI-AGENTS.md)):

```
brief → concepts → storyboard → generate → assemble → edit → grade → captions → export
```

Every step is a named, diffable operation. The human can improve any step by judgement.

---

## 8. Style references

Generation supports **style references** — an image that guides the visual style:

```typescript
interface StyleReference {
  assetId: string;            // reference image
  strength: number;           // 0–1, how strongly to follow
  mode: 'image' | 'video' | 'both';
}
```

Use a brand's keyframes, a product shot, or a mood board as the style reference for consistent
generation.

---

## 9. Genre ↔ generation posture

| Genre | Generation use |
|---|---|
| 3D/CGI | less generation — CG renders are the medium; AI for concept art |
| Narrative | AI b-roll, location establishment, period-accurate backgrounds |
| Corporate | brand-consistent backgrounds, product shots, abstract motion backgrounds |
| Explainer | icon generation, diagram backgrounds, character animation |
| Documentary | **upscaling** archive footage, **restoration**, colorization |
| Detective | atmosphere generation, evidence photos, moody b-roll |

---

## 10. Quality control

Generated content has quality issues. The system must:

- **Score** each generation (aesthetic, prompt adherence, technical quality).
- **Flag** artifacts (distorted faces, flickering, inconsistency).
- **Compare** multiple seeds and let the user pick.
- **Reject** generations below a quality threshold.
- **Log** every generation (prompt, seed, model, parameters) for reproducibility.

---

## 11. Verification

| Property | Test |
|---|---|
| Determinism | same seed + prompt + model → identical output |
| Registration | generated assets appear in the media index |
| Compositing | generated clips composite like any other media |
| Export parity | generated content exports identically to viewport ([04](04-RENDERING.md)) |
| Quality scoring | a known-bad generation scores lower than a known-good one |
| Style reference | a branded reference produces brand-consistent output |

---

Related: [17-AI-AGENTS](17-AI-AGENTS.md) · [29-MEDIA-PIPELINE](29-MEDIA-PIPELINE.md) · [31-AI-AGENTIC-SCALE](31-AI-AGENTIC-SCALE.md) ·
[39-SCRIPTING-AND-EXPRESSIONS](39-SCRIPTING-AND-EXPRESSIONS.md) · [09-GENRE-SYSTEM](09-GENRE-SYSTEM.md)
