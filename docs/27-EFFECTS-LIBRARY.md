# 27 — The Effects Library: WGSL Effect Catalogue & Compute Nodes

**Status: 🟡 (56 nodes with real WGSL; the multi-pass runtime that would execute texture-sampling nodes is ⬜, and the plan reports the effects that need it) · Code: `engine/nodes.ts`**

> `NODE_REGISTRY` in `engine/nodes.ts` holds **53 nodes** across 13 categories. Every node emits real
> WGSL — there are no placeholder `return color * 0.8` stubs left. What is missing is the **multi-pass
> runtime**: the single-pass bridge ([03](03-ENGINE-CORE.md)) refuses any graph that samples a texture,
> so blur/keying/displacement graphs compile but do not yet reach the viewport. This document is the
> **effect library**: the catalogue that exists, the conventions every node follows, and the compute-pass
> class that makes real-time effects possible.

---

## What exists today

`NODE_REGISTRY` in `engine/nodes.ts` — 56 nodes by category:

| Category | Nodes |
|---|---|
| **source** (8) | `dataSource`, `colorSource`, `proceduralScene`, `noiseSource`, `mediaSource`, `solidSource`, `gradientSource`, `checkerSource` |
| **transform** (6) | `transform`, `spatialTransform`, `oscillator`, `spring`, `ease`, `stagger` |
| **effect** (4) | `glow`, `blur`, `colorGrade`, `vignette` |
| **color** (11) | `temperature`, `levels`, `exposure`, `saturation`, `hueShift`, `invert`, `threshold`, `channelMixer`, `solarize`, `oklabGrade`, `toneMap` |
| **stylize** (10) | `sharpen`, `filmGrain`, `bloom`, `posterize`, `halftone`, `scanlines`, `edgeDetect`, `dither`, `pixelate`, `emboss` |
| **distort** (5) | `chromaticAberration`, `lensDistortion`, `displacementMap`, `twirl`, `rgbSplit` |
| **blur** (1) | `lensBlur` |
| **temporal** (1) | `motionBlur` |
| **keying** (1) | `chromaKey` |
| **compute** (4) | `histogram`, `blurPyramid`, `opticalFlow`, `particleSystem` |
| **composite** (2) | `blend`, `alphaMerge` |
| **output / script** (2) | `render`, `script` |

Honest state of the interesting ones:

| Node | State |
|---|---|
| `transform`, `ease`, `stagger` | real math, but scalar — not the layer transform ([22](22-COMPOSITOR.md)) |
| `spatialTransform`, `oscillator`, `spring` | real spatial/easing generators; not yet bound to `composition.transform` |
| `blur` | real 9-tap separable Gaussian — **texture-gated** (see below) |
| `vignette` | real radial falloff with `uv` — **texture-gated** |
| `glow` | approximate (additive tint, no bright-pass threshold) |
| `colorGrade` | real lift/gamma/gain; parameters reach the emitted WGSL |
| `blend` | real modes (`darken`, `screen`, `overlay`, `hardlight`, `subtract`, `divide`, `difference`) selected at compile time |
| `alphaMerge` | real alpha-over |
| `compute` nodes | specs + WGSL written; **no dispatch runtime yet** |
| `script` | real WGSL passthrough; `new Function` for CPU (sandbox needed) |
| `mediaSource` | node exists; frames require the demux pipeline ([29](29-MEDIA-PIPELINE.md)) |

**Texture-gated** means: the node's WGSL is correct and follows the neighbourhood convention below, but the
single-pass bridge rejects any graph whose compiled module declares more than the uniform binding — the
viewport falls back to `COMPOSITE_SHADER` with that reason in its tooltip. Multi-pass execution is the
next phase ([21](21-ROADMAP.md)).

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

## The neighbourhood convention (implemented)

The old blocker was that a node's WGSL received a *colour*, not an *image*, so blur/vignette/displacement
could not be correct. That is fixed at the compiler level. A node declares its first input port as
`texture`, and when the compiler emits the call it **drops that argument and injects the binding**:

```typescript
// compiler.ts — neighbourhood-effect calling convention
// the node's first (input-texture) argument is replaced by:
//   `${varName}_tex, ${varName}_samp, 'uv'`
```

so the emitted WGSL signature is:

```wgsl
fn blur(src: texture_2d<f32>, samp: sampler, uv: vec2<f32>, radius: f32) -> vec4<f32>
```

and the call site passes the upstream node's texture, sampler, and the fragment's `uv`. Point effects
(`color → color`) keep the simple signature; neighbourhood effects opt into sampling by taking a
`texture` first port.

What is **not** yet built is the runtime that binds those textures: the bridge
(`engine/bridge.ts`) runs the whole graph in one fragment pass, so a graph with any texture-sampling node
is rejected with an explicit error rather than presented as an invalid bind group. Until a multi-pass
interpreter exists, such graphs stay on the composite fallback.

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

The first four rows exist as registered nodes (`histogram`, `blurPyramid`, `opticalFlow`,
`particleSystem`); the last three are still catalogue commitments. **None of them is dispatched yet** —
the viewport is a single fragment pass, so the compute specs have no interpreter. The first consumer is
planned to be the scopes panel's GPU reduction ([23](23-COLOR.md#5-scopes)).

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
