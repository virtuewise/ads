// ── Graph analysis ───────────────────────────────────────────────────────────
// The part of the compiler that does not care what a node *does*: what a node
// depends on, whether the graph is acyclic, and whether it is well formed.
//
// The rules the graph must satisfy:
//   1. Type safety — a port may only be connected to a compatible port.
//   2. Dependency correctness — no cycles, except in an explicitly supported
//      feedback system.
//   3. Determinism — the same graph produces the same plan.
//   4. Time semantics — a plan is evaluated against one timebase.
//   5. Resource planning — the plan says which nodes need a GPU pass.
//   6. Validation — an invalid graph fails here, before anything expensive
//      runs, with an error that says what to do about it.

import type { CreativeGraph, GraphConnection, GraphNode } from './graph';
import { canConnect, type ValueType } from './ports';

/** What a node kind is, for the purposes of analysis. */
export interface NodeKindInfo {
  /** The kind's name, e.g. 'blur'. */
  kind: string;
  /** The precise type each input port carries. */
  inputs: Record<string, ValueType>;
  /** The precise type the kind's output carries. */
  output: ValueType;
  /** The kind's output port id, when it is not the usual 'output'. */
  outputPort?: string;
  /** Whether executing the kind needs a GPU pass. */
  gpu: boolean;
  /** Whether the kind is stateful across frames. */
  stateful?: boolean;
}

/** The catalogue a graph is checked against. */
export type NodeCatalog = Record<string, NodeKindInfo>;

/** A problem found in a graph. */
export interface GraphIssue {
  /** A short, stable code, so a test or a tool can match on it. */
  code:
    | 'unknown-kind'
    | 'unknown-port'
    | 'type-mismatch'
    | 'cycle'
    | 'dangling-connection'
    | 'no-output'
    | 'multiple-inputs';
  message: string;
  /** The nodes the issue is about. */
  nodes: string[];
}

/** The result of analysing a graph. */
export interface GraphAnalysis {
  /** The nodes in dependency order: a node comes after everything it reads. */
  order: string[];
  /** What each node depends on. */
  dependencies: Record<string, string[]>;
  /** What depends on each node. */
  dependents: Record<string, string[]>;
  /** The nodes that produce the graph's result. */
  outputs: string[];
  /** Everything wrong with the graph. */
  issues: GraphIssue[];
  /** Whether the graph can be executed. */
  valid: boolean;
  /** Whether the graph needs a GPU to execute. */
  needsGpu: boolean;
  /** Whether the graph carries state across frames. */
  stateful: boolean;
}

/**
 * Analyse a graph against a catalogue of node kinds.
 *
 * The analysis never throws: a broken graph comes back with issues, so a
 * caller can show them all at once.
 */
