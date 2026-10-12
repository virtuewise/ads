# API Reference

Programmatic surface for each package. Types come from `@printsync/shared` (creative layer) and
`@printsync/common` (production layer). Prefer importing the engines over reading brand/creative
files directly.

## `@printsync/shared`

Central creative schemas and types. Types are re-exported from `src/schemas/index.ts`.

```typescript
import type {
  // creative
  CreativeMode, VoiceMode, NarrativeStructure, CreativeTerritory, Mood,
  VisualStyle, Pace, CreativeBrief, Concept, CreativeScore,
  CreativeScoreThresholds, AntiGenericCheck, StoryGrammar, StoryBeat,
  CreativeHistoryEntry,
  // brand
  Brand, BrandPersonality, BrandVoice, BrandAudience, BrandColors,
  // campaign / asset
  Campaign, CampaignStatus, CampaignOutput, CampaignHistory, DailyCampaignResult,
  Asset, AssetRegistry, AssetQuery, AssetMetadata, ShotInfo, TimeRange,
  // phase 2
  BrandContext, CreativeDNA, CreativeGenome, SimilarityResult,
  CreativeFatigueReport, CreativeOpportunity, DiversityAnalysis,
  ReworkResult, AntiGenericReport, JudgeVerdict, EnhancedCreativeBrief,
} from '@printsync/shared';

import { DEFAULT_THRESHOLDS, getScoreStatus } from '@printsync/shared';
```

`getScoreStatus(total, thresholds?)` maps a 0–100 score to
`REJECT | REWORK | APPROVE | SIGNATURE` using `DEFAULT_THRESHOLDS`; it is the single
place the score bands are evaluated.

The creative `CreativeBrief` (used by the CLI path):

```typescript
interface CreativeBrief {
  objective: string;
  service: string;
  audience: string;
  emotional_objective: string;
  platform: string[];
  formats: string[];
  voice_mode?: VoiceMode;
  creative_mode?: CreativeMode;
  territory?: CreativeTerritory;
  mood?: Mood;
  visual_style?: VisualStyle;
  pace?: Pace;
  constraints?: string[];
  reference_campaigns?: string[];
}
```

See [`Concept`, `CreativeScore`, `AntiGenericCheck`](Creative-System) definitions on the Creative
System page.

## `@printsync/common`

Production-layer schemas with Zod validation and a full `ProductionPlan` contract.

```typescript
import {
  CreativeBriefSchema, ScriptSchema, StoryboardSchema, ShotSchema,
  ProductionPlanSchema, validateProductionPlan,
} from '@printsync/common';
import type {
  CreativeBrief, Script, ScriptStep, StoryOutline, Storyboard, Shot,
  CameraSpec, AssetRequirement, TypographyPlan, MotionPlan, VFXPlan,
  AudioPlan, EditPlan, QAPlan, OutputSpec, VisualGrammar,
  SceneGraph, SceneNode, SceneEdge, ProductionPlan,
} from '@printsync/common';
```

> These `CreativeBrief`/`Script`/`ProductionPlan` types are **distinct** from the
> `@printsync/shared` creative types of similar names. See [Production Pipeline](Production-Pipeline).

## `@printsync/creative-engine`

```typescript
import {
  // V1
  CreativeDirector, CreativeJudge,
  CREATIVE_MODES, getCreativeMode, getAllCreativeModes,
  getModesByTerritory, getModesByMood,
  generateStoryGrammar, getAllStoryTemplates, getStructuresByComplexity,
  checkAntiGeneric, generateAntiGenericSuggestions,
  // V2
  analyzeAntiGeneric, judgeConceptV2, judgeConceptsV2, reworkConcept,
  analyzeDiversity, selectDiverseTop3, generateCreativeBrief,
  VISUAL_METAPHORS, getMetaphorsForService, getMetaphorsForTerritory, getRandomMetaphor,
  generateConceptSeeds, seedToConcept,
  runDailyCreativeEngine,
  // inlined campaign functions
  generateCreativeGenome, calculateCreativeSimilarity,
  detectCreativeFatigue, identifyCreativeOpportunities,
} from '@printsync/creative-engine';
import type { DailyCreativeReport } from '@printsync/creative-engine';
```

