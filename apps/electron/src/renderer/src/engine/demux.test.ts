// ── Demuxer tests ────────────────────────────────────────────────────────────
// The demuxer is the one piece of the media pipeline that can run without a
// GPU, a DOM, or WebCodecs, so it is the natural regression target.
//
// The fixture is a 1.6 KB H.264 baseline clip: 32×32, 5 fps, 1 second,
// 5 frames, 1 keyframe. See docs/19-QUALITY-AND-TESTS.md.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { demuxVideoFile } from './demux';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'tiny.mp4');

function loadFixture(): ArrayBuffer {
  const buf = readFileSync(FIXTURE);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe('demuxVideoFile', () => {
  it('reads the track description', () => {
    const video = demuxVideoFile(loadFixture(), 'tiny.mp4');
    expect(video.codec).toBe('avc1.42c01e');
    expect(video.width).toBe(32);
    expect(video.height).toBe(32);
    expect(video.duration).toBeCloseTo(1, 2);
    expect(video.fps).toBeCloseTo(5, 1);
    expect(video.samples).toHaveLength(5);
  });

  it('emits the decoder configuration record in big-endian order', () => {
    // The avcC payload WebCodecs needs. Byte order matters: a little-endian
    // stream byte-swaps the 16-bit NALU lengths and Chromium then rejects the
    // record with "Failed to parse avcC".
    const video = demuxVideoFile(loadFixture(), 'tiny.mp4');
    const description = video.description;
    expect(description).toBeDefined();
    expect(description?.[0]).toBe(1); // configurationVersion
    expect(description?.[1]).toBe(0x42); // AVCProfileIndication: baseline
    expect((description?.[4] ?? 0) & 0x03).toBe(3); // lengthSizeMinusOne: 4-byte NALU lengths
    // The SPS length is a 16-bit big-endian field, and the fixture's SPS is
    // 22 bytes long — a swapped pair would read 0x1600.
    expect(description?.[6]).toBe(0);
    expect(description?.[7]).toBe(22);
  });

  it('produces monotonic microsecond timestamps', () => {
    const video = demuxVideoFile(loadFixture(), 'tiny.mp4');
    for (let i = 0; i < video.samples.length; i++) {
      const sample = video.samples[i];
      if (!sample) continue;
      expect(sample.timestamp).toBe(i * 200_000); // 5 fps
      expect(sample.duration).toBe(200_000);
      expect(sample.data.length).toBeGreaterThan(0);
    }
  });

  it('marks the first sample as a keyframe', () => {
    const video = demuxVideoFile(loadFixture(), 'tiny.mp4');
    expect(video.samples[0]?.isKey).toBe(true);
    expect(video.samples.filter((s) => s.isKey)).toHaveLength(1);
  });

  it('rejects a buffer that is not a container', () => {
    const junk = new Uint8Array(64).fill(0x41);
    expect(() => demuxVideoFile(junk.buffer, 'junk.mp4')).toThrow();
  });
});
