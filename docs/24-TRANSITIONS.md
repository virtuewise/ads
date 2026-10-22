# 24 — Transitions: A Real Transition Engine

**Status: 🟡 (dip-to-color transitions run in preview and export; two-input transitions remain planned) · Code: `engine/transitions.ts`, `engine/timeline.ts`, `components/WebGPUCanvas.tsx`, `engine/renderFrame.ts`**

> The timeline can now create, edit, preview, save, and export dip-to-black, dip-to-white, and
> dip-to-custom-color transitions at an adjacent video cut. The larger transition engine in this
> document remains a plan: dissolves, wipes, motion transitions, and optical-flow transitions need
> two-input compositing and/or additional render passes.

---

## The gap, precisely

`engine/timeline.ts` defines the `transitions` track with icon `shuffle` and colour `#f472b6`. A user
selects a video clip and adds a dip transition at its nearest adjacent cut. Current behavior:

- The transition clip links `fromClipId` and `toClipId`, and stays centered on that cut while it exists.
- The inspector exposes dip style, custom color, duration, and the shared easing library.
- The viewport paints the time-evaluated color overlay above the WebGPU canvas.
- Export composites the same overlay into each RGBA frame before encoding.
- Deleting or separating the linked clips removes the transition rather than leaving a broken effect.

The current transition uses one selected video frame at a time and fades through a solid color. It is not
a cross-dissolve and does not composite two clips simultaneously.

---

## The model

A transition is a **first-class object** joining two adjacent clips.

```typescript
interface TransitionDefinition {
  type: 'dip-black' | 'dip-white' | 'dip-color';
  fromClipId: string;
  toClipId: string;
  color: string;
  easing: KeyframeEasing;
}

type TransitionType =
  // Dissolves
  | 'dissolve' | 'dip-color' | 'dip-black' | 'dip-white'
  // Wipes
  | 'wipe-linear' | 'wipe-radial' | 'wipe-clock' | 'wipe-matte' | 'wipe-shape'
  // Moves
  | 'slide' | 'push' | 'zoom' | 'spin' | 'whip-pan' | 'fly-in'
  // Light / stylised
  | 'flash' | 'luma-wipe' | 'glitch' | 'datamosh' | 'film-burn'
  // Generative / flow
  | 'morph' | 'warp' | 'optical-flow' | 'particle-dissolve';
```

The transition is a clip on the Transitions track. Its `start` and `end` bound its duration, while its
definition references the adjacent video clips. The current implementation centers the dip on their
cut. Adding overlap or a gap removes the transition until the shots are adjacent again.

---

## Future rendering: two-input WGSL transitions

The current dip effect is a solid-color overlay. Cross-dissolves and wipes will need both source frames
and a shared fragment transition in the compositor. The planned WGSL signature is:

```wgsl
// Renders A→B at progress p ∈ [0,1].
fn transition(
  uv: vec2<f32>,
  a: vec4<f32>,          // outgoing frame (sampled)
  b: vec4<f32>,          // incoming frame (sampled)
  p: f32,                // eased progress
  params: vec4<f32>,     // four generic floats, meaning is per-type
) -> vec4<f32>;
```

The time-derived progress must be deterministic. The target remains pixel parity between the viewport
and export ([04-RENDERING](04-RENDERING.md)); the shipped dip currently uses matching timing and color
math in both paths, with CSS canvas overlay in preview and RGBA blending in export.

### Worked examples

**Cross dissolve** — trivial, but it establishes the pattern:

```wgsl
fn transition(uv: vec2<f32>, a: vec4<f32>, b: vec4<f32>, p: f32, params: vec4<f32>) -> vec4<f32> {
  return mix(a, b, p);
}
```

**Linear wipe** — `params.x` = angle, `params.y` = softness:

```wgsl
fn transition(uv: vec2<f32>, a: vec4<f32>, b: vec4<f32>, p: f32, params: vec4<f32>) -> vec4<f32> {
  let ang = params.x;
  let soft = max(params.y, 0.001);
  let dir = vec2(cos(ang), sin(ang));
  let d = dot(uv - vec2(0.5), dir) + 0.5;
  return mix(a, b, smoothstep(p - soft, p + soft, d));
}
```

**Dip to colour** — `params.rgb` = the dip colour:

