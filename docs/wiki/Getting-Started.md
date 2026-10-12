# Getting Started

## Requirements

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (the repo pins `pnpm@9.15.0` via `packageManager`)

The root `package.json` also declares `"engines"`, so an unsupported Node or pnpm version may be
rejected by tooling.

## Install

```bash
git clone https://github.com/virtuewise/ads.git
cd ads
pnpm install
```

## Build, test, lint

The monorepo is orchestrated by Turborepo. Root scripts fan out to every workspace:

```bash
pnpm build   # turbo run build (respects dependency order)
pnpm test    # turbo run test  (depends on build)
pnpm lint    # turbo run lint
pnpm dev     # turbo run dev   (persistent, uncached)
```

## Run something

The fastest path is the CLI, which is re-exported at the repo root:

```bash
pnpm ads:create --service "large-format-printing"
pnpm ads:daily
pnpm creative:judge
```

See the [CLI Reference](CLI-Reference) for every command and flag.

The deterministic planning pipeline is exercised through the `demo` app:

```bash
pnpm --filter @printsync/demo build
node apps/demo/dist/cli.js path/to/brief.json
```

It prints a validated `ProductionPlan` as JSON. See [Production Pipeline](Production-Pipeline).

## Workspace layout

Dispatch is configured in `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Turborepo pipeline is in `turbo.json` (`build`, `dev`, `test`, `lint`). Every workspace package is
named `@printsync/*`.

## Troubleshooting

- **`turbo` behaves unexpectedly** — configuration and CLI behavior differ between versions. Resolve
  the installed version (`node -p "require.resolve('turbo/package.json')"` from a workspace that
  depends on it) and read that package's bundled `docs/`.
- **A package fails to build** — build order matters. `pnpm build` at the root handles this; building
  a single leaf package in isolation may fail if its `workspace:*` dependencies have not been built.
- **Path separators** — the repo is developed on Windows and also used on Unix. Keep paths portable
  in scripts.

## Next steps

- [Architecture](Architecture) — how the pieces fit together
- [Repository Structure](Repository-Structure) — where things live
- [Packages & Engines](Packages-and-Engines) — what each package does
