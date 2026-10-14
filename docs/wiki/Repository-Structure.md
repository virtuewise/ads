# Repository Structure

```
ads/
├── apps/                     # Applications
│   ├── studio/               # Creative Studio dashboard (Next.js)
│   ├── renderer/             # Remotion renderer (React video compositions)
│   ├── dashboard/            # Analytics dashboard (Next.js)
│   └── demo/                 # CLI demo for the production pipeline (no package.json)
├── packages/                 # Engines and shared libraries (see Packages & Engines)
├── brand/
│   └── printsync/            # Brand brain: JSON + markdown sources of truth
├── campaigns/                # Campaign outputs (currently only .gitkeep)
├── creative/                 # Concepts, scripts, storyboards, treatments
│   ├── concepts/
│   ├── scripts/
│   ├── storyboards/
│   └── treatments/
├── assets/                   # Logos, footage, images, audio, fonts, references
├── compositions/             # Remotion compositions workspace (currently only .gitkeep)
├── renders/                  # Rendered outputs
├── exports/                  # Final exports
├── docs/                     # Documentation (this wiki lives in docs/wiki)
├── scripts/                  # Utility PowerShell scripts
├── tests/                    # Root test area
├── turbo.json                # Turborepo task pipeline
├── pnpm-workspace.yaml       # Workspace globs
├── vitest.config.ts          # Test runner config
├── tsconfig.base.json        # Shared TypeScript config
└── package.json              # Root scripts + tooling
```

## Applications

| App | Package | Stack | Role |
|---|---|---|---|
| `apps/studio` | `@printsync/studio` | Next.js, React, `@printsync/*` engines | Creative Studio dashboard (concept/campaign UI) |
| `apps/renderer` | `@printsync/renderer` | Remotion, React, React Three Fiber, Three.js | Programmatic video compositions: the brand and signature films, the 3D product line, and the `PrintSyncLivingCity` film with its real HDRI skies (`apps/renderer/public/hdri/`) (see [Motion & Renderer](Motion-and-Renderer)) |
| `apps/dashboard` | `@printsync/dashboard` | Next.js, React, `@printsync/shared` | Analytics dashboard |
| `apps/demo` | *(none)* | Node + `@printsync/production-orchestrator` | Reads a brief JSON, prints a validated `ProductionPlan` |

## Brand brain

`brand/printsync/` is the machine-readable and human-readable brand source of truth for the PrintSync brand template. Virtue Studio supports multiple brands — PrintSync is the default/featured implementation:

| File | Contents |
|---|---|
| `brand.json` | Identity, tagline, personality, pillars, audience, competitors |
| `colors.json` | Brand colour system |
| `typography.json` | Font system |
| `messaging.json` | Core messages and voice |
| `services.json` | Service definitions |
| `campaign-history.json` | Campaign/creative history used for fatigue & repetition checks |
| `creative-dna.md` | Creative DNA |
| `forbidden-styles.md` | Explicit anti-patterns |
| `logo-rules.md` | Logo usage rules |
| `motion-language.md` | Motion principles |
| `photography.md` | Photography direction |
| `visual-system.md` | Visual system |
| `voice.md` | Voice guidance |

## Where outputs go

- **Concepts / scripts / storyboards / treatments** → `creative/*`
- **Campaigns** → `campaigns/`
- **Rendered video** → `renders/`
- **Final multi-format exports** → `exports/`

## Configuration

- `pnpm-workspace.yaml` — workspaces `apps/*`, `packages/*`
- `turbo.json` — `build` (depends on `^build`, cached outputs), `dev` (persistent, uncached),
  `test` (depends on `build`), `lint`
- `tsconfig.json` / `tsconfig.base.json` — project references and shared compiler options

See [Packages & Engines](Packages-and-Engines) for the `packages/` inventory.
