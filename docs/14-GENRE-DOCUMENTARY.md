# 14 — Genre: Documentary

**Status: 🟡 · Genre id: `documentary` · Profile: [09-GENRE-SYSTEM](09-GENRE-SYSTEM.md#the-six-smartcut-profiles)**

> Documentary editors are often called the true **writers** of the film, because they build the story
> from scratch — combing hundreds of hours of footage and interviews to find a cohesive thread.

---

## The workflow need

- **Script-from-footage.** Find the narrative thread across a mountain of raw material.
- **Juxtaposition mastery (Kuleshov effect).** Place two unrelated shots together to create a third
  meaning (a corporate speech cut against a polluted river).
- **B-roll layering.** Hide interview jump-cuts with highly relevant contextual footage.
- **Authenticity.** Grade archive and modern footage into one honest look.

---

## The stack solution

### SQLite + Web Workers for metadata and transcripts

The vision: a localised **SQLite** database in Electron's main process indexes multi-gigabyte metadata,
localised markers, and multi-hour interview transcriptions. The renderer queries it through IPC.

```
footage ──► metadata index (SQLite, main) ──► IPC ──► search UI (renderer)
audio   ──► transcript index (SQLite)     ──► IPC ──► timecode-linked text search
```

### AI transcription streaming (ONNX)

Audio segments stream via WebAudio into a localised **ONNX Runtime Web** environment to generate
transcripts in real time, matching text strings to timeline timecodes over the IPC bus. This is what lets
an editor *search the spoken word* to build the script.

### B-roll layering

Interview audio is the spine; B-roll dissolves under it (the `doc-broll` preset). Juxtaposition is a
deliberate two-shot construction (the `doc-kuleshov` preset).

---

## The engine knobs (genre profile)

| Knob | Value | Why |
|---|---|---|
| `scenes` | `loose` | Cut on real scene changes, not every motion |
| `reframe` | `subject-lock` | Keep interview subjects framed |
| `outputRatio` | 16:9 | Broadcast / streaming |
| `smoothness` | 0.55 | Moderate |
| `speedRange` | 0.60–1.00× | Slow archive and B-roll; **never speed up testimony** |
| `preservePitch` | false | Natural archival audio is preferred over correction |

### Keyframe presets

| Preset | Property | Easing | Duration |
|---|---|---|---|
| B-roll dissolve | opacity | easeInOut | 1.10s |
| Archive reveal | scale | easeInOut | 3.00s |
| Juxtaposition beat | opacity | linear | 0.50s |

### Templates

- **Script From Footage** — Archive · Interview · B-roll · Interview · Resolution (LUT `cinematic`).
- **Video Essay** — Thesis · Evidence · Counterpoint · Synthesis (LUT `vibrant`).

### Pipeline

1. Tag every clip with metadata as it lands.
2. Search the transcript to script from the footage.
3. Layer B-roll under the interview spine.
4. Build meaning through juxtaposition.
5. Grade archive and modern footage into one look.

---

## UI affordances

- **Transcript search** with timecode linking (the documentary genre's defining UI).
- **Metadata tagging** on import.
- **Archive reveal** slow push across stills.
- **Speaker lower-thirds** carrying source metadata (from the *Script From Footage* caption style).

---

## What exists vs. what is needed

| Capability | Status |
|---|---|
| Genre profile, presets, templates, pipeline | ✅ |
| Captions/effects track model | ✅ |
| Metadata tagging UI | ⬜ |
| SQLite index (main process) | ⬜ |
| ONNX transcription streaming | ⬜ |
| Transcript → timecode search UI | ⬜ |
| B-roll strip previews (background workers) | ⬜ |

> The old monorepo roadmap notes an `analyzeFrequencyBands` primitive in `@printsync/audio-engine` —
> a seed for waveform/segment analysis, surfaced through the main process.

---

## Agent path

An agent assembles a documentary by: importing and tagging footage → transcribing → searching the
transcript for the strongest statements → laying an interview spine → layering B-roll under it with
`b-roll dissolve` → constructing a Kuleshov beat → grading `cinematic`. See [17-AI-AGENTS](17-AI-AGENTS.md).

---

Previous: [13-GENRE-EXPLAINER](13-GENRE-EXPLAINER.md) · Next: [15-GENRE-DETECTIVE](15-GENRE-DETECTIVE.md) ·
Advanced specs: [26-CAPTIONS](26-CAPTIONS.md) (speaker lower-thirds) · [29-MEDIA-PIPELINE](29-MEDIA-PIPELINE.md) (footage index/search) ·
[23-COLOR](23-COLOR.md) (archive matching)
