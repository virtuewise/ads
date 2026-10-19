# 19 — Quality, Testing & Verification

**Status: ✅ · Code: whole repo · Tooling: `pnpm test`, `biome`, `tsc`**

> The rule is simple: **a change is not done until the verify trio is green and the test suite passes.**
> This document defines what that means, how to run it, and what to add when you extend the system.

---

## The verify trio

Run these three for any change to `apps/electron`:

```bash
# 1. Build the app
pnpm --filter @printsync/electron build

# 2. Type-check (no emit)
cd apps/electron; npx tsc --noEmit

# 3. Lint + format check
pnpm exec biome check apps/electron
```

A fourth gate runs before push:

```bash
# 4. Full CI (all packages, all tests)
pnpm test
```

`pnpm test` runs `turbo run test` across the workspace and depends on `build`. On the reference box it is
**51/51 tasks successful**.

---

## What each gate catches

| Gate | Catches |
|---|---|
| `build` | Vite/TS bundling errors, missing imports, broken module graph |
| `tsc --noEmit` | Type errors across the whole app, including `strict` issues |
| `biome check` | Lint rules, formatting, accessibility, import order |
| `pnpm test` | Unit/integration regressions across all packages |

> `biome check` currently passes clean at **277 files**. `tsc --noEmit` is clean.

---

## Test strategy

Vitest is configured at the root (`vitest.config.ts`, `include: packages/**/*.test.ts`) with tests across
the engine monorepo — shared, creative-engine (v1 + v2), campaign-engine, brand-engine, qa-engine, the
planning engines, and the production orchestrator.

For the **editor** (`apps/electron`), the highest-value test targets are the **pure** modules — those with
no DOM, no Electron, and no GPU:

| Module | Why it is testable | Suggested coverage |
|---|---|---|
| `engine/compiler.ts` | Pure function: DAG → WGSL | topological order, cycle detection, unknown node types, code round-trip |
| `engine/project.ts` | Pure: `buildProject`, `normalizeProject`, slug helpers | default fill-in, enum coercion, malformed input tolerance, keyframe sorting |
| `main/projectCodec.ts` | Pure: no Electron import | JSON determinism (sorted keys), binary magic/version/checksum, format detection, BOM handling |
| `engine/timeline.ts` | Pure transforms | snapping thresholds, min-length clamping, keyframe dedupe/sort, easing sampling |
| `engine/visual.ts` | Pure: `hexToRgb`, `packUniforms` | hex parsing, uniform layout offsets, LUT-none neutrals |
| `engine/nodes.ts` | Pure per-node | each node's `execute` and `toWGSL` |
| `engine/genre-workflows.ts` | Pure data | every template references a valid LUT id; every preset has a valid easing |

The non-pure modules (WebGPU canvas, FFmpeg export, IPC) are verified by **integration/manual runs** and
the build gates, not unit tests.

---

## Verifying the codec (a worked example)

```bash
# JSON determinism: same doc → identical bytes regardless of key order
# Binary round-trip: serialize → parse → deep-equal
# Detection: VFXP magic wins over extension; .bin without magic → binary attempt
# Checksum: flip one payload byte → 'checksum mismatch'
```

These are the properties [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md) promises, so they should be pinned by
tests.

---

## Verifying the export path

The export pipeline was verified end-to-end on the reference box (FFmpeg 8.1.1 full build):

| Check | Result |
|---|---|
| Encoders present | `h264_nvenc`, `h264_qsv`, `h264_amf`, `libx264`, `prores_ks` |
| 1080p H.264 through the app's arg builder | **839 kB** MP4 produced |
| 4K ProRes 422 HQ through the app's arg builder | **4.1 MB** MOV produced |
| `probeEncoders()` preference | `h264_nvenc` > … > `libx264` |

See [07-EXPORT-PIPELINE](07-EXPORT-PIPELINE.md).

---

## Verifying the app launches

The Electron binary must report the **app's** Electron version, not the system Node. The harness injects
`ELECTRON_RUN_AS_NODE=1`, which breaks the launch. The working procedure is documented in full in
[20-OPERATIONS](20-OPERATIONS.md#the-electron-launch-gotcha).

A successful launch was confirmed by: `MainWindowTitle = "Virtue Studio"`, `Responding = True`.

---

## Acceptance criteria per feature

When you add or change a feature, it is complete only when:

| Feature kind | Acceptance |
|---|---|
| New node | `toWGSL` compiles; `execute` returns expected values; registered in `NODE_REGISTRY`; documented in [03](03-ENGINE-CORE.md) |
| New project field | Added to `ProjectDocument`, `buildProject`, `normalizeProject` (with default), documented in [05](05-PROJECT-FORMAT.md) |
| New genre template | `lut` is a real `BRAND_LUTS` id; easing is one of four; documented in [09](09-GENRE-SYSTEM.md) |
| New export preset | Arg builder documented in [07](07-EXPORT-PIPELINE.md); verified with a real encode |
| New IPC method | Preload method + `ipcMain.handle`; documented in [08](08-SCRIPTING-API.md) |
| New UI affordance | Wired to the engine (no dead controls); passes `biome` a11y rules; documented in [16](16-INTERFACE.md) |

---

## Biome landmines (checklist)

Reviewers and agents should watch for these recurring lint failures:

1. **Unused constants** — remove them; do not underscore-prefix.
2. **`noImportantStyles`** — never use `!important`.
3. **`lint/a11y/useSemanticElements`** — no `role=` on divs where a semantic element exists.
4. **`noLabelWithoutControl`** — read-only `<label className="field">` rows must be `<div>`.
5. **Per-line `// biome-ignore` in JSX** — gets flagged; use a **file-level** `// biome-ignore-all`.
   `App.tsx` already has two (`noStaticElementInteractions`, `useKeyWithClickEvents`).
6. **Nested `<button>`** — invalid HTML; use a `.row` container with `.rowbtn` + separate `.iconbtn`.
7. **CSS specificity** — `biome.json` disables `noDescendingSpecificity` for CSS; keep specificity sane
   anyway.

---

## Known warnings (not failures)

- Turbo prints a pre-existing `no output files found for task @printsync/electron#build` warning — **not
  an error**; the build succeeds.
- `Cargo.lock` is gitignored (expected).
- The PAT embedded in the git remote URL is flagged for rotation ([20-OPERATIONS](20-OPERATIONS.md)).

---

Related: [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md) · [07-EXPORT-PIPELINE](07-EXPORT-PIPELINE.md) ·
[16-INTERFACE](16-INTERFACE.md) · [20-OPERATIONS](20-OPERATIONS.md)
