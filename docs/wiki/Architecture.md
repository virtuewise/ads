# Architecture

## System overview

Virtue Studio is a modular, brand-aware advertising engine built as a monorepo. It
separates concerns into independent **engines** that can evolve independently and are wired together
by an **orchestrator**.

There are two schema layers and two notable code paths:

1. **Creative intelligence** (`@printsync/creative-engine` + `@printsync/shared`) — briefs, concepts,
   scoring, anti-generic checks, diversity. This is the mature "Phase 2" path driven by the CLI.
2. **Deterministic production planning** (`@printsync/production-orchestrator` + `@printsync/common`)
   — turns a brief into a validated `ProductionPlan` through a sequence of small engines. This is the
   newer "Phase 3" path.

## Engine layers

```
┌─────────────────────────────────────────────────────────────────┐
│                          VIRTUE STUDIO                           │
├─────────────────────────────────────────────────────────────────┤
│  CREATIVE DIRECTOR → CREATIVE JUDGE → CAMPAIGN ENGINE            │
│        │                  │                 │                    │
│        ↓                  ↓                 ↓                    │
│  STORY GRAMMAR      ANTI-GENERIC      CREATIVE HISTORY          │
├─────────────────────────────────────────────────────────────────┤
│  MOTION ENGINE      VIDEO ENGINE      IMAGE ENGINE               │
│        │                  │                 │                    │
│        ↓                  ↓                 ↓                    │
│  TYPOGRAPHY ENGINE  ASSET ENGINE      AUDIO ENGINE               │
├─────────────────────────────────────────────────────────────────┤
│  QA ENGINE          EXPORT ENGINE     DELIVERY ENGINE            │
├─────────────────────────────────────────────────────────────────┤
│              @printsync/shared / @printsync/common               │
│                   (types, schemas, utilities)                    │
└─────────────────────────────────────────────────────────────────┘
```

## Creative data flow

```
CREATIVE BRIEF
      ↓
CREATIVE DIRECTOR (generates concepts)
      ↓
CREATIVE JUDGE (scores all concepts)
      ↓
SELECTED CONCEPT
      ↓
SCRIPT / TREATMENT → STORYBOARD → ART DIRECTION → ASSET PLAN
      ↓
PRODUCTION (Motion + Video + Image)
      ↓
EDIT → SOUND DESIGN
      ↓
BRAND QA → CREATIVE QA → MARKETING QA
      ↓
EXPORT → ARCHIVE + ANALYTICS → LEARNING (feeds back into history)
```

## Deterministic production planning flow

Implemented in `packages/production-orchestrator/src/index.ts` as `buildProductionPlan(brief, options)`:

```
CreativeBrief (validated)
      ↓  SubjectEngine.analyze
  SubjectInfo
      ↓  StoryEngine.planStory
  StoryOutline
      ↓  selectVisualGrammar
  VisualGrammar
      ↓  ScriptEngine.generateScript
  Script
      ↓  StoryboardEngine.generateStoryboard
  Storyboard
      ↓  ShotEngine.planShots
  Shot[]
      ↓  SceneGraphEngine.buildGraph
  SceneGraph
      ↓
ProductionPlan  (validated with ProductionPlanSchema, status "PLANNING")
```

The orchestrator accepts a `seed` for determinism and a `validate` flag (default `true`). See
[Production Pipeline](Production-Pipeline) for details and current limitations.

## Design principles

1. **Separation of concerns** — each engine has a single responsibility.
2. **Deterministic rendering** — code controls composition, not the model.
3. **Brand-first** — every decision starts with brand fit.
4. **Anti-generic** — active detection and prevention of generic output.
5. **Creative variation** — controlled randomness prevents repetition.
6. **Modular evolution** — engines improve independently.
7. **Type safety** — TypeScript across the system; Zod for runtime validation.
8. **Testability** — every engine is testable in isolation (Vitest at the root).

## Naming

- **Virtue Studio** — the product documented here: a persistent, brand-aware advertising engine.
- **PrintSync** — the brand Virtue Studio produces advertising for. Its rules live in
  `brand/printsync/` and are documented on the [Brand](Brand) page.
- `printsync-ads` — the npm package name of this monorepo and the scope of its packages
  (`@printsync/*`). The scope predates the Virtue Studio name.

See [Brand](Brand) for the brand, and [Roadmap & Status](Roadmap) for implementation status per area.
