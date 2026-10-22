# 32 — Keyframe Animation System

**Status: 🟡 (real keyframe engine + 25 easings; editable title channels and keyframe values are live, while general per-clip graph transforms remain planned) · Code: `engine/timeline.ts`, `engine/text.ts`, `engine/easing.ts`, `engine/types.ts`, `engine/nodes.ts`**

> The keyframe system is one of the most real parts of the editor: a pure data model, four timeline
> transforms, easing interpolation, snapping, and a UI with draggable diamonds. This document is the
> complete specification — what exists, what each property means, and the full animation model the
> advanced system targets.

---

## 1. The data model

```typescript
export type KeyframeEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export interface Keyframe {
  id: string;
  time: number;          // seconds on the timeline
  property: string;      // free-form: 'opacity' | 'scale' | 'x' | 'y' | 'rotation' | …
  value: number;         // a single scalar
  easing: KeyframeEasing; // easing FROM this keyframe TO the next
}

export interface TimelineClip {
  id: string;
  trackId: string;
  start: number;
  end: number;
  name: string;
  keyframes: Keyframe[];
  textNodeId?: string;    // graph text node rendered for an editor-authored title
}
```

`Keyframe.property` is a **string**, not a union — the type system accepts any property name. Only
`addKeyframe`'s default (`'opacity'`) hints at intent. `Keyframe.value` is a **single `number`** — no
vectors, no per-axis values. To animate `x` and `y` independently you create two keyframes with
`property: 'x'` and `property: 'y'`.

---

## 2. The transform properties

`TransformState` (in `engine/types.ts`) defines the animatable transform:

```typescript
export interface TransformState {
  x: number;        // px, normalized to [0,1] by resolution in packUniforms
  y: number;        // px, normalized to [0,1]
  scale: number;     // uniform scale factor (1 = 100%)
  rotation: number;  // degrees (converted to radians in packUniforms)
  opacity: number;   // 0–1
}
```

| Property | Keyframeable? | Animated in shader? | Notes |
|---|---|---|---|
| `x` (position X) | ✅ `{property:'x'}` | ✅ `u.translation.x` | normalized by width |
| `y` (position Y) | ✅ `{property:'y'}` | ✅ `u.translation.y` | normalized by height |
| `scale` | ✅ `{property:'scale'}` | ✅ `u.scale` | uniform only |
| `rotation` | ✅ `{property:'rotation'}` | ✅ `u.rotation` | degrees → radians |
| `opacity` | ✅ `{property:'opacity'}` | ✅ `u.opacity` | clamped 0–1 |

