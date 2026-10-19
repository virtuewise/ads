# 22 — The Compositor: Layers, Masks, Blends & 3D

**Status: ⬜ (designed; today one flat shader) · Code (target): `engine/compositor.ts`, `engine/layer.ts`, `engine/shaders/*.wgsl`**

> Today the compositor is a **single flat pass**: one procedural scene, one transform, one LUT
> (`COMPOSITE_SHADER` in `engine/visual.ts`). This document specifies the **real compositor** — a layered,
> masked, blended, optionally 3D compositing model — that everything else in the advanced plan builds on.

---

## Why this is first

Every advanced feature is a compositor feature in disguise:

- Transitions ([24](24-TRANSITIONS.md)) are two layers blended over time.
- Grades ([23](23-COLOR.md)) are adjustment layers.
- Effect nodes ([27](27-EFFECTS-LIBRARY.md)) act on layers.
- Captions ([26](26-CAPTIONS.md)) are text layers.
- Media ([29](29-MEDIA-PIPELINE.md)) is the compositor's input.

The current shader has **no concept of a layer**. Nothing advanced can land until it does.

---

## The layer model

A composition is an **ordered stack of layers**. Each layer is a node in the [DAG](03-ENGINE-CORE.md) with
a transform stack and a source.

```typescript
type LayerKind =
  | 'media'      // a decoded frame from the media pipeline
  | 'text'       // typography, with a full text model
  | 'shape'      // vector shape (rect/ellipse/star/path)
  | 'solid'      // solid color
  | 'adjustment' // applies to everything below it
  | 'null'       // transform-only parent
  | 'camera'     // 3D view (requires 3D layers)
  | 'precomp';   // a nested composition

interface Layer {
  id: string;
  name: string;
  kind: LayerKind;
  enabled: boolean;
  /** Draw order, bottom → top. `null` = parent for transform inheritance. */
  parentId: string | null;
  transform: TransformStack;
  opacity: number;
  blendMode: BlendMode;
  /** Masks applied in layer space, then composited. */
  masks: Mask[];
  /** Track matte: this layer is masked by another layer's alpha/luma. */
  trackMatte?: { layerId: string; mode: 'alpha' | 'alpha-inverted' | 'luma' | 'luma-inverted' };
  /** Effects stack, evaluated top-down. */
  effects: EffectRef[];
  /** Per-layer motion blur (shutter angle in degrees). */
  motionBlur?: number;
  /** 3D placement; absent = 2D layer. */
  threeD?: Layer3D;
}
```

---

## Transform stack (2.5D, not just 2D)

The current `TransformState` is `{x, y, scale, rotation, opacity}` — a single 2D affine transform. The real
stack is an **ordered chain** where each element is keyframeable:

| Transform element | Parameters |
|---|---|
| Anchor point | `x, y, z` |
| Position | `x, y, z` |
| Scale | `x, y` (uniform + per-axis) |
| Rotation | `z` (2D) or `x, y, z` (3D) |
| Skew | `x, y` |
| Opacity | `0–1` |
| **Separate dimensions** | enable per-axis scale/rotation keyframing |

Transform inheritance: `world = parent.world × layer.local`. A `null` layer is the classic "parent a set of
layers to one controller" idiom.

---

## Masks

```typescript
interface Mask {
  id: string;
  mode: 'add' | 'subtract' | 'intersect' | 'lighten' | 'darken' | 'difference';
  inverted: boolean;
  /** Bezier path in layer space; keyframeable over time. */
  path: MaskPath;
  feather: number;    // px
  opacity: number;    // 0–1
  expansion: number;  // px
}
```

Implementation: masks compile to a **signed-distance / coverage texture** in a WGSL compute pass, then
multiply into the layer's alpha. Multiple masks combine per their `mode`. Feather = distance-based falloff
(cheap) or a real blur of the coverage texture (quality).

### Auto-rotoscope (AI assist)

A subject-segmentation pass (ONNX, local — see [29](29-MEDIA-PIPELINE.md)) produces a per-frame matte;
the mask UI shows it as an editable starting point. The matte is **not** a black box: it becomes a real
`Mask` whose `path` is **keyframed from the segmentation**, so the artist can fix it frame by frame.

### Track mattes

Alpha and luma mattes, inverted variants, using **another layer's** output as the mask. This is the
standard compositing idiom for text-filled-with-footage, shape wipes, and displacement.

---

## Blend modes

The compositor implements the full Photoshop-class set in WGSL, plus the Porter-Duff alpha operators.

### Separable blend modes

`normal` · `multiply` · `screen` · `overlay` · `darken` · `lighten` · `color-dodge` · `color-burn` ·
`hard-light` · `soft-light` · `difference` · `exclusion`

### Non-separable (HSL) blend modes

`hue` · `saturation` · `color` · `luminosity`

All operate on **non-premultiplied** color and composite with premultiplied alpha at the end:

