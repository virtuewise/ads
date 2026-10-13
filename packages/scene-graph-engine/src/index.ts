// Scene Graph Engine – builds a rich relational graph from shots
import { Shot, SceneGraph, SceneNode, SceneEdge } from "@printsync/common";

export class SceneGraphEngine {
  /**
   * Build a scene graph with sequential, parallel, and callback relations.
   */
  async buildGraph(shots: Shot[]): Promise<SceneGraph> {
    const nodes: SceneNode[] = shots.map((shot) => ({
      id: shot.id,
      type: 'Shot',
      data: {
        purpose: shot.purpose,
        duration: shot.duration,
        start: shot.start,
        cameraType: shot.camera.type,
        lens: shot.camera.lens,
        hasVFX: Boolean(shot.vfx),
        hasTypography: Boolean(shot.typography),
      },
    }));

    const edges: SceneEdge[] = [];

    // Sequential edges (NEXT)
    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i];
      const to = nodes[i + 1];
      if (!from || !to) continue;
      edges.push({ from: from.id, to: to.id, relation: 'NEXT' });
    }

    // Callback edges (shots with same purpose reference each other)
    const purposeGroups = new Map<string, string[]>();
    for (const shot of shots) {
      const list = purposeGroups.get(shot.purpose);
      if (list) list.push(shot.id);
      else purposeGroups.set(shot.purpose, [shot.id]);
    }
    for (const ids of purposeGroups.values()) {
      if (ids.length > 1) {
        for (let i = 0; i < ids.length - 1; i++) {
          const from = ids[i];
          const to = ids[i + 1];
          if (from && to) edges.push({ from, to, relation: 'CALLBACK' });
        }
      }
    }

    // Visual continuity edges (same camera type)
    const cameraGroups = new Map<string, string[]>();
    for (const shot of shots) {
      const list = cameraGroups.get(shot.camera.type);
      if (list) list.push(shot.id);
      else cameraGroups.set(shot.camera.type, [shot.id]);
    }
    for (const ids of cameraGroups.values()) {
      if (ids.length > 1) {
        for (let i = 0; i < ids.length - 1; i++) {
          const from = ids[i];
          const to = ids[i + 1];
          if (from && to) edges.push({ from, to, relation: 'VISUAL_CONTINUITY' });
        }
      }
    }

    // Hierarchy edges (establishing -> detail)
    const establishing = shots.find(s => s.purpose === 'HOOK' || s.camera.type === 'ESTABLISHING');
    const details = shots.filter(s => s.purpose === 'SOLUTION' || s.purpose === 'BENEFIT');
    if (establishing && details.length > 0) {
      for (const detail of details) {
        edges.push({ from: establishing.id, to: detail.id, relation: 'ESTABLISHES' });
      }
    }

    return { nodes, edges };
  }
}

export default SceneGraphEngine;