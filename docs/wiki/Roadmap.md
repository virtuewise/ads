# Roadmap & Status

This page is the honest status of the repository — what is working, what is scaffolding, and what is
still planned. It maps the phases from `README.md` to the current code.

**Legend:** ✅ done · 🟡 partial / implemented but placeholder · ⬜ not started

## Phase 1 — Foundation ✅

- [x] Repository setup
- [x] Monorepo (pnpm workspaces + Turborepo)
- [x] TypeScript configuration (project refs, strict base config)
- [x] PrintSync brand schema (`brand/printsync/*`)
- [x] Service definitions
- [x] Campaign history schema
- [x] Asset registry schema
- [x] Creative scoring schema
- [x] Creative mode registry
- [x] Configuration system
- [x] CLI tool
- [x] Documentation (`docs/`, this wiki)

## Phase 2 — Creative Engine ✅ (substantially implemented)

- [x] Concept generation (`CreativeDirector`, seed matrix, metaphors)
- [x] Creative modes (26 registered)
- [x] Campaign system (`campaign-engine`: repository, genome, similarity, fatigue, opportunity)
- [x] Creative scoring (10 dimensions; `CreativeJudge` + `judge-v2`)
- [x] Anti-generic system (`checkAntiGeneric`, `analyzeAntiGeneric`, suggestions)
- [x] Creative history (`CreativeHistoryEntry`, daily memory save)
- [x] Diversity analysis + rework + brief generation
- [x] Score thresholds unified: `DEFAULT_THRESHOLDS` + `getScoreStatus` in `@printsync/shared` are
      the single source of truth, and both judges resolve status through them. See
      [Creative System](Creative-System#score-thresholds).

## Phase 3 — Design Engine / Production planning 🟡

The deterministic planning pipeline is wired and validated, but most stages return placeholder data.

- [x] Orchestrator (`buildProductionPlan`) with Zod validation
- [x] Production schemas (`@printsync/common`)
- [x] Subject, story, visual-grammar, script, storyboard, shot, scene-graph engines (deterministic)
- [ ] Motion poster generation — animated master, still keyframes exported for print
- [ ] Animated social / story formats
- [ ] Motion typography execution (kinetic type)
- [ ] Motion infographics — animated data storytelling
- [ ] Motion brand layouts
- [ ] Motion logo system

> **Motion-First:** Phase 3 is motion design, not static design. Posters, social formats,
> typography, infographics, brand layouts, and the logo system are all produced as animated/motion
> pieces; still frames (`image-engine`) are only exported where a physical deliverable requires them.

See [Production Pipeline](Production-Pipeline) for the exact stage-by-stage state.

## Phase 4 — Motion Engine ⬜ / 🟡

- [ ] Remotion integration into the production pipeline (the renderer app exists separately)
- [ ] Motion primitives
- [ ] Kinetic typography execution
- [ ] Print objects
- [ ] Technical graphics
- [ ] Transitions
- [ ] VFX

`packages/motion-engine` and `packages/typography-engine` exist as single-file, minimal packages.

## Phase 5 — Video Engine ⬜ / 🟡

- [ ] Footage analysis
- [ ] AI video shots
- [ ] Editing
- [ ] Sound design
- [ ] Voiceover
- [ ] Music

`packages/video-engine`, `image-engine`, `audio-engine`, `asset-engine`, `export-engine`,
`infographic-engine` exist as minimal packages.

## Phase 6 — QA Engine ⬜ / 🟡

- [ ] Brand QA
- [ ] Typography QA
- [ ] Logo QA
- [ ] Content QA
- [ ] Resolution QA
- [ ] Creative scoring in QA
- [ ] Genericity detection in QA

`packages/qa-engine` is minimal; creative scoring/genericity currently live in `creative-engine`.

## Phase 7 — Daily Engine 🟡

- [x] Daily creative run (`ads:daily`, `runDailyCreativeEngine`)
- [x] Creative rotation (weekday mode schedule)
- [x] Creative fatigue & campaign memory (in-memory today)
- [ ] Automatic derivatives
- [ ] Archive
- [ ] Full day-to-production loop

## Phase 8 — Studio ⬜ / 🟡

- [x] App scaffolds: `apps/studio` (Next.js creative dashboard), `apps/dashboard` (analytics),
      `apps/renderer` (Remotion)
- [ ] Campaign management UI
- [ ] Asset browser
- [ ] Render queue
- [ ] Analytics

## Testing

Vitest is configured at the root (`vitest.config.ts`, `include: packages/**/*.test.ts`) with tests
across shared, creative-engine (v1 + v2), campaign-engine, brand-engine, qa-engine, the planning
engines, and the production orchestrator.

```bash
pnpm test
```

## Priorities to reach a full end-to-end pipeline

1. Replace placeholder engines (subject, story, script) with real logic.
2. Populate the empty `ProductionPlan` sections (assets, typography, motion, vfx, audio, edit, qa,
   output) and transition `productionStatus` to `COMPLETE`.
3. Wire `creative-engine` selection into `production-orchestrator` (two brief types must be bridged).
4. Implement the Motion and QA engines, then real export.
