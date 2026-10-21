# 20 — Setup, Running & Troubleshooting

**Status: ✅ · Applies to: the whole repo, especially `apps/electron`**

> Everything runs locally: no cloud, no account, no network dependency at runtime. This document covers
> install, dev, build, the launch gotchas unique to this Windows box, hardware expectations, and known
> warnings.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Node ≥ 20.9** | `package.json` engines |
| **pnpm ≥ 10** | package manager (`pnpm@12.11.2` pinned) |
| **A WebGPU-capable GPU + driver** | Chrome/Electron 113+ WebGPU. No adapter ⇒ the viewport and export fail gracefully |
| **FFmpeg on PATH** (or `FFMPEG_PATH`) | Required for export. A full build is needed for ProRes/`prores_ks` |
| **Windows / macOS / Linux** | Developed on Windows |

---

## Install

```bash
pnpm install
```

> **Pinning:** the workspace requires peer-clean installs. Keep dependencies at the pinned versions
> (Electron `^44.9.0`, Motion `^14.3.0`, Tailwind `^4.3.3` + `@tailwindcss/vite`, React `^19.3.0`,
> Vite `^8.3.4`, Zustand `^5.0.1`, `@monaco-editor/react` `^4.7.0`, `@webgpu/types` `^0.1.74`) — the
> peers check must stay clean.

---

## Run the editor

```bash
# Dev (Vite HMR + Electron)
pnpm electron:dev
# or
pnpm --filter @printsync/electron dev

# Build
pnpm electron:build
# or
pnpm --filter @printsync/electron build
```

When `ELECTRON_RENDERER_URL` is set the window loads the dev server; otherwise it loads the built
`apps/electron/src/renderer/index.html`.

### Opening a project directly

A project path on the command line is opened straight away — the desktop-app behaviour of
double-clicking a `.vfxproj`:

```bash
pnpm --filter @printsync/electron start -- C:/work/my-cut.vfxproj
```

The path is handed to the renderer through the preload bridge, and the project's `assets[]` are
re-imported from disk ([29-MEDIA-PIPELINE](29-MEDIA-PIPELINE.md)).

---

## The Electron launch gotcha

**This is the single most important operational detail on this machine.**

### Symptom

Launching Electron appears to fail:

```
SyntaxError: The requested module 'electron' does not provide an export named 'BrowserWindow'
```

and `electron.exe --version` prints the **system Node** version (e.g. `v24.22.0`) instead of the app's
Electron version.

### Cause

The harness injects `ELECTRON_RUN_AS_NODE=1` into **every fresh shell**. With it set, Electron runs as
plain Node — it never boots the browser process, so `electron` provides no `BrowserWindow`, and the ESM
main entry fails. It **cannot** be permanently cleared with `Remove-Item Env:` across shells, because each
new shell inherits the harness environment again.

### Working launch

Build a `System.Diagnostics.ProcessStartInfo`, point it at the Electron binary, **remove the variable from
the child's environment**, and start it:

```powershell
$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName  = "C:\...\node_modules\.pnpm\electron@44.9.0_supports-color@8.1.1\node_modules\electron\dist\electron.exe"
$psi.Arguments = '"C:\Users\Dell\Downloads\ads\apps\electron"'
$psi.UseShellExecute = $false
$psi.EnvironmentVariables.Remove('ELECTRON_RUN_AS_NODE')
$proc = [System.Diagnostics.Process]::Start($psi)
```

The Electron binary resolves at
`node_modules/.pnpm/electron@44.9.0_supports-color@8.1.1/node_modules/electron/dist/electron.exe`.

### Confirming success

Check the window title and responsiveness:

```
MainWindowTitle = "Virtue Studio"
Responding      = True
```

> **Warning about false negatives:** redirecting stderr and reading it while the child is starting can
> make a successful launch look like a failure (the reader sees the pipe close). Verify by window title,
> not by captured console output.

---

## FFmpeg resolution

The exporter looks for FFmpeg in this order ([07-EXPORT-PIPELINE](07-EXPORT-PIPELINE.md)):

