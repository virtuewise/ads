import { describe, expect, it } from 'vitest';
import type { NodeCatalog } from './analyze';
import {
  analyzeGraph,
  canConnect,
  compilePlan,
  GRAPH_SCHEMA_VERSION,
  validateCreativeGraph,
} from './index';

type Plan = Parameters<typeof compilePlan>[0];

const CATALOG: NodeCatalog = {
  mediaSource: { kind: 'mediaSource', inputs: {}, output: 'color', gpu: true },
  proceduralScene: { kind: 'proceduralScene', inputs: {}, output: 'color', gpu: true },
  blur: { kind: 'blur', inputs: { input: 'image' }, output: 'color', gpu: true },
  glow: { kind: 'glow', inputs: { input: 'color' }, output: 'color', gpu: true },
  render: { kind: 'render', inputs: { input: 'color' }, output: 'color', gpu: true },
  numberSource: { kind: 'numberSource', inputs: {}, output: 'number', gpu: false },
};

describe('connection rules', () => {
  it('allows a colour into a colour', () => {
    expect(canConnect('color', 'color')).toBe(true);
  });

  it('refuses an image where a value is expected', () => {
    // A sampled texture is not a value: it has to be sampled by the node that
    // takes it. Wiring one into a colour slot produces a WGSL type error.
    expect(canConnect('image', 'color')).toBe(false);
    expect(canConnect('image', 'number')).toBe(false);
  });

  it('refuses a number where a colour is expected', () => {
    expect(canConnect('number', 'color')).toBe(false);
  });

  it('allows numbers and booleans to be interchanged', () => {
    expect(canConnect('number', 'boolean')).toBe(true);
    expect(canConnect('boolean', 'number')).toBe(true);
  });

  it('allows a colour to be sampled', () => {
    // Every node's output is a rendered image, and a 1x1 image is a colour.
    // This is what lets a blur follow a glow.
    expect(canConnect('color', 'image')).toBe(true);
  });
});

describe('analyzeGraph', () => {
  it('orders the nodes so a node comes after what it reads', () => {
    const analysis = analyzeGraph(
      {
        schemaVersion: GRAPH_SCHEMA_VERSION,
        nodes: [
          { id: 'render', kind: 'render', params: {} },
          { id: 'src', kind: 'mediaSource', params: {} },
        ],
        connections: [
          { from: { node: 'src', port: 'output' }, to: { node: 'render', port: 'input' } },
        ],
      },
      CATALOG,
    );
    expect(analysis.valid).toBe(true);
    expect(analysis.order).toEqual(['src', 'render']);
    expect(analysis.outputs).toEqual(['render']);
  });

  it('reports a type mismatch instead of accepting it', () => {
    const analysis = analyzeGraph(
      {
        schemaVersion: GRAPH_SCHEMA_VERSION,
        nodes: [
          { id: 'n', kind: 'numberSource', params: {} },
          { id: 'r', kind: 'render', params: {} },
        ],
        connections: [{ from: { node: 'n', port: 'output' }, to: { node: 'r', port: 'input' } }],
      },
      CATALOG,
    );
    expect(analysis.valid).toBe(false);
    expect(analysis.issues[0]?.code).toBe('type-mismatch');
  });

  it('reports a cycle', () => {
    // Two colour-in, colour-out nodes wired into each other: the types are
    // fine, so the loop is what makes the graph invalid.
    const analysis = analyzeGraph(
      {
        schemaVersion: GRAPH_SCHEMA_VERSION,
        nodes: [
          { id: 'a', kind: 'glow', params: {} },
          { id: 'b', kind: 'glow', params: {} },
        ],
        connections: [
          { from: { node: 'a', port: 'output' }, to: { node: 'b', port: 'input' } },
          { from: { node: 'b', port: 'output' }, to: { node: 'a', port: 'input' } },
        ],
      },
      CATALOG,
    );
    expect(analysis.valid).toBe(false);
    expect(analysis.issues.some((i) => i.code === 'cycle')).toBe(true);
  });

  it('reports an unknown kind and an unknown port', () => {
    const analysis = analyzeGraph(
      {
        schemaVersion: GRAPH_SCHEMA_VERSION,
        nodes: [
          { id: 'a', kind: 'notAThing', params: {} },
          { id: 'b', kind: 'render', params: {} },
        ],
        connections: [{ from: { node: 'a', port: 'output' }, to: { node: 'b', port: 'nope' } }],
      },
      CATALOG,
    );
    const codes = analysis.issues.map((i) => i.code);
    expect(codes).toContain('unknown-kind');
    expect(codes).toContain('unknown-port');
  });

  it('reports a port that is fed twice', () => {
    const analysis = analyzeGraph(
      {
        schemaVersion: GRAPH_SCHEMA_VERSION,
        nodes: [
          { id: 'a', kind: 'mediaSource', params: {} },
          { id: 'b', kind: 'mediaSource', params: {} },
          { id: 'r', kind: 'render', params: {} },
        ],
        connections: [
          { from: { node: 'a', port: 'output' }, to: { node: 'r', port: 'input' } },
          { from: { node: 'b', port: 'output' }, to: { node: 'r', port: 'input' } },
        ],
      },
      CATALOG,
    );
    expect(analysis.issues.some((i) => i.code === 'multiple-inputs')).toBe(true);
  });

  it('says whether the graph needs a GPU', () => {
    const gpu = analyzeGraph(
      {
        schemaVersion: GRAPH_SCHEMA_VERSION,
        nodes: [{ id: 'n', kind: 'numberSource', params: {} }],
        connections: [],
      },
      CATALOG,
    );
    expect(gpu.needsGpu).toBe(false);
  });
});

