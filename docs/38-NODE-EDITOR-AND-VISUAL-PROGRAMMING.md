# 38 — Node Editor & Visual Programming

**Status: 🟡 (custom SVG node editor works; macros, debugging, compute nodes are ⬜) · Code: `components/NodeEditor.tsx`, `engine/compiler.ts`, `engine/nodes.ts`**

> The node editor is a custom SVG-based visual programming surface — not Monaco, not React Flow. It
> supports node palette drag, node dragging, port-to-port bezier connections, node selection, and
> deletion. Edge removal is stubbed. This document specifies the complete node editing experience.

---

## 1. What exists today

### 1.1 The editor surface

`components/NodeEditor.tsx` (321 lines) — a custom SVG editor:

- **Node palette** (left): drag a node type onto the canvas.
- **Node dragging**: move nodes on the canvas.
- **Port connections**: drag from an output port to an input port → cubic bezier edge.
- **Node selection**: click to select, showing the node's parameters.
- **Node deletion**: delete button on the selected node.
- **Edge removal**: `onRemoveEdge` prop is accepted but **ignored** — edges cannot be removed.

### 1.2 The node registry

14 node types in `engine/nodes.ts`:

| Category | Nodes |
|---|---|
| Source | `dataSource`, `colorSource`, `noiseSource` |
| Transform | `transform`, `ease`, `stagger` |
| Effect | `glow`, `blur`, `colorGrade`, `vignette` |
| Composite | `blend`, `alphaMerge` |
| Output | `render` |
| Script | `script` |

### 1.3 The compiler

`engine/compiler.ts` — `compileDAG(dag)`:

1. Kahn's topological sort (cycle detection).
2. For each node in order: emit a call line.
3. Find the `render` node; emit `return <srcVar>;`.
4. Wrap in a fragment shader with `{time, resolution, mouse}` uniforms.

**Known issues:** the compiler's uniform struct differs from `visual.ts`'s (no transform/LUT fields);
three node types have function-name mismatches that break WGSL; `uniforms: string[]` is always empty.

---

## 2. The gap, precisely

| Capability | Today |
|---|---|
| Node palette + drag | ✅ |
| Node connections | ✅ bezier edges |
| Node selection | ✅ |
| Node deletion | ✅ |
| Edge deletion | ⬜ stubbed |
| Macros / sub-graphs | ⬜ none |
| Live per-node preview | ⬜ none |
| Node debugging | ⬜ none |
| Compute nodes | ⬜ none |
| Node groups / folders | ⬜ none |
| Minimap | ⬜ none |
| Auto-layout | ⬜ none |
| Search / quick-add | ⬜ none |
| Parameter editing on node | ✅ (inspector) |

---

## 3. The node editor model (target)

### 3.1 Node authoring

Custom nodes are authored in TypeScript:

```typescript
interface NodeSpec {
  type: string;
  label: string;
  category: string;
  ports: Port[];
  params: ParamSpec[];
  /** CPU execution (for preview/export). */
  execute?: (inputs: Record<string, unknown>) => Record<string, unknown>;
  /** WGSL for the GPU path. */
  toWGSL?: () => string;
  /** Optional compute pass. */
  compute?: ComputeNodeSpec;
}
```

A node is registered in `NODE_REGISTRY` and immediately available in the palette, the inspector, and
the compiler.

### 3.2 Macros (sub-graphs)

A **macro** is a node that contains a sub-graph:

```typescript
interface MacroNode extends NodeSpec {
  /** The sub-graph inside this macro. */
  subGraph: DAG;
  /** Exposed parameters on the macro node. */
  exposedParams: string[];   // map macro param → sub-graph node param
}
```

