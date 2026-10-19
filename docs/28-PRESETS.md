# 28 — Presets, Templates & Reusable Assets

**Status: 🟡 (12 genre templates exist; presets beyond them ⬜) · Code: `engine/genre-workflows.ts` → `engine/presets/*`**

> Today the only "preset" concept is the **12 genre templates** in `engine/genre-workflows.ts` — each a
> name, beats, caption style, LUT, and a `graphHint` that is **stored but never applied**. This document
> specifies a real preset system: parameterized, composable, searchable, and agent-addressable.

---

## Why presets matter disproportionately

Presets are the interface between **taste** (the human's asset) and **throughput** (the agent's asset):

- A human builds a look once, names it, reuses it forever.
- An agent applies it by id, with parameters, deterministically.
- A preset is a **named, versioned, diffable** unit — so it fits the project format
  ([05](05-PROJECT-FORMAT.md)) and the dual-door model ([00](00-VISION.md)).

Without presets, every agent run reinvents the look; with them, brand consistency is structural.

---

## Preset kinds

| Kind | What it stores | Example |
|---|---|---|
| **Effect preset** | an effect node + tuned params, optionally a small sub-graph | `Soft Bloom`, `Film Grain 35mm` |
| **Transition preset** | transition type + params + duration/easing ([24](24-TRANSITIONS.md)) | `Brand Wipe` |
| **Grade preset** | a `GradeOp[]` chain + LUT ([23](23-COLOR.md)) | `PrintSync Cinematic` |
| **Motion preset** | a keyframe set applied to a property or layer ([06](06-TIMELINE.md)) | `Impact Settle` |
| **Title preset** | a text layer + animation + style | `Lower Third — Speaker` |
| **Caption style** | a `CaptionStyle` ([26](26-CAPTIONS.md)) | `Social Bold Karaoke` |
| **Template** | beats + timeline skeleton + look + graph | `Brand Anthem` |
| **Graph preset** | a reusable node sub-graph (macro) | `Multi-pass Comp` |

All of these share one container type so the UI, the file format, and agent tooling have **one** shape.

---

## The preset container

```typescript
interface Preset<P = unknown> {
  id: string;
  kind: PresetKind;
  name: string;
  /** Short description for the browser and for agents choosing one. */
  description: string;
  /** Freeform tags for search. */
  tags: string[];
  /** The actual payload; shape depends on `kind`. */
  payload: P;
  /** Values the user/agent can set; the preset is parameterized, not frozen. */
  params: ParamSpec[];
  /** Presets this one builds on (composition of presets). */
  extends?: string[];
  /** Provenance. */
  author: string;              // 'system' | 'brand' | 'user:<name>'
  version: number;
  createdAt: string;
}
```

### Parameterization is the point

A preset whose values are frozen is a macro. A **preset exposes controls**:

```typescript
interface ParamSpec {
  key: string;
  label: string;
  type: 'number' | 'color' | 'choice' | 'bool' | 'text';
  default: unknown;
  min?: number; max?: number; step?: number;
  choices?: string[];
  /** Optional expression the value feeds, e.g. 'blurRadius * quality'. */
  bind?: string;
}
```

`Soft Bloom` exposes `intensity`, `threshold`, `radius` — not the 40 node params underneath. This is what
makes presets usable by a non-technical operator *and* by an agent that only needs to set three numbers.

---

## Applying a preset

Applying is a **pure document transform**, like the timeline ops ([06](06-TIMELINE.md)):

```typescript
applyPreset(doc: ProjectDocument, presetId: string, values?: Record<string, unknown>): ProjectDocument
```

Rules:

1. **Non-destructive by default** — a preset adds nodes/layers/keyframes; it does not flatten or bake. A
   preset applied to a layer is removable and re-editable.
2. **Idempotent where sensible** — applying the same grade preset twice replaces the previous instance of
   that preset rather than stacking a duplicate.
3. **Parameterized** — `values` overrides the preset's defaults for that instance.
4. **Diffable** — the result is a small, readable change to the JSON ([05](05-PROJECT-FORMAT.md)).

### Previews

Each preset carries (or lazily generates) a **thumbnail** rendered through the same shader pipeline, so the
browser shows the real result — not a stock image. Presets applied to the current selection can preview
live via [animated previews in the browser].

---

## The preset library

Presets are **project-local + global**:

