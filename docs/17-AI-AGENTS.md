# 17 — AI Agent Operating Guide

**Status: 🟡 (project + engine APIs real; headless CLI ⬜) · Docs: this guide, [05](05-PROJECT-FORMAT.md), [08](08-SCRIPTING-API.md)**

> This is the operating manual for an AI agent working inside Virtue Studio. It is the counterpart to
> [16-INTERFACE](16-INTERFACE.md): where that documents the human's door, this documents the agent's —
> and the workspace the two share.

---

## The agent's mental model

An agent does **not** "prompt a video into existence." It:

1. **Understands the brief** — objective, service, audience, duration, format.
2. **Picks a genre** — which selects a SmartCut profile, keyframe presets, templates, and a pipeline.
3. **Gathers ingredients** from the engine monorepo — concepts, metaphors, typography, grammars.
4. **Authors a `ProjectDocument`** — the deterministic JSON tree that *is* the edit.
5. **Renders and exports locally** — WebGPU frames → FFmpeg → SSD.

Every step produces **readable, diffable data**. There are no hidden side effects. This is what makes an
agent auditable: a human can inspect the diff between the agent's project and the previous one.

---

## The shared contract

Both doors open onto `ProjectDocument` ([05-PROJECT-FORMAT](05-PROJECT-FORMAT.md)):

```json
{
  "format": "vfxproj",
  "version": 1,
  "composition": { "width": 1920, "height": 1080, "fps": 30, "duration": 15, … },
  "genre": "corporate",
  "safeZones": { "active": true, "ratio": "16:9" },
  "brandLUT": "cool-tech",
  "timeline": { "duration": 15, "clips": [ … ] },
  "graph": { "nodes": [], "edges": [] },
  "effectsStack": []
}
```

The agent writes this; the human opens it, edits it, saves it. The agent reads it back. **JSON mode is
sorted and deterministic, so the diff is exactly the agent's change.**

---

## Available capabilities

### Engine data (in-app)

Through `window.studio.engine.*` ([08-SCRIPTING-API](08-SCRIPTING-API.md)):

| Call | Use |
|---|---|
| `getModes()` | Choose a creative mode for the brief |
| `generateConcepts(brief)` | Produce scored concepts |
| `getMetaphors(territory?)` / `getMetaphorsForService(service)` | Find a visual metaphor |
| `getTypographyPresets()` | Kinetic-type treatments |
| `getVFXEffects()` | Effect catalogue |
| `getVisualGrammars()` | Story structure (Explainer/Corporate/Detective/…) |

### Projects (in-app)

`window.studio.project.*`: `saveProject`, `openProject`, `writeProject`, `readProject`.

### Export (in-app)

`window.studio.probeEncoders/chooseExportPath/startExport/writeExportFrame/finishExport/cancelExport/onExportProgress`.

### Out-of-app

