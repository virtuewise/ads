<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Virtue Studio — agent guide

Virtue Studio is two systems sharing one repo: the **engine monorepo** (`packages/*`, `apps/studio`,
`apps/renderer`, `apps/dashboard`) and the **editor app** (`apps/electron`, `@printsync/electron`).

**Read the documentation set in order before changing anything:**

- Start at [`docs/README.md`](docs/README.md) — the index, status legend, and reading paths per role.
- Operating the editor as an agent: [`docs/17-AI-AGENTS.md`](docs/17-AI-AGENTS.md).
- The editor engine: [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md) →
  [`docs/03-ENGINE-CORE.md`](docs/03-ENGINE-CORE.md) → [`docs/04-RENDERING.md`](docs/04-RENDERING.md).
- Project format (the shared contract) and scripting API:
  [`docs/05-PROJECT-FORMAT.md`](docs/05-PROJECT-FORMAT.md),
  [`docs/08-SCRIPTING-API.md`](docs/08-SCRIPTING-API.md).
- Genres: [`docs/09-GENRE-SYSTEM.md`](docs/09-GENRE-SYSTEM.md) plus the per-genre docs `10`–`15`.
- Quality gates and operations: [`docs/19-QUALITY-AND-TESTS.md`](docs/19-QUALITY-AND-TESTS.md),
  [`docs/20-OPERATIONS.md`](docs/20-OPERATIONS.md) (the Electron `ELECTRON_RUN_AS_NODE` launch gotcha).

**Verify before proposing a change** (see `docs/19-QUALITY-AND-TESTS.md`):

```
pnpm --filter @printsync/electron build
cd apps/electron; npx tsc --noEmit
pnpm exec biome check apps/electron
```

**Keep docs honest:** when you move or rename a file a doc references, update the doc in the same commit.
A doc is stale if it names a file that no longer exists.

**Never** expose `fs`/`child_process` to the renderer: add a preload method backed by an `ipcMain.handle`.
Keep codecs pure (no Electron import) so they stay unit-testable.
