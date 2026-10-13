// VFX Engine – visual effects planning
import { Shot, VFXPlan } from "@printsync/common";

export interface VFXEffect {
  id: string;
  name: string;
  category: 'TRANSITION' | 'PARTICLE' | 'LIGHTING' | 'DISTORTION' | 'COMPOSITING' | '3D';
  parameters: Record<string, unknown>;
  compatiblePurposes: string[];
}

export const VFX_EFFECTS: Record<string, VFXEffect> = {
  transition_reveal: {
    id: 'transition_reveal',
    name: 'Transition Reveal',
    category: 'TRANSITION',
    parameters: { duration: 0.5, style: 'iris' },
    compatiblePurposes: ['SOLUTION', 'TRANSITION'],
  },
  transition_wipe: {
    id: 'transition_wipe',
    name: 'Graphic Wipe',
    category: 'TRANSITION',
    parameters: { duration: 0.4, direction: 'horizontal' },
    compatiblePurposes: ['PROBLEM', 'SOLUTION'],
  },
  particle_burst: {
    id: 'particle_burst',
    name: 'Particle Burst',
    category: 'PARTICLE',
    parameters: { count: 200, color: '#C8001C', lifespan: 1.0 },
    compatiblePurposes: ['SOLUTION', 'CTA', 'REVEAL'],
  },
  particle_trail: {
    id: 'particle_trail',
    name: 'Particle Trail',
    category: 'PARTICLE',
    parameters: { count: 50, color: '#00A8E0', lifespan: 0.5 },
    compatiblePurposes: ['TRACKING', 'MOVEMENT'],
  },
  light_sweep: {
    id: 'light_sweep',
    name: 'Light Sweep',
    category: 'LIGHTING',
    parameters: { color: '#FFFFFF', intensity: 2.0, width: 0.3 },
    compatiblePurposes: ['HOOK', 'CTA', 'BRAND'],
  },
  glow_pulse: {
    id: 'glow_pulse',
    name: 'Glow Pulse',
    category: 'LIGHTING',
    parameters: { color: '#C8001C', frequency: 1.0, intensity: 1.5 },
    compatiblePurposes: ['BRAND', 'CTA'],
  },
  lens_flare: {
    id: 'lens_flare',
    name: 'Lens Flare',
    category: 'LIGHTING',
    parameters: { intensity: 0.8, color: '#FFF1D6' },
    compatiblePurposes: ['ESTABLISHING', 'HERO'],
  },
  chromatic_aberration: {
    id: 'chromatic_aberration',
    name: 'Chromatic Aberration',
    category: 'DISTORTION',
    parameters: { amount: 0.02, animated: true },
    compatiblePurposes: ['TRANSITION', 'DIGITAL'],
  },
  glitch: {
    id: 'glitch',
    name: 'Digital Glitch',
    category: 'DISTORTION',
    parameters: { intensity: 0.3, frequency: 5 },
    compatiblePurposes: ['DETECTIVE', 'TECHNICAL', 'TRANSITION'],
  },
  depth_of_field: {
    id: 'depth_of_field',
    name: 'Depth of Field Pull',
    category: 'COMPOSITING',
    parameters: { focusDistance: [2, 10], duration: 1.0 },
    compatiblePurposes: ['CLOSE_UP', 'REVEAL'],
  },
  motion_blur: {
    id: 'motion_blur',
    name: 'Motion Blur',
    category: 'COMPOSITING',
    parameters: { shutterAngle: 180, samples: 16 },
    compatiblePurposes: ['TRACKING', 'FAST_MOVEMENT'],
  },
};

export interface VFXEngineOptions {
  mode?: string;
  budget?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class VFXEngine {
  /**
   * Plan VFX effects for shots.
   */
  async planVFX(shots: Shot[], options: VFXEngineOptions = {}): Promise<VFXPlan> {
    const { budget = 'MEDIUM' } = options;
    const effects = new Set<string>();

    for (const shot of shots) {
      // Use shot.vfx if specified
      if (shot.vfx && VFX_EFFECTS[shot.vfx]) {
        effects.add(shot.vfx);
        continue;
      }

      // Auto-assign based on purpose and camera
      const candidates = Object.entries(VFX_EFFECTS)
        .filter(([_, effect]) => effect.compatiblePurposes.includes(shot.purpose))
        .sort((a, b) => b[1].compatiblePurposes.length - a[1].compatiblePurposes.length);

      if (candidates.length > 0) {
        // Budget filtering
        const maxEffects = budget === 'LOW' ? 1 : budget === 'MEDIUM' ? 2 : 3;
        for (let i = 0; i < Math.min(maxEffects, candidates.length); i++) {
          const candidate = candidates[i];
          if (candidate) effects.add(candidate[0]);
        }
      }
    }

    // Mode-specific additions
    const mode = options.mode || '';
    if (mode.includes('VFX') || mode.includes('VFX_EXPERIMENT')) {
      effects.add('glitch');
      effects.add('chromatic_aberration');
    }
    if (mode.includes('3D')) {
      effects.add('depth_of_field');
      effects.add('motion_blur');
    }

    return { effects: Array.from(effects) };
  }

  getEffect(id: string): VFXEffect | undefined {
    return VFX_EFFECTS[id];
  }

  getAllEffects(): VFXEffect[] {
    return Object.values(VFX_EFFECTS);
  }
}

export default VFXEngine;