Macros are the mechanism for reusable node networks — a "Bloom Chain" macro, a "Grade Chain" macro,
etc. They are the node-level equivalent of pre-compositions ([22](22-COMPOSITOR.md#nested-compositions-pre-comps)).

### 3.3 Live per-node preview

Each node shows a **live preview** of its output:

- **Source nodes** → thumbnail of the generated image.
- **Effect nodes** → before/after split view.
- **Composite nodes** → the composited result.
- **Transform nodes** → a graph of the transform curve.

The preview renders the sub-graph up to that node, using the same shader pipeline — so the preview is
exact, not approximate.

### 3.4 Node debugging

| Debug feature | What it shows |
|---|---|
| **Breakpoint** | pause execution at this node |
| **Inspect** | hover a port to see its current value |
| **Profile** | per-node execution time |
| **Scope** | highlight the sub-graph upstream of a node |
| **Error highlight** | nodes that fail to compile are outlined in red |

---

## 4. Edge model

### 4.1 Edge types

| Edge type | Visual | Meaning |
|---|---|---|
| **Data** (number) | thin gray line | scalar value |
| **Color** (vec3/vec4) | thick colored line | color value |
| **Texture** | thick gradient line | image data |
| **Event** | dashed line | trigger/control flow |

The edge visual reflects the data type, so the graph is readable at a glance.

### 4.2 Edge interactions

- **Create**: drag from output port to input port.
- **Remove**: right-click an edge → "Remove Edge"; or select + Delete.
- **Reroute**: drag an edge's midpoint to add a control point.
- **Disconnect**: drag an edge endpoint off its port.

---

## 5. Node groups

Related nodes can be grouped into a **folder**:

```
┌─ Grade Chain ─────────────────────────────┐
│  ┌────────┐    ┌────────┐    ┌─────────┐  │
│  │Primaries│───▶│ Curves │───▶│ LUT 3D  │  │
│  └────────┘    └────────┘    └─────────┘  │
└───────────────────────────────────────────┘
```

Groups can be collapsed (showing only external connections) or expanded. A group can be saved as a
macro.

---

## 6. Minimap & navigation

A minimap (bottom-right) shows the full graph at a glance:

- Viewport rectangle shows the current view.
- Click to jump.
- Nodes are colored by category.

Navigation: scroll to pan, pinch to zoom, `Ctrl+0` to fit.

---

## 7. Search & quick-add

`Ctrl+Space` (or `Ctrl+K` for Quick Apply) opens a fuzzy search:

- Search nodes by name, category, or port.
- Arrow keys to navigate, Enter to add.
- Recently-used nodes appear first.

---

## 8. Auto-layout

One-click auto-layout arranges nodes left-to-right by data flow:

```typescript
function autoLayout(dag: DAG): DAG  // returns a new dag with updated node positions
```

Options: horizontal, vertical, radial, force-directed.

---

## 9. The script node

The `script` node is the escape hatch — custom WGSL:

```typescript
// ScriptEditor.tsx — a textarea (not Monaco)
// User writes WGSL, clicks "Sync to Graph"
// The node's toWGSL() returns the custom code
```

**Target:** a real Monaco editor with WGSL syntax highlighting, IntelliSense, and error squiggles.
See [39](39-SCRIPTING-AND-EXPRESSIONS.md).

---

## 10. Verification

| Property | Test |
|---|---|
| Palette drag | dragging a node type onto the canvas adds that node |
| Connection | connecting output→input creates a valid edge |
| Edge removal | right-click → Remove deletes the edge |
| Compile | a valid graph compiles to WGSL without errors |
| Cycle detection | a cyclic graph reports "Cycle detected" |
| Macro | a macro node expands to its sub-graph |
| Live preview | each node shows its correct output |
| Auto-layout | a messy graph is arranged left-to-right |

---

Related: [03-ENGINE-CORE](03-ENGINE-CORE.md) · [27-EFFECTS-LIBRARY](27-EFFECTS-LIBRARY.md) ·
[39-SCRIPTING-AND-EXPRESSIONS](39-SCRIPTING-AND-EXPRESSIONS.md) · [22-COMPOSITOR](22-COMPOSITOR.md) ·
[34-TEMPLATES-AND-PRESETS](34-TEMPLATES-AND-PRESETS.md)
