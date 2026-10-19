# Production Pipeline

The production pipeline turns a validated `CreativeBrief` into a `ProductionPlan` using only
deterministic code. It lives in `@printsync/production-orchestrator` and is exercised by the
`apps/demo` CLI.

## Entry point

```typescript
import { buildProductionPlan } from '@printsync/production-orchestrator';

const plan = await buildProductionPlan(brief, {
  seed: 'daily-2026-10-12', // optional; defaults to brief.id or a UUID
  validate: true,           // default true → runs ProductionPlanSchema.parse
});

console.log(plan.productionStatus); // "PLANNING"
```

## Pipeline stages

| # | Stage | Engine | Output |
|---|---|---|---|
| 1 | Subject analysis | `SubjectEngine.analyze` | `{ keyEntities, primaryGoal }` |
| 2 | Story planning | `StoryEngine.planStory` | `{ outline: string[] }` |
| 3 | Visual grammar selection | `selectVisualGrammar` | `VisualGrammar` |
| 4 | Script generation | `ScriptEngine.generateScript` | `Script { steps }` |
| 5 | Storyboard generation | `StoryboardEngine.generateStoryboard` | `Storyboard { shots }` |
| 6 | Shot planning | `ShotEngine.planShots` | `Shot[]` |
| 7 | Scene-graph construction | `SceneGraphEngine.buildGraph` | `SceneGraph { nodes, edges }` |

The assembled `ProductionPlan` includes empty slots for the not-yet-wired sections: `assets`,
`typography`, `motion`, `vfx`, `audio`, `edit`, `qa`, `output`.

> **Motion-First:** the pipeline is a motion-design pipeline. Posters, social formats, typography,
> infographics, brand layouts, and the logo system are animated/motion deliverables; `image-engine`
> generates still keyframes/plates, and `motion-engine` animates them. There is no standalone
> static output.

## Brief shape (production layer)

From `@printsync/common` (`CreativeBriefSchema`):

```typescript
interface CreativeBrief {
  title: string;
  duration: number;   // seconds, > 0
  mode: string;       // e.g. "EXPLAINER", "CORPORATE", "DETECTIVE"
  service: string;
  objective: string;
  voice: string;      // e.g. "DIALOGUE", "NARRATION"
  scenes: string[];
}
```

`selectVisualGrammar` inspects `mode` (case-insensitive) and returns one of four grammars:

| Grammar | Sequence |
|---|---|
| **Explainer** | Hook → Problem → Mechanism → Transformation → Benefit → CTA |
| **Corporate** | World → Challenge → System → People → Impact → BrandSignature |
| **Detective** | Mystery → Clue → Evidence → Connection → Discovery → Reveal |
| **DataGeographic** | Question → Data → Pattern → Location → Insight |

Fallback is **Explainer**.

## Running the demo

`apps/demo` reads a brief JSON file and prints the plan:

```bash
# from repo root, after building
node apps/demo/dist/cli.js path/to/brief.json
```

Example brief file:

```json
{
  "title": "Print Has Power",
  "duration": 30,
  "mode": "EXPLAINER",
  "service": "large-format-printing",
  "objective": "Drive awareness of large-format capabilities",
  "voice": "NARRATION",
  "scenes": ["studio", "press", "installation"]
}
```

If the file is missing or invalid JSON, the CLI reports the error and exits non-zero. Validation
failures from `ProductionPlanSchema.parse` throw.

## Determinism

`ScriptEngine` is explicitly deterministic: it divides the brief duration evenly across outline
beats and fills placeholder dialogue (`"<beat> – placeholder dialogue"`). Downstream engines are
deterministic too. The `seed` option is threaded to engines that support it, so the same brief +
seed should produce the same plan.

## Current limitations

Treat the **planning pipeline** as **scaffolding**, not finished output:

- Subject, story, and script stages return placeholder data; comments mark them as
  "can be replaced by LLM later".
- `assets`, `typography`, `motion`, `vfx`, `audio`, `edit`, `qa`, and `output` are left empty.
- `productionStatus` is always `"PLANNING"` for now (no transition to `"COMPLETE"`).
- Phase 4 (`@printsync/motion-engine`) and the render-farm (`@printsync/render-farm`) are
  fully implemented; other Phase 4–5 engine packages remain stubs (see
  [Packages & Engines](Packages-and-Engines)).

The mature, working end-to-end path today is the **CLI creative flow** (`ads:create` / `ads:daily`),
described in [Creative System](Creative-System) and [CLI Reference](CLI-Reference).