```wgsl
fn transition(uv: vec2<f32>, a: vec4<f32>, b: vec4<f32>, p: f32, params: vec4<f32>) -> vec4<f32> {
  let dip = vec3(params.x, params.y, params.z);
  // First half fades A → dip, second half dip → B.
  let first  = mix(a.rgb, dip, smoothstep(0.0, 0.5, p));
  let second = mix(dip,   b.rgb, smoothstep(0.5, 1.0, p));
  return vec4(mix(first, second, step(0.5, p)), mix(a.a, b.a, p));
}
```

**Luma wipe** — uses a luma matte texture instead of geometry (the pro idiom for organic wipes):

```wgsl
@group(1) @binding(0) var lumaMatte: texture_2d<f32>;
@group(1) @binding(1) var matteSampler: sampler;

fn transition(uv: vec2<f32>, a: vec4<f32>, b: vec4<f32>, p: f32, params: vec4<f32>) -> vec4<f32> {
  let m = textureSample(lumaMatte, matteSampler, uv).r;
  return mix(a, b, smoothstep(p - params.x, p + params.x, m));
}
```

---

## Optical-flow and morph transitions

The futuristic tier. `morph` and `optical-flow` transitions need **motion between A and B**:

1. A **`@compute` pass** estimates a dense optical-flow field from A to B (block-matching or a small
   learned flow model via ONNX — [29](29-MEDIA-PIPELINE.md)).
2. The warp transition advects A's pixels along the field, blending toward B:

```wgsl
@group(1) @binding(0) var flow: texture_2d<f32>;   // RG = flow vector

fn transition(uv: vec2<f32>, a: vec4<f32>, b: vec4<f32>, p: f32, params: vec4<f32>) -> vec4<f32> {
  let f = textureSample(flow, matteSampler, uv).rg * params.x;
  let warped = textureSample(texA, samp, uv - f * p);
  let warpedB = textureSample(texB, samp, uv + f * (1.0 - p));
  return mix(warped, warpedB, p);
}
```

This same flow field powers **retiming** ([06](06-TIMELINE.md)) and **frame interpolation** — compute it
once, reuse it for transitions, slow-mo, and frame-rate conversion. That reuse is the reason to build flow
once, early.

---

## Transition presets

Presets ([28](28-PRESETS.md)) wrap a transition + tuned params:

| Preset | Transition | Params |
|---|---|---|
| Soft Cut | dip-to-black | 12 frames, easeInOut |
| Brand Wipe | wipe-linear | angle 90°, softness 0.02 |
| Whip Cut | whip-pan | 8 frames, heavy blur |
| Glitch Cut | glitch | 6 frames, RGB split 0.4 |
| Memory Wipe | luma-wipe | soft, organic matte |
| Scene Morph | optical-flow | 24 frames, flow-heavy |

---

## Genre ↔ transition posture

The genre profiles ([09](09-GENRE-SYSTEM.md)) never auto-cut Narrative/Detective; transitions follow the
same logic:

| Genre | Typical transitions | Why |
|---|---|---|
| 3D/CGI | hard cuts, `morph`, `particle-dissolve` | pass reveals are structural |
| Narrative | mostly **hard cuts**; `dip-to-black` for scene breaks | invisible continuity |
| Corporate | `whip-pan`, `glitch`, `zoom` | energy, retention |
| Explainer | `wipe-linear`, `dissolve` | clarity, no confusion |
| Documentary | `dissolve`, `luma-wipe` | natural, unshowy |
| Detective | hard cuts, `dip-to-black`, `flash` | tension, misdirection |

---

## Interaction surface

- **Create**: select a video clip and choose **Add dip transition** beside a cut.
- **Tune**: the inspector edits dip style, custom color, duration, and easing.
- **Preview/export**: preview and exported frames share the same time-evaluated dip overlay.
- **Planned**: drag/drop transition catalog, two-input dissolves and wipes, type-specific shader controls,
  and transitions across overlapping clips.

---

## Verification

| Property | Test |
|---|---|
| Eased progress | transition peak follows the shared easing curves |
| Color and duration | custom dip color and duration stay in the project and match at the cut |
| Viewport/export overlay | both use the same color, easing, and playhead time |
| Linked-cut cleanup | deleting, splitting, or separating source clips removes the invalid transition |
| Flow determinism | identical flow field for identical inputs across runs |

---

Related: [06-TIMELINE](06-TIMELINE.md) · [22-COMPOSITOR](22-COMPOSITOR.md) · [23-COLOR](23-COLOR.md) ·
[27-EFFECTS-LIBRARY](27-EFFECTS-LIBRARY.md) · [28-PRESETS](28-PRESETS.md)
