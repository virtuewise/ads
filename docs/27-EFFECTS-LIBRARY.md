# 27 — The Effects Library: WGSL Effect Catalogue & Compute Nodes

**Status: 🟡 (registered WGSL nodes and a multi-pass render path are live; compute dispatch and some graph shapes remain unsupported) · Code: `engine/nodes.ts`, `engine/compiler.ts`, `engine/renderFrame.ts`, `App.tsx`**

> `NODE_REGISTRY` in `engine/nodes.ts` holds the renderer's node catalogue. The viewport and exporter can
> execute compatible multi-pass texture-sampling chains. The Effects panel filters to registered visual
> nodes with one texture input and output, inserts them into the render graph, and exposes their inputs.
> Compute dispatch, branches across pass boundaries, and multi-texture effects remain unsupported.

---

## What exists today

`NODE_REGISTRY` in `engine/nodes.ts` — nodes by category (the registry is the source of truth):

| Category | Nodes |
|---|---|
| **source** | `dataSource`, `colorSource`, `proceduralScene`, `noiseSource`, `mediaSource`, `solidSource`, `gradientSource`, `checkerSource` |
| **transform** | `transform`, `spatialTransform`, `oscillator`, `spring`, `ease`, `stagger` |
| **effect** | `glow`, `blur`, `colorGrade`, `vignette` |
| **color** | `temperature`, `levels`, `exposure`, `saturation`, `hueShift`, `invert`, `threshold`, `channelMixer`, `solarize`, `oklabGrade`, `toneMap` |
| **stylize** | `sharpen`, `filmGrain`, `bloom`, `posterize`, `halftone`, `scanlines`, `edgeDetect`, `dither`, `pixelate`, `emboss` |
| **distort** | `chromaticAberration`, `lensDistortion`, `displacementMap`, `twirl`, `rgbSplit` |
| **blur** | `lensBlur` |
| **temporal** | `motionBlur` |
| **keying** | `chromaKey` |
| **compute** | `histogram`, `blurPyramid`, `opticalFlow`, `particleSystem` |
| **composite** | `blend`, `alphaMerge` |
| **output / script** | `render`, `script` |

Honest state of the interesting ones:

| Node | State |
|---|---|
| `transform`, `ease`, `stagger` | real math, but scalar — not the layer transform ([22](22-COMPOSITOR.md)) |
| `spatialTransform`, `oscillator`, `spring` | real spatial/easing generators; not yet bound to `composition.transform` |
| `blur` | real 9-tap Gaussian, executed as a multi-pass texture-sampling node |
| `vignette` | real radial falloff, available in the renderable effect stack |
| `glow` | approximate (additive tint, no bright-pass threshold) |
| `colorGrade` | real lift/gamma/gain; parameters reach the emitted WGSL |
| `blend` | real modes (`darken`, `screen`, `overlay`, `hardlight`, `subtract`, `divide`, `difference`) selected at compile time |
| `alphaMerge` | real alpha-over |
| `compute` nodes | specs + WGSL written; **no dispatch runtime yet** |
| `script` | real WGSL passthrough; `new Function` for CPU (sandbox needed) |
| `mediaSource` | node exists; frames require the demux pipeline ([29](29-MEDIA-PIPELINE.md)) |

The app effect stack is currently limited to visual nodes with exactly one texture input and one texture
output, because it can safely insert those in a linear render chain. The multi-pass executor handles
supported texture-sampling chains in both preview and export. Compute nodes, nodes requiring multiple
texture inputs, and branching graphs across pass boundaries remain outside this stack.

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

The multi-pass executor binds upstream segment textures for compatible linear chains. The older
single-pass bridge (`engine/bridge.ts`) remains useful for point-effect graphs, but the viewport and
exporter use the compiled segment path when a graph needs multiple passes. Unsupported graph shapes
surface an explicit compile/render error rather than silently binding an invalid texture.

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
