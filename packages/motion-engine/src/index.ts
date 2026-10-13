/**
 * @printsync/motion-engine
 * Motion design engine for the PrintSync Creative OS.
 *
 * This package will handle:
 * - Kinetic typography
 * - Motion primitives
 * - Print object animation
 * - Technical graphics animation
 * - Transitions
 * - VFX primitives
 */

export const MOTION_ENGINE_VERSION = '0.1.0';

export * from './print-items.js';
export * from './artwork.js';
export * from './choreography.js';
export * from './camera.js';
export * from './render-inputs.js';

import {
  animatePrintObject,
  generateAnimationFrames,
  type PrintObjectAnimation,
  type Transform,
} from './choreography.js';
import { getPrintItem } from './print-items.js';

/** Frame-rate used when generating keyframe sequences. */
const DEFAULT_ANIMATION_FPS = 30;
/** Default number of frames in a generated animation sequence. */
const DEFAULT_ANIMATION_FRAMES = 90;

export class MotionEngine {
  /**
   * Create a kinetic typography sequence.
   */
  async createKineticType(_text: string, _behavior: string) {
    // TODO: Implement kinetic typography
    return { frames: [], duration: 0 };
  }

  /**
   * Create a print object animation — spec-driven choreography.
   *
   * Looks up the catalogue item by id and generates deterministic keyframes
   * for the requested animation. The renderer applies these transforms
   * directly to the item group.
   */
  async animatePrintObject(
    objectType: string,
    animation: string,
    options: { fps?: number; frames?: number } = {},
  ) {
    const spec = getPrintItem(objectType);
    if (!spec) {
      return { frames: [] as Transform[], duration: 0 };
    }

    const fps = options.fps ?? DEFAULT_ANIMATION_FPS;
    const totalFrames = options.frames ?? DEFAULT_ANIMATION_FRAMES;
    const frames = generateAnimationFrames(
      spec,
      animation as PrintObjectAnimation,
      totalFrames,
      fps,
    );

    return { frames, duration: totalFrames / fps };
  }

  /**
   * Evaluate a single animation frame for an item — pure and frame-addressable.
   */
  evaluateFrame(
    objectType: string,
    animation: PrintObjectAnimation,
    frame: number,
    fps: number,
    phase = 0,
  ): Transform {
    const spec = getPrintItem(objectType);
    if (!spec) {
      return { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1, opacity: 1 };
    }
    return animatePrintObject(spec, animation, frame, fps, phase);
  }
}

export default MotionEngine;