`main/projectCodec.ts` is **pure** — an agent can read/write projects in any Node script without Electron
([08-SCRIPTING-API](08-SCRIPTING-API.md#out-of-app-scripting-headless)).

---

## The genre playbooks

Each genre has a pipeline ([09-GENRE-SYSTEM](09-GENRE-SYSTEM.md#pipelines)) that is the agent's default
procedure. Summarised:

| Genre | Agent procedure | Deep dive |
|---|---|---|
| 3D/CGI | Import passes → composite in the graph → hold `reframe:none` → retime → grade | [10](10-GENRE-3D-ANIMATION.md) |
| Narrative | Pull strongest takes → invisible-cut spine → J/L overlaps → hold → grade `cinematic` | [11](11-GENRE-NARRATIVE.md) |
| Corporate | Hook in 2–3s → auto-cut aggressive → subject-lock reframe → brand LUT → safe zones | [12](12-GENRE-CORPORATE.md) |
| Explainer | Align to VO → kinetic type per callout → metaphor → step reveals → captions | [13](13-GENRE-EXPLAINER.md) |
| Documentary | Tag → transcribe → search → interview spine → B-roll layer → juxtaposition | [14](14-GENRE-DOCUMENTARY.md) |
| Detective | Hard cuts `scenes:off` → `clue linger` → `red herring push` → withhold → `reveal snap` | [15](15-GENRE-DETECTIVE.md) |

---

## Worked example: a 30s corporate cutdown

```typescript
// 1. Ingest the brief
const brief = {
  objective: 'Drive trial signups',
  service: 'large-format-printing',
  audience: 'small businesses',
  emotional_objective: 'inspire',
  platform: ['social'],
  formats: ['16:9', '9:16'],
};

// 2. Gather ingredients
const modes = await window.studio.getModes();
const concepts = await window.studio.generateConcepts(brief);
const metaphors = await window.studio.getMetaphorsForService(brief.service);
const typography = await window.studio.getTypographyPresets();

// 3. Choose genre + template (Corporate / Brand Anthem)
import { GENRE_WORKFLOWS } from './engine/genre-workflows';
const genre = GENRE_WORKFLOWS.corporate;
const template = genre.templates.find((t) => t.id === 'corp-brand')!;

// 4. Author the document (beats → clips, LUT from template)
const doc = {
  format: 'vfxproj', version: 1,
  savedAt: new Date().toISOString(),
  app: { name: 'Virtue Studio', version: '0.1.0' },
  composition: { name: 'Trial Signups 30s', width: 1920, height: 1080, fps: 30, duration: 30,
                 background: '#07090d',
                 transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 } },
  genre: 'corporate',
  safeZones: { active: true, ratio: '16:9' },
  brandLUT: template.lut,                     // 'cool-tech'
  timeline: { duration: 30, clips: /* beats → clips */ [] },
  graph: { nodes: [], edges: [] },
  effectsStack: [],
};

// 5. Write it deterministically (small, reviewable diff)
await window.studio.writeProject('C:/work/trial-30s.vfxproj', doc, 'json');

// 6. Export a review cut
const target = /* EXPORT_TARGETS.find(t => t.id === 'fast-1080p') */;
// → runExport(...)  (see engine/export.ts)
```

A human then opens `trial-30s.vfxproj`, sharpens the hook, and reviews the timeline.

---

## Rules for agents

1. **Never invent engine ids.** `brandLUT` must be one of `none`, `warm-brand`, `cool-tech`, `cinematic`,
   `vibrant`. `genre` must be one of the six. Keyframe `easing` must be one of the four. Invalid values
   are silently coerced by `normalizeProject` — which hides mistakes. Emit valid values.
2. **Prefer JSON mode** for anything a human will review — it produces a readable diff.
3. **Do not fight the genre profiles.** `scenes: off` for Narrative/Detective means *do not auto-cut* —
   the choice of cut is the craft. Respect the profile.
4. **Write documents, not mutations.** Produce a complete `ProjectDocument`; let `normalizeProject`
   validate. Do not assume hidden state.
5. **Respect the quality gates.** Run the verify trio before proposing a change to code
   ([19-QUALITY-AND-TESTS](19-QUALITY-AND-TESTS.md)).
6. **Stay local.** No cloud calls; everything runs on the operator's machine.
7. **Leave the human the taste decisions.** Agents assemble; humans select performances, tune tension,
   and judge mise-en-scène.

---

## Repo conventions an agent must follow

- **Formula:** `pnpm install` → verify with `pnpm --filter @printsync/electron build`, `npx tsc --noEmit`,
  `pnpm exec biome check apps/electron`.
- **Pre-push:** `pnpm test` (full CI) must be green.
- **Commits:** keep them scoped; a doc change accompanies the code change it describes
  ([docs/README](README.md#keeping-docs-honest)).
- **Biome landmines** are listed in [16-INTERFACE](16-INTERFACE.md#accessibility--lint-constraints).
- **Windows/PowerShell quirks** and the **Electron launch gotcha** are in
  [20-OPERATIONS](20-OPERATIONS.md).

---

## Multi-agent workflow

The system supports specialised agents sharing the project document:

| Agent | Responsibility | Output |
|---|---|---|
| **Creative agent** | Brief → concepts → genre choice | `genre`, `brandLUT`, template id |
| **Assembly agent** | Beats → timeline clips, keyframes | `timeline` |
| **Technical agent** | DAG, effect stack, render/export | `graph`, `effectsStack`, encoded file |
| **QA agent** | Brand/safe-zone/genericity checks | pass/fail gates on export |

They coordinate through the **file**, not a shared process — which is why determinism and diffability
matter. Each agent's contribution is a reviewable patch to the document.

---

## Reliability contract

An agent can depend on:

- **`normalizeProject` never throws** — malformed input is coerced to a valid document.
- **The codec detects format by content** — magic bytes beat extensions.
- **The render is deterministic** — same document, same pixels ([04](04-RENDERING.md)).
- **The export is bounded** — backpressure prevents memory blow-up ([07](07-EXPORT-PIPELINE.md)).

An agent must **not** depend on:

- Media import (⬜), transcript search (⬜), audio muxing (⬜), headless CLI (⬜) — all roadmap items
  ([21-ROADMAP](21-ROADMAP.md)).

---

Related: [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md) · [08-SCRIPTING-API](08-SCRIPTING-API.md) ·
[09-GENRE-SYSTEM](09-GENRE-SYSTEM.md) · [19-QUALITY-AND-TESTS](19-QUALITY-AND-TESTS.md)
