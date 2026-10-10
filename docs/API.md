# PrintSync Creative OS — API Reference

## Packages

### @printsync/shared

Central schemas and types.

```typescript
import type {
  CreativeBrief,
  Concept,
  CreativeScore,
  Campaign,
  Asset,
} from '@printsync/shared';
```

### @printsync/creative-engine

Core creative intelligence.

```typescript
import { CreativeDirector, CreativeJudge } from '@printsync/creative-engine';

// Generate concepts
const director = new CreativeDirector();
const concepts = director.generateConcepts(brief);

// Score concepts
const judge = new CreativeJudge();
const scored = judge.scoreConcepts(concepts);

// Evaluate concept
const evaluation = judge.evaluateConcept(concept);

// Anti-generic check
const check = checkAntiGeneric(concept, history);

// Story grammar
const grammar = generateStoryGrammar('IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT');
```

### @printsync/brand-engine

Brand brain and memory.

```typescript
import { BrandEngine } from '@printsync/brand-engine';

const engine = new BrandEngine({
  brandPath: 'brand/printsync',
  historyPath: 'brand/printsync/campaign-history.json',
  autoSave: true,
});

const brand = await engine.loadBrand();
const history = await engine.loadHistory();
```

### @printsync/campaign-engine

Campaign management.

```typescript
import { CampaignEngine } from '@printsync/campaign-engine';

const engine = new CampaignEngine({
  historyPath: 'brand/printsync/campaign-history.json',
  campaignsPath: 'campaigns',
  autoArchive: true,
});

const campaign = await engine.createCampaign('Print Has Power', 'branding');
```

### @printsync/cli

Command-line interface.

```bash
pnpm ads:create --service "large-format-printing"
pnpm ads:daily
pnpm campaign:create --name "Print Has Power"
pnpm film:create --duration 30
pnpm poster:create --size A2
pnpm social:create --platform instagram
pnpm creative:judge
```

## Creative Modes

```typescript
import { CREATIVE_MODES, getCreativeMode } from '@printsync/creative-engine';

// Get all modes
const allModes = Object.values(CREATIVE_MODES);

// Get specific mode
const mode = getCreativeMode('CINEMATIC_BRAND_FILM');
```

## Story Grammar

```typescript
import { generateStoryGrammar, getAllStoryTemplates } from '@printsync/creative-engine';

// Generate story beats
const grammar = generateStoryGrammar('MYSTERY_CLUE_INVESTIGATION_REVEAL_PRODUCT_CTA');

// Get all templates
const templates = getAllStoryTemplates();
```

## Anti-Generic Engine

```typescript
import { checkAntiGeneric, generateAntiGenericSuggestions } from '@printsync/creative-engine';

// Check concept
const check = checkAntiGeneric(concept, history);

// Get suggestions
const suggestions = generateAntiGenericSuggestions(check);
```
