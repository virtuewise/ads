# 06 — Timeline: Tracks, Clips, Keyframes & Snapping

**Status: ✅ (model + interactions real; clips can show imported footage) · Code: `engine/timeline.ts`, `App.tsx`**

> The timeline is a **pure data model** (`TimelineDoc`) plus a set of immutable transforms. Every
> editing gesture — drag, trim, add a keyframe diamond, move one, remove one — is a function that
> returns a new `TimelineDoc`. The UI never mutates the model in place. This keeps React state updates
> clean and makes undo, agent edits, and diffing trivial.

---

## The model

```typescript
interface TimelineDoc {
  duration: number;         // seconds
  clips: TimelineClip[];
}

interface TimelineClip {
  id: string;
  trackId: string;          // one of the five track ids
  start: number;            // seconds
  end: number;              // seconds
  name: string;
  keyframes: Keyframe[];
  mediaId?: string;         // the imported source this clip shows
  sourceStart?: number;     // in-point within that source, in seconds
  /**
   * The look for this clip: the parameters of each node kind, keyed by kind.
   *
   * A film's shots share one graph and each clip switches its effects on or
   * off, so the viewport shows a different look at every shot.
   */
  look?: Record<string, Record<string, unknown>>;
}

interface Keyframe {
  id: string;
  time: number;             // seconds, within the clip
  property: string;         // e.g. 'opacity' | 'scale'
  value: number;
  easing: KeyframeEasing;   // the 25-easing library (engine/easing.ts)
}
```

### Footage-backed clips

A clip with a `mediaId` shows imported footage. Adding one is `addMediaClip()`; the media bin's
**+** button puts the selected clip on the timeline at the playhead, and the clip renders a poster
frame taken from its source.

The compositor picks the frame by time, not by clip: for the topmost media clip under the playhead,
the source time is `playhead − clip.start + clip.sourceStart`
([29-MEDIA-PIPELINE](29-MEDIA-PIPELINE.md)). Scrubbing the timeline therefore scrubs the footage.

Both fields survive a save/load round-trip — `normalizeProject` keeps them, and does not invent a
`mediaId` for clips that never had one.

---

## The five tracks

`TRACKS: TrackMeta[]` — the fixed spine of every composition:

| id | name | icon | color | Purpose |
|---|---|---|---|---|
| `video` | Video | `film` | `#ff5a2c` | Picture (comps, b-roll) |
| `audio` | Audio | `music` | `#5eead4` | Score, dialogue, VO |
| `captions` | Captions | `captions` | `#ffb347` | Titles, lower-thirds, burned captions |
| `effects` | Effects | `wand` | `#a78bfa` | Effect spans |
| `transitions` | Transitions | `shuffle` | `#f472b6` | Cross-dissolves, wipes |

`clipsFor(doc, trackId)` returns a track's clips **sorted by start time** — the row order the UI draws.

---

## Starting a composition

`createEmptyTimeline(duration)` creates a clean timeline with no invented footage, audio, captions,
effects, or transitions. Imported media adds real video clips; the Text tool and title presets create
caption-track clips bound to graph-backed title nodes. The audio and transitions lanes remain available
for future implementations but are empty until those systems can create renderable objects.

---

## Snapping

```typescript
SNAP_THRESHOLD = 0.09          // seconds
snapTime(time, targets, threshold?) -> number
```

`snapTime` returns the nearest target within the threshold, else the original time. Targets are typically
playhead position plus every neighbouring clip's `start`/`end`. The UI computes the target list and
passes it into the transforms — the model stays pure and testable.

---

## The transforms

All return a new `TimelineDoc`. The constant `min = 0.2s` is the minimum clip length everywhere.

