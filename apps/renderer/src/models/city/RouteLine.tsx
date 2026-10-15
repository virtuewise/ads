import { type CityRoute, sampleCityRoute } from '@printsync/motion-engine';
import { useMemo } from 'react';
import { AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three';
import { createRouteRibbonTexture } from './cityArtwork';

interface RouteLineProps {
  route: CityRoute;
  /** Fraction of the route drawn, 0..1. */
  progress: number;
  /** Ribbon width in metres. */
  width?: number;
}

/** Metres of ribbon per chevron repeat. */
const CHEVRON_METRES = 26;

/** Lay the route flat on the road as a two-vertex-wide ribbon. */
function buildRibbon(
  route: CityRoute,
  width: number,
): { geometry: BufferGeometry; segments: number } {
  const points = route.points;
  const count = points.length;
  const half = width / 2;
  const y = 0.06;

  const positions = new Float32Array(count * 6);
  const uvs = new Float32Array(count * 4);
  const indices: number[] = [];

  for (let i = 0; i < count; i++) {
    const point = points[i];
    const previous = points[Math.max(0, i - 1)];
    const next = points[Math.min(count - 1, i + 1)];
    if (!point || !previous || !next) continue;
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length;
    const nz = dx / length;
    const v = count > 1 ? i / (count - 1) : 0;

    positions.set(
      [point.x + nx * half, y, point.z + nz * half, point.x - nx * half, y, point.z - nz * half],
      i * 6,
    );
    uvs.set([0, v, 1, v], i * 4);
  }

  for (let i = 0; i < count - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return { geometry, segments: Math.max(0, count - 1) };
}

/**
 * The "roadmap in motion": a glowing route ribbon painted down the boulevard
 * that draws itself in as the film plays, with a pulsing head marker at the tip.
 *
 * The ribbon is one geometry revealed with `setDrawRange`, so drawing it is
 * frame-exact and free of per-frame geometry rebuilds.
 */
export const RouteLine: React.FC<RouteLineProps> = ({ route, progress, width = 0.9 }) => {
  const { geometry, segments } = useMemo(() => buildRibbon(route, width), [route, width]);
  const texture = useMemo(() => {
    const created = createRouteRibbonTexture();
    created.repeat.set(1, Math.max(1, route.length / CHEVRON_METRES));
    return created;
  }, [route.length]);

  const visible = Math.max(0, Math.min(1, progress));
  geometry.setDrawRange(0, Math.floor(visible * segments) * 6);

  const head = sampleCityRoute(route, visible);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          map={texture}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {visible > 0 && (
        <group position={[head.x, 0, head.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
            <ringGeometry args={[0.55, 0.95, 40]} />
            <meshBasicMaterial
              color="#ff2a44"
              transparent
              opacity={0.9}
              blending={AdditiveBlending}
              depthWrite={false}
              side={DoubleSide}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <sphereGeometry args={[0.28, 20, 14]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </group>
      )}
    </group>
  );
};
