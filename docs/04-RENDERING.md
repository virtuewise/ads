# 04 — Rendering: WebGPU, the WYSIWYG Contract & Hardware

**Status: 🟡 (viewport and exporter run the same graph passes; hardware pixel parity still needs manual verification) · Code: `engine/visual.ts`, `engine/bridge.ts`, `engine/renderFrame.ts`, `components/WebGPUCanvas.tsx`**

> Rendering is split into two paths: the interactive **viewport** and the headless **exporter**. They
> share `engine/visual.ts` — the uniform packing and output contract — and accept the same DAG bridge
> program. Multi-pass effects render through intermediate GPU textures in both paths; export selects
> the active shot look, decodes its media frame, and rasterizes title textures for each frame.

---

## The WYSIWYG contract

> **A frame rendered in the viewport at time `t` and exported at time `t` uses the same graph, pass
> order, uniforms, media frame, and title rasterization** at equal resolution and LUT. Byte identity
> still needs a manual comparison on supported GPU hardware.

This is guaranteed **structurally** for the composite path, not by testing discipline:

```
                        engine/visual.ts
              ┌───────────────────────────────┐
              │  COMPOSITE_SHADER  (WGSL)     │
              │  packUniforms()    (layout)   │
              │  UNIFORM_FLOATS / UNIFORM_BYTES│
              └───────────────┬───────────────┘
                    ┌─────────┴─────────┐
                    ▼                   ▼
        WebGPUCanvas.tsx        renderFrame.ts
        (interactive)           (headless export)
```

Both import the *same* shader string and the *same* packing function. There is no second implementation
to drift.

---

## `engine/visual.ts` — the shared core

### The composite shader

`COMPOSITE_SHADER` is a full-screen pass over a 6-vertex triangle pair. It:

1. **Transforms UV space** by the composition transform: rotation → scale → translation.
2. **Generates the procedural composition** — an ink-to-violet vertical mix, a subtle 40 Hz grid, a
   time-animated accent radial (`#ff5a2c`-ish `vec3(1.0,0.35,0.17)`), and a vignette.
3. **Applies the brand LUT** as a luminance-driven three-point gradient:

   ```wgsl
   let lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
   var lutCol = mix(u.lutShadow.rgb, u.lutMid.rgb,     smoothstep(0.0, 0.5, lum));
   lutCol     = mix(lutCol,         u.lutHighlight.rgb, smoothstep(0.5, 1.0, lum));
   col        = mix(col,            lutCol,             u.lutShadow.a);   // .a = intensity
   ```
4. **Applies opacity** and returns premultiplied-ish `vec4(col * a, a)`.

> The procedural content here is a **placeholder scene**. Once media import lands
> ([29-MEDIA-PIPELINE](29-MEDIA-PIPELINE.md)), this shader is replaced by a real layered compositor —
> see [22-COMPOSITOR](22-COMPOSITOR.md) and [21-ROADMAP](21-ROADMAP.md).

### The uniform block

`UNIFORM_FLOATS = 20`, `UNIFORM_BYTES = 80`. The exact layout, and how `packUniforms` fills it:

| Index | Field | Source | Note |
|---|---|---|---|
| 0 | `time` | `input.time` (seconds) | drives animation |
| 1 | `scale` | `transform.scale` | clamped to ≥ 0.0001 in shader |
| 2 | `rotation` | `transform.rotation` | **degrees → radians** (`× π/180`) |
| 3 | `opacity` | `transform.opacity` | clamped 0–1 in shader |
| 4 | `resolution.x` | `width` | |
| 5 | `resolution.y` | `height` | |
| 6 | `translation.x` | `transform.x / width` | normalized |
| 7 | `translation.y` | `transform.y / height` | normalized |
| 8–10 | `lutShadow.rgb` | LUT shadow color | `hexToRgb`, or black if none |
| 11 | `lutShadow.a` | **LUT intensity** | 0 when LUT is `none` |
| 12–14 | `lutMid.rgb` | LUT midtone | grey `0.5` if none |
| 15 | — | 0 | padding |
| 16–18 | `lutHighlight.rgb` | LUT highlight | white if none |
| 19 | — | 0 | padding |

