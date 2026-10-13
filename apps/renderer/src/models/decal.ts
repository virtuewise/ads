import { CircleGeometry, CylinderGeometry, PlaneGeometry, type BufferGeometry } from 'three';
import {
  toSceneUnits,
  printItemDecalRect,
  printItemWrapBand,
  type PrintItemSpec,
} from '@printsync/motion-engine';

/**
 * Create the decal geometry the printed artwork is mapped onto.
 *
 * The placement comes from the shared, unit-tested `printItemDecalRect` /
 * `printItemWrapBand` helpers in `@printsync/motion-engine`, so the artwork is
 * always locked to the modelled surface — even as shapes gain flaps, seals,
 * cassette bases and closures.
 *
 * - Flat / box / carton / pouch / roll-up items: a plane on the front face.
 * - Round labels: a circle, matched to the die-cut diameter.
 * - Revolved containers: a partial cylinder wrapped around the body.
 */
export function createItemDecal(spec: PrintItemSpec): BufferGeometry | null {
  if (spec.kind === 'disk') {
    const geometry = new CircleGeometry(toSceneUnits(spec.dimensions.width / 2), spec.radialSegments ?? 96);
    geometry.translate(0, toSceneUnits(spec.dimensions.height / 2), toSceneUnits(spec.dimensions.depth / 2 + 0.2));
    return geometry;
  }

  if (spec.kind === 'revolve') {
    const band = printItemWrapBand(spec);
    if (!band) return null;
    const geometry = new CylinderGeometry(
      toSceneUnits(band.radius),
      toSceneUnits(band.radius),
      toSceneUnits(band.height),
      spec.radialSegments ?? 48,
      1,
      true,
      -band.thetaLength / 2,
      band.thetaLength,
    );
    geometry.translate(0, toSceneUnits(band.centerY), 0);
    return geometry;
  }

  const rect = printItemDecalRect(spec);
  if (!rect) return null;
  const geometry = new PlaneGeometry(toSceneUnits(rect.width), toSceneUnits(rect.height));
  geometry.translate(0, toSceneUnits(rect.centerY), toSceneUnits(rect.z + 0.2));
  return geometry;
}
