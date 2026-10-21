// ── Colour ───────────────────────────────────────────────────────────────────
// The colour maths the renderer and the scopes share.
//
// Three spaces, and the conversions between them:
//
//   display   sRGB-encoded, 0..1. What a monitor shows and what a file holds.
//   linear    scene-referred light, unbounded. What light actually is.
//   Oklab     a perceptually uniform space, so a correction in one axis does
//             not shift the others.
//
// The pipeline is: **display -> linear -> grade in Oklab -> tone map -> display**.
//
// Why Oklab: a saturation or hue correction in gamma-encoded sRGB also moves
// the picture's lightness, and a hue rotation moves the colours' brightness
// unevenly. In Oklab those crosst talk terms are gone, so a grade is a grade.
// It is the basis of the CSS Color 4 specification and of most modern
// colour-managed imaging, and it is not what compositing tools grade in today.
//
// See docs/22-COMPOSITOR.md and docs/23-COLOR.md.

/** The WGSL colour functions, shared by the compositor's shader. */
export const COLOUR_WGSL = /* wgsl */ `
// ── sRGB <-> linear ────────────────────────────────────────────────────────
fn srgb_to_linear(c: vec3<f32>) -> vec3<f32> {
  let lo = c / 12.92;
  let hi = pow((max(c, vec3<f32>(0.0)) + vec3<f32>(0.055)) / 1.055, vec3<f32>(2.4));
  return select(lo, hi, c > vec3<f32>(0.04045));
}

fn linear_to_srgb(c: vec3<f32>) -> vec3<f32> {
  let clamped = max(c, vec3<f32>(0.0));
  let lo = clamped * 12.92;
  let hi = 1.055 * pow(clamped, vec3<f32>(1.0 / 2.4)) - vec3<f32>(0.055);
  return select(lo, hi, clamped > vec3<f32>(0.0031308));
}

// ── Oklab (Björn Ottosson) ─────────────────────────────────────────────────
// Linear sRGB -> LMS -> non-linear LMS -> Oklab.
fn linear_srgb_to_oklab(c: vec3<f32>) -> vec3<f32> {
  let l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  let m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  let s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  let l_ = pow(max(l, 0.0), 1.0 / 3.0);
  let m_ = pow(max(m, 0.0), 1.0 / 3.0);
  let s_ = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3<f32>(
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  );
}

fn oklab_to_linear_srgb(c: vec3<f32>) -> vec3<f32> {
  let l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  let m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  let s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  let l = l_ * l_ * l_;
  let m = m_ * m_ * m_;
  let s = s_ * s_ * s_;
  return vec3<f32>(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

// ── Tone mapping ───────────────────────────────────────────────────────────
// The ACES fit (Stephen Hill), which rolls off highlights the way a print
// does instead of clipping them to white.
fn aces_rrt(v: vec3<f32>) -> vec3<f32> {
  let a = v * (v + vec3<f32>(0.0245786)) - vec3<f32>(0.000090537);
  let b = v * (0.983729 * v + vec3<f32>(0.4329510)) + vec3<f32>(0.238081);
  return a / b;
}

fn aces_filmic(colour: vec3<f32>) -> vec3<f32> {
  let in_mat = mat3x3<f32>(
    0.59719, 0.07600, 0.02840,
    0.35458, 0.90834, 0.13383,
    0.04823, 0.01566, 0.83777
  );
  let out_mat = mat3x3<f32>(
     1.60475, -0.10208, -0.00327,
    -0.53108,  1.10813, -0.07276,
    -0.07367, -0.00605,  1.07602
  );
  return clamp(out_mat * aces_rrt(in_mat * colour), vec3<f32>(0.0), vec3<f32>(1.0));
}

// A simple Reinhard curve, for the soft option.
fn reinhard_extended(colour: vec3<f32>, max_white: f32) -> vec3<f32> {
  let luma = dot(colour, vec3<f32>(0.2126, 0.7152, 0.0722));
  let scale = 1.0 / (1.0 + luma);
  return colour * ((1.0 + colour / (max_white * max_white)) * scale);
}
`;

