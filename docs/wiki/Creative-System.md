# Creative System

The creative intelligence layer lives in `@printsync/creative-engine` and is driven by the CLI
(`ads:create`, `ads:daily`). It generates concepts, scores them, detects generic patterns, and
selects a winner.

## Components

### Creative Director
The first intelligence layer. It understands the objective, audience, service, and emotional
objective; reviews recent campaigns and overused patterns; generates multiple concepts; scores them;
rejects weak ones; and develops the strongest concept into a treatment.

### Creative Judge
Scores every concept against 10 equally weighted dimensions (10% each):

| Dimension | Question |
|---|---|
| Brand Fit | Does it feel like PrintSync? |
| Originality | Is it fresh and unexpected? |
| Commercial Value | Does it sell? |
| Visual Potential | Can it look stunning? |
| Emotional Impact | Does it make people feel? |
| Memorability | Will people remember it? |
| Social Stop Power | Will it stop the scroll? |
| Production Quality | Can it be produced well? |
| Service Relevance | Does it connect to the service? |
| Non-Generic Quality | Is it distinctly non-generic? |

### Anti-Generic Engine
Detects and prevents Canva template aesthetics, Shutterstock photography, generic AI corporate video,
generic marketing agency output, generic printing-company imagery, and repetitive compositions. It
checks for strong devices: visual metaphors, unexpected transitions, unusual scale relationships,
kinetic typography, graphic information systems, humour mechanisms, VFX ideas, storytelling devices.

The `AntiGenericCheck` type records boolean flags for patterns and devices plus `passed` and
`issues`. `analyzeAntiGeneric` (V2) and `checkAntiGeneric` (V1) produce these checks;
`generateAntiGenericSuggestions` proposes fixes.

### Story Grammar
Supported narrative structures (`NarrativeStructure`):

1. `PROBLEM_TENSION_DISCOVERY_TRANSFORMATION_PROOF_BRAND`
2. `MYSTERY_CLUE_INVESTIGATION_REVEAL_PRODUCT_CTA`
3. `IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT`
4. `CHAOS_PRECISION_CONTROL_RESULT`
5. `BORING_PRINTSYNC_TRANSFORMATION`
6. `DIGITAL_PHYSICAL_EXPERIENCE`

`generateStoryGrammar(...)` expands a structure into timed `StoryBeat`s; `getAllStoryTemplates()` and
`getStructuresByComplexity()` query the catalogue.

## Score thresholds

The scoring rubric is defined once in `@printsync/shared`
(`packages/shared/src/schemas/creative.ts`) and applied everywhere through
`getScoreStatus(total, thresholds)`:

| Score | Status |
|---|---|
| < 70 | REJECT |
| 70–79 | REWORK |
| 80–89 | APPROVE |
| 90–100 | SIGNATURE |

```typescript
// packages/shared/src/schemas/creative.ts
export const DEFAULT_THRESHOLDS: CreativeScoreThresholds = {
  reject: 70,
  rework: 70,
  approve: 80,
  signature: 90,
};

export function getScoreStatus(total, thresholds = DEFAULT_THRESHOLDS) {
  if (total >= thresholds.signature) return 'SIGNATURE';
  if (total >= thresholds.approve) return 'APPROVE';
  if (total >= thresholds.rework) return 'REWORK';
  return 'REJECT';
}
```

These bands are the **single source of truth**. Both judges resolve status through
`getScoreStatus`, so V1 and V2 can no longer drift:

- `CreativeJudge` (V1) calls `getScoreStatus(total, this.thresholds)`.
- `judgeConceptV2` (V2) reads the same `DEFAULT_THRESHOLDS` values, then applies its
  extra hard gates (and the competitor test for SIGNATURE) on top.
- `reworkConcept` uses `DEFAULT_THRESHOLDS.rework` for its rejection check.

`reject` equals `rework` (70) because the bands are contiguous — it is the exclusive
upper bound of the REJECT band and is kept explicit for readability. To change the
rubric, edit `DEFAULT_THRESHOLDS` only; do not reintroduce literal thresholds in the
judges.

## Creative modes

The registry `CREATIVE_MODES` in `packages/creative-engine/src/modes.ts` defines **26 modes**
(the docs historically said 27). Each entry specifies a default voice mode, mood, visual style,
pace, territories, typical duration, formats, and capability flags (`requires_voice`,
`requires_footage`, `requires_3d`, `requires_vfx`).

**Every mode is motion-first.** Even the modes that historically read as "static" — `SOCIAL_POST`,
`SOCIAL_CAROUSEL`, `POSTER`, `INFOGRAPHIC` — are motion-designed: they carry a non-zero
`typical_duration_seconds` for their animated master, and still keyframes are only exported where
a print/physical deliverable requires them.

The 26 modes: `CINEMATIC_BRAND_FILM`, `TYPOGRAPHIC_FILM`, `PRODUCT_AD`, `SERVICE_AD`, `SOCIAL_POST`,
`SOCIAL_CAROUSEL`, `POSTER`, `MOTION_POSTER`, `INFOGRAPHIC`, `EDUCATIONAL_AD`, `SALES_AD`,
`CORPORATE_AD`, `HUMOR_AD`, `DETECTIVE_AD`, `STORY_AD`, `TRANSFORMATION_AD`, `BEFORE_AFTER`,
`CASE_STUDY`, `TESTIMONIAL`, `UGC`, `VFX_EXPERIMENT`, `3D_PRODUCT_FILM`, `TYPOGRAPHY_ONLY`,
`NO_VOICE_FILM`, `VOICEOVER_FILM`, `CAMPAIGN_FILM`.

Query helpers: `getCreativeMode`, `getAllCreativeModes`, `getModesByTerritory`, `getModesByMood`.

## Voice modes

- **VOICEOVER** — narration carries the story
- **TYPOGRAPHY_ONLY** — type is the narrator
- **MUSIC_ONLY** — sound design carries everything
- **DIALOGUE** — characters interact
- **HYBRID** — voice + typography + sound design

## Territories, moods, styles, pace

- **Territories:** PRECISION, TRANSFORMATION, SCALE, HUMAN_IMPACT, PLAY
- **Moods:** cinematic, playful, technical, minimal, dramatic
- **Visual styles:** typography, product, vfx, live_action, mixed
- **Pace:** slow_premium, fast_energetic, rhythmic

## The daily engine (V2)

`ads:daily` calls `runDailyCreativeEngine(history, services, objective)` and returns a
`DailyCreativeReport`. The pipeline:

1. Load brand memory
2. Load recent campaign history
3. Calculate creative fatigue
4. Identify creative opportunities
5. Build a concept seed matrix
6. Generate diverse concepts
7. Anti-generic analysis
8. Creative judge
9. Diversity analysis (`analyzeDiversity`, `selectDiverseTop3`)
10. Select top 3
11. Rework if necessary (`reworkConcept`)
12. Select winner
13. Create creative brief (`generateCreativeBrief`)
14. Save campaign memory

A weekday rotation picks the mode (see [CLI Reference](CLI-Reference)).

## Supporting data

- **Visual metaphors** — `VISUAL_METAPHORS`, `getMetaphorsForService`, `getMetaphorsForTerritory`,
  `getRandomMetaphor`
- **Seeds** — `generateConceptSeeds`, `seedToConcept`
- **Campaign intelligence** — `generateCreativeGenome`, `calculateCreativeSimilarity`,
  `detectCreativeFatigue`, `identifyCreativeOpportunities`

See [API Reference](API-Reference) for imports and [Production Pipeline](Production-Pipeline) for how
the creative layer connects to deterministic production planning.
