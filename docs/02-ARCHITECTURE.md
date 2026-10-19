# 02 — System Architecture

**Status: ✅ (edit + render + export + genres real; media import ⬜) · Code: `apps/electron`, `packages/*`**

> Virtue Studio is a **three-process Electron application** (main / preload / renderer) whose renderer
> hosts a **WebGPU engine core** — a DAG compiled to WGSL — and whose main process owns **file
> documents** and the **FFmpeg export pipeline**. Around it sits the **engine monorepo** (World A) that
> generates the creative ingredients an agent or human brings into the editor.

---

## The big picture

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                          VIRTUE STUDIO (apps/electron)                          │
│                                                                                 │
│  ┌─────────────────────────── Electron MAIN ─────────────────────────────┐      │
│  │  main/index.ts      window lifecycle                                   │      │
│  │  main/ipc.ts        engine:* handlers (creative-engine, typography,     │      │
│  │                     vfx, visual-grammar)  ── imports @printsync/*      │      │
│  │  main/project.ts    file dialogs + fs; delegates codec                 │      │
│  │  main/projectCodec.ts  PURE: deterministic JSON + VFXP binary          │      │
│  │  main/ffmpeg.ts     resolve binary + probe encoders                    │      │
│  │  main/export.ts     ffmpeg job lifecycle (rawvideo stdin, backpressure)│      │
│  └────────────────────────────────┬────────────────────────────────────────┘      │
│                                   │ IPC (contextBridge)                          │
│  ┌─────────────────────────────── PRELOAD ────────────────────────────────┐      │
│  │  preload/index.ts   window.studio = { engine, project, export }        │      │
│  └────────────────────────────────┬────────────────────────────────────────┘      │
│                                   │ ipcRenderer.invoke                           │
│  ┌────────────────────────────── RENDERER (React + Vite) ─────────────────┐      │
│  │                                                                        │      │
│  │   App.tsx  ── the shell: menus · tool rail · canvas · timeline · panels │      │
│  │     │                                                                  │      │
│  │     ├── components/WebGPUCanvas.tsx  ◄── engine/visual.ts (WGSL+uniforms)│     │
│  │     ├── components/NodeEditor.tsx    ── engine/useDAG.ts                 │     │
│  │     ├── components/ScriptEditor.tsx  ── engine/compiler.ts (code⟷nodes)  │     │
│  │     ├── components/GenreSelector.tsx ── engine/genre-workflows.ts        │     │
│  │     ├── components/ExportPanel.tsx   ── engine/export.ts ──► preload     │     │
│  │     └── components/{SafeZones,BrandLUTPanel,Icon}.tsx                    │     │
│  │                                                                        │      │
│  │   ENGINE CORE (renderer)                                               │      │
│  │     engine/types.ts       types + GENRES + BRAND_LUTS + SAFE_ZONES      │      │
│  │     engine/nodes.ts       14 node classes → toWGSL()                    │      │
│  │     engine/compiler.ts    topo-sort → WGSL; dagToCode/codeToDAG         │      │
│  │     engine/useDAG.ts      live recompile on mutation                    │      │
│  │     engine/visual.ts      SHARED WGSL + packUniforms  (WYSIWYG contract)│      │
│  │     engine/renderFrame.ts headless WebGPU frame render + readback       │      │
│  │     engine/project.ts     defaults, buildProject, normalizeProject      │      │
│  │     engine/timeline.ts    clips, keyframes, snapping, easing            │      │
│  │     engine/genre-workflows.ts  6 genres × profiles × templates          │      │
│  │     engine/export.ts      EXPORT_TARGETS, size estimate, orchestration  │      │
│  └────────────────────────────────────────────────────────────────────────┘      │
└───────────────────────────────────────────────────────────────────────────────┘
                    ▲                                        │
                    │ ingredients                            │ encoded frames
                    │ (concepts, plans,                      ▼
                    │  presets, grammars)              system FFmpeg → SSD
┌───────────────────┴───────────────────────────────────────────────────────────┐
│                       WORLD A — ENGINE MONOREPO (packages/*)                    │
│  creative-engine · shared · common · brand-engine · campaign-engine             │
│  production-orchestrator + planning engines (subject/story/script/storyboard/   │
│  shot/scene-graph/visual-grammar) · motion-engine · render-farm                  │
│  typography-engine · vfx-engine · audio-engine · asset-engine · qa-engine · …    │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## The three processes

### Main (`apps/electron/src/main`)

Owns everything that touches the operating system: windows, file dialogs, the filesystem, and child
processes. It is the **only** place with `node:` imports and `fs` access.

| File | Responsibility |
|---|---|
| `index.ts` | `BrowserWindow` lifecycle; loads the Vite dev URL or the built `index.html`. Preload points at the compiled `preload/index.ts` output with `contextIsolation: true`, `nodeIntegration: false`. |
| `ipc.ts` | Registers all `engine:*` handlers. This is where **World A engines are imported into World B** — `@printsync/creative-engine`, `@printsync/typography-engine`, `@printsync/vfx-engine`, `@printsync/visual-grammar-engine`. Then calls `registerProjectIpc()` and `registerExportIpc()`. |
| `project.ts` | `project:save`, `:open`, `:write`, `:read`. Owns dialogs and fs; delegates all serialization to the codec. |
| `projectCodec.ts` | **Pure** (no Electron import) — testable in isolation. Deterministic JSON + `VFXP` binary encode/decode + format detection. |
| `ffmpeg.ts` | Resolves the system FFmpeg binary and probes available encoders. |
| `export.ts` | Manages the FFmpeg job: spawn, rawvideo stdin with backpressure, `export:progress` events, cancel. |

### Preload (`apps/electron/src/preload/index.ts`)

The **security boundary and API surface**. It exposes exactly one global, `window.studio`, with three
namespaces. Nothing else crosses the context bridge.

```typescript
window.studio = {
  // World A engine data (main/ipc.ts)
  getModes, getConcepts, generateConcepts, getMetaphors, getMetaphorsForService,
  getStats, getTypographyPresets, getVFXEffects, getVisualGrammars,

  // Project documents (main/project.ts)
  saveProject, openProject, writeProject, readProject,

  // Export pipeline (main/export.ts)
  probeEncoders, chooseExportPath, startExport, writeExportFrame,
  finishExport, cancelExport, onExportProgress,
};
```

> **Rule:** the renderer must never gain direct `fs` or `child_process` access. Every new capability is
> added as an explicit preload method backed by an `ipcMain.handle`. See [08-SCRIPTING-API](08-SCRIPTING-API.md).

### Renderer (`apps/electron/src/renderer/src`)

React 19 + Vite + Tailwind 4 + Zustand + Motion. Hosts the **engine core** — the DAG, the compiler, the
WGSL, the timeline model, the genre workflows, and the export orchestration. It is pure TypeScript with
WebGPU; it has no Node access and reaches the OS only through `window.studio`.

---

## The DAG as the unified core

The single most important structural idea: **the node graph, the code editor, and the WGSL that renders
are three views of one `DAG` object.**

```
      ┌─────────────────┐   drag/wire    ┌─────────────────┐
      │  NodeEditor.tsx │───────────────►│                 │
      └─────────────────┘                │                 │
      ┌─────────────────┐  dagToCode     │   DAG           │  compile()   WGSL
      │ ScriptEditor.tsx│◄──────────────►│  {nodes,edges}  │────────────► fragment
      └─────────────────┘  codeToDAG     │                 │              shader
      ┌─────────────────┐                │                 │
      │  .vfxproj graph │◄──────────────►│                 │  packUniforms
      └─────────────────┘  ser/deser     └─────────────────┘────────────► uniforms
```

- **Nodes are TypeScript classes.** Each subclass of `BaseNode` in `engine/nodes.ts` declares its ports
  and implements `execute()` (CPU semantics) and `toWGSL()` (GPU semantics).
- **The compiler** (`engine/compiler.ts`) topologically sorts nodes and concatenates their WGSL into one
  fragment shader.
- **`useDAG.ts`** recompiles whenever the graph mutates, so the canvas updates live.
- **Round-tripping** — `dagToCode(dag)` renders the graph as readable TS/WGSL, and `codeToDAG(code)`
  parses it back. This is what makes the Monaco editor and the visual graph interchangeable.

Full detail: [03-ENGINE-CORE](03-ENGINE-CORE.md).

---

## The WYSIWYG contract

The most subtle and most important invariant in the codebase:

> **The viewport and the exporter must produce identical pixels.**

This is enforced structurally, not by discipline. `engine/visual.ts` owns **both** the WGSL fragment
shader string **and** the `packUniforms()` function that lays out the uniform buffer. Both
`components/WebGPUCanvas.tsx` (live preview) and `engine/renderFrame.ts` (headless export) import the
same module. If you change the shader, you change it in one place and both paths follow.

Full detail: [04-RENDERING](04-RENDERING.md).

---

## Data flow: a frame

```
time, transform, lut, safeZones            (reactive state in App.tsx)
        │
        ▼
packUniforms(…)  ──►  Float32Array (uniform buffer, fixed byte layout)
        │
        ▼
WebGPU render pass  ──►  texture (viewport: swapchain · export: offscreen)
        │                                    │
   viewport: present                   export: mapAsync readback
                                             │
                                             ▼
                                    RGBA bytes → main/export.ts
                                             │
                                             ▼
                                    FFmpeg (rawvideo stdin) → SSD
```

---

## Data flow: a project

```
User action (UI)              Agent action (script)
      │                              │
      └──────────────┬───────────────┘
                     ▼
            ProjectDocument  { format, version, savedAt, app,
                               composition, genre, safeZones,
                               brandLUT, timeline, graph, effectsStack }
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
  engine/project.ts         main/projectCodec.ts
  normalizeProject()        encode: JSON or VFXP
  (validate + default)      decode: detect by magic/extension
```

The document is the **contract** between the two doors — see [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md)
and [17-AI-AGENTS](17-AI-AGENTS.md).

---

## How the monorepo plugs in (World A → World B)

World A packages are consumed **only in the main process**, through `main/ipc.ts`, and surfaced to the
renderer as `window.studio.engine.*`:

| World A package | Used for | Surfaced as |
|---|---|---|
| `@printsync/creative-engine` | `CreativeDirector` + `CreativeJudge` concept generation; creative modes; visual metaphors | `getModes`, `generateConcepts`, `getMetaphors`, `getStats` |
| `@printsync/typography-engine` | Typography presets for kinetic type | `getTypographyPresets` |
| `@printsync/vfx-engine` | VFX effect catalogue | `getVFXEffects` |
| `@printsync/visual-grammar-engine` | Explainer / Corporate / Detective / Transformation / HeroJourney grammars | `getVisualGrammars` |
| `@printsync/shared` | `CreativeBrief` type | (type only) |

This is deliberate: the heavy, dependency-rich engines stay in Node; the renderer stays a clean, sandboxed
web app. See [wiki/Packages-and-Engines](wiki/Packages-and-Engines.md) for the full World A inventory.

---

## Layering rules

1. **Main is the only OS boundary.** No `fs`/`child_process` outside the main process.
2. **Preload is the only IPC surface.** New capability ⇒ new preload method + `ipcMain.handle`.
3. **The renderer is pure.** No Node globals; reach the OS only via `window.studio`.
4. **Rendering is shared.** Shader + uniforms live in `engine/visual.ts`; never fork the two paths.
5. **The document is the contract.** UI and agents both mutate `ProjectDocument`; nothing owns hidden state.
6. **Codecs are pure.** `projectCodec.ts` imports no Electron — so it is unit-testable.

---

## Engine core module reference

| Module | Purpose | Doc |
|---|---|---|
| `engine/types.ts` | All types + `GENRES`, `BRAND_LUTS`, `SAFE_ZONES`, `EXPORT_PRESETS` | [03](03-ENGINE-CORE.md), [09](09-GENRE-SYSTEM.md), [18](18-BRAND-AND-LUTS.md) |
| `engine/nodes.ts` | 14 `BaseNode` subclasses + `NODE_REGISTRY` | [03](03-ENGINE-CORE.md) |
| `engine/compiler.ts` | Topo sort → WGSL; `dagToCode`/`codeToDAG` | [03](03-ENGINE-CORE.md), [08](08-SCRIPTING-API.md) |
| `engine/useDAG.ts` | Live recompile hook | [03](03-ENGINE-CORE.md) |
| `engine/visual.ts` | Shared WGSL + `packUniforms` | [04](04-RENDERING.md) |
| `engine/renderFrame.ts` | Headless WebGPU render + readback | [04](04-RENDERING.md) |
| `engine/project.ts` | Composition defaults, `buildProject`, `normalizeProject` | [05](05-PROJECT-FORMAT.md) |
| `engine/timeline.ts` | `TRACKS`, clip/keyframe ops, snapping, easing | [06](06-TIMELINE.md) |
| `engine/genre-workflows.ts` | 6 genres × SmartCut + presets + templates | [09](09-GENRE-SYSTEM.md) |
| `engine/export.ts` | `EXPORT_TARGETS`, size estimate, frame loop | [07](07-EXPORT-PIPELINE.md) |

---

Next: [03-ENGINE-CORE](03-ENGINE-CORE.md) — the DAG, nodes, and the WGSL compiler.
