# 24 — Transitions: A Real Transition Engine

**Status: ⬜ (no transition engine exists; the transitions lane is empty by default) · Code (target): `engine/transitions.ts`, `engine/shaders/transitions/*.wgsl`**

> Today the timeline has a **Transitions track** (`TRACKS` in `engine/timeline.ts`) but no transition
> engine behind it. New timelines are empty: there is no way to place, tune, or render a transition. This
> document specifies the engine.

---

## The gap, precisely

`engine/timeline.ts` defines the `transitions` track with icon `shuffle` and colour `#f472b6`. No
transition clips are seeded. A transition implementation still needs:

- No link to the two clips it joins.
- No transition type beyond its name.
- No duration/easing/parameters model.
- No rendering path — the compositor cannot blend two layers ([22](22-COMPOSITOR.md)).

So "transitions" is currently a **label on a rectangle**.

---

## The model

A transition is a **first-class object** joining two adjacent clips.

```typescript
interface Transition {
  id: string;
  type: TransitionType;
  /** The outgoing clip (A) and incoming clip (B). */
  fromClipId: string;
  toClipId: string;
  /** Duration in seconds. Overlap = duration; the clips' own ranges are unchanged. */
  duration: number;
  easing: KeyframeEasing;          // reuse the timeline easing model
  /** Type-specific parameters. */
  params: Record<string, number | string | boolean>;
  /** Optional custom WGSL, for a Script transition (see Script-node pattern). */
  customShader?: string;
}

type TransitionType =
  // Dissolves
  | 'dissolve' | 'dip-to-color' | 'dip-to-black' | 'dip-to-white'
  // Wipes
  | 'wipe-linear' | 'wipe-radial' | 'wipe-clock' | 'wipe-matte' | 'wipe-shape'
  // Moves
  | 'slide' | 'push' | 'zoom' | 'spin' | 'whip-pan' | 'fly-in'
  // Light / stylised
  | 'flash' | 'luma-wipe' | 'glitch' | 'datamosh' | 'film-burn'
  // Generative / flow
  | 'morph' | 'warp' | 'optical-flow' | 'particle-dissolve';
```

Transitions live on the Transitions track and **overlap** the two clips: rendering the transition means
compositing A and B with the transition shader during the overlap window.

---

## Rendering: WGSL transitions driven by progress

Every built-in transition is a **fragment shader** with a shared signature:

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

Because transitions are WGSL and the compositor runs the same shader in viewport and export
([04-RENDERING](04-RENDERING.md)), **the transition renders identically in preview and deliverable** —
including the `p` value, which is derived from the *eased* timeline time, not the wall clock.

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

- **Create**: drop a transition onto the Transitions track at a clip junction, or select two adjacent
  clips → "Apply Transition".
- **Trim**: drag the transition's edges (reuses `trimClip` semantics — [06](06-TIMELINE.md)).
- **Tune**: a transition inspector with type picker, duration, easing, and type-specific params (angle,
  softness, colour, flow amount).
- **Preview**: the viewport shows the transition live because it *is* the render.
- **Align**: snapping already applies; a "centre on cut" action is a convenience.

---

## Verification

| Property | Test |
|---|---|
| `p` derivation | eased progress matches `sampleKeyframes` easing exactly |
| Endpoint exactness | at `p=0` the output is byte-identical to A; at `p=1` to B |
| Viewport == export | frame hashes match mid-transition ([04](04-RENDERING.md)) |
| Flow determinism | identical flow field for identical inputs across runs |

---

Related: [06-TIMELINE](06-TIMELINE.md) · [22-COMPOSITOR](22-COMPOSITOR.md) · [23-COLOR](23-COLOR.md) ·
[27-EFFECTS-LIBRARY](27-EFFECTS-LIBRARY.md) · [28-PRESETS](28-PRESETS.md)
