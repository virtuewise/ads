# Virtue Studio — Documentation

> **Premium visual storytelling, motion graphics, and cinematic advertising solutions that transform
> ideas into compelling brand experiences.**

This is the index for the whole documentation set. It is numbered so that **reading it in order is the
intended path**: from the vision, through the editor engine, into the six genre workflows, out to
operations, and on into the **advanced capability plan** (`22`–`31`).

---

## How to read this

Every document carries a status marker in its header:

| Marker | Meaning |
|---|---|
| ✅ | Implemented — the code exists and the doc describes current behaviour |
| 🟡 | Partial — implemented but placeholder, incomplete, or being extended |
| ⬜ | Planned — designed, not yet built |

Docs reference real files and symbols. If a referenced path no longer exists, the doc is **stale** —
see [Keeping docs honest](#keeping-docs-honest).

---

## The two worlds

Virtue Studio is two systems that share one repository:

| World | Code | What it is | Docs |
|---|---|---|---|
| **A — The Engine Monorepo** | `packages/*`, `apps/studio`, `apps/renderer`, `apps/dashboard`, `packages/cli` | The brand-aware creative engine: concepts, scoring, planning, motion, enterprise rendering | `docs/wiki/*`, and the monorepo sections of `02-ARCHITECTURE` |
| **B — Virtue Studio (the app)** | `apps/electron` (`@printsync/electron`) | The **engine-driven motion-design editor**: WebGPU compositor, DAG→WGSL, dual project format, local export, six genre workflows, node graph, Monaco, timeline | `docs/00`–`docs/21` (current) + `docs/22`–`docs/31` (advanced plan) |

World **B** is the product. World **A** is the intelligence that *feeds* it: the engines that generate
concepts, plans, scripts, and assets an agent or human then edits in World B.

---

## Table of contents

### I — Orientation

| # | Document | Summary |
|---|---|---|
| — | `docs/README.md` | **This file.** Index, reading paths, staleness rules. |
| 00 | [`00-VISION.md`](00-VISION.md) | Why Virtue Studio exists; the principles; the two audiences. |
| 01 | [`01-PRODUCT.md`](01-PRODUCT.md) | What the app is; personas (human + agent); feature map; scope. |
| 02 | [`02-ARCHITECTURE.md`](02-ARCHITECTURE.md) | How the two worlds fit together; layers; the DAG as the unified core. |

### II — Core subsystems (the editor engine)

| # | Document | Summary |
|---|---|---|
| 03 | [`03-ENGINE-CORE.md`](03-ENGINE-CORE.md) | DAG engine, node classes, WGSL compiler, code ⟷ nodes interchange. |
| 04 | [`04-RENDERING.md`](04-RENDERING.md) | WebGPU viewport + headless renderer; the WYSIWYG uniform contract. |
| 05 | [`05-PROJECT-FORMAT.md`](05-PROJECT-FORMAT.md) | The `.vfxproj` dual format: deterministic JSON and `VFXP` binary. |
| 06 | [`06-TIMELINE.md`](06-TIMELINE.md) | Tracks, clips, keyframes, snapping, easing. |
| 07 | [`07-EXPORT-PIPELINE.md`](07-EXPORT-PIPELINE.md) | WebGPU → FFmpeg → SSD; the two presets; encoder probing. |
| 08 | [`08-SCRIPTING-API.md`](08-SCRIPTING-API.md) | JS/TS scripting, Monaco interchange, the agent automation API. |

### III — Genre intelligence (the six workflows)

| # | Document | Summary |
|---|---|---|
| 09 | [`09-GENRE-SYSTEM.md`](09-GENRE-SYSTEM.md) | Genres, SmartCut profiles, keyframe presets, templates. |
| 10 | [`10-GENRE-3D-ANIMATION.md`](10-GENRE-3D-ANIMATION.md) | Multi-pass compositing, animatic pre-vis, frame-rate conversion. |
| 11 | [`11-GENRE-NARRATIVE.md`](11-GENRE-NARRATIVE.md) | J/L cuts via WebAudio, continuity, performance selection. |
| 12 | [`12-GENRE-CORPORATE.md`](12-GENRE-CORPORATE.md) | Brand LUTs, safe zones, retention structure, multi-aspect. |
| 13 | [`13-GENRE-EXPLAINER.md`](13-GENRE-EXPLAINER.md) | Kinetic typography, vector engine, information architecture. |
| 14 | [`14-GENRE-DOCUMENTARY.md`](14-GENRE-DOCUMENTARY.md) | Metadata + transcript search, B-roll layering, Kuleshov effect. |
| 15 | [`15-GENRE-DETECTIVE.md`](15-GENRE-DETECTIVE.md) | Frame ring-buffer caching, precision trimming, tension design. |

### IV — Platform & operations

| # | Document | Summary |
|---|---|---|
| 16 | [`16-INTERFACE.md`](16-INTERFACE.md) | The human UI: shell layout, components, tokens, interaction contracts. |
| 17 | [`17-AI-AGENTS.md`](17-AI-AGENTS.md) | How AI agents operate the system end to end. |
| 18 | [`18-BRAND-AND-LUTS.md`](18-BRAND-AND-LUTS.md) | Brand system inside the editor; LUT ids; safe zones; brand QA. |
| 19 | [`19-QUALITY-AND-TESTS.md`](19-QUALITY-AND-TESTS.md) | QA, the verify trio, test strategy, acceptance criteria. |
| 20 | [`20-OPERATIONS.md`](20-OPERATIONS.md) | Setup, running, the Electron launch gotcha, hardware, troubleshooting. |
| 21 | [`21-ROADMAP.md`](21-ROADMAP.md) | The unified roadmap: World A phases + World B milestones. |

### V — Advanced subsystems (the capability build-out)

These are **designed, not yet built** (⬜). They specify the road from the current editor to a
production-grade, futuristic studio. Read them after the core subsystems and the genre set.

| # | Document | Summary |
|---|---|---|
| 22 | [`22-COMPOSITOR.md`](22-COMPOSITOR.md) | Layers, masks, blend modes, 3D camera/lights, motion blur, nested comps. |
| 23 | [`23-COLOR.md`](23-COLOR.md) | Grading engine: primaries, curves, qualifiers, `.cube` 3D LUTs, scopes, ACES colour management. |
| 24 | [`24-TRANSITIONS.md`](24-TRANSITIONS.md) | The transition engine: WGSL primitives, luma wipes, optical-flow morphs, presets. |
| 25 | [`25-AUDIO.md`](25-AUDIO.md) | WebAudio graph, waveforms, J/L cuts, time-stretch, loudness (EBU R128), audio muxing. |
| 26 | [`26-CAPTIONS.md`](26-CAPTIONS.md) | Local transcription (Whisper), word-level timing, caption styling/animation, burn-in + sidecars. |
| 27 | [`27-EFFECTS-LIBRARY.md`](27-EFFECTS-LIBRARY.md) | The WGSL effect catalogue, texture-sampling node contract, compute nodes, particles. |
| 28 | [`28-PRESETS.md`](28-PRESETS.md) | Parameterized presets and templates: looks, motion, titles, captions, transitions, graphs. |
| 29 | [`29-MEDIA-PIPELINE.md`](29-MEDIA-PIPELINE.md) | Import, WebCodecs decode, zero-copy GPU textures, frame ring buffer, proxies, indexing. |
| 30 | [`30-RENDER-QUEUE.md`](30-RENDER-QUEUE.md) | Render queue, batch/variant delivery, GPU parallelism, HDR, deliverable packaging. |
| 31 | [`31-AI-AGENTIC-SCALE.md`](31-AI-AGENTIC-SCALE.md) | Headless CLI, agent op API v2, MCP server, EDL/OTIO interop, multi-agent merge. |

### VI — Engine monorepo reference (World A)

| Document | Summary |
|---|---|
| [`wiki/`](wiki/Home.md) | The original wiki: Home, Architecture, Packages & Engines, Production Pipeline, Enterprise Rendering, CLI, API, Brand, Creative System, Contributing. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md), [`API.md`](API.md), [`BRAND.md`](BRAND.md), [`CREATIVE.md`](CREATIVE.md), [`CONTRIBUTING.md`](CONTRIBUTING.md) | Flat reference docs for the monorepo. |

