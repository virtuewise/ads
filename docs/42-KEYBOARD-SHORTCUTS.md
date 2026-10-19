# 42 — Keyboard Shortcuts & Power User Guide

**Status: 🟡 (Quick Apply palette works; most shortcuts are ⬜) · Code: `App.tsx` (Quick Apply) → target: full shortcut system**

> The only keyboard-driven feature today is the **Quick Apply palette** (`Ctrl+K`) — a fuzzy search
> across effects, fonts, modes, and grammars. Most editing shortcuts (undo/redo, split, play/pause)
> are **not wired**. This document is the complete shortcut reference.

---

## 1. What exists today

### 1.1 Quick Apply (`Ctrl+K`)

A fuzzy-search palette (lines 2154–2192 in `App.tsx`):

- Searches effects, fonts, modes, grammars.
- Arrow keys to navigate, Enter to select.
- Selecting an item navigates to the relevant tab.

### 1.2 Menu hints (display-only)

Menu items show keyboard hints (`Ctrl+Z`, `Ctrl+S`, etc.) but the underlying actions are mostly
stubs. The hints document the *intended* shortcuts.

---

## 2. Complete shortcut reference (target)

### 2.1 Tools

| Key | Tool | Action |
|---|---|---|
| `V` | Select | click to select, drag to move |
| `W` | Move | drag to move selected |
| `T` | Text | click to place text |
| `U` | Shape | drag to draw a shape |
| `P` | Pen | click to add bezier points |
| `H` | Hand | drag to pan canvas |
| `Z` | Zoom | click to zoom in, Alt+click to out |
| `Space` (hold) | Hand (temp) | temporary pan |
| `1` | Fit | fit composition to window |
| `2` | 100% | zoom to actual pixels |
| `F` | Fullscreen | toggle fullscreen |

### 2.2 Editing

| Key | Action |
|---|---|
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` / `Cmd+Shift+Z` | Redo |
| `Ctrl+X` | Cut |
| `Ctrl+C` | Copy |
| `Ctrl+V` | Paste |
| `Ctrl+D` | Duplicate |
| `Delete` / `Backspace` | Delete selected |
| `Esc` | Deselect all |
| `Ctrl+A` | Select all |
| `Ctrl+S` / `Cmd+S` | Save |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+K` | Quick Apply palette |

### 2.3 Timeline

| Key | Action |
|---|---|
| `←` / `→` | Step one frame |
| `Shift+←` / `→` | Step ten frames |
| `Home` / `End` | Go to start / end |
| `Space` | Play / pause |
| `S` | Split clip at playhead |
| `K` | Add keyframe at playhead |
| `Alt+K` | Remove keyframe at playhead |
| `,` / `.` | Nudge clip left/right (one frame) |
| `Shift+,` / `Shift+.` | Nudge clip (ten frames) |
| `L` | Loop playback |
| `O` | Toggle onion skin |
| `M` | Add marker |

### 2.4 Keyframe editing

| Key | Action |
|---|---|
| `Alt+click` keyframe | Remove keyframe |
| `Shift+click` keyframe | Add to selection |
| `Ctrl+click` keyframe | Toggle in selection |
| `←` / `→` (keyframe selected) | Nudge keyframe time |
| `Alt+←` / `→` | Nudge keyframe value |
| `F9` | Easy Ease selected keyframes |
| `Shift+F9` | Easy Ease In |
| `Ctrl+Shift+F9` | Easy Ease Out |

### 2.5 View & navigation

| Key | Action |
|---|---|
| `+` / `-` | Zoom in/out |
| `Ctrl+0` | Fit to window |
| `Ctrl+1` | Zoom to 100% |
| `Ctrl+Scroll` | Zoom canvas |
| `Alt+Scroll` | Scroll timeline |
| `Ctrl+Shift+H` | Toggle safe zones |
| `Ctrl+Shift+G` | Toggle grid |
| `Ctrl+Shift+L` | Toggle guides |
| `Tab` | Cycle panels |

### 2.6 Layer & node

| Key | Action |
|---|---|
| `Ctrl+G` | Group selected nodes |
| `Ctrl+Shift+G` | Ungroup |
| `Ctrl+Shift+C` | Create macro from selection |
| `Ctrl+Shift+M` | Edit macro |
| `Ctrl+F` | Find node |
| `Shift+A` | Add node (contextual) |

---

## 3. Custom shortcuts

Users can remap shortcuts:

```json
{
  "shortcuts": {
    "edit.undo": "Ctrl+Z",
    "timeline.split": "S",
    "tools.text": "T"
  }
}
```

Stored in app data, per-user, exportable.

---

## 4. Power user workflows

### 4.1 Rapid assembly

```
1. Ctrl+K → search template → Enter (applies template)
2. Ctrl+K → search footage → Enter (adds to timeline)
3. K → add keyframe → drag to animate
4. Ctrl+K → search transition → Enter (applies transition)
5. Ctrl+S → save
```

### 4.2 Precision editing

```
1. → → → (step frames to the cut)
2. S (split at playhead)
3. Delete (remove the section)
4. Ctrl+D (duplicate the next section)
5. Alt+← → (nudge to close the gap)
```

### 4.3 Keyframe animation

```
1. Select clip → K (add start keyframe)
2. → (move playhead) → K (add end keyframe)
3. Drag the end keyframe diamond to set the value
4. Alt+drag a bezier handle to shape the curve
5. F9 (Easy Ease)
```

---

## 5. Shortcut conflicts

| Conflict | Resolution |
|---|---|
| `Space` = play vs hand | hold Space = hand, tap = play |
| `S` = split vs save | `Ctrl+S` = save, `S` = split |
| `K` = keyframe vs kilobyte | context-dependent (timeline vs file) |

---

## 6. Verification

| Property | Test |
|---|---|
| Every shortcut works | each shortcut triggers the right action |
| No conflicts | no two shortcuts in the same context do the same thing |
| Custom remap | a remapped shortcut works and persists |
| Quick Apply | `Ctrl+K` opens the palette, Enter selects |
| Menu hints match | every menu hint matches the actual shortcut |

---

Related: [37-SELECTION-AND-INTERACTION](37-SELECTION-AND-INTERACTION.md) · [36-UNDO-REDO](36-UNDO-REDO.md) ·
[32-KEYFRAME-ANIMATION](32-KEYFRAME-ANIMATION.md) · [16-INTERFACE](16-INTERFACE.md)
