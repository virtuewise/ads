// Typography Engine – kinetic typography planning and presets
import type { Shot, TypographyPlan } from '@printsync/common';

export interface TypographyPreset {
  id: string;
  name: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number; // relative
  lineHeight: number;
  letterSpacing: number;
  color: string;
  animation:
    | 'KINETIC_TITLE'
    | 'KINETIC_CTA'
    | 'KINETIC_BODY'
    | 'KINETIC_DATA'
    | 'TYPEWRITER'
    | 'SCRAMBLE'
    | 'FADE_UP'
    | 'SLIDE_IN';
  animationDuration: number; // seconds
  stagger: number; // per character/word
}

export const TYPOGRAPHY_PRESETS: Record<string, TypographyPreset> = {
  KINETIC_TITLE: {
    id: 'KINETIC_TITLE',
    name: 'Kinetic Title',
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 900,
    fontSize: 1.0,
    lineHeight: 1.05,
    letterSpacing: -0.02,
    color: '#FFFFFF',
    animation: 'KINETIC_TITLE',
    animationDuration: 1.2,
    stagger: 0.04,
  },
  KINETIC_CTA: {
    id: 'KINETIC_CTA',
    name: 'Kinetic CTA',
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 700,
    fontSize: 0.7,
    lineHeight: 1.2,
    letterSpacing: 0.3,
    color: '#C8001C',
    animation: 'KINETIC_CTA',
    animationDuration: 0.8,
    stagger: 0.02,
  },
  KINETIC_BODY: {
    id: 'KINETIC_BODY',
    name: 'Kinetic Body',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: 400,
    fontSize: 0.5,
    lineHeight: 1.5,
    letterSpacing: 0,
    color: '#B6BCC8',
    animation: 'KINETIC_BODY',
    animationDuration: 0.6,
    stagger: 0.01,
  },
  KINETIC_DATA: {
    id: 'KINETIC_DATA',
    name: 'Kinetic Data',
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 700,
    fontSize: 1.2,
    lineHeight: 1.0,
    letterSpacing: 0,
    color: '#00A8E0',
    animation: 'KINETIC_DATA',
    animationDuration: 1.0,
    stagger: 0.03,
  },
  TYPEWRITER: {
    id: 'TYPEWRITER',
    name: 'Typewriter',
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 500,
    fontSize: 0.6,
    lineHeight: 1.4,
    letterSpacing: 0,
    color: '#FFFFFF',
    animation: 'TYPEWRITER',
    animationDuration: 2.0,
    stagger: 0.05,
  },
  SCRAMBLE: {
    id: 'SCRAMBLE',
    name: 'Scramble Reveal',
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 900,
    fontSize: 1.0,
    lineHeight: 1.05,
    letterSpacing: -0.02,
    color: '#FFFFFF',
    animation: 'SCRAMBLE',
    animationDuration: 1.5,
    stagger: 0.06,
  },
  FADE_UP: {
    id: 'FADE_UP',
    name: 'Fade Up',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: 500,
    fontSize: 0.5,
    lineHeight: 1.5,
    letterSpacing: 0,
    color: '#B6BCC8',
    animation: 'FADE_UP',
    animationDuration: 0.8,
    stagger: 0.1,
  },
  SLIDE_IN: {
    id: 'SLIDE_IN',
    name: 'Slide In',
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 700,
    fontSize: 0.7,
    lineHeight: 1.2,
    letterSpacing: 0.1,
    color: '#C8001C',
    animation: 'SLIDE_IN',
    animationDuration: 0.6,
    stagger: 0.02,
  },
};

export interface TypographyEngineOptions {
  mode?: string;
  brandPrimary?: string;
  brandAccent?: string;
}

export class TypographyEngine {
  /**
   * Generate typography plan from shots and visual grammar.
   */
  async planTypography(
    shots: Shot[],
    options: TypographyEngineOptions = {},
  ): Promise<TypographyPlan> {
    const { mode = 'EXPLAINER', brandPrimary, brandAccent } = options;
    // brandPrimary and brandAccent reserved for future preset customization
    void brandPrimary;
    void brandAccent;

    const animations = new Set<string>();

    // Assign typography per shot purpose
    for (const shot of shots) {
      if (shot.typography) {
        animations.add(shot.typography);
      } else {
        // Auto-assign based on shot purpose
        switch (shot.purpose) {
          case 'HOOK':
            animations.add('KINETIC_TITLE');
            break;
          case 'CTA':
            animations.add('KINETIC_CTA');
            break;
          case 'PROOF':
          case 'BENEFIT':
            animations.add('KINETIC_DATA');
            break;
          case 'SOLUTION':
            animations.add('SLIDE_IN');
            break;
          case 'PROBLEM':
            animations.add('TYPEWRITER');
            break;
          default:
            animations.add('FADE_UP');
        }
      }
    }

    // Mode-specific overrides
    if (mode.includes('TYPOGRAPHIC') || mode.includes('POSTER')) {
      animations.add('KINETIC_TITLE');
      animations.add('SCRAMBLE');
    }
    if (mode.includes('INFOGRAPHIC') || mode.includes('EDUCATIONAL')) {
      animations.add('KINETIC_DATA');
    }
    if (mode.includes('SOCIAL') || mode.includes('PLAYFUL')) {
      animations.add('FADE_UP');
      animations.add('SLIDE_IN');
    }

    return {
      style: mode.toLowerCase(),
      animations: Array.from(animations),
    };
  }

  /** Get a preset by ID */
  getPreset(id: string): TypographyPreset | undefined {
    return TYPOGRAPHY_PRESETS[id];
  }

  /** Get all presets */
  getAllPresets(): TypographyPreset[] {
    return Object.values(TYPOGRAPHY_PRESETS);
  }
}

export default TypographyEngine;
