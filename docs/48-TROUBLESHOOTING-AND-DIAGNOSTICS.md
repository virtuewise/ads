# 48 — Troubleshooting & Diagnostics

**Status: 🟡 (basic error states exist; no diagnostics system) · Code: `App.tsx` (error overlays) → target: `engine/diagnostics/*`**

> The WebGPU canvas shows "Initializing WebGPU…" or an error overlay. The export panel shows the
> ffmpeg version or an error. That's the entire diagnostics surface. This document specifies the
> complete troubleshooting system.

---

## 1. What exists today

### 1.1 Error surfaces

| Surface | What it shows |
|---|---|
| WebGPU canvas | "Initializing WebGPU…" or an error message |
| Export panel | ffmpeg version or an error message |
| Status notifications | `notify(msg)` — a chip for 3.2 seconds |

### 1.2 What's missing

| Capability | Today |
|---|---|
| Diagnostics panel | ⬜ none |
| Error log | ⬜ none |
| Crash reporting | ⬜ none |
| System information | ⬜ none |
| GPU capability report | ⬜ none |
| Export diagnostics | ⬜ minimal |
| Health checks | ⬜ none |
| Self-test | ⬜ none |

---

## 2. The diagnostics system (target)

### 2.1 Diagnostics panel

A dockable **Diagnostics** panel:

```
┌─ Diagnostics ────────────────────────────────┐
│ System                                       │
│  OS:        Windows 11 (10.0.22631)         │
│  Electron:  44.9.0                           │
│  Chrome:    134.0.7099.115                   │
│  Node:      22.14.0                          │
├──────────────────────────────────────────────┤
│ GPU                                          │
│  Adapter:   NVIDIA GeForce RTX 4070          │
│  VRAM:      12 GB                            │
│  WebGPU:    ✓ available                      │
│  Features:  float32-filterable, texture-3d   │
├──────────────────────────────────────────────┤
│ FFmpeg                                      │
│  Path:      C:\...\ffmpeg.exe               │
│  Version:   8.1.1                           │
│  Encoders:  h264_nvenc, hevc_nvenc, prores │
├──────────────────────────────────────────────┤
│ Health                                    │
│  WebGPU context   ✓                         │
│  FFmpeg encoder  ✓                         │
│  Media pipeline   ⬜ (not initialized)      │
│  Export pipeline   ✓                         │
└──────────────────────────────────────────────┘
```

### 2.2 Error log

A persistent, queryable error log:

```typescript
interface ErrorEntry {
  id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'fatal';
  category: 'webgpu' | 'ffmpeg' | 'ipc' | 'render' | 'media' | 'project';
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}
```

- **Filter** by severity, category, or time.
- **Search** by message text.
- **Export** as a text file for bug reports.
- **Clear** the log.

---

## 3. GPU capability detection

### 3.1 Detection

On startup, probe the GPU:

```typescript
interface GPUCapabilities {
  available: boolean;
  adapter: GPUAdapterInfo | null;
  features: string[];           // e.g. 'float32-filterable', 'texture-3d'
  limits: Record<string, number>;
  vramEstimate: number | null;
}
```

### 3.2 Feature gating

Features are gated on capability:

| Feature | Required | Fallback |
|---|---|---|
| 3D LUTs | `texture-3d` | bake to 2D texture |
| Float filtering | `float32-filterable` | use unorm textures |
| Compute shaders | `@compute` | fragment-only fallback |
| 8K export | VRAM > 6GB | 4K max |

A missing feature **degrades gracefully** — never crashes.

### 3.3 WebGPU unavailable

If WebGPU is not available (old GPU, software rasterizer):

- Show a clear error: "WebGPU is required. Your GPU/driver is not supported."
- Offer a **CPU fallback** (Canvas 2D + ffmpeg) for basic editing and export.
- Link to the WebGPU implementation status page.

---

## 4. Export diagnostics

