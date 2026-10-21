// ── Shot matching ───────────────────────────────────────────────────────────
// Making a film look like one film.
//
// Every shot is lit slightly differently: a window here, a lamp there, a
// camera with a different stop. Colourists fix that by grading each shot
// against a reference — a hero shot, or the one before it. It is the most
// valuable half of a grade and the most tedious, because it means measuring
// one shot and applying the difference to the next.
//
// This does the measurement and the arithmetic: read the frame, compare its
// light to a reference, and return the grade that closes the gap.
//
// The measurement is the colourist's, not the engineer's:
//   midtone    the median luminance, in linear light. Robust where a mean is
//              not: a frame with one small bright highlight and a lot of dark
//              has a useless mean and a perfectly good midtone.
//   spread     the distance between the 10th and 90th percentiles of log
//              luminance. This is contrast, measured the way a waveform
//              monitor shows it.
//   chroma     the mean colourfulness, in Oklab's a/b axes.
//
// The grade is in the perceptually uniform space, so it matches what an eye
// sees rather than what a sensor counts.
//
// See docs/23-COLOR.md.

import { linearSrgbToOklab, srgbToLinear } from './colour';

/** What a frame's light looks like. */
export interface FrameStats {
  /** Median linear luminance: the midtone. */
  midtone: number;
  /** The 10th-to-90th percentile spread of log luminance: the contrast. */
  spread: number;
  /** Mean chroma, in Oklab's a/b axes: the colourfulness. */
  meanChroma: number;
  /** How much of the frame is not black. */
  coverage: number;
}

/** The grade that makes a shot match a reference. */
export interface MatchGrade {
  /** Stops of exposure. */
  exposure: number;
  /** Contrast around middle grey. */
  contrast: number;
  /** Saturation, 1 = unchanged. */
  saturation: number;
}

/** The frame's luminance at a given percentile, in linear light. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((p / 100) * (sorted.length - 1))),
  );
  return sorted[index] as number;
}

/** Measure a frame's light. */
export function analyseFrame(frame: ImageData): FrameStats {
  const { data, width, height } = frame;
  const pixels = width * height;
  if (pixels === 0) {
    return { midtone: 0, spread: 0, meanChroma: 0, coverage: 0 };
  }

  // A frame is measured on a grid: every pixel of a 4K frame is more work
  // than the answer is worth.
  const step = Math.max(1, Math.floor(Math.sqrt(pixels / 20000)));

  const lumas: number[] = [];
  let chroma = 0;
  let lit = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      const r = srgbToLinear(data[i] / 255);
      const g = srgbToLinear(data[i + 1] / 255);
      const b = srgbToLinear(data[i + 2] / 255);
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lumas.push(luma);
      if (luma > 0.0005) lit += 1;
      const [, a, bb] = linearSrgbToOklab(r, g, b);
      chroma += Math.hypot(a, bb);
    }
  }

  if (lumas.length === 0) {
    return { midtone: 0, spread: 0, meanChroma: 0, coverage: 0 };
  }

  lumas.sort((a, b) => a - b);
  const logs = lumas.map((l) => (l > 1e-6 ? Math.log2(l) : -20));

  const midtone = percentile(lumas, 50);
  const spread = percentile(logs, 90) - percentile(logs, 10);

  return {
    midtone,
    spread,
    meanChroma: chroma / lumas.length,
    coverage: lit / lumas.length,
  };
}

/**
 * Whether a frame carries enough light to be measured against.
 *
 * A frame with no light in it has no midtone to compare, and grading a shot
 * against it would push the whole film up by several stops. Such a frame is
 * usually a readback taken before the new picture was on screen.
 */
export function isMeasurable(stats: FrameStats): boolean {
  return stats.midtone > 0.0005 && stats.coverage > 0.25 && stats.spread > 0.05;
}

/** The grade that brings a shot to a reference's light. */
export function gradeToMatch(shot: FrameStats, reference: FrameStats): MatchGrade {
  // Exposure: the ratio of the two midtones, in stops. This is the colourist's
  // rule, and it is why the midtone is measured rather than the mean.
  const exposure =
    shot.midtone > 1e-6 && reference.midtone > 1e-6
      ? clamp(Math.log2(reference.midtone / shot.midtone), -3, 3)
      : 0;

  // Contrast: the ratio of the two spreads.
  const contrast =
    shot.spread > 1e-3 && reference.spread > 1e-3
      ? clamp(reference.spread / shot.spread, 0.5, 2)
      : 1;

  // Saturation: match the colourfulness, but only when both shots have some.
  const saturation =
    shot.meanChroma > 1e-4 && reference.meanChroma > 1e-4
      ? clamp(reference.meanChroma / shot.meanChroma, 0.5, 2)
      : 1;

  return { exposure, contrast, saturation };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
