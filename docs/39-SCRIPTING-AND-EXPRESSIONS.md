# 39 — Scripting & Expressions

**Status: 🟡 (script node + window.studio bridge exist; expression language is ⬜) · Code: `engine/nodes.ts` (ScriptNode), `preload/index.ts`, `engine/compiler.ts` → target: `engine/expressions.ts`**

> The scripting surface today is two things: the **script node** (custom WGSL via a textarea) and the
> **`window.studio` bridge** (data access + export from JS/TS). There is **no expression language** —
> no per-frame expressions, no property-to-property linking, no Math.eval on parameters. This
> document specifies the full scripting model.

---

## 1. What exists today

### 1.1 The script node

```typescript
// engine/nodes.ts — ScriptNode
// Ports: input (number), code (string), output (number)
// execute: new Function('input', code) — runs user JS
// toWGSL: returns the code as WGSL (passthrough)
```

The script node runs user-provided JavaScript via `new Function('input', code)` on the CPU, and
passes the code through as WGSL on the GPU. The two paths are **not guaranteed to match** — the JS
path is a preview, the WGSL path is the export. This is a correctness hazard.

### 1.2 The `window.studio` bridge

`preload/index.ts` exposes `window.studio` with:

| Category | Methods |
|---|---|
| Engine data | `getModes`, `getConcepts`, `generateConcepts`, `getMetaphors`, `getStats`, `getTypographyPresets`, `getVFXEffects`, `getVisualGrammars` |
| Project | `saveProject`, `openProject`, `writeProject`, `readProject` |
| Export | `probeEncoders`, `chooseExportPath`, `startExport`, `writeExportFrame`, `finishExport`, `cancelExport`, `onExportProgress` |

All are `ipcRenderer.invoke` wrappers. No `fs`, `child_process`, or `node:*` is exposed.

### 1.3 Code ⟷ node interchange

`engine/compiler.ts`:

- `dagToCode(dag)` → a JS module string with the node graph as a JS object.
- `codeToDAG(code)` → parses the JS back into a DAG.

This is the "dual programmability" — the same graph is editable as code or as nodes.

---

## 2. The gap, precisely

| Capability | Today |
|---|---|
| Script node (custom WGSL/JS) | ✅ textarea, `new Function` |
| `window.studio` bridge | ✅ data + export |
| Code ⟷ node interchange | ✅ `dagToCode` / `codeToDAG` |
| Expression language | ⬜ none |
| Property linking | ⬜ none |
| Per-frame expressions | ⬜ none |
| Math evaluation | ⬜ none |
| Monaco editor | ⬜ textarea |
| WGSL syntax highlighting | ⬜ none |
| Expression debugging | ⬜ none |
| Sandboxed script execution | ⬜ `new Function` is unsandboxed |

---

## 3. The expression language (target)

An expression is a formula that computes a property value from other properties and time:

```typescript
interface Expression {
  /** The expression source, e.g. "opacity * 2 + sin(time)" */
  source: string;
  /** The compiled function. */
  evaluate: (scope: ExpressionScope) => number;
}

interface ExpressionScope {
  time: number;
  /** Other properties on the same clip. */
  self: Record<string, number>;
  /** Properties on other clips (by id). */
  clips: Record<string, Record<string, number>>;
  /** Composition-level values. */
  comp: { width: number; height: number; fps: number; duration: number };
  /** Built-in functions. */
  fn: MathFunctions;
}
```

### 3.1 Syntax

A safe subset of JavaScript math — no `new Function`, no side effects:

| Category | Examples |
|---|---|
| Arithmetic | `+ - * / % **` |
| Math functions | `sin cos tan abs floor ceil round sqrt pow exp log min max clamp lerp` |
| Time | `time`, `frame`, `fps` |
| Properties | `self.opacity`, `clips["hero"].scale` |
| Constants | `pi`, `e` |
| Conditionals | `a > b ? x : y` |

### 3.2 Compilation

Expressions compile to both JS (CPU preview) and WGSL (GPU export):

```typescript
function compileExpression(source: string): Expression {
  // Parse → AST → validate (no side effects) → emit JS + WGSL
}
```

The same expression produces identical results on CPU and GPU — the determinism contract.

---

## 4. Property linking

Properties can be **linked** to other properties:

```typescript
interface PropertyLink {
  from: { clipId: string; property: string };
  to: { clipId: string; property: string };
  expression?: string;  // optional transform, e.g. "value * 2"
}
```

Example: link clip B's `scale` to clip A's `x` — as A moves, B scales. The link is evaluated
per-frame and is fully deterministic.

---

## 5. Per-frame scripting

For complex animations, a per-frame script runs on the CPU:

```typescript
interface FrameScript {
  /** Called for every frame. */
  tick(frame: number, time: number, state: FrameState): Partial<TransformState>;
}

interface FrameState {
  doc: ProjectDocument;
  playhead: number;
  playing: boolean;
}
```

Use cases: procedural camera paths, physics simulation, audio-reactive motion.

---

## 6. Monaco editor (target)

The script editor becomes a real Monaco:

- **WGSL mode** for script nodes (syntax highlighting, IntelliSense, error squiggles).
- **Expression mode** for property expressions (auto-complete for `self`, `clips`, `fn`).
- **JS mode** for the `window.studio` scripting console.
- **Diff view** for code ⟷ node interchange.

---

## 7. Sandboxed execution

`new Function` is unsandboxed — user code can access `window`, `fetch`, `localStorage`. The target:

```typescript
function runSandboxed(code: string, scope: Record<string, unknown>): unknown {
  // Run in a Web Worker with no DOM, no network, no storage.
  // Only the provided scope is accessible.
}
```

Script nodes and expressions run in a sandboxed worker, so a malicious or buggy script cannot
compromise the app.

---

## 8. The scripting API (agent surface)

The `window.studio` bridge is the agent's primary interface. The v2 API ([31](31-AI-AGENTIC-SCALE.md))
adds **verbs** — high-level deterministic ops:

```typescript
studio.ops = {
  applyGenre(geno: GenreId): Doc;
  setComposition(patch: Partial<CompositionState>): Doc;
  autoCaption(opts: CaptionOptions): Doc;
  gradeShotMatch(refFrame: number): Doc;
  applyPreset(id: string, params: Record<string, unknown>): Doc;
  addTransition(afterClipId: string, presetId: string): Doc;
  exportVariants(variants: VariantSpec[]): Manifest;
};
```

Every op is a pure document transform — diffable, undoable, safe to run on branches.

---

## 9. Verification

| Property | Test |
|---|---|
| Script node CPU == GPU | JS and WGSL paths produce the same value for the same input |
| Expression CPU == GPU | compiled expression matches on both paths |
| Expression safety | `new Function`, `fetch`, `localStorage` are rejected |
| Link evaluation | a linked property updates when its source changes |
| Per-frame script | `tick` is called once per frame with correct time |
| Sandbox | a script cannot access `window` or `document` |
| Code ⟷ node | `dagToCode` → `codeToDAG` round-trips |

---

Related: [08-SCRIPTING-API](08-SCRIPTING-API.md) · [03-ENGINE-CORE](03-ENGINE-CORE.md) ·
[31-AI-AGENTIC-SCALE](31-AI-AGENTIC-SCALE.md) · [32-KEYFRAME-ANIMATION](32-KEYFRAME-ANIMATION.md) ·
[40-ANIMATION-PRINCIPLES](40-ANIMATION-PRINCIPLES.md)
