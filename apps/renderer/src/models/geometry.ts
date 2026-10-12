import {
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  Vector2,
  type BufferGeometry,
} from 'three';
import {
  toSceneUnits,
  type MaterialPreset,
  type PrintItemSpec,
  type ProfilePoint,
} from '@printsync/motion-engine';

/** Smoothness for rounded outlines and revolved surfaces. */
const CURVE_SEGMENTS = 28;
/** Consistent edge bevel for paper/board, in millimetres. */
const BEVEL_MM = 0.4;

export interface ItemPart {
  readonly geometry: BufferGeometry;
  readonly material: MaterialPreset;
}

/**
 * Centre a geometry on X/Z and rest it on the ground plane (min Y = 0). Applied
 * uniformly so every item shares the same origin convention.
 */
function ground(geometry: BufferGeometry): BufferGeometry {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (box) {
    const centerX = (box.min.x + box.max.x) / 2;
    const centerZ = (box.min.z + box.max.z) / 2;
    geometry.translate(-centerX, -box.min.y, -centerZ);
  }
  return geometry;
}

/** Rounded rectangle outline in the XY plane, in scene units. */
function roundedRectShape(widthMm: number, heightMm: number, radiusMm: number): Shape {
  const width = toSceneUnits(widthMm);
  const height = toSceneUnits(heightMm);
  const maxRadius = Math.min(width, height) / 2 - 1e-6;
  const radius = Math.max(0, Math.min(toSceneUnits(radiusMm), maxRadius));
  const x = -width / 2;
  const y = -height / 2;

  const shape = new Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

/**
 * Extrude a rounded rectangle along +Z. Used for flat print, labels and
 * folding / rigid packaging — width along X, height along Y, depth along Z.
 */
function slab(widthMm: number, heightMm: number, depthMm: number, radiusMm: number): BufferGeometry {
  const depth = toSceneUnits(depthMm);
  const bevel = Math.min(toSceneUnits(BEVEL_MM), depth / 4);
  const geometry = new ExtrudeGeometry(roundedRectShape(widthMm, heightMm, radiusMm), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: CURVE_SEGMENTS,
  });
  return ground(geometry);
}

/** A flat disc facing +Z (diameter along X/Y, thickness along Z). */
function disk(diameterMm: number, thicknessMm: number, segments: number): BufferGeometry {
  const radius = toSceneUnits(diameterMm / 2);
  const geometry = new CylinderGeometry(radius, radius, toSceneUnits(thicknessMm), segments);
  geometry.rotateX(Math.PI / 2);
  return ground(geometry);
}

/** Revolve a normalised profile around the Y axis to form bottles/cans/tubes. */
function revolve(heightMm: number, profile: readonly ProfilePoint[], segments: number): BufferGeometry {
  const points = profile.map((point) => new Vector2(toSceneUnits(point.r), toSceneUnits(point.t * heightMm)));
  const geometry = new LatheGeometry(points, segments);
  return ground(geometry);
}

/** An open cylindrical band, centred on the origin, used for brand accents. */
function band(diameterMm: number, heightMm: number, segments: number): BufferGeometry {
  return new CylinderGeometry(toSceneUnits(diameterMm / 2), toSceneUnits(diameterMm / 2), toSceneUnits(heightMm), segments, 1, true);
}

/** Build every mesh part for an item, already positioned in item-local space. */
export function createItemParts(spec: PrintItemSpec): ItemPart[] {
  const { width, height, depth } = spec.dimensions;
  const radius = spec.cornerRadius ?? 1;

  switch (spec.kind) {
    case 'slab':
    case 'roundedBox':
      return [{ geometry: slab(width, height, depth, radius), material: spec.material }];

    case 'disk':
      return [{ geometry: disk(width, depth, spec.radialSegments ?? 96), material: spec.material }];

    case 'revolve': {
      const profile = spec.profile ?? [];
      const segments = spec.radialSegments ?? 72;
      const parts: ItemPart[] = [
        { geometry: revolve(height, profile, segments), material: spec.material },
      ];
      if (profile.length > 0) {
        const maxRadius = Math.max(...profile.map((point) => point.r));
        const accent = band(maxRadius * 2 + 0.8, height * 0.14, segments);
        accent.translate(0, toSceneUnits(height * 0.36), 0);
        parts.push({ geometry: accent, material: 'paint' });
      }
      return parts;
    }

    case 'pouch': {
      const sealHeight = 12;
      const main = slab(width, height, depth, radius);
      const seal = slab(width * 0.92, sealHeight, depth * 0.4, 1);
      seal.translate(0, toSceneUnits(height - sealHeight), 0);
      return [
        { geometry: main, material: spec.material },
        { geometry: seal, material: spec.material },
      ];
    }

    case 'rollup': {
      const bannerThickness = 6;
      const base = slab(width + 50, 90, depth, 8);
      const banner = slab(width, height, bannerThickness, 0);
      return [
        { geometry: base, material: 'metal' },
        { geometry: banner, material: spec.material },
      ];
    }

    default: {
      const exhaustive: never = spec.kind;
      return exhaustive;
    }
  }
}
