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
}

/**
 * How a planned effect maps onto a node kind.
 *
 * The catalogue is deliberately explicit. An effect with no entry here is
 * reported as a warning, because a plan that quietly loses half its effects
 * is worse than one that says which effects it could not render.
 */
const EFFECT_NODES: Record<string, { kind: string; params?: Record<string, unknown> }> = {
  glow_pulse: { kind: 'glow', params: { intensity: 1.5 } },
  light_sweep: { kind: 'bloom', params: { threshold: 0.6, intensity: 2.0 } },
  lens_flare: { kind: 'bloom', params: { threshold: 0.8, intensity: 0.8 } },
  chromatic_aberration: { kind: 'chromaticAberration', params: { amount: 0.4 } },
  motion_blur: { kind: 'motionBlur', params: { amount: 0.5, samples: 8 } },
  depth_of_field: { kind: 'lensBlur', params: { radius: 6, blades: 6 } },
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
  let previous = 'source';
  for (const effect of plan.vfx.effects) {
    const mapping = EFFECT_NODES[effect];
    if (!mapping) {
      warnings.push(`The effect "${effect}" has no node in the renderer yet.`);
      continue;
    }
    const id = `fx-${nodes.length}`;
    nodes.push({
      id,
      kind: mapping.kind,
      position: { x: 120 + nodes.length * 40, y: 120 },
      params: { ...(mapping.params ?? {}) },
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
  const timeline: TimelineItem[] = plan.shots.map((shot) => ({
    id: `shot-${shot.id}`,
    trackId: 'video',
    start: shot.start,
    end: shot.start + shot.duration,
    name: shot.purpose,
  }));

  // A shot that names an effect the plan did not list is still worth saying.
  for (const shot of plan.shots) {
    if (shot.vfx && !plan.vfx.effects.includes(shot.vfx)) {
      warnings.push(
        `The shot "${shot.purpose}" asks for "${shot.vfx}", which the plan does not list.`,
      );
    }
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
