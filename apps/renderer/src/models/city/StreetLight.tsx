import type { CityPalette, CityStreetLight } from '@printsync/motion-engine';
import { AdditiveBlending } from 'three';
import { getGlowTexture, getLightPoolTexture } from './cityArtwork';

/** Sodium-warm lamp colour. */
const LAMP = '#fff1d6';

/** Radius of the pool each lamp throws on the carriageway, in metres. */
const POOL_SIZE = 19;

interface StreetLightProps {
  light: CityStreetLight;
  palette: CityPalette;
}

/** Column height to the luminaire, in metres. */
export const STREET_LIGHT_HEIGHT = 9;

/**
 * A kerbside street light. The group is oriented so local +z points at the
 * carriageway, so the arm always reaches out over the road.
 *
 * The luminaire is emissive rather than a real light source: the scene's light
 * budget goes on a few strategic pool lights, which keeps the render fast. What
 * makes it read as a real lamp, though, is the pair of additive touches — a glow
 * sprite around the lantern (the halo you actually see through the air) and a
 * pool of light on the tarmac beneath it.
 */
export const StreetLight: React.FC<StreetLightProps> = ({ light, palette }) => {
  const glow = palette.windowIntensity * 0.5;
  const nightness = Math.min(1, palette.windowIntensity / 2);
  const pool = getLightPoolTexture(LAMP);
  const halo = getGlowTexture(LAMP);

  return (
    <group
      position={[light.position[0], light.position[1], light.position[2]]}
      rotation={[0, light.rotationY, 0]}
    >
      {/* Column. */}
      <mesh position={[0, STREET_LIGHT_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.15, STREET_LIGHT_HEIGHT, 8]} />
        <meshStandardMaterial color={palette.facade} metalness={0.55} roughness={0.45} />
      </mesh>

      {/* Arm out over the carriageway. */}
      <mesh position={[0, STREET_LIGHT_HEIGHT - 0.2, 1.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 2.2, 8]} />
        <meshStandardMaterial color={palette.facade} metalness={0.55} roughness={0.45} />
      </mesh>

      {/* Luminaire. */}
      <mesh position={[0, STREET_LIGHT_HEIGHT - 0.32, 2.15]}>
        <boxGeometry args={[0.5, 0.2, 0.95]} />
        <meshStandardMaterial
          color={LAMP}
          emissive={LAMP}
          emissiveIntensity={glow}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>

      {/* Emissive underside, so the lamp reads as lit from below. */}
      <mesh position={[0, STREET_LIGHT_HEIGHT - 0.44, 2.15]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.44, 0.86]} />
        <meshBasicMaterial color={LAMP} toneMapped={false} />
      </mesh>

      {/* Halo: the glow the lantern throws through the air. */}
      <sprite position={[0, STREET_LIGHT_HEIGHT - 0.34, 2.15]} scale={[4.4, 4.4, 1]}>
        <spriteMaterial
          map={halo}
          color={LAMP}
          transparent
          opacity={0.42 * nightness}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>

      {/* Pool of light on the tarmac beneath the lantern. */}
      <mesh position={[0, 0.025, 2.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[POOL_SIZE, POOL_SIZE]} />
        <meshBasicMaterial
          map={pool}
          transparent
          opacity={0.5 * nightness}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};
