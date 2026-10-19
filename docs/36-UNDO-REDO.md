# 36 — Undo/Redo & Command History

**Status: ⬜ (menu items and icons exist; no history stack implementation) · Code: `App.tsx` (stub) → target: `engine/history.ts`**

> The Edit menu has Undo (Ctrl+Z) and Redo (Ctrl+Y) items, and the toolbar has undo/redo icon
> buttons. **None of them are wired.** There is no history stack, no command pattern, no inverse
> operations anywhere in the codebase. This document specifies the system.

---

## 1. The gap, precisely

| Capability | Today |
|---|---|
| Undo menu item | ✅ exists, `Ctrl+Z` hint, no handler |
| Redo menu item | ✅ exists, `Ctrl+Y` hint, no handler |
| Toolbar undo/redo buttons | ✅ icons exist, no handlers |
| History stack | ⬜ none |
| Command pattern | ⬜ none |
| Keyboard shortcuts | ⬜ not wired |
| Crash recovery | ⬜ none |
| Multi-step undo | ⬜ none |
| Selective undo | ⬜ none |

The comment in `engine/timeline.ts` line 3 says the immutable transforms are "undo-friendly" — that
is the seed: every transform returns a new `TimelineDoc`, so undo is "keep the old doc."

---

## 2. The history model (target)

### 2.1 The command pattern

Every user action is a **command** — an object with `do` and `undo`:

```typescript
interface Command {
  id: string;
  label: string;              // human-readable: "Move Clip", "Add Keyframe"
  /** Apply the command, returning the new document. */
  do(doc: ProjectDocument): ProjectDocument;
  /** Reverse the command, returning the previous document. */
  undo(doc: ProjectDocument): ProjectDocument;
  /** Optional: merge with the previous command (for drags). */
  mergeWith?(prev: Command): Command | null;
}
```

### 2.2 The history stack

```typescript
interface History {
  past: Command[];            // undo stack (oldest → newest)
  future: Command[];          // redo stack (newest → oldest)
  limit: number;              // max history depth (default 100)
}

function pushHistory(history: History, command: Command): History
function undo(history: History): { history: History; command: Command | null }
function redo(history: History): { history: History; command: Command | null }
function canUndo(history: History): boolean
function canRedo(history: History): boolean
```

### 2.3 The document store

The history wraps the document:

```typescript
interface DocumentStore {
  doc: ProjectDocument;       // the current document
  history: History;
  /** Apply a command: push to past, clear future, update doc. */
  dispatch(command: Command): DocumentStore;
  /** Undo: pop from past, push to future, revert doc. */
  undo(): DocumentStore;
  /** Redo: pop from future, push to past, re-apply doc. */
  redo(): DocumentStore;
  /** Replace the document without recording (file load, etc.). */
  replace(doc: ProjectDocument): DocumentStore;
}
```

---

## 3. What gets undone

Every operation in the editor becomes a command:

| Operation | Command | Undo |
|---|---|---|
| Move clip | `MoveClipCommand` | move back to original position |
| Trim clip | `TrimClipCommand` | restore original range |
| Add keyframe | `AddKeyframeCommand` | remove the keyframe |
| Remove keyframe | `RemoveKeyframeCommand` | re-add the keyframe at its original time |
| Move keyframe | `MoveKeyframeCommand` | move back |
| Change easing | `SetEasingCommand` | restore previous easing |
| Add effect | `AddEffectCommand` | remove the effect |
| Remove effect | `RemoveEffectCommand` | re-add the effect |
| Reorder effect | `ReorderEffectCommand` | restore original order |
| Edit composition | `UpdateCompositionCommand` | restore previous values |
| Edit transform | `UpdateTransformCommand` | restore previous transform |
| Apply template | `ApplyTemplateCommand` | remove all template changes |
| Apply preset | `ApplyPresetCommand` | remove all preset changes |
| Add node | `AddNodeCommand` | remove the node |
| Remove node | `RemoveNodeCommand` | re-add the node |
| Add edge | `AddEdgeCommand` | remove the edge |
| Remove edge | `RemoveEdgeCommand` | re-add the edge |
| Edit parameter | `SetParamCommand` | restore previous value |
| Split clip | `SplitClipCommand` | merge the two clips |
| Delete clip | `DeleteClipCommand` | re-insert the clip |
| Any menu action | `MenuActionCommand` | dispatch the inverse |

