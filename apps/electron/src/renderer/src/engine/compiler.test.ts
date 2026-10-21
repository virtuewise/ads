// ── Compiler / bridge tests ──────────────────────────────────────────────────
// The compiler and the bridge are pure functions, so the media-source wiring
// can be pinned without a GPU.

import { describe, expect, it } from 'vitest';
import { bridgeDAGToComposite } from './bridge';
import { codeToDAG, compileDAG, dagToCode } from './compiler';
import { NODE_REGISTRY } from './nodes';
import type { DAG, NodeInstance } from './types';

function mediaDAG(): DAG {
  return {
    nodes: [
      { id: 'm1', type: 'mediaSource', position: { x: 0, y: 0 }, inputs: {}, outputs: {} },
      { id: 'r1', type: 'render', position: { x: 200, y: 0 }, inputs: {}, outputs: {} },
    ],
    edges: [{ id: 'e1', from: { node: 'm1', port: 'output' }, to: { node: 'r1', port: 'input' } }],
  };
}

function sceneDAG(): DAG {
  return {
    nodes: [
      { id: 'p1', type: 'proceduralScene', position: { x: 0, y: 0 }, inputs: {}, outputs: {} },
      { id: 'r1', type: 'render', position: { x: 200, y: 0 }, inputs: {}, outputs: {} },
    ],
    edges: [{ id: 'e1', from: { node: 'p1', port: 'output' }, to: { node: 'r1', port: 'input' } }],
  };
}

function blurDAG(): DAG {
  return {
    nodes: [
      { id: 'p1', type: 'proceduralScene', position: { x: 0, y: 0 }, inputs: {}, outputs: {} },
      { id: 'b1', type: 'blur', position: { x: 120, y: 0 }, inputs: {}, outputs: {} },
      { id: 'r1', type: 'render', position: { x: 240, y: 0 }, inputs: {}, outputs: {} },
    ],
    edges: [
      { id: 'e1', from: { node: 'p1', port: 'output' }, to: { node: 'b1', port: 'input' } },
      { id: 'e2', from: { node: 'b1', port: 'output' }, to: { node: 'r1', port: 'input' } },
    ],
  };
}

const node = (id: string, type: string, inputs: Record<string, unknown> = {}): NodeInstance => ({
  id,
  type,
  position: { x: 0, y: 0 },
  inputs,
  outputs: {},
});

/** The id of a node type's first output port. */
function outputPortOf(type: string): string {
  const Ctor = NODE_REGISTRY[type];
  if (!Ctor) return 'output';
  const inst = new Ctor();
  return inst.ports.find((p) => p.direction === 'output')?.id ?? 'output';
}

/** Split a WGSL argument list, respecting nested parentheses. */
function splitArgs(argList: string): string[] {
  const trimmed = argList.trim();
  if (!trimmed) return [];
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of trimmed) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  args.push(current.trim());
  return args;
}

/** A graph with one node of the given type feeding the render node. */
function singleNodeDAG(type: string, inputs: Record<string, unknown> = {}): DAG {
  return {
    nodes: [node('a', type, inputs), node('r', 'render')],
    edges: [
      {
        id: 'e1',
        from: { node: 'a', port: outputPortOf(type) },
        to: { node: 'r', port: 'input' },
      },
    ],
  };
}

describe('compileDAG — media source', () => {
  it('reserves the media texture and sampler bindings', () => {
    const compiled = compileDAG(mediaDAG());
    expect(compiled.errors).toEqual([]);
    expect(compiled.mediaBindings).toEqual({ texture: 1, sampler: 2 });
    expect(compiled.wgsl).toContain('@group(0) @binding(1) var media_tex: texture_external;');
    expect(compiled.wgsl).toContain('@group(0) @binding(2) var media_samp: sampler;');
  });

  it('calls the media node with the fragment uv', () => {
    const compiled = compileDAG(mediaDAG());
    // The function name is scoped per node instance.
    expect(compiled.wgsl).toContain('media_source(uv)');
    expect(compiled.wgsl).toContain('fn n0_media_source(uv: vec2<f32>) -> vec4<f32>');
  });

  it('reports no media bindings for a graph without one', () => {
    const compiled = compileDAG(sceneDAG());
    expect(compiled.mediaBindings).toBeUndefined();
    expect(compiled.wgsl).not.toContain('media_tex');
  });

  it('counts neighbourhood-effect bindings separately', () => {
    expect(compileDAG(sceneDAG()).neighborhoodBindings).toBe(0);
    expect(compileDAG(blurDAG()).neighborhoodBindings).toBe(1);
  });
});

describe('bridgeDAGToComposite', () => {
  it('bridges a media graph and keeps the media bindings', () => {
    const result = bridgeDAGToComposite(mediaDAG());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.mediaBindings).toEqual({ texture: 1, sampler: 2 });
    expect(result.wgsl).toContain('var media_tex: texture_external;');
    expect(result.wgsl).toContain('textureSampleBaseClampToEdge(media_tex, media_samp, uv)');
  });

  it('bridges the plain scene graph', () => {
    const result = bridgeDAGToComposite(sceneDAG());
    expect(result.ok).toBe(true);
    expect(result.mediaBindings).toBeUndefined();
  });

  it('refuses a graph that needs a multi-pass render', () => {
    const result = bridgeDAGToComposite(blurDAG());
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/texture-sampling nodes/);
  });
});

