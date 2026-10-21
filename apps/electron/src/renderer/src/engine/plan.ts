// ── Plan to editor ───────────────────────────────────────────────────────────
// The editor's half of the seam: take the shared graph IR and the timeline the
// plan compiled into, and turn them into what this app holds.
//
// The IR is deliberately not the editor's own graph type. The IR is versioned
// and shared, so the engines and the editor can both target it; the editor's
// graph is the working shape its compiler and canvas understand. The
// translation is here, in one place, so the two can differ without either
// one leaking into the other.

import type { CreativeGraph, TimelineItem } from '@printsync/creative-graph';
import type { DAG, Edge, NodeInstance, TimelineClip, TimelineDoc } from './types';

/** Convert the shared graph IR into the editor's graph. */
export function graphToDAG(graph: CreativeGraph): DAG {
  const nodes: NodeInstance[] = graph.nodes.map((node) => ({
    id: node.id,
    type: node.kind,
    position: node.position ?? { x: 120, y: 120 },
    inputs: node.params ?? {},
    outputs: {},
    ...(node.code ? { code: node.code } : {}),
  }));
  const edges: Edge[] = graph.connections.map((connection, i) => ({
    id: `edge-${i}`,
    from: { node: connection.from.node, port: connection.from.port },
    to: { node: connection.to.node, port: connection.to.port },
  }));
  return { nodes, edges };
}

/** Convert the shared timeline into the editor's timeline. */
export function timelineToDoc(items: TimelineItem[], duration: number): TimelineDoc {
  const clips: TimelineClip[] = items.map((item) => ({
    id: item.id,
    trackId: item.trackId,
    start: item.start,
    end: item.end,
    name: item.name,
    keyframes: [],
    ...(item.mediaId ? { mediaId: item.mediaId } : {}),
    ...(item.sourceStart !== undefined ? { sourceStart: item.sourceStart } : {}),
    ...(item.look ? { look: item.look } : {}),
  }));
  return { duration, clips };
}
