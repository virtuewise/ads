# 00 — Vision & Principles

**Status: ✅ (principles are stable) · Docs: this set**

> Virtue Studio is a **local-first, engine-driven motion-design studio** where every pixel on screen is
> produced by a program you can read, edit, and version — and where an AI agent and a human editor can
> operate the *same* system through two different doors.

---

## Why this exists

Professional video tools force a choice:

- **Timeline editors** (Premiere, Resolve, CapCut) are fast to *feel* but opaque to *automate*. Their
  state lives in binary project files; you cannot diff them, script them, or have an agent edit them.
- **Programmatic renderers** (Remotion, Motion Canvas) are versionable and automatable but have no real
  editing surface — no scrubbing, no node graph, no keyframe timeline a colorist would recognise.

Virtue Studio refuses the choice. It is a **real editing application** whose entire state is a
human-readable, git-versionable, agent-manipulable program — and whose rendering runs on the user's own
GPU through WebGPU, with no cloud, no subscription, and no network latency.

---

## The three principles

These descend from the original monorepo README and are extended for the editor.

### 1. AI generates ingredients. Code controls the composition.

The engine monorepo (World A) produces concepts, scripts, storyboards, shot lists, and asset plans.
The editor (World B) never lets a model *decide* the edit — it lets a model *propose* structured data
that is validated, then compiled deterministically. A model output is an **input node**, never a
hidden side effect.

### 2. Deterministic rendering controls the final product.

The same WGSL runs in the viewport and in the exporter. Same uniforms, same pixels. The preview is not
an approximation of the export — it **is** the export, at lower resolution. This is enforced structurally
by the shared module [`apps/electron/src/renderer/src/engine/visual.ts`](../apps/electron/src/renderer/src/engine/visual.ts),
which owns both the shader and the uniform packing used by both paths. See
[04-RENDERING](04-RENDERING.md).

### 3. Everything is motion-designed.

There is no static deliverable. A poster is an animated key visual whose still frames are an *export
concern*; social posts are animated short-form; infographics are animated data stories. Every format is
a motion format, and still frames are a projection of the motion, never the other way around.

---

## The four commitments of the editor

### Local-first

No cloud. Rendering, encoding, transcription, indexing, and export all happen on the operator's machine:
WebGPU for compositing, system FFmpeg for encoding, the SSD for output. There is no account, no upload,
and no latency budget to hide behind. The cost is that **the app must manage local hardware** — CPU,
system RAM, and GPU VRAM — explicitly. This is a first-class design concern, documented in
[04-RENDERING](04-RENDERING.md) and [20-OPERATIONS](20-OPERATIONS.md).

### Programmable by default

Every UI affordance has a code equivalent, and every code construct has a UI equivalent:

```
[ JS/TS Scripting API ] ◄────► [ Unified DAG Engine ] ◄────► [ Nodal Visual UI ]
                                       │
                                       ▼
                     [ WebGPU Pipeline / WGSL Shader Generation ]
```

A user who drags a node changes a JSON tree; a user who edits that JSON changes the node graph; a user
who types WGSL in a **Script node** gets a bespoke effect that survives round-tripping. See
[03-ENGINE-CORE](03-ENGINE-CORE.md) and [08-SCRIPTING-API](08-SCRIPTING-API.md).

### Genre-aware

Standard editors treat every timeline the same. Virtue Studio **retunes itself to the genre**: the six
workflows (3D/CGI, Narrative, Corporate, Explainer, Documentary, Detective) each carry their own smart-cut
profile, keyframe presets, templates, pipeline, and — where it matters — their own rendering strategy.
See [09-GENRE-SYSTEM](09-GENRE-SYSTEM.md).

### Anti-generic

From the monorepo heritage: output must never look generic. In the editor this becomes structural — brand
LUTs are enforced shader inputs, safe zones are real layout constraints, and brand QA is a gate on export,
not a suggestion. See [18-BRAND-AND-LUTS](18-BRAND-AND-LUTS.md).

---

## The two audiences

The single most important design decision in the system is that **the same product serves two kinds of
operator without forking**.

| | Human editor | AI agent |
|---|---|---|
| **Enters through** | The UI ([16-INTERFACE](16-INTERFACE.md)) | The project format + scripting API ([05](05-PROJECT-FORMAT.md), [08](08-SCRIPTING-API.md), [17-AI-AGENTS](17-AI-AGENTS.md)) |
| **Manipulates** | Timeline, node graph, Monaco, transform fields | The same `ProjectDocument` JSON |
| **Optimises for** | Feel, judgement, performance selection | Throughput, consistency, brief-to-deliverable automation |
| **Strength** | Emotion, invisible cutting, misdirection | Bulk assembly, transcription formatting, variant generation |
| **Shared contract** | **`ProjectDocument`** — the single source of truth both doors open onto | |

This is why the project format is human-readable and deterministic: an agent can read a human's edit,
edit it, hand it back, and the human can diff exactly what changed. See [05-PROJECT-FORMAT](05-PROJECT-FORMAT.md)
and [17-AI-AGENTS](17-AI-AGENTS.md).

---

## Non-goals

Stated explicitly so they are not accidentally pursued:

- **Cloud rendering / render farm as a service.** The enterprise render path in World A
  (`@printsync/render-farm`) exists for the monorepo's own batch films; the editor does not depend on it.
- **A general-purpose NLE.** Virtue Studio is opinionated around brand-aware motion design and six
  genres; it is not trying to ingest any format and edit any project.
- **Static design tooling.** Per principle 3, there is no static deliverable.
- **Native codec add-ons.** Encoding uses the system FFmpeg binary — probing and preferring hardware
  encoders — rather than shipping a Node-API FFmpeg addon. See [07-EXPORT-PIPELINE](07-EXPORT-PIPELINE.md).

---

## What "fully accomplished" looks like

The system is complete when, for each of the six genres, an **AI agent can take a brief and a pile of
footage and produce a deliverable** — and a **human editor can take that same project, improve it by
judgement, and export it** — with:

1. A deterministic `.vfxproj` document that both can read and edit.
2. A genre-appropriate pipeline applied automatically.
3. A WYSIWYG preview that matches the export.
4. A verified local export (1080p H.264 guaranteed; 4K ProRes where hardware allows).

[21-ROADMAP](21-ROADMAP.md) tracks the distance to that state.

---

Next: [01-PRODUCT](01-PRODUCT.md) — what the app actually is.
