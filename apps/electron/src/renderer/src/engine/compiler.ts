// ── WGSL Compiler ────────────────────────────────────────────────────────────
// Compiles a DAG of nodes into a WGSL fragment shader for WebGPU execution.

import { createNode } from './nodes';
import type { DAG, NodeInstance } from './types';

export interface CompiledShader {
  wgsl: string;
  entryPoint: string;
  uniforms: string[];
  errors: string[];
}

export function compileDAG(dag: DAG): CompiledShader {
  const errors: string[] = [];
  const uniforms: string[] = [];
  const functions: string[] = [];
  const bodyLines: string[] = [];

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
    functions.push(instance.toWGSL());

    for (const [port, _value] of Object.entries(outputs)) {
      outputVars.set(`${id}:${port}`, `${varName}_${port}`);
    }

    // Generate call
    const inputPorts = instance.ports.filter((p) => p.direction === 'input');
    const outputPorts = instance.ports.filter((p) => p.direction === 'output');
    if (outputPorts.length > 0) {
      const args = inputPorts.map((p) => {
        const v = inputs[p.id];
        if (typeof v === 'string' && v.startsWith('n')) return v;
        if (typeof v === 'number') return v.toString();
        return '0.0';
      });
      const _outType = outputPorts[0].type === 'texture' ? 'vec4<f32>' : 'f32';
      bodyLines.push(
        `  let ${varName}_${outputPorts[0].id} = ${instance.type}(${args.join(', ')});`,
      );
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
      }
    }
  }

  const wgsl = `
struct Uniforms {
  time: f32,
  resolution: vec2<f32>,
  mouse: vec2<f32>,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

${functions.join('\n\n')}

@fragment
fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = fragCoord.xy / u.resolution;
${bodyLines.join('\n')}
  return vec4(uv, 0.5, 1.0);
}
`;

  return { wgsl, entryPoint: 'fs', uniforms, errors };
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
