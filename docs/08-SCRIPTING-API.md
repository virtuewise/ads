# 08 — Scripting API & Code ⟷ Node Interchange

**Status: 🟡 (Monaco interchange + preload bridge real; headless CLI ⬜) · Code: `components/ScriptEditor.tsx`, `engine/compiler.ts`, `preload/index.ts`**

> Two doors lead into the same engine: the **visual node graph** and the **code editor**. They are kept
> in sync by a codec (`dagToCode` / `codeToDAG`). Around them sits the **`window.studio` bridge** — the
> complete API through which a script (or an agent) drives projects, engine data, and export.

---

## Part 1 — Code ⟷ node interchange

The mechanism is fully described in [03-ENGINE-CORE](03-ENGINE-CORE.md#code--nodes-interchange). The
short version:

- `dagToCode(dag)` → an editable TypeScript module containing `export const nodeGraph = {…}` plus any
  Script-node code.
- `codeToDAG(code)` → parses that module back into a `DAG` (ids regenerated as `node-i` / `edge-i`).
- `useDAG().syncFromCode(code)` → applies code edits to the live graph and recompiles.
- **Any** graph mutation calls `dagToCode` automatically, so the code view always reflects the graph.

### The ScriptEditor UI — `components/ScriptEditor.tsx`

Two tabs plus a sync action:

| Element | Behaviour |
|---|---|
| **Node Graph Code** tab | Editable code pane (`localCode` state). Shows the generated module. |
| **Compiled WGSL** tab | Read-only, syntax-tinted view of the compiled WGSL output. |
| **Sync to Graph** button | Calls `onSync(localCode)` → `syncFromCode` → parse + recompile. Briefly shows "Syncing…". |
| Status bar | `Code ↔ Node sync active · WGSL auto-compiled · WebGPU ready` |

The code and WGSL tabs use Monaco via `@monaco-editor/react`; graph synchronization still goes through
the same `dagToCode` / `codeToDAG` codec, so editor choice does not change the scripting contract.

### The `nodeGraph` module contract

The parser expects this exact shape, so hand-written or agent-generated code must match it:

```typescript
export const nodeGraph = {
  nodes: [
    { type: 'dataSource', position: { x: 40, y: 80 }, inputs: {} },
    { type: 'transform',  position: { x: 240, y: 80 }, inputs: { scale: 1.5 } },
    // …
  ],
  edges: [
    { from: 'node-0:values', to: 'node-1:input' },
    // …
  ],
};
```

> **Gotcha:** `codeToDAG` assigns ids by array index (`node-0`, `node-1`, …). If you reorder the `nodes`
> array you must also rewrite the `edges` references. `dagToCode` output is always consistent; hand edits
> are not protected.

---

## Part 2 — The `window.studio` bridge

The preload script exposes exactly one global. This is the **entire** scripting surface available to the
renderer.

### `studio.engine.*` — World A engine data

| Method | Returns | Backed by |
|---|---|---|
| `getModes()` | Creative modes (26+) with territory/mood/voice/pace/formats/3d/vfx flags | `@printsync/creative-engine` |
| `getConcepts()` | `[]` (placeholder) | `engine:getConcepts` |
| `generateConcepts(brief)` | Concepts, each scored by `CreativeJudge` | `CreativeDirector`, `CreativeJudge` |
| `getMetaphors(territory?)` | Up to 24 visual metaphors | `VISUAL_METAPHORS` |
| `getMetaphorsForService(service)` | Metaphors for a service | `getMetaphorsForService` |
| `getStats()` | mode/territory/metaphor counts, 3d/vfx requirement counts | — |
| `getTypographyPresets()` | Kinetic-type presets | `@printsync/typography-engine` |
| `getVFXEffects()` | VFX effect catalogue | `@printsync/vfx-engine` |
| `getVisualGrammars()` | Explainer/Corporate/Detective/Transformation/HeroJourney grammars | `@printsync/visual-grammar-engine` |

Usage from the renderer:

```typescript
const modes = await window.studio.getModes();
const concepts = await window.studio.generateConcepts({
  objective: 'Launch a new service',
  service: 'branding',
  audience: 'small businesses',
  emotional_objective: 'inspire',
  platform: ['social'],
  formats: ['16:9', '9:16'],
});
```

The `Brief` and result shapes are typed in `hooks/useEngineData.ts`.

### `studio.project.*` — documents

| Method | Purpose |
|---|---|
| `saveProject(doc, {path?, format?})` | Save As; format JSON or binary |
| `openProject()` | Open dialog → `{canceled, path?, format?, doc?}` |
| `writeProject(path, doc, format)` | Write to a known path (autosave/agents) |
| `readProject(path)` | Read + parse a known path |

See [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md) for the document and codec.

### `studio.*` — media

| Method | Purpose |
|---|---|
| `pickMedia()` | Native open dialog → `{canceled, items: [{path, name, data}]}` |

The bytes come back from the **main process** (`main/media.ts`) so the renderer never touches
`fs`; the renderer then demuxes and decodes them itself
([29-MEDIA-PIPELINE](29-MEDIA-PIPELINE.md)). Drag-and-drop onto the media bin skips the dialog
and reads the dropped file directly in the renderer.

### `studio.*` — export

| Method | Purpose |
|---|---|
| `probeEncoders()` | `{ffmpegPath, version, h264[], prores[], preferred}` |
| `chooseExportPath({preset, suggestedName?})` | Native save dialog |
| `startExport(req)` | Spawns FFmpeg; returns `{started, encoder}` |
| `writeExportFrame(bytes)` | Streams one raw RGBA frame; returns `{queued}` |
| `finishExport()` | Closes the encoder's stdin |
| `cancelExport()` | Kills the job |
| `onExportProgress(cb)` | Subscribes to progress; **returns an unsubscribe** |

See [07-EXPORT-PIPELINE](07-EXPORT-PIPELINE.md).

---

## Pattern: driving an export from a script

```typescript
// 1. Probe the hardware
const report = await window.studio.probeEncoders();
console.log(report.ffmpegPath, report.preferred.h264); // e.g. 'h264_nvenc'

// 2. Pick a destination
const { path } = await window.studio.chooseExportPath({ preset: 'fast-1080p' });
if (!path) return;

// 3. Subscribe to progress and unsubscribe when done
const off = window.studio.onExportProgress((p) => console.log(p.percent.toFixed(0), '%'));

// 4. Run the renderer→FFmpeg loop (see engine/export.ts runExport)
//    ... render frames, writeExportFrame(bytes) each ...
await window.studio.finishExport();
off();
```

The full render loop lives in `runExport` (`engine/export.ts`) — see [07](07-EXPORT-PIPELINE.md#the-renderer-driver--engineexportts).

---

## Pattern: author a project without the UI

An agent can construct a document and write it directly:

```typescript
const doc = {
  format: 'vfxproj',
  version: 1,
  savedAt: new Date().toISOString(),
  app: { name: 'Virtue Studio', version: '0.1.0' },
  composition: { name: 'Agent Cut', width: 1920, height: 1080, fps: 30, duration: 15,
                 background: '#07090d',
                 transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 } },
  genre: 'corporate',
  safeZones: { active: true, ratio: '16:9' },
  brandLUT: 'cool-tech',
  timeline: { duration: 15, clips: [ /* … */ ] },
  graph: { nodes: [], edges: [] },
  effectsStack: [],
};

// JSON mode → deterministic, git-diffable
await window.studio.writeProject('C:/work/agent-cut.vfxproj', doc, 'json');
// Binary mode → checksummed
await window.studio.writeProject('C:/work/agent-cut.vfxproj.bin', doc, 'binary');
```

`normalizeProject` (run on load) will coerce anything slightly off — but a well-formed document loads
untouched. See [17-AI-AGENTS](17-AI-AGENTS.md) for the complete agent workflow.

---

## Out-of-app scripting (headless)

Today the codec (`main/projectCodec.ts`) is **pure** and can be imported by any Node script for
reading/writing projects without Electron. That is the seed of a headless pipeline:

```bash
# read any project (JSON or binary — content-detected)
node --input-type=module -e "
  import { readFileSync } from 'node:fs';
  import { parseProject } from './apps/electron/src/main/projectCodec.ts';
  const { format, doc } = parseProject(readFileSync('my.vfxproj'));
  console.log(format, doc.genre);
"
```

A first-class **headless CLI** (import media → apply genre → render → export with no window) is planned;
it depends on the media-import milestone because WebGPU frame rendering must run off-screen. See
[21-ROADMAP](21-ROADMAP.md) for sequencing and [31-AI-AGENTIC-SCALE](31-AI-AGENTIC-SCALE.md) for the full
design (CLI, agent op API v2, MCP server, interop, multi-agent merge).

---

## Rules for extending the API

1. **Never expose `fs`/`child_process` to the renderer.** Add a preload method + an `ipcMain.handle`.
2. **Keep codecs pure.** Anything testable without Electron belongs in a `*Codec.ts`-style module.
3. **Version any new IPC payload shape** and document it here and in [02-ARCHITECTURE](02-ARCHITECTURE.md).
4. **Return serializable values only** — no class instances, no functions, no `Buffer` in the renderer
   direction (use `Uint8Array`).

---

Related: [03-ENGINE-CORE](03-ENGINE-CORE.md) · [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md) ·
[07-EXPORT-PIPELINE](07-EXPORT-PIPELINE.md) · [17-AI-AGENTS](17-AI-AGENTS.md) ·
[31-AI-AGENTIC-SCALE](31-AI-AGENTIC-SCALE.md)
