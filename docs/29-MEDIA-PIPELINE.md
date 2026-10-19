# 29 — Media Pipeline: Import, Decode, Proxies & Indexing

**Status: ⬜ (the timeline holds only engine-seeded placeholder clips) · Code (target): `engine/media/*`, `main/media.ts`**

> **This is the frontier.** The compositor, timeline, and export are real; the media they operate on is
> not. The timeline holds placeholder clips and the composite renders a procedural scene
> ([01-PRODUCT](01-PRODUCT.md)). Everything advanced depends on this document landing first.

---

## The gap, precisely

| Capability | Today |
|---|---|
| Import media | ⬜ none |
| Decode video | ⬜ none behind the compositor |
| Frame → GPU texture | ⬜ none (the composite samples nothing) |
| Clip → media reference | ⬜ (`TimelineClip` has a `name`, not a `mediaId`) |
| Audio | ⬜ none behind the track ([25](25-AUDIO.md)) |
| Metadata / indexing | ⬜ none |
| Proxies | ⬜ none |

---

## 1. Import

- **Drag-and-drop onto the media bin** and the OS file picker, both through the preload bridge
  ([08](08-SCRIPTING-API.md) — never `fs` in the renderer).
- **Probe** each file in the **main process** via FFmpeg/ffprobe: container, streams, codecs, resolution,
  frame rate, duration, rotation, colour metadata, audio channels/sample rate.
- **Register** the asset: id, path, hash (for dedupe), probe result, thumbnail, peaks ([25](25-AUDIO.md)).

```typescript
interface MediaAsset {
  id: string;
  path: string;
  kind: 'video' | 'audio' | 'image' | 'sequence';
  hash: string;
  probe: MediaProbe;            // streams, codecs, frames, colour, rotation
  duration: number;
  posters: string[];            // thumbnail frames
  peaksPath?: string;           // audio waveform cache
  proxyPath?: string;           // optional low-res proxy
  status: 'ready' | 'probing' | 'error';
}
```

---

## 2. Decode: WebCodecs, hardware-accelerated

The decode path abandons in-process FFmpeg demuxing for the browser-native API:

- **`VideoDecoder`** — hardware-accelerated H.264/HEVC/VP9/AV1 decode.
- **`AudioDecoder`** — audio where supported; otherwise main-process decode ([25](25-AUDIO.md)).
- **Demuxing** — a JavaScript MP4 demuxer (mp4box.js) / WebCodecs demuxer, or main-process FFmpeg stream-copies samples on demand.
- **Seek** — decode from the nearest keyframe, discard forward to the target.

### Zero-copy to the GPU

The futuristic path avoids CPU round-trips:

- **`importExternalTexture()`** wraps a decoded `VideoFrame` in a GPU texture with **no copy**.
- The compositor samples that external texture directly ([22](22-COMPOSITOR.md)).
- For multi-clip compositing, frames that must be cached are copied into a **texture pool** (still cheap —
  a GPU copy, not a CPU upload).

```typescript
// The compositor's media-layer source, conceptually:
const frame: VideoFrame = await decoder.getFrameAt(t);
const external = device.importExternalTexture({ source: frame });
// bind `external` as the layer's input texture
```

This is what makes scrubbing 4K footage feel instant instead of sluggish.

---

## 3. The frame ring buffer (the stutter killer)

The defining requirement from the Detective genre ([15](15-GENRE-DETECTIVE.md)) and the key to precise
trimming everywhere:

```
playhead ──► [ -30 frames ……… +30 frames ] ──► instant scrub, slip, step
                 pre-decoded WebCodecs frames
```

