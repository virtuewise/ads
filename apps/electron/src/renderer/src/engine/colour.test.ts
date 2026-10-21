// ── Colour and shot matching ────────────────────────────────────────────────
// The colour maths is duplicated in WGSL and in TypeScript, because the shader
// grades and the editor measures. These tests pin the two together: if they
// drift, a shot would be measured one way and graded another.

import { describe, expect, it } from 'vitest';
import { analyseFrame, gradeToMatch, isMeasurable } from './balance';
import {
  acesFilmic,
  applyOklabGrade,
  linearSrgbToOklab,
  linearToSrgb,
  NEUTRAL_GRADE,
  oklabToLinearSrgb,
  srgbToLinear,
  toneMap,
} from './colour';

describe('colour conversions', () => {
  it('round-trips sRGB through linear', () => {
    for (const v of [0, 0.04, 0.25, 0.5, 0.75, 1]) {
      expect(linearToSrgb(srgbToLinear(v))).toBeCloseTo(v, 5);
    }
  });

  it('round-trips Oklab through linear sRGB', () => {
    const rgb: [number, number, number] = [0.2, 0.5, 0.8];
    const back = oklabToLinearSrgb(...linearSrgbToOklab(...rgb));
    expect(back[0]).toBeCloseTo(rgb[0], 4);
    expect(back[1]).toBeCloseTo(rgb[1], 4);
    expect(back[2]).toBeCloseTo(rgb[2], 4);
  });

  it('keeps white white and black black in Oklab', () => {
    const white = linearSrgbToOklab(1, 1, 1);
    expect(white[0]).toBeCloseTo(1, 3);
    const black = linearSrgbToOklab(0, 0, 0);
    expect(black[0]).toBeCloseTo(0, 4);
  });

  it('rolls highlights off rather than clipping them', () => {
    // The ACES curve must compress a very bright colour, not cut it to white.
    const bright = acesFilmic(4, 4, 4);
    expect(bright[0]).toBeLessThan(1);
    expect(bright[0]).toBeGreaterThan(0.9);
  });

  it('leaves a neutral tone map alone', () => {
    const colour: [number, number, number] = [0.3, 0.4, 0.5];
    expect(toneMap(colour, 'none')).toEqual(colour);
  });
});

describe('grading in Oklab', () => {
  it('changes nothing with a neutral grade', () => {
    const colour: [number, number, number] = [0.3, 0.5, 0.7];
    const graded = applyOklabGrade(colour, NEUTRAL_GRADE);
    expect(graded[0]).toBeCloseTo(colour[0], 4);
    expect(graded[1]).toBeCloseTo(colour[1], 4);
    expect(graded[2]).toBeCloseTo(colour[2], 4);
  });

  it('does not change lightness when the saturation changes', () => {
    // The point of grading in a perceptually uniform space: a saturation
    // change must not also move the picture's brightness.
    const colour: [number, number, number] = [0.4, 0.5, 0.6];
    const before = linearSrgbToOklab(...colour);
    const after = linearSrgbToOklab(
      ...applyOklabGrade(colour, { ...NEUTRAL_GRADE, saturation: 0.4 }),
    );
    expect(after[0]).toBeCloseTo(before[0], 3);
  });

  it('does not change the colourfulness when the hue rotates', () => {
    const colour: [number, number, number] = [0.4, 0.5, 0.6];
    const before = linearSrgbToOklab(...colour);
    const after = linearSrgbToOklab(...applyOklabGrade(colour, { ...NEUTRAL_GRADE, hue: 40 }));
    expect(Math.hypot(after[1], after[2])).toBeCloseTo(Math.hypot(before[1], before[2]), 3);
  });

  it('moves the lightness with the exposure', () => {
    const colour: [number, number, number] = [0.4, 0.5, 0.6];
    const before = linearSrgbToOklab(...colour);
    const after = linearSrgbToOklab(...applyOklabGrade(colour, { ...NEUTRAL_GRADE, exposure: 1 }));
    expect(after[0]).toBeGreaterThan(before[0]);
  });

  it('matches the numbers the shader produced on the GPU', () => {
    // The shader is the oracle: these are the pixels the real WGSL grade
    // wrote into a 1x1 target, measured in the running app. The TypeScript
    // mirror must agree, or the editor would measure one curve and the
    // renderer would grade another.
    const srgb = (v: number) =>
      linearToSrgb(
        applyOklabGrade([srgbToLinear(v), srgbToLinear(v), srgbToLinear(v)], {
          exposure: 0,
          contrast: 1,
          saturation: 1,
          hue: 0,
        })[0],
      );
    expect(Math.round(srgb(0.5) * 255)).toBe(128);

    const exposed = linearToSrgb(
      applyOklabGrade([srgbToLinear(0.5), srgbToLinear(0.5), srgbToLinear(0.5)], {
        exposure: 1,
        contrast: 1,
        saturation: 1,
        hue: 0,
      })[0],
    );
    expect(Math.round(exposed * 255)).toBe(175);

    const contrasted = linearToSrgb(
      applyOklabGrade([srgbToLinear(0.5), srgbToLinear(0.5), srgbToLinear(0.5)], {
        exposure: 0,
        contrast: 1.5,
        saturation: 1,
        hue: 0,
      })[0],
    );
    expect(Math.round(contrasted * 255)).toBe(142);
  });
});

describe('shot matching', () => {
  /**
   * A flat frame of a given sRGB value.
   *
   * `ImageData` is a browser type, and this suite runs in Node, so the frame
   * is the plain object the analyser actually reads.
   */
  function frame(value: number, width = 32, height = 32): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i += 1) {
      data[i * 4] = value;
      data[i * 4 + 1] = value;
      data[i * 4 + 2] = value;
      data[i * 4 + 3] = 255;
    }
    return { data, width, height, colorSpace: 'srgb' } as unknown as ImageData;
  }

  it('measures a flat frame', () => {
    const stats = analyseFrame(frame(128));
    expect(stats.midtone).toBeGreaterThan(0);
    expect(stats.coverage).toBeCloseTo(1, 2);
  });

  it('refuses a black frame', () => {
    // Grading against a frame with no light in it would push the film up by
    // several stops.
    expect(isMeasurable(analyseFrame(frame(0)))).toBe(false);
  });

  it('darkens a bright shot to match a dim one', () => {
    const dim = analyseFrame(frame(80));
    const bright = analyseFrame(frame(160));
    const grade = gradeToMatch(bright, dim);
    expect(grade.exposure).toBeLessThan(0);
    // The correction is in stops of *linear* light, so it is not the ratio of
    // the sRGB values: 160 and 80 are about two stops apart, not one.
    const expected = Math.log2(srgbToLinear(80 / 255) / srgbToLinear(160 / 255));
    expect(grade.exposure).toBeCloseTo(expected, 3);
  });

  it('leaves a matched shot alone', () => {
    const stats = analyseFrame(frame(120));
    const grade = gradeToMatch(stats, stats);
    expect(grade.exposure).toBeCloseTo(0, 5);
    expect(grade.contrast).toBeCloseTo(1, 5);
  });

  it('never asks for an absurd correction', () => {
    const grade = gradeToMatch(
      { midtone: 0.0001, spread: 0.01, meanChroma: 0, coverage: 1 },
      { midtone: 1, spread: 8, meanChroma: 0.5, coverage: 1 },
    );
    expect(grade.exposure).toBeLessThanOrEqual(3);
    expect(grade.exposure).toBeGreaterThanOrEqual(-3);
    expect(grade.contrast).toBeLessThanOrEqual(2);
  });
});
