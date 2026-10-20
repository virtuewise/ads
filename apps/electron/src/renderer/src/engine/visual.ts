// ── Shared Visual Core ───────────────────────────────────────────────────────
// The WGSL used by both the interactive viewport and the offline frame
// renderer, plus the uniform packing they share. Keeping this in one place is
// what guarantees "what you see is what you export".

import type { BrandLUT, TransformState } from './types';

export const UNIFORM_FLOATS = 20;
export const UNIFORM_BYTES = UNIFORM_FLOATS * 4;

export const VERTEX_SHADER = /* wgsl */ `
  @vertex
  fn vs(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4<f32> {
    var pos = array<vec2<f32>, 6>(
      vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
      vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0)
    );
    return vec4(pos[vi], 0.0, 1.0);
  }
`;

export const COMPOSITE_SHADER = /* wgsl */ `
  struct Uniforms {
    time: f32,
    scale: f32,
    rotation: f32,
    opacity: f32,
    resolution: vec2<f32>,
    translation: vec2<f32>,
    lutShadow: vec4<f32>,
    lutMid: vec4<f32>,
    lutHighlight: vec4<f32>,
  };
  @group(0) @binding(0) var<uniform> u: Uniforms;

${VERTEX_SHADER}

  @fragment
  fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    var uv = fragCoord.xy / u.resolution;
    var c = uv - vec2(0.5, 0.5);
    let ca = cos(u.rotation);
    let sa = sin(u.rotation);
    c = vec2(c.x * ca - c.y * sa, c.x * sa + c.y * ca);
    c = c / max(u.scale, 0.0001);
    c = c - u.translation;
    uv = c + vec2(0.5, 0.5);

    let t = u.time;
    var col = mix(
      vec3(0.04, 0.05, 0.08),
      vec3(0.12, 0.08, 0.18),
      uv.y + 0.3 * sin(t * 0.5 + uv.x * 3.0)
    );

    let grid = (sin(uv.x * 40.0 + t) * 0.5 + 0.5) * (sin(uv.y * 40.0 - t * 0.7) * 0.5 + 0.5);
    col += vec3(0.02, 0.03, 0.05) * grid;

    let d = distance(uv, vec2(0.5 + 0.1 * sin(t * 0.3), 0.5 + 0.1 * cos(t * 0.4)));
    col += vec3(1.0, 0.35, 0.17) * (0.08 / (d + 0.3));

    let v = 1.0 - smoothstep(0.4, 1.2, length(uv - vec2(0.5, 0.5)) * 1.6);
    col *= v;

    let lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    var lutCol = mix(u.lutShadow.rgb, u.lutMid.rgb, smoothstep(0.0, 0.5, lum));
    lutCol = mix(lutCol, u.lutHighlight.rgb, smoothstep(0.5, 1.0, lum));
    col = mix(col, lutCol, u.lutShadow.a);

    let a = clamp(u.opacity, 0.0, 1.0);
    return vec4(col * a, a);
  }
`;

export function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const full =
    m.length === 3
      ? m
          .split('')
          .map((c) => c + c)
          .join('')
      : m;
  const int = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(int)) return [0, 0, 0];
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
}

export interface UniformInput {
  time: number;
  width: number;
  height: number;
  transform?: TransformState;
  lut?: BrandLUT | null;
}

/** Fill `out` (length >= UNIFORM_FLOATS) with the uniform block for `input`. */
export function packUniforms(out: Float32Array, input: UniformInput): void {
  const { time, width, height, transform: tr, lut } = input;
  const active = lut && lut.id !== 'none' ? lut : null;
  const shadow = active ? hexToRgb(active.colors.shadow) : [0, 0, 0];
  const mid = active ? hexToRgb(active.colors.midtone) : [0.5, 0.5, 0.5];
  const high = active ? hexToRgb(active.colors.highlight) : [1, 1, 1];
  const intensity = lut ? lut.intensity : 0;

  out[0] = time;
  out[1] = tr?.scale ?? 1;
  out[2] = ((tr?.rotation ?? 0) * Math.PI) / 180;
  out[3] = tr?.opacity ?? 1;
  out[4] = width;
  out[5] = height;
  out[6] = (tr?.x ?? 0) / width;
  out[7] = (tr?.y ?? 0) / height;
  out[8] = shadow[0];
  out[9] = shadow[1];
  out[10] = shadow[2];
  out[11] = intensity;
  out[12] = mid[0];
  out[13] = mid[1];
  out[14] = mid[2];
  out[15] = 0;
  out[16] = high[0];
  out[17] = high[1];
  out[18] = high[2];
  out[19] = 0;
}
