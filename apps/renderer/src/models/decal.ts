import { CylinderGeometry, PlaneGeometry, type BufferGeometry } from 'three';
import { toSceneUnits, type PrintItemSpec, type ProfilePoint } from '@printsync/motion-engine';

/** Interpolate the profile radius at a normalised height t. */
function profileRadiusAt(profile: readonly ProfilePoint[], t: number): number {
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i]!;
    const b = profile[i + 1]!;
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1;
      const f = (t - a.t) / span;
      return a.r + (b.r - a.r) * f;
    }
  }
  return profile[profile.length - 1]?.r ?? 0;
}

/**
 * Create a decal geometry for the printed artwork on an item.
 *
 * Flat items (slab, disk, roundedBox, pouch, rollup) get a plane on the +Z
 * face. Revolve items (bottle, can, tube) get a partial cylinder that hugs
 * the body at ~40% height — a curved wrap label.
 */
export function createItemDecal(spec: PrintItemSpec): BufferGeometry | null {
  const { width, height, depth } = spec.dimensions;

  switch (spec.kind) {
    case 'slab':
    case 'roundedBox':
    case 'pouch':
    case 'rollup': {
      const plane = new PlaneGeometry(toSceneUnits(width), toSceneUnits(height));
      plane.translate(0, toSceneUnits(height) / 2, toSceneUnits(depth) / 2 + 0.0002);
      return plane;
    }

    case 'disk': {
      const plane = new PlaneGeometry(toSceneUnits(width), toSceneUnits(height));
      plane.translate(0, toSceneUnits(height) / 2, toSceneUnits(depth) / 2 + 0.0002);
      return plane;
    }

    case 'revolve': {
      if (!spec.profile) return null;
      const t = 0.4;
      const bodyRadius = profileRadiusAt(spec.profile, t);
      const labelRadius = toSceneUnits(bodyRadius + 0.3);
      const labelHeight = toSceneUnits(height * 0.45);
      const thetaLength = Math.min(
        Math.PI * 0.55,
        (toSceneUnits(width) * 1.1) / labelRadius,
      );
      const geo = new CylinderGeometry(
        labelRadius,
        labelRadius,
        labelHeight,
        spec.radialSegments ?? 48,
        1,
        true,
        -thetaLength / 2,
        thetaLength,
      );
      geo.translate(0, toSceneUnits(height * t), 0);
      return geo;
    }

    default:
      return null;
  }
}
