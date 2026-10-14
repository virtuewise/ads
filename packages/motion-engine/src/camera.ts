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
export const CAMERA_PATHS = ['turntable', 'orbit', 'dolly', 'hero', 'showcase', 'none'] as const;

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
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** Horizontal camera distance behind the catalogue, in scene units. */
function distanceFor(path: CameraPath, radius: number, eased: number): number {
  switch (path) {
    case 'orbit':
      return radius + 1.3;
    case 'dolly':
    case 'showcase':
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
    case 'showcase':
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
    case 'showcase':
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
    case 'showcase':
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
export function resolveCameraPlan(path: CameraPath, progress: number, radius = 3): CameraPlan {
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

/** The kind of printed thing a showcase shot is pointed at. */
export type CityShotKind = 'shopfront' | 'billboard' | 'sign';

/**
 * Something the city film cuts to for a close-up.
 *
 * `position` is the centre of the printed face rather than the ground beneath
 * it, because a close-up is framed on the face: `size` is its real width and
 * height in metres, and `facing` is the yaw whose local +Z points out at the
 * street, so the lens can always square up to the artwork.
 */
export interface CityShotSubject {
  readonly kind: CityShotKind;
  /** Centre of the face, in metres. */
  readonly position: readonly [number, number, number];
  /** Face width and height, in metres. */
  readonly size: readonly [number, number];
  /** Face yaw, radians. The outward normal is `(sin facing, 0, cos facing)`. */
  readonly facing: number;
}

/** One cut in the showcase edit. */
export interface ShowcaseShot {
  /** Progress the shot starts at, inclusive. */
  readonly from: number;
  /** Progress the next shot starts at. */
  readonly to: number;
  readonly kind: 'street' | 'skyline' | CityShotKind;
}

/**
 * The showcase edit: a travelling pass establishes the city, then the film cuts
 * to one printed subject at a time — the shopfront branding, the digital
 * out-of-home screen, the road-safety sign — and finally cranes out over the
 * skyline.
 *
 * The cuts are hard on purpose. This is how the advertising these products live
 * in is actually shot: you hold on the product, then move on. Every shot is
 * still a camera *move*, never a still.
 */
export const SHOWCASE_SHOTS: readonly ShowcaseShot[] = [
  { from: 0, to: 0.3, kind: 'street' },
  { from: 0.3, to: 0.52, kind: 'shopfront' },
  { from: 0.52, to: 0.68, kind: 'billboard' },
  { from: 0.68, to: 0.84, kind: 'sign' },
  { from: 0.84, to: 1, kind: 'skyline' },
];

/**
 * The film's lens: 52° vertical field of view at 16:9, which is what the
 * renderer frames the city with. Close-ups are planned by working out the
 * distance that puts a subject at a chosen width in frame, so a 600 mm road
 * sign and a 12 m shopfront are both covered the same way.
 */
const LENS_FOV_Y_DEG = 52;
const LENS_ASPECT = 16 / 9;

/** Distance at which `visibleWidth` metres span the frame horizontally. */
function frameDistance(visibleWidth: number): number {
  const halfY = Math.tan((LENS_FOV_Y_DEG * Math.PI) / 360);
  const halfX = halfY * LENS_ASPECT;
  return visibleWidth / (2 * halfX);
}

/** How each kind of subject is covered: a move, expressed as two framings. */
interface SubjectFraming {
  /** Width of the world in frame at the start and end of the shot, in metres. */
  readonly fromWidth: number;
  readonly toWidth: number;
  /** Lens height above the face centre, start -> end, in metres. */
  readonly fromLift: number;
  readonly toLift: number;
  /** Aim point on the face, as a fraction of its height above the centre. */
  readonly fromAim: number;
  readonly toAim: number;
  /** Drift across the face, start -> end, in metres. */
  readonly fromSlide: number;
  readonly toSlide: number;
}

const SUBJECT_FRAMING: Record<CityShotKind, SubjectFraming> = {
  // The shopfront: open on the whole trading unit, then push in and rise so the
  // shot lands on the printed fascia — the shop's own advertising.
  shopfront: {
    fromWidth: 20,
    toWidth: 7.5,
    fromLift: 2.4,
    toLift: 1.7,
    fromAim: 0,
    toAim: 0.4,
    fromSlide: 1.6,
    toSlide: -1.4,
  },
  // The digital screen: tight on the face and tilting up the panel as the lens
  // creeps in, so the artwork reads from the bottom of the frame to the top.
  billboard: {
    fromWidth: 4.2,
    toWidth: 2.6,
    fromLift: 0.25,
    toLift: 0.1,
    fromAim: -0.35,
    toAim: 0.35,
    fromSlide: 0.7,
    toSlide: -0.7,
  },
  // The road sign: a locked-off macro drifting across the face, the way you
  // would shoot reflective sheeting.
  sign: {
    fromWidth: 2.4,
    toWidth: 1.6,
    fromLift: 0,
    toLift: 0,
    fromAim: 0,
    toAim: 0,
    fromSlide: -0.45,
    toSlide: 0.45,
  },
};

/**
 * The travelling pass down the boulevard: driver's eye height on the left-hand
 * lanes, yawed at the near pavement, with `rise` blending it into a crane up to
 * the skyline. Shared by the `dolly` path and the showcase's opening shot.
 */
function boulevardPose(t: number, extent: number, rise: number): CameraPose {
  const e = Math.max(10, extent);
  const eased = easeInOut(clamp01(t));
  const z = e * 0.62 + (-e * 0.12 - e * 0.62) * eased;
  const x = -5.6;
  const y = 1.72 + (14 - 1.72) * rise;
  const yaw = (1 - rise) * 8.5;
  return { position: [x, y, z], lookAt: [x - yaw, 1.72 + rise * 9, z - 42] };
}

/**
 * The closing crane: up off the boulevard to a high three-quarter vantage, so
 * the film ends on the towers and the rooftop spectaculars.
 */
function skylinePose(t: number, extent: number): CameraPose {
  const e = Math.max(10, extent);
  const k = easeInOut(clamp01(t));
  return {
    position: [-8 - 2.5 * k, 5 + 23 * k, e * 0.22 - e * 0.31 * k],
    lookAt: [0, 4 + 9 * k, -e * 0.5],
  };
}

/** A close-up on one printed face, framed on the face itself. */
function subjectPose(subject: CityShotSubject, t: number): CameraPose {
  const framing = SUBJECT_FRAMING[subject.kind];
  const k = easeInOut(clamp01(t));
  const [cx, cy, cz] = subject.position;
  const height = subject.size[1];
  // Outward normal, and the unit vector across the face the drift slides along.
  const nx = Math.sin(subject.facing);
  const nz = Math.cos(subject.facing);
  const tx = Math.cos(subject.facing);
  const tz = -Math.sin(subject.facing);

  const distance = frameDistance(framing.fromWidth + (framing.toWidth - framing.fromWidth) * k);
  const lift = framing.fromLift + (framing.toLift - framing.fromLift) * k;
  const slide = framing.fromSlide + (framing.toSlide - framing.fromSlide) * k;
  const aim = framing.fromAim + (framing.toAim - framing.fromAim) * k;

  return {
    position: [cx + nx * distance + tx * slide, cy + lift, cz + nz * distance + tz * slide],
    lookAt: [cx, cy + aim * height, cz],
  };
}

/** The showcase shot running at `p`, cut to whichever subject it is pointed at. */
function showcasePose(p: number, extent: number, subjects: readonly CityShotSubject[]): CameraPose {
  const last = SHOWCASE_SHOTS[SHOWCASE_SHOTS.length - 1];
  const shot = SHOWCASE_SHOTS.find((entry) => p < entry.to) ?? last;
  if (!shot) return boulevardPose(p, extent, 0);

  const span = shot.to - shot.from;
  const t = span > 0 ? clamp01((p - shot.from) / span) : 0;

  switch (shot.kind) {
    case 'street':
      return boulevardPose(t, extent, 0);
    case 'skyline':
      return skylinePose(t, extent);
    default: {
      const subject = subjects.find((entry) => entry.kind === shot.kind);
      // With nothing to cut to, the shot reads as more of the travelling pass
      // rather than dropping through to an unrelated default pose.
      return subject ? subjectPose(subject, t) : boulevardPose(t, extent, 0);
    }
  }
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
 * - `dolly`      a cinematic street-level pass along the boulevard — driver's
 *                eye height past the shopfronts and fascias, then a crane up
 *                over the billboards to the skyline
 * - `showcase`   the same pass, then hard cuts to a close-up on each printed
 *                subject in turn, then the crane out (see `SHOWCASE_SHOTS`)
 * - `turntable`  wide orbit around the whole city
 * - `orbit`      closer orbit through the building line
 * - `hero`       fixed elevated three-quarter vantage on the skyline
 * - `none`       static street-level frame
 *
 * The `dolly` pass deliberately rides the lane divider between the two
 * left-hand lanes. The carriageway is a fixed width, so its centre is an
 * absolute offset rather than a fraction of the extent — and straddling the
 * divider is what keeps the lens from ever passing through a vehicle.
 *
 * @param path Camera path id from the render-input contract.
 * @param progress Normalised time through the composition, clamped to [0, 1].
 * @param extent Half-length of the city, in metres.
 * @param subjects Printed faces the `showcase` path may cut to.
 */
export function resolveCityCameraPlan(
  path: CameraPath,
  progress: number,
  extent = 120,
  subjects: readonly CityShotSubject[] = [],
): CameraPlan {
  const p = clamp01(progress);
  const e = Math.max(10, extent);

  switch (path) {
    case 'dolly': {
      // Down the boulevard on the left-hand lanes, at 1.72 m — a driver's eye —
      // yawed slightly towards the near pavement so the shopfronts, fascias and
      // window graphics occupy the left of frame all the way down. After halfway
      // the camera cranes up and straightens, and the reveal becomes the skyline
      // and the billboards.
      const rise = easeInOut(clamp01((p - 0.52) / 0.48));
      return { pose: boulevardPose(p, extent, rise), worldSpin: 0 };
    }
    case 'showcase':
      return { pose: showcasePose(p, extent, subjects), worldSpin: 0 };
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
