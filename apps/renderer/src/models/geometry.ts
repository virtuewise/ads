import {
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Path,
  Shape,
  Vector2,
  type BufferGeometry,
} from 'three';
import {
  toSceneUnits,
  printItemBevelMm,
  printItemBodyHeight,
  printItemFlapThickness,
  printItemSealHeight,
  ROLLUP_BASE_MM,
  type CapSpec,
  type MaterialPreset,
  type PrintItemSpec,
  type ProfilePoint,
} from '@printsync/motion-engine';

/** Smoothness for rounded outlines and revolved surfaces. */
const CURVE_SEGMENTS = 28;
/** Consistent edge bevel for paper stock, in millimetres. */
const PAPER_BEVEL_MM = 0.4;
/** Board bevel for folding cartons, in millimetres. */
const BOARD_BEVEL_MM = 0.8;
/** A stand-up pouch is crimped nearly flat across the top seal. */
const SEAL_DEPTH_RATIO = 0.45;
/** The gusseted "Doy" base flares wider than the pouch body. */
const GUSSET_DEPTH_RATIO = 1.3;
const GUSSET_HEIGHT_MM = 9;

export interface ItemPart {
  readonly geometry: BufferGeometry;
  readonly material: MaterialPreset;
}

/** Centres a geometry on X/Z and rests its minimum Y on the ground plane. */
function ground(geometry: BufferGeometry): BufferGeometry {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (box) {
    geometry.translate(
      -(box.min.x + box.max.x) / 2,
      -box.min.y,
      -(box.min.z + box.max.z) / 2,
    );
  }
  return geometry;
}

/**
 * Grounds an *assembly* of parts together: computes the union bounding box and
 * shifts every part by the same offset. This is what keeps multi-part items
 * (cartons, pouches, roll-ups) coherent — each piece keeps its position
 * relative to the others instead of being grounded in isolation.
 */
function groundAssembly(parts: readonly ItemPart[]): void {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const part of parts) {
    part.geometry.computeBoundingBox();
    const box = part.geometry.boundingBox;
    if (!box) continue;
    minX = Math.min(minX, box.min.x);
    minY = Math.min(minY, box.min.y);
    minZ = Math.min(minZ, box.min.z);
    maxX = Math.max(maxX, box.max.x);
    maxY = Math.max(maxY, box.max.y);
    maxZ = Math.max(maxZ, box.max.z);
  }
  if (!Number.isFinite(minX)) return;
  const dx = -(minX + maxX) / 2;
  const dy = -minY;
  const dz = -(minZ + maxZ) / 2;
  for (const part of parts) part.geometry.translate(dx, dy, dz);
}