```wgsl
fn blend_mode(a: vec3<f32>, b: vec3<f32>, mode: u32) -> vec3<f32> { /* … */ }

fn composite(src: vec4<f32>, dst: vec4<f32>, mode: u32, opacity: f32) -> vec4<f32> {
  let cs = blend_mode(dst.rgb, src.rgb, mode);          // non-premultiplied blend
  let a  = src.a * opacity;
  return vec4(mix(dst.rgb, cs, a), dst.a + a * (1.0 - dst.a));  // source-over
}
```

> **Correctness note:** the existing `BlendNode` does `mix(a, b, opacity)` — a linear interpolate, which
> is *not* a blend mode. This document supersedes it; [27](27-EFFECTS-LIBRARY.md) replaces the node.

---

## 3D layers, camera & lights

2.5D (position/scale/rotation keys) is table stakes. The real compositor supports true 3D:

- **3D transform**: position/rotation/orientation in world space, with a 4×4 matrix per layer.
- **Camera layer**: focal length (mm), field of view, depth of field (`focalDistance`, `aperture`,
  `bladeCount`, `bladeRotation`), near/far planes.
- **Lights**: point, spot, directional, ambient — WGSL shading for 3D layers (per-layer material).
- **Depth of field**: needs a depth buffer; the render pass writes depth for 3D layers, so DOF is a
  post-pass using depth + a bokeh kernel (see [27](27-EFFECTS-LIBRARY.md#blur-family)).
- **Fog / atmosphere**: depth-driven exponential fog.

> Lighting 3D layers in the compositor is deliberately scoped to **simple, fast materials** (diffuse,
> specular, emissive, matte). Heavy CG is imported as multi-pass renders (the 3D/CGI genre —
> [10](10-GENRE-3D-ANIMATION.md)); the compositor's job is to composite them, not to replace a DCC.

---

## Motion blur

Per-layer **shutter angle**. Implementation: render N sub-samples across the shutter interval and average
(accumulation buffer), or use a velocity-buffer approach for cheaper directional blur. The accumulation
path is exact and matches offline renderers; the velocity path is the interactive preview.

---

## Nested compositions (pre-comps)

A `precomp` layer renders a child `Composition` to a texture, then composites it like any layer. This gives:

- Reusable scene containers.
- Correct transform inheritance for groups.
- The ability to grade/time-remap a whole sequence as one unit.

Pre-comps are the **only sane way** to keep large projects composable, and they map directly onto DAG
sub-graphs ([03](03-ENGINE-CORE.md)).

---

## The render graph replaces the flat shader

```
layers (bottom → top)
   │
   ├─ layer 1 ─► [mask pass] ─► [effect chain] ─► [blend] ─┐
   ├─ layer 2 ─► [mask pass] ─► [effect chain] ─► [blend] ─┼─► comp texture
   ├─ adjustment ────────────────────[applies to below]────┤
   └─ layer N ─► [mask pass] ─► [effect chain] ─► [blend] ─┘
                                                           │
                                                    [output transform]
                                                           │
                                              viewport text    export text
```

This graph **is** the [DAG](03-ENGINE-CORE.md). Unifying them is Phase 0.1 of the plan — the single most
important architectural change, because it makes the node editor control the actual composite.

---

## Performance & VRAM

A layered compositor is VRAM-hungry. The rules:

1. **Texture pooling** — never allocate a texture per frame; reuse from a sized pool.
2. **Mip pyramids** for blur/glow (see [27](27-EFFECTS-LIBRARY.md)) instead of wide kernels.
3. **Half-resolution intermediates** for effects that tolerate it (blur, glow, DOF), full-res for the
   final blend.
4. **VRAM budget manager** — track allocated textures, evict caches, and degrade gracefully (drop the
   preview to a lower resolution) rather than crashing.
5. **Compute where it helps** — masks, histogram, optical flow, and blur pyramids as `@compute` passes.

See [04-RENDERING](04-RENDERING.md#hardware--resource-management) for the current resource story and
[30-RENDER-QUEUE](30-RENDER-QUEUE.md) for the export-time budget.

---

## Where this fits

| Depends on | Enables |
|---|---|
| Media import ([29](29-MEDIA-PIPELINE.md)) for `media` layers | Transitions ([24](24-TRANSITIONS.md)) |
| DAG⟶composite unification ([03](03-ENGINE-CORE.md)) | Grades as layers ([23](23-COLOR.md)) |
| Keyframe model ([06](06-TIMELINE.md)) | Effect chains ([27](27-EFFECTS-LIBRARY.md)) |
| — | Captions/titles ([26](26-CAPTIONS.md)) |

---

Related: [03-ENGINE-CORE](03-ENGINE-CORE.md) · [04-RENDERING](04-RENDERING.md) ·
[24-TRANSITIONS](24-TRANSITIONS.md) · [27-EFFECTS-LIBRARY](27-EFFECTS-LIBRARY.md) ·
[29-MEDIA-PIPELINE](29-MEDIA-PIPELINE.md)
