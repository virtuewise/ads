// ── DAG-to-Composite Bridge ──────────────────────────────────────────────────
// The architectural join that makes the node graph drive the viewport.
// Takes the compiled DAG WGSL and wraps it in the composite shader's
// transform/uniform pipeline, producing a single unified shader.
// See docs/03-ENGINE-CORE.md and docs/22-COMPOSITOR.md.

import { compileDAG } from './compiler';
import type { BrandLUT, DAG, TransformState } from './types';
import { COMPOSITE_SHADER, UNIFORM_BYTES, UNIFORM_FLOATS, VERTEX_SHADER } from './visual';

export interface BridgeResult {
  /** The unified WGSL shader source. */
  wgsl: string;
  /** Whether the bridge succeeded. */
  ok: boolean;
  /** Error messages if compilation failed. */
  errors: string[];
  /** The compiled DAG result (for debugging). */
  compiled?: ReturnType<typeof compileDAG>;
  /**
   * Bindings the renderer must fill with the current media frame, when the
   * graph contains a media source.
   */
  mediaBindings?: { texture: number; sampler: number };
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

  // The single-pass bridge can only supply the uniform block and the media
  // texture. A neighbourhood-effect binding means the graph contains a node
  // that must read a texture produced by *another* node — that needs a render
  // pass per node, so refuse it rather than hand WebGPU an invalid bind group
  // and silently present a black frame.
  if (compiled.neighborhoodBindings > 0) {
    return {
      wgsl: COMPOSITE_SHADER,
      ok: false,
      errors: [
        'This graph contains texture-sampling nodes. The single-pass bridge currently supports source and colour-only graphs; multi-pass execution is still on the roadmap.',
      ],
      compiled,
    };
  }

  // Extract the fragment body from the compiled DAG shader.
  const extracted = extractFragmentBody(compiled.wgsl);
  if (!extracted) {
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
  const wgsl = buildUnifiedShader(extracted, compiled.wgsl);

  return {
    wgsl,
    ok: true,
    errors: [],
    compiled,
    ...(compiled.mediaBindings ? { mediaBindings: compiled.mediaBindings } : {}),
  };
}

interface FragmentBody {
  /** Statements before the graph's final return. */
  statements: string;
  /** Expression returned by the graph. */
  output: string;
}

/**
 * Extract the fragment body from a compiled DAG shader.
 *
 * The compiled body owns its own `uv` declaration and `return` statement. The
 * bridge has already derived the transformed `uv` and needs the graph's value
 * as an expression, so both are stripped here. Dropping the return is critical:
 * leaving it in place would return before opacity and the LUT are applied.
 */
function extractFragmentBody(wgsl: string): FragmentBody | null {
  const match = wgsl.match(
    /@fragment\s+fn\s+fs\s*\([\s\S]*?\)\s*->\s*@location\(0\)\s*vec4<f32>\s*\{([\s\S]*?)\n\}/,
  );
  if (!match) return null;

  let body = match[1].trim();
  body = body.replace(/^let\s+uv\s*=\s*fragCoord\.xy\s*\/\s*u\.resolution;\s*/, '');

  const returnMatch = body.match(/\breturn\s+([^;]+);\s*$/);
  if (!returnMatch || returnMatch.index === undefined) return null;

  const output = returnMatch[1].trim();
  const statements = body.slice(0, returnMatch.index).trim();
  if (!output) return null;

  return { statements, output };
}

/** Extract the function definitions (everything before @fragment). */
function extractFunctions(wgsl: string): string {
  const idx = wgsl.indexOf('@fragment');
  if (idx < 0) return '';
  return wgsl.substring(0, idx).trim();
}

/** Build the unified shader that combines DAG output with the transform pipeline. */
function buildUnifiedShader(dagBody: FragmentBody, fullDagWgsl: string): string {
  const functions = extractFunctions(fullDagWgsl);

  // The unified fragment shader:
  // 1. Start with UV coordinates
  // 2. Apply inverse transform (to sample the DAG output at the transformed position)
  // 3. Evaluate the DAG body, whose statements see the transformed `uv`
  // 4. Apply opacity
  // 5. Apply the LUT
  return `${VERTEX_SHADER}
${functions}

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

  // Evaluate the graph against the transformed coordinates. extractFragmentBody
  // has already converted the graph's return statement into this assignment.
  var color: vec4<f32> = vec4<f32>(0.0);
${indentLines(dagBody.statements, '  ')}
  color = ${dagBody.output};

  // Apply opacity
  let a = clamp(u.opacity, 0.0, 1.0);
  color = vec4(color.rgb * a, color.a * a);

  // Apply the 3-point LUT. WGSL does not allow assigning through a swizzle,
  // so rebuild the vec4 instead.
  let lum = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  var lutCol = mix(u.lutShadow.rgb, u.lutMid.rgb, smoothstep(0.0, 0.5, lum));
  lutCol = mix(lutCol, u.lutHighlight.rgb, smoothstep(0.5, 1.0, lum));
  color = vec4<f32>(mix(color.rgb, lutCol, u.lutShadow.a), color.a);

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
