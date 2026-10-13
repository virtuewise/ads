import { useMemo } from 'react';
import { BackSide } from 'three';
import type { CityPalette } from '@printsync/motion-engine';
import { createSkyTexture } from './cityArtwork';

interface CityEnvironmentProps {
  palette: CityPalette;
  /** Half-length of the city; fog, dome and ground scale with it. */
  extent: number;
}

/**
 * The living city's atmosphere: a gradient night dome with horizon city-glow,
 * distance fog that melts the far city into the horizon, and a simple
 * ambient / hemisphere / sun rig driven by the shared time-of-day palette.
 *
 * Deliberately light on real light sources — emissive signage and window
 * emissives carry the illumination, which is both accurate for a night city and
 * keeps the render fast.
 */
export const CityEnvironment: React.FC<CityEnvironmentProps> = ({ palette, extent }) => {
  const sky = useMemo(() => createSkyTexture(palette), [palette]);
  const domeRadius = extent * 3;
  const groundSize = extent * 6;
  const [sx, sy, sz] = palette.sunDirection;

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
