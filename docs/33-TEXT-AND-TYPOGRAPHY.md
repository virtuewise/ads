# 33 — Text & Typography Engine

**Status: 🟡 (editable graph-backed title layers, rasterized typography, clip-bound motion, and export parity are implemented; advanced shaping and glyph animation remain planned) · Code: `engine/text.ts`, `engine/timeline.ts`, `engine/nodes.ts` (`text`), `App.tsx`**

> The editor supports graph-backed title layers with editable copy, typography, placement, backgrounds,
> per-clip motion, and a shared preview/export rasterization path. This document records what is live and
> what remains in the advanced text-system plan.

---

## 1. What exists today

### 1.0 Titles render — `engine/text.ts`, `engine/nodes.ts` (`text`)

The **`text` node renders.** The GPU has no font, so the editor draws: the node declares
`usesAppTexture`, the compiler gives it a texture binding pair of its own and reports those numbers
(`compiled.appTextures[nodeId]`), the editor rasterises the words into a 2D canvas
(`rasteriseText`) and paints them into that texture through the viewport's `writeAppTexture` slot
handle. The node's WGSL is alpha-over — glyph coverage, not a rectangle:

```wgsl
fn text(color: vec4<f32>, src: texture_2d<f32>, samp: sampler, uv: vec2<f32>) -> vec4<f32> {
  let t = textureSample(src, samp, uv);
  return vec4<f32>(mix(color.rgb, t.rgb, t.a), max(color.a, t.a));
}
```

Editor-authored title nodes are linked to timeline clips through `textNodeId`. The renderer samples
each clip's independent `opacity`, `scale`, `x`, `y`, `rotation`, and `reveal` channels, then rasterizes
the current title style. The same per-time texture callback drives preview and export. Script-plan
titles remain separately driven by the active plan step.

### 1.1 Typography presets (real data)

`hooks/useEngineData.ts` fetches `typography: TypographyPreset[]` from the engine bridge. These are
displayed in the left panel's **Text** tab and can be applied to a selected title or used to create a
title layer.

A `TypographyPreset` contains at minimum: `id`, `name`, `family`, `weight`, `style`. Applying one updates
the selected text node's type treatment; with no title selected it creates a linked title clip.

### 1.2 Title clips

New compositions start empty. Creating a title preset or using the canvas Text tool adds a real clip on
the `captions` track, a linked `text` graph node, and the preset's initial motion keyframes.

### 1.3 Text tool

The `text(T)` tool places a title at the clicked normalized canvas position and opens the Text panel for
editing.

---

## 2. The gap, precisely

| Capability | Today |
|---|---|
| Font loading | ⬜ system fonts through 2D canvas only |
| Text layer in compositor | ✅ the `text` node, painted by the editor into its own GPU texture |
| Text rendering (WGSL/Skia/Wasm) | 🟡 2D canvas rasterisation → `rgba8unorm` texture (`rasteriseText`); SDF atlas ⬜ |
| Text animation | 🟡 opacity, scale, x/y, rotation and reveal keyframes; no per-glyph/stagger animation |
| Text on path | ⬜ none |
| Variable font axes control | ⬜ not exposed by the current title editor |
| Text effects (glow, shadow, outline) | 🟡 a soft drop shadow from the rasteriser; distance-field effects ⬜ |
| Auto-fit / text wrapping | 🟡 multiline text; no automatic fit or advanced wrapping |
| Multi-language / RTL / CJK | ⬜ whatever 2D canvas gives |
| Text as a compositor layer | 🟡 represented by graph `text` nodes and title clips; not part of a general layer stack |

---

## 3. The text layer model (target)

A text layer is a compositor layer ([22](22-COMPOSITOR.md)) whose source is a rendered glyph run:

```typescript
interface TextLayer extends Layer {
  kind: 'text';
  text: TextModel;
}

interface TextModel {
  content: string;
  font: FontRef;              // family + variant + variable axes
  size: number;               // px
  lineHeight: number;
  tracking: number;           // letter spacing
  alignment: 'left' | 'center' | 'right' | 'justify';
  wrapping: { mode: 'none' | 'word' | 'char'; maxWidth?: number; maxHeight?: number };
  fill: Fill;                // solid | gradient | image
  stroke?: Stroke;
  shadow?: Shadow;
  // Animation
  animation: TextAnimation;
  // Path
  path?: TextPath;            // text on a bezier path
}
```

### 3.1 Text rendering backends

| Backend | Where | Notes |
|---|---|---|
| **SDF glyph atlas** | renderer (WebGPU) | pre-rasterize glyphs to a signed-distance texture; fast, scalable |
| **Skia / Wasm** | renderer | high-quality shaping (HarfBuzz), complex scripts, RTL/CJK |
| **Canvas 2D** | renderer (fallback) | simple, no shaping — preview only |

The **SDF atlas** is the primary path: glyphs are rasterized once to a distance-field texture, then
the compositor samples them per-character in WGSL. This gives resolution-independent text with a
single texture bind, and effects (glow, outline, shadow) become distance-field operations — the same
math as the blur/glow nodes ([27](27-EFFECTS-LIBRARY.md)).

### 3.2 Font management

```typescript
interface FontRef {
  family: string;
  source: 'system' | 'bundled' | 'project' | 'google';
  weight: number;
  style: 'normal' | 'italic';
  variableAxes?: Record<string, number>;  // wght, wdth, slnt, opsz
}
```

- **System fonts** — enumerate from the OS; no loading needed.
- **Bundled fonts** — ship a curated set (display + body + mono) with the app.
- **Project fonts** — fonts travel with the `.vfxproj` (embedded or referenced by path).
- **Variable fonts** — axes (weight, width, slant, optical size) are animatable keyframe properties.

---

## 4. Text animation (the kinetic-type engine)

Text animation is the **Explainer genre's core** ([13](13-GENRE-EXPLAINER.md)) and the most visible
"advanced" feature. The model:

### 4.1 Animation types

| Animation | Behaviour |
|---|---|
| `none` | static text |
| `fade-in` | opacity 0→1 over the clip range |
| `slide-in` | translate from off-screen, per-character or per-line |
| `typewriter` | character reveal left-to-right (or right-to-left for RTL) |
| `word-reveal` | words appear sequentially |
| `kinetic` | per-character transform (position/rotation/scale/opacity) with stagger |
| `bounce-in` | per-character scale overshoot (`back` easing) |
| `glitch` | per-character RGB-split / jitter |
| `scramble` | characters cycle through a glyph set before settling |
| `text-on-path` | characters follow a bezier path, animated along it |

### 4.2 The animation model

```typescript
interface TextAnimation {
  type: TextAnimationType;
  /** Stagger source: 'character' | 'word' | 'line' */
  unit: 'character' | 'word' | 'line';
  /** Delay between units, seconds */
  stagger: number;
  /** Duration of each unit's animation */
  duration: number;
  easing: KeyframeEasing;
  /** Direction: 'forward' | 'reverse' | 'random' */
  direction: 'forward' | 'reverse' | 'random';
  /** Transform applied per unit (for kinetic type) */
  transform?: Partial<TransformState>;
}
```

