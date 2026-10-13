// Edit Engine – edit decision list generation
import { Shot, EditPlan } from "@printsync/common";

export interface EditDecision {
  time: number; // seconds
  type: 'CUT' | 'DISSOLVE' | 'WIPE' | 'FADE' | 'MATCH_CUT' | 'JUMP_CUT' | 'SMASH_CUT';
  fromShot: string;
  toShot: string;
  duration: number; // transition duration in seconds
  reason: string;
}

export interface EditEngineOptions {
  mode?: string;
  pace?: 'SLOW' | 'MEDIUM' | 'FAST' | 'RHYTHMIC';
}

export class EditEngine {
  /**
   * Generate edit plan from shots.
   */
  async planEdit(shots: Shot[], options: EditEngineOptions = {}): Promise<EditPlan> {
    const { mode = 'EXPLAINER', pace = 'MEDIUM' } = options;
    const cuts: string[] = [];

    // Base cuts at shot boundaries
    for (let i = 0; i < shots.length - 1; i++) {
      const from = shots[i];
      const to = shots[i + 1];
      if (!from || !to) continue;
      const cutTime = from.start + from.duration;

      const decision = this.decideTransition(from, to, pace, mode);
      cuts.push(`${decision.type.toLowerCase()}@${Math.round(cutTime)}s:${from.id}->${to.id}`);
    }

    // Add final cut
    const last = shots[shots.length - 1];
    if (last) {
      cuts.push(`fade_out@${Math.round(last.start + last.duration)}s`);
    }

    return { cuts };
  }

  private decideTransition(from: Shot, to: Shot, pace: string, mode: string): EditDecision {
    const samePurpose = from.purpose === to.purpose;
    const hasVFX = from.vfx || to.vfx;

    // Fast pace = more aggressive cuts
    if (pace === 'FAST' || mode.includes('SALES') || mode.includes('SOCIAL')) {
      return { type: 'SMASH_CUT', duration: 0, reason: 'Fast pace', fromShot: from.id, toShot: to.id, time: 0 };
    }

    // Slow/premium = dissolves
    if (pace === 'SLOW' || mode.includes('CINEMATIC') || mode.includes('BRAND')) {
      if (samePurpose) {
        return { type: 'MATCH_CUT', duration: 0.5, reason: 'Visual continuity', fromShot: from.id, toShot: to.id, time: 0 };
      }
      return { type: 'DISSOLVE', duration: 1.0, reason: 'Premium feel', fromShot: from.id, toShot: to.id, time: 0 };
    }

    // Rhythmic = cut on beat
    if (pace === 'RHYTHMIC' || mode.includes('TYPOGRAPHIC') || mode.includes('MUSIC')) {
      return { type: 'CUT', duration: 0, reason: 'Rhythmic cut', fromShot: from.id, toShot: to.id, time: 0 };
    }

    // VFX transitions
    if (hasVFX) {
      return { type: 'WIPE', duration: 0.5, reason: 'VFX transition', fromShot: from.id, toShot: to.id, time: 0 };
    }

    // Default: clean cut
    return { type: 'CUT', duration: 0, reason: 'Standard', fromShot: from.id, toShot: to.id, time: 0 };
  }

  /** Get all transition types */
  getTransitionTypes(): string[] {
    return ['CUT', 'DISSOLVE', 'WIPE', 'FADE', 'MATCH_CUT', 'JUMP_CUT', 'SMASH_CUT'];
  }
}

export default EditEngine;