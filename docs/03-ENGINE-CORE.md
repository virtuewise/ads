# 03 — Engine Core: DAG, Nodes & the WGSL Compiler

**Status: 🟡 (multi-pass viewport/export bridge implemented; multi-output ports, branched image passes, multi-input image effects, and compute runtime remain pending) · Code: `apps/electron/src/renderer/src/engine/{nodes,compiler,bridge,useDAG}.ts`**

> The heart of Virtue Studio is a **Directed Acyclic Graph** whose nodes are TypeScript classes. Each
> node knows how to *execute* (CPU semantics) and how to *emit WGSL* (GPU semantics). The compiler
> sorts the graph and assembles colour-only sections into fragment passes. Texture-sampling nodes split
> those passes, and the viewport renders the intermediate textures in order. The graph, the generated
> code, and the rendered pixels are three views of the same object.

---

## Why a DAG

A node graph is the only structure that satisfies all three of the vision's commitments at once:

1. **Visual and textual are the same thing** — nodes serialize to JSON, and JSON renders back as nodes.
2. **Composable and inspectable** — a complex grade is a chain of small, individually testable steps.
3. **Compilable** — a topologically sorted DAG maps trivially onto a straight-line sequence of WGSL
   function calls with no branches.

The graph lives in `DAG` (`engine/types.ts`):

```typescript
interface DAG {
  nodes: NodeInstance[];   // { id, type, position, inputs, outputs, code? }
  edges: Edge[];           // { id, from:{node,port}, to:{node,port} }
}
```

---

## The port type system

Every port has one of six types. Ports give the graph its grammar — you cannot wire a color into a
number input without the type being visibly wrong.

| `PortType` | Meaning | WGSL mapping |
|---|---|---|
| `texture` | An image / frame buffer | `vec4<f32>` |
| `number` | A scalar | `f32` |
| `color` | An RGB color | `vec3<f32>` / `vec4<f32>` |
| `boolean` | A flag | `bool` |
| `audio` | An audio buffer | *(planned — [11](11-GENRE-NARRATIVE.md))* |
| `string` | An enum / label | *(compile-time only)* |

A port is `{ id, name, type, direction: 'input'|'output', default? }`. The `id` is the stable key edges
reference; `name` is what the user sees.

---

## Node classes

All nodes extend `BaseNode` (`engine/nodes.ts`):

```typescript
abstract class BaseNode {
  abstract readonly type: string;
  abstract readonly label: string;
  abstract readonly category: 'source' | 'transform' | 'effect' | 'composite' | 'output' | 'script';
  abstract readonly ports: Port[];
  abstract execute(inputs: Record<string, unknown>): Record<string, unknown>;
  abstract toWGSL(): string;
  toJSON() { /* { type, label, category, ports } */ }
}
```

### Registered nodes (14)

| `type` | Class | Category | Purpose | WGSL entry point |
|---|---|---|---|---|
| `dataSource` | `DataSourceNode` | source | Ramp / value source | `data_source()` |
| `colorSource` | `ColorSourceNode` | source | Solid brand color | `color_source()` |
| `noiseSource` | `NoiseSourceNode` | source | Procedural noise | `noise_source(scale)` |
| `transform` | `TransformNode` | transform | `input * scale + offset` | `transform(input,scale,offset)` |
| `ease` | `EaseNode` | transform | Easing curve | `ease(t)` |
| `stagger` | `StaggerNode` | transform | Staggered delay | `stagger(t,index,delay)` |
| `glow` | `GlowNode` | effect | Additive glow | `glow(color,intensity)` |
| `blur` | `BlurNode` | effect | 3×3 Gaussian blur | `blur(color,radius)` |
| `colorGrade` | `ColorGradeNode` | effect | Lift/gamma/gain | `color_grade(color,lift,gamma,gain)` |
| `vignette` | `VignetteNode` | effect | Vignette darkening | `vignette(color,intensity)` |
| `blend` | `BlendNode` | composite | `mix(a,b,opacity)` | `blend(a,b,opacity)` |
| `alphaMerge` | `AlphaMergeNode` | composite | Alpha over | `alpha_merge(fg,bg)` |
| `render` | `RenderNode` | output | Terminal output node | *(none — emits a comment)* |
| `script` | `ScriptNode` | script | User WGSL/JS | *(raw code)* |