describe('compileDAG — every node type', () => {
  // The compiler builds each call from the node's own WGSL signature. These
  // checks are the contract between a node and the compiler: if a node's
  // signature and its call disagree, the shader will not compile.
  const types = Object.keys(NODE_REGISTRY).filter((t) => t !== 'render');

  for (const type of types) {
    it(`compiles a graph containing a ${type} node`, () => {
      const out = compileDAG(singleNodeDAG(type));
      // Compute nodes are reported rather than emitted.
      if (/compute pass/.test(out.errors.join(' '))) return;

      // Collect the module's function signatures.
      const signatures = new Map<string, { arity: number; returns: string }>();
      for (const m of out.wgsl.matchAll(/fn\s+(\w+)\s*\(([^)]*)\)\s*->\s*([\w<>]+)/g)) {
        signatures.set(m[1], {
          arity: m[2].split(',').filter((s) => s.trim()).length,
          returns: m[3],
        });
      }

      // Every call must name a function that exists, with the right number of
      // arguments and a result of the declared type.
      const calls = [...out.wgsl.matchAll(/let\s+(\w+):\s*([\w<>]+)\s*=\s*(\w+)\((.*)\);/gm)];
      expect(calls.length).toBeGreaterThan(0);
      for (const [, varName, declared, fn, argList] of calls) {
        const sig = signatures.get(fn);
        expect(sig, `${type}: call to undefined ${fn}`).toBeDefined();
        expect(splitArgs(argList).length, `${type}: ${fn} argument count`).toBe(sig?.arity);
        expect(declared, `${type}: ${varName} type`).toBe(sig?.returns);
      }
    });
  }

  it('gives two nodes of the same type distinct functions', () => {
    // WGSL forbids two module-scope declarations with the same name, so two
    // nodes of one type used to produce an uncompilable shader.
    for (const type of types) {
      const port = outputPortOf(type);
      const out = compileDAG({
        nodes: [node('a', type), node('b', type), node('r', 'render')],
        edges: [
          { id: 'e1', from: { node: 'a', port }, to: { node: 'r', port: 'input' } },
          { id: 'e2', from: { node: 'b', port }, to: { node: 'r', port: 'input' } },
        ],
      });
      const names = [...out.wgsl.matchAll(/fn\s+(\w+)\s*\(/g)].map((m) => m[1]);
      const counts = new Map<string, number>();
      for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
      for (const [name, count] of counts) {
        expect(count, `${type}: ${name} defined ${count} times`).toBe(1);
      }
    }
  });

  it("uses a port's declared default when it is not set", () => {
    // A transform with a default scale of 1 must not compile as a scale of 0.
    const out = compileDAG(singleNodeDAG('transform'));
    expect(out.wgsl).toMatch(/n0_transform\([^)]*,\s*1(\.0)?,\s*0(\.0)?\)/);
  });

  it('renders a colour port as a vec3 literal', () => {
    const out = compileDAG(singleNodeDAG('solidSource', { color: '#ff5a2c' }));
    expect(out.wgsl).toMatch(/solid_source\(vec3<f32>\(1\.0\d*, 0\.35\d*, 0\.17\d*\)\)/);
  });

  it('reports an edge that matches no output port', () => {
    const out = compileDAG({
      nodes: [node('a', 'proceduralScene'), node('r', 'render')],
      edges: [{ id: 'e1', from: { node: 'a', port: 'nope' }, to: { node: 'r', port: 'input' } }],
    });
    expect(out.errors.join(' ')).toMatch(/does not match any output port/);
  });

  it('survives a malformed document', () => {
    expect(() => compileDAG({} as DAG)).not.toThrow();
    expect(() => compileDAG({ nodes: [], edges: [] } as DAG)).not.toThrow();
  });

  it('applies a look to the node kind it names', () => {
    // A film's shots share one graph; each shot switches its effects on or off.
    const plain = compileDAG(singleNodeDAG('glow'));
    const withLook = compileDAG(singleNodeDAG('glow'), { glow: { intensity: 0.9 } });
    expect(withLook.wgsl).toContain('0.9');
    expect(plain.wgsl).not.toContain('0.9');
  });

  it('leaves the nodes a look does not name alone', () => {
    const out = compileDAG(singleNodeDAG('glow'), { blur: { radius: 0.123 } });
    expect(out.wgsl).not.toContain('0.123');
  });
});

describe('code <-> graph', () => {
  it('round-trips a graph through the generated code', () => {
    // The Script editor is a two-way bridge: the code the user sees must parse
    // back into the same graph, edges included.
    const dag = sceneDAG();
    const parsed = codeToDAG(dagToCode(dag));
    expect(parsed).not.toBeNull();
    expect(parsed?.nodes.map((n) => n.type)).toEqual(['proceduralScene', 'render']);
    expect(parsed?.edges).toHaveLength(1);
    expect(parsed?.edges[0].from.node).toBe(dag.nodes[0].id);
    expect(parsed?.edges[0].to.node).toBe(dag.nodes[1].id);
  });

  it('keeps the node ids, so the edges still resolve', () => {
    const dag = sceneDAG();
    const parsed = codeToDAG(dagToCode(dag));
    expect(parsed?.nodes.map((n) => n.id)).toEqual(['p1', 'r1']);
  });

  it('drops an edge that points at a node that is not there', () => {
    const code = dagToCode(sceneDAG()).replace('"p1"', '"missing"');
    const parsed = codeToDAG(code);
    expect(parsed?.edges).toHaveLength(0);
  });

  it('returns null for code that is not a graph', () => {
    expect(codeToDAG('const x = 1;')).toBeNull();
    expect(codeToDAG('export const nodeGraph = { oops')).toBeNull();
  });
});
