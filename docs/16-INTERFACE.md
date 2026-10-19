# 16 — Interface Specification (the human layer)

**Status: ✅ · Code: `App.tsx`, `components/*.tsx`, `styles.css`**

> The interface is an **IDE for video**: a menu bar, a tool rail, a left project panel, a canvas
> workspace, a right inspector, and a keyframe timeline — all in the deep-ink Virtue Studio visual
> language. Every visible affordance is wired to the engine; nothing is decorative.

---

## The shell

```
┌───────────────────────────────────────────────────────────────────────────┐
│  menubar   V Virtue Studio   File Edit Composition Layer Effect Animation…  │  ← top menus
├──────┬────────────────────────────────────────────────────┬─────────────────┤
│ rail │              workspace / stagecol                   │   panel--right │
│  ▣   │  ┌──────────────────────────────────────────────┐  │   (inspector)   │
│  ➤   │  │            viewport (WebGPU)                  │  │   tabs          │
│  ✎   │  │         + SafeZones overlay + HUD chips       │  │   fields        │
│  ⟨⟩  │  └──────────────────────────────────────────────┘  │   effects stack │
│      │                                                    │                 │
│ panel--left (project / media / effects / templates)        │                 │
├──────┴────────────────────────────────────────────────────┴─────────────────┤
│  timeline   transport · timecode · zoom · ruler · 5 tracks · keyframes       │  ← bottom
└───────────────────────────────────────────────────────────────────────────┘
```

Backed by the CSS classes in `styles.css`: `.app`, `.menubar`, `.workspace`, `.rail`, `.panel`,
`.stagecol`, `.viewport`, `.timeline`, `.tracks`, `.ruler`, `.lane`, `.clip`, `.keyframe`.

---

## Top menu bar

`MENUS` in `App.tsx` defines the menus. Implemented items are wired; the rest are placeholders that
mirror professional-editor vocabulary.

| Menu | Items |
|---|---|
| **File** | New Project (`Ctrl+N`) · Open Project… (`Ctrl+O`) · Import Media… (`Ctrl+I`) · Save (`Ctrl+S`) · **Save As…** (`Ctrl+Shift+S`) · **Export…** (`Ctrl+E`) |
| **Edit** | Undo · Redo · Cut · Copy · Paste · Delete · Preferences… |
| **Composition** | New Composition · Composition Settings… · Add to Render Queue |
| **Layer** | New Text Layer · New Shape Layer · New Null Object · New Camera · Pre-compose… |
| **Effect** | Browse Effects… · Remove All Effects |
| **Animation** | *(keyframe/preset actions)* |

**Wired today:** File → New/Open/Save/Save As/Export; the Save As dialog presents **format cards** for
JSON vs binary ([05-PROJECT-FORMAT](05-PROJECT-FORMAT.md)).

---

## Left tool rail

`nav.rail` holds the tool buttons (`rail__btn`), rendered from the `ICONS` map in
`components/Icon.tsx`. The rail also exposes Fit view and Settings.

Icon names include: `pointer`, `move`, `text`, `square`, `pen`, `hand`, `zoom`, `frame`, `play`,
`pause`, `stop`, `skipBack`, `skipFwd`, `record`, `scissors`, `copy`, `trash`, `undo`, `redo`,
`chevronDown/Up/Right/Left`, `close`, `check`, `plus`, `minus`, `layers`, `image`, plus genre icons
(`box`, `pen`, `chart`, `compass`, `film`, `search`).

> **Icon rule:** every icon is real 24×24-grid SVG path data — **no emoji, no font glyphs as icons**. This
> is enforced by using `Icon.tsx` exclusively.

---

## Left panel (project)

`aside.panel.panel--left` with `panel__tabs` + `panel__body.scroll-thin`. Tabs surface the engine data
and documents:

- **Modes** — creative modes from `window.studio.getModes()` (`modecard` / `modecard--active`).
- **Concepts** — generated + scored concepts (`conceptcard`, `score-track`/`score-fill`).
- **Effects** — VFX catalogue from `getVFXEffects()` (`cardgrid`/`card`).
- **Templates** — the twelve genre templates (`tplcard`).
- **Metaphors** — visual metaphors from `getMetaphors()`.
- **Genre** — the genre selector and workflow panel (`GenreSelector.tsx`).

While the bridge resolves, panels show **"Loading engine data…"** (`useEngineData().loading`).

---

## Canvas workspace

`stagecol` → `stagebar` (stage tabs) → `viewport`.

- **`WebGPUCanvas`** renders the composition live ([04-RENDERING](04-RENDERING.md)).
- **`SafeZones`** overlays the selected ratio's margins.
- **HUD chips** (`hud-chip`, `hud-chip--right`) show resolution, fps, LUT, and status.
- **Transform fields** (inspector) drive the canvas on the next frame.

---

## Right inspector

`aside.panel.panel--right` — contextual controls for the selection:

- Composition settings (name, width, height, fps, duration, background).
- **Transform fields** — x, y, scale, rotation, opacity → `packUniforms` → canvas.
- **Brand LUT** picker (`BrandLUTPanel.tsx`).
- **Safe-zone** controls (`SafeZoneControls`).
- **Effects stack** — drag-and-drop reorder, add, remove.
- **Export** — the `ExportPanel` ([07](07-EXPORT-PIPELINE.md)).