- A **ring buffer** of decoded `VideoFrame`s around the playhead, in both directions.
- **WebCodecs** issues decode requests ahead of and behind the playspot.
- **Budgeted by VRAM**: the window (±N frames) shrinks automatically at 4K/8K to fit the budget
  ([22](22-COMPOSITOR.md#performance--vram)).
- Frame stepping, single-frame slip, and reverse playback all become **zero-latency** because the frames
  are already decoded.

This is a generalization of `renderFrame.ts`'s single-frame approach ([04](04-RENDERING.md)) to a working
window.

---

## 4. Proxies

Editing 4K/8K on modest hardware needs proxies:

- Generate a **half- or quarter-resolution** proxy (H.264, low bitrate) on import, in the main process.
- Edit against the proxy; **swap to full-res at export** automatically.
- A **quality toggle** in the viewport (`Full` / `Half` / `Quarter`) that changes which is sampled.
- Export always uses full-res source ([30](30-RENDER-QUEUE.md) frames are rendered from source, not proxy),
  preserving the WYSIWYG contract for the deliverable.

---

## 5. Metadata & indexing

A local index (SQLite in the main process) makes footage searchable — the Documentary genre's core need
([14](14-GENRE-DOCUMENTARY.md)):

| Indexed | Use |
|---|---|
| Technical metadata | resolution, fps, codec, duration, colour |
| User markers / tags | organise, filter |
| Transcripts ([26](26-CAPTIONS.md)) | **search the spoken word** → jump to timecode |
| Detected scenes | auto-cut ([09](09-GENRE-SYSTEM.md) Corporate/Explainer) |
| Detected faces/subjects | reframe ([09](09-GENRE-SYSTEM.md) `subject-lock`), caption placement ([26](26-CAPTIONS.md)) |
| Quality signals | sharpness, exposure, stability — for take selection ([11](11-GENRE-NARRATIVE.md)) |
| Beat/energy | music-driven cutting ([25](25-AUDIO.md)) |

Queries go through IPC: `window.studio.media.search(...)`.

### Analysis passes (local)

Scene detection, face/subject detection, shot-quality scoring, and transcription all run **locally**
(FFmpeg scene filter, ONNX models, Whisper). Results are stored in the index, so a search is instant and an
agent can query footage without re-analysing it.

---

## 6. Clip → media wiring

`TimelineClip` gains media linkage ([06](06-TIMELINE.md)):

```typescript
interface TimelineClip {
  id: string;
  trackId: string;
  start: number;
  end: number;
  name: string;
  keyframes: Keyframe[];
  // ── new ──
  mediaId?: string;             // source asset
  sourceStart?: number;         // in-point in the source (slip/trim)
  speed?: number;               // retime factor; 1 = normal
  reverse?: boolean;
  transform?: TransformStack;   // per-clip layer transform
  effects?: string[];           // effect node ids
  grade?: string[];             // grade node ids
}
```

With this, rendering a frame becomes: **for each visible clip → decode its media frame → apply its
transform/effects/grade → composite** ([22](22-COMPOSITOR.md)) → output. That is what turns the editor from
an engine demo into an editor.

`ProjectDocument.version` bumps; `normalizeProject` tolerates clips without `mediaId` (old projects keep
loading — [05](05-PROJECT-FORMAT.md#versioning--migration-policy)).

---

## 7. Thumbnails & posters

- **Poster frames** (first/25%/50%/75%) generated on import via FFmpeg, cached.
- **Filmstrip** on the timeline clip: lazily decoded thumbnails at clip zoom, cached.
- **Media bin grid** uses the posters; the **hover scrub** plays the poster sequence.

All cached to disk keyed by asset hash, so reopening a project is instant.

---

## 8. What this unblocks

| Feature | Depends on |
|---|---|
| Real compositing (media layers) | decode + GPU texture |
| Transitions between real clips | two decoded layers ([24](24-TRANSITIONS.md)) |
| Auto-captions | audio decode ([26](26-CAPTIONS.md)) |
| J/L cuts | audio decode ([25](25-AUDIO.md)) |
| Scene auto-cut | scene index |
| Auto-reframe | subject index |
| Transcript editing | transcript index |
| Proxies / smooth 4K editing | decode + proxy |
| Frame-accurate trimming | ring buffer ([15](15-GENRE-DETECTIVE.md)) |
| Headless CLI ([31](31-AI-AGENTIC-SCALE.md)) | decode off-screen |

---

## Verification

| Property | Test |
|---|---|
| Frame accuracy | decoded frame at `t` matches an FFmpeg-extracted reference frame at `t` |
| Rotation handling | a rotated source renders upright |
| Ring-buffer correctness | frames in the window are correct and in order |
| Zero-copy path | `importExternalTexture` produces pixels identical to a CPU-uploaded texture |
| Proxy equivalence | proxy and source frames match after scaling within tolerance |
| Index integrity | re-scanning the same media yields identical index rows |

---

Related: [04-RENDERING](04-RENDERING.md) · [06-TIMELINE](06-TIMELINE.md) · [22-COMPOSITOR](22-COMPOSITOR.md) ·
[25-AUDIO](25-AUDIO.md) · [26-CAPTIONS](26-CAPTIONS.md) · [30-RENDER-QUEUE](30-RENDER-QUEUE.md)
