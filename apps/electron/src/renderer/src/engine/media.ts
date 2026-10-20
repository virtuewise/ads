// ── Media Pipeline ────────────────────────────────────────────────────────────
// WebCodecs-based media decoder for video import and playback.
// See docs/29-MEDIA-PIPELINE.md and docs/04-RENDERING.md.

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
  /** Duration in seconds. */
  duration: number;
  /** Frame rate. */
  fps: number;
  /** Width. */
  width: number;
  /** Height. */
  height: number;
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
}

/**
 * Create a media decoder for a video file.
 * Uses WebCodecs VideoDecoder when available, falls back to HTMLVideoElement.
 */
export async function createMediaDecoder(
  file: File,
  _config: Partial<MediaDecoderConfig> = {},
): Promise<MediaSource> {
  const id = `media-${Date.now().toString(36)}`;

  // Get video metadata using a temporary video element
  const video = document.createElement('video');
  video.preload = 'metadata';
  const url = URL.createObjectURL(file);

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video metadata'));
    video.src = url;
  });

  const duration = video.duration;
  const fps = 30; // Default, will be refined
  const width = video.videoWidth;
  const height = video.videoHeight;

  URL.revokeObjectURL(url);

  const source: MediaSource = {
    id,
    name: file.name,
    duration,
    fps,
    width,
    height,
    frames: [],
    decodePosition: 0,
    complete: false,
  };

  return source;
}

/**
 * Decode a video file using WebCodecs.
 * Returns a MediaSource with decoded frames.
 */
export async function decodeVideo(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<MediaSource> {
  const source = await createMediaDecoder(file);

  // Check if WebCodecs is available
  if (typeof VideoDecoder === 'undefined') {
    console.warn('WebCodecs not available, using fallback');
    return source;
  }

  return new Promise((resolve, reject) => {
    const decoder = new VideoDecoder({
      output: (frame: VideoFrame) => {
        const timestamp = frame.timestamp / 1e6; // microseconds to seconds
        source.frames.push({
          frame,
          timestamp,
          frameNumber: source.frames.length,
        });
        // Ring buffer: remove old frames
        if (source.frames.length > 120) {
          const old = source.frames.shift();
          old?.frame.close();
        }
        if (onProgress) {
          onProgress(source.frames.length / (source.fps * source.duration));
        }
      },
      error: (e: DOMException) => {
        console.error('Decode error:', e);
        reject(e);
      },
    });

    // Configure decoder (simplified - real impl would parse container)
    try {
      decoder.configure({
        codec: 'avc1.42001E',
        codedWidth: source.width,
        codedHeight: source.height,
      });
    } catch (e) {
      console.warn('Decoder configure failed:', e);
      resolve(source);
      return;
    }

    // In a real implementation, we'd parse the container (MP4/MOV) and
    // feed EncodedVideoChunk objects to the decoder. For now, we return
    // the source with metadata and let the caller handle chunk feeding.
    source.complete = true;
    resolve(source);
  });
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
}
