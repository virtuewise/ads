# 37 — Selection & Interaction Model

**Status: 🟡 (clip + node selection exist; multi-select, marquee, layer selection, and keyboard shortcuts are ⬜) · Code: `App.tsx`, `components/NodeEditor.tsx` → target: `engine/selection.ts`**

> The editor tracks `selectedClip`, `selectedMode`, `selectedEffect`, and `selectedPreset` in state,
> and the node editor tracks `selectedNode`. There is **no multi-selection, no marquee selection, no
> layer selection model, and no keyboard shortcut system**. This document specifies the complete
> interaction model.

---

## 1. What exists today

### 1.1 Selection state

```typescript
// App.tsx
const [selectedClip, setSelectedClip] = useState<string | null>(null);
const [selectedMode, setSelectedMode] = useState<string | null>(null);
const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

// useDAG.ts
const [selectedNode, setSelectedNode] = useState<string | null>(null);
```

Selection is **single-only** — one clip, one mode, one effect, one node. Selection drives the
inspector content.

### 1.2 What selection does

- **Selected clip** → inspector shows clip properties, keyframes, in/out points.
- **Selected node** → node editor highlights the node.
- **Selected mode** → inspector shows mode properties.
- **Selected effect** → inspector shows effect parameters.

### 1.3 What's missing

| Capability | Today |
|---|---|
| Single selection | ✅ clip, node, mode, effect |
| Multi-selection | ⬜ none |
| Marquee / rubber-band | ⬜ none |
| Layer selection | ⬜ no layer model |
| Select all / deselect | ⬜ none |
| Keyboard shortcuts | ⬜ none wired |
| Clipboard (cut/copy/paste) | ⬜ none |
| Context menus | ⬜ none |
| Drag-select on timeline | ⬜ none |
| Shift-click add to selection | ⬜ none |

---

## 2. The selection model (target)

### 2.1 The selection state

```typescript
interface Selection {
  /** Selected clips on the timeline */
  clips: string[];
  /** Selected nodes in the DAG */
  nodes: string[];
  /** Selected layers in the compositor */
  layers: string[];
  /** Selected effects in the stack */
  effects: string[];
  /** Selected keyframes */
  keyframes: string[];
  /** The "primary" selection (last clicked) — drives the inspector */
  primary: { kind: 'clip' | 'node' | 'layer' | 'effect' | 'keyframe'; id: string } | null;
}
```

### 2.2 Selection operations

```typescript
interface SelectionOps {
  select(sel: Selection, target: SelTarget, mode: 'replace' | 'add' | 'toggle' | 'range'): Selection;
  selectAll(sel: Selection, scope: 'clips' | 'nodes' | 'layers' | 'keyframes'): Selection;
  deselectAll(sel: Selection): Selection;
  selectInvert(sel: Selection, all: SelTarget[]): Selection;
  deleteSelected(sel: Selection): Selection;
  copySelected(sel: Selection): Clipboard;
  paste(sel: Selection, clipboard: Clipboard, at: number): Selection;
}
```

### 2.3 Selection modifiers

| Modifier | Behaviour |
|---|---|
| Click | replace selection with clicked item |
| Shift+Click | add clicked item to selection |
| Ctrl/Cmd+Click | toggle clicked item in selection |
| Ctrl/Cmd+A | select all (in scope) |
| Ctrl/Cmd+D | duplicate selected |
| Delete/Backspace | delete selected |
| Esc | deselect all |

---

## 3. Marquee selection

Rubber-band selection on the timeline and node editor:

### 3.1 Timeline marquee

Drag on empty timeline space → a rectangle → clips intersecting the rectangle are selected:

```
┌──────────────────────────────────────┐
│  ┌───┐     ┌─────┐     ┌───┐         │
│  │ A │     │  B  │     │ C │         │
│  └───┘     └─────┘     └───┘         │
│         ┌──────────┐                 │
│  ┌───┐  │ marquee  │  ┌───┐         │
│  │ D │  │          │  │ E │         │
│  └───┘  └──────────┘  └───┘         │
│         → selects B, D               │
└──────────────────────────────────────┘
```

### 3.2 Node editor marquee

Same behaviour in the node editor — drag a rectangle, nodes inside are selected for bulk move or
delete.

---

## 4. Layer selection

In the compositor ([22](22-COMPOSITOR.md)), layers are selectable:

- **Click a layer** in the layer list → select it.
- **Click on the canvas** → hit-test → select the topmost layer under the cursor.
- **Shift+click** → add to selection.
- **Drag selected layers** → move them on the canvas.
- **Transform handles** → scale, rotate, reposition directly on the canvas.

### 4.1 Canvas interaction

