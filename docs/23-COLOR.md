# 23 — Color: Grading Engine, LUTs, Scopes & Color Management

**Status: 🟡 (brand tint, a DAG bridge, and a three-scope panel are real; a full grading engine is ⬜) · Code: `engine/visual.ts`, `engine/bridge.ts`, `components/ScopesPanel.tsx` (today) → `engine/color/*` (target)**

> Today "color" is a **three-point luminance gradient** driven by five hardcoded brand LUTs
> (`BRAND_LUTS`, applied in `COMPOSITE_SHADER` and in the DAG bridge), plus a **viewport-sampled
> scopes panel**. This document specifies a **real grading engine**:
> primaries, curves, qualifiers, 3D LUTs, GPU-reduced scopes, and a colour-managed pipeline from camera
> to delivery.

---

## What exists today, precisely

The current grade, in full:

```wgsl
let lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
var lutCol = mix(u.lutShadow.rgb, u.lutMid.rgb,     smoothstep(0.0, 0.5, lum));
lutCol     = mix(lutCol,         u.lutHighlight.rgb, smoothstep(0.5, 1.0, lum));
col        = mix(col,            lutCol,             u.lutShadow.a);   // intensity
```

It is a **tonal tint**, not a grade. It cannot express a hue shift, a curve, a qualifier, or a real LUT.
It is a good *brand tint* and a poor *grader*, and the two should stop being the same thing.

---

## The grading model

A grade is an ordered chain of **grade nodes** — which, per the unification principle, are
[DAG nodes](03-ENGINE-CORE.md), so they can be built visually, written in code, or produced by an agent.

```typescript
type GradeOp =
  | { kind: 'primaries'; lift: RGB; gamma: RGB; gain: RGB; offset: RGB }
  | { kind: 'logWheels'; shadows: RGB; midtones: RGB; highlights: RGB; range: number }
  | { kind: 'curves'; curve: CurveSet }
  | { kind: 'qualifier'; key: HSLKey; softness: number; invert: boolean }
  | { kind: 'lut3d'; lutId: string; intensity: number }
  | { kind: 'matrix'; m: number[] }          // 3×3 or 3×4 (saturation, channel mix)
  | { kind: 'cdl'; slope: RGB; offset: RGB; power: RGB; sat: number }  // ASC CDL
  | { kind: 'temperature'; kelvin: number; tint: number }
  | { kind: 'sharpen' | 'denoise' | 'grain'; amount: number; size?: number };
```

### Serial / parallel node trees

Real grading tools use a **node tree**, not a linear chain: serial nodes (one in → one out), parallel
nodes (many in → one out), layer nodes (a key mix), and key mixers. This is expressible in the DAG with
zero new machinery — that is the payoff of the unified model.

---

## 1. Primaries

**Lift / Gamma / Gain**, plus **Offset** and master variants, in a colour-managed space:

- **Lift** — raises shadows: `out = in + lift * (1 - in)` (i.e. lift where in→0).
- **Gamma** — midtone power: `out = pow(in, 1/gamma)`.
- **Gain** — multiplies highlights: `out = in * gain`.
- **Offset** — adds a constant across the range.

Plus **log wheels** for log-encoded footage: shadow/midtone/highlight ranges with adjustable overlap
(`range`), which is what colourists actually use on LOG material.

Every wheel is a **trackball UI** (see [16-INTERFACE](16-INTERFACE.md) for the interaction contract) with
numeric fallbacks for agents.

---

## 2. Curves

A full curve set — the most expressive grade tool:

| Curve | Purpose |
|---|---|
| **RGB master** | tonal shape |
| **Per-channel R/G/B** | colour balance |
| **Hue vs. Hue** | rotate specific hues |
| **Hue vs. Saturation** | saturate/resaturate ranges |
| **Hue vs. Luminance** | brighten/darken ranges |
| **Saturation vs. Saturation** | saturation shaping |
| **Luminance vs. Saturation** | fade shadows/highlights |

