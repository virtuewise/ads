# 29 — Media Pipeline: Import, Decode, Proxies & Indexing

**Status: 🟡 (import → demux → WebCodecs decode works end to end; GPU upload, timeline binding, and audio are ⬜) · Code: `engine/demux.ts`, `engine/media.ts`, `main/media.ts`**

> **This is the frontier.** The compositor, timeline, and export are real; the media they operate on
> is only now becoming real. A user can import an MP4/MOV, and the editor demuxes the container,
> decodes every frame through WebCodecs, and shows a poster frame in the media bin — but the
> timeline still holds placeholder clips, and nothing samples a decoded frame on the GPU yet.
> Everything advanced depends on the rest of this document landing.

---

## The gap, precisely

| Capability | Today |
|---|---|
| Import media | ✅ **File → Import Media…** (native dialog via `media:pick`) and **drag-and-drop** onto the media bin |
| Demux | ✅ `engine/demux.ts` parses ISOBMFF with mp4box and emits `EncodedVideoChunk`-ready samples + the decoder config record |
| Decode video | ✅ `engine/media.ts` feeds a WebCodecs `VideoDecoder`; the media bin shows `N frames decoded` |
| Poster frame | ✅ `components/MediaThumb.tsx` draws the first decoded frame into a canvas |
| Frame → GPU texture | ✅ `device.importExternalTexture()` — the decoded frame reaches the GPU **without a copy** |
| Compositing a clip | ✅ a **media source** node in the DAG samples that texture; the bridge runs it in the single pass |
| Clip → media reference | ✅ `TimelineClip.mediaId` + `sourceStart`; the media bin's **+** button puts a clip on the timeline, and scrubbing the timeline scrubs the footage |
| Media survives a save/load | ✅ the project stores `assets[]` (where the footage is) and re-imports it on open |
| Audio | ⬜ none behind the track ([25](25-AUDIO.md)) |
| Metadata / indexing | 🟡 duration, dimensions, fps and codec come from the container; rotation and colour metadata are not read |
| Proxies | ⬜ none |
| Disposal | 🟡 `disposeMediaSource()` closes every cached `VideoFrame` |

The honest one-line summary: **a real container goes in and real decoded pixels come out the other
end of the compositor, the timeline drives them, and a saved project brings its footage back.** What is
still missing is the *editor* half: one clip at a time, no trimming of the source in-point, no slip,
and no multi-clip compositing.

---

## 0. What the pipeline looks like today

```
File → main/media.ts (dialog + fs.readFile)
     → renderer: engine/demux.ts   (mp4box → samples + avcC/hvcC/vpcC/av1C config)
     → renderer: engine/media.ts   (EncodedVideoChunk → VideoDecoder → VideoFrame ring buffer)
     → components/MediaThumb.tsx   (poster frame in the media bin and on the timeline clip)
     → TimelineClip.mediaId        (the media bin's + button puts it on the timeline)
     → engine/compiler.ts          (a mediaSource node reserves bindings 1 and 2)
     → components/WebGPUCanvas.tsx (importExternalTexture → the viewport)
```

`engine/demux.ts` is deliberately **pure** — no DOM, no WebCodecs, no Electron — so it is unit
testable in plain Node (`engine/demux.test.ts`, run by `pnpm --filter @printsync/electron test`).
`engine/media.ts` owns the browser half.

### Three demuxer details that are easy to get wrong

These cost real debugging time and are now covered by the regression test:

1. **`file.discardMdatData = false`** — mp4box releases the `mdat` payload as it parses by
   default, which leaves `getSample()` with nothing to read. Sample extraction silently yields
   zero samples until this is turned off.
2. **`file.start()` before `file.flush()`** — `processSamples()` returns immediately unless
   `sampleProcessingStarted` is set, and only `start()` sets it. Without it, `onSamples` never
   fires.
3. **Big-endian when serializing the decoder config** — mp4box's box writers use the
   `DataStream`'s own endianness, and the default is little-endian. A little-endian stream
   byte-swaps the 16-bit NALU lengths, and Chromium then rejects the record with
   `Failed to parse avcC`.

