# 41 — Render Format & Codec Reference

**Status: 🟡 (two export presets work; the full catalogue is ⬜) · Code: `engine/export.ts`, `main/export.ts`, `main/ffmpeg.ts` → target: the full catalogue**

> The export pipeline is real and functional — two presets (1080p H.264, 4K ProRes), encoder
> probing, backpressure, cancellation. This document is the complete format and codec reference.

---

## 1. What exists today

### 1.1 The two presets

```typescript
// engine/export.ts
interface ExportTarget {
  id: ExportPresetId;       // 'fast-1080p' | 'prores-4k'
  label: string;
  width: number; height: number;
  fps: number;
  codec: string;
  bitrateKbps: number;
  encoder: string;           // probed: nvenc > qsv > amf > libx264
  container: 'mp4' | 'mov';
}
```

| Preset | Resolution | Codec | Container | Use |
|---|---|---|---|---|
| `fast-1080p` | 1920×1080 | H.264 (yuv420p) | mp4 | web, social, review |
| `prores-4k` | 3840×2160 | ProRes 422 HQ (yuv422p10le) | mov | mezzanine, broadcast |

### 1.2 Encoder probing

`main/ffmpeg.ts` — `probeEncoders()`:

```
h264: h264_nvenc > h264_qsv > h264_amf > libx264
hevc: hevc_nvenc > hevc_qsv > hevc_amf > libx265
prores: prores_ks > prores_aw > prores
```

### 1.3 The pipeline

```
WebGPU render → RGBA framebuffer → readBack (mapAsync) → rawvideo stdin → ffmpeg encode → disk
```

Backpressure: queue max 8 frames; when full, the handler awaits until it drops to 4.

---

## 2. The full format catalogue (target)

### 2.1 Video codecs

| Codec | Container | Pixel format | Use | Hardware |
|---|---|---|---|---|
| **H.264** | mp4 | yuv420p | web, social, review | NVENC, QSV, AMF, libx264 |
| **H.265/HEVC** | mp4 | yuv420p | high-quality web | NVENC, QSV, AMF, libx265 |
| **AV1** | webm/mp4 | yuv420p | next-gen web | av1_nvenc, av1_qsv, libaom |
| **VP9** | webm | yuv420p | web (YouTube) | libvpx-vp9 |
| **ProRes 422** | mov | yuv422p10le | mezzanine | prores_ks |
| **ProRes 4444** | mov | yuva444p16le | alpha + quality | prores_ks |
| **DNxHR** | mov/mxf | yuv422p | broadcast | dnxhd |
| **JPEG XS** | mxf | yuv422p | low-latency broadcast | jpegxs |

### 2.2 Audio codecs

| Codec | Container | Bitrate | Use |
|---|---|---|---|
| **AAC** | mp4/mov | 320k | web, social |
| **PCM (s16le)** | mov | lossless | mezzanine |
| **PCM (s24le)** | mov | lossless | broadcast mezzanine |
| **Opus** | webm | 128k | web |
| **MP3** | mp3 | 320k | legacy |

### 2.3 Still formats

| Format | Use |
|---|---|
| **PNG** | lossless stills, thumbnails |
| **TIFF** | high-quality stills |
| **EXR** | HDR, CG passes |
| **WebP** | web-optimized stills |

### 2.4 Sidecar formats

| Format | Use |
|---|---|
| **SRT** | plain subtitles |
| **VTT** | web subtitles |
| **ASS/SSA** | styled subtitles, karaoke |
| **EDL (CMX 3600)** | edit decision list |
| **FCPXML** | Final Cut Pro interchange |
| **OTIO** | OpenTimelineIO |
| **XML** | Premiere/Resolve interchange |

---

## 3. Resolution presets

