# Rust Tooling Workspace for Virtue Studio

This workspace provides **optional** high-performance native tooling for the Virtue Studio
TypeScript monorepo:

- **xtask** — custom build tasks (schema generation, Biome runner, native builds)
- **core-native** — napi-rs native module for hot paths (hashing, camera math, audio analysis)
- **schemas** — Rust → Zod schema generation (optional; the hand-written Zod schemas in `packages/common/src` remain authoritative)

The Rust workspace is optional: the TypeScript monorepo builds, tests, and lints without it.
`@printsync/core-native` ships pure-TypeScript fallbacks and resolves the compiled native
addon at runtime, so native tooling is never a hard dependency.

Biome (linting & formatting) is a **Node tool**. It is pinned in the root `package.json`
(`@biomejs/biome`) and configured by the root `biome.json`; the Rust `xtask` shells out to
that same CLI. It is not installed from crates.io.

## Quick Start

```bash
# Install Rust toolchain (once)
rustup toolchain install stable --component rustfmt clippy

# Install cargo tools
cargo install cargo-nextest cargo-make typos-cli

# Install git hooks (optional; uses the npm `lefthook` binary)
pnpm exec lefthook install

# Build everything (native module + TypeScript)
cargo make build

# Run linters (Biome; alias for `biome-check`)
cargo make lint

# Run Rust tests
cargo nextest run

# Generate Zod schemas from the Rust types
cargo make generate-schemas
```

## Workspace Structure

```
rust/
├── Cargo.toml              # Workspace root
├── .config/
│   └── nextest.toml        # cargo-nextest profiles (used by `cargo make test-rust`)
├── xtask/                  # Custom build tasks
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── biome.rs        # Runs the Biome CLI (embeds the root biome.json)
│       ├── native_build.rs # Builds @printsync/core-native via Cargo
│       └── schema_gen.rs
├── core-native/            # napi-rs native module (TypeScript fallbacks live in the package)
│   ├── Cargo.toml
│   └── src/
│       └── lib.rs
└── schemas/                # Rust → Zod schema generation
    ├── Cargo.toml
    └── src/
        ├── lib.rs
        ├── brief.rs        # CreativeBrief, SubjectInfo, etc.
        ├── production.rs   # ProductionPlan, shots, assets, etc.
        └── render.rs       # RenderInputs, CameraPath, etc.
```

The single Biome configuration lives at the repository root (`biome.json`).

## Integration with TypeScript Monorepo

| Task | Command |
|------|---------|
| Build TS | `pnpm build` (or `cargo make build-ts`) |
| Lint & format | `pnpm lint` / `pnpm format` (Biome 2) |
| Test | `pnpm test` (Vitest); `cargo make test-all` also runs the Rust tests |
| Schema sync | `cargo make generate-schemas` |
| Hot paths | `@printsync/core-native` (optional; TypeScript fallback built in) |

## CI Integration

Continuous integration lives in `.github/workflows/ci.yml`:

- `rust-toolchain` installs the Rust toolchain plus cargo-make / cargo-nextest / typos-cli,
  installs the Node dependencies, and runs `cargo make ci`.
- `typescript` runs `pnpm build`, a renderer typecheck, and `pnpm test`.

## Native Module Usage (TypeScript)

`@printsync/core-native` exports a loader plus camelCase re-exports that always resolve —
native when the addon is compiled, the TypeScript fallback otherwise:

```ts
import { fnv1a64, mulberry32, loadNativeModule } from '@printsync/core-native';

const native = await loadNativeModule(); // native bindings when available
const hash = fnv1a64('printsync');       // works with or without the native addon
```

The motion engine keeps its own deterministic `hashSeed` helper
(`packages/motion-engine/src/hash.ts`) rather than importing the native hash directly.

## Version Policy

- **Rust**: stable channel (`rustup update`)
- **Biome**: Node CLI pinned in the root `package.json` (`@biomejs/biome`), configured by
  `biome.json`; the `xtask` runs that CLI
- **napi-rs**: tracks Node.js LTS
