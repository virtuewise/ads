# 31 — Agentic Operation at Scale: Headless, Interop & Interchange

**Status: ⬜ (the pure codec is headless-able; no CLI, no interop, no MCP) · Code (target) : `packages/cli` extension, `apps/electron/src/main/headless.ts`, `engine/interop/*`**

> The docs promise that an AI agent can take a brief and footage and produce a deliverable
> ([00](00-VISION.md#what-fully-accomplished-looks-like)). The pieces exist in the app
> ([17](17-AI-AGENTS.md)), but an agent still needs a human to open a window. This document closes that
> gap: **headless rendering, agent tooling, and interchange with the wider post ecosystem.**

---

## 1. Headless CLI — the keystone

**`vstudio`** renders a project with no window. It is the single most important item for agentic scale.

```bash
# Render a project with a delivery preset
vstudio render ./brand-anthem.vfxproj --preset fast-1080p --out ./renders/

# Batch: every project in a folder, social variants, captions as sidecars
vstudio batch ./projects/*.vfxproj --variants social-quintet --captions srt

# Assemble from a brief + footage, apply a genre, transcribe, render
vstudio auto --brief ./brief.json --footage ./footage/ --genre corporate --template corp-brand

# Just the document transforms, no render (fast, diffable)
vstudio apply --in ./p.vfxproj --genre detective --preset look-cold-mystery --out ./p2.vfxproj
```

### How it works

- **Node's WebGPU** is not available on all platforms for offscreen rendering, so the headless renderer has
  two backends:
  1. **GPU backend** — Node + `webgpu` bindings (Dawn) where available; fastest.
  2. **FFmpeg filter-graph backend** — compile the composition to an **FFmpeg `filter_complex`** for the
     subset of the graph expressible as filters (grade, blend, transform, basic effects). Slower to build
     but universally available and CPU-only.
- The pure codec (`main/projectCodec.ts`) already has no Electron dependency
  ([05](05-PROJECT-FORMAT.md)), so document transforms run in a plain Node process today.
- The CLI writes a **manifest** ([30](30-RENDER-QUEUE.md#6-deliverable-packaging)) and exits with a
  meaningful code.

> **Why the FFmpeg backend matters:** it means the agent workflow is not blocked on GPU availability. A
> CI box with no GPU can still produce a review renderer — it just cannot produce the exact WYSIWYG pixels
> the GPU path does. The docs must label which backend produced a render (the manifest records it).

---

## 2. Extending the agent API (v2)

The current `window.studio` surface ([08](08-SCRIPTING-API.md)) is **data access + export primitives**. v2
adds **verbs** — high-level, deterministic edits that match the genre pipelines
([09](09-GENRE-SYSTEM.md#pipelines)):

```typescript
studio.ops = {
  // Structure
  applyGenre(genreId, { template }): Doc;
  setComposition(patch): Doc;
  assembleFromTranscript(transcript, { genre }): Doc;
  // Media
  importMedia(paths, { proxy, index }): MediaAsset[];
  sceneAutoCut({ threshold }): Doc;
  autoReframe({ ratio, subject }): Doc;
  selectTakes({ transcript, criteria }): Doc;
  // Text / audio
  autoCaption({ model, language, style, wordTimestamps }): Doc;
  loudnessNormalize({ target }): Doc;
  musicDuck({ amount }): Doc;
  // Color / effects
  gradeShotMatch({ referenceFrame }): Doc;
  applyPreset(presetId, params, target): Doc;
  addTransition(afterClipId, presetId): Doc;
  // Delivery
  exportVariants(variants): Manifest;
  queueRender(job): RenderJob;
};
```

Each op is a **pure document transform** returning a new `ProjectDocument` — so it is diffable, undoable,
and safe to run concurrently on branches ([§5](#5-multi-agent-operation)).

---

## 3. MCP server — the editor as a tool surface

Expose the app (and the CLI) as a **Model Context Protocol** server so any MCP-capable agent drives it
directly, without bespoke integration:

```
tools:
  vstudio.open(projectPath)          → { doc }
  vstudio.applyGenre(...)            → { doc }
  vstudio.autoCaption(...)           → { doc }
  vstudio.exportVariants(...)        → { manifest }
  vstudio.queryMedia(filter)         → { assets }
resources:
  vstudio://project/current          → the live ProjectDocument (JSON)
  vstudio://media/index              → the media index
  vstudio://transcript/current       → the active transcript
```

Because the project format is JSON and the ops are pure, an MCP agent's every action is an inspectable
patch — the anti-black-box guarantee from [00-VISION](00-VISION.md) applies to agents too.

---

## 4. Interchange with the post ecosystem

Virtue Studio should not be a walled garden. Interop makes it a good citizen:

| Direction | Format | Purpose |
|---|---|---|
| **Export** | **EDL** (CMX 3600) | hand a cut to any NLE |
| **Export** | **FCPXML / FCP7 XML** | Resolve / Premiere interchange with clip references |
| **Export** | **AAF** | audio post hand-off |
| **Export** | **OpenTimelineIO (OTIO)** | the modern, scriptable interchange standard |
| **Export** | **`.cube`** ([23](23-COLOR.md)) | LUTs out |
| **Export** | **CSV/JSON shot list** | production coordination |
| **Import** | **OTIO / EDL / FCPXML** | bring an existing cut in |
| **Import** | **`.cube`** LUTs | grades in |
| **Import** | **Lottie JSON** | vector animations in ([13](13-GENRE-EXPLAINER.md)) |
| **Import** | **EXR / multi-pass** | CG passes in ([10](10-GENRE-3D-ANIMATION.md)) |
| **Import** | **SRT/VTT/ASS** | existing captions in |

**OpenTimelineIO is the priority**: it is JSON, scriptable, and already speaks to Resolve, Premiere, and
Avid. A `.vfxproj` ↔ OTIO bridge is a modest mapping (clips, ranges, transitions, tracks) that buys
enormous interoperability.

---

## 5. Multi-agent operation

Because the document is a deterministic JSON tree, **parallel agents are a merge problem**, not a
coordination problem:

```
agent A ─┐
         ├─► document branches (git worktrees of the .vfxproj)
agent B ─┘        │
                  ▼
        three-way merge of JSON trees
        (structural merge: clips, nodes, keyframes)
                  ▼
            merged project + conflict report
```

- **Structural merge** — merge by object identity (`clip.id`, `node.id`), not text hunks, so two agents
  editing different clips merge cleanly even if their JSON is sorted identically.
- **Conflict report** — when both edit the same property, surface both values with a diff
  ([05](05-PROJECT-FORMAT.md) determinism makes this exact).
- **Agent roles** from [17](17-AI-AGENTS.md#multi-agent-workflow): creative, assembly, technical, QA —
  each produces a patch to the document.

This is why the deterministic, sorted JSON format ([05](05-PROJECT-FORMAT.md)) was the right call: it is
simultaneously a git format, an agent format, and a merge format.

---

## 6. Determinism as an agent contract

An agent can rely on these being **exact and reproducible**:

| Guarantee | Source |
|---|---|
| Same document → same bytes (JSON mode) | `sortDeep` in `main/projectCodec.ts` |
| Same document → same pixels | shared shader + uniforms ([04](04-RENDERING.md)) |
| Malformed input never crashes | `normalizeProject` ([05](05-PROJECT-FORMAT.md)) |
| Format detected by content | magic bytes ([05](05-PROJECT-FORMAT.md)) |
| Export is memory-bounded | backpressure ([07](07-EXPORT-PIPELINE.md)) |
| Ops are pure transforms | [§2](#2-extending-the-agent-api-v2) |

And these are **not yet** available to agents (explicitly, so they do not depend on them): media import,
audio, captions, headless rendering, interop — the milestones in this plan.

---

## 7. Observability for agent runs

When an agent renders 40 variants unattended, it needs a record:

- **Run log** — every op applied, in order, with its parameters.
- **Artifact manifest** — every output, its settings, size, hash, and the encoder used.
- **Reproduce command** — the exact `vstudio` invocation that reproduces the run.
- **Diff summary** — the document delta from start to finish, human-readable.

The run log + manifest make an agent's work **auditable and reproducible** — the same standard as a human's
edit.

---

## 8. Where this sits in the plan

```
Media import (29) ─┐
Audio (25) ────────┤
Captions (26) ─────┤
Compositor (22) ───┼─► ops have something to operate on
Grade (23) ────────┤
Presets (28) ──────┘
        │
        ▼
Headless CLI (31.1) ──► Agent API v2 (31.2) ──► MCP (31.3) ──► Interop (31.4) ──► Multi-agent (31.5)
        │
        ▼
This is the end state: an agent takes a brief and footage and produces a deliverable, with no human in
the loop — and a human can open any step of it and improve it by judgement.
```

---

## Verification

| Property | Test |
|---|---|
| CLI == app | a CLI render is byte-identical to the same render from the app (same backend) |
| Backend labelling | the manifest records GPU vs FFmpeg backend, and they are never conflated |
| Op purity | `op(doc)` does not mutate `doc` and is deterministic |
| Merge correctness | two independent edits merge with no conflict; a same-property edit reports one |
| Interop round-trip | OTIO → project → OTIO preserves cuts within tolerance |
| MCP resource fidelity | the `vstudio://project/current` resource equals the saved document |

---

Related: [08-SCRIPTING-API](08-SCRIPTING-API.md) · [17-AI-AGENTS](17-AI-AGENTS.md) · [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md) ·
[29-MEDIA-PIPELINE](29-MEDIA-PIPELINE.md) · [30-RENDER-QUEUE](30-RENDER-QUEUE.md)
