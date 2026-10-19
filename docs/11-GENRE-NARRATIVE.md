# 11 — Genre: Narrative Fiction

**Status: 🟡 · Genre id: `narrative` · Profile: [09-GENRE-SYSTEM](09-GENRE-SYSTEM.md#the-six-smartcut-profiles)**

> Narrative editing is about human emotion, performance, and **invisible continuity**. The audience must
> forget they are watching a movie. The cut serves the performance, never the other way around.

---

## The workflow need

- **Performance selection.** Spot the exact frame where an actor's expression conveys the subtext.
- **Invisible cutting.** Match eye-lines, cut on action, hide every seam.
- **Structural flexibility.** Rewrite a scene in the timeline if it isn't working emotionally.
- **J/L cuts.** Audio leads (J) or lags (L) the picture to smooth scene transitions.

---

## The stack solution

### Zero-latency J/L cuts via WebAudio

The WebGPU playback loop and the **WebAudio API** must run as synchronized parallel workers. When
performing a J or L cut, audio nodes crossfade with **sub-millisecond volume ramps** —
`linearRampToValueAtTime` — to eliminate pops and preserve human-driven continuity.

```
video track ──► WebGPU frame loop ─┐
                                   ├──► synchronized playback
audio track ──► WebAudio graph ────┘
                   │
                   └── J/L cut = gain.linearRampToValueAtTime(...)
```

> Today, export is video-only (`-an` in the FFmpeg args — [07](07-EXPORT-PIPELINE.md)). The audio graph
> and the muxing step are the narrative genre's core dependency.

### Sub-frame precision trimming

Precision timeline zoom with canvas-based rendering **matched to the frame rate** and to the mouse
polling rate for seamless micro-adjustments. The pure transforms in `engine/timeline.ts` already support
arbitrary precision — the UI zoom is the missing piece ([06-TIMELINE](06-TIMELINE.md)).

---

## The engine knobs (genre profile)

| Knob | Value | Why |
|---|---|---|
| `scenes` | `off` | **Never auto-cut a performance** — the cut is the craft |
| `reframe` | `smooth-follow` | Follow the subject gently; never jar the framing |
| `outputRatio` | 16:9 | Theatrical/broadcast |
| `smoothness` | 0.70 | Smooth tracking, still responsive |
| `speedRange` | 0.90–1.00× | Barely retime — performances are honest |
| `preservePitch` | true | Dialogue must never chipmunk |

### Keyframe presets

| Preset | Property | Easing | Duration |
|---|---|---|---|
| J-cut audio lead | opacity | linear | 0.60s |
| L-cut audio tail | opacity | linear | 0.90s |
| Performance hold | opacity | easeInOut | 1.20s |

### Templates

- **Scene Assembly** — Cold open · Establish · Dialogue · Reaction · Turn · Button (LUT `cinematic`).
- **Trailer Beat Sheet** — Setup · Escalation · False calm · Hard cut · Title (LUT `cinematic`).

### Pipeline

1. Search the transcript for the strongest takes.
2. Assemble an invisible-cut scene.
3. Build J/L audio overlaps.
4. Track emotional continuity across the reel.
5. Grade for a consistent look.

---

## UI affordances

- Transcript-driven take selection (shared with [Documentary](14-GENRE-DOCUMENTARY.md)).
- Fine trim + micro-nudge controls for frame-and-subframe adjustments.
- J/L cut markers on the **Audio** and **Video** tracks (`TRACKS` in `engine/timeline.ts`).
- Continuous-look grading via the `cinematic` LUT ([18](18-BRAND-AND-LUTS.md)).

---

## What exists vs. what is needed

| Capability | Status |
|---|---|
| Genre profile, presets, templates, pipeline | ✅ |
| Precision timeline model (immutable, snapping, sub-second) | ✅ |
| Opacity-keyed timeline clips | ✅ |
| WebAudio graph + J/L crossfades | ⬜ |
| Audio decode + waveform | ⬜ |
| Audio/video muxing in export | ⬜ |
| Transcript take-selection UI | ⬜ |
| Sub-frame zoom matched to polling rate | ⬜ |

---

## Agent path

An agent assembles a scene by: pulling the strongest transcript takes → laying an invisible-cut spine on
the Video track → building J/L overlaps on the Audio track → applying `performance hold` where a beat must
breathe → grading `cinematic`. Human editors then refine the *taste* decisions — the frame where the
expression lands. See [17-AI-AGENTS](17-AI-AGENTS.md).

---

Previous: [10-GENRE-3D-ANIMATION](10-GENRE-3D-ANIMATION.md) · Next: [12-GENRE-CORPORATE](12-GENRE-CORPORATE.md) ·
Advanced specs: [25-AUDIO](25-AUDIO.md) (J/L cuts) · [23-COLOR](23-COLOR.md) (shot matching) ·
[26-CAPTIONS](26-CAPTIONS.md)
