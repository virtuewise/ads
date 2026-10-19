// ── Project Codec (pure, no Electron imports) ────────────────────────────────
// Two on-disk encodings for one document:
//   .vfxproj      deterministic, pretty JSON - readable, diffable, git-versioned
//   .vfxproj.bin  gzip-compressed JSON with a magic header + sha256 trailer
// Open sniffs the magic bytes, so a wrong extension still loads correctly.

import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

export type ProjectFormat = 'json' | 'binary';

const MAGIC = Buffer.from('VFXP');
const BIN_VERSION = 1;
const DIGEST_LEN = 32;

/** Recursively sort object keys so serialized output is stable across runs. */
export function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = sortDeep(source[key]);
    return out;
  }
  return value;
}

export function serializeJson(doc: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(sortDeep(doc), null, 2)}\n`, 'utf8');
}

export function serializeBinary(doc: unknown): Buffer {
  const payload = gzipSync(Buffer.from(JSON.stringify(doc), 'utf8'), { level: 9 });
  const header = Buffer.alloc(MAGIC.length + 4);
  MAGIC.copy(header, 0);
  header.writeUInt32LE(BIN_VERSION, MAGIC.length);
  const digest = createHash('sha256').update(payload).digest();
  return Buffer.concat([header, payload, digest]);
}

export function serialize(doc: unknown, format: ProjectFormat): Buffer {
  return format === 'binary' ? serializeBinary(doc) : serializeJson(doc);
}

export function parseBinary(buf: Buffer): unknown {
  if (buf.length < MAGIC.length + 4 + DIGEST_LEN) {
    throw new Error('File is too small to be a project');
  }
  if (!buf.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Not a Virtue binary project');
  }
  const version = buf.readUInt32LE(MAGIC.length);
  if (version !== BIN_VERSION) throw new Error(`Unsupported binary project version ${version}`);
  const payload = buf.subarray(MAGIC.length + 4, buf.length - DIGEST_LEN);
  const digest = buf.subarray(buf.length - DIGEST_LEN);
  const actual = createHash('sha256').update(payload).digest();
  if (!actual.equals(digest)) throw new Error('Corrupt project: checksum mismatch');
  return JSON.parse(gunzipSync(payload).toString('utf8'));
}

export function detectFormat(buf: Buffer, filePath?: string): ProjectFormat {
  if (buf.length >= MAGIC.length && buf.subarray(0, MAGIC.length).equals(MAGIC)) return 'binary';
  return filePath?.toLowerCase().endsWith('.bin') ? 'binary' : 'json';
}

export function parseProject(
  buf: Buffer,
  filePath?: string,
): { format: ProjectFormat; doc: unknown } {
  const format = detectFormat(buf, filePath);
  if (format === 'binary') return { format, doc: parseBinary(buf) };
  const text = buf.toString('utf8').replace(/^\uFEFF/, '');
  return { format, doc: JSON.parse(text) };
}

/** Pick an encoding from an explicit request or the file extension. */
export function formatForPath(filePath: string, requested?: ProjectFormat): ProjectFormat {
  if (requested) return requested;
  return filePath.toLowerCase().endsWith('.bin') ? 'binary' : 'json';
}

/** Ensure the chosen path carries a recognizable extension. */
export function withExtension(filePath: string, format: ProjectFormat): string {
  const lower = filePath.toLowerCase();
  if (format === 'binary') return lower.endsWith('.bin') ? filePath : `${filePath}.bin`;
  if (lower.endsWith('.vfxproj') || lower.endsWith('.bin')) return filePath;
  return `${filePath}.vfxproj`;
}