describe('validateCreativeGraph', () => {
  it('accepts a well formed graph', () => {
    const graph = validateCreativeGraph({
      schemaVersion: GRAPH_SCHEMA_VERSION,
      nodes: [{ id: 'a', kind: 'mediaSource' }],
      connections: [],
    });
    expect(graph.nodes[0]?.params).toEqual({});
  });

  it('refuses a graph with no nodes array', () => {
    expect(() => validateCreativeGraph({ schemaVersion: 1 })).toThrow();
  });
});

describe('compilePlan', () => {
  it('turns a plan into a graph and a timeline', () => {
    const plan = makePlan();
    const result = compilePlan(plan as unknown as Plan);
    expect(result.graph.schemaVersion).toBe(GRAPH_SCHEMA_VERSION);
    expect(result.graph.nodes.length).toBeGreaterThan(1);
    // One item per shot.
    expect(result.timeline).toHaveLength(2);
    expect(result.timeline[0]?.start).toBe(0);
    expect(result.timeline[0]?.end).toBe(4);
  });

  it('warns about the effects it cannot express', () => {
    const plan = makePlan();
    const result = compilePlan(plan as unknown as Plan);
    expect(result.warnings.some((w) => w.includes('particle_burst'))).toBe(true);
    // The effect it can express became a node.
    expect(result.requiredKinds).toContain('glow');
  });

  it('compiles a graph that analyses cleanly against the renderer catalogue', () => {
    const plan = makePlan();
    const result = compilePlan(plan as unknown as Plan);
    const analysis = analyzeGraph(result.graph, CATALOG);
    expect(analysis.issues.map((i) => i.code)).not.toContain('type-mismatch');
  });

  it('gives each shot its own look', () => {
    // The effect the shot uses is on; the others are switched off, so the
    // shots of one film do not all look the same.
    const plan = makePlan();
    plan.vfx.shotEffects = { s1: ['glow_pulse'], s2: [] };
    const result = compilePlan(plan as unknown as Plan);

    const first = result.timeline[0]?.look ?? {};
    const second = result.timeline[1]?.look ?? {};
    expect(first.glow?.intensity).toBe(1.5);
    expect(second.glow?.intensity).toBe(0);
  });

  it('falls back to the effect the shot names when the plan has no assignment', () => {
    const plan = makePlan();
    delete plan.vfx.shotEffects;
    const shot = plan.shots[1];
    if (shot) shot.vfx = 'glow_pulse';
    const result = compilePlan(plan as unknown as Plan);
    expect(result.timeline[1]?.look?.glow?.intensity).toBe(1.5);
  });

  it('warns when two effects want the same node', () => {
    const plan = makePlan();
    plan.vfx.effects = ['light_sweep', 'lens_flare'];
    const result = compilePlan(plan as unknown as Plan);
    expect(result.warnings.some((w) => w.includes('bloom'))).toBe(true);
  });
});

/** A plan, shaped loosely: the compiler takes a validated one. */
interface TestPlan {
  shots: Array<{
    id: string;
    start: number;
    duration: number;
    purpose: string;
    camera: Record<string, unknown>;
    vfx?: string;
  }>;
  vfx: { effects: string[]; shotEffects?: Record<string, string[]> };
  assets: Array<{ type: string; url: string }>;
}

function makePlan(): TestPlan {
  return {
    brief: {},
    script: {},
    storyboard: {},
    shots: [
      { id: 's1', start: 0, duration: 4, purpose: 'HOOK', camera: {} },
      { id: 's2', start: 4, duration: 3, purpose: 'SOLUTION', camera: {} },
    ],
    assets: [{ type: 'video', url: 'https://example.test/a.mp4' }],
    typography: {},
    motion: {},
    vfx: { effects: ['glow_pulse', 'particle_burst'] },
    audio: {},
    edit: {},
    qa: {},
    output: {},
    visualGrammar: {},
    sceneGraph: {},
    productionStatus: 'PLANNING',
  } as unknown as TestPlan;
}
