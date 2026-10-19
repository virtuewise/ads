# 27 — The Effects Library: WGSL Effect Catalogue & Compute Nodes

**Status: 🟡 (14 nodes, several stubbed) · Code: `engine/nodes.ts` → `engine/effects/*`, `engine/shaders/effects/*.wgsl`**

> The node registry has **14 nodes**; several are placeholders and the catalogue is thin. This document is
> the **effect library**: the full WGSL catalogue the advanced system needs, plus the compute-pass node
> class that makes real-time effects possible.

---

## What exists today

`NODE_REGISTRY` in `engine/nodes.ts`: `dataSource`, `colorSource`, `noiseSource`, `transform`, `ease`,
`stagger`, `glow`, `blur`, `colorGrade`, `vignette`, `blend`, `alphaMerge`, `render`, `script`.

Honest state of each:

| Node | State |
|---|---|
| `transform`, `ease`, `stagger` | real math, but scalar — not the layer transform ([22](22-COMPOSITOR.md)) |
| `glow` | real (additive) |
| `colorGrade` | real lift/gamma/gain, but `execute` drops the parameters |
| `blur` | **stub** — `return color * 0.8` |
| `vignette` | **stub** — `distance(vec2(0.5), vec2(0.5))` is always 0 |
| `blend` | linear `mix`, not a blend mode ([22](22-COMPOSITOR.md#blend-modes)) |
| `alphaMerge` | real alpha-over |
| `script` | real WGSL passthrough; `new Function` for CPU (sandbox needed) |

So the catalogue is roughly **6 real effects** with two stubs and two mis-specified nodes.

---

## The node categories

```
source     → media, solid, gradient, noise, text, shape, pattern, checker, ramp
transform  → transform (2.5D/3D), crop, corner-pin, mirror, repeat, tile, offset
color      → primaries, curves, qualifier, lut3d, cdl, temperature, saturation, levels,
             invert, channel-mix, vibrance, exposure
blur       → gaussian, box, directional, radial/zoom, lens/defocus, variable, smart-blur
distort    → displacement, lens-distortion, chromatic-aberration, warp, ripple, twirl,
             bulge, mirror-kaleido, spherize, fractal-noise-displace
stylize    → glow, bloom, halation, god-rays, sharpen, unsharp, posterize, halftone,
             ascii, dither, chromatic-map, gradient-map, edge-detect, find-edges,
             mosaic, scanlines, emboss
generate   → text, shape, particles, fractal-noise, cellular, voronoi, checkerboard
keying     → chroma-key, luma-key, difference-matte, spill-suppress, rotoscope (AI-assisted)
temporal   → motion-blur, echo/trails, stutter, time-displacement, frame-blend, optical-flow
composite  → blend (full modes), alpha-over, track-matte, merge, group, precomp
light      → light (point/spot/directional), ambient, rim, fog, depth-of-field, relight
compute    → optical-flow, histogram, blur-pyramid, particles-sim, reduce, GPU-sort
output     → render, preview, export-target
utility    → expression, remap, switch, delay, time, random, constant, color-const
```

This is the **catalogue the docs commit to**; nodes land over time, and the table above is the checklist.

---

## Fixing the stubs (immediately)

These are corrections, not additions:

### Real Gaussian blur (separable, mip-accelerated)

```wgsl
// Separable blur: run twice (H then V). Kernel from a small weight array.
fn gaussian_h(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, radius: f32, texel: vec2<f32>) -> vec4<f32> {
  var sum = vec4(0.0);
  let r = i32(clamp(radius, 0.0, 64.0));
  for (var i = -r; i <= r; i = i + 1) {
    let w = exp(-f32(i * i) / (2.0 * max(radius * 0.5, 0.001) * max(radius * 0.5, 0.001)));
    sum = sum + textureSample(src, samp, uv + texel * f32(i)) * w;
  }
  return sum;
}
```

For large radii, use a **mip pyramid** (downsample → blur small → upsample) — O(log n) instead of O(n²).

### Real vignette

```wgsl
fn vignette(color: vec4<f32>, uv: vec2<f32>, intensity: f32, softness: f32) -> vec4<f32> {
  let d = distance(uv, vec2(0.5)) * 1.41421356;
  let m = smoothstep(0.5 - softness, 1.0, d);
  return vec4(color.rgb * (1.0 - intensity * m), color.a);
}
```

> The current stub computes `distance(vec2(0.5), vec2(0.5))` = `0`, so it does nothing. The fix is to pass
> `uv` in, which also requires the **texture-sampling node contract** (§below) — this is why "fix the
> stubs" is really "give nodes access to the input texture and `uv`", the compositor milestone.

### Real blend modes

Replaced by the full set in [22](22-COMPOSITOR.md#blend-modes).

---

## The texture-sampling node contract

Today a node's WGSL is `fn blur(color: vec4<f32>, radius: f32) -> vec4<f32>` — it receives a *color*, not
an *image*. That is why effects like blur, vignette, and displacement cannot be correct: **they need
neighbouring pixels**.

The real contract, per node:

```wgsl
// Every effect node may sample its input texture at an arbitrary uv.
@group(0) @binding(1) var inputTex: texture_2d<f32>;
@group(0) @binding(2) var inputSamp: sampler;

fn effect_blur(uv: vec2<f32>, params: vec4<f32>) -> vec4<f32> {
  // …sample inputTex at neighbours…
}
```

The compiler ([03](03-ENGINE-CORE.md)) changes: a node's WGSL declares whether it is a **point effect**
(`color → color`) or a **neighbourhood effect** (`uv + sampler → color`). This is the same change that
lets the DAG feed the real compositor (Phase 0.1).

---

## Compute nodes

The second node class: nodes that run a **`@compute` pass** rather than a fragment pass. These unlock:

| Compute node | What it does | Used by |
|---|---|---|
| `optical-flow` | dense A→B flow field | morph transitions ([24](24-TRANSITIONS.md)), retime, frame interpolation |
| `histogram` | frame → 256-bin RGB/luma reduce | scopes ([23](23-COLOR.md)), auto-exposure |
| `blur-pyramid` | build mip chain | fast bloom/glow/DOF |
| `particles-sim` | GPU particle state step | particle effects, `particle-dissolve` |
| `reduce` | generic parallel reduction | mean/min/max/percentiles |
| `gpu-sort` | bitonic sort | depth sorting for 3D/particles |
| `frame-blend` | temporal accumulation | motion blur, echo, denoise |

A compute node declares workgroup size, dispatch dimensions, and storage buffers/textures:

```typescript
interface ComputeNodeSpec {
  type: string;
  workgroupSize: [number, number, number];
  /** Dispatch dimensions derived from the input or a parameter. */
  dispatch: (inputs: ComputeInputs) => [number, number, number];
  /** WGSL binding declarations + the @compute entry. */
  wgsl: string;
  /** Storage resources the node creates/uses. */
  resources: ResourceSpec[];
}
```

Compute nodes are the difference between "a shader toy" and "a compositor": flow, histograms, pyramids, and
particle sims are not expressible as per-pixel fragment work.

---

## Effect quality tiers

Each effect declares its cost so the system can degrade gracefully:

| Tier | Meaning | Examples |
|---|---|---|
| **preview** | cheap approximation for the viewport | velocity-blur DOF, 1-pass glow |
| **quality** | the real thing, used for export | accumulation DOF, mip-pyramid bloom |
| **both** | cost is fine either way | gaussian blur, grade, blend |

The export path always uses **quality**; the viewport uses **preview** when over budget. Crucially, this
must not break the WYSIWYG contract for the *final render* — the contract is preview-vs-export **at equal
settings** ([04](04-RENDERING.md)), and the preview tier is explicitly labelled as an approximation in the
UI.

---

## Effect metadata

Each effect carries metadata for the UI, presets, and agents:

```typescript
interface EffectMeta {
  type: string;
  label: string;
  category: EffectCategory;
  tier: 'preview' | 'quality' | 'both';
  ports: Port[];
  /** Parameters with ranges, for auto-generated UI and agent tooling. */
  params: ParamSpec[];
  /** WGSL for fragment and/or compute. */
  fragment?: string;
  compute?: ComputeNodeSpec;
  /** Minimum WebGPU features (e.g. float32-filterable, texture-3d). */
  requires?: GpuFeature[];
}
```

`params: ParamSpec[]` is what lets the UI auto-generate the effect inspector and lets an agent set an
effect without reading WGSL.

---

## Particle system (a flagship effect)

Particles deserve a note because they are the most visible "advanced" effect and they exercise compute:

- **State**: position, velocity, life, seed per particle — a storage buffer.
- **Step**: `@compute` integrates velocity (with forces, turbulence from curl-noise), ages particles,
  respawns dead ones at the emitter.
- **Render**: a fragment pass draws each particle from the state buffer, sorted back-to-front (via
  `gpu-sort`), with additive or blend-mode compositing.
- **Emitters**: point, line, shape-path, and **image-based emission** (sample luminance to emit from a
  logo's bright areas — the classic "shatter into the logo" build).

---

## Verification

| Property | Test |
|---|---|
| Blur preserves mean luminance | sum before ≈ sum after (energy preservation) |
| Vignette is radially symmetric | identical values on a circle about centre |
| Bloom is additive and bounded | no clipping beyond a documented ceiling |
| Compute determinism | same input → same storage buffer contents |
| Feature gating | a `texture-3d` effect on a device without the feature degrades, not crashes |
| Viewport == export (quality) | frame hashes match at equal tier ([04](04-RENDERING.md)) |

---

Related: [03-ENGINE-CORE](03-ENGINE-CORE.md) · [04-RENDERING](04-RENDERING.md) · [22-COMPOSITOR](22-COMPOSITOR.md) ·
[23-COLOR](23-COLOR.md) · [24-TRANSITIONS](24-TRANSITIONS.md)