Implementation: monotone cubic spline interpolation, evaluated in WGSL as a 1D texture (256×1) uploaded
per curve — the standard technique, cheap and exact.

---

## 3. The HSL qualifier

Select a colour range and grade only it:

- **Key**: hue range, sat range, lum range, each with softness.
- **Matte view**: render the key as a black/white matte so the operator can see exactly what is selected.
- **Connected / clean**: connectedness limit and clean black/white to kill edge noise.
- **Invert**, and **outside-node** grading (grade everything *except* the key).

This is what makes skin-tone work possible: qualify skin, lift it slightly, leave the rest.

---

## 4. 3D LUTs (`.cube`)

**Replaces the five hardcoded LUTs as the primary mechanism**, while keeping them as brand presets.

- Parse `.cube` files (1D and 3D; 17³ and 33³ typical, up to 65³).
- Upload as a `texture_3d<f32>` (WebGPU supports 3D textures) with linear filtering.
- Sample with trilinear interpolation:

```wgsl
let c = clamp(color.rgb, vec3(0.0), vec3(1.0));
let scaled = c * (f32(lutSize) - 1.0);
let lo = floor(scaled);
let hi = min(lo + 1.0, f32(lutSize) - 1.0);
let f  = scaled - lo;
// 8-corner trilinear interpolation between textureLoad samples
```

- **Intensity** blends the graded result back toward the original (the current LUTs already have this
  concept — keep it).
- **Conversion**: `.cube` ↔ the internal grade chain, so an imported LUT can be *inspected* and blended
  with primaries rather than applied opaquely.

The five `BRAND_LUTS` (`none`, `warm-brand`, `cool-tech`, `cinematic`, `vibrant`) become **built-in 3D
LUTs** generated from their three-point definitions, so existing projects and genre templates keep
working unchanged. See [18-BRAND-AND-LUTS](18-BRAND-AND-LUTS.md).

---

## 5. Scopes

### What exists today

The right inspector has a **Scopes** tab (`components/ScopesPanel.tsx`, mounted from `App.tsx`) with
three scope types:

| Scope | Implementation |
|---|---|
| **Histogram** | luma fill + additive R/G/B traces, 256 bins, square-root height scaling |
| **Waveform** | per-column luma distribution into 512 × 256 bins, intensity from sample count |
| **Vectorscope** | 128 × 128 Cb/Cr heat bins with graticule, axes, and the 123° skin-tone line |

The panel is wired to the **actual viewport**, not to synthetic data. `WebGPUCanvas.readPixels()`
copies the current canvas texture to a `MAP_READ` buffer (256-byte-aligned rows), converts BGRA→RGBA
when the swapchain format requires it, and returns `ImageData`. The panel samples at roughly 3.3 Hz
**only while it is open**; closing the tab removes the interval and the GPU→CPU copies stop.

The reduction is currently **CPU-side over the readback**: ~100k pixels per sample after the fixed
stride, so the cost is bounded by canvas size rather than composition resolution. The panel also shows
mean luma, min/max range, mean saturation, and the sample timestamp.

### What the target is

At 4K, ~8M samples per frame makes a CPU reduction wrong. The production design is a `@compute` pass
that reduces the frame to scope buffers, drawn by the same UI:

- **RGB Parade** — three waveforms, one per channel.
- **False colour** — exposure zones as an overlay on the picture.
- **Gamut warning** — out-of-gamut pixels flagged.
- **Graticules** — 0/100 IRE guides and proper vectorscope target boxes for R, G, B, Cy, Mg, Yl.

---

## 6. Colour management

