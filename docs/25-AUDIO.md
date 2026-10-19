# 25 — Audio: Playback, Editing, Mixing & Muxing

**Status: ⬜ (a track exists; nothing behind it — export is silent) · Code (target): `engine/audio/*`, `main/audio.ts`**

> Today the timeline has an **Audio track** (`TRACKS` in `engine/timeline.ts`, icon `music`, colour
> `#5eead4`) holding a placeholder `Score: Main Theme` clip, and the FFmpeg export passes **`-an`** —
> every file in the app is **silent**. This document specifies the audio subsystem.

---

## The gap, precisely

| Layer | Today |
|---|---|
| Track | A labelled lane; no waveform, no playback |
| Decode | None |
| Playback | None |
| Editing | `start`/`end` only, like any clip |
| Export | Explicitly muted (`-an` in `buildArgs`, `main/export.ts`) |
| Sync | None |

The vision treats audio as half of every genre — J/L cuts ([11](11-GENRE-NARRATIVE.md)), sound cue
alignment ([15](15-GENRE-DETECTIVE.md)), loudness for delivery. All of it depends on this subsystem.

---

## 1. Decode & the audio graph

```
file ──► [decode] ──► AudioBuffer ──► WebAudio graph ──► destination (monitor)
                          │                    │
                          │                    └──► OfflineAudioContext ──► PCM ──► FFmpeg mux
                          └──► peaks cache ──► waveform track
```

- **Decode** in the **main process** (FFmpeg or an audio decoder) to raw PCM, OR in the renderer via
  WebCodecs `AudioDecoder` when the container supports it. Main-process decode is the robust path for
  arbitrary codecs.
- **Graph**: one `AudioBufferSourceNode` per clip, a `GainNode` per clip (volume, fades), routed through
  track buses (`audio`, plus future `music`/`dialogue`/`sfx` buses), into a master `GainNode` →
  destination for monitoring.
- **Scheduling**: sources are scheduled on the graph's timeline relative to the **transport clock**, so
  scrubbing and playing stay sample-accurate.

---

## 2. Waveforms

- Compute **min/max peaks per pixel-column at the current zoom** (multi-resolution peak pyramid: one
  level per power-of-two zoom).
- Cache peaks to disk (or IndexedDB) keyed by media id + resolution, so reopening a project is instant.
- Render the waveform on the Audio track with a **canvas or WebGPU** draw — for long timelines at 4K this
  must be GPU-drawn, not DOM.

---

## 3. J/L cuts (the narrative core)

A **J-cut** is audio leading picture; an **L-cut** is audio lagging picture. Today's genre preset
(`narrative`, `J-cut audio lead` / `L-cut audio tail`) is a *timeline gesture with no audio behind it*.

Implementation:

```typescript
// Crossfade two audio clips with sub-millisecond ramps — no pops.
gainA.gain.setValueAtTime(1, t0);
gainA.gain.linearRampToValueAtTime(0, t0 + fade);
gainB.gain.setValueAtTime(0, t0);
gainB.gain.linearRampToValueAtTime(1, t0 + fade);
```

`linearRampToValueAtTime` on the **sample clock** is what eliminates clicks. For equal-power (energy-
preserving) crossfades, use `setValueCurveAtTime` with a cosine curve.

The UI: audio clips can be slipped independently of their video clips, with a visible overlap region; the
J/L markers sit on the Audio and Video lanes respectively.

---

## 4. Editing operations

| Operation | Notes |
|---|---|
| Trim / slip / slide | mirrors the video clip transforms ([06](06-TIMELINE.md)) |
| Split | at the playhead, sample-accurate |
| **Fade in/out** | per clip, with the four timeline easings |
| **Volume keyframes** | reuse the existing `Keyframe` model — property `'volume'` |
| **Time-stretch** | pitch-preserving (WSOLA / phase vocoder) — needed for the Corporate `speedRange` 0.70–1.60× ([09](09-GENRE-SYSTEM.md)) |
| **Pitch shift** | independent of time (formant-preserving option) |
| **Normalise** | peak or loudness (below) |
| **Denoise** | spectral subtraction / RNNoise for field recordings (Documentary) |
| **Foley sync** | place SFX against the picture, with snapping |

The `speedRange` knob in the genre SmartCut profiles is meaningless without time-stretch; this is where it
becomes real.

