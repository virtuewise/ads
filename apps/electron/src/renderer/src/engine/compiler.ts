// ── WGSL Compiler ────────────────────────────────────────────────────────────
// Compiles a DAG of nodes into a WGSL fragment shader for WebGPU execution.

import { createNode } from './nodes';
import type { DAG, NodeInstance } from './types';

export interface CompiledShader {
  wgsl: string;
  entryPoint: string;
  uniforms: string[];
  errors: string[];
  /**
   * Bindings the compositor must fill for a media source, when the graph has
   * one. `texture` is the external texture holding the decoded frame,
   * `sampler` its non-filtering sampler.
   */
  mediaBindings?: { texture: number; sampler: number };
  /**
   * How many neighbourhood-effect texture bindings the graph needs. Each one
   * requires its own render pass, so a single-pass compositor cannot run a
   * graph with any of them.
   */
  neighborhoodBindings: number;
}

/** Map node type to WGSL function name (some differ from the type string). */
const WGSL_FN_NAME: Record<string, string> = {
  dataSource: 'data_source',
  colorSource: 'color_source',
  proceduralScene: 'procedural_scene',
  noiseSource: 'noise_source',
  solidSource: 'solid_source',
  gradientSource: 'gradient_source',
  checkerSource: 'checker_source',
  textureTransform: 'texture_transform',
  spatialTransform: 'spatial_transform',
  mediaSource: 'media_source',
  chromaticAberration: 'chromatic_aberration',
  filmGrain: 'film_grain',
  lensDistortion: 'lens_distortion',
  hueShift: 'hue_shift',
  bloom: 'bloom',
  posterize: 'posterize',
  displacementMap: 'displacement_map',
  chromaKey: 'chroma_key',
  edgeDetect: 'edge_detect',
  pixelate: 'pixelate',
  emboss: 'emboss',
  invert: 'invert',
  threshold: 'threshold',
  channelMixer: 'channel_mixer',
  rgbSplit: 'rgb_split',
  solarize: 'solarize',
  motionBlur: 'motion_blur',
  lensBlur: 'lens_blur',
};

/** Nodes that need UV coordinates and a texture sampler (neighborhood effects). */
const NEIGHBORHOOD_EFFECTS = new Set([
  'blur',
  'vignette',
  'blend',
  'glow',
  'textureTransform',
  'spatialTransform',
  'chromaticAberration',
  'sharpen',
  'filmGrain',
  'lensDistortion',
  'temperature',
  'levels',
  'exposure',
  'saturation',
  'hueShift',
  'bloom',
  'posterize',
  'twirl',
  'chromaKey',
  'halftone',
  'scanlines',
  'edgeDetect',
  'dither',
  'pixelate',
  'emboss',
  'invert',
  'threshold',
  'channelMixer',
  'rgbSplit',
  'solarize',
  'motionBlur',
  'lensBlur',
]);

/** Source nodes that need UV coordinates but no texture sampler. */
const UV_SOURCES = new Set(['proceduralScene', 'gradientSource', 'checkerSource', 'mediaSource']);

/**
 * Source nodes that sample the media texture the compositor binds.
 */
const MEDIA_SOURCES = new Set(['mediaSource']);

/**
 * Binding numbers are reserved so the compositor knows where to put things:
 *   0 — the uniform block
 *   1 — the media texture   (only when the graph has a media source)
 *   2 — the media sampler   (only when the graph has a media source)
 *   3+ — neighbourhood-effect texture/sampler pairs
 */
const MEDIA_TEXTURE_BINDING = 1;
const MEDIA_SAMPLER_BINDING = 2;

/** Uniform struct matching visual.ts — the WYSIWYG contract. */
const UNIFORM_STRUCT = `struct Uniforms {
  time: f32,
  scale: f32,
  rotation: f32,
  opacity: f32,
  resolution: vec2<f32>,
  translation: vec2<f32>,
  lutShadow: vec4<f32>,
  lutMid: vec4<f32>,
  lutHighlight: vec4<f32>,
};`;