### 3.1 Drag operations (merge)

A drag fires many `moveKeyframe` calls. Without merging, undo would step back one pixel at a time.
The `mergeWith` method coalesces consecutive drags into one command:

```typescript
class MoveKeyframeCommand implements Command {
  mergeWith(prev: Command): Command | null {
    if (prev instanceof MoveKeyframeCommand && prev.kfId === this.kfId) {
      return new MoveKeyframeCommand(this.clipId, this.kfId, prev.fromTime, this.toTime);
    }
    return null;  // different keyframe — don't merge
  }
}
```

### 3.2 Transient vs. persistent state

Not everything is undoable:

| State | Undoable? | Why |
|---|---|---|
| Clip/keyframe edits | ✅ | document transforms |
| Composition/transform edits | ✅ | document transforms |
| Node graph edits | ✅ | document transforms |
| Effect stack edits | ✅ | document transforms |
| Viewport zoom/pan | ❌ | view state, not document |
| Selected clip/node | ❌ | selection state, not document |
| Playhead position | ❌ | transport state |
| Track show/hide | ✅ | document state |

---

## 4. Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` / `Cmd+Shift+Z` | Redo |
| `Ctrl+S` / `Cmd+S` | Save (not undoable) |
| `Ctrl+Shift+S` | Save As |

---

## 5. History UI

### 5.1 History panel

A dockable **History panel** lists every command:

```
┌─────────────────────────────┐
│ History                     │
├─────────────────────────────┤
│ ● Move Clip "Hero Shot"     │  ← current (newest at top)
│ ○ Add Keyframe @ 2.4s       │
│ ○ Trim Clip "B-Roll"        │
│ ○ Apply Template "Anthem"   │
│ ○ Update Transform          │
│ ○ …                         │
└─────────────────────────────┘
```

- Click any entry to jump to that point in history (undo/redo to it).
- The current position is highlighted.
- The label describes what was done.

### 5.2 Toolbar buttons

- **Undo** button: enabled when `canUndo`, tooltip shows the command label ("Undo: Move Clip").
- **Redo** button: enabled when `canRedo`, tooltip shows the command label.

---

## 6. Selective undo

Sometimes you want to undo one specific action without undoing everything after it:

- **Right-click a history entry** → "Undo to here" — undoes everything after that entry.
- **Ctrl+click multiple entries** → undo only those.

---

## 7. Crash recovery

The history is persisted alongside the document:

```json
{
  "doc": { ... },
  "history": {
    "past": [ ... ],
    "future": [ ... ]
  }
}
```

On restart:

- The document loads with its full history.
- Undo/redo works across sessions.
- A crash mid-edit leaves the last saved state recoverable.

---

## 8. Multi-agent undo

In the agentic workflow ([31](31-AI-AGENTIC-SCALE.md)), multiple agents may edit the same document.
Each agent's edits are commands with an `agentId`:

```typescript
interface AgentCommand extends Command {
  agentId: string;
  branchId: string;           // which agent branch
}
```

This enables:

- **Per-agent undo:** undo everything agent A did, keep agent B's edits.
- **Conflict detection:** two agents editing the same property is flagged.
- **Selective merge:** merge agent A's undo without affecting agent B.

---

## 9. Verification

| Property | Test |
|---|---|
| Basic undo/redo | do → undo → redo returns the original doc |
| History limit | pushing past the limit drops the oldest entry |
| Drag merge | a 100-pixel drag undoes in one step |
| Transient state | zoom/pan/selection are not in history |
| Crash recovery | history survives save + reload |
| Multi-agent | per-agent undo only affects that agent's edits |
| No-op commands | a command that doesn't change the doc is not recorded |

---

Related: [37-SELECTION-AND-INTERACTION](37-SELECTION-AND-INTERACTION.md) · [32-KEYFRAME-ANIMATION](32-KEYFRAME-ANIMATION.md) ·
[31-AI-AGENTIC-SCALE](31-AI-AGENTIC-SCALE.md) · [06-TIMELINE](06-TIMELINE.md) · [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md)
