# 47 — Performance Tuning Guide

**Status: 🟡 (real-time viewport works; profiling, LOD, and adaptive quality are ⬜) · Code: `components/WebGPUCanvas.tsx`, `engine/renderFrame.ts` → target: `engine/performance/*`**

> The WebGPU viewport renders a persistent `requestAnimationFrame` loop with a single composite
> shader. There is **no profiling, no level-of-detail, no adaptive quality** — the same shader runs
> regardless of frame time. This document specifies the performance system.

---

## 1. What exists today

### 1.1 The render loop

`components/WebGPUCanvas.tsx`:

```typescript
function frame() {
  const uniforms = packUniforms(time, width, height, transform, lut);
  // render pass → COMPOSITE_SHADER
  requestAnimationFrame(frame);
}
```

A single render pass, every frame, at full resolution. No frame-time measurement, no adaptive
quality, no LOD.

### 1.2 The headless renderer

`engine/renderFrame.ts` — `FrameRenderer` renders a single frame for export. One GPU render → one
`mapAsync` readback → one `writeExportFrame`. The readback is synchronous — the GPU idles while the
CPU waits.

### 1.3 What's missing

| Capability | Today |
|---|---|
| Frame-time profiling | ⬜ none |
| Adaptive quality | ⬜ none |
| Level-of-detail (LOD) | ⬜ none |
| Frame skipping | ⬜ none |
| VRAM budget management | ⬜ none |
| Multi-frame parallelism | ⬜ sequential |
| GPU timing queries | ⬜ none |
| Thermal throttling awareness | ⬜ none |

---

## 2. The performance model (target)

### 2.1 Frame budget

Every frame has a **budget** — the time it must complete in to hit the target fps:

```
budget = 1000 / fps   (e.g. 16.67ms for 60fps, 33.33ms for 30fps)
```

The system measures the actual frame time and adapts:

| Frame time | Action |
|---|---|
| < budget × 0.7 | increase quality (full res, all effects) |
| budget × 0.7 – budget × 0.9 | maintain quality |
| budget × 0.9 – budget × 1.2 | decrease quality (half res, fewer effects) |
| > budget × 1.2 | drop frames, render at quarter res |

### 2.2 Adaptive quality

A quality tier system:

| Tier | Resolution | Effects | Use |
|---|---|---|---|
| **Full** | source | all | export, stills |
| **Half** | 50% | all | normal editing |
| **Quarter** | 25% | reduced | scrubbing, low-spec |
| **Preview** | 25% | minimal | real-time playback |

The tier is selected automatically based on frame time, with a manual override.

### 2.3 Level-of-detail (LOD)

Effects declare their LOD:

```typescript
interface EffectLOD {
  /** Full quality — export and stills. */
  full: EffectSpec;
  /** Reduced quality — normal editing. */
  half: EffectSpec;
  /** Minimal quality — scrubbing. */
  preview: EffectSpec;
}
```

Example: a gaussian blur with a 64-tap kernel at full quality, 16-tap at half, 4-tap at preview.

---

## 3. Frame-time profiling

### 3.1 GPU timing

WebGPU timestamp queries measure GPU time per pass:

```typescript
const querySet = device.createQuerySet({ type: 'timestamp', count: 2 });
// write timestamp before pass, after pass, resolve, read
```

### 3.2 CPU timing

`performance.now()` around each CPU operation:

- Document transform
- Uniform packing
- Render pass submission
- Frame readback
- FFmpeg write

### 3.3 The profiler UI

A dockable **Performance panel**:

```
┌─ Performance ─────────────────────────┐
│ Frame time: 12.3ms (budget 16.7ms)   │
│ ████████░░░░░░░░ 74%                  │
├──────────────────────────────────────┤
│ GPU:  8.1ms                           │
│ CPU:  4.2ms                           │
│ ├─ transform    0.3ms                │
│ ├─ uniforms     0.5ms                │
│ ├─ render       7.8ms                │
│ ├─ readback     2.9ms                │
│ └─ ffmpeg       0.5ms                │
├──────────────────────────────────────┤
│ VRAM: 1.2 GB / 4.0 GB                 │
│ Draw calls: 1                        │
│ Triangles: 2                          │
└──────────────────────────────────────┘
```

---

## 4. VRAM budget management

### 4.1 Texture pooling

Never allocate a texture per frame — reuse from a sized pool:

```typescript
class TexturePool {
  private pool: Map<string, GPUTexture>;
  acquire(key: string, descriptor: GPUTextureDescriptor): GPUTexture;
  release(key: string): void;
}
```

### 4.2 Budget tracking

Track allocated textures:

| Resource | Size | Evictable? |
|---|---|---|
| Layer textures | W×H×4×layers | no (active) |
| Effect intermediates | W×H×4×effects | yes (cached) |
| Blur pyramid | W×H×4×levels | yes (rebuild) |
| Decoded frames | W×H×4×N | yes (ring buffer) |
| Total | sum | — |

When the total exceeds the budget, evict caches (blur pyramid, decoded frames) — never crash.

### 4.3 Graceful degradation

When VRAM is exhausted:

1. Evict blur pyramids (rebuild on demand).
2. Shrink the frame ring buffer.
3. Drop to half-resolution intermediates.
4. If still exhausted, drop to quarter resolution.
5. If still exhausted, pause rendering and notify the user.

---

## 5. Render efficiency

### 5.1 Double-buffered readback

Two staging buffers: while buffer A is being read back, buffer B is being rendered. This hides
readback latency and roughly doubles throughput on readback-bound jobs.

### 5.2 Shot-level parallelism

For a timeline of independent clips:

1. Split into shots (ranges between cuts).
2. Render shots concurrently (multiple render passes in flight).
3. Concatenate in order.

**Correctness:** parallel output must be **byte-identical** to sequential output.

### 5.3 Frame skipping

When scrubbing (dragging the playhead), render only every Nth frame:

```typescript
const scrub = Math.abs(playheadVelocity) > threshold;
if (scrub && frame % 3 !== 0) skip;
```

The full frame is rendered when the playhead stops.

---

## 6. Export performance

### 6.1 Encoder selection

Hardware encoders ([41](41-RENDER-FORMAT-REFERENCE.md)) are 10–50× faster than software. The
probing order is: NVENC > QSV > AMF > libx264.

### 6.2 Bitstream filtering

Minimal FFmpeg filters — every filter adds CPU cost. Use only the filters the format requires.

### 6.3 I/O optimization

- Write to a fast NVMe SSD.
- Use a RAM disk for the staging buffer if available.
- Avoid network drives for export.

---

## 7. Verification

| Property | Test |
|---|---|
| Frame budget | the viewport maintains the target fps under normal load |
| Adaptive quality | under heavy load, quality drops but fps is maintained |
| LOD | a heavy effect renders faster at preview tier |
| VRAM budget | under memory pressure, caches are evicted, not crashed |
| Double-buffer | export throughput increases with double buffering |
| Parallel == sequential | shot-parallel frames are byte-identical |
| Profiler | the profiler shows accurate GPU and CPU timings |

---

Related: [04-RENDERING](04-RENDERING.md) · [30-RENDER-QUEUE](30-RENDER-QUEUE.md) ·
[27-EFFECTS-LIBRARY](27-EFFECTS-LIBRARY.md#effect-quality-tiers) · [22-COMPOSITOR](22-COMPOSITOR.md#performance--vram) ·
[29-MEDIA-PIPELINE](29-MEDIA-PIPELINE.md)