The animation is driven by the **timeline time**, so it stays in sync with the audio and retiming —
the same contract as captions ([26](26-CAPTIONS.md#3-caption-animation)).

### 4.3 Rendering animated text

Animated text is rendered as a **layer** whose glyph positions are computed per-frame:

1. Shape the text (HarfBuzz/Wasm) → glyph runs with positions.
2. For each glyph, compute its animation transform at the current time (stagger + easing).
3. Draw all glyphs with their transforms into the layer's texture.
4. Composite like any other layer.

This means text animation is **procedural** — it costs one compositor pass per frame, no pre-rendered
frames, and it is deterministic.

---

## 5. Variable fonts

Variable fonts expose continuous axes. The left panel displays them; the target is to make them
**animatable**:

```typescript
// Keyframeable variable font axes
interface VariableFontKeyframes {
  wght?: Keyframe[];   // weight 100–900
  wdth?: Keyframe[];   // width 50–200
  slnt?: Keyframe[];   // slant -15–0 deg
  opsz?: Keyframe[];   // optical size 8–144
}
```

Sampling these keyframes per-frame and passing the values to the font rasterizer gives smooth
weight/width animation — a signature modern motion-design move.

---

## 6. Text effects

Text effects are compositor operations on the glyph texture:

| Effect | Implementation |
|---|---|
| **Glow** | distance-field glow (same as [27](27-EFFECTS-LIBRARY.md#glow-bloom)) |
| **Outline / Stroke** | distance-field edge detection + fill |
| **Shadow** | offset + blur of the glyph texture |
| **Gradient fill** | gradient mapped to glyph coverage |
| **Image fill** | texture sampled by glyph coverage |
| **Distortion** | displacement map applied to glyph UVs |
| **3D extrude** | multiple offset copies with depth shading |

All are WGSL fragment operations on the SDF atlas, so they are real-time and export-identical.

---

## 7. Text on path

Characters follow a bezier path:

```typescript
interface TextPath {
  path: MaskPath;             // bezier, keyframeable
  startOffset: number;        // 0–1 along the path
  endOffset: number;
  orientation: 'path' | 'fixed';
  perCharacterRotation: boolean;
}
```

The path is a `MaskPath` ([22](22-COMPOSITOR.md#masks)) — the same bezier used for masks — so text
paths are editable with the same pen tool and keyframeable with the same keyframe system.

---

## 8. Auto-fit & wrapping

Professional text tools handle overflow:

- **Auto-fit:** shrink font size (or scale) to fit a bounding box.
- **Word wrap:** break at word boundaries up to `maxWidth`.
- **Line count:** enforce max 2 lines (broadcast) or N lines (social).
- **No orphan words:** a single word on the last line is pulled up.
- **Punctuation rules:** no line starts with `, . ; : ! ? ) ] }`.

---

## 9. Multi-language & scripts

| Script | Needs |
|---|---|
| Latin | basic shaping |
| Arabic | RTL + ligature + contextual forms |
| CJK | line-breaking rules (kinsoku), vertical text |
| Thai / Devanagari | complex shaping (HarfBuzz) |
| Emoji | color bitmap fonts (CBDT/SVG) |

The Wasm shaping backend (HarfBuzz) handles all of these; the SDF atlas is per-script.

---

## 10. Genre ↔ text posture

| Genre | Text treatment |
|---|---|
| 3D/CGI | minimal HUD-style labels, technical readouts |
| Narrative | lower-thirds, title cards, minimal kinetic type |
| Corporate | brand-consistent titles, stat callouts, CTAs |
| Explainer | **kinetic typography** — the core, per [13](13-GENRE-EXPLAINER.md) |
| Documentary | speaker lower-thirds, archive labels |
| Detective | evidence labels, timestamps, redacted text |

---

## 11. Verification

| Property | Test |
|---|---|
| Font loading | a bundled font renders glyphs matching a reference |
| Text shaping | complex-script text (Arabic, Devanagari) shapes correctly |
| Auto-fit | text shrinks to fit, never overflows the bounding box |
| Wrap rules | no orphan words, no line-start punctuation |
| Animation sync | text animation stays in sync with audio after retime |
| SDF quality | text is resolution-independent (no pixelation at 4×) |
| Export parity | text pixels match between viewport and export ([04](04-RENDERING.md)) |

---

Related: [13-GENRE-EXPLAINER](13-GENRE-EXPLAINER.md) · [22-COMPOSITOR](22-COMPOSITOR.md) ·
[26-CAPTIONS](26-CAPTIONS.md) · [27-EFFECTS-LIBRARY](27-EFFECTS-LIBRARY.md) · [32-KEYFRAME-ANIMATION](32-KEYFRAME-ANIMATION.md) ·
[40-ANIMATION-PRINCIPLES](40-ANIMATION-PRINCIPLES.md)