`hexToRgb()` handles 3- and 6-digit hex and returns `[0,0,0]` on parse failure.

> **Gotcha when extending:** the WGSL `Uniforms` struct must stay in lockstep with this float layout.
> If you add a field, add it to *both* the struct and `packUniforms`, bump `UNIFORM_FLOATS`, and update
> this table. There is no reflection to catch a mismatch — the GPU will silently misread.

---

## The interactive viewport — `components/WebGPUCanvas.tsx`

- Requests adapter/device from `navigator.gpu`.
- Configures the canvas context with the preferred swapchain format and
  `RENDER_ATTACHMENT | COPY_SRC` (the latter enables scope readback).
- Runs a **persistent `requestAnimationFrame` loop** that:
  1. Computes `time` from the elapsed clock.
  2. Calls `packUniforms` with the current `time`, `transform`, `lut`, and canvas size.
  3. Submits the render pass and presents.
- **Recompiles the pipeline when `shaderCode` changes.** The previous pipeline keeps drawing while the
  new module compiles, and shader validation errors (`getCompilationInfo`, `pushErrorScope`) surface in
  an on-canvas error overlay instead of a silent black frame.
- Exposes `readPixels()` through an imperative handle. A `scope-readback` encoder copies the current
  canvas texture into a 256-byte-aligned `MAP_READ` buffer; this runs **only on demand** while the
  Scopes panel is mounted ([23-COLOR](23-COLOR.md#5-scopes)).
- Is driven by **props** (`time`, `transform`, `lut`, `width`, `height`) — so editing a transform field
  or dragging a clip updates the canvas on the very next frame. This is the live-feedback contract
  described in [16-INTERFACE](16-INTERFACE.md).
- Resizes to the container, accounting for device pixel ratio.
- **Binds the media layer.** When the graph contains a `mediaSource`, the viewport imports the
  current decoded `VideoFrame` with `device.importExternalTexture()` and rebuilds the media bind
  group every frame — an imported external texture only lives for the current task. The pixels
  reach the GPU with no copy ([29-MEDIA-PIPELINE](29-MEDIA-PIPELINE.md#zero-copy-to-the-gpu)).

---

## The headless exporter — `engine/renderFrame.ts`

`createFrameRenderer({ width, height, lut })` returns a `FrameRenderer` or **`null` when WebGPU is
unavailable** (the export reports that failure — see [07-EXPORT-PIPELINE](07-EXPORT-PIPELINE.md)). A
render call can supply the graph program, current `VideoFrame`, and app-painted images; compiled
program variants are cached for the export.

### Pipeline

1. Compile the graph variant into one `layout: 'auto'` render pipeline per pass, or use
   `COMPOSITE_SHADER` when no program is supplied.
2. Create an `rgba8unorm` output texture and an intermediate render texture for each preceding pass.
3. Bind the current media frame, preceding pass input, and app-painted title textures. Media bind
   groups are rebuilt each frame because imported external textures expire at the end of the task.
4. Create a `COPY_DST | MAP_READ` **staging buffer** sized to the padded row layout.

### The 256-byte row alignment

WebGPU requires `bytesPerRow` to be a multiple of 256 when copying a texture to a buffer.
`alignRow(width) = ceil(width*4 / 256) * 256`. For 1920px that is `7680` (already aligned); for e.g.
1000px it pads to `4096`. On readback the padded rows are **repacked** into a tight `Uint8Array` of
`width*4*height` bytes — which is exactly what FFmpeg's `rawvideo` input wants.

### `render(time, transform, inputs)`

1. Update app-painted images and `packUniforms` → `writeBuffer`.
2. Record graph passes in order, feeding each pass the preceding intermediate texture. The final
   active pass renders to the output texture.
3. `copyTextureToBuffer` with the aligned `bytesPerRow`.
4. `submit`, then `await mapAsync(READ)`.
5. Slice (or repack) the mapped range into tightly packed RGBA bytes, `unmap`, return.

`dispose()` destroys cached intermediate textures, app textures, the output texture, staging buffer,
uniform buffer, and device.

> **Performance note:** the export is *not* run on the main thread's UI work — it is a sequential async
> loop in the renderer (`engine/export.ts`), with the heavy encoding in the main process and FFmpeg.
> Each frame is a GPU render + one sync readback. Batching/deferring readbacks (double-buffered
> staging) is a roadmap optimisation. See [07-EXPORT-PIPELINE](07-EXPORT-PIPELINE.md).

---

## Color management

| Concern | v0.1 reality |
|---|---|
| Viewport format | `bgra8unorm` (swapchain) |
| Export format | `rgba8unorm` (offscreen) |
| Working space | **non-linear sRGB, 8-bit** — the procedural content and LUT are authored in this space |
| Export color metadata | FFmpeg tags depend on the preset; `yuv420p` (H.264) or `yuv422p10le` (ProRes) |
| HDR / wide gamut | ⬜ not implemented |

The composite shader operates directly on display-referred values; there is no linear-light round trip
today. Introducing one — and matching the FFmpeg `-colorspace`/`-color_primaries` flags — is the path
to a colour-managed pipeline ([21-ROADMAP](21-ROADMAP.md)).

---

## Hardware & resource management

Because everything is local, the app must be explicit about the machine it runs on.

| Resource | How it is used | Safeguard |
|---|---|---|
| **GPU (VRAM)** | Viewport swapchain + export output/intermediate textures + staging buffer. A 4K frame is ~33 MB CPU-side, plus one texture per active pass and the staging buffer. | Export caches shader variants for active shot looks; intermediate texture count scales with the maximum pass count. |
| **System RAM** | Each export frame is a `Uint8Array` (`width*height*4`) at 1080p ≈ 8 MB, 4K ≈ 33 MB. | Backpressure in `export:frame` bounds the FIFO (see below); frames are not accumulated in memory. |
| **CPU** | Node `execute()` per compile; keyframe sampling per frame; FFmpeg encoding in its own process. | The exporter is a sequential loop, so it does not spawn parallel GPU work. |
| **Disk I/O** | FFmpeg writes encoded chunks to the SSD. | The renderer cannot outrun FFmpeg: `export:frame` awaits queue relief when the internal buffer grows past 8 frames ([07](07-EXPORT-PIPELINE.md)). |

> **VRAM safeguard gap:** the vision calls for a *frame-throttling ring buffer* so a fast GPU cannot
> outrun a slow disk. The current backpressure is applied on the **frame queue**, not on GPU memory, and
> there is no pre-decode ring buffer yet. Both are roadmap items ([15](15-GENRE-DETECTIVE.md),
> [21-ROADMAP](21-ROADMAP.md)).

---

## Reading and extending the renderer

- **Change the look:** edit `COMPOSITE_SHADER` in `engine/visual.ts`. Nothing else needs to change —
  both paths pick it up.
- **Add a uniform:** update the WGSL `Uniforms` struct *and* `packUniforms`, bump `UNIFORM_FLOATS`,
  update the table above, and pass the new value from `WebGPUCanvas` props and `renderFrame` options.
- **Sample an external texture (media):** add a `texture_2d<f32>` + sampler binding, extend the bind
  group in **both** paths, and update `packUniforms` only if you add matching uniform fields. This is the
  media-import milestone.

---

Related: [03-ENGINE-CORE](03-ENGINE-CORE.md) · [07-EXPORT-PIPELINE](07-EXPORT-PIPELINE.md) ·
[18-BRAND-AND-LUTS](18-BRAND-AND-LUTS.md) · [20-OPERATIONS](20-OPERATIONS.md)
