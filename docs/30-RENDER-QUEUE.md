# 30 — Render Queue, Batch Delivery & Hardware

**Status: 🟡 (a single export job works; no queue, no batching) · Code: `engine/export.ts`, `main/export.ts`; target: `engine/render-queue.ts`, `main/batch.ts`**

> Today export is **one project, one file, one job at a time** (`if (active) throw new Error('An export is
> already running')` in `main/export.ts`). The File menu already promises "Add to Render Queue" with nothing
> behind it. This document specifies the production delivery system.

---

## What exists today

| Capability | State |
|---|---|
| Single export | ✅ two presets (1080p H.264, 4K ProRes), encoder probing, backpressure, progress, cancel ([07](07-EXPORT-PIPELINE.md)) |
| Audio | ⬜ `-an` — silent output ([25](25-AUDIO.md)) |
| Queue | ⬜ none |
| Batch / variants | ⬜ none |
| HDR / colour metadata | ⬜ none |
| GPU / parallel rendering | ⬜ sequential single-frame loop |

---

## 1. The render queue

A **job** is a saved, resumable render request — not a transient action.

```typescript
interface RenderJob {
  id: string;
  name: string;
  sourcePath: string;            // the .vfxproj
  outputPath: string;
  preset: ExportPresetId;        // 'fast-1080p' | 'prores-4k' | future presets
  overrides?: Partial<ExportTarget>;
  /** Deliverable variations to produce from the same render tree. */
  variants?: VariantSpec[];
  priority: number;
  status: 'queued' | 'rendering' | 'done' | 'error' | 'canceled' | 'paused';
  progress: { frames: number; total: number; fps: number; etaSeconds: number };
  error?: string;
  createdAt: string;
}
```

Queue behaviours:

- **Priority ordering**, drag to reorder.
- **Pause / resume** — pause stops submitting frames; resume continues from the frame index.
- **Retry** failed jobs with the same settings.
- **Persistence** — the queue survives app restart (jobs are saved, not held only in memory).
- **Concurrency policy** — default 1 job (VRAM-bound); allowed to raise once [31](31-AI-AGENTIC-SCALE.md)
  GPU budgeting lands.
- **Per-job diagnostics** — encoder used, mean fps, VRAM high-water mark, output size, warnings.

The File → **Add to Render Queue** menu item ([16](16-INTERFACE.md)) finally does something.

---

## 2. Batch & variant delivery

One render tree → many deliverables. This is where local rendering beats a cloud tool: no upload, so N
variants cost only time.

```typescript
interface VariantSpec {
  id: string;
  label: string;                 // 'IG Reels 9:16'
  width: number; height: number;
  fps: number;
  /** Reframe strategy for the ratio change (uses SmartCut reframe — [09](09-GENRE-SYSTEM.md)). */
  reframe: 'none' | 'subject-lock' | 'center-crop' | 'smooth-follow';
  /** Caption profile applied for this variant ([26](26-CAPTIONS.md)). */
  captionProfile?: string;
  /** Loudness target for this platform ([25](25-AUDIO.md)). */
  loudnessLufs?: number;
  safeZone: SafeZoneRatio;
  preset: ExportPresetId;
}
```

Presets for the common cases:

| Variant set | Produces |
|---|---|
| **Social Quintet** | 16:9, 9:16, 1:1, 4:5, 2.39:1 |
| **Broadcast Pack** | 16:9 master + ProRes mezzanine + SRT/VTT sidecars |
| **Platform Pack** | YouTube + TikTok + Reels + LinkedIn, each with its caption/loudness profile |
| **Review Pack** | 1080p H.264 + a shot-list manifest + still frames |

Each variant **reframes, re-captions, re-loudnesses, and re-grades** as its spec requires — all from the
same source project, so the master and the derivatives stay in sync.

---

## 3. Rendering efficiency

### The current path, and its bottleneck

The renderer renders frames sequentially: one GPU render → one `mapAsync` readback → one `writeExportFrame`
([04](04-RENDERING.md), [07](07-EXPORT-PIPELINE.md)). The bottleneck is the **synchronous readback** — the
GPU is idle while the CPU waits.

### Double-buffered readback

