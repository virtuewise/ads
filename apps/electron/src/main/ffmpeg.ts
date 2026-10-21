// ── FFmpeg Resolution & Probing ──────────────────────────────────────────────
// Locates a usable ffmpeg binary (env override, bundled resource, then PATH) and
// inspects which hardware encoders are actually present.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface EncoderReport {
  ffmpegPath: string | null;
  version: string | null;
  h264: string[];
  hevc: string[];
  prores: string[];
  preferred: { h264: string | null; hevc: string | null; prores: string | null };
}

const H264_ORDER = ['h264_nvenc', 'h264_qsv', 'h264_amf', 'libx264'];
const HEVC_ORDER = ['hevc_nvenc', 'hevc_qsv', 'hevc_amf', 'libx265'];
const PRORES_ORDER = ['prores_ks', 'prores_aw', 'prores'];

export function runCapture(
  bin: string,
  args: string[],
  timeoutMs = 15000,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${path.basename(bin)} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout?.on('data', (d) => {
      stdout += String(d);
    });
    child.stderr?.on('data', (d) => {
      stderr += String(d);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/** Candidate ffmpeg locations, in priority order. */
export function ffmpegCandidates(roots: string[]): string[] {
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const list: string[] = [];
  if (process.env.FFMPEG_PATH) list.push(process.env.FFMPEG_PATH);
  for (const root of roots) {
    list.push(path.join(root, exe));
    list.push(path.join(root, 'bin', exe));
    list.push(path.join(root, 'resources', exe));
  }
  return list;
}

export async function resolveFfmpeg(roots: string[]): Promise<string | null> {
  for (const candidate of ffmpegCandidates(roots)) {
    if (existsSync(candidate)) return candidate;
  }
  // Fall back to PATH lookup.
  try {
    const probe = process.platform === 'win32' ? 'where' : 'which';
    const { code, stdout } = await runCapture(probe, ['ffmpeg'], 6000);
    if (code === 0) {
      const first = stdout.split(/\r?\n/).find((line) => line.trim().length > 0);
      if (first) return first.trim();
    }
  } catch {
    // ignore - report null below
  }
  return null;
}

export async function probeEncoders(roots: string[]): Promise<EncoderReport> {
  const ffmpegPath = await resolveFfmpeg(roots);
  if (!ffmpegPath) {
    return {
      ffmpegPath: null,
      version: null,
      h264: [],
      hevc: [],
      prores: [],
      preferred: { h264: null, hevc: null, prores: null },
    };
  }

  // The version probe can hang or time out on a broken binary. A failed
  // probe must not reject: the caller would report "ffmpeg not found",
  // which is the wrong diagnosis, and the export would abort.
  let version: string | null = null;
  try {
    const { stdout: versionOut } = await runCapture(
      ffmpegPath,
      ['-hide_banner', '-version'],
      10000,
    );
    version =
      versionOut
        .split(/\r?\n/)[0]
        ?.replace(/^ffmpeg version\s*/i, '')
        .trim() ?? null;
  } catch {
    version = null;
  }

  let encodersOut = '';
  try {
    const res = await runCapture(ffmpegPath, ['-hide_banner', '-encoders'], 15000);
    encodersOut = res.stdout;
  } catch {
    encodersOut = '';
  }

  const matchEncoder = (name: string) =>
    new RegExp(`^\\s*[A-Z.]{6}\\s+${name}\\s`, 'm').test(encodersOut);

  const h264 = H264_ORDER.filter(matchEncoder);
  const hevc = HEVC_ORDER.filter(matchEncoder);
  const prores = PRORES_ORDER.filter(matchEncoder);

  // Hardcode the guaranteed-fallback ordering when probing failed entirely.
  if (h264.length === 0) h264.push('libx264');
  if (prores.length === 0) prores.push('prores_ks');

  return {
    ffmpegPath,
    version,
    h264,
    hevc,
    prores,
    preferred: {
      h264: h264[0] ?? null,
      hevc: hevc[0] ?? null,
      prores: prores[0] ?? null,
    },
  };
}
