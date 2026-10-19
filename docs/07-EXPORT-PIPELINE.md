# 07 — Export Pipeline: WebGPU → FFmpeg → SSD

**Status: ✅ · Code: `engine/export.ts`, `main/export.ts`, `main/ffmpeg.ts`, `components/ExportPanel.tsx`**

> Export is **entirely local**. The renderer renders each composition frame with WebGPU, hands the raw
> RGBA bytes to the main process, which streams them into the **system FFmpeg** as `rawvideo` and writes
> the encoded file to the SSD. No cloud, no native add-on — just the FFmpeg binary already on the box.

---

## Why system FFmpeg (not a native addon)

The design brief offered two options for the heavy 4K ProRes path: a **Node-API native addon** linked
against FFmpeg libraries, or relying on the **system FFmpeg** binary. This implementation chooses the
system binary, for concrete reasons:

- **No build toolchain** on the user's machine — no node-gyp, no MSVC, no prebuilt binary matrix.
- **Probe the real hardware** — we ask the installed FFmpeg which encoders exist (`nvenc`? `qsv`? `amf`?)
  and pick the best rather than guessing.
- **One dependency, already present.** FFmpeg is resolved from `FFMPEG_PATH`, the app resources, or PATH.
- **The pipe is already zero-ish-copy.** Frames go renderer → main as `Uint8Array` → FFmpeg stdin; the
  native path would share memory, but this avoids the whole addon lifecycle.

The trade-off — a process boundary rather than shared memory — is mitigated by **backpressure** (below).
The native shared-memory path remains a future optimisation ([21-ROADMAP](21-ROADMAP.md)).

---

## The two first-class targets

Defined in `engine/export.ts` as `EXPORT_TARGETS`:

| id | Name | Container | Size | fps | Bitrate | Role |
|---|---|---|---|---|---|---|
| `fast-1080p` | 1080p H.264 | `mp4` | 1920×1080 | 30 | 12 Mbps | Fast, review-ready, **guaranteed** on this hardware |
| `prores-4k` | 4K60 ProRes 422 HQ | `mov` | 3840×2160 | 60 | 220 Mbps | Heavy mezzanine master for further grading |

`heavy: true` flags the ProRes target so the UI can warn about time/size. `estimateBytes(target, seconds)`
and `formatBytes(bytes)` power the size estimate shown on the preset cards.

---

## FFmpeg resolution & probing — `main/ffmpeg.ts`

### Resolution order

1. `process.env.FFMPEG_PATH` if set.
2. Candidate paths under each root: `<root>/ffmpeg[.exe]`, `<root>/bin/…`, `<root>/resources/…`.
3. **PATH lookup** via `where ffmpeg` (Windows) / `which ffmpeg`.

Roots come from `ffmpegRoots()` in `main/export.ts`: `process.resourcesPath`, `app.getAppPath()`, and
`process.cwd()`, in that order.

### Encoder probing

`probeEncoders(roots)` runs `ffmpeg -hide_banner -encoders` and matches each name with the
`^\s*[A-Z.]{6}\s+<name>\s` pattern, then filters by preference order:

| Class | Preference order |
|---|---|
| H.264 | `h264_nvenc` → `h264_qsv` → `h264_amf` → `libx264` |
| HEVC | `hevc_nvenc` → `hevc_qsv` → `hevc_amf` → `libx265` |
| ProRes | `prores_ks` → `prores_aw` → `prores` |

- `preferred.h264` is the first available H.264 encoder; falls back to `libx264` if probing found none.
- `preferred.prores` falls back to `prores_ks`.
- The report (path, version, lists, preferred) is exposed to the UI as `window.studio.probeEncoders()`
  and shown in the ExportPanel.

> Verified on the development box (FFmpeg 8.1.1, full build): `h264_nvenc`, `h264_qsv`, `h264_amf`,
> `libx264`, `prores_ks` all present. See [19-QUALITY-AND-TESTS](19-QUALITY-AND-TESTS.md).

---

## The FFmpeg argument builders

`buildArgs(req, encoder)` in `main/export.ts`. Every call reads raw RGBA frames from `pipe:0`:

```text
-hide_banner -loglevel error
-f rawvideo -pix_fmt rgba -s <WxH> -r <fps> -i pipe:0 -an
```

### `fast-1080p` (H.264)

- Hardware encoder (`h264_nvenc`/`qsv`/`amf`):
  `-rc vbr -cq 21 -b:v <bitrate>k -preset p4`
- Software (`libx264`): `-preset veryfast -crf 18`
- Then `-pix_fmt yuv420p -movflags +faststart -y <output>`

`+faststart` moves the moov atom to the front so the file streams/plays immediately.

### `prores-4k` (ProRes 422 HQ)

```text
-c:v <prores encoder> -profile:v 3 -vendor apl0 -pix_fmt yuv422p10le -y <output>
```