The current pipeline is **display-referred, 8-bit sRGB, non-linear**, with no round trip
([04-RENDERING](04-RENDERING.md#color-management)). The managed pipeline:

```
camera / source ──► [IDT] ──► scene-linear working space ──► [grade] ──► [ODT] ──► delivery
                              (ACES AP0/AP1 or linear-sRGB)
```

| Stage | Options |
|---|---|
| **Input transform (IDT)** | Rec.709, Rec.2020, sRGB, LogC, S-Log3, V-Log, BRAW, ACEScct, linear |
| **Working space** | ACES AP1 (recommended) or linear-sRGB |
| **Grade space** | ACEScct for wheels/curves (log perceptual), linear for math |
| **Output transform (ODT)** | Rec.709 gamma 2.4, sRGB, DCI-P3, Rec.2020, **HDR PQ (ST.2084)**, **HLG** |

Delivered as **WASM colour transforms** (the ACES transforms are a matrix + tone-mapping RRT/ODT pair) so
they run fast in the renderer and stay deterministic between viewport and export. The ODT's tone-mapping
is what produces a correct HDR or P3 delivery rather than a clipped sRGB image.

> **Why WASM here?** The transforms are branch-heavy tone-mapping math, not per-pixel-uniform work; a small
> Rust/C++ colour module compiled to Wasm, called once per frame or pre-baked into a 3D LUT for the GPU, is
> both faster and simpler than reimplementing ACES in WGSL by hand. Baking the full transform to a LUT is
> the performance path.

---

## 7. AI-assisted grading

All local (ONNX / WebGPU inference), never cloud:

| Feature | Method |
|---|---|
| **Shot matching** | analyse a reference frame's colour distribution, solve a grade transform, apply across a scene |
| **Temporal smoothing** | smooth the solved transform over time to avoid flicker between frames |
| **Auto white balance / exposure** | per-shot analysis against a neutral target |
| **Skin-tone protection** | auto-generate a qualifier key for skin and exclude it from aggressive moves |
| **Archive matching** | match old footage's colour/grain/contrast to the modern spine (Documentary — [14](14-GENRE-DOCUMENTARY.md)) |
| **Look suggestion** | propose a grade from a genre + brand, using the `cinematic`/`cool-tech`/`vibrant` primitives as seeds |

Crucially, the AI produces a **grade chain** (a `GradeOp[]`), not a baked image — so a human can inspect,
adjust, and diff it. That is the anti-black-box rule from [00-VISION](00-VISION.md).

---

## Genre ↔ grading posture

Each genre's grade is not just a LUT — it is a *chain*:

| Genre | Grade chain sketch |
|---|---|
| 3D/CGI | neutral primaries → gentle contrast curve → brand LUT @ 0.3 |
| Narrative | film curve → subtle split-tone (cool shadows, warm highlights) → grain |
| Corporate | brand LUT @ full → saturation lift → skin-tone protection |
| Explainer | minimal grade → clarity/sharpen → flat, legible contrast |
| Documentary | archive match → unified curve → grain for cohesion |
| Detective | cold primaries (crushed blue shadows) → high contrast S-curve → desaturate |

---

## Data model additions

```typescript
interface CompositionState {
  // …existing…
  colorSpace: ColorSpaceId;        // working space
  outputTransform: ODTId;          // delivery transform
  grade: GradeOp[];                // the composition grade chain
}
```

`ProjectDocument.version` bumps when this lands; `normalizeProject` gains defaults
([05-PROJECT-FORMAT](05-PROJECT-FORMAT.md#versioning--migration-policy)).

---

## Verification

| Property | Test |
|---|---|
| `.cube` round-trip | parse → sample → compare against a reference implementation |
| Curve monotonicity | no overshoot on monotone splines |
| Viewport == export | frame hash equality at equal resolution/space ([04](04-RENDERING.md)) |
| ODT correctness | known test patches through Rec.709 / P3 / PQ match published values |
| Scope accuracy | synthetic ramps produce the expected waveform shape |

---

Related: [04-RENDERING](04-RENDERING.md) · [18-BRAND-AND-LUTS](18-BRAND-AND-LUTS.md) ·
[22-COMPOSITOR](22-COMPOSITOR.md) · [30-RENDER-QUEUE](30-RENDER-QUEUE.md)
