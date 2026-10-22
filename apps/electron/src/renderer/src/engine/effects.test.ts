import { describe, expect, it } from 'vitest';
import { compileDAG } from './compiler';
import { appendEffectNodesToGraph, removeEditorEffectNodes } from './effects';
import type { DAG } from './types';

const graph: DAG = {
  nodes: [
    { id: 'scene', type: 'proceduralScene', position: { x: 0, y: 0 }, inputs: {}, outputs: {} },
    {
      id: 'title',
      type: 'text',
      position: { x: 440, y: 0 },
      inputs: { editorLayer: true, text: 'TITLE' },
      outputs: {},
    },
    { id: 'render', type: 'render', position: { x: 680, y: 0 }, inputs: {}, outputs: {} },
  ],
  edges: [
    {
      id: 'scene-title',
      from: { node: 'scene', port: 'output' },
      to: { node: 'title', port: 'input' },
    },
    {
      id: 'title-render',
      from: { node: 'title', port: 'output' },
      to: { node: 'render', port: 'input' },
    },
  ],
};

describe('editor effect stack', () => {
  it('inserts ordered real shader nodes before authored titles', () => {
    const result = appendEffectNodesToGraph(graph, ['glow', 'vignette']);
    const glow = result.graph.nodes.find((node) => node.type === 'glow');
    const vignette = result.graph.nodes.find((node) => node.type === 'vignette');

    expect(result.nodeIds).toHaveLength(2);
    expect(glow?.inputs).toMatchObject({ editorEffectNode: true, intensity: 0.5 });
    expect(vignette?.inputs).toMatchObject({
      editorEffectNode: true,
      intensity: 0.3,
      softness: 0.5,
    });
    expect(result.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: { node: 'scene', port: 'output' },
          to: { node: glow?.id, port: 'input' },
        }),
        expect.objectContaining({
          from: { node: glow?.id, port: 'output' },
          to: { node: vignette?.id, port: 'input' },
        }),
        expect.objectContaining({
          from: { node: vignette?.id, port: 'output' },
          to: { node: 'title', port: 'input' },
        }),
      ]),
    );
    expect(compileDAG(result.graph).errors).toEqual([]);
  });

  it('rebuilds the stack without duplicating editor nodes and restores the original path', () => {
    const first = appendEffectNodesToGraph(graph, ['blur', 'glow']).graph;
    const rebuilt = appendEffectNodesToGraph(first, ['vignette']).graph;
    expect(
      rebuilt.nodes
        .filter((node) => node.inputs.editorEffectNode === true)
        .map((node) => node.type),
    ).toEqual(['vignette']);

    const restored = removeEditorEffectNodes(rebuilt);
    expect(restored.nodes.some((node) => node.inputs.editorEffectNode === true)).toBe(false);
    expect(restored.edges).toContainEqual({
      id: expect.any(String),
      from: { node: 'scene', port: 'output' },
      to: { node: 'title', port: 'input' },
    });
    expect(compileDAG(restored).errors).toEqual([]);
  });

  it('preserves user-edited parameters when the stack is reordered', () => {
    const first = appendEffectNodesToGraph(graph, ['glow', 'vignette']).graph;
    const edited: DAG = {
      ...first,
      nodes: first.nodes.map((node) =>
        node.type === 'glow' ? { ...node, inputs: { ...node.inputs, intensity: 1.25 } } : node,
      ),
    };
    const reordered = appendEffectNodesToGraph(edited, ['vignette', 'glow']).graph;
    const glow = reordered.nodes.find((node) => node.type === 'glow');

    expect(glow?.inputs.intensity).toBe(1.25);
    expect(compileDAG(reordered).errors).toEqual([]);
  });
});
