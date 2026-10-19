# Virtue Studio
[![pnpm](https://img.shields.io/badge/pnpm-10-blue)](https://pnpm.io/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/) [![TurboRepo](https://img.shields.io/badge/TurboRepo-2-purple)](https://turborepo.org/) [![WebGPU](https://img.shields.io/badge/WebGPU-WGSL-ff5a2c)](https://www.w3.org/TR/webgpu/) [![Electron](https://img.shields.io/badge/Electron-44-5eead4)](https://www.electronjs.org/)

> **Premium visual storytelling, motion graphics, and cinematic advertising solutions that transform ideas into compelling brand experiences.**

Virtue Studio is a **local-first, engine-driven motion-design studio**: an editing application whose entire
state is a human-readable, git-versionable program, rendered on your own GPU through WebGPU, encoded by
your own FFmpeg, and operable by **both a human editor and an AI agent** through two doors onto the same
document.

---

## Two systems, one repository

| World | Code | What it is | Docs |
|---|---|---|---|
| **A — Engine monorepo** | `packages/*`, `apps/studio`, `apps/renderer`, `apps/dashboard`, `packages/cli` | The brand-aware creative engine: concepts, scoring, planning, motion, enterprise rendering. It generates the **ingredients**. | [`docs/wiki/`](docs/wiki/Home.md) |
| **B — Virtue Studio (the editor)** | `apps/electron` (`@printsync/electron`) | The engine-driven motion-design **editor** — the product. WebGPU compositor, DAG → WGSL, dual `.vfxproj` format, local FFmpeg export, six genre workflows, node graph, Monaco, keyframe timeline. | **[`docs/README.md`](docs/README.md)** — read `00`–`21` in order |

**World A produces. World B composes, edits, and delivers.** Everything an agent or human edits in the
editor is a single deterministic `ProjectDocument` — the shared contract.

---

## Start here

| If you are… | Read |
|---|---|
| **New to the project** | [`docs/README.md`](docs/README.md) → [`docs/00-VISION.md`](docs/00-VISION.md) → [`docs/01-PRODUCT.md`](docs/01-PRODUCT.md) |
| **Learning the editor** | [`docs/01-PRODUCT.md`](docs/01-PRODUCT.md) → [`docs/16-INTERFACE.md`](docs/16-INTERFACE.md) → [`docs/06-TIMELINE.md`](docs/06-TIMELINE.md) |
| **An AI agent operating the system** | [`docs/17-AI-AGENTS.md`](docs/17-AI-AGENTS.md) → [`docs/05-PROJECT-FORMAT.md`](docs/05-PROJECT-FORMAT.md) → [`docs/08-SCRIPTING-API.md`](docs/08-SCRIPTING-API.md) |
| **Changing the engine** | [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md) → [`docs/03-ENGINE-CORE.md`](docs/03-ENGINE-CORE.md) → [`docs/04-RENDERING.md`](docs/04-RENDERING.md) → [`docs/19-QUALITY-AND-TESTS.md`](docs/19-QUALITY-AND-TESTS.md) |
| **Extending the genres** | [`docs/09-GENRE-SYSTEM.md`](docs/09-GENRE-SYSTEM.md) → the relevant genre doc `10`–`15` |
| **Setting it up / troubleshooting** | [`docs/20-OPERATIONS.md`](docs/20-OPERATIONS.md) |
| **Planning what's next** | [`docs/21-ROADMAP.md`](docs/21-ROADMAP.md) |

---

## The three commitments

### 1. Local-first

No cloud, no account, no upload. Compositing runs on WebGPU, encoding on your own FFmpeg, output on
your own SSD. The trade-off is explicit: the app manages your hardware — CPU, RAM, and GPU VRAM —
rather than hiding it. See [`docs/04-RENDERING.md`](docs/04-RENDERING.md) and
[`docs/20-OPERATIONS.md`](docs/20-OPERATIONS.md).

### 2. Programmable by default

Every UI affordance has a code equivalent, and every code construct has a UI equivalent:

```
[ JS/TS Scripting API ] ◄────► [ Unified DAG Engine ] ◄────► [ Nodal Visual UI ]
                                       │
                                       ▼
                     [ WebGPU Pipeline / WGSL Shader Generation ]
```

Drag a node and you change a JSON tree; edit that JSON and you change the node graph; type WGSL in a
**Script node** and you get a bespoke effect that survives round-tripping. See
[`docs/03-ENGINE-CORE.md`](docs/03-ENGINE-CORE.md) and [`docs/08-SCRIPTING-API.md`](docs/08-SCRIPTING-API.md).

### 3. Deterministic rendering controls the final product

**The preview is not an approximation of the export — it *is* the export, at lower resolution.** The
viewport and the exporter import the *same* WGSL and the *same* uniform packing from one module
(`engine/visual.ts`). There is no second implementation to drift. See
[`docs/04-RENDERING.md`](docs/04-RENDERING.md).

---

## Core principle

**Never treat the task as: PROMPT → AI OUTPUT → DONE**

```
BUSINESS OBJECTIVE
→ CREATIVE STRATEGY
→ CONCEPTS
→ CREATIVE JUDGE
→ SELECTED CONCEPT
→ SCRIPT
→ STORYBOARD
→ ART DIRECTION
→ ASSET PLAN
→ PRODUCTION
→ EDIT
→ SOUND
→ BRAND QA
→ CREATIVE QA
→ MARKETING QA
→ EXPORT
→ ARCHIVE
→ LEARNING
```

AI generates **ingredients**. Code controls the **composition**. Deterministic rendering controls the
**final product**. The editor never lets a model decide the edit — it lets a model *propose* structured
data that is validated, then compiled deterministically.

---

## Motion-first principle

**Everything in Virtue Studio is motion-designed.** There is no standalone "static" deliverable:

- **Posters** are animated key visuals; still frames are exported for print (CMYK/DPI is an export concern).
- **Stories and social posts** are animated short-form motion pieces — never a flat image.
- **Carousels, infographics, brand layouts, and logo systems** are produced as motion pieces, with still keyframes only when a physical deliverable requires them.

Design, production, and export always flow through the motion pipeline.

---

## The six genre workflows

Standard editors treat every timeline the same. Virtue Studio **retunes itself to the genre** — each
carries its own smart-cut profile, keyframe presets, templates, and pipeline.

| Genre | Focus | Deep dive |
|---|---|---|
| **3D Animation & CGI** | Timing & pre-vis, multi-pass compositing | [`docs/10`](docs/10-GENRE-3D-ANIMATION.md) |
| **Narrative Fiction** | Emotion, performance, J/L cuts | [`docs/11`](docs/11-GENRE-NARRATIVE.md) |
| **Corporate & Commercial** | Conversion, brand, retention | [`docs/12`](docs/12-GENRE-CORPORATE.md) |
| **Explainer & Infographic** | Clarity, kinetic typography | [`docs/13`](docs/13-GENRE-EXPLAINER.md) |
| **Documentary** | Authenticity, script-from-footage | [`docs/14`](docs/14-GENRE-DOCUMENTARY.md) |
| **Detective & Mystery** | Suspense, misdirection, clues | [`docs/15`](docs/15-GENRE-DETECTIVE.md) |

---

## Quick Start

```bash
# Install dependencies (peers must resolve clean)
pnpm install

# Run the editor (Vite HMR + Electron)
pnpm electron:dev

# Build everything
pnpm build

# Build just the editor
pnpm --filter @printsync/electron build
```

Verify a change before proposing it (see [`docs/19-QUALITY-AND-TESTS.md`](docs/19-QUALITY-AND-TESTS.md)):

```bash
pnpm --filter @printsync/electron build
cd apps/electron; npx tsc --noEmit
pnpm exec biome check apps/electron

# Check documentation references and run full CI
pnpm docs:check
pnpm test
```

> **Launching Electron on Windows:** if the harness or shell sets `ELECTRON_RUN_AS_NODE=1`, Electron boots
> as plain Node and the main process fails with
> `does not provide an export named 'BrowserWindow'`. The working launch procedure is in
> [`docs/20-OPERATIONS.md`](docs/20-OPERATIONS.md).

---

## Repository structure

```
ads/
├── apps/
│   ├── electron/        # ★ Virtue Studio — the editor (World B)
│   │   └── src/
│   │       ├── main/        #   OS boundary: windows, dialogs, fs, FFmpeg export
│   │       ├── preload/     #   the single window.studio bridge
│   │       └── renderer/    #   React shell + the engine core (DAG, WGSL, timeline)
│   ├── studio/          # World A dashboards
│   ├── renderer/        # Remotion renderer
│   └── dashboard/       # Analytics dashboard
├── packages/            # World A engines
│   ├── brand-engine/    #   Brand brain and memory
│   ├── creative-engine/ #   Concept generation, scoring, anti-generic
│   ├── campaign-engine/ #   Campaign management
│   ├── motion-engine/   #   Motion primitives and kinetic type
│   ├── typography-engine/   # Kinetic typography
│   ├── vfx-engine/      #   VFX effect catalogue
│   ├── visual-grammar-engine/ # Narrative grammars
│   ├── render-farm/     #   Enterprise rendering
│   ├── cli/             #   Command-line interface
│   └── shared/          #   Shared schemas and types
├── brand/printsync/     # PrintSync brand brain (identity, colours, typography, rules)
├── docs/                # ★ The numbered doc set (README + 00–21) and the World A wiki
├── scripts/             # Utility scripts (incl. check-docs.mjs)
└── tests/               # Test suites
```

The editor consumes World A engines **only in its main process** (`main/ipc.ts`) and surfaces them to the
renderer as `window.studio.engine.*`. The renderer never gets `fs` or `child_process`.

---

## The PrintSync brand

### Personality
Precise. Creative. Intelligent. Modern. Reliable. Ambitious. Technically capable. Premium. Energetic. Persistent. Detail-oriented. Confident.

### Core Message
**Your Vision. Our Precision.**

### Visual Principle
Ideas becoming physical impact.

### Motion Principle
Precision in motion.

### Creative Rule
**Never look generic.** — in the editor this is structural: brand LUTs are enforced shader inputs, safe zones are real layout constraints, and brand QA is a gate on export. See [`docs/18-BRAND-AND-LUTS.md`](docs/18-BRAND-AND-LUTS.md).

---

## Creative modes

The system supports 27 creative modes including:

- Cinematic Brand Films
- Typographic Films
- Product/Service Adverts
- Social Posts & Carousels
- Posters & Motion Posters
- Infographics & Educational
- Humor & Detective Adverts
- Transformation & Before/After
- VFX Experiments & 3D Product Films
- Campaign Films & Brand Statements

Available in the editor through `window.studio.getModes()`.

---

## Creative territories

1. **PRECISION** — Technical grids, measurement, data, machinery
2. **TRANSFORMATION** — Digital → physical, flat → dimensional
3. **SCALE** — Tiny → enormous, business card → building
4. **HUMAN IMPACT** — Businesses, customers, real-world applications
5. **PLAY** — Humour, surprise, unexpected scale, visual jokes

---

## Creative Judge

Every concept is scored against 10 dimensions, each weighted 10%: Brand Fit, Originality, Commercial
Value, Visual Potential, Emotional Impact, Memorability, Social Stop Power, Production Quality, Service
Relevance, and Non-Generic Quality.

**Thresholds:**

- `< 70` → REJECT
- `70–79` → REWORK
- `80–89` → APPROVE
- `90–100` → SIGNATURE CONCEPT

> Single source of truth: `DEFAULT_THRESHOLDS` and `getScoreStatus()` in `@printsync/shared`
> (`packages/shared/src/schemas/creative.ts`). Both the V1 and V2 judges resolve status through
> `getScoreStatus`, so these bands must be changed there only.

---

## Technical stack

**The editor (World B):**

- **Electron 44** — desktop shell (main / preload / renderer)
- **WebGPU + WGSL** — the compositor and the node-graph compiler output
- **React 19 + Vite 8** — the UI and engine core
- **Tailwind CSS 4** — the deep-ink design system (`#07090d` ink, `#ff5a2c` accent, `#5eead4` cool)
- **Zustand** — graph/document state
- **Motion** — UI motion
- **Monaco** — code ⟷ node interchange
- **FFmpeg (system binary)** — encoding; probes `nvenc` > `qsv` > `amf` > `libx264`, `prores_ks` for mezzanine

**The engine monorepo (World A):**

- **TypeScript** — type safety across the entire system
- **Remotion / Three.js / Sharp** — programmatic video, 3D, and imaging primitives
- **pnpm + Turborepo** — monorepo management

---

## Where the project stands

The editor's **compositing, editing architecture, project format, and export pipeline are real and working
end to end** — project in, graded and transformed frames out, encoded to disk, with two delivery presets
(1080p H.264 guaranteed; 4K60 ProRes where hardware allows).

The current frontier is **media import**: the timeline currently holds engine-seeded placeholder clips, and
the compositor renders the procedural grade/LUT/transform layer. Wiring real footage into the compositor's
input texture is Milestone 1. Full, honest status per feature — with ✅/🟡/⬜ markers — lives in
[`docs/01-PRODUCT.md`](docs/01-PRODUCT.md), and the dependency-ordered plan in
[`docs/21-ROADMAP.md`](docs/21-ROADMAP.md).

---

## Engineering principle

**AI generates ingredients. Code controls the composition. Deterministic rendering controls the final product.**

---

## Documentation rule

The numbered set is living documentation. Every doc names the files and symbols it describes, and
`pnpm docs:check` verifies that each referenced path still exists. **When a doc names a file that no longer
exists, the doc is stale — fix it in the same commit as the code change.** See
[`docs/README.md`](docs/README.md#keeping-docs-honest).

---

## License

Private — Virtue Studio
