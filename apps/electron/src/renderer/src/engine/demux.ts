// ── Container Demuxer ────────────────────────────────────────────────────────
// Pure ISOBMFF/MP4 demuxing built on mp4box. Produces raw sample buffers plus
// the decoder configuration a WebCodecs VideoDecoder needs.
//
// This module is deliberately free of DOM, WebCodecs, and Electron imports so
// it can be unit-tested in plain Node (see docs/19-QUALITY-AND-TESTS.md). The
// WebCodecs step that consumes its output lives in engine/media.ts.
//
// See docs/29-MEDIA-PIPELINE.md §1–2.

import { createFile, DataStream, Endianness, type Movie, MP4BoxBuffer, type Sample } from 'mp4box';

/** A single demuxed access unit, timestamps already converted to microseconds. */
export interface DemuxedSample {
  /** The compressed access unit bytes (length-prefixed NALUs for H.264/HEVC). */
  data: Uint8Array;
  /** Presentation timestamp in microseconds, as WebCodecs expects. */
  timestamp: number;
  /** Duration in microseconds. */
  duration: number;
  /** True on keyframes — where a seek must land. */
  isKey: boolean;
}

/** Everything needed to configure a decoder and describe a clip. */
export interface DemuxedVideo {
  /** RFC 6381 codec string, e.g. 'avc1.42c01e'. */
  codec: string;
  /**
   * Decoder configuration record (the avcC/hvcC/vpcC/av1C box payload).
   * Required for H.264, HEVC, VP9 and AV1 in MP4; absent for raw formats.
   */
  description?: Uint8Array;
  width: number;
  height: number;
  /** Seconds. */
  duration: number;
  fps: number;
  samples: DemuxedSample[];
}

/** Decoder-config boxes, keyed by the sample entry that carries them. */
const CONFIG_BOXES = ['avcC', 'hvcC', 'vpcC', 'av1C', 'vvcC'] as const;

/**
 * Serialize a decoder-config box to the bare payload WebCodecs wants.
 * mp4box's `write` emits a full box, so the 8-byte header is stripped.
 *
 * The stream must be big-endian: ISOBMFF stores every multi-byte field that
 * way, and mp4box's box writers use the stream's own endianness. Using the
 * stream default here byte-swaps the 16-bit NALU lengths, which makes
 * Chromium reject the record with "Failed to parse avcC".
 */
function serializeConfigBox(box: { write(stream: DataStream): void }): Uint8Array {
  const stream = new DataStream(undefined, 0, Endianness.BIG_ENDIAN);
  box.write(stream);
  const full = new Uint8Array(stream.buffer);
  return full.slice(8);
}

interface SampleEntryLike {
  avcC?: { write(stream: DataStream): void };
  hvcC?: { write(stream: DataStream): void };
  vpcC?: { write(stream: DataStream): void };
  av1C?: { write(stream: DataStream): void };
  vvcC?: { write(stream: DataStream): void };
}

/**
 * Demux an MP4/MOV buffer into samples plus decoder configuration.
 *
 * Throws with a descriptive message on unsupported or malformed input — the
 * caller surfaces it to the UI rather than silently showing an empty clip.
 */
export function demuxVideoFile(input: ArrayBuffer, name = 'clip.mp4'): DemuxedVideo {
  const file = createFile();

  // mp4box releases mdat bytes as it parses by default, which leaves
  // getSample() with nothing to read. Retaining them is what makes sample
  // extraction work at all — see docs/29-MEDIA-PIPELINE.md.
  file.discardMdatData = false;

  // A holder, not a bare `let`: onReady assigns synchronously during
  // appendBuffer, but TypeScript cannot see through the callback and would
  // otherwise narrow the value to `never` after the null check below.
  const state: { info: Movie | null; error: string | null; samples: Sample[] } = {
    info: null,
    error: null,
    samples: [],
  };

  file.onError = (module, message) => {
    state.error = `${module}: ${message}`;
  };
  file.onReady = (info) => {
    state.info = info;
    const track = info.videoTracks[0];
    if (!track) {
      state.error = 'No video track in container';
      return;
    }
    file.setExtractionOptions(track.id, undefined, { nbSamples: 1000 });
  };
  file.onSamples = (_id, _user, batch) => {
    state.samples.push(...batch);
  };

  // A copy: mp4box takes ownership of the buffer's lifetime.
  const copy = input.slice(0);
  file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(copy, 0), true);

  // start() flips sampleProcessingStarted, which processSamples() gates on;
  // flush() then drains every pending sample into onSamples.
  file.start();
  file.flush();

  if (state.error) throw new Error(`${name}: demux failed — ${state.error}`);
  if (!state.info) throw new Error(`${name}: container never became ready (missing moov?)`);

  const info = state.info;
  const samples = state.samples;
  const track = info.videoTracks[0];
  if (!track) throw new Error(`${name}: no video track`);

  if (samples.length === 0) {
    throw new Error(
      `${name}: track ${track.id} reported ${track.nb_samples} samples but none were readable`,
    );
  }

  // Decoder configuration record, taken from the visual sample entry.
  let description: Uint8Array | undefined;
  try {
    const entry = file.getTrackById(track.id)?.mdia?.minf?.stbl?.stsd?.entries?.[0] as
      | SampleEntryLike
      | undefined;
    if (entry) {
      for (const key of CONFIG_BOXES) {
        const box = entry[key];
        if (box) {
          description = serializeConfigBox(box);
          break;
        }
      }
    }
  } catch {
    // Some containers have no config box; codecs that need one will reject.
    description = undefined;
  }

  const trackSeconds = track.duration / track.timescale;
  const fps = trackSeconds > 0 ? samples.length / trackSeconds : 30;

  const demuxed: DemuxedSample[] = samples.map((s) => {
    const scale = s.timescale || track.timescale;
    return {
      // Copy out: mp4box reuses its backing buffers once released.
      data: s.data ? s.data.slice() : new Uint8Array(s.size),
      timestamp: Math.round((s.cts / scale) * 1e6),
      duration: Math.round(((s.duration ?? 0) / scale) * 1e6),
      isKey: Boolean(s.is_sync),
    };
  });

  return {
    codec: track.codec,
    description,
    width: track.track_width || track.video?.width || 0,
    height: track.track_height || track.video?.height || 0,
    duration: info.duration / info.timescale,
    fps,
    samples: demuxed,
  };
}
