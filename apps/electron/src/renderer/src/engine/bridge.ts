// ── DAG-to-Composite Bridge ──────────────────────────────────────────────────
// The architectural join that makes the node graph drive the viewport.
// Takes the compiled DAG WGSL and wraps it in the composite shader's
// transform/uniform pipeline, producing a single unified shader.
// See docs/03-ENGINE-CORE.md and docs/22-COMPOSITOR.md.

import { compileDAG } from './compiler';
import type { BrandLUT, DAG, TransformState } from './types';
import { COMPOSITE_SHADER, UNIFORM_BYTES, UNIFORM_FLOATS } from './visual';

export interface BridgeResult {
  /** The unified WGSL shader source. */
  wgsl: string;
  /** Whether the bridge succeeded. */
  ok: boolean;
  /** Error messages if compilation failed. */
  errors: string[];
  /** The compiled DAG result (for debugging). */
  compiled?: ReturnType<typeof compileDAG>;
}

/**
 * Bridge the DAG output into the composite shader pipeline.
 *
 * The composite shader provides:
 *   - The uniform struct (time, scale, rotation, opacity, resolution, translation, lut*)
 *   - The vertex shader (fullscreen triangle)
 *   - The transform pipeline (rotate, scale, translate, opacity)
 *   - The LUT application
 *
 * The DAG provides:
 *   - Fragment functions (the node graph's procedural content)
 *   - A fragment entry point that returns a vec4
 *
 * The bridge wraps the DAG's fragment body inside the composite shader's
 * transform pipeline, so the DAG's output is transformed and graded.
 */
export function bridgeDAGToComposite(dag: DAG): BridgeResult {
  const compiled = compileDAG(dag);
  if (compiled.errors.length > 0) {
    return { wgsl: COMPOSITE_SHADER, ok: false, errors: compiled.errors, compiled };
  }

  // Extract the fragment body from the compiled DAG shader
  const dagBody = extractFragmentBody(compiled.wgsl);
  if (!dagBody) {
    return {
      wgsl: COMPOSITE_SHADER,
      ok: false,
      errors: ['Failed to extract fragment body from DAG shader'],
      compiled,
    };
  }

  // Build the unified shader:
  // 1. The uniform struct (from visual.ts)
  // 2. The DAG's fragment functions
  // 3. A new fragment entry that:
  //    a. Calls the DAG body to get the base color
  //    b. Applies the transform (rotation, scale, translation)
  //    c. Applies the LUT
  //    d. Returns the final color
  const wgsl = buildUnifiedShader(dagBody, compiled.wgsl);

  return { wgsl, ok: true, errors: [], compiled };
}

/** Extract the fragment function body from a compiled DAG shader. */
function extractFragmentBody(wgsl: string): string | null {
  // Find the @fragment fn and extract its body
  const match = wgsl.match(
    /@fragment\s+fn\s+fs\s*\([^)]*\)\s*->\s*@location\(0\)\s*vec4<f32>\s*\{([\s\S]*?)\n\}/,
  );
  if (!match) return null;
  return match[1].trim();
}

/** Extract the function definitions (everything before @fragment). */
function extractFunctions(wgsl: string): string {
  const idx = wgsl.indexOf('@fragment');
  if (idx < 0) return '';
  return wgsl.substring(0, idx).trim();
}

/** Build the unified shader that combines DAG output with the transform pipeline. */
function buildUnifiedShader(dagBody: string, fullDagWgsl: string): string {
  const functions = extractFunctions(fullDagWgsl);

  // The unified fragment shader:
  // 1. Start with UV coordinates
  // 2. Apply inverse transform (to sample the DAG output at the transformed position)
  // 3. Call the DAG body to get the base color
  // 4. Apply opacity
  // 5. Apply the LUT
  return `${functions}

@fragment
fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  var uv = fragCoord.xy / u.resolution;

  // Apply inverse transform: rotate, scale, translate
  var c = uv - vec2(0.5, 0.5);
  let ca = cos(u.rotation);
  let sa = sin(u.rotation);
  c = vec2(c.x * ca - c.y * sa, c.x * sa + c.y * ca);
  c = c / max(u.scale, 0.0001);
  c = c - u.translation;
  uv = c + vec2(0.5, 0.5);

  // Sample the DAG output at the transformed position
  var color: vec4<f32>;
${indentLines(dagBody, '  ')}

  // Apply opacity
  let a = clamp(u.opacity, 0.0, 1.0);
  color = vec4(color.rgb * a, color.a * a);

  // Apply the 3-point LUT
  let lum = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  var lutCol = mix(u.lutShadow.rgb, u.lutMid.rgb, smoothstep(0.0, 0.5, lum));
  lutCol = mix(lutCol, u.lutHighlight.rgb, smoothstep(0.5, 1.0, lum));
  color.rgb = mix(color.rgb, lutCol, u.lutShadow.a);

  return color;
}
`;
}

/** Indent each line of a string by the given prefix. */
function indentLines(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((line) => (line.trim() ? prefix + line.trim() : line))
    .join('\n');
}

/** Pack uniforms for the bridge shader (same layout as visual.ts). */
export function packBridgeUniforms(
  data: Float32Array,
  opts: {
    time: number;
    width: number;
    height: number;
    transform?: TransformState;
    lut?: BrandLUT | null;
  },
): void {
  const { time, width, height, transform, lut } = opts;
  const tr = transform;

  data[0] = time;
  data[1] = tr?.scale ?? 1;
  data[2] = ((tr?.rotation ?? 0) * Math.PI) / 180;
  data[3] = tr?.opacity ?? 1;
  data[4] = width;
  data[5] = height;
  data[6] = (tr?.x ?? 0) / width;
  data[7] = (tr?.y ?? 0) / height;

  // LUT values
  const colors = lut?.colors;
  const sRgb = hexToRgb01(colors?.shadow ?? '#000000');
  const mRgb = hexToRgb01(colors?.midtone ?? '#808080');
  const hRgb = hexToRgb01(colors?.highlight ?? '#ffffff');
  const lutIntensity = lut?.intensity ?? 0;

  data[8] = sRgb[0];
  data[9] = sRgb[1];
  data[10] = sRgb[2];
  data[11] = lutIntensity;
  data[12] = mRgb[0];
  data[13] = mRgb[1];
  data[14] = mRgb[2];
  data[15] = 0;
  data[16] = hRgb[0];
  data[17] = hRgb[1];
  data[18] = hRgb[2];
  data[19] = 0;
}

function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return [r, g, b];
}

export { UNIFORM_BYTES, UNIFORM_FLOATS };
