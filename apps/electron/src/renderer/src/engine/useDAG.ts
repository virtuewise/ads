// ── DAG Store Hook ───────────────────────────────────────────────────────────
// Zustand-style store for the node graph with bidirectional code sync.

import { useCallback, useMemo, useState } from 'react';
import { codeToDAG, compileDAG, dagToCode } from './compiler';
import { createNode, getNodeTypes } from './nodes';
import type { DAG, Edge, NodeInstance } from './types';

let nodeCounter = 0;

function createId(prefix: string) {
  return `${prefix}-${++nodeCounter}`;
}

const DEFAULT_DAG: DAG = {
  nodes: [
    {
      id: 'n1',
      type: 'proceduralScene',
      position: { x: 120, y: 120 },
      inputs: {},
      outputs: {},
    },
    { id: 'n2', type: 'render', position: { x: 440, y: 120 }, inputs: {}, outputs: {} },
  ],
  edges: [{ id: 'e1', from: { node: 'n1', port: 'output' }, to: { node: 'n2', port: 'input' } }],
};

/** The output port a node type publishes. */
function outputPortFor(type: string): string {
  try {
    const inst = createNode(type);
    return inst.ports.find((p) => p.direction === 'output')?.id ?? 'output';
  } catch {
    return 'output';
  }
}

export function useDAG() {
  const [dag, setDAG] = useState<DAG>(DEFAULT_DAG);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  /**
   * The code the user typed, when it differs from what the graph would
   * generate. It is cleared as soon as the graph is edited, so the editor
   * always shows the graph unless the user has taken it over.
   */
  const [codeOverride, setCodeOverride] = useState<string | null>(null);

  // Derived, not stored: a state updater must be pure, and calling
  // `compileDAG` inside one ran the compiler twice per edit and burned an
  // extra edge id.
  const compiled = useMemo(() => compileDAG(dag), [dag]);
  const generatedCode = useMemo(() => dagToCode(dag), [dag]);
  const code = codeOverride ?? generatedCode;

  const addNode = useCallback((type: string, position: { x: number; y: number }) => {
    const node: NodeInstance = {
      id: createId('node'),
      type,
      position,
      inputs: {},
      outputs: {},
    };
    setCodeOverride(null);
    setDAG((prev) => ({ ...prev, nodes: [...prev.nodes, node] }));
    return node.id;
  }, []);

  const removeNode = useCallback((id: string) => {
    setCodeOverride(null);
    setDAG((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== id),
      edges: prev.edges.filter((e) => e.from.node !== id && e.to.node !== id),
    }));
    setSelectedNode((s) => (s === id ? null : s));
  }, []);

  const updateNode = useCallback((id: string, updates: Partial<NodeInstance>) => {
    setCodeOverride(null);
    setDAG((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }));
  }, []);

  const addEdge = useCallback(
    (from: { node: string; port: string }, to: { node: string; port: string }) => {
      setCodeOverride(null);
      setDAG((prev) => {
        const edge: Edge = { id: createId('edge'), from, to };
        return { ...prev, edges: [...prev.edges, edge] };
      });
    },
    [],
  );

  const removeEdge = useCallback((id: string) => {
    setCodeOverride(null);
    setDAG((prev) => ({
      ...prev,
      edges: prev.edges.filter((e) => e.id !== id),
    }));
  }, []);

  /** Point the render node at a specific source node. */
  const setRenderSource = useCallback((nodeId: string) => {
    setCodeOverride(null);
    setDAG((prev) => {
      const render = prev.nodes.find((n) => n.type === 'render');
      if (!render) return prev;
      // The source's own output port: not every node calls it 'output'.
      const source = prev.nodes.find((n) => n.id === nodeId);
      const port = source ? outputPortFor(source.type) : 'output';
      return {
        ...prev,
        edges: [
          ...prev.edges.filter((e) => e.to.node !== render.id),
          {
            id: createId('edge'),
            from: { node: nodeId, port },
            to: { node: render.id, port: 'input' },
          },
        ],
      };
    });
  }, []);

  /**
   * Make sure the graph has a media source and that the render node reads
   * from it. Returns the media node's id.
   */
  const ensureMediaSource = useCallback(() => {
    const existing = dag.nodes.find((n) => n.type === 'mediaSource');
    if (existing) {
      setRenderSource(existing.id);
      return existing.id;
    }
    const id = addNode('mediaSource', { x: 120, y: 300 });
    // Both updates are functional, so the rewire sees the node just added.
    setRenderSource(id);
    return id;
  }, [dag.nodes, addNode, setRenderSource]);

  const syncFromCode = useCallback((newCode: string) => {
    // Keep the user's text (and their comments) in the editor.
    setCodeOverride(newCode);
    const parsed = codeToDAG(newCode);
    if (parsed) setDAG(parsed);
  }, []);

  const resetDAG = useCallback(() => {
    setCodeOverride(null);
    setDAG(DEFAULT_DAG);
    setSelectedNode(null);
  }, []);

  /** Replace the graph wholesale (project load, undo, etc.). */
  const loadDAG = useCallback((next: DAG) => {
    setCodeOverride(null);
    setDAG(next);
    setSelectedNode(null);
  }, []);

  return {
    dag,
    code,
    compiled,
    selectedNode,
    setSelectedNode,
    addNode,
    removeNode,
    updateNode,
    addEdge,
    removeEdge,
    setRenderSource,
    ensureMediaSource,
    syncFromCode,
    resetDAG,
    loadDAG,
    nodeTypes: getNodeTypes(),
  };
}
