import { describe, expect, it } from 'vitest';
import { compileDAG } from './compiler';
import {
  animatedTextStyle,
  appendTextNodesToGraph,
  DEFAULT_TEXT_STYLE,
  rasteriseText,
  removeTextNodesFromGraph,
  textStyleFrom,
} from './text';
import type { DAG, TimelineClip } from './types';

const baseGraph: DAG = {
  nodes: [
    { id: 'scene', type: 'proceduralScene', position: { x: 0, y: 0 }, inputs: {}, outputs: {} },
    { id: 'render', type: 'render', position: { x: 300, y: 0 }, inputs: {}, outputs: {} },
  ],
  edges: [
    {
      id: 'scene-render',
      from: { node: 'scene', port: 'output' },
      to: { node: 'render', port: 'input' },
    },
  ],
};

describe('text layer rendering', () => {
  it('clamps malformed text style values to safe defaults', () => {
    const style = textStyleFrom({
      text: 'Hello',
      size: Number.NaN,
      x: 5,
      opacity: -4,
      align: 'diagonal',
    });
    expect(style).toMatchObject({
      text: 'Hello',
      size: DEFAULT_TEXT_STYLE.size,
      x: 1,
      opacity: 0,
      align: 'center',
    });
  });

  it('samples each animated title property independently', () => {
    const clip: TimelineClip = {
      id: 'title',
      trackId: 'captions',
      start: 0,
      end: 2,
      name: 'Headline',
      textNodeId: 'node',
      keyframes: [
        { id: 'opacity-a', time: 0, property: 'opacity', value: 0, easing: 'linear' },
        { id: 'opacity-b', time: 1, property: 'opacity', value: 1, easing: 'linear' },
        { id: 'scale-a', time: 0, property: 'scale', value: 0.8, easing: 'linear' },
        { id: 'scale-b', time: 1, property: 'scale', value: 1.2, easing: 'linear' },
      ],
    };

    expect(animatedTextStyle(DEFAULT_TEXT_STYLE, clip, 0.5)).toMatchObject({
      opacity: 0.5,
      scale: 1,
      x: DEFAULT_TEXT_STYLE.x,
    });
  });

  it('adds graph-backed title nodes to the render path and removes them cleanly', () => {
    const added = appendTextNodesToGraph(baseGraph, [
      { name: 'Opening', style: { ...DEFAULT_TEXT_STYLE, text: 'A NEW IDEA' } },
      { name: 'CTA', style: { ...DEFAULT_TEXT_STYLE, text: 'START TODAY' } },
    ]);
    const compiled = compileDAG(added.graph);
    expect(compiled.errors).toEqual([]);
    expect(compiled.appTextures && Object.keys(compiled.appTextures)).toHaveLength(2);
    expect(added.graph.edges.find((edge) => edge.to.node === 'render')?.from.node).toBe(
      added.nodeIds[1],
    );

    const removed = removeTextNodesFromGraph(added.graph, new Set(added.nodeIds));
    expect(removed.nodes.map((node) => node.id)).toEqual(['scene', 'render']);
    expect(removed.edges.map(({ from, to }) => ({ from, to }))).toEqual(
      baseGraph.edges.map(({ from, to }) => ({ from, to })),
    );
    expect(compileDAG(removed).errors).toEqual([]);
  });

  it('returns no raster when there is no renderer document', () => {
    expect(rasteriseText(DEFAULT_TEXT_STYLE)).toBeNull();
  });
});