Typical flow:

```typescript
const director = new CreativeDirector();
const concepts = director.generateConcepts(brief);

const judge = new CreativeJudge();
const scored = judge.scoreConcepts(concepts);

const evaluation = judge.evaluateConcept(concept);
const check = checkAntiGeneric(concept, history);
const grammar = generateStoryGrammar('IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT');

// Daily V2
const report = await runDailyCreativeEngine(history, services, 'AWARENESS');
```

## `@printsync/brand-engine`

Authoritative interface to the PrintSync brand files. Everything flows through here.

```typescript
import { BrandEngine } from '@printsync/brand-engine';
import type { BrandEngineConfig } from '@printsync/brand-engine';

const engine = new BrandEngine({
  brandPath: 'brand/printsync',
  historyPath: 'brand/printsync/campaign-history.json',
  autoSave: true,
});

const context = await engine.load();          // → BrandContext (cached)
const services = engine.getServices();        // ServiceDefinition[]
const bytes = engine.getCreativeContext();    // same as load()
const service = engine.getServiceById('large-format-printing');
engine.invalidateCache();                     // for tests
```

Available getters: `getBrandIdentity`, `getBrandPersonality`, `getBrandVoice`, `getCreativeDNA`,
`getVisualSystem`, `getTypographySystem`, `getColorSystem`, `getMotionLanguage`, `getServices`,
`getMessaging`, `getForbiddenStyles`, `getLogoRules`, `getServiceById`, `getServicesByCategory`,
`getCreativeContext`.

> The older `docs/API.md` shows `engine.loadBrand()` / `engine.loadHistory()`. Current code exposes
> `load()` (returns `BrandContext`) and the getters above.

## `@printsync/campaign-engine`

Active campaign intelligence (history is not a passive JSON file).

```typescript
import {
  InMemoryCampaignRepository,
  generateCreativeGenome, calculateCreativeSimilarity, areTooSimilar,
  calculateAverageSimilarity, detectCreativeFatigue, getUnderusedDimensions,
  getOverusedDimensions, identifyCreativeOpportunities,
} from '@printsync/campaign-engine';
import type { CampaignRepository } from '@printsync/campaign-engine';
```

Several of these functions are also inlined into `@printsync/creative-engine`
(`campaign-functions.ts`).

## `@printsync/production-orchestrator`

```typescript
import { buildProductionPlan } from '@printsync/production-orchestrator';
import type { OrchestratorOptions } from '@printsync/production-orchestrator';

const plan = await buildProductionPlan(brief, { seed: 'abc', validate: true });
```

See [Production Pipeline](Production-Pipeline).

## Planning engines

Each exports a class (and a default):

| Package | Export |
|---|---|
| `@printsync/subject-engine` | `SubjectEngine.analyze(brief)`, `SubjectInfo` |
| `@printsync/story-engine` | `StoryEngine.planStory(subject)`, `StoryOutline` |
| `@printsync/visual-grammar-engine` | `selectVisualGrammar(brief)`, `ExplainerGrammar`, `CorporateGrammar`, `DetectiveGrammar`, `DataGeographicGrammar` |
| `@printsync/script-engine` | `ScriptEngine.generateScript(params)`, `SCRIPT_ENGINE_VERSION` |
| `@printsync/storyboard-engine` | `StoryboardEngine.generateStoryboard(script)`, `STORYBOARD_ENGINE_VERSION` |
| `@printsync/shot-engine` | `ShotEngine.planShots(params)` |
| `@printsync/scene-graph-engine` | `SceneGraphEngine.buildGraph(shots)` |

## `@printsync/cli`

Invoked as `printsync` (compiled) or through the root scripts. See [CLI Reference](CLI-Reference).