Nodes are looked up by string type through `NODE_REGISTRY`; `createNode(type)` instantiates one.

> **Implementation note:** `BlurNode` uses a 3×3 binomial Gaussian kernel with a zero-radius
> identity guard. `VignetteNode` computes radial falloff from the fragment coordinates. A number of
> other advanced nodes remain planned or have placeholder behavior; see [21-ROADMAP](21-ROADMAP.md).

---

## The compiler

`compileDAG(dag)` in `engine/compiler.ts` returns:

```typescript
interface CompiledShader {
  wgsl: string;        // the full fragment shader
  entryPoint: string;  // 'fs'
  uniforms: string[];  // (reserved)
  errors: string[];    // cycle / unknown-type / execution errors
}
```

### What it does, step by step

1. **Build the adjacency graph** and in-degree map from `nodes` + `edges`.
2. **Topologically sort** with Kahn's algorithm. If `sorted.length !== nodes.length`, a **cycle** is
   reported in `errors`.
3. **For each node in order:**
   - Instantiate it via `createNode(node.type)` (unknown types become errors, not crashes).
   - **Collect inputs**: start from `node.inputs`, then override with the *variable name* produced by
     any connected upstream port (`outputVars.get("node:port")`).
   - Call `instance.execute(inputs)` — this is where a node computes its CPU result and decides its
     output variable name.
   - Append `instance.toWGSL()` to the function list.
   - Emit the call line: `let nN_port = type(args…);` mapping each input port to either an upstream
     variable, a numeric literal, or `0.0`.
4. **Find the `render` node** and emit `return <its input var>;`.
5. **Assemble** the shader with a standard `Uniforms` struct (`time`, `resolution`, `mouse`) and a
   `@fragment fn fs` entry point.

### The generated shader shape

```wgsl
struct Uniforms { time: f32, resolution: vec2<f32>, mouse: vec2<f32> };
@group(0) @binding(0) var<uniform> u: Uniforms;

fn data_source() -> f32 { return 0.5; }
fn transform(input: f32, scale: f32, offset: f32) -> f32 { return input * scale + offset; }
// …one fn per node…

@fragment
fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = fragCoord.xy / u.resolution;
  let n0_values = data_source();
  let n1_output = transform(n0_values, 1.5, 0.0);
  // …
  return n4_input;
}
```