---

## Timeline

`section.timeline`:

- `timeline__bar` — transport (`tbtn`, `tbtn--play`, `tbtn--rec`), timecode (`timeline__tc`), zoom.
- `ruler` — time marks.
- `tracks` — the five lanes (`lane`) with track heads (`trackhead`).
- `clip` / `clip--active` — draggable, trimmable spans.
- `keyframe` — the diamonds on a clip.
- `playhead` — the current-time line.

All gestures map to pure transforms ([06-TIMELINE](06-TIMELINE.md)).

---

## Design tokens

`styles.css` opens with `@import "tailwindcss"` and an `@theme` block. **Deleting the import breaks the
entire UI** — every utility class depends on it.

| Token | Value | Use |
|---|---|---|
| `--color-ink` | `#07090d` | app background (the "deep ink") |
| `--color-ink-2` | `#0b0f16` | panels |
| `--color-ink-3` | `#111722` | raised surfaces |
| `--color-ink-4` | `#161d2b` | hover surfaces |
| `--color-line` | `#1b2230` | 1px borders |
| `--color-line-2` | `#2a3345` | stronger borders |
| `--color-text` | `#e9ecf3` | primary text |
| `--color-text-2` | `#b6bdcf` | secondary text |
| `--color-muted` | `#6f7789` | tertiary/labels |
| `--color-accent` | `#ff5a2c` | brand accent (action) |
| `--color-accent-2` | `#ffb347` | warm secondary |
| `--color-cool` | `#5eead4` | cool secondary (info/audio) |
| `--color-success` | `#34d399` | success |
| `--color-warning` | `#fbbf24` | warning |
| `--color-danger` | `#f87171` | error/destructive |

Genre accents: 3D/CGI `#a78bfa`, Narrative `#f472b6`, Corporate `#ff5a2c`, Explainer `#5eead4`,
Documentary `#ffb347`, Detective `#ef4444` ([09-GENRE-SYSTEM](09-GENRE-SYSTEM.md)).

---

## Component chrome vocabulary

Reusable classes so the UI stays consistent:

`.menubar` · `.dropdown` · `.iconbtn` (`--active`, `--primary`) · `.ctxbar` · `.rail` · `.panel`
(`--left`, `--right`) · `.sect` · `.row` (`--active`) · `.rowbtn` · `.field` · `.seg` · `.chip`
(`--accent`, `--cool`) · `.kbd` · `.stagecol` · `.stagebar` · `.stagetab` (`--active`) · `.viewport` ·
`.hud-chip` (`--right`) · `.timeline` · `.tbtn` (`--play`, `--rec`) · `.trackhead` · `.tracks` ·
`.ruler` · `.lane` · `.clip` (`--active`) · `.keyframe` · `.dialog` · `.playhead` · `.cardgrid` ·
`.card` (`--active`) · `.progress` · `.tplcard` · `.modecard` (`--active`) · `.conceptcard` ·
`.formrow` · `.btn` (`--primary`, `--block`) · `.err` · `.score-track`/`.score-fill` · `.truncate` ·
`.scroll-thin` · `.muted`.

---

## Interaction contracts

The following affordances are **wired**, not decorative:

| Affordance | Effect |
|---|---|
| Transform field edit | Live update to the WebGPU canvas |
| Clip drag | `moveClip` with snap-to-neighbours |
| Clip edge drag | `trimClip` |
| Lane click | `addKeyframe` at the playhead |
| Diamond drag | `moveKeyframe` |
| Diamond delete | `removeKeyframe` |
| Effect drop onto the stack | Reorder the effects stack |
| Genre template apply | Sets LUT, lays out beats, records presets |
| LUT pick | Live `packUniforms` change |
| Safe-zone toggle | Overlay on/off + ratio |

---

## Accessibility & lint constraints

The codebase enforces a clean `biome check`. Practical rules when editing the UI:

1. **Real buttons, not clickable divs.** Nested `<button>` inside `<button>` is invalid HTML — use
   `<div className="row">` with a `.rowbtn` plus separate `.iconbtn` buttons.
2. **No `role=` on divs** where a semantic element exists (`lint/a11y/useSemanticElements`).
3. **No `<label className="field">`** for read-only rows — `noLabelWithoutControl` flags it; use `<div>`.
4. **No `!important`** (`noImportantStyles`).
5. **File-level `// biome-ignore-all`** for the pointer-driven timeline surfaces (already present at the
   top of `App.tsx`): `noStaticElementInteractions`, `useKeyWithClickEvents`.
6. **Remove unused constants** — do not underscore-prefix them.
7. **CSS specificity:** `biome.json` disables `noDescendingSpecificity` for CSS.

See [19-QUALITY-AND-TESTS](19-QUALITY-AND-TESTS.md) for the verify commands.

---

Related: [01-PRODUCT](01-PRODUCT.md) · [06-TIMELINE](06-TIMELINE.md) · [09-GENRE-SYSTEM](09-GENRE-SYSTEM.md) ·
[18-BRAND-AND-LUTS](18-BRAND-AND-LUTS.md) · [22-COMPOSITOR](22-COMPOSITOR.md) · [23-COLOR](23-COLOR.md) ·
[26-CAPTIONS](26-CAPTIONS.md) · [30-RENDER-QUEUE](30-RENDER-QUEUE.md)