export function compileDAG(dag: DAG): CompiledShader {
  const errors: string[] = [];
  const uniforms: string[] = [];
  const functions: string[] = [];
  const bodyLines: string[] = [];
  const textureBindings: string[] = [];
  let neighborhoodBindings = 0;

  // Build adjacency for topological sort
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const nodeMap = new Map<string, NodeInstance>();

  for (const n of dag.nodes) {
    nodeMap.set(n.id, n);
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of dag.edges) {
    if (!nodeMap.has(e.from.node) || !nodeMap.has(e.to.node)) continue;
    adj.get(e.from.node)?.push(e.to.node);
    inDegree.set(e.to.node, (inDegree.get(e.to.node) ?? 0) + 1);
  }

  // Topological sort (Kahn's)
  const queue = dag.nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  const sorted: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() ?? '';
    sorted.push(id);
    for (const next of adj.get(id) ?? []) {
      const d = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  if (sorted.length !== dag.nodes.length) {
    errors.push('Cycle detected in node graph');
  }

  // Generate WGSL for each node
  const outputVars = new Map<string, string>(); // "nodeId:port" -> var name
  let varCounter: number = 0;
  let emittedRenderReturn = false;

  // A media source samples a texture the compositor supplies, so its bindings
  // are reserved before any neighbourhood-effect bindings are numbered.
  const hasMediaSource = sorted.some((id) => {
    const node = nodeMap.get(id);
    return node ? MEDIA_SOURCES.has(node.type) : false;
  });
  if (hasMediaSource) {
    textureBindings.push(
      `  @group(0) @binding(${MEDIA_TEXTURE_BINDING}) var media_tex: texture_external;`,
      `  @group(0) @binding(${MEDIA_SAMPLER_BINDING}) var media_samp: sampler;`,
    );
  }
  let nextBinding = hasMediaSource ? 3 : 1;

  for (const id of sorted) {
    const node = nodeMap.get(id);
    if (!node) continue;
    let instance: ReturnType<typeof createNode>;
    try {
      instance = createNode(node.type);
    } catch (e) {
      errors.push(`Node ${id}: ${String(e)}`);
      continue;
    }

    // Collect inputs from edges
    const inputs: Record<string, unknown> = { ...node.inputs };
    for (const e of dag.edges) {
      if (e.to.node === id) {
        const srcVar = outputVars.get(`${e.from.node}:${e.from.port}`);
        if (srcVar !== undefined) {
          inputs[e.to.port] = srcVar;
        }
      }
    }

    // Execute node
    let outputs: Record<string, unknown>;
    try {
      outputs = instance.execute(inputs);
    } catch (e) {
      errors.push(`Node ${id} execution: ${String(e)}`);
      continue;
    }

    // Generate WGSL
    const varName = `n${varCounter++}`;
    const wgslFn = WGSL_FN_NAME[node.type] ?? node.type;
    functions.push(instance.toWGSL());

    for (const [port, _value] of Object.entries(outputs)) {
      outputVars.set(`${id}:${port}`, `${varName}_${port}`);
    }

    // Generate call
    const inputPorts = instance.ports.filter((p) => p.direction === 'input');
    const outputPorts = instance.ports.filter((p) => p.direction === 'output');
    if (outputPorts.length > 0) {
      const isNeighborhood = NEIGHBORHOOD_EFFECTS.has(node.type);
      const isUvSource = UV_SOURCES.has(node.type);
      const args = inputPorts.map((p) => {
        const v = inputs[p.id];
        if (typeof v === 'string' && v.startsWith('n')) return v;
        if (typeof v === 'number') return v.toString();
        return '0.0';
      });
      // For neighborhood effects, replace the input texture ref with this node's
      // own texture/sampler bindings and inject UV coordinates.
      if (isNeighborhood) {
        // Drop the first arg (input texture reference) — replaced below
        args.shift();
        args.unshift(`${varName}_tex`, `${varName}_samp`, 'uv');
      } else if (isUvSource) {
        // Inject uv as the first argument for UV-dependent source nodes
        args.unshift('uv');
      }
      const outType = outputPorts[0].type === 'texture' ? 'vec4<f32>' : 'f32';
      bodyLines.push(
        `  let ${varName}_${outputPorts[0].id}: ${outType} = ${wgslFn}(${args.join(', ')});`,
      );
      // Add texture sampler binding for neighborhood-effect nodes
      if (isNeighborhood) {
        textureBindings.push(
          `  @group(0) @binding(${nextBinding++}) var ${varName}_tex: texture_2d<f32>;`,
          `  @group(0) @binding(${nextBinding++}) var ${varName}_samp: sampler;`,
        );
        neighborhoodBindings += 1;
      }
    }
  }

  // Find render node
  const renderNode = dag.nodes.find((n) => n.type === 'render');
  if (renderNode) {
    const inputEdge = dag.edges.find((e) => e.to.node === renderNode.id);
    if (inputEdge) {
      const srcVar = outputVars.get(`${inputEdge.from.node}:${inputEdge.from.port}`);
      if (srcVar) {
        bodyLines.push(`  return ${srcVar};`);
        emittedRenderReturn = true;
      }
    }
  }

  const wgsl = `
${UNIFORM_STRUCT}
@group(0) @binding(0) var<uniform> u: Uniforms;
${textureBindings.length > 0 ? `\n${textureBindings.join('\n')}\n` : ''}

${functions.join('\n\n')}

@fragment
fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = fragCoord.xy / u.resolution;
${bodyLines.join('\n')}
${emittedRenderReturn ? '' : '  return vec4<f32>(uv, 0.5, 1.0);'}
}
`;

  return {
    wgsl,
    entryPoint: 'fs',
    uniforms,
    errors,
    neighborhoodBindings,
    ...(hasMediaSource
      ? { mediaBindings: { texture: MEDIA_TEXTURE_BINDING, sampler: MEDIA_SAMPLER_BINDING } }
      : {}),
  };
}

// ── DAG Serialization ────────────────────────────────────────────────────────

export function serializeDAG(dag: DAG): string {
  return JSON.stringify(dag, null, 2);
}

export function deserializeDAG(json: string): DAG {
  return JSON.parse(json) as DAG;
}

// ── Code-to-Node / Node-to-Code ─────────────────────────────────────────────

export function dagToCode(dag: DAG): string {
  const lines: string[] = [];
  lines.push('// Virtue Studio — Generated from Node Graph');
  lines.push('// Edit this code and it will sync back to the node graph.');
  lines.push('');
  lines.push('export const nodeGraph = {');
  lines.push('  nodes: [');
  for (const n of dag.nodes) {
    lines.push(
      `    { type: '${n.type}', position: { x: ${n.position.x}, y: ${n.position.y}}, inputs: ${JSON.stringify(n.inputs)} },`,
    );
  }
  lines.push('  ],');
  lines.push('  edges: [');
  for (const e of dag.edges) {
    lines.push(`    { from: '${e.from.node}:${e.from.port}', to: '${e.to.node}:${e.to.port}' },`);
  }
  lines.push('  ],');
  lines.push('};');
  lines.push('');
  lines.push('// Custom functions');
  for (const n of dag.nodes) {
    if (n.type === 'script' && n.code) {
      lines.push(n.code);
    }
  }
  return lines.join('\n');
}

export function codeToDAG(code: string): DAG | null {
  try {
    // Extract the nodeGraph object from code
    const match = code.match(/export const nodeGraph = ({[\s\S]*?});/);
    if (!match) return null;
    const obj = JSON.parse(match[1]);
    return {
      nodes: obj.nodes.map(
        (
          n: {
            type: string;
            position: { x: number; y: number };
            inputs: Record<string, unknown>;
            code?: string;
          },
          i: number,
        ) => ({
          id: `node-${i}`,
          type: n.type,
          position: n.position,
          inputs: n.inputs ?? {},
          outputs: {},
          code: n.code,
        }),
      ),
      edges: obj.edges.map((e: { from: string; to: string }, i: number) => {
        const [fromNode, fromPort] = e.from.split(':');
        const [toNode, toPort] = e.to.split(':');
        return {
          id: `edge-${i}`,
          from: { node: fromNode, port: fromPort },
          to: { node: toNode, port: toPort },
        };
      }),
    };
  } catch {
    return null;
  }
}
