import type { CameraSpec, Script, Shot, Storyboard } from '@printsync/common';

export const STORYBOARD_ENGINE_VERSION = '1.0.0';

/** Shot type mapping by beat purpose */
const SHOT_TYPE_MAP: Record<string, CameraSpec['type']> = {
  HOOK: 'ESTABLISHING',
  PROBLEM: 'CLOSE_UP',
  SOLUTION: 'TRACKING',
  PROOF: 'SPLIT_SCREEN',
  BENEFIT: 'MEDIUM',
  CTA: 'STATIC',
  EDUCATION: 'TOP_DOWN',
  BRAND: 'HERO',
};

/** Lens mapping by shot type */
const LENS_MAP: Record<CameraSpec['type'], string> = {
  ESTABLISHING: '24mm',
  CLOSE_UP: '85mm',
  TRACKING: '35mm',
  SPLIT_SCREEN: '50mm',
  MEDIUM: '50mm',
  STATIC: '35mm',
  TOP_DOWN: '24mm',
  HERO: '50mm',
};

/** Movement mapping */
const MOVEMENT_MAP: Record<CameraSpec['type'], string> = {
  ESTABLISHING: 'Slow dolly in',
  CLOSE_UP: 'Static, rack focus',
  TRACKING: 'Smooth lateral track',
  SPLIT_SCREEN: 'Static, graphic wipe',
  MEDIUM: 'Gentle pan',
  STATIC: 'Locked off',
  TOP_DOWN: 'Static, overhead',
  HERO: 'Slow 360 orbit',
};

export class StoryboardEngine {
  /**
   * Generate a storyboard from a script.
   * Maps script steps to shots with proper camera specs.
   */
  async generateStoryboard(script: Script): Promise<Storyboard> {
    const shots: Shot[] = script.steps.map((step, i) => {
      // Infer shot purpose from visual text
      const visual = step.visual.toUpperCase();
      let purpose: Shot['purpose'] = 'VISUAL';
      if (visual.includes('HOOK') || visual.includes('ESTABLISH')) purpose = 'HOOK';
      else if (visual.includes('PROBLEM') || visual.includes('PAIN')) purpose = 'PROBLEM';
      else if (
        visual.includes('SOLUTION') ||
        visual.includes('REVEAL') ||
        visual.includes('PRODUCT')
      )
        purpose = 'SOLUTION';
      else if (
        visual.includes('PROOF') ||
        visual.includes('DATA') ||
        visual.includes('TESTIMONIAL')
      )
        purpose = 'PROOF';
      else if (visual.includes('BENEFIT') || visual.includes('RESULT') || visual.includes('AFTER'))
        purpose = 'BENEFIT';
      else if (visual.includes('CTA') || visual.includes('CALL') || visual.includes('BRAND'))
        purpose = 'CTA';

      const cameraType = SHOT_TYPE_MAP[purpose] || 'STATIC';

      const shot: Shot = {
        id: `shot-${i + 1}`,
        start: step.start,
        duration: step.end - step.start,
        purpose,
        camera: {
          type: cameraType,
          lens: LENS_MAP[cameraType] ?? '35mm',
          movement: MOVEMENT_MAP[cameraType] ?? 'Locked off',
        },
      };

      // Conditionally add optional properties (exactOptionalPropertyTypes)
      const subject = step.visual.split('—')[0]?.trim();
      if (subject) shot.subject = subject;
      if (step.dialogue) shot.action = 'dialogue';
      shot.lighting =
        purpose === 'BENEFIT' ? 'warm_key' : purpose === 'PROBLEM' ? 'cool_contrast' : 'standard';
      if (purpose === 'CTA') shot.typography = 'brand_lockup';
      else if (purpose === 'HOOK') shot.typography = 'title_card';
      if (purpose === 'SOLUTION') shot.vfx = 'transition_reveal';
      if (i > 0) shot.transition = 'cut';
      if (step.dialogue) shot.audio = ['voiceover'];

      return shot;
    });

    return { shots };
  }
}

export default StoryboardEngine;