| Name | Dimensions | Aspect | Use |
|---|---|---|---|
| **SD** | 720×480 | 4:3 | legacy |
| **HD** | 1280×720 | 16:9 | web |
| **FHD** | 1920×1080 | 16:9 | web, social |
| **QHD** | 2560×1440 | 16:9 | high-quality web |
| **4K UHD** | 3840×2160 | 16:9 | broadcast, mezzanine |
| **8K UHD** | 7680×4320 | 16:9 | future-proof |
| **4K DCI** | 4096×2160 | 19:10 | cinema |
| **Vertical FHD** | 1080×1920 | 9:16 | Reels, TikTok, Shorts |
| **Square** | 1080×1080 | 1:1 | Instagram |
| **Portrait 4:5** | 1080×1350 | 4:5 | Instagram portrait |
| **Scope** | 2560×1080 | 2.39:1 | cinematic |

---

## 4. Colour space & HDR

### 4.1 Colour metadata

| Parameter | Flag | Values |
|---|---|---|
| Primaries | `-color_primaries` | bt709, bt2020, smpte432, smpte240m |
| Transfer | `-color_trc` | bt709, iec61966-2-1 (sRGB), smpte2084 (PQ), arib-std-b67 (HLG) |
| Matrix | `-colorspace` | bt709, bt2020nc, smpte2084 |

### 4.2 HDR delivery

| Format | Transfer | Metadata |
|---|---|---|
| **HDR10 (PQ)** | ST.2084 | `--max-cll`, `--master-display` |
| **HLG** | ARIB STD-B67 | implicit |
| **Dolby Vision** | proprietary | RPU sidecar |

### 4.3 Colour space mismatch

A colour-space mismatch is an **export error**, not a silent tag lie — validate before writing.

---

## 5. Bitrate & quality

### 5.1 Bitrate targets

| Delivery | Resolution | Bitrate | Notes |
|---|---|---|---|
| Social | 1080p | 8–12 Mbps | H.264, yuv420p |
| Web | 1080p | 8–15 Mbps | H.264, faststart |
| High-quality web | 4K | 35–45 Mbps | H.265 |
| Mezzanine | 4K | — | ProRes 422 HQ (constant quality) |
| Broadcast | 4K | 50+ Mbps | XAVC, DNxHR |

### 5.2 Rate control

| Mode | Flag | Use |
|---|---|---|
| **CRF** | `-crf 18` | constant quality (libx264) |
| **VBR** | `-rc vbr -cq 21` | variable bitrate (NVENC) |
| **CBR** | `-b:v 12000k` | constant bitrate (streaming) |

---

## 6. Audio loudness

| Target | LUFS | True peak | Use |
|---|---|---|---|
| **Broadcast (EBU R128)** | −23 LUFS | −1.0 dBTP | broadcast |
| **Streaming** | −14 LUFS | −1.0 dBTP | web, social |
| **Cinema** | −27 LUFS | — | theatrical |

Implemented via FFmpeg's `loudnorm` filter in the mux stage. See [25](25-AUDIO.md#5-loudness--delivery).

---

## 7. Frame rate conversion

| From | To | Method |
|---|---|---|
| 24 | 30 | frame blending or duplication |
| 24 | 60 | frame interpolation (RIFE, [29](29-MEDIA-PIPELINE.md)) |
| 30 | 24 | pulldown removal |
| any | any | optical-flow retiming ([24](24-TRANSITIONS.md)) |

---

## 8. Verification

| Property | Test |
|---|---|
| Encoder probing | a box without NVENC falls back to QSV/AMF/libx264 |
| Format correctness | output metadata matches the declared codec/space |
| A/V sync | test tone at a known timecode lands there ([25](25-AUDIO.md)) |
| Loudness | integrated LUFS within ±0.5 of target |
| Frame count | `round(fps × duration)` frames in the output |
| HDR metadata | PQ output carries `--master-display` and `--max-cll` |

---

Related: [07-EXPORT-PIPELINE](07-EXPORT-PIPELINE.md) · [30-RENDER-QUEUE](30-RENDER-QUEUE.md) ·
[23-COLOR](23-COLOR.md#6-colour-management) · [25-AUDIO](25-AUDIO.md) · [29-MEDIA-PIPELINE](29-MEDIA-PIPELINE.md)
