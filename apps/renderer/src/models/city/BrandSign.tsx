import type { CityBrandSign, CityPalette } from '@printsync/motion-engine';
import { useMemo } from 'react';
import { DoubleSide } from 'three';
import { createBrandSignTexture } from './cityArtwork';

interface BrandSignProps {
  sign: CityBrandSign;
  palette: CityPalette;
  wordmark: string;
  primary: string;
  paper: string;
}

/** Height of the legs a roof sign stands on, in metres. */
const LEG_HEIGHT = 0.9;

/**
 * A PrintSync building sign: the real roundel locked up with the wordmark, as
 * fabricated for the two places it actually goes — a roof sign on the skyline and
 * a fascia sign over an entrance.
 *
 * Internally illuminated, so it holds its colour at night without a light source
 * per sign; the emissive map is the sign face itself.
 */
export const BrandSign: React.FC<BrandSignProps> = ({
  sign,
  palette,
  wordmark,
  primary,
  paper,
}) => {
  const map = useMemo(
    () => createBrandSignTexture(wordmark, primary, paper, sign.mount),
    [wordmark, primary, paper, sign.mount],
  );

  const night = palette.windowIntensity > 0.8;
  const glow = sign.mount === 'roof' ? palette.floodlitIntensity * 1.5 : palette.floodlitIntensity;

  return (
    <group
      position={[sign.position[0], sign.position[1], sign.position[2]]}
      rotation={[0, sign.rotationY, 0]}
    >
      <mesh>
        <planeGeometry args={[sign.width, sign.height]} />
        <meshStandardMaterial
          map={map}
          emissiveMap={map}
          emissive="#ffffff"
          emissiveIntensity={night ? glow : 0.05}
          side={DoubleSide}
          roughness={0.6}
          metalness={0.1}
          toneMapped={!night}
        />
      </mesh>

      {/* Fabricated legs, so a roof sign stands on its building. */}
      {sign.mount === 'roof' &&
        [-sign.width * 0.32, sign.width * 0.32].map((x) => (
          <mesh key={x} position={[x, -sign.height / 2 - LEG_HEIGHT / 2, -0.12]}>
            <boxGeometry args={[0.16, LEG_HEIGHT, 0.16]} />
            <meshStandardMaterial color={palette.facade} roughness={0.6} metalness={0.4} />
          </mesh>
        ))}
    </group>
  );
};