| Tool | Canvas behaviour |
|---|---|
| **Select (V)** | click to select, drag to move |
| **Move (W)** | drag to move selected |
| **Text (T)** | click to place text cursor |
| **Shape (U)** | drag to draw a shape |
| **Pen (P)** | click to add bezier points |
| **Hand (H)** | drag to pan the canvas |
| **Zoom (Z)** | click to zoom in, Alt+click to zoom out |

Today all tools are tracked but **none have canvas behaviour**.

---

## 5. Clipboard

### 5.1 Copy/paste

```typescript
interface Clipboard {
  items: ClipboardItem[];
  source: 'timeline' | 'nodes' | 'layers';
}

type ClipboardItem =
  | { kind: 'clip'; clip: TimelineClip }
  | { kind: 'node'; node: NodeInstance; edges: Edge[] }
  | { kind: 'layer'; layer: Layer }
  | { kind: 'effect'; effectId: string };
```

- **Copy** (`Ctrl+C`): serializes selected items to the clipboard.
- **Paste** (`Ctrl+V`): inserts at the playhead (timeline) or at the cursor (node editor).
- **Cut** (`Ctrl+X`): copy + delete.
- **Duplicate** (`Ctrl+D`): copy + paste in place.

### 5.2 Cross-project clipboard

Clipboard items serialize to JSON, so they can be pasted into another project — or into the same
project at a different time.

---

## 6. Context menus

Right-click context menus:

| Target | Menu |
|---|---|
| Clip | Split · Duplicate · Copy · Paste · Delete · Add Keyframe · Reverse Speed |
| Keyframe | Edit Easing · Copy · Delete · Hold |
| Node | Rename · Duplicate · Group · Delete · Add Input · Add Output |
| Layer | Pre-compose · Duplicate · Lock · Hide · Delete |
| Effect | Copy · Remove · Presets |
| Empty timeline | Add Clip · Add Text · Paste |

---

## 7. Keyboard shortcuts (complete)

### 7.1 Tools

| Key | Tool |
|---|---|
| `V` | Select |
| `W` | Move |
| `T` | Text |
| `U` | Shape |
| `P` | Pen |
| `H` | Hand |
| `Z` | Zoom |
| `Space` (hold) | Hand (temporary) |

### 7.2 Editing

| Key | Action |
|---|---|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+X` | Cut |
| `Ctrl+C` | Copy |
| `Ctrl+V` | Paste |
| `Ctrl+D` | Duplicate |
| `Delete` / `Backspace` | Delete selected |
| `Esc` | Deselect all |
| `Ctrl+A` | Select all |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save As |

### 7.3 Timeline

| Key | Action |
|---|---|
| `←` / `→` | Step one frame |
| `Shift+←` / `→` | Step ten frames |
| `Home` / `End` | Go to start / end |
| `Space` | Play / pause |
| `S` | Split at playhead |
| `K` | Add keyframe at playhead |
| `Alt+K` | Remove keyframe at playhead |
| `,` / `.` | Nudge clip left/right |

### 7.4 View

| Key | Action |
|---|---|
| `+` / `-` | Zoom in/out |
| `1` | Fit to window |
| `2` | Zoom to 100% |
| `F` | Toggle fullscreen |
| `Ctrl+K` | Quick Apply palette |

---

## 8. Missing timeline operations

The context toolbar has buttons with **no handlers**:

| Button | Status | Target |
|---|---|---|
| Split at playhead | ⬜ no handler | `splitClip(doc, clipId, time)` |
| Duplicate | ⬜ no handler | `duplicateClip(doc, clipId)` |
| Record | ⬜ no handler | keyframe recording mode |

These become real once the selection model and command history land.

---

## 9. Interaction contracts

Every interaction follows the same contract:

1. **Pointer down** → begin interaction (record start state).
2. **Pointer move** → update preview (live, non-destructive).
3. **Pointer up** → commit (dispatch a command to history).
4. **Pointer cancel** → revert (no command dispatched).

This is what makes every interaction undoable — the command is only committed on pointer-up.

---

## 10. Verification

| Property | Test |
|---|---|
| Single selection | clicking a clip selects it and updates the inspector |
| Multi-selection | shift+click adds to selection |
| Marquee | dragging a rectangle selects intersecting clips |
| Clipboard round-trip | copy → paste produces an identical clip |
| Delete | deleting a clip removes it and its keyframes |
| Keyboard shortcuts | every shortcut triggers the right action |
| Undo integration | every interaction is undoable via [36](36-UNDO-REDO.md) |

---

Related: [36-UNDO-REDO](36-UNDO-REDO.md) · [16-INTERFACE](16-INTERFACE.md) · [32-KEYFRAME-ANIMATION](32-KEYFRAME-ANIMATION.md) ·
[22-COMPOSITOR](22-COMPOSITOR.md) · [38-NODE-EDITOR](38-NODE-EDITOR-AND-VISUAL-PROGRAMMING.md)
