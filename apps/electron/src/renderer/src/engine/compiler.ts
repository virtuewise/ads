// ── WGSL Compiler ────────────────────────────────────────────────────────────
// Compiles a DAG of nodes into a WGSL fragment shader for WebGPU execution.

import type { NodeCatalog, NodeKindInfo, ValueType } from '@printsync/creative-graph';
import { createNode, NODE_REGISTRY } from './nodes';
import type { DAG, Edge, NodeInstance } from './types';

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
  colorGrade: 'color_grade',
  ease: 'ease_val',
  alphaMerge: 'alpha_merge',
};

/**
 * Source nodes that sample the media texture the compositor binds.
 */
const MEDIA_SOURCES = new Set(['mediaSource']);

/**
 * Node types that run in their own @compute pass rather than as a fragment
 * function. The single-pass compositor cannot execute them.
 */
const COMPUTE_NODE_TYPES = new Set(['histogram', 'blurPyramid', 'opticalFlow', 'particleSystem']);

/**
 * Give every function a node defines a per-instance name.
 *
 * WGSL has no namespaces, and a node's WGSL is a fixed string with a fixed
 * function name — so two nodes of the same type would define it twice and the
 * module would fail to compile. Prefixing every function the node defines
 * (and every call to one of them, within that node's own WGSL) makes each
 * instance independent. No node calls another node's function, so nothing
 * outside the node's own text needs rewriting.
 */