### Two WebCodecs details

4. **Never `flush()` mid-stream.** A flush puts the decoder back into "needs a key frame" state,
   and every sample after the first is a delta frame — the decoder dies with
   `A key frame is required after configure() or flush()`. Bound the queue with
   `decodeQueueSize` instead, and flush once at the end.
5. **The decoder config is mandatory for MP4.** H.264/HEVC/VP9/AV1 in an ISOBMFF container are
   length-prefixed (AVCC), so `VideoDecoder.configure()` needs the `avcC`/`hvcC`/`vpcC`/`av1C`
   payload as `description`.

---

## 1. Import

- ✅ **Drag-and-drop onto the media bin** and the OS file picker. The picker runs in the main
  process (`media:pick` → `main/media.ts`) and returns raw bytes over IPC; the renderer never
  touches `fs` ([08](08-SCRIPTING-API.md)).
- ✅ **Probe** each file: the demuxer yields container, codec, resolution, frame rate, duration,
  and the codec string.
- ⬜ **Register** the asset: id, path, hash (for dedupe), probe result, thumbnail, peaks
  ([25](25-AUDIO.md)). The media bin currently holds live `MediaSource` objects in React state
  and does not persist them into the project document.

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

- ✅ **`VideoDecoder`** — hardware-accelerated H.264/HEVC/VP9/AV1 decode (`engine/media.ts`).
- ⬜ **`AudioDecoder`** — audio where supported; otherwise main-process decode ([25](25-AUDIO.md)).
- ✅ **Demuxing** — `engine/demux.ts` wraps mp4box and produces samples plus the decoder config.
- ⬜ **Seek** — decode from the nearest keyframe, discard forward to the target. Today the whole
  clip is decoded up front, which is fine for short clips and wrong for long ones.

### Zero-copy to the GPU

The futuristic path avoids CPU round-trips:

- ✅ **`importExternalTexture()`** wraps a decoded `VideoFrame` in a GPU texture with **no copy**.
- ✅ The compositor samples that external texture directly ([22](22-COMPOSITOR.md)).
- ⬜ For multi-clip compositing, frames that must be cached are copied into a **texture pool**
  (still cheap — a GPU copy, not a CPU upload).

```typescript
// The compositor's media-layer source:
const external = device.importExternalTexture({ source: frame });
// bind `external` as the media source's input texture
```

This is what makes scrubbing 4K footage feel instant instead of sluggish.

> **How it is wired.** The compiler reserves binding 1 for `media_tex` (a `texture_external`) and
> binding 2 for its sampler whenever the graph contains a `mediaSource` node
> (`engine/compiler.ts`). The node's WGSL samples it with
> `textureSampleBaseClampToEdge(media_tex, media_samp, uv)`.
>
> An imported external texture **expires at the end of the current task**, so the viewport rebuilds
> the media bind group on every rendered frame. The sampler must not filter — external textures
> only support nearest sampling.
>
> **A trap worth knowing:** `queue.copyExternalImageToTexture()` from a decoded frame writes
> *transparent black*, not the video. WebCodecs hands out YUV frames (I420/NV12), and copying one
> into an `rgba8unorm` texture silently produces nothing — with no validation error to warn you.
> The external-texture path is the one that works.

### The bridge's part in it

