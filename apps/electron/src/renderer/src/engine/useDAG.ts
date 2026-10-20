// ── DAG Store Hook ───────────────────────────────────────────────────────────
// Zustand-style store for the node graph with bidirectional code sync.

import { useCallback, useState } from 'react';
import { codeToDAG, compileDAG, dagToCode } from './compiler';
import { getNodeTypes } from './nodes';
import type { DAG, Edge, NodeInstance } from './types';

let nodeCounter = 0;
const _edgeCounter = 0;

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

export function useDAG() {
  const [dag, setDAG] = useState<DAG>(DEFAULT_DAG);
  const [code, setCode] = useState(() => dagToCode(DEFAULT_DAG));
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [compiled, setCompiled] = useState(() => compileDAG(DEFAULT_DAG));

  const addNode = useCallback((type: string, position: { x: number; y: number }) => {
    const node: NodeInstance = {
      id: createId('node'),
      type,
      position,
      inputs: {},
      outputs: {},
    };
    setDAG((prev) => {
      const next = { ...prev, nodes: [...prev.nodes, node] };
      setCompiled(compileDAG(next));
      setCode(dagToCode(next));
      return next;
    });
    return node.id;
  }, []);

  const removeNode = useCallback((id: string) => {
    setDAG((prev) => {
      const next = {
        nodes: prev.nodes.filter((n) => n.id !== id),
        edges: prev.edges.filter((e) => e.from.node !== id && e.to.node !== id),
      };
      setCompiled(compileDAG(next));
      setCode(dagToCode(next));
      return next;
    });
    setSelectedNode((s) => (s === id ? null : s));
  }, []);

  const updateNode = useCallback((id: string, updates: Partial<NodeInstance>) => {
    setDAG((prev) => {
      const next = {
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
      };
      setCompiled(compileDAG(next));
      setCode(dagToCode(next));
      return next;
    });
  }, []);

  const addEdge = useCallback(
    (from: { node: string; port: string }, to: { node: string; port: string }) => {
      setDAG((prev) => {
        const edge: Edge = { id: createId('edge'), from, to };
        const next = { ...prev, edges: [...prev.edges, edge] };
        setCompiled(compileDAG(next));
        setCode(dagToCode(next));
        return next;
      });
    },
    [],
  );

  const removeEdge = useCallback((id: string) => {
    setDAG((prev) => {
      const next = { ...prev, edges: prev.edges.filter((e) => e.id !== id) };
      setCompiled(compileDAG(next));
      setCode(dagToCode(next));
      return next;
    });
  }, []);

  const syncFromCode = useCallback((newCode: string) => {
    setCode(newCode);
    const parsed = codeToDAG(newCode);
    if (parsed) {
      setDAG(parsed);
      setCompiled(compileDAG(parsed));
    }
  }, []);

  const resetDAG = useCallback(() => {
    setDAG(DEFAULT_DAG);
    setCode(dagToCode(DEFAULT_DAG));
    setCompiled(compileDAG(DEFAULT_DAG));
    setSelectedNode(null);
  }, []);

  /** Replace the graph wholesale (project load, undo, etc.). */
  const loadDAG = useCallback((next: DAG) => {
    setDAG(next);
    setCode(dagToCode(next));
    setCompiled(compileDAG(next));
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
    syncFromCode,
    resetDAG,
    loadDAG,
    nodeTypes: getNodeTypes(),
  };
}
