# 12 — Genre: Corporate & Commercial

**Status: 🟡 · Genre id: `corporate` (default) · Profile: [09-GENRE-SYSTEM](09-GENRE-SYSTEM.md#the-six-smartcut-profiles)**

> Commercial editing is **maximum impact in minimum time** — usually 15, 30, or 60 seconds. Every frame
> fights for retention; every frame must be on brand.

---

## The workflow need

- **Retention editing.** Fast cuts, visual hooks, pattern interrupts to stop the scroll.
- **Brand compliance.** Framing, grading, and graphics strictly aligned to brand guidelines.
- **Hook-driven structure.** The most compelling frame goes in the first 3 seconds.
- **Multi-aspect delivery.** The same piece as 16:9, 9:16, 1:1 — each safe-zone correct.

This is the **default genre** (`normalizeProject` falls back to `corporate`) because it exercises the
most platform machinery: LUTs, safe zones, captions, multi-ratio.

---

## The stack solution

### Real-time brand LUTs via WGSL

Brand colours are stored as lightweight JSON (`BRAND_LUTS`) and passed into a custom WebGPU fragment
shader that applies the look instantly. The `COMPOSITE_SHADER` already does exactly this:

```wgsl
let lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
var lutCol = mix(u.lutShadow.rgb, u.lutMid.rgb,     smoothstep(0.0, 0.5, lum));
lutCol     = mix(lutCol,         u.lutHighlight.rgb, smoothstep(0.5, 1.0, lum));
col        = mix(col,            lutCol,             u.lutShadow.a);   // intensity
```

See [04-RENDERING](04-RENDERING.md) and [18-BRAND-AND-LUTS](18-BRAND-AND-LUTS.md).

### Safe-zone layout engine

CSS Grid plus SVG overlays create fluid, hardware-accelerated **safe-zone** margins (1:1, 9:16, 16:9,
4:5) that re-scale the preview as the editor builds social variants. `SAFE_ZONES` in `engine/types.ts`
holds the margin data; `components/SafeZones.tsx` renders the overlay.

### Auto-reframe for vertical

The Corporate profile reframes with `subject-lock` — the reframe target is the subject, so a horizontal
master cuts down to 9:16 with the subject held.

---

## The engine knobs (genre profile)

| Knob | Value | Why |
|---|---|---|
| `scenes` | `aggressive` | Cut on every scene change for pace |
| `reframe` | `subject-lock` | Keep the subject centred for vertical cutdowns |
| `outputRatio` | 16:9 | Master; 9:16 via the Social Cutdown template |
| `smoothness` | 0.45 | Responsive, punchy tracking |
| `speedRange` | 0.70–1.60× | Wide — speed ramp to keep the beat |
| `preservePitch` | true | VO/on-camera audio stays clean even when ramped |

### Keyframe presets

| Preset | Property | Easing | Duration |
|---|---|---|---|
| Hook punch-in | scale | easeOut | 0.30s |
| Pattern interrupt | opacity | linear | 0.18s |
| CTA emphasis | scale | easeInOut | 0.50s |

### Templates

- **Brand Anthem** — Hook · Problem · Product · Proof · CTA (LUT `cool-tech`).
- **Social Cutdown (9:16)** — Hook · Value · Proof · CTA (LUT `warm-brand`).

### Pipeline

1. Auto-cut on scene change for the punchy pace.
2. Reframe to subject for vertical delivery.
3. Apply the brand LUT and logo safe zones.
4. Burn captions and check every platform safe zone.
5. Export 1080p for review, 4K for the master.

---

## UI affordances

- **BrandLUTPanel** — pick from the five real LUTs; live-applied to the canvas.
- **SafeZoneControls / SafeZones** — toggle active + choose ratio; overlay on the viewport.
- **Captions** track — burned-in captions with safe-zone awareness.
- **ExportPanel** — the 1080p preset is the review deliverable; 4K ProRes the master.

---

## What exists vs. what is needed

| Capability | Status |
|---|---|
| Genre profile, presets, templates, pipeline | ✅ |
| Brand LUT WGSL, live-applied | ✅ |
| Safe-zone data + overlay component | ✅ |
| Captions track model | ✅ |
| Scene-change auto-cut (smart_cut execution) | ⬜ |
| Subject-lock auto-reframe | ⬜ |
| Multi-ratio batch export | ⬜ |
| Burned captions in export | ⬜ |

---

## Agent path

An agent produces a commercial by: selecting the Corporate genre → applying **Brand Anthem** → placing
the hook in the first 2–3s → applying `hook punch-in` → auto-cutting for pace → applying the brand LUT →
checking safe zones for each target ratio → exporting 1080p for review. Human editors then sharpen the
hook and the CTA. See [17-AI-AGENTS](17-AI-AGENTS.md).

---

Previous: [11-GENRE-NARRATIVE](11-GENRE-NARRATIVE.md) · Next: [13-GENRE-EXPLAINER](13-GENRE-EXPLAINER.md)
