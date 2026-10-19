# 34 — Templates & Preset Library

**Status: 🟡 (12 genre templates are real data; template authoring, marketplace, and non-genre presets are ⬜) · Code: `engine/genre-workflows.ts`, `engine/types.ts` → target: `engine/presets/*`**

> The 12 genre templates are the only "preset" concept today — each a name, beats, caption style, LUT,
> and a `graphHint` that is stored but never applied. This document specifies the full template and
> preset system: what a template contains, how to author one, and the library the advanced system ships.

---

## 1. What exists today

### 1.1 The template type

```typescript
interface GenreTemplate {
  id: string;
  name: string;
  beats: string[];          // timeline beat names
  captionStyle: string;     // name of a caption style
  lut: string;              // brand LUT id
  graphHint: string;        // intended DAG chain, display-only
}
```

### 1.2 The 12 templates

| Genre | Templates |
|---|---|
| 3D/CGI | CGI Teaser, Comp Breakdown |
| Narrative | Scene Assembly, Trailer Beat Sheet |
| Corporate | Brand Anthem, Social Cutdown (9:16) |
| Explainer | How It Works, Data Story |
| Documentary | Script From Footage, Video Essay |
| Detective | Mystery Cold Open, Interrogation Cut |

### 1.3 What applying a template does today

`applyTemplate()` in `App.tsx`:

1. Sets the composition's `brandLUT` from the template.
2. Lays out timeline clips from the template's `beats`.
3. Records the `graphHint` and keyframe presets for reference.

**What it does NOT do:** configure the DAG from `graphHint`, apply keyframe presets to the timeline,
set up the caption style, or add transitions. The template produces a stack of rectangles, not a
renderable sequence.

---

## 2. The gap, precisely

| Capability | Today |
|---|---|
| Template data | ✅ 12 templates, 6 genres |
| Apply template → timeline | ✅ clips + LUT |
| Apply template → DAG | ⬜ `graphHint` is display-only |
| Apply template → keyframes | ⬜ presets exist but not auto-applied |
| Apply template → captions | ⬜ style name stored, not applied |
| Apply template → transitions | ⬜ none |
| Apply template → grade | ⬜ LUT only, no grade chain |
| Author templates | ⬜ no UI, no format spec |
| Non-genre presets | ⬜ no preset container beyond templates |
| Template marketplace | ⬜ none |
| Template versioning | ⬜ none |

---

## 3. The template model (target)

A template is a **complete, renderable sequence** — not a stack of rectangles:

```typescript
interface Template {
  id: string;
  name: string;
  description: string;
  genre: GenreId;
  tags: string[];
  /** Timeline skeleton: tracks, clips, keyframes */
  timeline: TimelineDoc;
  /** DAG preset to apply (a real node graph, not a hint) */
  graph: string;                    // preset id
  /** Grade chain to apply */
  grade: string;                   // grade preset id
  /** Transitions between beats */
  transitions: string[];           // transition preset ids
  /** Caption style to apply */
  captions: string;                // caption style preset id
  /** Motion presets to apply to clips */
  motion: string[];                // motion preset ids
  /** Look (LUT + grade) */
  look: string;                    // look preset id
  author: string;                  // 'system' | 'brand' | 'user'
  version: number;
  createdAt: string;
}
```

Applying a template produces: clips on all tracks, keyframes on those clips, a configured DAG, a
grade chain, transitions, captions, and a look — a complete sequence ready to render.

---

## 4. The preset container

Beyond genre templates, the system needs a general preset container ([28](28-PRESETS.md)):

```typescript
interface Preset<P = unknown> {
  id: string;
  kind: PresetKind;       // 'effect' | 'transition' | 'grade' | 'motion' | 'title' | 'caption' | 'template' | 'graph'
  name: string;
  description: string;
  tags: string[];
  payload: P;
  params: ParamSpec[];     // user/agent-settable controls
  extends?: string[];     // composition of presets
  author: string;
  version: number;
}
```

**Parameterization is the point** — a preset exposes controls (`ParamSpec[]`), not frozen values.
`Soft Bloom` exposes `intensity`, `threshold`, `radius` — not the 40 node params underneath.

---

## 5. Authoring templates

### 5.1 The authoring workflow

1. **Build** a sequence in the editor (clips, keyframes, grade, captions, transitions).
2. **Select** the range to save as a template.
3. **File → Save as Template** — captures the current document state.
4. **Name, describe, tag, parameterize** — choose which values are editable.
5. **Save** — writes to the project, brand, or user library.

### 5.2 The template file

A template is stored as a **partial `ProjectDocument`** plus metadata:

```json
{
  "id": "tpl-brand-anthem-v2",
  "name": "Brand Anthem",
  "genre": "corporate",
  "version": 2,
  "partialDoc": {
    "composition": { "...": "..." },
    "timeline": { "duration": 30, "clips": [...] },
    "graph": { "...": "..." }
  },
  "params": [
    { "key": "accentColor", "label": "Accent", "type": "color", "default": "#ff5a2c" }
  ]
}
```

Because it is a partial document, a template is **diffable, versionable, and mergeable** — the same
deterministic JSON as the project format ([05](05-PROJECT-FORMAT.md)).

### 5.3 Template parameters

When saving, the author marks values as parameters:

| Parameter type | Example |
|---|---|
| `color` | accent color, background |
| `text` | headline, CTA copy |
| `number` | duration, intensity |
| `choice` | aspect ratio, look |
| `font` | typeface |

The template then exposes these as controls in the UI and as settable values in the agent API.

---

## 6. The template library

Templates are **project-local + global**:

| Scope | Location | Use |
|---|---|---|
| **Built-in** | shipped with the app | system + brand templates |
| **Brand** | `brand/<name>/templates/*` | brand-owned looks |
| **Project** | inside the `.vfxproj` | project-specific, travel with the file |
| **User** | app data dir | the operator's personal library |

### 6.1 Built-in library (target)

| Category | Templates |
|---|---|
| **Corporate** | Brand Anthem · Product Launch · Social Cutdown · Event Promo · Testimonial |
| **Narrative** | Scene Assembly · Trailer Beat Sheet · Short Film Opening · Title Sequence |
| **Explainer** | How It Works · Data Story · Listicle · Comparison · Tutorial |
| **Documentary** | Script From Footage · Video Essay · Interview Setup · Archive Sequence |
| **Detective** | Mystery Cold Open · Interrogation Cut · Evidence Reveal · Chase Sequence |
| **3D/CGI** | CGI Teaser · Comp Breakdown · Product Render · Motion Graphics Reel |

### 6.2 Brand templates

A brand can ship a **template pack** — a folder of templates + brand LUTs + fonts + caption styles —
that enforces brand consistency across every project. Applying a brand template guarantees the brand
QA gate ([18](18-BRAND-AND-LUTS.md#the-brand-qa-gate)).

---

## 7. Applying templates

Applying a template is a **pure document transform**:

```typescript
applyTemplate(doc: ProjectDocument, templateId: string, values?: Record<string, unknown>): ProjectDocument
```

Rules:

1. **Non-destructive by default** — adds nodes/layers/keyframes; never flattens or bakes.
2. **Parameterized** — `values` overrides the template's defaults.
3. **Diffable** — the result is a small, readable change to the JSON.
4. **Removable** — an applied template can be removed cleanly.
5. **Idempotent** — applying twice replaces rather than stacks.

### 7.1 Template preview

Each template carries (or lazily generates) a **thumbnail** rendered through the same shader pipeline,
so the browser shows the real result — not a stock image. Applied templates preview live via
animated previews in the browser.

---

## 8. The template marketplace (target)

A local-first marketplace:

- **Browse** templates by genre, tag, or brand.
- **Preview** with animated thumbnails.
- **Install** to the user or brand library.
- **Share** a template as a `.vfxpreset` file (a partial document + metadata, like a template file).
- **Rate and review** — community signals for quality.

All local, all deterministic, all diffable.

---

## 9. Agent access

Templates are the agent's vocabulary for structure. Through the scripting API ([08](08-SCRIPTING-API.md)):

```typescript
studio.templates.list({ genre: 'corporate', tags: ['launch'] })
studio.templates.get('tpl-brand-anthem-v2')
studio.templates.apply(templateId, { accentColor: '#5eead4' })
studio.templates.save({ partialDoc, params, name: 'My Template' })
```

An agent's procedure: *brief → genre → template → presets → render*. Every step is a named, diffable
reference.

---

## 10. Verification

| Property | Test |
|---|---|
| Apply/remove round-trip | applying then removing returns the original document |
| Idempotence | applying twice == applying once |
| Parameter binding | changing a param changes exactly the bound values |
| Validation | a template with a bad LUT/effect id fails to load with a precise message |
| Thumbnail parity | the template thumbnail matches a render ([04](04-RENDERING.md)) |
| Diff size | applying a template produces a readable, reviewable JSON diff |

---

Related: [09-GENRE-SYSTEM](09-GENRE-SYSTEM.md) · [28-PRESETS](28-PRESETS.md) · [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md) ·
[18-BRAND-AND-LUTS](18-BRAND-AND-LUTS.md) · [31-AI-AGENTIC-SCALE](31-AI-AGENTIC-SCALE.md)