function scopeFunctions(wgsl: string, prefix: string): string {
  const names = [...wgsl.matchAll(/\bfn\s+(\w+)\s*\(/g)].map((m) => m[1]);
  if (names.length === 0) return wgsl;
  let out = wgsl;
  for (const name of names) {
    // The definition first: `fn name(` becomes `fn prefix_name(`.
    out = out.replace(new RegExp(`\\bfn\\s+${name}\\s*\\(`, 'g'), `fn ${prefix}_${name}(`);
    // Then any call to it. The prefix ends in an underscore, which is a word
    // character, so the already-renamed definition cannot match again.
    out = out.replace(new RegExp(`\\b${name}\\s*\\(`, 'g'), `${prefix}_${name}(`);
  }
  return out;
}

/** A '#rrggbb' colour as a WGSL vec3 literal. */
function colorLiteral(value: unknown): string {
  if (typeof value === 'number') return `vec3<f32>(${value})`;
  if (typeof value !== 'string') return 'vec3<f32>(0.0)';
  const hex = value.replace('#', '');
  if (hex.length !== 6) return 'vec3<f32>(0.0)';
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
  const n = (x: number) => (Number.isFinite(x) ? x.toFixed(6) : '0.0');
  return `vec3<f32>(${n(r)}, ${n(g)}, ${n(b)})`;
}

/** A '#rrggbb' colour as a WGSL vec4 literal. */
function colorLiteral4(value: unknown): string {
  const rgb = colorLiteral(value);
  if (rgb.startsWith('vec3<f32>(')) {
    return `vec4<f32>(${rgb.slice('vec3<f32>('.length, -1)}, 1.0)`;
  }
  return 'vec4<f32>(0.0)';
}

/**
 * The WGSL literal for an input port's value.
 *
 * A port wired to another node holds that node's variable; otherwise the
 * value is a literal — a number, a colour, or a mode index. An unset port
 * falls back to the port's declared default, not to zero: a transform with a
 * default scale of 1 must not compile as a scale of 0.
 *
 * The literal's *type* comes from the WGSL parameter it feeds, not from the
 * port: a port typed 'texture' can feed either a texture (sampled) or a
 * colour (passed straight through), and only the signature knows which.
 */
function portValue(
  port: { id: string; type: string; default?: unknown },
  inputs: Record<string, unknown>,
  varInputs: Set<string>,
  expectedType: string,
): string {
  const value = inputs[port.id];
  if (varInputs.has(port.id) && typeof value === 'string') return value;
  if (value === undefined || value === null) {
    if (port.default !== undefined) return literalFor(expectedType, port.type, port.default);
    return zeroFor(expectedType);
  }
  return literalFor(expectedType, port.type, value);
}

/** A zero of the given WGSL type. */
function zeroFor(type: string): string {
  if (type === 'vec4<f32>') return 'vec4<f32>(0.0)';
  if (type === 'vec3<f32>') return 'vec3<f32>(0.0)';
  if (type === 'vec2<f32>') return 'vec2<f32>(0.0)';
  return '0.0';
}

/** A WGSL literal of the right type for a port's value. */
function literalFor(expectedType: string, portType: string, value: unknown): string {
  // A colour port carries '#rrggbb'.
  if (portType === 'color') {
    if (expectedType === 'vec4<f32>') return colorLiteral4(value);
    return colorLiteral(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return zeroFor(expectedType);
    if (expectedType === 'vec4<f32>') return `vec4<f32>(${value})`;
    if (expectedType === 'vec3<f32>') return `vec3<f32>(${value})`;
    if (expectedType === 'vec2<f32>') return `vec2<f32>(${value})`;
    return value.toString();
  }
  if (typeof value === 'boolean') return value ? '1.0' : '0.0';
  // A string in a numeric port is a mode name; the node's WGSL compares
  // against a number, so a name has no meaning here.
  return zeroFor(expectedType);
}

/** One parameter of a node's WGSL function. */
interface WgslParam {
  name: string;
  type: string;
}

/** A node's WGSL function signature. */
interface WgslSignature {
  params: WgslParam[];
  returns: string;
}

/** The value type a WGSL type carries. */
function valueTypeForWgsl(wgslType: string): ValueType {
  if (wgslType.includes('texture')) return 'image';
  if (wgslType.startsWith('vec4') || wgslType.startsWith('vec3')) return 'color';
  if (wgslType === 'bool') return 'boolean';
  if (wgslType.startsWith('f32') || wgslType.startsWith('i32') || wgslType.startsWith('u32')) {
    return 'number';
  }
  return 'number';
}

/**
 * Describe a node kind: the precise type of each of its ports.
 *
 * The types come from the node's own WGSL signature, so they cannot drift
 * from what the shader actually does. A port that takes a sampled texture is
 * an image; a port that takes a colour is a colour.
 */
export function describeNodeKind(type: string): NodeKindInfo | null {
  // The render node is the graph's output: it takes a colour and produces
  // nothing. It has no shader function of its own.
  if (type === 'render') {
    return {
      kind: 'render',
      inputs: { input: 'color' },
      output: 'color',
      outputPort: 'output',
      gpu: true,
    };
  }

  let instance: ReturnType<typeof createNode>;
  try {
    instance = createNode(type);
  } catch {
    return null;
  }
  const wgslFn = WGSL_FN_NAME[type] ?? type;
  const signature = parseWgslSignature(instance.toWGSL(), wgslFn);
  if (!signature) return null;

  const inputPorts = instance.ports.filter((p) => p.direction === 'input');
  const outputPorts = instance.ports.filter((p) => p.direction === 'output');
  const inputs: Record<string, ValueType> = {};

  // Walk the signature the same way the call builder does, so a port's type
  // is the type of the argument it actually receives.
  let portIndex = 0;
  for (const param of signature.params) {
    if (param.type === 'sampler') continue;
    if (param.type.includes('texture')) {
      const port = inputPorts[portIndex++];
      if (port) inputs[port.id] = 'image';
      continue;
    }
    if (param.name === 'uv' && param.type.includes('vec2')) continue;
    const port = inputPorts[portIndex++];
    if (port) inputs[port.id] = valueTypeForWgsl(param.type);
  }

  return {
    kind: type,
    inputs,
    output: valueTypeForWgsl(signature.returns),
    outputPort: outputPorts[0]?.id ?? 'output',
    gpu: true,
  };
}

/** Describe every node kind the editor can run. */
export function nodeCatalog(): NodeCatalog {
  const catalog: NodeCatalog = {};
  for (const type of Object.keys(NODE_REGISTRY)) {
    const info = describeNodeKind(type);
    if (info) catalog[type] = info;
  }
  return catalog;
}

/**
 * Read a node's WGSL function signature.
 *
 * The signature is the contract between a node and the compiler: the compiler
 * builds the call from it, so a node can take a colour, a texture, a uv or a
 * number in any order and still be called correctly. Deriving the call from
 * the ports instead meant every node whose WGSL disagreed with its port list
 * produced a call the shader could not compile.
 */
function parseWgslSignature(wgsl: string, fnName: string): WgslSignature | null {
  const match = wgsl.match(new RegExp(`fn\\s+${fnName}\\s*\\(([^)]*)\\)\\s*->\\s*([\\w<>]+)`));
  if (!match) return null;
  const params = match[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [name, type] = s.split(':').map((x) => x.trim());
      return { name, type };
    });
  return { params, returns: match[2] };
}

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

  // A malformed document must not throw here: the loader hands us whatever a
  // file contained.
  const nodes = Array.isArray(dag?.nodes) ? dag.nodes : [];
  const edges = Array.isArray(dag?.edges) ? dag.edges : [];

  // Build adjacency for topological sort
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const nodeMap = new Map<string, NodeInstance>();

  for (const n of nodes) {
    if (!n || typeof n.id !== 'string') continue;
    nodeMap.set(n.id, n);
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (!e || !nodeMap.has(e.from?.node) || !nodeMap.has(e.to?.node)) {
      errors.push('Edge refers to a node that is not in the graph');
      continue;
    }
    adj.get(e.from.node)?.push(e.to.node);
    inDegree.set(e.to.node, (inDegree.get(e.to.node) ?? 0) + 1);
  }

  // Topological sort (Kahn's)
  const queue = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id);
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

  if (sorted.length !== nodeMap.size) {
    errors.push('Cycle detected in node graph');
  }

  // Generate WGSL for each node
  const outputVars = new Map<string, string>(); // "nodeId:port" -> var name
  const outputTypes = new Map<string, string>(); // "nodeId:port" -> WGSL type
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
      instance = createNode(node.type, typeof node.code === 'string' ? node.code : undefined);
    } catch (e) {
      errors.push(`Node ${id}: ${String(e)}`);
      continue;
    }

    // A compute node runs in its own @compute pass, which the fragment
    // compositor does not execute. Report it plainly instead of emitting a
    // call to a function that does not exist.
    if (COMPUTE_NODE_TYPES.has(node.type)) {
      errors.push(
        `Node ${id}: "${node.type}" is a compute pass. The compositor runs a single fragment pass, so compute nodes cannot be executed yet.`,
      );
      continue;
    }

    // Collect inputs from edges. `varInputs` records which ports hold a
    // reference to another node's output — a port's *value* cannot be used to
    // tell, because a plain string like "normal" is not a variable.
    const inputs: Record<string, unknown> = { ...node.inputs };
    const varInputs = new Set<string>();
    for (const e of edges) {
      if (e.to.node === id) {
        const srcVar = outputVars.get(`${e.from.node}:${e.from.port}`);
        if (srcVar !== undefined) {
          inputs[e.to.port] = srcVar;
          varInputs.add(e.to.port);
        } else {
          errors.push(
            `Edge ${e.from.node}:${e.from.port} -> ${e.to.node}:${e.to.port} does not match any output port`,
          );
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
    const nodeWgsl = instance.toWGSL();
    // Every node instance gets its own function names. Two nodes of the same
    // type would otherwise emit the same `fn` twice, and WGSL rejects a
    // redefinition — which made a second node of any type uncompilable.
    const scopedFn = `${varName}_${wgslFn}`;
    functions.push(scopeFunctions(nodeWgsl, varName));

    for (const [port, _value] of Object.entries(outputs)) {
      outputVars.set(`${id}:${port}`, `${varName}_${port}`);
      outputTypes.set(`${id}:${port}`, 'vec4<f32>');
    }

    // Generate the call from the node's own WGSL signature, so the arguments
    // always match the function they are passed to.
    const inputPorts = instance.ports.filter((p) => p.direction === 'input');
    const outputPorts = instance.ports.filter((p) => p.direction === 'output');
    const signature = parseWgslSignature(nodeWgsl, wgslFn);
    if (outputPorts.length > 0) {
      if (!signature) {
        errors.push(`Node ${id}: "${node.type}" does not define the function "${wgslFn}"`);
        continue;
      }
      const args: string[] = [];
      const nodeBindings: string[] = [];
      let portIndex = 0;
      let pair = 0;
      // The sampler that follows a texture belongs to that texture's pair.
      let lastTexPair = -1;
      for (const param of signature.params) {
        if (param.type === 'sampler') {
          args.push(`${varName}_samp${lastTexPair}`);
          continue;
        }
        if (param.type.includes('texture')) {
          // A texture parameter: bind one and skip the port that fed it.
          portIndex += 1;
          const idx = pair++;
          lastTexPair = idx;
          nodeBindings.push(
            `  @group(0) @binding(${nextBinding++}) var ${varName}_tex${idx}: texture_2d<f32>;`,
            `  @group(0) @binding(${nextBinding++}) var ${varName}_samp${idx}: sampler;`,
          );
          args.push(`${varName}_tex${idx}`);
          neighborhoodBindings += 1;
          continue;
        }
        if (param.name === 'uv' && param.type.includes('vec2')) {
          args.push('uv');
          continue;
        }
        // Everything else takes the next input port's value.
        const port = inputPorts[portIndex++];
        args.push(port ? portValue(port, inputs, varInputs, param.type) : zeroFor(param.type));
      }
      const outType = signature.returns || 'vec4<f32>';
      bodyLines.push(
        `  let ${varName}_${outputPorts[0].id}: ${outType} = ${scopedFn}(${args.join(', ')});`,
      );
      outputTypes.set(`${id}:${outputPorts[0].id}`, outType);
      textureBindings.push(...nodeBindings);
    }
  }

  // Find render node. The last edge into it wins, which is the same rule the
  // other nodes use — picking the first made the render node disagree with
  // the rest of the graph when a node had two sources.
  const renderNode = nodes.find((n) => n.type === 'render');
  if (renderNode) {
    const inputEdges = edges.filter((e) => e.to.node === renderNode.id);
    const inputEdge = inputEdges[inputEdges.length - 1];
    if (inputEdge) {
      const srcVar = outputVars.get(`${inputEdge.from.node}:${inputEdge.from.port}`);
      if (srcVar) {
        // The fragment must return a colour. A scalar source (a script node, a
        // number) is widened to one.
        const srcType = outputTypes.get(`${inputEdge.from.node}:${inputEdge.from.port}`);
        bodyLines.push(
          srcType === 'vec4<f32>'
            ? `  return ${srcVar};`
            : `  return vec4<f32>(${srcVar}, ${srcVar}, ${srcVar}, 1.0);`,
        );
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
  // The object literal is JSON-compatible — no trailing commas — so the same
  // text can be parsed back into a graph. It is still valid TypeScript.
  lines.push('  "nodes": [');
  const nodeLines = dag.nodes.map((n) => {
    const code = n.code ? `, "code": ${JSON.stringify(n.code)}` : '';
    return `    { "id": ${JSON.stringify(n.id)}, "type": ${JSON.stringify(n.type)}, "position": { "x": ${n.position.x}, "y": ${n.position.y} }, "inputs": ${JSON.stringify(n.inputs ?? {})}${code} }`;
  });
  lines.push(nodeLines.join(',\n'));
  lines.push('  ],');
  lines.push('  "edges": [');
  const edgeLines = dag.edges.map(
    (e) =>
      `    { "from": { "node": ${JSON.stringify(e.from.node)}, "port": ${JSON.stringify(e.from.port)} }, "to": { "node": ${JSON.stringify(e.to.node)}, "port": ${JSON.stringify(e.to.port)} } }`,
  );
  lines.push(edgeLines.join(',\n'));
  lines.push('  ]');
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
    const source = extractGraphObject(code);
    if (!source) return null;
    const obj = JSON.parse(source) as {
      nodes?: Array<{
        id?: string;
        type: string;
        position?: { x: number; y: number };
        inputs?: Record<string, unknown>;
        code?: string;
      }>;
      edges?: Array<{
        from: { node: string; port: string } | string;
        to: { node: string; port: string } | string;
      }>;
    };
    if (!Array.isArray(obj.nodes)) return null;

    // The node ids are kept, so the edges still point at the right nodes.
    const nodes: NodeInstance[] = obj.nodes.map((n, i) => ({
      id: typeof n.id === 'string' && n.id ? n.id : `node-${i}`,
      type: n.type,
      position: n.position ?? { x: 0, y: 0 },
      inputs: n.inputs ?? {},
      outputs: {},
      ...(typeof n.code === 'string' ? { code: n.code } : {}),
    }));
    const known = new Set(nodes.map((n) => n.id));

    const edges: Edge[] = (Array.isArray(obj.edges) ? obj.edges : [])
      .map((e, i) => {
        const from = typeof e.from === 'string' ? splitRef(e.from) : e.from;
        const to = typeof e.to === 'string' ? splitRef(e.to) : e.to;
        return { id: `edge-${i}`, from, to };
      })
      // An edge to a node that is not in the graph would dangle.
      .filter((e) => known.has(e.from.node) && known.has(e.to.node));

    return { nodes, edges };
  } catch {
    return null;
  }
}

/**
 * Find the `nodeGraph` object literal in the code.
 *
 * A regex cannot do this reliably: the object contains nested braces and
 * strings, and the code the user typed may not be the code that was
 * generated. Scanning for the matching brace does.
 */
function extractGraphObject(code: string): string | null {
  const marker = code.indexOf('export const nodeGraph');
  if (marker < 0) return null;
  const open = code.indexOf('{', marker);
  if (open < 0) return null;
  let depth = 0;
  let quote = '';
  for (let i = open; i < code.length; i += 1) {
    const ch = code[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return code.slice(open, i + 1);
    }
  }
  return null;
}

/** Split a 'node:port' reference. */
function splitRef(ref: string): { node: string; port: string } {
  const at = ref.lastIndexOf(':');
  if (at < 0) return { node: ref, port: 'output' };
  return { node: ref.slice(0, at), port: ref.slice(at + 1) };
}
