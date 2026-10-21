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
  /**
   * The decoder configuration record, kept so the source can be decoded again
   * around a new playhead position.
   */
  description?: Uint8Array;
  /**
   * The compressed samples, kept so the source can be decoded again around a
   * new playhead position. These are the bytes, not pixels: a 4K clip is a few
   * megabytes, while its decoded frames are gigabytes.
   */
  samples: DemuxedSample[];
  /**
   * The decoded window around the playhead. It is a window, not the whole
   * clip: the frames outside it are released, and are re-decoded on demand.
   */
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
    description: demuxed.description,
    samples: demuxed.samples,
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
  //
  // Only the first window is decoded: the rest of the clip stays compressed
  // until the playhead needs it, which keeps the import fast and the memory
  // bounded no matter how long the clip is.
  const windowSamples = demuxed.samples.slice(0, LOOKAHEAD_FRAMES);
  for (const sample of windowSamples) {
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
  // The decoder has done its job; release it. The source can be decoded again
  // later from the compressed samples.
  try {
    decoder.close();
  } catch {
    // Already closed.
  }
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
    description: d.description,
    samples: d.samples,
    decodePosition: 0,
    complete: false,
  };
}

/**
 * Get the frame closest to a given time.
 *
 * Only the decoded window is searched. A miss returns null rather than the
 * nearest frame that happens to be left: returning a frame from the wrong
 * part of the clip is worse than returning none.
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
  // Half a frame interval: close enough to be the right picture.
  const tolerance = 0.5 / Math.max(1, source.fps);
  return minDiff <= tolerance ? closest : null;
}

/** How many frames to decode ahead of the playhead. */
const LOOKAHEAD_FRAMES = 30;

/**
 * Make sure the frame at `time` is decoded, and return it.
 *
 * The decoded frames are a window around the playhead, not the whole clip:
 * a 4K clip's frames are gigabytes, while its compressed samples are
 * megabytes. When the playhead leaves the window, the window is re-decoded
 * from the nearest keyframe — which is fast, because only the compressed
 * samples are re-read.
 */
export async function decodeFrameAt(
  source: MediaSource,
  time: number,
  onProgress?: (progress: number) => void,
): Promise<DecodedFrame | null> {
  // Already in the window?
  const cached = getFrameAtTime(source, time);
  if (cached) return cached;
  if (!hasVideoDecoder() || source.samples.length === 0) return null;

  // The keyframe at or before the target, and the samples to decode.
  const targetUs = time * 1e6;
  let start = 0;
  for (let i = 0; i < source.samples.length; i += 1) {
    const s = source.samples[i];
    if (s.timestamp > targetUs) break;
    if (s.isKey) start = i;
  }
  let end = start;
  while (
    end < source.samples.length &&
    (source.samples[end].timestamp <= targetUs || end - start < LOOKAHEAD_FRAMES)
  ) {
    end += 1;
    if (end - start >= LOOKAHEAD_FRAMES && source.samples[end - 1].timestamp > targetUs) break;
  }

  const decoded: DecodedFrame[] = [];
  let failed = false;
  const decoder = new VideoDecoder({
    output: (frame: VideoFrame) => {
      decoded.push({ frame, timestamp: frame.timestamp / 1e6, frameNumber: decoded.length });
    },
    error: (e) => {
      console.error('Decode error:', e);
      failed = true;
    },
  });

  try {
    decoder.configure({
      codec: source.codec,
      ...(source.description ? { description: source.description } : {}),
      codedWidth: source.width,
      codedHeight: source.height,
      optimizeForLatency: true,
    });
    for (let i = start; i < end && i < source.samples.length; i += 1) {
      const s = source.samples[i];
      decoder.decode(
        new EncodedVideoChunk({
          type: s.isKey ? 'key' : 'delta',
          timestamp: s.timestamp,
          duration: s.duration,
          data: s.data,
        }),
      );
    }
    await decoder.flush().catch(() => undefined);
  } catch (e) {
    console.error('Could not decode the window:', e);
    failed = true;
  } finally {
    try {
      decoder.close();
    } catch {
      // Already closed.
    }
  }
  if (failed) {
    for (const d of decoded) d.frame.close();
    return null;
  }

  // Replace the window, releasing the frames it held.
  for (const frame of source.frames) frame.frame.close();
  source.frames = decoded;
  source.decodePosition = start;

  if (onProgress) onProgress(Math.min(1, (end - start) / Math.max(1, source.samples.length)));

  return getFrameAtTime(source, time);
}

/**
 * Dispose of a media source and release all frames.
 */
export function disposeMediaSource(source: MediaSource): void {
  for (const frame of source.frames) {
    frame.frame.close();
  }
  source.frames = [];
  source.samples = [];
  source.complete = false;
}