`-profile:v 3` = ProRes 422 HQ, `-pix_fmt yuv422p10le` = 10-bit 4:2:2, `-vendor apl0` = Apple.

> Verified: a synthetic-frame run through these exact builders produced an **839 kB 1080p H.264 MP4** and
> a **4.1 MB ProRes 422 HQ MOV**.

---

## The renderer driver — `engine/export.ts`

`runExport(options)` orchestrates the whole job:

1. **Create the headless renderer** via `createFrameRenderer({width, height, lut})`. If WebGPU is
   unavailable it throws (`WebGPU is unavailable, cannot render frames`).
2. **Compute `totalFrames`** = `round(fps × duration)`.
3. **Emit `starting`**, then call `window.studio.startExport(...)`. The main process resolves/picks the
   encoder and spawns FFmpeg, returning `{ encoder }`.
4. **Loop frames:** for each `i`, check `shouldCancel()`, render at `time = i / fps`, call
   `writeExportFrame(bytes)`, increment, and emit `encoding` progress.
5. **Emit `finalizing`**, call `finishExport()` (closes FFmpeg stdin).
6. **Return** `{ ok, stage, outputPath, framesWritten }`.
7. **Always** `renderer.dispose()` in a `finally`.

`ExportProgressEvent` stages: `starting | encoding | finalizing | done | error | canceled`, each carrying
`framesWritten`, `totalFrames`, `percent`, and optional `message`/`outputPath`/`fps`.

---

## Backpressure — the critical detail

The renderer can render frames far faster than FFmpeg can encode + write them. Without throttling, the
frame queue would grow unbounded and exhaust RAM.

`main/export.ts` implements a **bounded queue with backpressure**:

- Frames arrive at `export:frame` and are pushed onto `job.queue` as `Buffer`s.
- `pump(job)` writes **one** buffer at a time to `stdin` and waits for the write callback before writing
  the next — so `stdin.write()`'s own high-water mark is respected.
- Additionally, if `job.queue.length > 8`, `export:frame` **awaits** until the queue drains back to ≤ 4
  before returning. This is the explicit handshake that stops the renderer from outrunning FFmpeg.
- `framesWritten` and computed `fps` are emitted on every write callback, so the UI shows real throughput.

Lifecycle safety: `child.on('error')` and `child.on('close')` both clear `active` and emit a terminal
event (`error` with the last 4 KB of stderr, `done`, or `canceled`). Only **one** job may run at a time
(`if (active) throw new Error('An export is already running')`).

---

## Cancel

`export:cancel` sets `job.canceled = true` and `child.kill('SIGKILL')`. The `close` handler sees
`canceled` and emits a `canceled` event instead of an error. The renderer's loop, seeing `shouldCancel()`,
stops and returns a `canceled` result.

---

## The ExportPanel

`components/ExportPanel.tsx` is the real UI:

- **Preset cards** — one per `EXPORT_TARGET`, showing name, container, resolution, bitrate, size
  estimate, and the "heavy" badge for ProRes.
- **Encoder report** — FFmpeg path + version, and the preferred H.264/ProRes encoders from
  `probeEncoders()`.
- **Run** — `chooseExportPath` (native save dialog) then `runExport`.
- **Progress** — a bar driven by `onExportProgress`, with frames, percent, and FPS.
- **Cancel** — wired to `cancelExport`.

---

## Failure modes & messages

| Failure | Where | Message |
|---|---|---|
| No FFmpeg found | `export:start` | `ffmpeg was not found. Set FFMPEG_PATH or add ffmpeg to PATH.` |
| WebGPU missing | `runExport` | `WebGPU is unavailable, cannot render frames` |
| Export already running | `export:start` | `An export is already running` |
| Spawn failure | `child.on('error')` | `Failed to launch ffmpeg: <message>` |
| Non-zero exit | `child.on('close')` | `ffmpeg exited with code <n>` + stderr tail |

---

## Guarantees & limits

**Guaranteed:** 1080p H.264 export on any box with FFmpeg and a WebGPU adapter — hardware encoder when
present, `libx264` otherwise.

**Hardware-dependent:** 4K60 ProRes. It is CPU/IO-heavy; `prores_ks` is software. NVENC/QSV/AMF speed up
H.264 but not ProRes.

**Not yet implemented:** audio muxing (all exports use `-an` — no audio track), per-clip multi-layer
compositing in the exported frames, and audio/video sync from the timeline. These are roadmap items —
see [25-AUDIO](25-AUDIO.md) for the audio design and [21-ROADMAP](21-ROADMAP.md) for sequencing; batch
and variant delivery is specified in [30-RENDER-QUEUE](30-RENDER-QUEUE.md).

---

Related: [04-RENDERING](04-RENDERING.md) · [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md) ·
[08-SCRIPTING-API](08-SCRIPTING-API.md) · [19-QUALITY-AND-TESTS](19-QUALITY-AND-TESTS.md)
