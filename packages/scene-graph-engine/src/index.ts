// Scene Graph Engine – builds a simple sequential graph from shots
import { Shot, SceneGraph, SceneNode, SceneEdge } from "@printsync/common";

export class SceneGraphEngine {
  /**
   * Build a scene graph where each shot is a node linked sequentially.
   */
  async buildGraph(shots: Shot[]): Promise<SceneGraph> {
    const nodes: SceneNode[] = shots.map((shot) => ({
      id: shot.id,
      type: "Shot",
      data: { purpose: shot.purpose, duration: shot.duration },
    }));
    const edges: SceneEdge[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i];
      const to = nodes[i + 1];
      if (!from || !to) continue;
      edges.push({ from: from.id, to: to.id, relation: "NEXT" });
    }
    return { nodes, edges };
  }
}

export default SceneGraphEngine;
