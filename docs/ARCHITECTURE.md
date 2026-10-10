# PrintSync Creative OS — Architecture

## System Overview

The PrintSync Creative Operating System is a modular, brand-aware advertising engine built on a monorepo architecture. It separates concerns into independent engines that can evolve independently.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRINTSYNC CREATIVE OS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   CREATIVE   │    │   CREATIVE   │    │  CAMPAIGN    │      │
│  │   DIRECTOR   │───→│    JUDGE     │───→│   ENGINE     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │                │
│         ↓                   ↓                   ↓                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │    STORY     │    │  ANTI-       │    │   CREATIVE   │      │
│  │   GRAMMAR    │    │  GENERIC     │    │   HISTORY    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │    MOTION    │    │    VIDEO     │    │    IMAGE     │      │
│  │   ENGINE     │    │   ENGINE     │    │   ENGINE     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │                │
│         ↓                   ↓                   ↓                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  TYPOGRAPHY  │    │   ASSET      │    │    AUDIO     │      │
│  │   ENGINE     │    │   ENGINE     │    │   ENGINE     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │     QA       │    │   EXPORT     │    │   DELIVERY   │      │
│  │   ENGINE     │    │   ENGINE     │    │   ENGINE     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                     @printsync/shared                            │
│              (Types, Schemas, Utilities)                         │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
CREATIVE BRIEF
      ↓
CREATIVE DIRECTOR (generates 10 concepts)
      ↓
CREATIVE JUDGE (scores all concepts)
      ↓
SELECTED CONCEPT (top 3)
      ↓
SCRIPT / TREATMENT
      ↓
STORYBOARD
      ↓
ART DIRECTION
      ↓
ASSET PLAN
      ↓
PRODUCTION (Motion + Video + Image engines)
      ↓
EDIT
      ↓
SOUND DESIGN
      ↓
BRAND QA → CREATIVE QA → MARKETING QA
      ↓
EXPORT (multi-format)
      ↓
ARCHIVE + ANALYTICS
      ↓
LEARNING (feeds back into Creative History)
```

## Module Responsibilities

### Creative Director
- Understands business objectives
- Identifies audience and service
- Reviews recent campaigns
- Generates multiple concepts
- Selects strongest concepts

### Creative Judge
- Scores concepts against 10 dimensions
- Rejects weak concepts
- Approves only the strongest
- Fights mediocrity

### Anti-Generic Engine
- Detects generic patterns
- Prevents repetition
- Suggests creative devices
- Enforces brand standards

### Story Grammar
- Defines narrative structures
- Generates story beats
- Supports multiple narrative arcs

### Campaign Engine
- Manages campaign families
- Tracks creative DNA
- Prevents repetition
- Archives outputs

### Motion Engine
- Kinetic typography
- Print objects
- Technical graphics
- Transitions and VFX

### Video Engine
- Footage analysis
- AI video shots
- Editing and composition
- Sound design

### QA Engine
- Brand consistency
- Typography accuracy
- Logo accuracy
- Creative quality
- Genericity detection

## Design Principles

1. **Separation of concerns** — Each engine has a single responsibility
2. **Deterministic rendering** — Code controls composition, not AI
3. **Brand-first** — Every decision starts with brand fit
4. **Anti-generic** — Active detection and prevention of generic output
5. **Creative variation** — Controlled randomness prevents repetition
6. **Modular evolution** — Engines can be improved independently
7. **Type safety** — TypeScript across the entire system
8. **Testability** — Every engine is testable in isolation
