# Packages & Engines

All workspace packages are scoped `@printsync/*` (this predates the Virtue Studio naming). This page summarises each one. "Maturity" is
based on the current source size and intent — see [Roadmap & Status](Roadmap) for the phase view.

## Core / shared

| Package | Role | Maturity |
|---|---|---|
| `@printsync/shared` | Central creative schemas & types: brand, creative, campaign, asset, brand-context, creative-genome. Exports `DEFAULT_THRESHOLDS` and `getScoreStatus()`. | Mature |
| `@printsync/common` | Deterministic production schemas (Zod): `CreativeBrief`, `Script`, `Storyboard`, `Shot`, `ProductionPlan`, `SceneGraph`, `VisualGrammar`, plus `validateProductionPlan`. | Mature |
| `@printsync/creative-engine` | The intelligence layer: `CreativeDirector`, `CreativeJudge`, V2 judge, anti-generic (v1/v2), story grammar, metaphors, seeds, diversity, rework, brief generator, daily-V2 orchestration, inlined campaign functions. | Mature (largest package) |
| `@printsync/brand-engine` | Brand brain and memory: loads `brand/printsync` JSON and campaign history. | Implemented |
| `@printsync/campaign-engine` | Campaign management and history. Note some functions are also inlined into `creative-engine` (`campaign-functions.ts`). | Implemented |

## Production planning engines (Phase 3)

These are wired together by `@printsync/production-orchestrator` and mostly contain deterministic
placeholder logic intended to be replaced by richer implementations / LLMs later.

| Package | Role | Class / entry |
|---|---|---|
| `@printsync/production-orchestrator` | Runs the full planning pipeline and returns a validated `ProductionPlan`. | `buildProductionPlan(brief, options)` |
| `@printsync/subject-engine` | Extracts `keyEntities` and `primaryGoal` from the brief. | `SubjectEngine.analyze` |
| `@printsync/story-engine` | Plans a `StoryOutline` from subject info. | `StoryEngine.planStory` |
| `@printsync/visual-grammar-engine` | Selects a `VisualGrammar` (Explainer, Corporate, Detective, DataGeographic). | `selectVisualGrammar(brief)` |
| `@printsync/script-engine` | Deterministic script: splits brief duration across outline beats. | `ScriptEngine.generateScript` |
| `@printsync/storyboard-engine` | Builds storyboard shots from the script. | `StoryboardEngine.generateStoryboard` |
| `@printsync/shot-engine` | Plans timed shots against the brief duration. | `ShotEngine.planShots` |
| `@printsync/scene-graph-engine` | Builds a relational `SceneGraph` (nodes/edges) from shots. | `SceneGraphEngine.buildGraph` |

## Motion & rendering (implemented)

| Package | Role | Key exports |
|---|---|---|
| `@printsync/motion-engine` | Deterministic motion and 3D scene specification: camera plans and a cinematic shot list, a millimetre-exact print-item catalogue, a frame-addressable animation library, procedural printed artwork, and the living-city scene generators (layout, route, traffic, street furniture, trading shopfronts, road signage, out-of-home formats). | `resolveCameraPlan`, `resolveCityCameraPlan`, `SHOWCASE_SHOTS`, `animatePrintObject`, `PRINT_ITEMS`, `generateCityLayout`, `resolveCityInputs` |
| `@printsync/render-farm` | Enterprise rendering: pure, resumable render plans (shard a film into worker jobs), a lazily-loaded Remotion Lambda driver, and FFmpeg `argv` builders for stitch / mux / transcode / thumbnails. | `buildRenderPlan`, `frameRangeArg`, `createLambdaRenderer`, `ffmpegMuxArgs`, `runBinary` |

See [Motion & Renderer](Motion-and-Renderer) for the full picture, and
[Enterprise Rendering](Enterprise-Rendering) for the farm.

## Production engines (Phase 5, mostly stubs)

Packages that currently expose minimal or placeholder logic:

| Package | Intended role |
|---|---|
| `@printsync/video-engine` | Footage analysis, AI video shots, editing, composition |
| `@printsync/image-engine` | Image generation and design — produces still keyframes / frame plates for motion-designed pieces (no standalone static output). |
| `@printsync/typography-engine` | Kinetic typography |
| `@printsync/infographic-engine` | Data visualisation |
| `@printsync/asset-engine` | Asset intelligence and registry |
| `@printsync/audio-engine` | Sound design, voiceover, music |
| `@printsync/qa-engine` | Brand / typography / logo / content QA, genericity detection |
| `@printsync/export-engine` | Multi-format export |

## Tooling

| Package | Role |
|---|---|
| `@printsync/cli` | The `printsync` command-line interface (Commander + Chalk + Inquirer). See [CLI Reference](CLI-Reference). |

## Typical import

```typescript
import { CreativeDirector, CreativeJudge } from '@printsync/creative-engine';
import { buildProductionPlan } from '@printsync/production-orchestrator';
import type { ProductionPlan } from '@printsync/common';
import type { CreativeBrief } from '@printsync/shared';
```

> **Note on dual brief types:** `@printsync/shared` defines a creative `CreativeBrief`
> (`objective`, `service`, `audience`, `emotional_objective`, `platform`, `formats`, `voice_mode`,
> `creative_mode`) used by the CLI/creative engine. `@printsync/common` defines a production
> `CreativeBrief` (`title`, `duration`, `mode`, `service`, `objective`, `voice`, `scenes`) used by the
> planning pipeline. They are separate contracts for separate layers — do not assume they interchange.