---

## Reading paths

Pick the path that matches your job:

**I'm a human editor learning the app**
`01-PRODUCT` → `16-INTERFACE` → `06-TIMELINE` → `09-GENRE-SYSTEM` → your genre doc (`10`–`15`) →
`07-EXPORT-PIPELINE`.

**I'm an AI agent that must operate the system**
`00-VISION` → `02-ARCHITECTURE` → `03-ENGINE-CORE` → `05-PROJECT-FORMAT` → `08-SCRIPTING-API` →
`17-AI-AGENTS` → `09-GENRE-SYSTEM`.

**I'm a contributor changing the engine**
`02-ARCHITECTURE` → `03-ENGINE-CORE` → `04-RENDERING` → `05-PROJECT-FORMAT` → `19-QUALITY-AND-TESTS`
→ `20-OPERATIONS`.

**I'm extending the genre intelligence**
`09-GENRE-SYSTEM` → the relevant genre doc → `18-BRAND-AND-LUTS` → `03-ENGINE-CORE`.

**I'm operating / deploying**
`20-OPERATIONS` → `07-EXPORT-PIPELINE` → `19-QUALITY-AND-TESTS` → `21-ROADMAP`.

**I'm planning or building the advanced capabilities**
`00-VISION` → `21-ROADMAP` (the critical path) → `29-MEDIA-PIPELINE` (the frontier) →
`22-COMPOSITOR` → `23-COLOR` → `27-EFFECTS-LIBRARY` → `24-TRANSITIONS` → `25-AUDIO` →
`26-CAPTIONS` → `28-PRESETS` → `30-RENDER-QUEUE` → `31-AI-AGENTIC-SCALE`.

---

## Keeping docs honest

The numbered set is **living documentation**: each doc names the files and symbols it describes. To
prevent drift:

```bash
pnpm docs:check     # verifies every referenced path exists (scripts/check-docs.mjs)
```

The checker scans `docs/*.md` for `path/to/file.ext` references and fails if a referenced path is
missing. Run it before pushing doc changes, and after refactors that move files.

A doc is **stale** when:

1. It references a file that no longer exists (caught by `docs:check`).
2. It describes a behaviour the code no longer has (caught by review).
3. Its status marker overstates maturity (✅ on something that is 🟡).

When a doc goes stale, fix it in the same commit as the code change — never in a later one.

---

Footer — © 2026 Virtue Studio. Private.
