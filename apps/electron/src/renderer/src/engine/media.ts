// ── Media Pipeline ────────────────────────────────────────────────────────────
// WebCodecs-based media decoder for video import and playback.
//
// The container half lives in engine/demux.ts (pure, Node-testable). This
// module owns the browser half: feeding EncodedVideoChunks to a VideoDecoder
// and keeping a ring buffer of decoded VideoFrames around the playspot.
//
// See docs/29-MEDIA-PIPELINE.md and docs/04-RENDERING.md.

import { type DemuxedSample, type DemuxedVideo, demuxVideoFile } from './demux';

export interface DecodedFrame {
  /** The decoded video frame. */
  frame: VideoFrame;
  /** Timestamp in seconds. */
  timestamp: number;
  /** Frame number. */
  frameNumber: number;
}

export interface MediaSource {
  /** Unique identifier. */
  id: string;
  /** File name. */
  name: string;
  /**
   * Where the file lives on disk, so a saved project can re-import it.
   * Empty for files that arrived by drag-and-drop.
   */
  path: string;
  /** Duration in seconds. */
  duration: number;
  /** Frame rate. */
  fps: number;
  /** Width. */
  width: number;
  /** Height. */
  height: number;
  /** RFC 6381 codec string, e.g. 'avc1.42c01e'. */
  codec: string;
  /** The decoded frames (ring buffer). */
  frames: DecodedFrame[];
  /** Current decode position. */
  decodePosition: number;
  /** Whether decoding is complete. */
  complete: boolean;
}

export interface MediaDecoderConfig {
  /** Maximum number of frames to keep in the ring buffer. */
  maxFrames: number;
  /** Target frame rate for decoding. */
  targetFps: number;
  /** Where the file lives on disk, so a saved project can re-import it. */
  path?: string;
}

const DEFAULT_MAX_FRAMES = 120;

/** True when this browser exposes the WebCodecs VideoDecoder. */
export function hasVideoDecoder(): boolean {
  return typeof VideoDecoder !== 'undefined';
}

/**
 * Demux a video buffer and decode every sample into a ring buffer of frames.
 *
 * This is the "decode the whole clip up front" path — correct and simple, and
 * the right fit for the ±N frame working window that precise trimming needs
 * (docs/29 §3). Streaming/seeking decode is the next step.
 */
export async function decodeVideoBuffer(
  input: ArrayBuffer,
  name: string,
  config: Partial<MediaDecoderConfig> = {},
  onProgress?: (progress: number) => void,
): Promise<MediaSource> {
  const maxFrames = config.maxFrames ?? DEFAULT_MAX_FRAMES;

  const demuxed: DemuxedVideo = demuxVideoFile(input, name);

  const source: MediaSource = {
    id: `media-${Date.now().toString(36)}`,
    name,
    path: config.path ?? '',
    duration: demuxed.duration,
    fps: demuxed.fps,
    width: demuxed.width,
    height: demuxed.height,
    codec: demuxed.codec,
    frames: [],
    decodePosition: 0,
    complete: false,
  };

  if (!hasVideoDecoder()) {
    console.warn('WebCodecs VideoDecoder unavailable; media will not decode');
    return source;
  }

  let failed = false;
  const decoder = new VideoDecoder({
    output: (frame: VideoFrame) => {
      const timestamp = frame.timestamp / 1e6; // microseconds to seconds
      source.frames.push({ frame, timestamp, frameNumber: source.frames.length });
      // Ring buffer: release the oldest frame so VRAM stays bounded.
      while (source.frames.length > maxFrames) {
        const old = source.frames.shift();
        old?.frame.close();
      }
      if (onProgress) onProgress(source.frames.length / Math.max(1, demuxed.samples.length));
    },
    error: (e) => {
      console.error('Decode error:', e);
      failed = true;
    },
  });

  try {
    decoder.configure({
      codec: demuxed.codec,
      ...(demuxed.description ? { description: demuxed.description } : {}),
      codedWidth: demuxed.width,
      codedHeight: demuxed.height,
      optimizeForLatency: true,
    });
  } catch (e) {
    console.warn(`Decoder rejected ${demuxed.codec}:`, e);
    return source;
  }

  // Feed chunks with back-pressure on the decoder queue.
  //
  // Flushing mid-stream would be the obvious way to bound the queue, but a
  // flush puts the decoder back into "needs a key frame" state — and every
  // sample after the first is a delta frame, so the decoder dies with
  // "A key frame is required after configure() or flush()". Instead, wait for
  // the queue to drain and only flush once, at the end.
  for (const sample of demuxed.samples) {
    if (failed || decoder.state === 'closed') break;
    while (decoder.decodeQueueSize > 8) {
      await new Promise<void>((resolve) => {
        const onDequeue = () => {
          if (decoder.decodeQueueSize <= 8) {
            decoder.removeEventListener('dequeue', onDequeue);
            resolve();
          }
        };
        decoder.addEventListener('dequeue', onDequeue);
        // Fallback poll in case the queue drains before the listener lands.
        setTimeout(onDequeue, 4);
      });
    }
    try {
      decoder.decode(toEncodedChunk(sample));
    } catch (e) {
      // A closed decoder throws; report it once and stop feeding.
      console.error('Decode stopped:', e);
      failed = true;
      break;
    }
  }
  await decoder.flush().catch(() => undefined);
  source.complete = !failed;
  return source;
}

/** Wrap a demuxed sample in the WebCodecs chunk type. */
function toEncodedChunk(sample: DemuxedSample): EncodedVideoChunk {
  return new EncodedVideoChunk({
    type: sample.isKey ? 'key' : 'delta',
    timestamp: sample.timestamp,
    duration: sample.duration,
    data: sample.data,
  });
}

/**
 * Probe a container without decoding it — dimensions, duration and codec only.
 * Cheap enough to run on every file dropped into the media bin.
 */
export function probeVideo(input: ArrayBuffer, name: string): Omit<MediaSource, 'id' | 'frames'> {
  const d = demuxVideoFile(input, name);
  return {
    name,
    path: '',
    duration: d.duration,
    fps: d.fps,
    width: d.width,
    height: d.height,
    codec: d.codec,
    decodePosition: 0,
    complete: false,
  };
}

/**
 * Get the frame closest to a given time.
 */
export function getFrameAtTime(source: MediaSource, time: number): DecodedFrame | null {
  if (source.frames.length === 0) return null;
  let closest = source.frames[0];
  let minDiff = Math.abs(closest.timestamp - time);
  for (const frame of source.frames) {
    const diff = Math.abs(frame.timestamp - time);
    if (diff < minDiff) {
      minDiff = diff;
      closest = frame;
    }
  }
  return closest;
}

/**
 * Dispose of a media source and release all frames.
 */
export function disposeMediaSource(source: MediaSource): void {
  for (const frame of source.frames) {
    frame.frame.close();
  }
  source.frames = [];
  source.complete = false;
}
