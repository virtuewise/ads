// ── Export Pipeline (main process) ───────────────────────────────────────────
// The renderer renders composition frames (WebGPU -> RGBA) and streams them
// here; this module pipes them into ffmpeg as rawvideo and writes the encoded
// result to disk. Two first-class targets:
//   * Fast 1080p H.264  - hardware encoder when available, else libx264
//   * Heavy 4K60 ProRes - prores_ks / yuv422p10le, mezzanine quality

import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { WebContents } from 'electron';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { type EncoderReport, probeEncoders, resolveFfmpeg } from './ffmpeg';

export interface ExportJobRequest {
  outputPath: string;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  preset: 'fast-1080p' | 'prores-4k';
  /** Force a specific encoder, e.g. 'libx264'. */
  encoder?: string;
  bitrateKbps?: number;
}

export interface ExportProgress {
  stage: 'starting' | 'encoding' | 'finalizing' | 'done' | 'error' | 'canceled';
  framesWritten: number;
  totalFrames: number;
  percent: number;
  message?: string;
  outputPath?: string;
  bytes?: number;
  fps?: number;
}

interface ActiveJob {
  id: string;
  sender: WebContents;
  child: ChildProcessWithoutNullStreams;
  queue: Buffer[];
  writing: boolean;
  framesWritten: number;
  totalFrames: number;
  startedAt: number;
  canceled: boolean;
  closed: boolean;
  /** Resolves when the encoder process has exited. */
  exited: Promise<number | null>;
  /** Set when the encoder failed or was killed, so the partial file is removed. */
  failed: boolean;
  /** Where the encoder is writing, so a failed job can clean up after itself. */
  outputPath: string;
}

let active: ActiveJob | null = null;
let jobSeq = 0;

function emit(job: ActiveJob, progress: ExportProgress): void {
  if (!job.sender.isDestroyed()) {
    job.sender.send('export:progress', progress);
  }
}

function buildArgs(req: ExportJobRequest, encoder: string): string[] {
  const { width, height, fps, preset, bitrateKbps } = req;
  const input = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-s',
    `${width}x${height}`,
    '-r',
    String(fps),
    '-i',
    'pipe:0',
    '-an',
  ];

  if (preset === 'prores-4k') {
    return [
      ...input,
      '-c:v',
      encoder,
      '-profile:v',
      '3', // ProRes 422 HQ
      '-vendor',
      'apl0',
      '-pix_fmt',
      'yuv422p10le',
      '-y',
      req.outputPath,
    ];
  }

  const rateArgs =
    encoder === 'libx264'
      ? ['-preset', 'veryfast', '-crf', '18']
      : ['-rc', 'vbr', '-cq', '21', '-b:v', `${bitrateKbps ?? 12000}k`, '-preset', 'p4'];

  return [
    ...input,
    '-c:v',
    encoder,
    ...rateArgs,
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-y',
    req.outputPath,
  ];
}

async function pickEncoder(req: ExportJobRequest): Promise<string> {
  if (req.encoder) return req.encoder;
  const report: EncoderReport = await probeEncoders(ffmpegRoots());
  if (req.preset === 'prores-4k') return report.preferred.prores ?? 'prores_ks';
  return report.preferred.h264 ?? 'libx264';
}

/** Places a bundled ffmpeg may live, then PATH as a last resort. */
function ffmpegRoots(): string[] {
  const roots = [process.cwd()];
  try {
    if (process.resourcesPath) roots.unshift(process.resourcesPath);
    roots.push(app.getAppPath());
  } catch {
    // app is unavailable during some test contexts
  }
  return roots;
}

/** Drain queued frame buffers into the encoder's stdin with backpressure. */
function pump(job: ActiveJob): void {
  if (job.writing || job.closed) return;
  const chunk = job.queue.shift();
  if (!chunk) return;
  job.writing = true;
  let settled = false;
  const done = () => {
    if (settled) return;
    settled = true;
    job.writing = false;
    job.framesWritten += 1;
    const percent = job.totalFrames > 0 ? (job.framesWritten / job.totalFrames) * 100 : 0;
    const elapsed = (Date.now() - job.startedAt) / 1000;
    emit(job, {
      stage: 'encoding',
      framesWritten: job.framesWritten,
      totalFrames: job.totalFrames,
      percent,
      fps: elapsed > 0 ? job.framesWritten / elapsed : 0,
    });
    pump(job);
  };
  try {
    job.child.stdin.write(chunk, done);
  } catch {
    // The pipe is already gone (ffmpeg died). Do not throw: an unhandled
    // error on stdin would take the whole app down.
    done();
    return;
  }
  if (!job.child.stdin.writable) {
    // Nothing will call the write callback on a closed pipe.
    done();
  }
}

