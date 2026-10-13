/**
 * Camera paths.
 *
 * The camera path is part of the render-input contract (`@printsync/common`),
 * so these are the exact vocabularies the renderer understands. The maths is
 * pure and frame-addressable: given a path and a normalised progress in
 * [0, 1] it returns a camera pose plus a `worldSpin` multiplier so camera and
 * catalogue-turntable motion combine deliberately instead of stacking up.
 *
 * All poses are expressed in scene units, oriented around the origin at a
 * comfortable eye height, with `lookAt` aimed at the centre of the layout.
 */

/** Every camera path the renderer supports, in contract order. */
export const CAMERA_PATHS = [
  'turntable',
  'orbit',
  'dolly',
  'hero',
  'none',
] as const;

export type CameraPath = (typeof CAMERA_PATHS)[number];

export interface CameraPose {
  readonly position: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
}

export interface CameraPlan {
  readonly pose: CameraPose;
  /** Multiplier applied to the catalogue turntable rotation. */
  readonly worldSpin: number;
}

const TAU = Math.PI * 2;

/** Clamp a value into [0, 1]; NaN becomes 0, infinities clamp to the ends. */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Smooth 0 -> 1 ease used by the dolly path. */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Horizontal camera distance behind the catalogue, in scene units. */
function distanceFor(path: CameraPath, radius: number, eased: number): number {
  switch (path) {
    case 'orbit':
      return radius + 1.3;
    case 'dolly':
      return radius + 6.5 + (1.5 - 6.5) * eased;
    case 'hero':
      return radius + 2.0;
    case 'none':
      return radius + 2.6;
    default:
      return radius + 2.2;
  }
}

/** Camera height above the floor, in scene units. */
function heightFor(path: CameraPath, eased: number): number {
  switch (path) {
    case 'orbit':
      return 0.55;
    case 'dolly':
      return 1.5 + (0.6 - 1.5) * eased;
    case 'hero':
      return 0.4;
    default:
      return 0.85;
  }
}

/** Horizontal angle around the layout, in radians. */
function angleFor(path: CameraPath, progress: number): number {
  switch (path) {
    case 'orbit':
      return progress * TAU * 1.4 + 0.6;
    case 'dolly':
      return progress * Math.PI * 0.55;
    case 'hero':
      return 0.55;
    default:
      return progress * TAU;
  }
}

/** How much of the catalogue turntable rotation still applies for this path. */
function worldSpinFor(path: CameraPath): number {
  switch (path) {
    case 'orbit':
      return 0.35;
    case 'dolly':
      return 0.85;
    case 'hero':
      return 0.15;
    case 'none':
      return 0;
    default:
      return 1;
  }
}

/**
 * Resolve a camera path at a normalised progress into a concrete pose plus the
 * matching turntable multiplier.
 *
 * @param path Camera path id from the render-input contract.
 * @param progress Normalised time through the composition, clamped to [0, 1].
 * @param radius Radius of the item layout the camera should frame.
 */
export function resolveCameraPlan(
  path: CameraPath,
  progress: number,
  radius = 3,
): CameraPlan {
  const p = clamp01(progress);
  const eased = easeInOut(p);
  const distance = distanceFor(path, Math.max(0, radius), eased);
  const angle = angleFor(path, p);
  const height = heightFor(path, eased);

  return {
    pose: {
      position: [Math.sin(angle) * distance, height, Math.cos(angle) * distance],
      lookAt: [0, 0.4, 0],
    },
    worldSpin: worldSpinFor(path),
  };
}

/**
 * Resolve the same camera-path vocabulary at **city scale**.
 *
 * One vocabulary, two scene scales: the product line frames a 3-unit ring with
 * `resolveCameraPlan`, while the living city frames a street hundreds of metres
 * long with this. Reusing the contract's paths keeps a single source of truth
 * for camera vocabulary.
 *
 * City readings:
 * - `dolly`      travels the boulevard at street level (the hero travelling shot)
 * - `turntable`  wide orbit around the whole city
 * - `orbit`      closer orbit through the building line
 * - `hero`       fixed elevated three-quarter vantage on the skyline
 * - `none`       static street-level frame
 *
 * @param path Camera path id from the render-input contract.
 * @param progress Normalised time through the composition, clamped to [0, 1].
 * @param extent Half-length of the city, in metres.
 */
export function resolveCityCameraPlan(
  path: CameraPath,
  progress: number,
  extent = 120,
): CameraPlan {
  const p = clamp01(progress);
  const eased = easeInOut(p);
  const e = Math.max(10, extent);

  switch (path) {
    case 'dolly': {
      const z = e * 0.62 + (-e * 0.12 - e * 0.62) * eased;
      const y = 2.8 + (9 - 2.8) * eased;
      const x = Math.sin(p * Math.PI) * e * 0.05;
      return {
        pose: { position: [x, y, z], lookAt: [x * 0.5, 3.2 + eased * 2.6, z - 46] },
        worldSpin: 0,
      };
    }
    case 'turntable': {
      const angle = p * TAU;
      const distance = e * 1.35;
      return {
        pose: {
          position: [Math.sin(angle) * distance, e * 0.42, Math.cos(angle) * distance],
          lookAt: [0, e * 0.12, 0],
        },
        worldSpin: 0,
      };
    }
    case 'orbit': {
      const angle = p * TAU + 0.7;
      const distance = e * 0.92;
      return {
        pose: {
          position: [Math.sin(angle) * distance, e * 0.26, Math.cos(angle) * distance],
          lookAt: [0, e * 0.1, 0],
        },
        worldSpin: 0,
      };
    }
    case 'hero':
      return {
        pose: {
          position: [e * 0.06, e * 0.17, e * 0.42],
          lookAt: [0, e * 0.1, -e * 0.05],
        },
        worldSpin: 0,
      };
    default:
      return {
        pose: { position: [0, 4.4, e * 0.5], lookAt: [0, 3.8, -20] },
        worldSpin: 0,
      };
  }
}
