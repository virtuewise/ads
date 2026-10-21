// ── Plan to graph ────────────────────────────────────────────────────────────
// The seam that makes the monorepo and the editor one system.
//
// A production plan is the output of the creative engines: a brief becomes a
// script, a storyboard, a list of shots, and plans for motion, effects,
// typography and sound. Until now that plan was data that nothing rendered.
//
// This module compiles a plan into the graph IR and a timeline, so a plan can
// become an editable project. What the renderer cannot express is reported as
// a warning rather than silently dropped: a lossy translation that says
// nothing is worse than one that says what it lost.

import type { ProductionPlan } from '@printsync/common';
import { type CreativeGraph, GRAPH_SCHEMA_VERSION, type GraphNode } from './graph';

/** A shot on the timeline. */
export interface TimelineItem {
  id: string;
  /** The track the item belongs to. */
  trackId: string;
  start: number;
  end: number;
  name: string;
  /** The media the item shows, when it shows imported footage. */
  mediaId?: string;
  /** The in-point within the source, in seconds. */
  sourceStart?: number;
  /**
   * The look for this shot: the parameters of each node kind, keyed by kind.
   *
   * A film does not use one look for its whole length, so the effect nodes the
   * plan asked for are present in the graph and each shot switches on the ones
   * it uses.
   */
  look?: Record<string, Record<string, unknown>>;
}

/**
 * How a planned effect maps onto a node kind.
 *
 * The catalogue is deliberately explicit. An effect with no entry here is
 * reported as a warning, because a plan that quietly loses half its effects
 * is worse than one that says which effects it could not render.
 *
 * `params` are the node's port values when the effect is on; `off` are the
 * values that make the node a no-op, so a shot that does not use the effect
 * still has it in the graph, switched off.
 */
const EFFECT_NODES: Record<
  string,
  { kind: string; params: Record<string, unknown>; off: Record<string, unknown> }
> = {
  glow_pulse: { kind: 'glow', params: { intensity: 1.5 }, off: { intensity: 0 } },
  light_sweep: {
    kind: 'bloom',
    params: { threshold: 0.6, intensity: 2.0 },
    off: { intensity: 0 },
  },
  lens_flare: {
    kind: 'bloom',
    params: { threshold: 0.8, intensity: 0.8 },
    off: { intensity: 0 },
  },
  chromatic_aberration: {
    kind: 'chromaticAberration',
    params: { amount: 0.4 },
    off: { amount: 0 },
  },
  motion_blur: {
    kind: 'motionBlur',
    params: { amount: 0.5, samples: 8 },
    off: { amount: 0 },
  },
  depth_of_field: {
    kind: 'lensBlur',
    params: { radius: 6, blades: 6 },
    off: { radius: 0 },
  },
};

/** The result of compiling a plan. */
export interface PlanCompilation {
  /** The processing chain. */
  graph: CreativeGraph;
  /** One item per shot. */
  timeline: TimelineItem[];
  /**
   * What the plan asked for that the graph does not express. The caller
   * should show these: the plan is not fully realised.
   */
  warnings: string[];
  /** The node kinds the graph needs, so a caller can check its own catalogue. */
  requiredKinds: string[];
}

/**
 * Compile a production plan into a graph and a timeline.
 *
 * The graph is the *look*: a chain from the footage at the playhead, through
 * the planned effects, to the output. The timeline is the *edit*: one item
 * per shot. The two are separate on purpose — the same look applies to every
 * shot, and the plan's effects are a property of the film, not of one cut.
 *
 * **Known limitation:** a shot's own `vfx` is not compiled into a per-shot
 * look. The graph is one chain, so every shot is rendered with the same
 * processing, and a per-shot effect is reported as a warning instead. Making
 * the graph vary by shot needs a per-shot graph, which is a larger change
 * than this mapping.
 */
export function compilePlan(plan: ProductionPlan): PlanCompilation {
  const warnings: string[] = [];
  const nodes: GraphNode[] = [];
  const connections: CreativeGraph['connections'] = [];

  const hasFootage = plan.assets.some((a) => a.type === 'video' || a.type === 'image');
  const sourceKind = hasFootage ? 'mediaSource' : 'proceduralScene';
  nodes.push({
    id: 'source',
    kind: sourceKind,
    position: { x: 120, y: 120 },
    params: {},
  });

  // The planned effects, in the order the plan lists them.
  const usedKinds = new Set<string>();
  let previous = 'source';
  for (const effect of plan.vfx.effects) {
    const mapping = EFFECT_NODES[effect];
    if (!mapping) {
      warnings.push(`The effect "${effect}" has no node in the renderer yet.`);
      continue;
    }
    if (usedKinds.has(mapping.kind)) {
      // One node per kind: two effects that want the same node cannot both
      // have it, and the plan is warned about below.
      continue;
    }
    usedKinds.add(mapping.kind);
    const id = `fx-${nodes.length}`;
    nodes.push({
      id,
      kind: mapping.kind,
      position: { x: 120 + nodes.length * 40, y: 120 },
      params: { ...mapping.params },
    });
    connections.push({
      from: { node: previous, port: 'output' },
      to: { node: id, port: 'input' },
    });
    previous = id;
  }

  // The output.
  nodes.push({
    id: 'output',
    kind: 'render',
    position: { x: 120 + nodes.length * 40, y: 120 },
    params: {},
  });
  connections.push({
    from: { node: previous, port: 'output' },
    to: { node: 'output', port: 'input' },
  });

  // The edit: one item per shot, laid out along the timeline.
  //
  // Each shot carries its own look: the effects it uses are on, the rest are
  // switched off. A film does not use one look for its whole length.
  const shotAssignment = plan.vfx.shotEffects ?? {};
  const timeline: TimelineItem[] = plan.shots.map((shot) => {
    const used = new Set(shotAssignment[shot.id] ?? (shot.vfx ? [shot.vfx] : []));
    const look: Record<string, Record<string, unknown>> = {};
    for (const effect of plan.vfx.effects) {
      const mapping = EFFECT_NODES[effect];
      if (!mapping) continue;
      const on = used.has(effect);
      // Two effects can map to one kind; the first one wins, and the plan is
      // warned about it below.
      if (look[mapping.kind]) continue;
      look[mapping.kind] = on ? { ...mapping.params } : { ...mapping.off };
    }
    return {
      id: `shot-${shot.id}`,
      trackId: 'video',
      start: shot.start,
      end: shot.start + shot.duration,
      name: shot.purpose,
      look,
    };
  });

  // A shot that names an effect the plan did not list is still worth saying.
  for (const shot of plan.shots) {
    if (shot.vfx && !plan.vfx.effects.includes(shot.vfx)) {
      warnings.push(
        `The shot "${shot.purpose}" asks for "${shot.vfx}", which the plan does not list.`,
      );
    }
  }

  // Two effects can want the same node kind. The first one wins, and the plan
  // is told, because the second one is silently dropped otherwise.
  const kinds = new Map<string, string>();
  for (const effect of plan.vfx.effects) {
    const mapping = EFFECT_NODES[effect];
    if (!mapping) continue;
    const previous = kinds.get(mapping.kind);
    if (previous) {
      warnings.push(
        `The effects "${previous}" and "${effect}" both use the "${mapping.kind}" node; only "${previous}" is used.`,
      );
      continue;
    }
    kinds.set(mapping.kind, effect);
  }

  const requiredKinds = [...new Set(nodes.map((n) => n.kind))];

  return {
    graph: {
      schemaVersion: GRAPH_SCHEMA_VERSION,
      nodes,
      connections,
    },
    timeline,
    warnings,
    requiredKinds,
  };
}