// ── The JavaScript mirror ────────────────────────────────────────────────────
// The scopes and the tests need the same numbers the shader uses, so the
// conversions are written once in each language and checked against each other.

/** sRGB-encoded (0..1) to linear light. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Linear light to sRGB-encoded (0..1). */
export function linearToSrgb(c: number): number {
  const v = Math.max(c, 0);
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}

/** Linear sRGB to Oklab. */
export function linearSrgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(Math.max(l, 0));
  const m_ = Math.cbrt(Math.max(m, 0));
  const s_ = Math.cbrt(Math.max(s, 0));
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

/** Oklab to linear sRGB. */
export function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** The ACES tone map, matching the shader. */
export function acesFilmic(r: number, g: number, b: number): [number, number, number] {
  const rrt = (v: number) => {
    const a = v * (v + 0.0245786) - 0.000090537;
    const d = v * (0.983729 * v + 0.432951) + 0.238081;
    return a / d;
  };
  const inR = 0.59719 * r + 0.35458 * g + 0.04823 * b;
  const inG = 0.076 * r + 0.90834 * g + 0.01566 * b;
  const inB = 0.0284 * r + 0.13383 * g + 0.83777 * b;
  const outR = 1.60475 * rrt(inR) - 0.53108 * rrt(inG) - 0.07367 * rrt(inB);
  const outG = -0.10208 * rrt(inR) + 1.10813 * rrt(inG) - 0.00605 * rrt(inB);
  const outB = -0.00327 * rrt(inR) - 0.07276 * rrt(inG) + 1.07602 * rrt(inB);
  const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
  return [clamp(outR), clamp(outG), clamp(outB)];
}

/** How a tone map is applied. */
export type ToneMap = 'aces' | 'reinhard' | 'none';

/** Apply a tone map to a linear colour. */
export function toneMap(colour: [number, number, number], kind: ToneMap): [number, number, number] {
  if (kind === 'aces') return acesFilmic(colour[0], colour[1], colour[2]);
  if (kind === 'reinhard') {
    const luma = 0.2126 * colour[0] + 0.7152 * colour[1] + 0.0722 * colour[2];
    const scale = 1 / (1 + luma);
    return colour.map((c) => c * ((1 + c) * scale)) as [number, number, number];
  }
  return colour;
}

/**
 * A grade, in the perceptually uniform space.
 *
 * Every term is a correction in one axis that does not disturb the others:
 * the exposure and contrast are in Oklab's lightness, the saturation and
 * hue are in its chroma axes.
 */
export interface OklabGrade {
  /** Stops of exposure, in linear light. */
  exposure: number;
  /** Contrast around a pivot, 1 = unchanged. */
  contrast: number;
  /** Saturation, 1 = unchanged. */
  saturation: number;
  /** Hue rotation in degrees. */
  hue: number;
}

export const NEUTRAL_GRADE: OklabGrade = {
  exposure: 0,
  contrast: 1,
  saturation: 1,
  hue: 0,
};

/** Apply a grade to a linear colour, returning linear. */
export function applyOklabGrade(
  colour: [number, number, number],
  grade: OklabGrade,
): [number, number, number] {
  const linear = colour.map((c) => c * 2 ** grade.exposure) as [number, number, number];
  const [L, a, b] = linearSrgbToOklab(linear[0], linear[1], linear[2]);
  // Contrast pivots around a middle grey, in perceptual lightness.
  const pivot = 0.5;
  const contrasted = (L - pivot) * grade.contrast + pivot;
  // Saturation scales the chroma; the hue rotates it. The rotation is applied
  // to the colour's own chroma vector, so it keeps its hue and its
  // colourfulness.
  const ca = a * grade.saturation;
  const cb = b * grade.saturation;
  const angle = (grade.hue * Math.PI) / 180;
  const ra = ca * Math.cos(angle) - cb * Math.sin(angle);
  const rb = ca * Math.sin(angle) + cb * Math.cos(angle);
  return oklabToLinearSrgb(contrasted, ra, rb);
}
