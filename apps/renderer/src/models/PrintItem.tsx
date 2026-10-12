import { useMemo } from 'react';
import { DoubleSide } from 'three';
import {
  buildArtworkSpec,
  type BrandTokens,
  type PrintItemSpec,
} from '@printsync/motion-engine';
import { createItemParts } from './geometry';
import { createItemDecal } from './decal';
import { createArtworkTexture } from './artwork';
import { materialConfig } from './materials';

interface PrintItemProps {
  spec: PrintItemSpec;
  brand?: BrandTokens;
  /** Uniform display scale, applied about the item's base. */
  scale?: number;
}

/**
 * Renders a single catalogue item with procedurally-drawn brand artwork on its
 * front face (or a wrap label for revolved containers). Geometry and textures
 * are generated once from the millimetre spec and shared across frames; the item
 * is always grounded at Y = 0 and faces +Z, so every product lines up consistently.
 */
export const PrintItem: React.FC<PrintItemProps> = ({ spec, brand, scale = 1 }) => {
  const parts = useMemo(() => createItemParts(spec), [spec]);
  const decalGeometry = useMemo(() => createItemDecal(spec), [spec]);
  const artworkTexture = useMemo(
    () => createArtworkTexture(buildArtworkSpec(spec, brand)),
    [spec, brand],
  );

  return (
    <group scale={scale}>
      {parts.map((part, index) => (
        <mesh key={index} geometry={part.geometry}>
          <meshPhysicalMaterial {...materialConfig(part.material)} />
        </mesh>
      ))}
      {decalGeometry && (
        <mesh geometry={decalGeometry}>
          <meshStandardMaterial
            map={artworkTexture}
            transparent
            side={DoubleSide}
            roughness={0.4}
            metalness={0}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      )}
    </group>
  );
};
