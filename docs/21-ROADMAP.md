# 21 — Unified Roadmap

**Status: living document · Legend: ✅ done · 🟡 partial · ⬜ not started**

> The honest state of both worlds, and the distance to "fully accomplished" — an AI agent can take a
> brief and footage and produce a deliverable for each genre, and a human editor can improve it by
> judgement and export it. See [00-VISION](00-VISION.md#what-fully-accomplished-looks-like).
>
> This document covers the path to a **working** editor. The path from working to **futuristic** —
> compositor, grading, transitions, audio, captions, presets, render queue, agentic scale — is the
> **advanced capability plan** at the end of this document, specified in [22](22-COMPOSITOR.md)–[31](31-AI-AGENTIC-SCALE.md).
> The **complete feature surface** — every implemented and planned feature — is specified in
> [32](32-KEYFRAME-ANIMATION.md)–[49](49-DATA-MODEL-REFERENCE.md).

---

## World A — the engine monorepo

*(mirrors [wiki/Roadmap](wiki/Roadmap.md), which remains the authoritative per-package view)*

| Phase | Area | Status |
|---|---|---|
| 1 | Foundation (repo, monorepo, brand schema, CLI, docs) | ✅ |
| 2 | Creative engine (director, 10-dim judge, anti-generic, diversity, daily V2) | ✅ |
| 3 | Design + production planning (deterministic pipeline; most downstream engines still placeholders) | 🟡 |
| 4 | Motion (print-item catalogue, animation library, signage, living city, shot list) | ✅ |
| 5 | Video engine (footage analysis, editing, sound, VO, music) | 🟡 |
| 6 | QA engine (brand/typography/logo/content/genericity) | ⬜/🟡 |
| 7 | Daily engine (daily run, rotation, fatigue; archive/derivatives pending) | 🟡 |
| 8 | Studio apps (dashboards; campaign/asset/render-queue UIs pending) | ⬜/🟡 |

**World A priorities** (from the wiki): replace placeholder planning engines with real logic; populate the
`ProductionPlan` sections; wire creative selection into the orchestrator; implement QA; real export;
kinetic typography / transitions / VFX in the motion engine.

---

## World B — the editor (`apps/electron`)

### Shipped in v0.1

| Area | Status | Docs |
|---|---|---|
| IDE shell: menubar, rail, panels, canvas, inspector, timeline | ✅ | [16](16-INTERFACE.md) |
| DAG engine: node classes → WGSL compiler → live recompile | ✅ | [03](03-ENGINE-CORE.md) |
| Code ⟷ node interchange | ✅ | [03](03-ENGINE-CORE.md), [08](08-SCRIPTING-API.md) |
| WebGPU viewport + headless renderer sharing one shader | ✅ | [04](04-RENDERING.md) |
| Dual project format (deterministic JSON + `VFXP` binary, sha256) | ✅ | [05](05-PROJECT-FORMAT.md) |
| Timeline model: tracks, clips, keyframes, snapping, easing | ✅ | [06](06-TIMELINE.md) |
| Local export via system FFmpeg (1080p H.264, 4K ProRes), probing, backpressure | ✅ | [07](07-EXPORT-PIPELINE.md) |
| Six genre workflows: SmartCut, keyframe presets, templates, pipelines | ✅ | [09](09-GENRE-SYSTEM.md) |
| Brand LUTs (WGSL) + safe zones | ✅ | [18](18-BRAND-AND-LUTS.md) |
| Interaction depth: transform→canvas, clip drag/trim, effect drop, keyframe diamonds | ✅ | [16](16-INTERFACE.md) |
| Electron 44.9 binary working | ✅ | [20](20-OPERATIONS.md) |

### Milestone 1 — Media import (the current frontier)

The timeline holds **engine-seeded placeholder clips**; the compositor renders only the procedural
grade/LUT/transform layer. Closing this is the highest-value work.

| Task | Status |
|---|---|
| Decode real footage (WebCodecs) and upload as the compositor's input texture | ⬜ |
| Extend `COMPOSITE_SHADER` + both bind groups to sample an input texture | ⬜ |
| Media bin: import, thumbnails, drag-to-timeline | ⬜ |
| Clip → media reference in `TimelineClip` (+ document version bump) | ⬜ |
| Per-clip keyframes driving the composition transform for the active clip | ⬜ |
| Audio decode + WebAudio graph + J/L crossfades | ⬜ |
| Audio/video muxing in the FFmpeg export (remove `-an`) | ⬜ |

### Milestone 2 — Genre depth

| Task | Genre | Status |
|---|---|---|
| Scene-change auto-cut (execute the SmartCut profile) | Corporate, Explainer | ⬜ |
| Subject-lock auto-reframe | Corporate, Documentary | ⬜ |
| Apply a template's `graphHint` to the actual DAG | all | ⬜ |
| SQLite metadata + transcript index (main process) | Documentary, Narrative | ⬜ |
| ONNX transcription streaming + timecode search | Documentary | ⬜ |
| WebCodecs ring-buffer frame cache + frame-slip UI | Detective | ⬜ |
| Wasm vector/Skia engine (kinetic type, Lottie) | Explainer | ⬜ |
| Multi-pass texture-array compositing + EXR import | 3D/CGI | ⬜ |
| Frame-rate conversion retime curves | 3D/CGI | ⬜ |

### Milestone 3 — Engine unification & polish

| Task | Status |
|---|---|
| Feed the DAG's compiled output into the composite (join the two shaders) | ⬜ |
| Multi-output-port nodes in the compiler | ⬜ |
| Real `BlurNode` / `VignetteNode` WGSL (currently placeholders) | ⬜ |
| Monaco editor replacing the textarea in `ScriptEditor` | ⬜ |
| Surface compile errors (cycles, unknown nodes) in the UI | ⬜ |
| Colour management (linear round-trip, FFmpeg colour flags, `.cube` ingestion) | ⬜ |
| Headless CLI (import → genre → render → export, no window) | ⬜ |
| Pre-export brand-QA gate | ⬜ |
| Multi-brand switching in the UI | ⬜ |
| Undo/redo across the document | ⬜ |
| Native shared-memory FFmpeg path (optimisation) | ⬜ |
| Double-buffered readback (export throughput) | ⬜ |

---

## Critical path to "fully accomplished"

The shortest dependency chain to a genuinely agent-operable, genre-complete system:

```
Media import (M1)
      │
      ├─► Audio graph ─────────► Narrative + Detective sound design
      │
      ├─► Per-clip keyframes ──► All genres' motion is real
      │
      ├─► Scene detection ─────► Corporate/Explainer auto-cut
      │
      └─► Metadata + transcript (Documentary/Narrative)
                │
                ▼
        Genre pipelines executable end-to-end
                │
                ▼
        Headless CLI ──► AI agents operate without a human in the loop
                │
                ▼
        Brand-QA gate ──► Export is trustworthy
```

**Nothing after media import matters until media import lands** — the editor is currently a complete
*compositing and delivery* system operating on a procedural placeholder scene.

---

## Documentation status

| Doc set | Status |
|---|---|
| `docs/00`–`docs/21` | ✅ written (the current system) |
| `docs/22`–`docs/31` | ✅ written (the advanced capability plan) |
| `docs/32`–`docs/49` | ✅ written (feature deep dives + advanced systems) |
| `docs/README` index + reading paths | ✅ |
| `scripts/check-docs.mjs` reference checker | ✅ (see [docs/README](README.md#keeping-docs-honest)) |
| `docs/wiki/*` (World A) — add a "World B" pointer banner | ✅ (banner added) |

---

## Advanced capability plan (`docs/22`–`docs/31`)

The milestones above make the editor do what the docs already claim. The **advanced plan** takes it
from "working editor" to "futuristic studio". Each doc is a design specification; every item here is
⬜ until built.

| Phase | Focus | Doc | Depends on |
|---|---|---|---|
| **A0** | Media pipeline: WebCodecs decode, zero-copy GPU, ring buffer, proxies, indexing | [29](29-MEDIA-PIPELINE.md) | — |
| **A1** | Compositor: layers, masks, blends, 3D camera, motion blur, pre-comps | [22](22-COMPOSITOR.md) | A0 |
| **A2** | Color: primaries, curves, qualifiers, `.cube` LUTs, scopes, ACES colour management | [23](23-COLOR.md) | A1 |
| **A3** | Effects library: WGSL catalogue, texture-sampling nodes, compute nodes, particles | [27](27-EFFECTS-LIBRARY.md) | A1 |
| **A4** | Transitions: WGSL engine, luma wipes, optical-flow morphs | [24](24-TRANSITIONS.md) | A1, A3 |
| **A5** | Audio: WebAudio graph, J/L cuts, time-stretch, loudness, muxing | [25](25-AUDIO.md) | A0 |
| **A6** | Captions: local Whisper, word-level timing, styling, burn-in + sidecars | [26](26-CAPTIONS.md) | A0, A5 |
| **A7** | Presets: parameterized looks, motion, titles, captions, transitions, graphs | [28](28-PRESETS.md) | A2–A6 |
| **A8** | Render queue: batch/variants, GPU parallelism, HDR, packaging | [30](30-RENDER-QUEUE.md) | A1–A7 |
| **A9** | Agentic scale: headless CLI, op API v2, MCP, interop, multi-agent merge | [31](31-AI-AGENTIC-SCALE.md) | A0–A8 |

### Feature deep-dive phases (`docs/32`–`docs/49`)

The phases above are the **infrastructure** — the engine subsystems that everything builds on. The
phases below are the **feature surface** — the user-facing capabilities the editor must have.

| Phase | Focus | Doc | Depends on |
|---|---|---|---|
| **F0** | Keyframe animation: per-property sampling, full easing library, graph editor | [32](32-KEYFRAME-ANIMATION.md) | A1 |
| **F1** | Text & typography: SDF glyph atlas, kinetic type, variable fonts, text effects | [33](33-TEXT-AND-TYPOGRAPHY.md) | A1, F0 |
| **F2** | Templates & presets: template authoring, library, marketplace, agent access | [34](34-TEMPLATES-AND-PRESETS.md) | A2–A7 |
| **F3** | AI video generation: text-to-video, image-to-video, local inference | [35](35-AI-VIDEO-GENERATION.md) | A0 |
| **F4** | Undo/redo: command pattern, history stack, drag merge, crash recovery | [36](36-UNDO-REDO.md) | — |
| **F5** | Selection & interaction: multi-select, marquee, clipboard, shortcuts | [37](37-SELECTION-AND-INTERACTION.md) | F4 |
| **F6** | Node editor: macros, live preview, debugging, auto-layout | [38](38-NODE-EDITOR-AND-VISUAL-PROGRAMMING.md) | A3 |
| **F7** | Scripting & expressions: expression language, property linking, Monaco | [39](39-SCRIPTING-AND-EXPRESSIONS.md) | F0 |
| **F8** | Animation principles: procedural motion, physics, audio-reactive | [40](40-ANIMATION-PRINCIPLES.md) | F0 |
| **F9** | Render formats: full codec catalogue, HDR, colour-managed delivery | [41](41-RENDER-FORMAT-REFERENCE.md) | A2 |

### Cross-cutting phases

These span multiple feature areas and land incrementally:

| Phase | Focus | Doc |
|---|---|---|
| **X0** | Keyboard shortcuts & power user workflows | [42](42-KEYBOARD-SHORTCUTS.md) |
| **X1** | Asset management: media bin, organization, proxies | [43](43-ASSET-MANAGEMENT.md) |
| **X2** | Plugin system: API, sandboxing, marketplace | [44](44-PLUGIN-SYSTEM.md) |
| **X3** | Collaboration: multi-agent, branching, merge | [45](45-COLLABORATION-AND-MULTI-AGENT.md) |
| **X4** | Security: permissions, sandbox, audit | [46](46-SECURITY-AND-PERMISSIONS.md) |
| **X5** | Performance: adaptive quality, VRAM budget, profiling | [47](47-PERFORMANCE-TUNING.md) |
| **X6** | Troubleshooting: diagnostics, health checks, crash recovery | [48](48-TROUBLESHOOTING-AND-DIAGNOSTICS.md) |

### The complete critical path

```
Media pipeline (A0) ──► Compositor (A1) ──┬─► Color (A2) ──► Formats (F9)
                                          ├─► Effects (A3) ──► Node editor (F6)
                                          └─► Transitions (A4)
                     ──► Audio (A5) ──────► Captions (A6)
                     ──► Keyframes (F0) ──► Text (F1) ──► Animation (F8)
                     ──► Templates (F2) ──► Presets (A7) ──► Render queue (A8)
                     ──► AI video (F3) ──► Agentic scale (A9)
                                                               │
                                                               ▼
                    Undo (F4) + Selection (F5) + Scripting (F7)
                                                               │
                                                               ▼
                              Cross-cutting: X0–X6 (the complete product)
```

---

### The infrastructure critical path

```
Media pipeline (A0) ──► Compositor (A1) ──┬─► Color (A2) ─┐
                                          ├─► Effects (A3) ┼─► Presets (A7) ──► Render queue (A8)
                                          └─► Transitions (A4) ┘
Media pipeline (A0) ──► Audio (A5) ──► Captions (A6) ──────┘
                                                              │
                                                              ▼
                                              Agentic scale (A9): headless, MCP, interop
```

**A0 (media pipeline) is the gate.** Nothing in A1–A9 has real content to operate on until footage
flows into the compositor. After A0, A1 and A5 can proceed in parallel (picture and sound).

---

Related: [00-VISION](00-VISION.md) · [01-PRODUCT](01-PRODUCT.md) · [wiki/Roadmap](wiki/Roadmap.md)
