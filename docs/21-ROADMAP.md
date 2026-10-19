# 21 — Unified Roadmap

**Status: living document · Legend: ✅ done · 🟡 partial · ⬜ not started**

> The honest state of both worlds, and the distance to "fully accomplished" — an AI agent can take a
> brief and footage and produce a deliverable for each genre, and a human editor can improve it by
> judgement and export it. See [00-VISION](00-VISION.md#what-fully-accomplished-looks-like).

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
| `docs/00`–`docs/21` | ✅ written (this set) |
| `docs/README` index + reading paths | ✅ |
| `scripts/check-docs.mjs` reference checker | ⬜ (see [docs/README](README.md#keeping-docs-honest)) |
| `docs/wiki/*` (World A) — add a "World B" pointer banner | ✅ (banner added) |

---

Related: [00-VISION](00-VISION.md) · [01-PRODUCT](01-PRODUCT.md) · [wiki/Roadmap](wiki/Roadmap.md)
