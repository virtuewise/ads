# 10 — Genre: 3D Animation & CGI

**Status: 🟡 · Genre id: `3d-animation` · Profile: [09-GENRE-SYSTEM](09-GENRE-SYSTEM.md#the-six-smartcut-profiles)**

> Editing animation is unique: **the edit often happens before the final visuals exist.** Timing is
> locked against rough passes, then the expensive render lands in layers that must composite on the
> timeline without flattening first.

---

## The workflow need

- **Animatic / pre-vis editing.** Stitch rough 2D sketches, 3D blocking, and temp audio to lock timing
  *before* rendering.
- **Multi-pass compositing.** Beauty, lighting, AO, depth, and reflection passes must arrive as separate
  layers and blend in real time.
- **Frame-rate conversion.** Animation is often authored at one rate and delivered at another.
- **Spatial asset management.** Complex multi-pass renders must stay meticulously organised.

---

## The stack solution

### Multi-layer WebGPU textures

WebGPU supports binding an **array of textures** as separate inputs. The compositor imports each render
pass (AO, diffuse, specular, depth, reflection) as its own `texture_2d<f32>` bind and blends them in the
fragment shader — so a programmable user adjusts lighting and composites passes *on the timeline*
without flattening files first.

```
passA (beauty) ──┐
passB (lighting)─┼──► bind group ──► WGSL blend ──► composite
passC (depth) ───┘
```

The `BlendNode` (`mix(a,b,opacity)`) and `AlphaMergeNode` in `engine/nodes.ts` are the CPU-side seeds of
this compositing graph ([03-ENGINE-CORE](03-ENGINE-CORE.md)).

### Prototyping / animatic engine

A low-overhead **vector overlay** renders rough sketches and storyboard bounding boxes over the timing
track. The vision specifies building this with Wasm for smooth overlays; the near-term path is an SVG/2D
overlay driven by the timeline (the `SafeZones` component already proves overlay-on-canvas works).

---

## The engine knobs (genre profile)

| Knob | Value | Why |
|---|---|---|
| `scenes` | `loose` | Cut on real pass boundaries, not every frame change |
| `reframe` | `none` | **The camera is authored** — never auto-reframe a CG shot |
| `outputRatio` | 16:9 | Standard delivery; dual-ratio comes at grade time |
| `smoothness` | 0.90 | High — no jitter in a locked frame |
| `speedRange` | 0.50–1.00× | Slow-downs to match animatic timing; **never speed up** past 1× |
| `preservePitch` | true | Temp audio must stay intelligible |

### Keyframe presets

| Preset | Property | Easing | Duration |
|---|---|---|---|
| Pass dissolve-in | opacity | easeInOut | 0.75s |
| Virtual camera push | scale | easeInOut | 2.50s |
| Impact settle | scale | easeOut | 0.35s |

### Templates

- **CGI Teaser** — Black · Pass reveal · Camera push · Impact cut · Logo hold (LUT `cool-tech`).
- **Comp Breakdown** — Plate · Wireframe · Lighting pass · Beauty · Final (LUT `vibrant`).

### Pipeline

1. Import multi-pass renders as a stack.
2. Lock timing to the animatic.
3. Composite passes in the node graph.
4. Retime for frame-rate conversion.
5. Grade and deliver both aspect ratios.

---

## UI affordances

- The node graph is the primary surface — pass compositing is a graph problem
  ([03-ENGINE-CORE](03-ENGINE-CORE.md)).
- The **Comp Breakdown** template's `graphHint` (`passA + passB -> add -> grade`) telegraphs the intended
  chain.
- Frame-rate conversion needs a retime control on the clip; today retiming is expressed through the
  timeline range, with true speed curves planned ([21-ROADMAP](21-ROADMAP.md)).

---

## What exists vs. what is needed

| Capability | Status |
|---|---|
| Genre profile, presets, templates, pipeline | ✅ |
| Node graph + `blend`/`alphaMerge` compositing nodes | ✅ (2-input) |
| Opacity/scale keyframes on the timeline | ✅ |
| Multi-pass texture-array binding in the compositor | ⬜ |
| EXR / multi-layer import (Node-API parser) | ⬜ |
| Vector animatic overlay | ⬜ |
| Frame-rate conversion retime curves | ⬜ |

---

## Agent path

An agent working a CGI job should: import passes → build a `blend`/`alphaMerge` DAG → hold `reframe:none`
→ apply the `impact settle` preset on the impact beat → retime for delivery → grade with `cool-tech` or
`vibrant`. Full playbook: [17-AI-AGENTS](17-AI-AGENTS.md).

---

Next genre: [11-GENRE-NARRATIVE](11-GENRE-NARRATIVE.md) · System: [09-GENRE-SYSTEM](09-GENRE-SYSTEM.md)
