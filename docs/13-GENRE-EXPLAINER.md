# 13 — Genre: Explainer & Infographic

**Status: 🟡 · Genre id: `explainer` · Profile: [09-GENRE-SYSTEM](09-GENRE-SYSTEM.md#the-six-smartcut-profiles)**

> Explainer videos turn dense, dry information into clear, engaging visual summaries. The measure of
> success is **legibility and clarity**, not pace.

---

## The workflow need

- **Information architecture.** Break complex text or data into a logical, step-by-step hierarchy.
- **Motion graphics integration.** Sync text callouts, kinetic typography, and icon animation to a
  voiceover.
- **Visual metaphor creation.** Illustrate abstract concepts — a literal funnel for a sales pipeline.

---

## The stack solution

### Vector engine (Skia / Lottie → Wasm)

Regular DOM elements lag when heavily animated over video. The vision is to compile a lightweight C++ 2D
vector layout engine (**Skia**) to WebAssembly: editors feed JSON animation templates (Lottie-style) into
a Wasm worker which rasterises vector typography into **WebGPU textures**, layered over the video with
zero frame drops.

```
JSON template ──► Wasm vector engine ──► RGBA texture ──► WebGPU layer ──► composite
```

> Near-term: the `@printsync/typography-engine` presets (surfaced via
> `window.studio.getTypographyPresets()`) already define font, weight, size, leading, tracking, colour,
> animation, and stagger — the data a vector engine consumes. See [08-SCRIPTING-API](08-SCRIPTING-API.md).

### Voiceover-matched timing

Explainer beats are cut **to the VO waveform**. The `exp-type` preset ("Kinetic type in") is explicitly
"word-level timing locked to the VO waveform."

---

## The engine knobs (genre profile)

| Knob | Value | Why |
|---|---|---|
| `scenes` | `balanced` | Cut on meaningful section changes |
| `reframe` | `center-crop` | Graphics sit centred; no subject tracking |
| `outputRatio` | 16:9 | Standard explainer delivery |
| `smoothness` | 0.60 | Moderate |
| `speedRange` | 0.85–1.30× | Match VO cadence without distortion |
| `preservePitch` | true | VO clarity is paramount |

### Keyframe presets

| Preset | Property | Easing | Duration |
|---|---|---|---|
| Kinetic type in | opacity | easeOut | 0.40s |
| Metaphor morph | scale | easeInOut | 0.80s |
| Step reveal | opacity | easeInOut | 0.50s |

### Templates

- **How It Works** — Question · Metaphor · Step 1 · Step 2 · Step 3 · Recap (LUT `none`).
- **Data Story** — Headline stat · Context · Chart build · Takeaway (LUT `cool-tech`).

### Pipeline

1. Align beats to the voiceover track.
2. Lay in kinetic typography from the presets.
3. Pick and animate the visual metaphor.
4. Balance the information hierarchy.
5. Export with burned captions for accessibility.

---

## UI affordances

- **Captions** track for burned-in text ([06-TIMELINE](06-TIMELINE.md)).
- Typography presets feed the kinetic-type layer.
- The **Data Story** template's `graphHint` (`chart -> grade -> sharpen`) telegraphs a graph chain.
- Accessibility: explainers should export with captions by default.

---

## What exists vs. what is needed

| Capability | Status |
|---|---|
| Genre profile, presets, templates, pipeline | ✅ |
| Typography presets via the engine bridge | ✅ |
| Captions track model | ✅ |
| Wasm vector/Skia engine | ⬜ |
| Lottie JSON template ingestion | ⬜ |
| Chart / data-visualisation layer | ⬜ |
| VO waveform + word-level timing | ⬜ |

---

## Agent path

An agent builds an explainer by: aligning beats to the VO → laying a How-It-Works spine → applying
`kinetic type in` per callout → selecting a visual metaphor from `window.studio.getMetaphors()` → applying
`step reveal` for lists → exporting with captions. See [17-AI-AGENTS](17-AI-AGENTS.md).

---

Previous: [12-GENRE-CORPORATE](12-GENRE-CORPORATE.md) · Next: [14-GENRE-DOCUMENTARY](14-GENRE-DOCUMENTARY.md) ·
Advanced specs: [26-CAPTIONS](26-CAPTIONS.md) (word-level timing) · [24-TRANSITIONS](24-TRANSITIONS.md) ·
[31-AI-AGENTIC-SCALE](31-AI-AGENTIC-SCALE.md) (Lottie import)