| Scope | Location | Use |
|---|---|---|
| **Built-in** | shipped in `engine/presets/builtin/*` | system + brand presets |
| **Brand** | `brand/<name>/presets/*` | brand-owned looks |
| **Project** | inside the `.vfxproj` document | project-specific presets, travel with the file |
| **User** | app data dir | the operator's personal library |

Because the **project-local** preset is inside the document, an agent-authored project carries its presets
with it — the human opens the file and the agent's looks are right there, editable.

---

## The built-in library (target)

| Category | Presets |
|---|---|
| **Looks** | PrintSync Cinematic · Cool Tech · Warm Brand · Vibrant Pop · Clean Corporate · Film 2383 · Bleach Bypass · Cold Mystery |
| **Motion** | Impact Settle · Hook Punch-In · Smooth Reveal · Kinetic In · Bounce Card · Camera Push |
| **Titles** | Lower Third — Speaker · Opening Card · Stat Callout · End CTA · Chapter Marker |
| **Captions** | Broadcast Clean · Social Bold · Karaoke Pop · Documentary Lower-Third · Minimal Mono |
| **Transitions** | Soft Cut · Brand Wipe · Whip Cut · Glitch Cut · Memory Wipe · Scene Morph |
| **Effects** | Soft Bloom · Film Grain · Halation · Scanlines · VHS · Chromatic Split · Dream Glow |
| **Graphs** | Multi-pass Comp · Bloom Chain · Grade Chain · Particle Burst · Flow Morph |

The **Looks** presets connect directly to the existing `BRAND_LUTS` ([18](18-BRAND-AND-LUTS.md)): each
Look preset is a grade chain seeded by a brand LUT, so existing projects and genre templates keep working.

---

## Genre templates become real

The 12 templates in `genre-workflows.ts` currently set a LUT and lay out beats, and **store** a
`graphHint` they never apply ([09](09-GENRE-SYSTEM.md#applying-a-genre-in-the-ui)). Closing that gap makes
templates first-class:

```typescript
interface GenreTemplate {
  id: string;
  name: string;
  beats: string[];
  captionStyle: string;
  lut: string;
  /** Now applied: a real graph preset, not a comment. */
  graph: string;                 // preset id
  /** Now applied: keyframe presets expanded onto the timeline. */
  keyframes: string[];           // motion preset ids
  /** New: default transitions between beats. */
  transitions?: string[];        // transition preset ids
  /** New: default grade chain for the genre. */
  grade?: string;                // grade preset id
}
```

Applying a template then produces a **complete, renderable sequence**: clips, keyframes, captions, grade,
transitions, and graph — not a stack of rectangles.

---

## Agent access

Presets are the agent's vocabulary for taste. Through the scripting API ([08](08-SCRIPTING-API.md)):

```typescript
studio.presets.list({ kind: 'look', tags: ['cinematic'] })
studio.presets.get('look-printsync-cinematic')
studio.presets.apply(presetId, { intensity: 0.8 }, { target: layerId })
studio.presets.save({ kind: 'motion', name: 'My Move', payload, params })
```

An agent's procedure becomes: *brief → genre → template → presets (look, motion, captions, transitions) →
render*. Every step is a named, diffable reference, so the human can see exactly which look the agent chose
and swap it.

---

## Preset hygiene

- **Versioned** — each preset has a `version`; changes bump it and are noted.
- **Validated** — a preset referencing an unknown LUT/effect/node id is rejected at load (the same
  validation rule as templates — [09](09-GENRE-SYSTEM.md#templates)).
- **Non-destructive** — applying a preset never destroys source data.
- **Removable** — an applied preset can be removed cleanly, because it is a tagged set of document edits.

---

## Verification

| Property | Test |
|---|---|
| Apply/remove round-trip | applying then removing a preset returns the original document |
| Idempotence | applying the same preset twice == applying once (for replace-semantics kinds) |
| Validation | a preset with a bad id fails to load with a precise message |
| Parameter binding | changing a param changes exactly the bound node values |
| Thumbnail parity | the preset thumbnail matches a render of the preset ([04](04-RENDERING.md)) |

---

Related: [06-TIMELINE](06-TIMELINE.md) · [09-GENRE-SYSTEM](09-GENRE-SYSTEM.md) · [18-BRAND-AND-LUTS](18-BRAND-AND-LUTS.md) ·
[23-COLOR](23-COLOR.md) · [24-TRANSITIONS](24-TRANSITIONS.md) · [26-CAPTIONS](26-CAPTIONS.md)
