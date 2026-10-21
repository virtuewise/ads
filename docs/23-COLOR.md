# 23 — Color: Grading Engine, LUTs, Scopes & Color Management

**Status: 🟡 (a perceptual grade, a filmic tone map, a three-scope panel and automatic shot matching are real; primaries, curves, qualifiers and 3D LUTs are ⬜) · Code: `engine/colour.ts`, `engine/balance.ts`, `engine/nodes.ts`, `components/ScopesPanel.tsx` (today) → `engine/color/*` (target)**

> Today "color" is a **three-point luminance gradient** driven by five hardcoded brand LUTs
> (`BRAND_LUTS`, applied in `COMPOSITE_SHADER` and in the DAG bridge), plus a **viewport-sampled
> scopes panel**. On top of that there is now a **perceptual grade** (`oklabGrade`), a **filmic tone
> map** (`toneMap`) and **automatic shot matching**. This document specifies a **full grading
> engine**: primaries, curves, qualifiers, 3D LUTs, GPU-reduced scopes, and a colour-managed pipeline
> from camera to delivery.

---

## The perceptual grade — `oklabGrade`

The grade is done in **Oklab**, a perceptually uniform space, rather than in gamma-encoded RGB.

Why it matters: in sRGB, a saturation change also moves the picture's lightness, and a hue rotation
brightens some colours while darkening others. Those crosstalk terms are what make a gamma-space
grade feel like a filter. In Oklab they are gone, so a grade does what it says.

The node takes display-referred sRGB in and gives display-referred sRGB back, so it sits anywhere in
a graph:

```wgsl
fn oklab_grade(color: vec4<f32>, exposure: f32, contrast: f32,
               saturation: f32, hue: f32) -> vec4<f32> {
  let linear = srgb_to_linear(color.rgb) * pow(2.0, exposure);
  var lab = linear_srgb_to_oklab(linear);
  let pivot = 0.5;
  lab.x = (lab.x - pivot) * contrast + pivot;   // contrast around middle grey
  let ca = lab.y * saturation;                    // saturation scales the chroma
  let cb = lab.z * saturation;
  let angle = hue * 0.0174532925;                // hue rotates it
  lab.y = ca * cos(angle) - cb * sin(angle);
  lab.z = ca * sin(angle) + cb * cos(angle);
  return vec4<f32>(linear_to_srgb(oklab_to_linear_srgb(lab)), color.a);
}
```

The same maths exists in TypeScript (`engine/colour.ts`), because the editor *measures* in it while
the shader *grades* in it. `engine/colour.test.ts` pins the two together.

> **Known limitation.** The grade node is display-referred: it converts to linear, grades, and
> converts back. A scene-referred working space — where the graph itself is linear and the tone map
> happens once at the output — is the correct broadcast pipeline, and is the next step.

---

## The tone map — `toneMap`

A film's highlights roll off; they do not clip to white. The node applies the **ACES** fit (Stephen
Hill) or a Reinhard curve, with the mode chosen by a number:

```wgsl
fn tone_map(color: vec4<f32>, mode: f32) -> vec4<f32> {
  let linear = srgb_to_linear(color.rgb);
  var mapped = linear;
  if (mode < 0.5) { mapped = aces_filmic(linear); }
  else if (mode < 1.5) { mapped = reinhard_extended(linear, 4.0); }
  else { mapped = linear; }
  return vec4<f32>(linear_to_srgb(mapped), color.a);
}
```

---

## Automatic shot matching — `engine/balance.ts`

Every shot is lit slightly differently. A colourist fixes that by measuring one shot and grading the
next to match. It is the most valuable half of a grade and the most tedious.

The editor does it automatically: when the playhead enters a shot, the frame is **measured** and the
difference from a reference shot becomes that shot's grade. The measurement is the colourist's, not
the engineer's:

| Measure | What it is | Why |
|---|---|---|
| **midtone** | the median linear luminance | a frame with one small bright highlight has a useless mean and a perfectly good median |
| **spread** | the 10th-to-90th percentile spread of log luminance | this is contrast, measured the way a waveform monitor shows it |
| **chroma** | the mean colourfulness in Oklab's a/b axes | for matching saturation between shots |

The reference is the **first shot of the current timeline**. A clip from a previous document is never
a reference — it is a different piece of film.

A frame with no light in it is refused rather than used: such a readback was taken before the
picture was on screen, and grading against it would push the whole film up by several stops.

The corrections land in a colourist's range — a fraction of a stop and a few per cent of contrast —
and the clip's label shows what was applied:

```
SOLUTION · 6.00s–9.60s · +0.29 EV · 1.13×
```

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

On top of it, the graph can carry the perceptual grade, the tone map, and the shot matching above.

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
| sRGB ↔ linear round-trips | ✅ `engine/colour.test.ts` |
| Oklab ↔ linear sRGB round-trips | ✅ `engine/colour.test.ts` |
| A neutral grade changes nothing | ✅ `engine/colour.test.ts` |
| A saturation change does not move the lightness | ✅ `engine/colour.test.ts` |
| A hue rotation does not change the colourfulness | ✅ `engine/colour.test.ts` |
| The tone map rolls highlights off rather than clipping | ✅ `engine/colour.test.ts` |
| A shot's grade is the colourist's: midtone in stops | ✅ `engine/colour.test.ts` |
| A black frame is refused as a reference | ✅ `engine/colour.test.ts` |
| The grade and the shader agree | ✅ both are pinned to the same matrices, and the shader compiles on the GPU |
| A measured shot is matched to the reference | ✅ verified in the running app: the shots of a production differ by 0.08–0.29 EV |

Still to come:

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