Two staging buffers: while buffer A is being read back, buffer B is already being rendered. This hides
readback latency and roughly doubles throughput on readback-bound jobs. Then:

### Shot-level parallelism

For a timeline of independent clips:

1. **Split into shots** (ranges between cuts).
2. **Render shots concurrently** on parallel GPU work (multiple render passes in flight, or multiple
   `GPUQueue`s where supported), bounded by the VRAM budget.
3. **Concatenate** in order (or write shot-by-shot with a concatenation pass) so the output is
   frame-identical to sequential rendering.

Correctness requirement: **parallel output must be byte-identical to sequential output** — a test, not a
hope.

### GPU effects at render time

Compute passes ([27](27-EFFECTS-LIBRARY.md)) run inline, so histograms, flow, and particles are available
during export exactly as they are in preview.

---

## 4. Encoding: beyond the two presets

The encoder probing already prefers `nvenc` > `qsv` > `amf` > `libx264` ([07](07-EXPORT-PIPELINE.md)).
Extend the *catalogue*:

| Delivery | Codec | Container | Notes |
|---|---|---|---|
| Web / social | H.264 | mp4 | faststart, yuv420p |
| High quality web | HEVC | mp4 | smaller, needing HEVC support |
| Next-gen web | **AV1** | webm/mp4 | `libaom-av1` / `av1_nvenc` / `av1_qsv` / `av1_amf` |
| Web transparency | VP9 / AV1 | webm | alpha channel support |
| Mezzanine | **ProRes 422 HQ** | mov | `prores_ks`, yuv422p10le |
| Broadcast mezzanine | **JPEG XS** / DNxHR | mxf/mov | `jpegxs` / `dnxhd` |
| Stills | **PNG / TIFF / EXR** | — | from any frame or poster |
| Audio | AAC / PCM / Opus | — | per container ([25](25-AUDIO.md)) |
| Captions | SRT / VTT / ASS | — | sidecars ([26](26-CAPTIONS.md)) |

**Hardware encode is the norm**, software the fallback — the probing already models this; the catalogue just
grows.

---

## 5. HDR & colour-managed delivery

Once the colour pipeline lands ([23](23-COLOR.md)), delivery carries real metadata:

- **HDR10 / PQ (ST.2084)** and **HLG** outputs, with `-color_primaries`, `-color_trc`, `-colorspace`,
  `-master-display`, and `-max-cll` flags set correctly.
- **Rec.709** and **DCI-P3** SDR outputs with matching primaries/transfer.
- **Consistent tags across video and audio** in the container.
- A **colour-space mismatch is an export error**, not a silent tag lie — validate before writing.

---

## 6. Deliverable packaging

A delivery is more than a file:

```
deliverables/<project>-<timestamp>/
├── master_16x9_prores.mov
├── review_1080p.mp4
├── social_9x16.mp4
├── captions.srt
├── captions.vtt
├── stills/frame_0000.png …
├── timeline.xml          # EDL/XML interop (see 31)
├── manifest.json         # machine-readable record of everything produced (see below)
```

The **manifest** file is what an agent reads to know what was produced, with what settings, and what the
hashes are — the artifact record for the agentic workflow ([31](31-AI-AGENTIC-SCALE.md)).

---

## 7. Verification

| Property | Test |
|---|---|
| Parallel == sequential | shot-parallel frames are byte-identical to sequential |
| Double-buffer correctness | no torn or stale frames under concurrent readback |
| Variant correctness | each variant matches a direct render at its settings |
| A/V sync | test tone at a known timecode lands there ([25](25-AUDIO.md)) |
| Colour tags | output metadata matches the variant's declared space |
| Queue durability | kill the app mid-job; the queue reloads with correct status |
| Encoder fallback | a box without NVENC uses QSV/AMF/libx264 without user intervention |

---

Related: [04-RENDERING](04-RENDERING.md) · [07-EXPORT-PIPELINE](07-EXPORT-PIPELINE.md) ·
[23-COLOR](23-COLOR.md) · [25-AUDIO](25-AUDIO.md) · [26-CAPTIONS](26-CAPTIONS.md) · [31-AI-AGENTIC-SCALE](31-AI-AGENTIC-SCALE.md)
