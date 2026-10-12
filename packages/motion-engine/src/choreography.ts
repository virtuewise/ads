import { toSceneUnits, type PrintItemSpec } from './print-items.js';

export type PrintObjectAnimation =
  | 'rise'
  | 'float'
  | 'orbit'
  | 'spin'
  | 'reveal'
  | 'fold'
  | 'drop'
  | 'reset';

export interface Transform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  opacity: number;
}

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeOutBounce = (t: number): number => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

/**
 * Deterministic, frame-addressable animation for a catalogue item.
 * Pure function of (spec, animation, frame, fps) — no timers, no state.
 * Returns a transform the renderer can apply directly to an item group.
 */
export function animatePrintObject(
  spec: PrintItemSpec,
  animation: PrintObjectAnimation,
  frame: number,
  fps: number,
  phase = 0,
): Transform {
  const time = (frame + phase) / fps;
  const height = toSceneUnits(spec.dimensions.height);

  switch (animation) {
    case 'reset':
      return { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1, opacity: 1 };

    case 'rise': {
      const t = clamp01(time / 0.5);
      const ease = easeOutCubic(t);
      return {
        position: [0, lerp(height * 0.6, 0, ease), 0],
        rotation: [lerp(-0.5, 0, ease), 0, 0],
        scale: 1,
        opacity: ease,
      };
    }

    case 'float':
      return {
        position: [0, Math.sin(time * 2) * height * 0.04, 0],
        rotation: [0, 0, Math.sin(time * 1.5) * 0.04],
        scale: 1,
        opacity: 1,
      };

    case 'orbit':
      return {
        position: [0, Math.sin(time * 1.2) * height * 0.02, 0],
        rotation: [0, time * 0.7, 0],
        scale: 1,
        opacity: 1,
      };

    case 'spin':
      return { position: [0, 0, 0], rotation: [0, time * 1.1, 0], scale: 1, opacity: 1 };

    case 'reveal': {
      const t = clamp01(time / 0.4);
      return {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: Math.max(0.001, easeOutBack(t)),
        opacity: clamp01(time / 0.25),
      };
    }

    case 'fold': {
      const t = clamp01(time / 0.8);
      const angle = lerp(0, -Math.PI * 0.6, easeInOutCubic(t));
      return { position: [0, 0, 0], rotation: [0, angle, 0], scale: 1, opacity: 1 };
    }

    case 'drop': {
      const t = clamp01(time / 0.6);
      return {
        position: [0, lerp(height * 0.8, 0, easeOutBounce(t)), 0],
        rotation: [0, 0, 0],
        scale: 1,
        opacity: 1,
      };
    }

    default: {
      const exhaustive: never = animation;
      return exhaustive;
    }
  }
}

/** Generate a full keyframe sequence for an animation. */
export function generateAnimationFrames(
  spec: PrintItemSpec,
  animation: PrintObjectAnimation,
  totalFrames: number,
  fps: number,
  phase = 0,
): Transform[] {
  const frames: Transform[] = [];
  for (let f = 0; f < totalFrames; f++) {
    frames.push(animatePrintObject(spec, animation, f, fps, phase));
  }
  return frames;
}
