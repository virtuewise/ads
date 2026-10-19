# 46 — Security & Permissions Model

**Status: 🟡 (contextBridge isolation exists; no permission system) · Code: `preload/index.ts`, `main/index.ts` → target: `engine/security/*`**

> The preload uses `contextBridge.exposeInMainWorld` — the renderer never gets `fs` or
> `child_process`. That's the seed of a security model. This document specifies the complete
> security architecture.

---

## 1. What exists today

### 1.1 Process isolation

The Electron app uses a standard three-process architecture:

```
┌─────────────────────────────────────────────────────┐
│ Main Process (Node.js)                              │
│  - fs, child_process, ffmpeg                        │
│  - IPC handlers (ipcMain.handle)                    │
│  - No DOM, no window                                │
└──────────────────────┬──────────────────────────────┘
                       │ contextBridge
┌──────────────────────▼──────────────────────────────┐
│ Preload Script                                      │
│  - window.studio = { engine.*, project.*, export.* }│
│  - ipcRenderer.invoke wrappers only                │
│  - No fs, no child_process                         │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│ Renderer Process (Chromium)                         │
│  - React app                                        │
│  - WebGPU                                           │
│  - No fs, no child_process                          │
└─────────────────────────────────────────────────────┘
```

### 1.2 What's exposed

`preload/index.ts` exposes `window.studio` with:

- **Engine data** — read-only creative data (modes, concepts, metaphors, fonts, effects, grammars).
- **Project I/O** — `saveProject`, `openProject`, `writeProject`, `readProject` (via IPC to main).
- **Export** — `probeEncoders`, `chooseExportPath`, `startExport`, `writeExportFrame`, etc.

**Not exposed:** `fs`, `child_process`, `node:*` modules, `require`, `process`.

### 1.3 What's missing

| Capability | Today |
|---|---|
| Process isolation | ✅ contextBridge |
| Permission system | ⬜ none |
| Plugin sandbox | ⬜ none (no plugins) |
| Script sandbox | ⬜ `new Function` is unsandboxed |
| IPC validation | ⬜ no input validation |
| CSP | ⬜ none |
| Audit logging | ⬜ none |

---

## 2. The permission model (target)

### 2.1 IPC permissions

Every IPC handler declares its required permission:

```typescript
// main/ipc.ts
ipcMain.handle('project:write', async (event, filePath, doc, format) => {
  // Permission: 'fs:write'
  // Validate: filePath is within the project directory
  // Validate: doc matches the expected schema
  // Audit: log the write
});
```

| Permission | Access |
|---|---|
| `fs:read` | read project files |
| `fs:write` | write project files |
| `fs:list` | list directory contents |
| `media:probe` | probe media files |
| `media:import` | import media files |
| `export:run` | run ffmpeg export |
| `net:fetch` | network access (AI generation) |
| `ui:notify` | show notifications |

### 2.2 Input validation

Every IPC handler validates its inputs:

```typescript
function validateProjectDoc(doc: unknown): ProjectDocument {
  // Type-check every field
  // Reject unknown fields
  // Clamp numeric ranges
  // Return a normalized doc
}
```

Malformed input never crashes the app — it's rejected with a precise error.

---

## 3. Script sandbox

### 3.1 The problem

`ScriptNode` uses `new Function('input', code)` — unsandboxed. User code can:

- Access `window`, `document`, `localStorage`.
- Make network requests.
- Spawn processes (via `require` if available).
- Corrupt the document.

### 3.2 The solution

Run scripts in a **Web Worker** with no DOM, no network, no storage:

```typescript
// main/worker.ts
self.onmessage = (e) => {
  const { code, scope } = e.data;
  const fn = new Function(...Object.keys(scope), code);
  const result = fn(...Object.values(scope));
  self.postmessage({ result });
};
```

The worker has:

- **No DOM** — `window`, `document` are undefined.
- **No network** — `fetch`, `XMLHttpRequest` are undefined.
- **No storage** — `localStorage`, `indexedDB` are undefined.
- **Only the provided scope** — the function receives only the declared inputs.

### 3.3 WGSL safety

WGSL runs on the GPU — it's a sandboxed shading language with no side effects. The risk is **infinite
loops** (a WGSL `for` loop with a huge bound). The fix: a **timeout** — the render pass is aborted if
it exceeds a time budget.

---

## 4. Content Security Policy

### 4.1 CSP headers

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self';
  font-src 'self';
  worker-src 'self' blob:;
```

- **No remote scripts** — all JS is bundled locally.
- **No remote styles** — all CSS is bundled locally.
- **No remote fonts** — fonts are bundled or system.
- **Workers** — only blob URLs (inline workers).

---

## 5. Audit logging

Security-relevant actions are logged:

```typescript
interface AuditLogEntry {
  action: string;           // "project:write", "export:start", etc.
  params: Record<string, unknown>;
  timestamp: string;
  success: boolean;
  error?: string;
}
```

The log is:

- **Persistent** — saved to disk, survives restarts.
- **Tamper-evident** — each entry is hashed, chained to the previous.
- **Queryable** — filter by action, time, success.

---

## 6. Project file security

### 6.1 Binary format integrity

The `VFXP` binary format ([05](05-PROJECT-FORMAT.md)) has a SHA-256 checksum:

```
VFXP magic (4 bytes) + version (uint32LE) + gzip(JSON) + sha256 (32 bytes)
```

A corrupted or tampered file is detected on load — the checksum won't match.

### 6.2 Path traversal

Project files can reference media by path. The app validates:

- Paths are **absolute** or **relative to the project directory**.
- Paths **cannot escape** the project directory (`../` is rejected).
- Paths **cannot reference** system directories.

---

## 7. AI generation security

### 7.1 Local-first

All AI generation runs locally ([35](35-AI-VIDEO-GENERATION.md)) — no data leaves the machine.
The only network access is **downloading models** on first use.

### 7.2 Model integrity

Downloaded models are verified:

- **Checksum** — SHA-256 matches the published value.
- **Signature** — the model is signed by a trusted key.
- **Sandbox** — models run in the same sandbox as plugins.

---

## 8. Verification

| Property | Test |
|---|---|
| Renderer isolation | the renderer cannot access `fs` or `child_process` |
| IPC validation | malformed input is rejected with a precise error |
| Script sandbox | a script cannot access `window` or `document` |
| CSP | no remote scripts or styles load |
| Audit log | every security-relevant action is logged |
| Binary integrity | a tampered VFXP file is detected |
| Path traversal | `../` paths are rejected |
| Model integrity | a corrupted model is detected on download |

---

Related: [44-PLUGIN-SYSTEM](44-PLUGIN-SYSTEM.md) · [39-SCRIPTING-AND-EXPRESSIONS](39-SCRIPTING-AND-EXPRESSIONS.md) ·
[35-AI-VIDEO-GENERATION](35-AI-VIDEO-GENERATION.md) · [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md) ·
[20-OPERATIONS](20-OPERATIONS.md)
