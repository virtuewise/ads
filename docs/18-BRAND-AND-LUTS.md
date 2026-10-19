# 18 — Brand System & LUTs in the Editor

**Status: 🟡 (LUTs + safe zones real; brand QA gate ⬜) · Code: `engine/types.ts`, `components/BrandLUTPanel.tsx`, `components/SafeZones.tsx`, `brand/printsync/*`**

> Brand is not decoration — it is enforced by the shader. LUTs are real GPU inputs, safe zones are real
> layout constraints, and brand QA is designed as a **gate on export**, not a suggestion.

---

## The brand source of truth

The brand brain lives in `brand/printsync/` (World A):

| File | Contents |
|---|---|
| `brand.json` | Identity, tagline, personality, pillars, audience, competitors |
| `colors.json` | Colour system |
| `typography.json` | Font system |
| `messaging.json` | Core messages and voice |
| `services.json` | Service definitions |
| `campaign-history.json` | Campaign/creative history (fatigue & repetition checks) |
| `creative-dna.md` | Creative DNA |
| `forbidden-styles.md` | Explicit anti-patterns |
| `logo-rules.md` | Logo usage rules |
| `motion-language.md` | Motion principles |
| `photography.md` | Photography direction |
| `visual-system.md` | Visual system |
| `voice.md` | Voice guidance |

PrintSync is the **featured/default** brand, but Virtue Studio is multi-brand by design — the schema is
per-brand.

---

## Brand LUTs

`BRAND_LUTS` in `engine/types.ts` — the **only** valid `brandLUT` ids:

| id | Name | Shadow | Midtone | Highlight | Intensity |
|---|---|---|---|---|---|
| `none` | None | `#000000` | `#808080` | `#ffffff` | 0.00 |
| `warm-brand` | Warm Brand | `#1a0a00` | `#804020` | `#fff0e0` | 0.30 |
| `cool-tech` | Cool Tech | `#000a1a` | `#204080` | `#e0f0ff` | 0.30 |
| `cinematic` | Cinematic | `#0a0a0a` | `#404040` | `#f5f5f5` | 0.50 |
| `vibrant` | Vibrant | `#1a001a` | `#802080` | `#ffe0ff` | 0.40 |

Each LUT is `{ id, name, colors: { shadow, midtone, highlight }, intensity }`.

### How a LUT is applied

The `COMPOSITE_SHADER` builds a three-point luminance gradient and mixes it over the frame by
`intensity` ([04-RENDERING](04-RENDERING.md)):

```wgsl
let lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
var lutCol = mix(u.lutShadow.rgb, u.lutMid.rgb,     smoothstep(0.0, 0.5, lum));
lutCol     = mix(lutCol,         u.lutHighlight.rgb, smoothstep(0.5, 1.0, lum));
col        = mix(col,            lutCol,             u.lutShadow.a);   // intensity
```

`packUniforms` packs `hexToRgb(shadow|mid|high)` into the uniform block and, when the LUT is `none` or
absent, uses neutral values with intensity 0.

> **Enforcement point:** a genre template's `lut` field must reference one of the five ids above. A
> mismatched id (e.g. an invented `teal-orange`) is a bug; a validation script caught exactly this during
> development. See [09-GENRE-SYSTEM](09-GENRE-SYSTEM.md#templates).

---

## Safe zones

`SAFE_ZONES` in `engine/types.ts` — the margin presets:

| Ratio | Label | Margins (t/b/l/r %) |
|---|---|---|
| 16:9 | Action Safe | 5 / 5 / 5 / 5 |
| 16:9 | Title Safe | 10 / 10 / 10 / 10 |
| 9:16 | Action Safe | 5 / 5 / 5 / 5 |
| 9:16 | Title Safe | 12 / 12 / 8 / 8 |
| 1:1 | Action Safe | 5 / 5 / 5 / 5 |
| 4:5 | Title Safe | 10 / 10 / 10 / 10 |

`SafeZoneState` is `{ active: boolean, ratio: SafeZoneRatio }`. `SafeZoneRatio` is one of `1:1 | 9:16 |
16:9 | 4:5`.

`components/SafeZones.tsx` renders the overlay over the viewport; `SafeZoneControls` toggles active state
and ratio. The Corporate genre's Social Cutdown template is explicitly "safe-zone aware."

---

## Genre ↔ look mapping

Which LUT each genre reaches for, by convention:

| Genre | Typical LUTs | Rationale |
|---|---|---|
| 3D/CGI | `cool-tech`, `vibrant` | technical/synthetic clarity |
| Narrative | `cinematic` | film-consistent look |
| Corporate | `cool-tech`, `warm-brand` | brand-aligned; warm for social |
| Explainer | `none`, `cool-tech` | clarity first; brand accent second |
| Documentary | `cinematic`, `vibrant` | unify archive + modern footage |
| Detective | `cinematic`, `none` | cold, high-contrast mystery |

These are the `lut` values on the twelve templates ([09-GENRE-SYSTEM](09-GENRE-SYSTEM.md#templates)).

---

## Brand QA (designed gate)

The vision: brand QA is a **hard gate** on export, checking at minimum:

- **Logo accuracy** — correct logo, correct clear space, per `logo-rules.md`.
- **Typography accuracy** — correct fonts, weights, and tracking per `typography.json`.
- **Colour compliance** — the applied LUT matches the brand's approved look.
- **Safe-zone compliance** — nothing critical outside title-safe.
- **Genericity** — anti-generic detection (heritage from `@printsync/qa-engine`).

> Today the LUT and safe zones are enforced structurally (they are shader/layout inputs), but there is no
> explicit pre-export QA gate yet. This is a roadmap item ([21-ROADMAP](21-ROADMAP.md)).

---

## What exists vs. what is needed

| Capability | Status |
|---|---|
| Five real LUTs, WGSL-applied, live in viewport + export | ✅ |
| Safe-zone presets + overlay + state | ✅ |
| Genre templates reference valid LUT ids | ✅ |
| Brand source files (`brand/printsync/*`) | ✅ |
| Pre-export brand-QA gate | ⬜ |
| Logo/typography QA checks in the editor | ⬜ |
| Multi-brand switching in the UI | ⬜ |
| 3D LUT cube (`.cube`) file ingestion | ⬜ |

---

Related: [04-RENDERING](04-RENDERING.md) · [09-GENRE-SYSTEM](09-GENRE-SYSTEM.md) ·
[12-GENRE-CORPORATE](12-GENRE-CORPORATE.md) · [23-COLOR](23-COLOR.md) (.cube LUTs) ·
[wiki/Brand](wiki/Brand.md)
