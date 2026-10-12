# Contributing

## Development setup

```bash
git clone https://github.com/virtuewise/ads.git
cd ads
pnpm install
pnpm build
pnpm test
```

See [Getting Started](Getting-Started) for requirements and troubleshooting.

## Project structure

- `apps/` — Applications (studio, renderer, dashboard, demo)
- `packages/` — Shared libraries and engines
- `brand/` — Brand brain and creative DNA
- `campaigns/` — Campaign outputs
- `creative/` — Concepts, scripts, storyboards
- `assets/` — Logos, footage, images, audio, fonts
- `docs/` — Documentation (this wiki is in `docs/wiki`)

Full map: [Repository Structure](Repository-Structure).

## Code style

- TypeScript strict mode
- ES modules (note the `.js` extensions in relative imports)
- Functional programming patterns
- Comprehensive JSDoc comments
- Test-driven development (Vitest)

## Commits

Conventional-commit prefixes:

```
feat: add new creative mode
fix: correct brand color value
docs: update API reference
test: add creative judge tests
refactor: simplify story grammar
```

## Pull requests

1. Create a feature branch
2. Make your changes
3. Add tests
4. Update documentation (including this wiki when relevant)
5. Submit the PR with a clear description

## Adding an engine

The production pipeline follows a consistent shape. To add a stage:

1. Create `packages/<name>-engine` with `package.json` (`@printsync/<name>-engine`), `tsconfig.json`,
   and `src/index.ts` exporting a class plus a default.
2. Depend on `@printsync/common` for shared production schemas (add a Zod schema/interface there if
   needed).
3. Wire it into `packages/production-orchestrator/src/index.ts` in the correct order.
4. Add a `*.test.ts` alongside the source.
5. Ensure `pnpm build` and `pnpm test` pass at the root (dependency order is handled by Turborepo).

## Turborepo note

Turborepo's configuration, task behavior, and CLI commands vary by version. Resolve the installed
version and read its bundled docs before changing `turbo.json`:

```bash
node -p "require.resolve('turbo/package.json')"
```

Read `docs/README.md` inside that installed package, then the relevant pages. Heed deprecation
notices.

## Creative standards

All creative output must:

1. Feel like PrintSync
2. Be non-generic
3. Have a strong visual idea
4. Be commercially viable
5. Pass creative-judge scoring

See [Brand](Brand) and [Creative System](Creative-System).
