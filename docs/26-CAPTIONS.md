# 26 — Captions & Subtitles: Transcription, Styling & Burn-In

**Status: ⬜ (a Captions track exists; no transcription or styling) · Code (target): `engine/captions/*`, `main/transcribe.ts`, `components/CaptionEditor.tsx`**

> The timeline has a **Captions track** (`TRACKS` in `engine/timeline.ts`, icon `captions`, colour
> `#ffb347`) holding placeholder title clips. There is **no transcription, no timing engine, and no caption
> styling**. This document specifies the subtitle subsystem — transcription through burn-in.

---

## The gap, precisely

The genre templates name caption styles — "burned captions", "word-level timing locked to the VO
waveform", "speaker lower-thirds" — but none of that machinery exists. Captions are the single most
requested feature in the brief and are **fully self-contained**: they need no external service and can run
entirely on-device.

---

## 1. Transcription (local, on-device)

**No cloud.** Two viable local paths; the architecture supports both behind one interface:

| Engine | Where | Notes |
|---|---|---|
| **whisper.cpp** | main process (native binary) | Best quality/speed on CPU; GGML quantised models (tiny→large-v3) |
| **ONNX Runtime Web** | renderer (WebGPU/WASM) | No extra binary; runs in the app; good for medium models |
| **WebGPU compute** | renderer | For a future GPU-optimised encoder/decoder path |

```typescript
interface TranscriptionProvider {
  transcribe(
    audio: Float32Array,           // mono PCM at 16 kHz
    opts: { model: WhisperModel; language?: string; wordTimestamps: boolean },
    onProgress: (p: number) => void,
  ): Promise<Transcript>;
}

interface Transcript {
  language: string;
  segments: TranscriptSegment[];
  words: TranscriptWord[];         // present when wordTimestamps
}

interface TranscriptSegment { id: string; start: number; end: number; text: string; speaker?: string; }
interface TranscriptWord    { word: string; start: number; end: number; confidence: number; }
```

### Word-level timing

Segment-level timestamps are not enough for modern captions (karaoke highlighting, word-by-word reveals).
**Forced alignment** refines word times:

- Whisper's own cross-attention timestamps, or
- A dedicated aligner (WhisperX-class, or a lightweight CTC aligner) against the transcript text.

The output is `TranscriptWord[]` — the substrate for every caption animation in §3.

### Speaker diarization

Cluster speaker embeddings across the audio → `speaker` per segment. This drives:

- **Speaker lower-thirds** (Documentary — [14](14-GENRE-DOCUMENTARY.md)).
- Per-speaker caption placement (never cover the speaker).
- Multi-speaker colour coding in the caption style.

---

## 2. The caption object model

Captions bridge the transcript and the timeline. A transcription produces a **Caption track**, not a
single blob.

```typescript
interface CaptionCue {
  id: string;
  start: number;
  end: number;
  text: string;
  /** Word-level children, when available — drives karaoke/reveal animations. */
  words: TranscriptWord[];
  speaker?: string;
  styleId: string;              // caption style
  position?: { anchor: 'auto' | 'top' | 'bottom' | 'custom'; x?: number; y?: number };
  /** Manual overrides. */
  overrides?: Partial<CaptionStyle>;
}

interface CaptionStyle {
  id: string;
  name: string;
  font: { family: string; weight: number; sizePx: number; lineHeight: number; tracking: number };
  fill: { color: string; opacity: number };
  stroke?: { color: string; widthPx: number };
  shadow?: { color: string; blurPx: number; offsetY: number; opacity: number };
  box?: { enabled: boolean; color: string; opacity: number; paddingPx: number; radiusPx: number };
  /** Animation applied per cue and/or per word. */
  animation: CaptionAnimation;
  /** How many words to show at once. */
  maxWordsPerCue: number;
  casing: 'as-transcribed' | 'sentence' | 'upper' | 'lower';
}
```

Styles are **presets** ([28](28-PRESETS.md)): `Broadcast Clean`, `Social Bold`, `Karaoke Pop`,
`Documentary Lower-Third`, `Corporate Brand`, `Interview Speaker`, `Minimal Mono`.

---

## 3. Caption animation

Because the caption is a **layer** in the compositor ([22](22-COMPOSITOR.md)) and each word carries a
timing, caption animation is a WGSL + keyframe problem, not a video-of-text problem.