> **Graph passes plus a composite wrapper:** `compileDAG` produces one fragment shader per pass.
> `bridgeDAGToComposite` in `engine/bridge.ts` wraps each pass with the shared vertex and uniform
> contract:
>
> 1. compile the graph;
> 2. split at texture-sampling nodes and connect each pass to the texture rendered by its predecessor;
> 3. apply the inverse transform in the first pass and opacity plus the three-point LUT in the
>    presented pass;
> 4. compile the same pass program for the viewport and offline exporter.
>
> The exporter resolves the active shot look, media frame, and painted title textures at each composition
> time. GPU byte-for-byte parity still needs manual verification on supported hardware (see
> [04-RENDERING](04-RENDERING.md)).
>
> ### Bindings
>
> The compiler reserves the bind-group slots, so the renderer always knows where to put things:
>
> | Binding | Resource | Present when |
> |---|---|---|
> | 0 | the uniform block | always |
> | 1–2 | `media_tex` / `media_samp` for the active frame | a pass contains a `mediaSource` |
> | 1–4 | `seg_in` / `seg_in_samp` for the preceding pass | a pass samples an earlier pass (uses 3–4 when media occupies 1–2) |
> | 9+ | app-painted texture/sampler pairs, such as titles | a pass contains a text or matte node |
>
> Effects that need two independent image inputs (for example `displacementMap`) report a compiler
> error until the compositor supports multiple upstream images in one pass.
>
> The current multipass renderer also preserves only the final colour produced by each pass. Graphs
> that connect an effect or composite to an earlier branch across a pass boundary report a compiler
> error instead of sampling a different branch by accident. Full branched image graphs require
> multiple retained pass outputs and are still pending.
>
> A **media source is a leaf**: it samples a texture the compositor supplies and returns a colour at
> a given `uv`. That fits the single pass exactly — nothing upstream produces a texture — so a
> media graph bridges and renders. See [29-MEDIA-PIPELINE](29-MEDIA-PIPELINE.md#zero-copy-to-the-gpu).

---

## Code ⟷ nodes interchange

This is what makes the Monaco editor and the visual graph the same thing.

### `serializeDAG(dag)` / `deserializeDAG(json)`

Plain JSON round-trip — used by the project document (`effectsStack`/`graph`) and by save/load.

### `dagToCode(dag) → string`

Renders the graph as an editable TypeScript module:

```typescript
// Virtue Studio — Generated from Node Graph
// Edit this code and it will sync back to the node graph.

export const nodeGraph = {
  nodes: [
    { type: 'dataSource', position: { x: 40, y: 80}, inputs: {} },
    // …
  ],
  edges: [
    { from: 'n1:values', to: 'n2:input' },
    // …
  ],
};

// Custom functions
<contents of every Script node>
```

### `codeToDAG(code) → DAG | null`

Parses the `export const nodeGraph = {…};` block back into a `DAG`. Node ids are regenerated as
`node-<i>` and edges as `edge-<i>`. Returns `null` on parse failure (so the editor can leave the graph
untouched rather than corrupt it).

### Round-trip guarantee

`codeToDAG(dagToCode(dag))` reconstructs the topology (node types, positions, inputs, edges) — though
ids are reassigned. This is why the ScriptEditor can write back into the graph live.

---

## The store: `useDAG()`

`engine/useDAG.ts` is a React hook holding `{ dag, code, compiled, selectedNode }` and exposing
mutations. **Every mutation recompiles and regenerates code** so the three views never diverge.

| Action | Signature | Behaviour |
|---|---|---|
| `addNode` | `(type, position) => id` | Appends node; recompiles; regenerates code |
| `removeNode` | `(id)` | Removes node **and its incident edges** |
| `updateNode` | `(id, partial)` | Merges fields (inputs, position, code) |
| `addEdge` | `(from, to)` | Adds edge; recompiles |
| `removeEdge` | `(id)` | Removes edge |
| `syncFromCode` | `(code)` | Parses code → DAG; recompiles. No-op if parse fails |
| `resetDAG` | `()` | Restores `DEFAULT_DAG` |
| `loadDAG` | `(dag)` | Wholesale replace (project load / undo) |
| `nodeTypes` | | `getNodeTypes()` for the palette |

`DEFAULT_DAG` seeds a working chain: `dataSource → transform(1.5) → ease(easeInOut) → glow(0.3) → render`.

---

## Adding a node — the checklist

1. **Write the class** in `engine/nodes.ts`, extending `BaseNode`. Declare `type`, `label`, `category`,
   `ports`.
2. **Implement `execute`** — what the node computes on CPU. This decides its output variable names.
3. **Implement `toWGSL`** — a valid WGSL `fn`. Keep the name matching the node `type` (the compiler
   calls it as `type(...)`).
4. **Register it** in `NODE_REGISTRY`.
5. **Test it** — the compiler has tests; add coverage for the new node's WGSL and execution. See
   [19-QUALITY-AND-TESTS](19-QUALITY-AND-TESTS.md).
6. **Document it** — add a row to the node table above.

> **Constraint:** the compiler currently emits `let nN_port = type(inputPorts…)` for the **first output
> port only**. If your node needs multiple outputs, extend the compiler (and document the change here).

---

## Known limits

- **One output port per node** is wired through by the compiler today.
- **`ScriptNode.execute` uses `new Function(...)`** — fine for trusted/local use, but it is a
  code-execution surface; keep it local-only.
- **The node shader and the composite shader are not yet joined** — the DAG does not yet feed the
  viewport's compositor. See [21-ROADMAP](21-ROADMAP.md) and the architectural target in
  [22-COMPOSITOR](22-COMPOSITOR.md).
- **Cycles are detected but not rendered as errors in the UI** — the error string is produced; surfacing
  it is a roadmap item.

---

Related: [04-RENDERING](04-RENDERING.md) · [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md) ·
[08-SCRIPTING-API](08-SCRIPTING-API.md) · [16-INTERFACE](16-INTERFACE.md)
