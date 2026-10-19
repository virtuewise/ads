# 09 — Genre System: SmartCut, Keyframes & Templates

**Status: ✅ (profiles + presets + templates real; graph hints ⬜) · Code: `engine/genre-workflows.ts`, `engine/types.ts`, `components/GenreSelector.tsx`**

> Standard editors treat every timeline the same. Virtue Studio **retunes itself to the genre**. Each of
> the six genres carries a concrete *SmartCut profile*, *keyframe presets*, *templates*, and a *pipeline*
> — all grounded in the parameter model of the installed CapCut `smart_cut.ofx` bundle.

---

## The six genres

Defined in `GENRES` (`engine/types.ts`):

| id | Name | Primary focus | Pacing | Accent |
|---|---|---|---|---|
| `3d-animation` | 3D Animation & CGI | Timing & Pre-vis | Highly calculated, rigid | `#a78bfa` |
| `narrative` | Narrative Fiction | Emotion & Performance | Fluid, human-driven | `#f472b6` |
| `corporate` | Corporate & Commercial | Conversion & Brand | Aggressive, fast, punchy | `#ff5a2c` |
| `explainer` | Explainer & Infographic | Clarity & Education | Steady, voiceover-matched | `#5eead4` |
| `documentary` | Documentary | Authenticity & Truth | Natural, interview-driven | `#ffb347` |
| `detective` | Detective & Mystery | Suspense & Clues | Unpredictable, tense | `#ef4444` |

Each `Genre` also carries `description` and `keyFeatures[]` for the selector UI.

---

## The SmartCut model

The whole genre system is anchored in a real, audited artefact: the CapCut `smart_cut.ofx` bundle at
`C:\Users\Dell\AppData\Local\CapCut\Apps\9.5.0.4050\smart_cut.ofx.bundle\Contents\Win64\smart_cut.ofx`.
Its parameter model is **scene detection + auto-reframe + speed tracking**, exposed through named
parameters:

| CapCut parameter | Meaning |
|---|---|
| `param_scenes` | how aggressively to cut on scene boundaries |
| `param_crop_coordinate` | Double2D, normalised crop target |
| `param_scale` | reframe zoom |
| `param_output_ratio` / `param_ratio` | delivery aspect |
| `param_need_crop` | whether to crop/reframe at all |
| `param_track_speed` / `shift_speed` | allowed retime range |
| `faster_speed_resize` / `slower_speed_resize` | speed-change handling |
| `tracking_speed_resize` | subject-tracking retime |
| `video_reframe_smoothness_level` | reframe smoothing (0–1) |
| `VEOfxSmartCut` | the effect identifier |

Rather than vague prose, each genre is expressed as **concrete values for those same knobs**:

```typescript
interface SmartCutProfile {
  scenes: 'off' | 'loose' | 'balanced' | 'aggressive';   // param_scenes
  reframe: 'none' | 'subject-lock' | 'center-crop' | 'smooth-follow';
  outputRatio: SafeZoneRatio;                            // param_output_ratio / param_ratio
  smoothness: number;                                    // video_reframe_smoothness_level (0–1)
  speedRange: [number, number];                          // param_track_speed / shift_speed
  preservePitch: boolean;                                // faster/slower_speed_resize
}
```

This is what makes a genre **selectable and actionable** rather than decorative.

---

## The six SmartCut profiles

| Genre | scenes | reframe | ratio | smoothness | speed range | pitch |
|---|---|---|---|---|---|---|
| 3D/CGI | `loose` | `none` | 16:9 | 0.90 | 0.50–1.00× | preserved |
| Narrative | `off` | `smooth-follow` | 16:9 | 0.70 | 0.90–1.00× | preserved |
| Corporate | `aggressive` | `subject-lock` | 16:9 | 0.45 | 0.70–1.60× | preserved |
| Explainer | `balanced` | `center-crop` | 16:9 | 0.60 | 0.85–1.30× | preserved |
| Documentary | `loose` | `subject-lock` | 16:9 | 0.55 | 0.60–1.00× | natural |
| Detective | `off` | `smooth-follow` | 16:9 | 0.80 | 0.70–1.10× | natural |

