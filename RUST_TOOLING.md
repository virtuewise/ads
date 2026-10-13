# Rust Tooling Workspace for Virtue Studio

This workspace provides high-performance native tooling for the TypeScript monorepo:
- **biome** — linting & formatting (replaces ESLint + Prettier)
- **xtask** — custom build tasks (schema generation, renderer bundling, native builds)
- **core-native** — napi-rs native module for hot paths (hash, camera math, audio analysis)
- **schemas** — Rust → Zod schema generation (single source of truth)

## Quick Start

```bash
# Install Rust toolchain (once)
rustup toolchain install stable --component rustfmt clippy
rustup component add rustfmt clippy

# Install cargo tools
cargo install cargo-nextest cargo-make lefthook typos-cli

# Build everything
cargo make build

# Run linting
cargo make lint

# Run tests
cargo nextest run

# Generate Zod schemas from Rust types
cargo make generate-schemas
```

## Workspace Structure

```
rust/
├── Cargo.toml              # Workspace root
├── xtask/                  # Custom build tasks
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── biome.rs
│       ├── schema_gen.rs
│       └── native_build.rs
├── core-native/            # napi-rs native module
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── hash.rs         # FNV-1a
│       ├── camera.rs       # frameDistance, boulevardPose, etc.
│       ├── audio.rs        # analyzeFrequencyBands
│       └── city.rs         # city layout helpers
├── schemas/                # Rust → Zod schema generation
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── brief.rs        # CreativeBrief, SubjectInfo, etc.
│       ├── production.rs   # ProductionPlan, shots, assets, etc.
│       └── render.rs       # RenderInputs, CameraPath, etc.
└── biome.json              # Biome config (lint + format)
```

## Integration with TypeScript Monorepo

| Task | Before | After |
|------|--------|-------|
| `pnpm build` | `tsc` | `cargo make build-ts` (parallel) |
| `pnpm lint` | `eslint` + `prettier` | `cargo make biome-check` |
| `pnpm test` | `vitest` | `cargo nextest run` + `vitest` |
| Schema sync | Manual | `cargo make generate-schemas` |
| Hot paths | Pure TS | `@printsync/core-native` (optional) |

## CI Integration

```yaml
# .github/workflows/rust.yml
jobs:
  rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
      - run: cargo make ci
```

## Native Module Usage (TypeScript)

```ts
// packages/motion-engine/src/hash.ts
import { fnv1a } from '@printsync/core-native';
// or fallback:
import { fnv1a as fnv1aTs } from './hash.fallback.ts';
export const fnv1a = typeof fnv1a === 'function' ? fnv1a : fnv1aTs;
```

## Version Policy

- **Rust**: Stable channel, updated monthly via `rustup update`
- **Biome**: Pinned in `Cargo.toml`, updated quarterly
- **napi-rs**: Track Node.js LTS (currently 20/22)
- **MSRV**: Rust 1.78 (matches Node.js 20+ support)