export function analyzeGraph(graph: CreativeGraph, catalog: NodeCatalog): GraphAnalysis {
  const issues: GraphIssue[] = [];
  const byId = new Map<string, GraphNode>();
  for (const node of graph.nodes) byId.set(node.id, node);

  const dependencies: Record<string, string[]> = {};
  const dependents: Record<string, string[]> = {};
  for (const node of graph.nodes) {
    dependencies[node.id] = [];
    dependents[node.id] = [];
  }

  // Every node's kind must be known.
  for (const node of graph.nodes) {
    if (!catalog[node.kind]) {
      issues.push({
        code: 'unknown-kind',
        message: `The node kind "${node.kind}" is not in the catalogue.`,
        nodes: [node.id],
      });
    }
  }

  // Connections must join two known ports of compatible types.
  for (const connection of graph.connections) {
    const fromNode = byId.get(connection.from.node);
    const toNode = byId.get(connection.to.node);
    if (!fromNode || !toNode) {
      issues.push({
        code: 'dangling-connection',
        message: `A connection points at a node that is not in the graph.`,
        nodes: [connection.from.node, connection.to.node],
      });
      continue;
    }
    const fromKind = catalog[fromNode.kind];
    const toKind = catalog[toNode.kind];

    // The target port has to exist. This is checked independently of the
    // source: an unknown source kind must not hide a bad target port.
    const toType = toKind ? toKind.inputs[connection.to.port] : undefined;
    if (toKind && toType === undefined) {
      issues.push({
        code: 'unknown-port',
        message: `"${toNode.kind}" has no input port "${connection.to.port}".`,
        nodes: [toNode.id],
      });
      continue;
    }
    // The types have to match, when both ends are known.
    if (fromKind && toType !== undefined) {
      const fromType = fromKind.output;
      if (!canConnect(fromType, toType)) {
        issues.push({
          code: 'type-mismatch',
          message: `A ${fromType} cannot be connected to the ${toType} port "${connection.to.port}" of "${toNode.kind}".`,
          nodes: [fromNode.id, toNode.id],
        });
        continue;
      }
    }

    const deps = dependencies[toNode.id] ?? [];
    const dependentsOf = dependents[fromNode.id] ?? [];
    if (!deps.includes(fromNode.id)) {
      deps.push(fromNode.id);
      dependentsOf.push(toNode.id);
      dependencies[toNode.id] = deps;
      dependents[fromNode.id] = dependentsOf;
    }
  }

  // A port may only be fed once: a second connection would silently win.
  const fed = new Map<string, string>();
  for (const connection of graph.connections) {
    const key = `${connection.to.node}:${connection.to.port}`;
    const previous = fed.get(key);
    if (previous !== undefined) {
      issues.push({
        code: 'multiple-inputs',
        message: `The port "${connection.to.port}" is fed by more than one node.`,
        nodes: [previous, connection.from.node],
      });
    } else {
      fed.set(key, connection.from.node);
    }
  }

  // Topological order, with cycles reported rather than hung on.
  const { order, cycles } = topologicalOrder(
    graph.nodes.map((n) => n.id),
    dependencies,
  );
  for (const cycle of cycles) {
    issues.push({
      code: 'cycle',
      message: `These nodes form a loop: ${cycle.join(' → ')}.`,
      nodes: cycle,
    });
  }

  // A graph with no output produces nothing.
  const outputs = graph.nodes.filter((n) => (dependents[n.id] ?? []).length === 0).map((n) => n.id);
  if (outputs.length === 0 && graph.nodes.length > 0) {
    issues.push({
      code: 'no-output',
      message: 'Nothing in this graph produces a result.',
      nodes: [],
    });
  }

  const needsGpu = graph.nodes.some((n) => catalog[n.kind]?.gpu);
  const stateful = graph.nodes.some((n) => catalog[n.kind]?.stateful);

  return {
    order,
    dependencies,
    dependents,
    outputs,
    issues,
    valid: issues.length === 0,
    needsGpu,
    stateful,
  };
}

/**
 * Whether adding a connection would close a loop.
 *
 * The edge `from → to` creates a cycle when `to` can already reach `from`.
 * Checking before the edge is added is what lets an editor refuse the
 * connection rather than accept a graph that cannot be ordered.
 */
export function createsCycle(
  connections: readonly GraphConnection[],
  from: { node: string; port: string },
  to: { node: string; port: string },
): boolean {
  if (from.node === to.node) return true;
  const outgoing = new Map<string, string[]>();
  for (const connection of connections) {
    const list = outgoing.get(connection.from.node);
    if (list) list.push(connection.to.node);
    else outgoing.set(connection.from.node, [connection.to.node]);
  }
  // Walk forward from the target: if the source is reachable, the edge closes
  // a loop.
  const seen = new Set<string>();
  const stack = [to.node];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === from.node) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of outgoing.get(current) ?? []) stack.push(next);
  }
  return false;
}

/**
 * Order the nodes so that a node comes after everything it reads.
 *
 * Returns the order and any cycles it found. Kahn's algorithm, with the
 * nodes that could not be ordered reported as cycles.
 */
export function topologicalOrder(
  ids: string[],
  dependencies: Record<string, string[]>,
): { order: string[]; cycles: string[][] } {
  const remaining = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const id of ids) {
    remaining.set(id, (dependencies[id] ?? []).length);
    dependents.set(id, []);
  }
  for (const id of ids) {
    for (const dep of dependencies[id] ?? []) {
      dependents.get(dep)?.push(id);
    }
  }

  const queue = ids.filter((id) => (remaining.get(id) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    for (const next of dependents.get(id) ?? []) {
      const left = (remaining.get(next) ?? 0) - 1;
      remaining.set(next, left);
      if (left === 0) queue.push(next);
    }
  }

  // Whatever is left is in, or downstream of, a cycle.
  const cycles: string[][] = [];
  const stuck = ids.filter((id) => !order.includes(id));
  if (stuck.length > 0) {
    // Report each cycle as the loop of nodes that depend on each other.
    for (const id of stuck) {
      const loop: string[] = [];
      const seen = new Set<string>();
      let current: string | undefined = id;
      while (current && !seen.has(current)) {
        seen.add(current);
        loop.push(current);
        current = (dependencies[current] ?? []).find((d) => stuck.includes(d));
      }
      if (loop.length > 1 && !cycles.some((c) => c.length === loop.length)) {
        cycles.push(loop.reverse());
      }
    }
  }

  return { order, cycles };
}
