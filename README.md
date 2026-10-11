# Virtue Studio
[![pnpm](https://img.shields.io/badge/pnpm-7.33.7-brightgreen)](https://pnpm.io/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/) [![TurboRepo](https://img.shields.io/badge/TurboRepo-1.10.9-purple)](https://turborepo.org/)

> **Premium visual storytelling, motion graphics, and cinematic advertising solutions that transform ideas into compelling brand experiences.**

A persistent, brand‑aware advertising engine that can ideate, strategize, write, design, generate, animate, edit, critique, adapt, archive, and continuously improve Virtue Studio advertising.

---

## Core Principle

**Never treat the task as: PROMPT → AI OUTPUT → DONE**

Instead:

```
BUSINESS OBJECTIVE
→ CREATIVE STRATEGY
→ CONCEPTS
→ CREATIVE JUDGE
→ SELECTED CONCEPT
→ SCRIPT
→ STORYBOARD
→ ART DIRECTION
→ ASSET PLAN
→ PRODUCTION
→ EDIT
→ SOUND
→ BRAND QA
→ CREATIVE QA
→ MARKETING QA
→ EXPORT
→ ARCHIVE
→ LEARNING
```

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Generate today's advert
pnpm ads:daily

# Create a concept
pnpm ads:create --service "large-format-printing"

# Judge a concept
pnpm creative:judge

# Create a campaign
pnpm campaign:create --name "Print Has Power" --service "branding"

# Create a film
pnpm film:create --duration 30 --style cinematic

# Create a poster
pnpm poster:create --size A2 --title "BIG IDEAS"

# Create social content
pnpm social:create --platform instagram --format 1:1
```

---

## Repository Structure

```
ads/
├── apps/
│   ├── studio/          # Creative Studio dashboard
│   ├── renderer/        # Remotion renderer
│   └── dashboard/       # Analytics dashboard
├── packages/
│   ├── brand-engine/    # Brand brain and memory
│   ├── creative-engine/ # Concept generation, scoring, anti-generic
│   ├── campaign-engine/ # Campaign management
│   ├── script-engine/   # Script writing
│   ├── storyboard-engine/ # Storyboard generation
│   ├── motion-engine/   # Motion primitives and kinetic type
│   ├── video-engine/    # Video composition and editing
│   ├── image-engine/    # Image generation and design
│   ├── typography-engine/ # Kinetic typography
│   ├── infographic-engine/ # Data visualization
│   ├── asset-engine/    # Asset intelligence
│   ├── audio-engine/    # Sound design
│   ├── qa-engine/       # Quality assurance
│   ├── export-engine/   # Multi-format export
│   ├── cli/             # Command-line interface
│   └── shared/          # Shared schemas and types
├── brand/
│   └── printsync/       # PrintSync brand brain
├── campaigns/           # Campaign outputs
├── creative/            # Concepts, scripts, storyboards
├── assets/              # Logos, footage, images, audio, fonts
├── compositions/        # Remotion compositions
├── renders/             # Rendered outputs
├── exports/             # Final exports
├── docs/                # Documentation
├── scripts/             # Utility scripts
└── tests/               # Test suites
```

---

## The PrintSync Brand

### Personality
Precise. Creative. Intelligent. Modern. Reliable. Ambitious. Technically capable. Premium. Energetic. Persistent. Detail-oriented. Confiant.

### Core Message
**Your Vision. Our Precision.**

### Visual Principle
Ideas becoming physical impact.

### Motion Principle
Precision in motion.

### Creative Rule
**Never look generic.**

---

## Creative Modes

The system supports 27 creative modes including:

- Cinematic Brand Films
- Typographic Films
- Product/Service Adverts
- Social Posts & Carousels
- Posters & Motion Posters
- Infographics & Educational
- Humor & Detective Adverts
- Transformation & Before/After
- VFX Experiments & 3D Product Films
- Campaign Films & Brand Statements

---

## Creative Territories

1. **PRECISION** — Technical grids, measurement, data, machinery
2. **TRANSFORMATION** — Digital → physical, flat → dimensional
3. **SCALE** — Tiny → enormous, business card → building
4. **HUMAN IMPACT** — Businesses, customers, real-world applications
5. **PLAY** — Humour, surprise, unexpected scale, visual jokes

---

## Creative Judge

Every concept is scored against 10 dimensions:

| Dimension | Weight |
|-----------|--------|
| Brand Fit | 10% |
| Originality | 10% |
| Commercial Value | 10% |
| Visual Potential | 10% |
| Emotional Impact | 10% |
| Memorability | 10% |
| Social Stop Power | 10% |
| Production Quality | 10% |
| Service Relevance | 10% |
| Non-Generic Quality | 10% |

**Thresholds:**
- `< 70` → REJECT
- `70–79` → REWORK
- `80–89` → APPROVE
- `90–100` → SIGNATURE CONCEPT

---

## Development Phases

### Phase 1 — Foundation ✅
- [x] Repository setup
- [x] Monorepo (pnpm + Turborepo)
- [x] TypeScript configuration
- [x] PrintSync brand schema
- [x] Service definitions
- [x] Campaign history schema
- [x] Asset registry schema
- [x] Creative scoring schema
- [x] Creative mode registry
- [x] Configuration system
- [x] CLI tool
- [x] Documentation

### Phase 2 — Creative Engine
- [ ] Concept generation (enhanced)
- [ ] Creative modes (enhanced)
- [ ] Campaign system
- [ ] Creative scoring (enhanced)
- [ ] Anti-generic system (enhanced)
- [ ] Creative history

### Phase 3 — Design Engine
- [ ] Poster generation
- [ ] Social formats
- [ ] Typography engine
- [ ] Infographics
- [ ] Brand layouts
- [ ] Logo system

### Phase 4 — Motion Engine
- [ ] Remotion integration
- [ ] Motion primitives
- [ ] Kinetic typography
- [ ] Print objects
- [ ] Technical graphics
- [ ] Transitions
- [ ] VFX

### Phase 5 — Video Engine
- [ ] Footage analysis
- [ ] AI video shots
- [ ] Editing
- [ ] Sound design
- [ ] Voiceover
- [ ] Music

### Phase 6 — QA Engine
- [ ] Brand QA
- [ ] Typography QA
- [ ] Logo QA
- [ ] Content QA
- [ ] Resolution QA
- [ ] Creative scoring
- [ ] Genericity detection

### Phase 7 — Daily Engine
- [ ] Daily campaign
- [ ] Creative rotation
- [ ] Campaign memory
- [ ] Automatic derivatives
- [ ] Archive

### Phase 8 — Studio
- [ ] Creative Studio dashboard
- [ ] Campaign management
- [ ] Asset browser
- [ ] Render queue
- [ ] Analytics

---

## Technical Stack

- **TypeScript** — Type safety across the entire system
- **React** — UI and composition
- **Remotion** — Programmatic video
- **SVG** — Deterministic graphics
- **Motion/Framer Motion** — Motion primitives
- **Three.js** — 3D rendering
- **FFmpeg** — Video processing
- **Sharp** — Image processing
- **pnpm + Turborepo** — Monorepo management

---

## Engineering Principle

**AI generates ingredients. Code controls the composition. Deterministic rendering controls the final product.**

---

## License

Private — PrintSync Creative Operating System