| Animation | Behaviour |
|---|---|
| `none` | static cue |
| `fade` | cue opacity in/out on the timeline easings |
| `karaoke` | word fill sweeps in sync with `TranscriptWord.start`/`end` |
| `word-reveal` | words appear sequentially |
| `pop` | per-word scale punch (`easeOut`, ~0.15s) — the social idiom |
| `bounce` | per-word translate overshoot |
| `typewriter` | character-level reveal |
| `highlight-box` | box slides word to word (Jane-the-Virgin-style) |

All animations are driven by the word timings, so they **stay in sync with the audio** regardless of
retiming — if the audio is time-stretched, the word times are stretched with it.

---

## 4. Auto-placement & safe zones

Captions must never violate safe zones ([18](18-BRAND-AND-LUTS.md)) or cover the speaker.

- **Auto-anchor**: bottom-centre by default; move to top if a subject/face occupies the bottom third.
- **Collision avoidance**: against safe-zone margins and detected faces (face detection from the media
  pipeline — [29](29-MEDIA-PIPELINE.md)).
- **Per-ratio reflow**: a 16:9 caption layout is not a 9:16 one; the layout engine recomputes wraps and
  positions per delivery ratio ([12](12-GENRE-CORPORATE.md) multi-aspect).
- **Line-breaking**: typical subtitle rules — max 2 lines, ~42 chars/line, no orphan words, respect
  punctuation.

---

## 5. Editing captions

The transcript is a **second editing surface** — the futuristic "edit the video by editing its text"
workflow:

| Interaction | Effect |
|---|---|
| Click a word | move the playhead to that word |
| Edit text | update the cue; re-run alignment locally |
| Delete a cue | remove the caption (and, in transcript-edit mode, the *footage* — see §7) |
| Drag a cue boundary | adjust in/out on the timeline |
| Split/merge cues | standard subtitle operations |
| Global find/replace | fix a recurring transcription error everywhere |
| Timing nudge | shift all cues ±N frames |

---

## 6. Output: burn-in, sidecar, or both

| Output | Format |
|---|---|
| **Burn-in** | rendered as compositor layers, so the captions are in the exported pixels |
| **Sidecar** | `.srt` (plain), `.vtt` (web), `.ass`/`.ssa` (styled, karaoke-capable) |
| **Both** | burn for social, sidecar for broadcast/accessibility review |

The sidecar writers are pure functions (`CaptionCue[] → string`) and therefore unit-testable; they take
timings, not pixels, so they are trivial to verify.

### Platform profiles

Different platforms demand different caption treatments. Ship delivery profiles:

| Profile | Style | Position | Max words |
|---|---|---|---|
| Broadcast | clean, sentence case | bottom, title-safe | 2 lines |
| YouTube | readable, medium weight | bottom | 2 lines |
| TikTok/Reels | bold, uppercase, boxed | centre-third | 3–4, karaoke |
| LinkedIn | small, minimal | bottom | 1–2 lines |

---

## 7. Transcript-driven editing (the agentic bridge)

Once captions exist, an agent can **edit video by editing text**:

```
transcript → user/agent deletes a paragraph
           → the map from words → source ranges removes that footage
           → the timeline is rebuilt, captions follow
```

This depends on: word timestamps (§1), a clip → source-range map ([06](06-TIMELINE.md)), and the media
pipeline ([29](29-MEDIA-PIPELINE.md)). It is the single most powerful agentic editing primitive, and it
falls out of the caption subsystem almost for free.

---

## Data model additions

```typescript
interface ProjectDocument {
  // …existing…
  captions: { cues: CaptionCue[]; styles: CaptionStyle[]; language: string };
}
```

New document version per [05](05-PROJECT-FORMAT.md#versioning--migration-policy).

---

## Verification

| Property | Test |
|---|---|
| SRT/VTT/ASS round-trip | parse(write(cues)) deep-equals cues |
| Alignment monotonicity | word times are non-decreasing and within their segment |
| Safe-zone compliance | no cue box intersects a forbidden margin in any ratio |
| Burn-in == preview | caption pixels match between viewport and export ([04](04-RENDERING.md)) |
| Retime consistency | after 1.5× stretch, word times scale by exactly 1.5 |

---

Related: [25-AUDIO](25-AUDIO.md) · [22-COMPOSITOR](22-COMPOSITOR.md) · [18-BRAND-AND-LUTS](18-BRAND-AND-LUTS.md) ·
[28-PRESETS](28-PRESETS.md) · [29-MEDIA-PIPELINE](29-MEDIA-PIPELINE.md)