Read the table as each genre's *editing posture*: Corporate cuts aggressively and allows wide speed
changes to keep pace; Narrative and Detective never auto-cut (the cut is the whole craft) and barely
retime; Documentary allows slow-down for archive but not pitch correction; 3D locks the frame entirely
(`reframe: none`).

`smartCutSummary(profile)` renders this as human-readable chips for the panel:

```
scenes: aggressive · reframe: subject-lock · ratio: 16:9 · smoothness: 0.45 · speed: 0.70–1.60× · pitch: preserved
```

---

## Keyframe presets

Each genre ships **keyframe presets** — named moves with a property, easing, duration, and rationale —
applied to the timeline by the panel.

```typescript
interface KeyframePreset {
  id: string;
  label: string;
  property: string;      // 'opacity' | 'scale'
  easing: KeyframeEasing;
  duration: number;      // seconds
  detail: string;        // why this move — the craft rationale
}
```

| Genre | Preset | Property | Easing | Duration |
|---|---|---|---|---|
| 3D/CGI | Pass dissolve-in | opacity | easeInOut | 0.75s |
| 3D/CGI | Virtual camera push | scale | easeInOut | 2.50s |
| 3D/CGI | Impact settle | scale | easeOut | 0.35s |
| Narrative | J-cut audio lead | opacity | linear | 0.60s |
| Narrative | L-cut audio tail | opacity | linear | 0.90s |
| Narrative | Performance hold | opacity | easeInOut | 1.20s |
| Corporate | Hook punch-in | scale | easeOut | 0.30s |
| Corporate | Pattern interrupt | opacity | linear | 0.18s |
| Corporate | CTA emphasis | scale | easeInOut | 0.50s |
| Explainer | Kinetic type in | opacity | easeOut | 0.40s |
| Explainer | Metaphor morph | scale | easeInOut | 0.80s |
| Explainer | Step reveal | opacity | easeInOut | 0.50s |
| Documentary | B-roll dissolve | opacity | easeInOut | 1.10s |
| Documentary | Archive reveal | scale | easeInOut | 3.00s |
| Documentary | Juxtaposition beat | opacity | linear | 0.50s |
| Detective | Clue linger | opacity | easeInOut | 1.40s |
| Detective | Red herring push | scale | easeIn | 0.70s |
| Detective | Reveal snap | opacity | easeOut | 0.22s |

The `detail` strings encode *why* — e.g. Detective's *Reveal snap* is "hard cut on the answer — no
smoothing, no warning."

---

## Templates

Each genre has **two templates**, each with beats, a caption style, a default LUT, and a graph hint.

```typescript
interface GenreTemplate {
  id: string;
  name: string;
  beats: string[];         // structure, surfaced as a starting timeline
  captionStyle: string;    // typography treatment
  lut: string;             // a BRAND_LUTS id
  graphHint: string;       // intended DAG chain
}
```

The twelve templates:

| Genre | Template | Beats | LUT |
|---|---|---|---|
| 3D/CGI | CGI Teaser | Black · Pass reveal · Camera push · Impact cut · Logo hold | cool-tech |
| 3D/CGI | Comp Breakdown | Plate · Wireframe · Lighting pass · Beauty · Final | vibrant |
| Narrative | Scene Assembly | Cold open · Establish · Dialogue · Reaction · Turn · Button | cinematic |
| Narrative | Trailer Beat Sheet | Setup · Escalation · False calm · Hard cut · Title | cinematic |
| Corporate | Brand Anthem | Hook · Problem · Product · Proof · CTA | cool-tech |
| Corporate | Social Cutdown (9:16) | Hook · Value · Proof · CTA | warm-brand |
| Explainer | How It Works | Question · Metaphor · Step 1 · Step 2 · Step 3 · Recap | none |
| Explainer | Data Story | Headline stat · Context · Chart build · Takeaway | cool-tech |
| Documentary | Script From Footage | Archive · Interview · B-roll · Interview · Resolution | cinematic |
| Documentary | Video Essay | Thesis · Evidence · Counterpoint · Synthesis | vibrant |
| Detective | Mystery Cold Open | Incipient · Clue · Mischief · False trail · Reveal · Title | cinematic |
| Detective | Interrogation Cut | Question · Silence · Pressure · Crack | none |