| Function | Signature | Behaviour |
|---|---|---|
| `setClipRange` | `(doc, id, start, end, snapTargets?)` | Sets absolute range; clamps to `[0, duration]`; snaps both edges; enforces min length |
| `moveClip` | `(doc, id, delta, snapTargets?)` | Moves by `delta` preserving length; clamps and snaps the start |
| `trimClip` | `(doc, id, edge, time, snapTargets?)` | Trims `start` or `end` to an absolute time; enforces min length |
| `addKeyframe` | `(doc, clipId, time, property='opacity', value=1, easing='easeInOut')` | Adds a diamond, clamped to the clip; **dedupes** within 0.02s on the same property |
| `removeKeyframe` | `(doc, clipId, kfId)` | Deletes a keyframe |
| `moveKeyframe` | `(doc, clipId, kfId, time)` | Repositions a diamond, clamped to the clip, then re-sorts |
| `setKeyframeEasing` | `(doc, clipId, kfId, easing)` | Changes a diamond's easing |
| `findClip` | `(doc, id)` | Lookup |

### Immutability pattern

Every transform follows the same shape:

```typescript
return { ...doc, clips: doc.clips.map(c => c.id === id ? { ...c, /* change */ } : c) };
```

This is what makes the timeline **undo-friendly** and **agent-safe**: an edit is a value, not a
mutation.

---

## Keyframe sampling

```typescript
sampleKeyframes(keyframes, time, fallback = 1) -> number
```

- No keyframes → `fallback`.
- Before the first → first value. After the last → last value.
- Between two keyframes → interpolate with the **destination** keyframe's easing.

### The easing curves

The `ease()` helper (private) implements all four:

| Easing | Curve |
|---|---|
| `linear` | `t` |
| `easeIn` | `t²` |
| `easeOut` | `1 − (1−t)²` |
| `easeInOut` | `t < 0.5 ? 2t² : 1 − 2(1−t)²` |

These match the mono-graph `EaseNode` semantics in [03-ENGINE-CORE](03-ENGINE-CORE.md), so a timeline
keyframe and a graph ease node describe the same motion.

---

## How the timeline drives the render

```
playhead time  +  clip keyframes
        │
        ▼
sampleKeyframes(…)  ──►  property values (opacity, scale, …)
        │
        ▼
composition transform  ──►  packUniforms  ──►  compose frame
```

Today the viewport is driven by the **composition transform** and the **playhead time**. Wiring
per-clip keyframes to drive the composition transform for the active clip is the interaction-depth
milestone that closes the loop between the timeline and the canvas. See [16-INTERFACE](16-INTERFACE.md)
and [21-ROADMAP](21-ROADMAP.md).

---

## Genre keyframe presets

Each genre ships **keyframe presets** — named moves with a property, easing, duration, and rationale —
that the `GenrePanel` can apply. Examples (full data in [09-GENRE-SYSTEM](09-GENRE-SYSTEM.md)):

| Genre | Preset | Property | Easing |
|---|---|---|---|
| Corporate | Hook punch-in | `scale` | `easeOut` |
| Narrative | J-cut audio lead | `opacity` | `linear` |
| Detective | Reveal snap | `opacity` | `easeOut` |
| Explainer | Kinetic type in | `opacity` | `easeOut` |
| Documentary | B-roll dissolve | `opacity` | `easeInOut` |
| 3D/CGI | Impact settle | `scale` | `easeOut` |

Applying a template lays these out as clip keyframes via `addKeyframe`.

---

## Interaction surface (UI)

The gestures the model backs, all wired in `App.tsx`:

| Gesture | Model call |
|---|---|
| Drag a clip body | `moveClip` (with live snap targets) |
| Drag a clip edge | `trimClip` |
| Click a track lane | `addKeyframe` (at the playhead) |
| Drag a diamond | `moveKeyframe` |
| Right-click / delete a diamond | `removeKeyframe` |
| Change easing | `setKeyframeEasing` |

Snapping feedback, selection, and hover states are UI concerns in [16-INTERFACE](16-INTERFACE.md).

---

## Why pure transforms matter

1. **Undo/redo** — keep a stack of `TimelineDoc` values.
2. **Agent edits** — an agent produces a new `TimelineDoc`; the app renders it.
3. **Diffing** — two `TimelineDoc`s diff line by line inside the project JSON ([05](05-PROJECT-FORMAT.md)).
4. **Testing** — every function is a pure `(in) → out`, testable without a DOM.

---

Related: [03-ENGINE-CORE](03-ENGINE-CORE.md) · [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md) ·
[09-GENRE-SYSTEM](09-GENRE-SYSTEM.md) · [16-INTERFACE](16-INTERFACE.md)
