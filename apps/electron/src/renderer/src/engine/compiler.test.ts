// ── Compiler / bridge tests ──────────────────────────────────────────────────
// The compiler and the bridge are pure functions, so the media-source wiring
// can be pinned without a GPU.

import { describe, expect, it } from 'vitest';
import { bridgeDAGToComposite } from './bridge';
import { compileDAG } from './compiler';
import type { DAG } from './types';

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
    expect(compiled.wgsl).toContain('media_source(uv)');
    expect(compiled.wgsl).toContain('fn media_source(uv: vec2<f32>) -> vec4<f32>');
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
