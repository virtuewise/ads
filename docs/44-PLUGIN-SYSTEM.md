# 44 — Plugin & Extension System

**Status: ⬜ (no plugin system exists) · Code (target): `engine/plugins/*`, `main/pluginLoader.ts`**

> There is no plugin system today — no extension API, no third-party nodes, no custom effects. This
> document specifies the plugin architecture.

---

## 1. Why plugins

The core is real but no single team can build every feature. Plugins let:

- **Third parties** add nodes, effects, transitions, and formats.
- **Brands** ship custom templates, LUTs, and fonts as a package.
- **Agents** register new ops without modifying the core.
- **Users** install community extensions from a marketplace.

---

## 2. The plugin model

### 2.1 Plugin manifest

```json
{
  "id": "@acme/bloom-plus",
  "name": "Bloom+",
  "version": "1.2.0",
  "description": "Advanced bloom with chromatic aberration",
  "author": "ACME",
  "main": "./index.js",
  "virtue": {
    "minVersion": "1.0.0",
    "maxVersion": "2.0.0"
  },
  "permissions": ["node:register", "effect:register", "ui:panel"]
}
```

### 2.2 Plugin API

```typescript
interface PluginContext {
  /** Register a new node type. */
  registerNode(spec: NodeSpec): void;
  /** Register a new effect. */
  registerEffect(spec: EffectMeta): void;
  /** Register a new transition. */
  registerTransition(spec: TransitionSpec): void;
  /** Register a new export format. */
  registerFormat(spec: FormatSpec): void;
  /** Register a new panel in the UI. */
  registerPanel(spec: PanelSpec): void;
  /** Register a new op for the agent API. */
  registerOp(spec: OpSpec): void;
  /** Access the media index. */
  media: MediaIndex;
  /** Access the project document. */
  project: ProjectHandle;
  /** Logger. */
  log: Logger;
}

interface Plugin {
  id: string;
  activate(ctx: PluginContext): void | Promise<void>;
  deactivate(): void | Promise<void>;
}
```

### 2.3 Plugin lifecycle

```
install → validate → activate → running → deactivate → uninstall
```

- **Install:** copy to the plugins directory, validate the manifest.
- **Validate:** check version compatibility, permissions, and signature.
- **Activate:** call `activate(ctx)` — register everything.
- **Deactivate:** call `deactivate()` — unregister everything.
- **Uninstall:** remove from disk.

---

## 3. Plugin types

### 3.1 Node plugins

Add custom nodes to the DAG:

```typescript
// A plugin that adds a "Chromatic Aberration" node
export default {
  id: "chromatic-aberration",
  activate(ctx) {
    ctx.registerNode({
      type: "chromaticAberration",
      label: "Chromatic Aberration",
      category: "effect",
      ports: [
        { id: "input", type: "texture", direction: "input" },
        { id: "amount", type: "number", direction: "input", default: 5 },
        { id: "output", type: "texture", direction: "output" },
      ],
      toWGSL() { return `/* WGSL */`; },
    });
  },
};
```

### 3.2 Effect plugins

Add effects to the effects stack ([27](27-EFFECTS-LIBRARY.md)):

```typescript
ctx.registerEffect({
  type: "film-grain",
  label: "Film Grain",
  tier: "both",
  params: [{ key: "amount", type: "number", default: 0.5 }],
  fragment: `/* WGSL */`,
});
```

### 3.3 Transition plugins

Add transitions ([24](24-TRANSITIONS.md)):

```typescript
ctx.registerTransition({
  type: "glitch-cut",
  label: "Glitch Cut",
  duration: 0.3,
  fragment: `/* WGSL */`,
});
```

### 3.4 Format plugins

Add export formats ([41](41-RENDER-FORMAT-REFERENCE.md)):

```typescript
ctx.registerFormat({
  codec: "av1",
  container: "webm",
  label: "AV1 WebM",
  args: (settings) => ["-c:v", "libaom-av1", "-crf", "30"],
});
```

### 3.5 Panel plugins

Add custom UI panels:

```typescript
ctx.registerPanel({
  id: "color-schemer",
  title: "Color Schemer",
  component: ColorSchemerPanel,
  location: "right",
});
```

### 3.6 Op plugins

Add agent ops ([31](31-AI-AGENTIC-SCALE.md)):

```typescript
ctx.registerOp({
  id: "auto-reframe-ai",
  label: "AI Auto-Reframe",
  execute: (doc, params) => { /* ... */ return doc; },
});
```

---

## 4. Plugin sandboxing

Plugins run in a **sandboxed Web Worker**:

- No DOM access.
- No `fs`, `child_process`, or `node:*`.
- Only the provided `PluginContext` is accessible.
- Network access requires the `net:fetch` permission.
- Storage access requires the `storage:read` / `storage:write` permissions.

---

## 5. Plugin permissions

| Permission | Access |
|---|---|
| `node:register` | register custom nodes |
| `effect:register` | register custom effects |
| `transition:register` | register custom transitions |
| `format:register` | register export formats |
| `ui:panel` | add UI panels |
| `op:register` | register agent ops |
| `net:fetch` | network access |
| `storage:read` | read plugin storage |
| `storage:write` | write plugin storage |
| `media:analyze` | run analysis on media |

---

## 6. Plugin marketplace

A local-first marketplace:

- **Browse** plugins by category, rating, or author.
- **Install** with one click.
- **Update** when a new version is available.
- **Rate and review.**
- **Verify** — signed plugins show a verified badge.

---

## 7. Verification

| Property | Test |
|---|---|
| Install | a plugin appears in the plugin list and activates |
| Node registration | a plugin node appears in the node palette and compiles |
| Effect registration | a plugin effect appears in the effects stack and renders |
| Sandbox | a plugin cannot access `window` or `document` |
| Permissions | a plugin without `net:fetch` cannot make network requests |
| Deactivate | deactivating unregisters everything |
| Uninstall | uninstalling removes all traces |

---

Related: [27-EFFECTS-LIBRARY](27-EFFECTS-LIBRARY.md) · [38-NODE-EDITOR](38-NODE-EDITOR-AND-VISUAL-PROGRAMMING.md) ·
[31-AI-AGENTIC-SCALE](31-AI-AGENTIC-SCALE.md) · [46-SECURITY](46-SECURITY-AND-PERMISSIONS.md)
