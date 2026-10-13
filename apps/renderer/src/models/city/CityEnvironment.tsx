import { useMemo } from 'react';
import { Environment } from '@react-three/drei';
import { staticFile } from 'remotion';
import { BackSide, Euler } from 'three';
import type { CityPalette, TimeOfDay } from '@printsync/motion-engine';
import { createSkyTexture } from './cityArtwork';

/**
 * A real, photographic high-dynamic-range sky per time of day, used as the
 * scene's image-based lighting. These are CC0 Poly Haven skies, shipped with the
 * renderer (see `public/hdri/README.md`), so ambient light and reflections carry
 * the colour of an actual sky rather than a flat ambient term.
 */
const HDRI: Record<TimeOfDay, string> = {
  night: 'hdri/pedestrian_overpass_1k.hdr',
  dusk: 'hdri/venice_sunset_1k.hdr',
  day: 'hdri/spruit_sunrise_1k.hdr',
};

interface CityEnvironmentProps {
  palette: CityPalette;
  timeOfDay: TimeOfDay;
  /** Half-length of the city; fog, dome and ground scale with it. */
  extent: number;
}

/**
 * The living city's atmosphere: a night dome with stars, a moon and a warm
 * horizon light-dome by night (a hazy sun by day), distance fog that melts the
 * far city into the horizon, and a real HDRI for image-based lighting.
 *
 * Deliberately light on real light sources — an HDRI plus emissive signage and
 * window emissives carry the illumination, which is both accurate for a night
 * city and keeps the render fast.
 */
export const CityEnvironment: React.FC<CityEnvironmentProps> = ({
  palette,
  timeOfDay,
  extent,
}) => {
  const sky = useMemo(() => createSkyTexture(palette, timeOfDay), [palette, timeOfDay]);
  const domeRadius = extent * 3;
  const groundSize = extent * 6;
  const [sx, sy, sz] = palette.sunDirection;
  // Face the environment so its sun lands where the palette puts the light.
  const environmentRotation = useMemo(() => new Euler(0, Math.atan2(sx, sz), 0), [sx, sz]);

  return (
    <>
      <color attach="background" args={[palette.skyTop]} />
      <fog attach="fog" args={[palette.fog, extent * 0.3, extent * 2.6]} />

      <ambientLight color={palette.ambient} intensity={palette.ambientIntensity} />
      <hemisphereLight
        color={palette.skyHorizon}
        groundColor={palette.ground}
        intensity={palette.ambientIntensity * 0.9}
      />
      <directionalLight
        position={[sx * extent, sy * extent, sz * extent]}
        color={palette.sun}
        intensity={palette.sunIntensity}
      />

      {/* Real HDRI, used purely for image-based lighting: it is what gives the
          glass, metal and tarmac their live reflections. The painted dome below
          stays the visible sky. */}
      <Environment
        files={staticFile(HDRI[timeOfDay])}
        background={false}
        environmentIntensity={palette.sunIntensity * 0.55}
        environmentRotation={environmentRotation}
      />

      {/* Ground plane under the whole city. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial color={palette.ground} roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Sky dome. */}
      <mesh>
        <sphereGeometry args={[domeRadius, 32, 16]} />
        <meshBasicMaterial
          map={sky}
          side={BackSide}
          fog={false}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </>
  );
};