**What is NOT in `TransformState` today:** `scaleX`/`scaleY` (per-axis scale), `rotationX`/`Y`/`Z`
(3D rotation), `skew`, `anchorX`/`anchorY` (pivot point), `z`/`depth`. These are compositor features
([22](22-COMPOSITOR.md#transform-stack-25d-not-just-2d)) that the keyframe system will extend to.

---

## 3. The four transforms (pure functions)

All in `engine/timeline.ts`. Every transform is **immutable** — returns a new `TimelineDoc`, never
mutates. This is what makes the system undo-friendly (see [36](36-UNDO-REDO.md)).

### 3.1 `addKeyframe(doc, clipId, time, property, value, easing)`

```typescript
export function addKeyframe(
  doc: TimelineDoc, clipId: string, time: number,
  property = 'opacity', value = 1, easing: KeyframeEasing = 'easeInOut',
): TimelineDoc
```

- **Dedup:** if a keyframe exists within `0.02`s with the same `property`, its value is updated in
  place (id and time preserved) rather than adding a duplicate.
- **Sort:** keyframes are re-sorted by time after every add.
- **Default:** `property='opacity'`, `value=1`, `easing='easeInOut'`.

### 3.2 `removeKeyframe(doc, clipId, kfId)`

Removes the keyframe with the given id. No-op if not found.

### 3.3 `moveKeyframe(doc, clipId, kfId, time)`

Changes a keyframe's time. Re-sorts the array. Does not change value or easing.

### 3.4 `setKeyframeEasing(doc, clipId, kfId, easing)`

Changes the easing of a single keyframe. The easing governs the interpolation **from** this keyframe
**to** the next one.

### 3.5 `setKeyframeValue(doc, clipId, kfId, value)`

Updates one scalar value without changing the keyframe's time or easing. The selected title channel can
be edited in the keyframe inspector; repeated value adjustments merge into one undo step.

---

## 4. Sampling: `sampleKeyframes(keyframes, time, fallback)`

```typescript
export function sampleKeyframes(keyframes: Keyframe[], time: number, fallback = 1): number
```

Algorithm:

1. If `keyframes` is empty → return `fallback`.
2. Clamp: if `time <= keyframes[0].time` → return `keyframes[0].value`.
3. Clamp: if `time >= last.time` → return `last.value`.
4. Otherwise find the pair `(a, b)` where `a.time <= time < b.time`, then:
   ```
   t = (time - a.time) / (b.time - a.time)   // normalized 0–1
   t = ease(t, b.easing)                       // apply the TARGET keyframe's easing
   return a.value + (b.value - a.value) * t
   ```

> **Critical subtlety:** the easing used is the **target** keyframe's (`b.easing`), not the source's.
> This matches the convention in most animation tools (the easing is "arriving at" the keyframe).

`sampleKeyframes` accepts an optional property filter, and `sampleProperty` provides the safe
single-channel path used by title rendering. Callers that omit the filter still sample all keyframes,
so multi-property consumers should use `sampleProperty`.

---

## 5. Easing functions

**25 easings**, all in the single source of truth `engine/easing.ts` — consumed by the timeline sampler
(`sampleKeyframes`), the `EaseNode`, and the WGSL compiler (`EASE_WGSL`), so JS and GPU cannot drift:

| Family | Easings | Character |
|---|---|---|
| Linear | `linear` | constant velocity |
| Quad | `easeIn`, `easeOut`, `easeInOut` | the classic four-quadrant default |
| Sine | `sineIn`, `sineOut`, `sineInOut` | softest start/stop |
| Cubic | `cubicIn`, `cubicOut`, `cubicInOut` | snappier than quad |
| Quart | `quartIn`, `quartOut`, `quartInOut` | hard accel/decel |
| Expo | `expoIn`, `expoOut`, `expoInOut` | near-instant whip |
| Back | `backIn`, `backOut`, `backInOut` | overshoot (c1 = 1.70158) |
| Elastic | `elasticIn`, `elasticOut`, `elasticInOut` | spring oscillation |
| Bounce | `bounceIn`, `bounceOut`, `bounceInOut` | settle with bounces |

```typescript
import { easeValue, EASING_ORDER, EASING_LABELS } from './easing';
easeValue(0.5, 'backOut'); // → overshoot value, same math the GPU runs
```

`KeyframeEasing` (`engine/types.ts`) is the union of these 25 strings. `EASING_ORDER` drives the keyframe
inspector's `<select>` order and `EASING_LABELS` its display names; changing it dispatches a
`Set Keyframe Easing` command through history, so it is undoable.

**Still missing:** `quint`, `circ`, `step`/`hold` (discrete jumps), `spring` (physics-integrated), and
per-segment custom bezier handles — see [40](40-ANIMATION-PRINCIPLES.md#easing-library).

---

## 6. Snapping

```typescript
export const SNAP_THRESHOLD = 0.09;  // seconds

export function snapTime(time: number, targets: number[], threshold = SNAP_THRESHOLD): number
```

- Picks the nearest target within `0.09`s; returns the original time if none is closer.
- Used for clip edges, keyframe placement, and the playhead.
- `snapTargets` in the UI = `[playhead, ...all clip edges]` when snap is enabled.

---

## 7. Clip transforms (the non-keyframe timeline ops)

| Function | Signature | Notes |
|---|---|---|
| `moveClip` | `(doc, id, delta, snapTargets)` | moves both start and end by `delta` |
| `trimClip` | `(doc, id, edge, time, snapTargets)` | trims `start` or `end` to `time` |
| `setClipRange` | `(doc, id, start, end, snapTargets)` | absolute range set |
| `findClip` | `(doc, id)` | lookup |
| `clipsFor` | `(doc, trackId)` | filter by track |

**Minimum clip length:** `0.2` seconds, enforced in `setClipRange` and `trimClip`.

**Missing:** `splitClip` (razor/blade at playhead) — the split button exists in the UI but has no
handler. `duplicateClip`, `rippleEdit`, `nudgeClip` also do not exist. See
[37](37-SELECTION-AND-INTERACTION.md#missing-operations).

---

## 8. Genre keyframe presets

`engine/genre-workflows.ts` defines `KeyframePreset` — a reusable two-keyframe animation:

```typescript
interface KeyframePreset {
  id: string;
  label: string;
  property: string;       // 'opacity' | 'scale'
  easing: KeyframeEasing;
  duration: number;      // seconds
  detail: string;
}
```

Applying a preset adds **two keyframes** to the selected clip: a start keyframe at the playhead and
an end keyframe at `playhead + duration`. The twelve presets across six genres:

| Genre | Presets |
|---|---|
| 3D/CGI | Pass dissolve-in, Virtual camera push, Impact settle |
| Narrative | J-cut audio lead, L-cut audio tail, Performance hold |
| Corporate | Hook punch-in, Pattern interrupt, CTA emphasis |
| Explainer | Kinetic type in, Metaphor morph, Step reveal |
| Documentary | B-roll dissolve, Archive reveal, Juxtaposition beat |
| Detective | Clue linger, Red herring push, Reveal snap |

> **Gap:** presets only cover `opacity` and `scale`. There are no presets for `x`/`y`/`rotation`
> (camera pushes, spins, pans) — the most common motion-design moves.

---

## 9. The UI: keyframe editing

In `App.tsx`:

- **Add:** double-click a clip → `addKeyframe(doc, clipId, playhead)`; or "Add at playhead" button.
- **Remove:** Alt+click a keyframe diamond → `removeKeyframe(doc, clipId, kfId)`.
- **Drag:** `beginKeyframeDrag` → `moveKeyframe(doc, clipId, kfId, t)` with snapping.
- **Inspector:** lists keyframes for the selected clip; click to seek, button to remove.
- **Visuals:** diamonds on the clip lane at each keyframe time.

---

## 10. The advanced keyframe model (target)

The current system is **2D affine, scalar-valued, 25 easings, no graph editor**. The target:

| Dimension | Today | Target |
|---|---|---|
| Properties | `x, y, scale, rotation, opacity` | + `scaleX, scaleY, rotationX/Y/Z, skew, anchorX/Y, z, custom params` |
| Value type | single `number` | `number \| vec2 \| vec3 \| color` |
| Easings | 25 (`engine/easing.ts`, JS + WGSL) | + `quint`, `circ`, `step`, `spring`, per-segment custom bezier |
| Interpolation | per-keyframe easing | per-segment bezier handles, velocity curves, graph editor |
| Sampling | per-property channel available (`sampleKeyframes(property)`) | enforced everywhere, no cross-contamination by default |
| Expressions | none | `value = f(time, otherParams)` — see [39](39-SCRIPTING-AND-EXPRESSIONS.md) |
| Procedural | `StaggerNode`, `OscillatorNode`, `SpringNode` | full procedural motion — see [40](40-ANIMATION-PRINCIPLES.md) |

### The graph editor (target)

A bezier-curve editor (like After Effects' Graph Editor) where:

- X axis = time, Y axis = property value.
- Each segment has adjustable bezier handles (speed curve or value curve mode).
- Velocity is visualized, editable, and preserved when scaling keyframe times.
- `Easy Ease` (F9) applies a smooth auto-bezier; `Easy Ease In`/`Out` apply to one side.

### The easing library (target)

| Category | Easings |
|---|---|
| Polynomial | `quad`, `cubic`, `quart`, `quint` (in/out/inOut) |
| Trigonometric | `sine`, `circ` |
| Exponential | `expo`, `back` (overshoot) |
| Elastic | `elastic` (spring physics) |
| Bounce | `bounce` |
| Custom | user-defined bezier handles |

---

## 11. Verification

| Property | Test |
|---|---|
| Add/remove round-trip | add then remove returns the original doc |
| Dedup | two adds within 0.02s produce one keyframe |
| Sort order | keyframes are always sorted by time after any op |
| Sampling clamp | before first / after last returns boundary values |
| Sampling interpolation | midpoint of two linear keyframes = mean of values |
| Sampling easing | easeOut midpoint < 0.5 (decelerates) |
| Immutability | transforms do not mutate the input doc |
| Snapping | within threshold snaps, outside returns original |
| Min clip length | setClipRange rejects ranges < 0.2s |

---

Related: [06-TIMELINE](06-TIMELINE.md) · [22-COMPOSITOR](22-COMPOSITOR.md) · [40-ANIMATION-PRINCIPLES](40-ANIMATION-PRINCIPLES.md) ·
[39-SCRIPTING-AND-EXPRESSIONS](39-SCRIPTING-AND-EXPRESSIONS.md) · [36-UNDO-REDO](36-UNDO-REDO.md)