### 4.1 Pre-flight check

Before export, verify:

| Check | Failure action |
|---|---|
| FFmpeg found | show path config instructions |
| Encoder available | fall back to software |
| Disk space > estimate | warn + offer another path |
| Write permission | show permission error |
| Project valid | show validation errors |

### 4.2 Per-job diagnostics

Every export produces a diagnostics record:

```typescript
interface ExportDiagnostics {
  jobId: string;
  durationMs: number;
  framesRendered: number;
  framesDropped: number;
  meanFps: number;
  encoderUsed: string;
  vramHighWaterMb: number;
  outputPath: string;
  outputSizeBytes: number;
  warnings: string[];
  errors: string[];
}
```

### 4.3 Common export failures

| Symptom | Cause | Fix |
|---|---|---|
| "ffmpeg not found" | not in PATH | set `FFMPEG_PATH` or add to PATH |
| "No NVENC" | old NVIDIA driver | update driver or use libx264 |
| "Disk full" | insufficient space | free space or change output path |
| "A/V drift" | frame rate mismatch | verify fps matches composition |
| "Black frames" | shader error | check the console for WGSL errors |
| "Out of memory" | too many layers | reduce resolution or proxy media |

---

## 5. Project diagnostics

### 5.1 Validation

On load, validate the project document:

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  path: string;          // e.g. "timeline.clips[3].keyframes[0]"
  message: string;
  severity: 'error' | 'warning';
}
```

| Check | Severity |
|---|---|
| Schema match | error |
| LUT id exists | error |
| Effect id exists | warning |
| Media file missing | warning |
| Keyframe time out of range | warning |
| Clip range invalid | error |
| Cycle in DAG | error |

### 5.2 Repair

Some errors are auto-repaired:

| Error | Repair |
|---|---|
| Missing LUT | replace with 'none' |
| Missing effect | remove from stack |
| Out-of-range keyframe | clamp to clip range |
| Unsorted keyframes | re-sort |

---

## 6. Health checks

### 6.1 Startup self-test

On startup, run a self-test:

| Test | What it does |
|---|---|
| **WebGPU init** | create a device, render one frame |
| **FFmpeg probe** | run `ffmpeg -version` |
| **Encoder probe** | enumerate encoders |
| **Project codec** | round-trip a test document |
| **Export pipeline** | render + encode one frame |

Each test passes or fails with a precise message. The results are shown in the Diagnostics panel.

### 6.2 Runtime health

| Signal | Threshold | Action |
|---|---|---|
| Frame time > 2× budget | persistent | drop quality tier |
| VRAM > 90% | persistent | evict caches |
| Export queue > 100 frames | persistent | pause render |
| Error rate > 10/min | persistent | show error summary |

---

## 7. Crash recovery

### 7.1 Crash detection

- **Renderer crash:** `render-process-gone` event → save state → reload.
- **Main crash:** `child-process-gone` → restart.
- **GPU crash:** `device.lost` → reinitialize.

### 7.2 State recovery

- The project is auto-saved every 30 seconds.
- The undo history is persisted ([36](36-UNDO-REDO.md)).
- On restart, the app offers to recover the last session.

---

## 8. Verification

| Property | Test |
|---|---|
| Diagnostics panel | shows accurate system, GPU, and ffmpeg info |
| Feature gating | a missing feature degrades, not crashes |
| Pre-flight check | an export with no disk space warns before starting |
| Validation | a corrupt project reports precise errors |
| Self-test | the startup self-test passes on a healthy system |
| Crash recovery | a simulated crash recovers the last session |

---

Related: [20-OPERATIONS](20-OPERATIONS.md) · [07-EXPORT-PIPELINE](07-EXPORT-PIPELINE.md) ·
[04-RENDERING](04-RENDERING.md) · [47-PERFORMANCE-TUNING](47-PERFORMANCE-TUNING.md) · [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md)
