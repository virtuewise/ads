import { createNode } from './nodes';
import type { DAG, NodeInstance } from './types';

const EFFECT_MARKER = 'editorEffectNode';

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let suffix = 1;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

/** Remove editor-owned effects while preserving the graph path through them. */
export function removeEditorEffectNodes(graph: DAG): DAG {
  let nodes = [...graph.nodes];
  let edges = [...graph.edges];
  const usedEdges = new Set(edges.map((edge) => edge.id));
  const effectIds = nodes
    .filter((node) => node.inputs[EFFECT_MARKER] === true)
    .map((node) => node.id);

  for (const id of effectIds) {
    const incoming = edges.filter((edge) => edge.to.node === id);
    const outgoing = edges.filter((edge) => edge.from.node === id);
    edges = edges.filter((edge) => edge.from.node !== id && edge.to.node !== id);
    for (const edgeIn of incoming) {
      for (const edgeOut of outgoing) {
        edges.push({
          id: uniqueId(`edge-remove-${id}-${edgeIn.id}-${edgeOut.id}`, usedEdges),
          from: edgeIn.from,
          to: edgeOut.to,
        });
      }
    }
    nodes = nodes.filter((node) => node.id !== id);
  }
  return { nodes, edges };
}

/**
 * Rebuild the editor's ordered effect stack as real shader nodes in the render
 * path. Effects are inserted before editor-authored titles so titles retain
 * their chosen colour and crispness.
 */
export function appendEffectNodesToGraph(
  graph: DAG,
  effectTypes: string[],
): { graph: DAG; nodeIds: string[] } {
  const savedInputs = new Map(
    graph.nodes
      .filter((node) => node.inputs[EFFECT_MARKER] === true)
      .map((node) => [node.type, node.inputs] as const),
  );
  const clean = removeEditorEffectNodes(graph);
  if (effectTypes.length === 0) return { graph: clean, nodeIds: [] };

  const render = clean.nodes.find((node) => node.type === 'render');
  if (!render) throw new Error('The project graph has no Render output node.');
  const renderEdge = clean.edges.find(
    (edge) => edge.to.node === render.id && edge.to.port === 'input',
  );
  if (!renderEdge) throw new Error('Connect a visual source to Render before adding an effect.');

  // Walk the render path backwards to find the first title layer. This also
  // keeps effects ahead of all editor-authored titles when a template has
  // created several consecutive text nodes.
  const path: NodeInstance[] = [];
  const visited = new Set<string>();
  let cursor = renderEdge.from.node;
  while (!visited.has(cursor)) {
    visited.add(cursor);
    const node = clean.nodes.find((item) => item.id === cursor);
    if (!node) break;
    path.push(node);
    const incoming = clean.edges.find(
      (edge) => edge.to.node === cursor && edge.to.port === 'input',
    );
    if (!incoming) break;
    cursor = incoming.from.node;
  }
  const firstTitle = path
    .reverse()
    .find((node) => node.type === 'text' && node.inputs.editorLayer === true);
  const destination = firstTitle
    ? { node: firstTitle.id, port: 'input' }
    : { node: render.id, port: 'input' };
  const insertionEdge = clean.edges.find(
    (edge) => edge.to.node === destination.node && edge.to.port === destination.port,
  );
  if (!insertionEdge) throw new Error('The render path has no effect insertion point.');

  const nodes = [...clean.nodes];
  const edges = clean.edges.filter((edge) => edge.id !== insertionEdge.id);
  const usedNodeIds = new Set(nodes.map((node) => node.id));
  const usedEdgeIds = new Set(edges.map((edge) => edge.id));
  const nodeIds: string[] = [];
  let from = insertionEdge.from;
  const targetPosition = clean.nodes.find((node) => node.id === destination.node)?.position ?? {
    x: 440,
    y: 120,
  };

  for (const [index, type] of effectTypes.entries()) {
    const definition = createNode(type);
    const textureInputs = definition.ports.filter(
      (port) => port.direction === 'input' && port.type === 'texture',
    );
    const textureOutputs = definition.ports.filter(
      (port) => port.direction === 'output' && port.type === 'texture',
    );
    if (textureInputs.length !== 1 || textureOutputs.length !== 1) {
      throw new Error(`“${definition.label}” cannot be placed in the single-image effect stack.`);
    }

    const id = uniqueId(
      `editor-effect-${type}-${Date.now().toString(36)}-${index + 1}`,
      usedNodeIds,
    );
    const defaults = Object.fromEntries(
      definition.ports
        .filter(
          (port) =>
            port.direction === 'input' && port.type !== 'texture' && port.default !== undefined,
        )
        .map((port) => [port.id, port.default]),
    );
    const previousInputs = savedInputs.get(type) ?? {};
    const inputs = {
      ...defaults,
      ...Object.fromEntries(
        definition.ports
          .filter(
            (port) =>
              port.direction === 'input' && port.type !== 'texture' && port.id in previousInputs,
          )
          .map((port) => [port.id, previousInputs[port.id]]),
      ),
    };
    const node: NodeInstance = {
      id,
      type,
      position: { x: targetPosition.x - (effectTypes.length - index) * 220, y: targetPosition.y },
      inputs: { ...inputs, [EFFECT_MARKER]: true },
      outputs: {},
    };
    nodes.push(node);
    edges.push({
      id: uniqueId(`edge-${id}-in`, usedEdgeIds),
      from,
      to: { node: id, port: textureInputs[0].id },
    });
    nodeIds.push(id);
    from = { node: id, port: textureOutputs[0].id };
  }

  edges.push({
    id: uniqueId(`edge-${nodeIds.at(-1)}-out`, usedEdgeIds),
    from,
    to: destination,
  });
  return { graph: { nodes, edges }, nodeIds };
}
