# PrintSync Creative Engine

## Overview

The Creative Engine is the intelligence layer of the PrintSync Creative OS. It generates concepts, scores them, detects generic patterns, and ensures every piece of creative meets PrintSync's standards.

## Components

### Creative Director

The first intelligence layer. It:

1. Understands the business objective
2. Identifies the audience
3. Identifies the service
4. Identifies the emotional objective
5. Reviews recent PrintSync campaigns
6. Identifies overused visual patterns
7. Generates multiple concepts internally
8. Scores them
9. Rejects weak concepts
10. Develops the strongest concept

### Creative Judge

Scores every concept against 10 dimensions:

| Dimension | Description |
|-----------|-------------|
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

**Thresholds:**
- `< 70` → REJECT
- `70–79` → REWORK
- `80–89` → APPROVE
- `90–100` → SIGNATURE CONCEPT

### Anti-Generic Engine

Detects and prevents:

- Canva template aesthetics
- Shutterstock photography
- Generic AI corporate video
- Generic marketing agency output
- Generic printing company imagery
- Repetitive compositions

Checks for strong creative elements:
- Visual metaphors
- Unexpected transitions
- Unusual scale relationships
- Kinetic typography
- Graphic information systems
- Humour mechanisms
- VFX ideas
- Storytelling devices

### Story Grammar

Supports narrative structures:

1. **PROBLEM → TENSION → DISCOVERY → TRANSFORMATION → PROOF → BRAND**
2. **MYSTERY → CLUE → INVESTIGATION → REVEAL → PRODUCT → CTA**
3. **IDEA → DESIGN → MACHINE → MATERIAL → SCALE → IMPACT**
4. **CHAOS → PRECISION → CONTROL → RESULT**
5. **BORING → PRINTSYNC → TRANSFORMATION**
6. **DIGITAL → PHYSICAL → EXPERIENCE**

## Creative Modes

27 modes including:

- CINEMATIC_BRAND_FILM
- TYPOGRAPHIC_FILM
- PRODUCT_AD
- SERVICE_AD
- SOCIAL_POST
- SOCIAL_CAROUSEL
- POSTER
- MOTION_POSTER
- INFOGRAPHIC
- EDUCATIONAL_AD
- SALES_AD
- CORPORATE_AD
- HUMOR_AD
- DETECTIVE_AD
- STORY_AD
- TRANSFORMATION_AD
- BEFORE_AFTER
- CASE_STUDY
- TESTIMONIAL
- UGC
- VFX_EXPERIMENT
- 3D_PRODUCT_FILM
- TYPOGRAPHY_ONLY
- NO_VOICE_FILM
- VOICEOVER_FILM
- CAMPAIGN_FILM

## Voice Modes

- **VOICEOVER** — Narration carries the story
- **TYPOGRAPHY_ONLY** — Type is the narrator
- **MUSIC_ONLY** — Sound design carries everything
- **DIALOGUE** — Characters interact
- **HYBRID** — Voice + typography + sound design

## Usage

```typescript
import { CreativeDirector, CreativeJudge } from '@printsync/creative-engine';

// Generate concepts
const director = new CreativeDirector();
const concepts = director.generateConcepts(brief);

// Score concepts
const judge = new CreativeJudge();
const scored = judge.scoreConcepts(concepts);

// Select winner
const winner = scored[0];

// Develop treatment
const treatment = director.developConcept(winner);
```