A media source is a **leaf**: it samples a texture the compositor supplies, and returns a colour at
a given `uv`. That fits the single-pass bridge exactly — no intermediate render pass is needed,
because nothing upstream produces a texture. The one thing a single pass *cannot* do is chain
textures from node to node (a blur reading a colour source's output), which is why the bridge still
refuses those graphs ([§7](#7-what-this-unblocks)).

---

## 3. The frame ring buffer (the stutter killer)

The defining requirement from the Detective genre ([15](15-GENRE-DETECTIVE.md)) and the key to precise
trimming everywhere:

```
playhead ──► [ -30 frames ……… +30 frames ] ──► instant scrub, slip, step
                 pre-decoded WebCodecs frames
```

- ✅ A **ring buffer** of decoded `VideoFrame`s — `decodeVideoBuffer()` keeps the most recent
  `maxFrames` (default 120) and closes the oldest as it evicts them.
- ⬜ **Both directions.** The buffer only holds what has already been decoded; seeking backwards
  needs a re-decode from the previous keyframe.
- ⬜ **Budgeted by VRAM**: the window (±N frames) should shrink automatically at 4K/8K to fit the
  budget ([22](22-COMPOSITOR.md#performance--vram)).
- ✅ Frame stepping and single-frame slip are zero-latency **within** the decoded window, because
  the frames are already decoded.

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

> **Partly built.** `mediaId` and `sourceStart` exist and survive a save/load round-trip
> (`engine/project.ts`). The compositor samples the topmost media clip under the playhead, so
> scrubbing the timeline scrubs the footage. The project also stores `assets[]` — where each clip's
> footage lives on disk — so reopening a project re-imports it. Still ⬜: source in-point trimming
> and slip, per-clip transform/effects/grade, retime, and compositing more than one media clip at a
> time.

---

## 7. Thumbnails & posters

- ✅ **Poster frame** — `components/MediaThumb.tsx` draws the first decoded frame into a canvas in
  the media bin. It is drawn from the live `VideoFrame`, so a black rectangle means the decode
  failed even though the container parsed.
- ⬜ **Filmstrip** on the timeline clip: lazily decoded thumbnails at clip zoom, cached.
- ⬜ **Media bin grid** uses the posters; the **hover scrub** plays the poster sequence.

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

| Property | Test | Status |
|---|---|---|
| Container parse | the demuxer reads codec, dimensions, fps, duration and sample count from a real MP4 | ✅ `engine/demux.test.ts` |
| Decoder config | the `avcC` payload is byte-identical to the container's own, in big-endian order | ✅ `engine/demux.test.ts` |
| Timestamps | demuxed sample timestamps are monotonic and in microseconds | ✅ `engine/demux.test.ts` |
| Keyframe flags | the first sample is marked as a keyframe | ✅ `engine/demux.test.ts` |
| Malformed input | a non-container buffer is rejected with an error, not a crash | ✅ `engine/demux.test.ts` |
| Media bindings | a media graph reserves bindings 1 and 2 and calls `media_source(uv)` | ✅ `engine/compiler.test.ts` |
| Bridge | a media graph bridges successfully; a blur graph is still refused | ✅ `engine/compiler.test.ts` |
| End-to-end decode | an imported MP4 produces N decoded frames and a non-black poster frame | ✅ verified in the running app |
| End-to-end composite | the imported clip renders in the viewport through the DAG | ✅ verified in the running app (the ffmpeg test pattern appears) |
| Timeline binding | a clip added to the timeline shows a poster, and scrubbing scrubs the footage | ✅ verified in the running app |
| Save/load | `mediaId`, `sourceStart` and every easing survive a round-trip | ✅ `engine/project.test.ts` |
| Project round-trip | a saved project re-imports its footage and renders it in the viewport | ✅ verified in the running app |
| Frame accuracy | decoded frame at `t` matches an FFmpeg-extracted reference frame at `t` | ⬜ |
| Rotation handling | a rotated source renders upright | ⬜ |
| Multi-clip compositing | two clips composite with the right z-order and opacity | ⬜ |
| Proxy equivalence | proxy and source frames match after scaling within tolerance | ⬜ |
| Index integrity | re-scanning the same media yields identical index rows | ⬜ |

Run the demuxer tests with:

```
pnpm --filter @printsync/electron test
```

---

Related: [04-RENDERING](04-RENDERING.md) · [06-TIMELINE](06-TIMELINE.md) · [22-COMPOSITOR](22-COMPOSITOR.md) ·
[25-AUDIO](25-AUDIO.md) · [26-CAPTIONS](26-CAPTIONS.md) · [30-RENDER-QUEUE](30-RENDER-QUEUE.md)
