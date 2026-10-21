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
 *
 * **Only the effects the single-pass compositor can run are here.** An effect
 * that samples its input — a blur, a bloom, a chromatic aberration — needs
 * the multi-pass runtime, and is reported rather than mapped: a graph the
 * compositor refuses falls back to the flat composite shader, so the plan's
 * effects would silently not happen.
 */
const EFFECT_NODES: Record<
  string,
  { kind: string; params: Record<string, unknown>; off: Record<string, unknown> }
> = {
  glow_pulse: { kind: 'glow', params: { intensity: 1.5 }, off: { intensity: 0 } },
};

/**
 * The effects that need the multi-pass runtime: they sample their input, so
 * each one is a render pass of its own.
 */
const MULTI_PASS_EFFECTS = new Set([
  'light_sweep',
  'lens_flare',
  'chromatic_aberration',
  'motion_blur',
  'depth_of_field',
  'transition_reveal',
  'transition_wipe',
  'particle_burst',
  'particle_trail',
  'glitch',
]);

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
      warnings.push(
        MULTI_PASS_EFFECTS.has(effect)
          ? `The effect "${effect}" samples the picture, so it needs the multi-pass compositor. It is not in this render.`
          : `The effect "${effect}" has no node in the renderer yet.`,
      );
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

  // The grade stage. Every shot gets one, and the film's shots are matched
  // against a reference by setting these parameters per shot.
  nodes.push({
    id: 'grade',
    kind: 'oklabGrade',
    position: { x: 120 + nodes.length * 40, y: 120 },
    params: { exposure: 0, contrast: 1, saturation: 1, hue: 0 },
  });
  connections.push({
    from: { node: previous, port: 'output' },
    to: { node: 'grade', port: 'input' },
  });
  previous = 'grade';

  // The titles. The script's on-screen text becomes a title over the picture.
  // The editor draws it — the GPU has no font — and the renderer follows the
  // script's timing.
  //
  // The title goes on *after* the grade: the picture is graded to match the
  // rest of the film, and the title keeps the colour it was set in. That is
  // how a title is added in a real edit.
  const titled = (plan.script?.steps ?? []).filter((s) => s.text);
  if (titled.length > 0) {
    const first = titled[0];
    nodes.push({
      id: 'title',
      kind: 'text',
      position: { x: 120 + nodes.length * 40, y: 120 },
      params: {
        text: first?.text ?? '',
        size: 96,
        x: 0.5,
        y: 0.12,
        colour: '#ffffff',
      },
    });
    connections.push({
      from: { node: previous, port: 'output' },
      to: { node: 'title', port: 'input' },
    });
    previous = 'title';
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
    // The grade stage starts neutral; the renderer matches the shots.
    look.oklabGrade = { exposure: 0, contrast: 1, saturation: 1, hue: 0 };
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