/** Rounded rectangle outline in the XY plane, in scene units. */
function roundedRectShape(width: number, height: number, radius: number): Shape {
  const maxRadius = Math.min(width, height) / 2 - 1e-6;
  const r = Math.max(0, Math.min(radius, maxRadius));
  const x = -width / 2;
  const y = -height / 2;

  const shape = new Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

export interface HoleSpec {
  /** Hole centre X in millimetres, relative to the face centre. */
  readonly x: number;
  /** Hole centre Y in millimetres, relative to the face centre. */
  readonly y: number;
  readonly diameter: number;
}

/**
 * Extrude a rounded rectangle along +Z. The outline is shrunk by the bevel so
 * the **outward** bounding dimensions match the spec exactly (bevel grows the
 * form back out on both the outline and the depth). Width along X, height
 * along Y, depth along Z.
 */
function slabGeometry(
  widthMm: number,
  heightMm: number,
  depthMm: number,
  radiusMm: number,
  bevelMm: number = PAPER_BEVEL_MM,
  holes?: readonly HoleSpec[],
): BufferGeometry {
  const hasHoles = (holes?.length ?? 0) > 0;
  // Holes and bevels interact badly, so skip the bevel when cutting a hole.
  const bevelMmClamped = hasHoles ? 0 : Math.max(0, Math.min(bevelMm, depthMm / 2 - 0.01));

  const shape = roundedRectShape(
    toSceneUnits(Math.max(0.01, widthMm - 2 * bevelMmClamped)),
    toSceneUnits(Math.max(0.01, heightMm - 2 * bevelMmClamped)),
    Math.max(0.0002, toSceneUnits(Math.max(0, radiusMm - bevelMmClamped))),
  );

  if (holes) {
    for (const hole of holes) {
      const path = new Path();
      path.absarc(
        toSceneUnits(hole.x),
        toSceneUnits(hole.y),
        toSceneUnits(hole.diameter / 2),
        0,
        Math.PI * 2,
        true,
      );
      shape.holes.push(path);
    }
  }

  const bevel = toSceneUnits(bevelMmClamped);
  const geometry = new ExtrudeGeometry(shape, {
    depth: Math.max(1e-6, toSceneUnits(Math.max(0.01, depthMm - 2 * bevelMmClamped))),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: CURVE_SEGMENTS,
  });
  return ground(geometry);
}

/**
 * A flat panel lying in the XZ plane: width (X) x depth (Z) x thickness (Y).
 * Used for carton flaps and pouch gussets.
 */
function panelGeometry(
  widthMm: number,
  depthMm: number,
  thicknessMm: number,
  radiusMm: number,
  bevelMm: number = PAPER_BEVEL_MM,
): BufferGeometry {
  const geometry = slabGeometry(widthMm, depthMm, thicknessMm, radiusMm, bevelMm);
  geometry.rotateX(-Math.PI / 2);
  return ground(geometry);
}

/** A flat disc facing +Z (diameter along X/Y, thickness along Z). */
function diskGeometry(diameterMm: number, thicknessMm: number, segments: number): BufferGeometry {
  const radius = toSceneUnits(diameterMm / 2);
  const geometry = new CylinderGeometry(radius, radius, toSceneUnits(thicknessMm), segments);
  geometry.rotateX(Math.PI / 2);
  return ground(geometry);
}

/** Revolve a normalised profile around the Y axis to form bottles/cans/tubes. */
function revolveGeometry(
  bodyHeightMm: number,
  profile: readonly ProfilePoint[],
  segments: number,
): BufferGeometry {
  const points = profile.map(
    (point) => new Vector2(toSceneUnits(point.r), toSceneUnits(point.t * bodyHeightMm)),
  );
  const geometry = new LatheGeometry(points, Math.max(3, segments));
  return ground(geometry);
}

/**
 * A closure (screw cap / twist lid / flip top) built as a solid of revolution,
 * with a base at Y = 0 so it can be stacked on the body.
 */
function capGeometry(spec: CapSpec, segments: number): BufferGeometry {
  const r = spec.diameter / 2;
  const h = spec.height;
  let profile: Array<[number, number]>;

  switch (spec.style ?? 'screw') {
    case 'lid': {
      // Twist-off lid: stepped skirt with a slight lip and recessed top.
      profile = [
        [0, 0],
        [r, 0],
        [r, h * 0.72],
        [r * 1.01, h * 0.78],
        [r * 1.01, h * 0.94],
        [r * 0.9, h],
        [0, h],
      ];
      break;
    }
    case 'flip': {
      // Flip top: short skirt with a domed cap.
      const ch = Math.min(1.4, h * 0.4);
      profile = [
        [0, 0],
        [r, 0],
        [r, h * 0.45],
        [r * 0.72, h - ch],
        [r * 0.4, h],
        [0, h],
      ];
      break;
    }
    default: {
      // Screw cap: straight skirt with a chamfered top edge.
      const ch = Math.min(1.5, h * 0.35);
      profile = [
        [0, 0],
        [r, 0],
        [r, h - ch],
        [r - ch, h],
        [0, h],
      ];
      break;
    }
  }

  const points = profile.map(([pr, py]) => new Vector2(toSceneUnits(pr), toSceneUnits(py)));
  const geometry = new LatheGeometry(points, Math.max(3, segments));
  return ground(geometry);
}

/** Assemble a folding carton: body plus fold-over tuck flaps and a front tab. */
function cartonParts(spec: PrintItemSpec): ItemPart[] {
  const { width, height, depth } = spec.dimensions;
  const radius = spec.cornerRadius ?? 2;
  const flap = printItemFlapThickness(spec) || 1.2;
  const inset = 2;
  const bodyHeight = height - 2 * flap;

  const bottom = panelGeometry(width - 2 * inset, depth - 2 * inset, flap, radius, 0.4);
  const body = slabGeometry(width, bodyHeight, depth, radius, BOARD_BEVEL_MM);
  body.translate(0, toSceneUnits(flap), 0);
  const top = panelGeometry(width - 2 * inset, depth - 2 * inset, flap, radius, 0.4);
  top.translate(0, toSceneUnits(flap + bodyHeight), 0);

  // Front tuck tab: hangs over the leading edge of the top flap.
  const tabHeight = Math.min(16, bodyHeight * 0.2);
  const tab = slabGeometry(width * 0.5, tabHeight, 0.8, 1, 0.2);
  tab.translate(
    0,
    toSceneUnits(flap + bodyHeight - tabHeight),
    toSceneUnits(depth / 2),
  );

  return [
    { geometry: bottom, material: spec.material },
    { geometry: body, material: spec.material },
    { geometry: top, material: spec.material },
    { geometry: tab, material: spec.material },
  ];
}

/** Assemble a quad-seal stand-up pouch: body, crimped seal (with hang hole), gusset. */
function pouchParts(spec: PrintItemSpec): ItemPart[] {
  const { width, height, depth } = spec.dimensions;
  const radius = spec.cornerRadius ?? 8;
  const sealHeight = printItemSealHeight(spec);
  const bodyHeight = height - sealHeight;
  const seal = spec.seal ?? { height: sealHeight };

  const body = slabGeometry(width, bodyHeight, depth, radius, PAPER_BEVEL_MM);

  const holeDiameter = seal.holeDiameter ?? 6;
  const holes =
    seal.hangHole === true
      ? [{ x: 0, y: sealHeight / 2 - holeDiameter / 2 - 1.5, diameter: holeDiameter }]
      : undefined;
  const sealGeometry = slabGeometry(
    width * 0.99,
    sealHeight,
    depth * SEAL_DEPTH_RATIO,
    2,
    PAPER_BEVEL_MM,
    holes,
  );
  sealGeometry.translate(0, toSceneUnits(bodyHeight), 0);

  // Bottom gusset fold: the flared "Doy" base that lets the pouch stand up.
  const gusset = panelGeometry(
    width * 0.94,
    depth * GUSSET_DEPTH_RATIO,
    GUSSET_HEIGHT_MM,
    3,
    0.6,
  );

  return [
    { geometry: gusset, material: spec.material },
    { geometry: body, material: spec.material },
    { geometry: sealGeometry, material: spec.material },
  ];
}

/** Assemble a roll-up banner: cassette base, feet, support pole, top rail, banner. */
function rollupParts(spec: PrintItemSpec): ItemPart[] {
  const { width, height, depth } = spec.dimensions;
  const baseHeight = ROLLUP_BASE_MM;
  const poleHeight = height - baseHeight;
  const segments = 24;

  const base = slabGeometry(width + 60, baseHeight, depth, 8, 1.5);

  const feetX = (width + 60) / 2 - 14;
  const foot = (x: number): BufferGeometry => {
    const geometry = slabGeometry(28, 10, depth + 70, 4, 1);
    geometry.translate(toSceneUnits(x), 0, 0);
    return geometry;
  };

  const pole = new CylinderGeometry(
    toSceneUnits(11),
    toSceneUnits(11),
    toSceneUnits(poleHeight),
    segments,
  );
  pole.translate(0, toSceneUnits(baseHeight + poleHeight / 2), 0);

  const banner = slabGeometry(width, poleHeight, 6, 0, 0.4);
  banner.translate(0, toSceneUnits(baseHeight), toSceneUnits(depth / 4));

  const rail = slabGeometry(width, 14, 14, 3, 1);
  rail.translate(0, toSceneUnits(height - 7), toSceneUnits(depth / 8));

  return [
    { geometry: base, material: 'metal' },
    { geometry: foot(-feetX), material: 'metal' },
    { geometry: foot(feetX), material: 'metal' },
    { geometry: pole, material: 'chrome' },
    { geometry: banner, material: spec.material },
    { geometry: rail, material: 'metal' },
  ];
}

/** Build every mesh part for an item, already positioned in item-local space. */
export function createItemParts(spec: PrintItemSpec): ItemPart[] {
  const { width, height, depth } = spec.dimensions;
  const radius = spec.cornerRadius ?? 1;
  let parts: ItemPart[];

  switch (spec.kind) {
    case 'slab':
      parts = [{ geometry: slabGeometry(width, height, depth, radius, PAPER_BEVEL_MM), material: spec.material }];
      break;

    case 'roundedBox':
      parts = [
        {
          geometry: slabGeometry(width, height, depth, radius, printItemBevelMm(spec)),
          material: spec.material,
        },
      ];
      break;

    case 'carton':
      parts = cartonParts(spec);
      break;

    case 'disk':
      parts = [{ geometry: diskGeometry(width, depth, spec.radialSegments ?? 96), material: spec.material }];
      break;

    case 'revolve': {
      const segments = spec.radialSegments ?? 72;
      const bodyHeight = printItemBodyHeight(spec);
      parts = [
        {
          geometry: revolveGeometry(bodyHeight, spec.profile ?? [], segments),
          material: spec.material,
        },
      ];
      if (spec.cap) {
        const cap = capGeometry(spec.cap, segments);
        cap.translate(0, toSceneUnits(bodyHeight), 0);
        parts.push({ geometry: cap, material: spec.cap.material });
      }
      break;
    }

    case 'pouch':
      parts = pouchParts(spec);
      break;

    case 'rollup':
      parts = rollupParts(spec);
      break;

    default: {
      const exhaustive: never = spec.kind;
      return exhaustive;
    }
  }

  groundAssembly(parts);
  return parts;
}