export function registerExportIpc(): void {
  ipcMain.handle('export:probe', async (): Promise<EncoderReport> => probeEncoders(ffmpegRoots()));

  ipcMain.handle(
    'export:choosePath',
    async (
      event,
      opts: { preset: 'fast-1080p' | 'prores-4k'; suggestedName?: string },
    ): Promise<{ canceled: boolean; path?: string }> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const isProres = opts.preset === 'prores-4k';
      const base =
        (opts.suggestedName ?? 'export').replace(/[^a-zA-Z0-9-_ ]+/g, '').trim() || 'export';
      const options: Electron.SaveDialogOptions = {
        title: 'Export Video',
        defaultPath: `${base}.${isProres ? 'mov' : 'mp4'}`,
        filters: isProres
          ? [{ name: 'QuickTime (ProRes)', extensions: ['mov'] }]
          : [{ name: 'MPEG-4 (H.264)', extensions: ['mp4'] }],
      };
      const result = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) return { canceled: true };
      return { canceled: false, path: result.filePath };
    },
  );

  ipcMain.handle('export:start', async (event, req: ExportJobRequest) => {
    if (active) throw new Error('An export is already running');
    const ffmpeg = await resolveFfmpeg(ffmpegRoots());
    if (!ffmpeg) throw new Error('ffmpeg was not found. Set FFMPEG_PATH or add ffmpeg to PATH.');
    const encoder = await pickEncoder(req);

    const child = spawn(ffmpeg, buildArgs(req, encoder), {
      windowsHide: true,
    }) as ChildProcessWithoutNullStreams;

    let resolveExit: (code: number | null) => void = () => {};
    const exited = new Promise<number | null>((resolve) => {
      resolveExit = resolve;
    });

    const job: ActiveJob = {
      id: `job-${++jobSeq}`,
      sender: event.sender,
      child,
      queue: [],
      writing: false,
      framesWritten: 0,
      totalFrames: req.totalFrames,
      startedAt: Date.now(),
      canceled: false,
      closed: false,
      exited,
      failed: false,
      outputPath: req.outputPath,
    };
    active = job;

    let stderrTail = '';
    child.stderr.on('data', (d) => {
      stderrTail = (stderrTail + String(d)).slice(-4000);
    });

    // A broken pipe must not take the app down: ffmpeg can exit before the
    // renderer has finished pushing frames, and every write after that would
    // raise an unhandled 'error' event on stdin.
    child.stdin.on('error', (err: Error) => {
      job.failed = true;
      job.closed = true;
      if (active === job) active = null;
      resolveExit(null);
      emit(job, {
        stage: 'error',
        framesWritten: job.framesWritten,
        totalFrames: job.totalFrames,
        percent: 0,
        message: `The encoder stopped: ${err.message}\n${stderrTail}`,
      });
      void removePartial(job.outputPath);
    });

    child.on('error', (err) => {
      job.failed = true;
      job.closed = true;
      if (active === job) active = null;
      resolveExit(null);
      emit(job, {
        stage: 'error',
        framesWritten: job.framesWritten,
        totalFrames: job.totalFrames,
        percent: 0,
        message: `Failed to launch ffmpeg: ${err.message}`,
      });
    });

    child.on('close', (code) => {
      job.closed = true;
      if (active === job) active = null;
      resolveExit(code);
      if (job.canceled) {
        emit(job, {
          stage: 'canceled',
          framesWritten: job.framesWritten,
          totalFrames: job.totalFrames,
          percent: 0,
          message: 'Export canceled',
        });
        void removePartial(job.outputPath);
        return;
      }
      if (code === 0) {
        emit(job, {
          stage: 'done',
          framesWritten: job.framesWritten,
          totalFrames: job.totalFrames,
          percent: 100,
          outputPath: req.outputPath,
          message: `Wrote ${path.basename(req.outputPath)} with ${encoder}`,
        });
        return;
      }
      job.failed = true;
      emit(job, {
        stage: 'error',
        framesWritten: job.framesWritten,
        totalFrames: job.totalFrames,
        percent: 0,
        message: `ffmpeg exited with code ${code}\n${stderrTail}`,
      });
      void removePartial(req.outputPath);
    });

    emit(job, {
      stage: 'starting',
      framesWritten: 0,
      totalFrames: req.totalFrames,
      percent: 0,
      message: `Encoding with ${encoder}`,
    });

    return { started: true, encoder, jobId: job.id };
  });

  ipcMain.handle('export:frame', async (_event, bytes: Uint8Array) => {
    const job = active;
    if (!job || job.closed) throw new Error('No active export');
    job.queue.push(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    pump(job);
    // Await a moment of backpressure relief so the renderer cannot outrun ffmpeg.
    if (job.queue.length > 8) {
      await new Promise<void>((resolve) => {
        const check = () => {
          if (!active || job.queue.length <= 4) resolve();
          else setTimeout(check, 4);
        };
        check();
      });
    }
    return { queued: job.queue.length };
  });

  ipcMain.handle('export:finish', async () => {
    const job = active;
    if (!job) return { finished: false, ok: false };
    emit(job, {
      stage: 'finalizing',
      framesWritten: job.framesWritten,
      totalFrames: job.totalFrames,
      percent: 99,
      message: 'Finalizing file…',
    });
    // Drain the queue before closing the pipe. Frames still queued when the
    // pipe closes are never written, which silently truncates the output.
    await new Promise<void>((resolve) => {
      const check = () => {
        if (job.closed || (job.queue.length === 0 && !job.writing)) resolve();
        else setTimeout(check, 4);
      };
      check();
    });
    if (!job.closed) {
      job.child.stdin.end();
    }
    // Wait for the encoder to exit, so the caller learns whether the file was
    // actually written rather than assuming success.
    const code = await job.exited;
    return {
      finished: true,
      ok: code === 0 && !job.failed,
      framesWritten: job.framesWritten,
    };
  });

  ipcMain.handle('export:cancel', async () => {
    const job = active;
    if (!job) return { canceled: false };
    job.canceled = true;
    job.child.kill('SIGKILL');
    // The 'close' handler removes the half-written file.
    await job.exited;
    return { canceled: true };
  });
}

/** Remove a partially written output file, ignoring any failure. */
async function removePartial(outputPath: string): Promise<void> {
  try {
    await fs.unlink(outputPath);
  } catch {
    // Nothing to remove, or it is already gone.
  }
}