1. `process.env.FFMPEG_PATH`
2. `<resourcesPath>/ffmpeg[.exe]`, `<resourcesPath>/bin/…`, `<resourcesPath>/resources/…`
3. `app.getAppPath()` equivalents
4. `process.cwd()` equivalents
5. **PATH** (`where ffmpeg` / `which ffmpeg`)

On this box FFmpeg is a winget "Links" shim:
`C:\Users\Dell\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe`.

To override explicitly:

```powershell
$env:FFMPEG_PATH = "C:\path\to\ffmpeg.exe"
```

An encoder report is always visible in the ExportPanel; if `ffmpegPath` is `null`, export is disabled.

---

## Hardware expectations

| Resolution / preset | Practical hardware | Notes |
|---|---|---|
| 1080p30 H.264 (`fast-1080p`) | Any modern GPU + FFmpeg | **Guaranteed.** Hardware encoder when present, `libx264` otherwise |
| 4K60 ProRes 422 HQ (`prores-4k`) | Strong CPU + NVMe SSD | Software `prores_ks`, CPU- and IO-heavy; the "heavy" preset |

### Resource management

- **VRAM** scales with *output resolution* — a 4K frame texture + staging buffer. One frame in flight at a
  time today.
- **System RAM** — one `Uint8Array` per frame (1080p ≈ 8 MB, 4K ≈ 33 MB); frames are **not** accumulated.
- **Disk** — the exporter throttles the renderer via queue backpressure so FFmpeg can keep up.

If the app or the machine struggles during a 4K export, prefer the 1080p preset first, then re-run ProRes
on an idle box. See [04-RENDERING](04-RENDERING.md#hardware--resource-management).

---

## Developer workflow

```bash
# Verify a change (the trio)
pnpm --filter @printsync/electron build
cd apps/electron; npx tsc --noEmit
pnpm exec biome check apps/electron

# Check docs references
pnpm docs:check

# Full CI before push
pnpm test
```

See [19-QUALITY-AND-TESTS](19-QUALITY-AND-TESTS.md) for what each gate covers.

---

## Windows / PowerShell quirks

- No `&&` chaining — run commands separately or use `;`.
- No `grep` / `awk` / `sed -n` — use `Select-String` / `FindStr`.
- Compound-extension dialog filters (`vfxproj.bin`) are unreliable — the project codec infers format from
  the explicit `format` argument and the path, never from the dialog filter.
  ([05-PROJECT-FORMAT](05-PROJECT-FORMAT.md))

---

## Known warnings (safe to ignore)

- Turbo: `no output files found for task @printsync/electron#build` — pre-existing, **not an error**.
- The PAT embedded in the git remote URL is **flagged for rotation** — rotate it and switch to SSH or a
  credential helper.
- `Cargo.lock` is gitignored — expected.

---

## Troubleshooting index

| Symptom | Likely cause | Fix |
|---|---|---|
| `does not provide an export named 'BrowserWindow'` | `ELECTRON_RUN_AS_NODE=1` | Use the `ProcessStartInfo` launch above |
| `electron.exe --version` shows Node's version | Same | Same |
| Panels stuck on "Loading engine data…" | Preload bridge not resolved | Ensure you run inside Electron (`window.studio` exists only there) |
| Export button disabled / `ffmpeg was not found` | FFmpeg not on PATH | Set `FFMPEG_PATH` |
| `WebGPU is unavailable, cannot render frames` | No adapter | Update GPU driver; check WebGPU support |
| UI entirely unstyled | `@import "tailwindcss"` missing from `styles.css` | Restore the import |
| 4K export crawls | Software ProRes on a loaded CPU | Use `fast-1080p`, or export ProRes on an idle box |
| Docs checker fails | A doc references a moved file | Update the path in the doc (see [docs/README](README.md#keeping-docs-honest)) |

---

Related: [07-EXPORT-PIPELINE](07-EXPORT-PIPELINE.md) · [19-QUALITY-AND-TESTS](19-QUALITY-AND-TESTS.md) ·
[04-RENDERING](04-RENDERING.md) · [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md)