---

## 5. Loudness & delivery

Broadcast and platform delivery have hard loudness targets. Implement an **EBU R128 / ITU-R BS.1770**
meter and a normaliser:

| Target | LUFS | True peak |
|---|---|---|
| Broadcast (EBU R128) | −23 LUFS | −1.0 dBTP |
| Streaming (web/social) | −14 LUFS | −1.0 dBTP |
| Cinema | −27 LUFS (dialnorm) | — |

- **Meter**: integrated, short-term (3s), momentary (400ms), plus LRA and true-peak, live in the UI.
- **Normalise**: measure the mix, apply a gain to hit the target, with a true-peak limiter.
- Implemented via FFmpeg's `loudnorm` filter in the mux stage, and/or a WebAudio analyser for live metering.

This is a checkbox item on any professional delivery spec, and it is missing entirely today.

---

## 6. Export: muxing (the critical fix)

Today `buildArgs` in `main/export.ts` hardcodes `-an`. The fix:

1. Render/mix the audio offline: `OfflineAudioContext` (renderer) or an FFmpeg `filter_complex` (main).
2. Produce a **WAV/PCM** of the full mix at the composition's rate.
3. Pass it as a **second FFmpeg input** and map both streams:

```text
ffmpeg -f rawvideo -pix_fmt rgba -s WxH -r FPS -i pipe:0 \
       -i mix.wav \
       -map 0:v:0 -map 1:a:0 \
       -c:v <encoder> … -c:a aac -b:a 320k -ar 48000 \
       -shortest -y out.mp4
```

- Codec per container: `aac` (mp4/mov), `pcm_s16le` (mov master), `libopus` (webm).
- `-shortest` guards against audio/video length drift.
- For ProRes mezzanine, `pcm_s24le` matches the 10-bit video.

### A/V sync validation

Drift is the classic bug. Verify:

- Frame count ≈ `round(fps × duration)` and sample count ≈ `round(sampleRate × duration)`.
- First/last frame timestamps align to the audio start/end within one sample.
- A test tone at a known timecode lands at that timecode in the output.

---

## 7. AI-assisted audio (local)

| Feature | Method |
|---|---|
| **Silence/beat detection** | energy + onset detection → auto-cut, beat-sync ([09](09-GENRE-SYSTEM.md) Corporate pacing) |
| **Speech transcription** | Whisper (ONNX) → also feeds captions ([26](26-CAPTIONS.md)) |
| **Speaker diarization** | who spoke when → speaker lower-thirds and per-speaker buses |
| **Music ducking** | sidechain: duck music under dialogue automatically |
| **Auto-mix** | balance dialogue/music/effects to a target loudness |
| **Voice isolation** | source separation (Demucs-class, ONNX) for noisy field audio |

All local, all producing **editable objects** (fades, keyframes, bus automation) — never opaque baked
audio.

---

## Data model additions

```typescript
interface AudioClip {
  id: string;
  trackId: string;              // 'audio' (later: bus ids)
  mediaId: string;              // link to decoded media
  /** Source in-point; supports slip without moving the clip. */
  sourceStart: number;
  start: number;
  end: number;
  gain: number;
  fades: { in: number; out: number };
  keyframes: Keyframe[];        // property 'volume'
  bus: 'master' | 'music' | 'dialogue' | 'sfx';
}
```

`ProjectDocument` gains `audio: { clips, buses, loudnessTarget }`; version bump per
[05](05-PROJECT-FORMAT.md#versioning--migration-policy).

---

## Verification

| Property | Test |
|---|---|
| J/L cut has no pop | crossfade region has no sample discontinuity > threshold |
| Loudness target | integrated LUFS of the render within ±0.5 of target |
| A/V sync | test tone lands at its timecode within one sample |
| Time-stretch preserves pitch | dominant frequency unchanged at 0.7× and 1.6× |
| Waveform accuracy | peaks match a brute-force min/max over the PCM |

---

Related: [06-TIMELINE](06-TIMELINE.md) · [07-EXPORT-PIPELINE](07-EXPORT-PIPELINE.md) ·
[11-GENRE-NARRATIVE](11-GENRE-NARRATIVE.md) · [26-CAPTIONS](26-CAPTIONS.md) · [29-MEDIA-PIPELINE](29-MEDIA-PIPELINE.md)
