/**
 * FFmpeg stitching and finishing.
 *
 * Lambda renders shards; FFmpeg turns shards into a deliverable. That is the
 * whole back half of an enterprise render: concatenate the frame ranges, mux the
 * audio bed, normalise loudness to broadcast target, and pull poster frames for
 * the website and social cutdowns.
 *
 * The argument builders are pure functions returning `argv` arrays. That is
 * deliberate: argv is the real interface, it is trivially testable without
 * FFmpeg installed, and it can be handed to a local binary, a container or a
 * queue of jobs without changing a line.
 */

import { spawn } from 'node:child_process';

/** Loudness targets. -16 LUFS is the web/streaming norm; -23 is EBU R128. */
export interface LoudnessTarget {
  /** Integrated loudness, LUFS. */
  readonly integratedLufs: number;
  /** True peak ceiling, dBTP. */
  readonly truePeakDb: number;
  /** Loudness range, LU. */
  readonly rangeLu: number;
}

/** Streaming/web target: keeps dialogue and music level across platforms. */
export const DEFAULT_LOUDNESS: LoudnessTarget = {
  integratedLufs: -16,
  truePeakDb: -1.5,
  rangeLu: 11,
};

/** Broadcast target (EBU R128 / ATSC A/85 territory). */
export const BROADCAST_LOUDNESS: LoudnessTarget = {
  integratedLufs: -23,
  truePeakDb: -2,
  rangeLu: 7,
};

/** An ffmpeg `loudnorm` filter string for a target. */
export function loudnormFilter(target: LoudnessTarget = DEFAULT_LOUDNESS): string {
  return `loudnorm=I=${target.integratedLufs}:TP=${target.truePeakDb}:LRA=${target.rangeLu}`;
}

export interface ConcatArgsOptions {
  /** Text file listing the shard files, one per line, in order. */
  readonly listFile: string;
  readonly output: string;
  /** Re-encode instead of stream-copying (needed if shards differ). */
  readonly reencode?: boolean;
  readonly codec?: string;
  readonly crf?: number;
}

/**
 * Stitch shards with the concat demuxer. Stream copy is the default because our
 * shards come from the same encoder with identical settings, so the join is
 * lossless and near-instant; `reencode` is the escape hatch.
 */
export function ffmpegConcatArgs(options: ConcatArgsOptions): string[] {
  const args = ['-y', '-f', 'concat', '-safe', '0', '-i', options.listFile];
  if (options.reencode) {
    args.push('-c:v', options.codec ?? 'libx264', '-crf', String(options.crf ?? 16));
  } else {
    args.push('-c', 'copy');
  }
  args.push(options.output);
  return args;
}

export interface MuxArgsOptions {
  readonly video: string;
  readonly audio: string;
  readonly output: string;
  /** Normalise integrated loudness; pass `false` to pass audio through. */
  readonly loudnorm?: LoudnessTarget | false;
  /** Copy the video stream untouched (the usual case). */
  readonly copyVideo?: boolean;
  /** AAC bitrate, e.g. `'192k'`. */
  readonly audioBitrate?: string;
}

/** Mux a picture-locked video with its audio bed, optionally loudness-matched. */
export function ffmpegMuxArgs(options: MuxArgsOptions): string[] {
  const args = ['-y', '-i', options.video, '-i', options.audio];
  args.push(
    ...(options.copyVideo === false ? ['-c:v', 'libx264', '-crf', '16'] : ['-c:v', 'copy']),
  );
  args.push('-c:a', 'aac', '-b:a', options.audioBitrate ?? '192k');
  if (options.loudnorm !== false) {
    args.push('-af', loudnormFilter(options.loudnorm ?? DEFAULT_LOUDNESS));
  }
  // The film is the master: never let a longer audio bed extend the video.
  args.push('-shortest', '-movflags', '+faststart', options.output);
  return args;
}

export interface TranscodeArgsOptions {
  readonly input: string;
  readonly output: string;
  readonly codec?: 'h264' | 'h265' | 'vp9' | 'prores';
  readonly crf?: number;
  readonly preset?: string;
  readonly pixelFormat?: string;
  readonly faststart?: boolean;
}

const ENCODER_FOR_CODEC: Record<NonNullable<TranscodeArgsOptions['codec']>, string> = {
  h264: 'libx264',
  h265: 'libx265',
  vp9: 'libvpx-vp9',
  prores: 'prores_ks',
};

