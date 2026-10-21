// ── Export Orchestration (renderer) ─────────────────────────────────────────
// Renders each composition frame with WebGPU, streams the raw RGBA to the main
// process, and has ffmpeg encode it. Two first-class targets, per the spec:
//   fast-1080p  -> H.264, hardware encoder when present, quick to produce
//   prores-4k   -> 4K60 ProRes 422 HQ mezzanine, heavy but edit-grade

import { createFrameRenderer } from './renderFrame';
import type { BrandLUT, TransformState } from './types';

export type ExportPresetId = 'fast-1080p' | 'prores-4k';

export interface ExportTarget {
  id: ExportPresetId;
  name: string;
  container: string;
  width: number;
  height: number;
  fps: number;
  /** Approximate bits per second, used only for size estimates. */
  bitrate: number;
  note: string;
  heavy: boolean;
}

export const EXPORT_TARGETS: ExportTarget[] = [
  {
    id: 'fast-1080p',
    name: '1080p H.264',
    container: 'mp4',
    width: 1920,
    height: 1080,
    fps: 30,
    bitrate: 12_000_000,
    note: 'Fast, review-ready. Hardware encoder when available.',
    heavy: false,
  },
  {
    id: 'prores-4k',
    name: '4K60 ProRes 422 HQ',
    container: 'mov',
    width: 3840,
    height: 2160,
    fps: 60,
    bitrate: 220_000_000,
    note: 'Heavy mezzanine master for further grading and finishing.',
    heavy: true,
  },
];

export interface ExportProgressEvent {
  stage: 'starting' | 'encoding' | 'finalizing' | 'done' | 'error' | 'canceled';
  framesWritten: number;
  totalFrames: number;
  percent: number;
  message?: string;
  outputPath?: string;
  fps?: number;
}

interface StudioExportApi {
  probeEncoders: () => Promise<{
    ffmpegPath: string | null;
    version: string | null;
    h264: string[];
    prores: string[];
    preferred: { h264: string | null; prores: string | null };
  }>;
  chooseExportPath: (opts: {
    preset: string;
    suggestedName?: string;
  }) => Promise<{ canceled: boolean; path?: string }>;
  startExport: (req: unknown) => Promise<{ started: boolean; encoder: string }>;
  writeExportFrame: (bytes: Uint8Array) => Promise<{ queued: number }>;
  finishExport: () => Promise<{ finished: boolean; ok?: boolean; framesWritten?: number }>;
  cancelExport: () => Promise<{ canceled: boolean }>;
  onExportProgress: (cb: (p: ExportProgressEvent) => void) => () => void;
}

function exportApi(): StudioExportApi | undefined {
  return (window as unknown as { studio?: StudioExportApi }).studio;
}

export function estimateBytes(target: ExportTarget, seconds: number): number {
  return (target.bitrate / 8) * seconds;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} kB`;
}

export interface RunExportOptions {
  target: ExportTarget;
  outputPath: string;
  /** Composition duration in seconds. */
  duration: number;
  lut?: BrandLUT | null;
  transform?: TransformState;
  encoder?: string;
  onProgress?: (p: ExportProgressEvent) => void;
  shouldCancel?: () => boolean;
}

export interface RunExportResult {
  ok: boolean;
  stage: ExportProgressEvent['stage'];
  outputPath?: string;
  message?: string;
  framesWritten: number;
}

/**
 * Run a full export. Resolves when ffmpeg finishes (or the job fails/cancels).
 */
export async function runExport(options: RunExportOptions): Promise<RunExportResult> {
  const api = exportApi();
  if (!api) throw new Error('Export is only available in the desktop app');

  const { target, outputPath, duration, lut, transform } = options;
  const totalFrames = Math.max(1, Math.round(target.fps * duration));

  // Subscribe to the encoder's own progress. Without this, a failure inside
  // ffmpeg is invisible: the renderer would report success for a file that
  // was never written.
  let encoderStage: ExportProgressEvent['stage'] | null = null;
  let encoderMessage: string | undefined;
  const unsubscribe = api.onExportProgress?.((p) => {
    encoderStage = p.stage;
    encoderMessage = p.message;
    options.onProgress?.(p);
  });

  const renderer = await createFrameRenderer({
    width: target.width,
    height: target.height,
    lut: lut ?? null,
  });
  if (!renderer) {
    unsubscribe?.();
    throw new Error('WebGPU is unavailable, cannot render frames');
  }

  const report: ExportProgressEvent = {
    stage: 'starting',
    framesWritten: 0,
    totalFrames,
    percent: 0,
    message: 'Preparing encoder…',
  };
  options.onProgress?.(report);

  let framesWritten = 0;
  try {
    const { encoder } = await api.startExport({
      outputPath,
      width: target.width,
      height: target.height,
      fps: target.fps,
      totalFrames,
      preset: target.id,
      encoder: options.encoder,
    });

    for (let i = 0; i < totalFrames; i += 1) {
      if (options.shouldCancel?.()) {
        await api.cancelExport();
        return { ok: false, stage: 'canceled', framesWritten, message: 'Canceled' };
      }
      const time = i / target.fps;
      const bytes = await renderer.render(time, transform);
      await api.writeExportFrame(bytes);
      framesWritten += 1;
      options.onProgress?.({
        stage: 'encoding',
        framesWritten,
        totalFrames,
        percent: (framesWritten / totalFrames) * 100,
        message: `Encoding with ${encoder}`,
      });
    }
    options.onProgress?.({
      stage: 'finalizing',
      framesWritten,
      totalFrames,
      percent: 99,
      message: 'Finalizing file…',
    });
    const fin = await api.finishExport();
    if (!fin.ok) {
      return {
        ok: false,
        stage: encoderStage === 'canceled' ? 'canceled' : 'error',
        outputPath,
        message: encoderMessage ?? 'The encoder failed before the file was written.',
        framesWritten,
      };
    }
    return { ok: true, stage: 'done', outputPath, framesWritten };
  } finally {
    renderer.dispose();
    unsubscribe?.();
  }
}
