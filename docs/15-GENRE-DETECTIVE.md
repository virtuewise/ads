# 15 — Genre: Detective & Mystery

**Status: 🟡 · Genre id: `detective` · Profile: [09-GENRE-SYSTEM](09-GENRE-SYSTEM.md#the-six-smartcut-profiles)**

> Mystery editing is about **controlling what the audience knows and when**. Hold a shot a beat too long,
> or cut away early, to make them suspect the wrong thing.

---

## The workflow need

- **Misdirection & red herrings.** Linger on the wrong detail; withdraw from the real one.
- **Tension building.** Hard cuts, sudden silences, escalating sound design.
- **Clue tracking.** Keep critical clues visible without making them obvious.
- **Frame-accurate trimming.** Slip a clip a single frame to tune the effect.

---

## The stack solution

### Precision frame caching (WebCodecs ring buffer)

The defining technical requirement: when an editor slips a clip or holds a shot **one frame** longer,
**the UI must not stutter**. The vision specifies a ring-buffer cache in WebAssembly that pre-decodes and
stores **30 frames ahead and behind** the playhead using the **WebCodecs** API, so precision trimming is
instant and artifact-free.

```
playhead ──► ring buffer [−30 … +30 frames] ──► instant scrub / slip
             (pre-decoded via WebCodecs)
```

> This is the highest-priority implementation gap for this genre. Until it lands, trimming relies on the
> pure timeline model, which is exact but not yet backed by decoded frames
> ([06-TIMELINE](06-TIMELINE.md)).

### Sound cue alignment

Tension is half sound. The vision couples hard cuts and sudden silences to the audio graph — the same
WebAudio layer the Narrative genre needs ([11](11-GENRE-NARRATIVE.md)).

---

## The engine knobs (genre profile)

| Knob | Value | Why |
|---|---|---|
| `scenes` | `off` | **Never auto-cut** — the cut is the misdirection |
| `reframe` | `smooth-follow` | Subtle creep toward a false answer |
| `outputRatio` | 16:9 | Standard |
| `smoothness` | 0.80 | Controlled, deliberate |
| `speedRange` | 0.70–1.10× | Slight slow-down for dread; barely any speed-up |
| `preservePitch` | false | Natural sound |

### Keyframe presets

| Preset | Property | Easing | Duration |
|---|---|---|---|
| Clue linger | opacity | easeInOut | 1.40s |
| Red herring push | scale | easeIn | 0.70s |
| Reveal snap | opacity | easeOut | 0.22s |

> Note the **contrast**: *clue linger* is a slow 1.4s breathe; *reveal snap* is a 0.22s hard stop. That
> gap **is** the genre.

### Templates

- **Mystery Cold Open** — Incipient · Clue · Mischief · False trail · Reveal · Title (LUT `cinematic`).
- **Interrogation Cut** — Question · Silence · Pressure · Crack (LUT `none`).

### Pipeline

1. Trim for precisely withheld information.
2. Cache and compare suspect frames.
3. Build tension with controlled pacing.
4. Place and time the red herrings.
5. Grade for cold, high-contrast mystery.

---

## UI affordances

- **Contextual clip history graphs** and interactive asset markers (the vision's
  detective-specific Electron UI).
- **Single-frame slip/slide** controls, backed by the ring-buffer cache.
- Cold grade via the `cinematic` LUT; no decorative LUT on the interrogation cut.

---

## What exists vs. what is needed

| Capability | Status |
|---|---|
| Genre profile, presets, templates, pipeline | ✅ |
| Pure trimming model (exact, no stutter by design) | ✅ |
| `reveal snap` / `clue linger` presets | ✅ |
| WebCodecs ring-buffer frame cache | ⬜ |
| Frame-slip UI + history graph | ⬜ |
| Sound-cue alignment (WebAudio) | ⬜ |
| Clue markers / asset annotation | ⬜ |

---

## Agent path

An agent builds a mystery by: placing hard cuts with `scenes: off` → applying `clue linger` on the true
clue → applying `red herring push` toward a false lead → withholding the reveal until the chosen beat →
applying `reveal snap` as the answer lands → grading cold. See [17-AI-AGENTS](17-AI-AGENTS.md).

---

Previous: [14-GENRE-DOCUMENTARY](14-GENRE-DOCUMENTARY.md) · System: [09-GENRE-SYSTEM](09-GENRE-SYSTEM.md)