/** Transcode a master into a delivery codec/profile. */
export function ffmpegTranscodeArgs(options: TranscodeArgsOptions): string[] {
  const codec = options.codec ?? 'h264';
  const encoder = ENCODER_FOR_CODEC[codec];
  const args = ['-y', '-i', options.input, '-c:v', encoder];
  if (codec !== 'prores') {
    args.push('-crf', String(options.crf ?? 20), '-preset', options.preset ?? 'medium');
  }
  args.push('-pix_fmt', options.pixelFormat ?? 'yuv420p');
  if (options.faststart !== false && codec !== 'prores') args.push('-movflags', '+faststart');
  args.push(options.output);
  return args;
}

export interface ThumbnailArgsOptions {
  readonly input: string;
  readonly output: string;
  /** Seconds into the film. */
  readonly atSeconds: number;
  /** Output width in pixels; aspect is preserved. */
  readonly width?: number;
}

/** Pull a poster frame. Used for site hero images and social stills. */
export function ffmpegThumbnailArgs(options: ThumbnailArgsOptions): string[] {
  const args = ['-y', '-ss', String(options.atSeconds), '-i', options.input, '-frames:v', '1'];
  if (options.width !== undefined) args.push('-vf', `scale=${options.width}:-2`);
  args.push('-q:v', '2', options.output);
  return args;
}

/** ffprobe arguments for the machine-readable stream report. */
export function ffprobeArgs(input: string): string[] {
  return ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input];
}

/** What we need to know about a rendered file before we trust it. */
export interface MediaProbe {
  readonly durationSeconds: number;
  readonly sizeBytes: number;
  readonly formatName: string;
  readonly video:
    | {
        readonly codec: string;
        readonly width: number;
        readonly height: number;
        readonly frameRate: number;
        readonly frames: number | undefined;
      }
    | undefined;
  readonly audio:
    | { readonly codec: string; readonly channels: number; readonly sampleRate: number }
    | undefined;
}

/**
 * Normalise ffprobe's JSON into the handful of facts a pipeline checks: the film
 * is the right length, the right size, and actually has both a picture and a
 * sound track.
 */
export function parseProbe(raw: string): MediaProbe {
  const parsed = JSON.parse(raw) as {
    format?: { duration?: string; size?: string; format_name?: string };
    streams?: {
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
      nb_frames?: string;
      channels?: number;
      sample_rate?: string;
    }[];
  };
  const streams = parsed.streams ?? [];
  const videoStream = streams.find((stream) => stream.codec_type === 'video');
  const audioStream = streams.find((stream) => stream.codec_type === 'audio');

  const [num = '0', den = '1'] = (videoStream?.r_frame_rate ?? '0/1').split('/');
  const frameRate = Number(den) !== 0 ? Number(num) / Number(den) : 0;

  return {
    durationSeconds: Number(parsed.format?.duration ?? 0),
    sizeBytes: Number(parsed.format?.size ?? 0),
    formatName: parsed.format?.format_name ?? '',
    video: videoStream
      ? {
          codec: videoStream.codec_name ?? '',
          width: videoStream.width ?? 0,
          height: videoStream.height ?? 0,
          frameRate,
          frames: videoStream.nb_frames ? Number(videoStream.nb_frames) : undefined,
        }
      : undefined,
    audio: audioStream
      ? {
          codec: audioStream.codec_name ?? '',
          channels: audioStream.channels ?? 0,
          sampleRate: Number(audioStream.sample_rate ?? 0),
        }
      : undefined,
  };
}

export interface ProcessResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface BinaryOptions {
  /** Path to the binary. Defaults to `ffmpeg` / `ffprobe` on `PATH`. */
  readonly ffmpegPath?: string;
  readonly ffprobePath?: string;
}

/** Run a binary and capture its output. Rejects only when the process cannot start. */
export function runBinary(binary: string, args: readonly string[]): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, [...args], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => reject(error));
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

/** Run FFmpeg. Throws with FFmpeg's own stderr when it exits non-zero. */
export async function runFfmpeg(
  args: readonly string[],
  options: BinaryOptions = {},
): Promise<ProcessResult> {
  const result = await runBinary(options.ffmpegPath ?? 'ffmpeg', args);
  if (result.code !== 0) {
    throw new Error(`ffmpeg exited ${result.code}\n${result.stderr.trim()}`);
  }
  return result;
}

/** Probe a media file. Throws if ffprobe is missing or reports nothing. */
export async function probeMedia(input: string, options: BinaryOptions = {}): Promise<MediaProbe> {
  const result = await runBinary(options.ffprobePath ?? 'ffprobe', ffprobeArgs(input));
  if (result.code !== 0) {
    throw new Error(`ffprobe exited ${result.code}\n${result.stderr.trim()}`);
  }
  return parseProbe(result.stdout);
}