> **Validation rule:** `lut` must reference a real `BRAND_LUTS` id — `none`, `warm-brand`, `cool-tech`,
> `cinematic`, `vibrant`. A mismatched id (e.g. an invented `teal-orange`) is a bug, caught during
> development by a validation script. See [18-BRAND-AND-LUTS](18-BRAND-AND-LUTS.md).

`allTemplates()` flattens all twelve (with `genre`, `genreName`) for the templates browser.

---

## Pipelines

Each genre declares an ordered production pipeline shown in the panel:

**3D/CGI** — Import multi-pass renders as a stack · Lock timing to the animatic · Composite passes in the
node graph · Retime for frame-rate conversion · Grade and deliver both aspect ratios.

**Narrative** — Search the transcript for the strongest takes · Assemble an invisible-cut scene · Build
J/L audio overlaps · Track emotional continuity across the reel · Grade for a consistent look.

**Corporate** — Auto-cut on scene change for the punchy pace · Reframe to subject for vertical delivery ·
Apply the brand LUT and logo safe zones · Burn captions and check every platform safe zone · Export 1080p
for review, 4K for the master.

**Explainer** — Align beats to the voiceover track · Lay in kinetic typography from the presets · Pick and
animate the visual metaphor · Balance the information hierarchy · Export with burned captions.

**Documentary** — Tag every clip with metadata as it lands · Search the transcript to script from the
footage · Layer B-roll under the interview spine · Build meaning through juxtaposition · Grade archive and
modern footage into one look.

**Detective** — Trim for precisely withheld information · Cache and compare suspect frames · Build tension
with controlled pacing · Place and time the red herrings · Grade for cold, high-contrast mystery.

These pipelines are the **agent playbook** for each genre — see [17-AI-AGENTS](17-AI-AGENTS.md).

---

## The `GenreWorkflow` shape

```typescript
interface GenreWorkflow {
  id: GenreId;
  objective: string;            // one-line goal
  smartCut: SmartCutProfile;
  keyframes: KeyframePreset[];
  templates: GenreTemplate[];
  pipeline: string[];           // ordered steps
}
```

Held in `GENRE_WORKFLOWS: Record<GenreId, GenreWorkflow>`.

---

## Applying a genre in the UI

`components/GenreSelector.tsx` exposes the **GenreSelector** (pick a genre) and the **GenrePanel**
(objective, SmartCut chips, keyframe presets, templates, pipeline). Applying a template currently:

1. Sets the composition's `brandLUT` from the template.
2. Lays out timeline clips from the template's `beats`.
3. Records the template's `graphHint` and keyframe presets for reference.

> **Not yet wired:** applying `graphHint` to the actual DAG. The hint is stored but does not yet mutate
> `graph`/`graph.nodes`. This is a roadmap item — see [21-ROADMAP](21-ROADMAP.md).

---

## Per-genre technical deep dives

Each genre has its own document describing the rendering/data strategy it needs:

| Genre | Doc |
|---|---|
| 3D/CGI | [10-GENRE-3D-ANIMATION](10-GENRE-3D-ANIMATION.md) |
| Narrative | [11-GENRE-NARRATIVE](11-GENRE-NARRATIVE.md) |
| Corporate | [12-GENRE-CORPORATE](12-GENRE-CORPORATE.md) |
| Explainer | [13-GENRE-EXPLAINER](13-GENRE-EXPLAINER.md) |
| Documentary | [14-GENRE-DOCUMENTARY](14-GENRE-DOCUMENTARY.md) |
| Detective | [15-GENRE-DETECTIVE](15-GENRE-DETECTIVE.md) |

---

## Comparison with the monorepo's visual grammars

World A's `@printsync/visual-grammar-engine` provides five **narrative grammars** — `ExplainerGrammar`,
`CorporateGrammar`, `DetectiveGrammar`, `TransformationGrammar`, `HeroJourneyGrammar` — surfaced to the
editor through `window.studio.getVisualGrammars()` ([08](08-SCRIPTING-API.md)). These are *story
structures*; the genre workflows are *editing postures*. They complement each other: a grammar shapes
the beats, a genre shapes the cut.

---

Related: [06-TIMELINE](06-TIMELINE.md) · [16-INTERFACE](16-INTERFACE.md) ·
[18-BRAND-AND-LUTS](18-BRAND-AND-LUTS.md) · [21-ROADMAP](21-ROADMAP.md)
