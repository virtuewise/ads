import { useMemo } from 'react';
import type { CanvasTexture } from 'three';
import type { CityCrossing } from '@printsync/motion-engine';
import { getCrossingTexture } from './cityArtwork';

interface CrossingProps {
  crossing: CityCrossing;
  /** Shared overlay texture, so every crossing is the same worn paint. */
  texture: CanvasTexture;
}

/**
 * A zebra crossing painted onto the carriageway. It is an alpha overlay rather
 * than part of the road texture, because crossings sit at fixed points on the
 * street while lane markings repeat with the road.
 */
export const Crossing: React.FC<CrossingProps> = ({ crossing, texture }) => {
  const map = useMemo(() => {
    const clone = texture.clone();
    clone.wrapS = texture.wrapS;
    clone.wrapT = texture.wrapT;
    clone.needsUpdate = true;
    return clone;
  }, [texture]);

  return (
    <mesh
      position={[crossing.position[0], crossing.position[1], crossing.position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[crossing.width, crossing.depth]} />
      <meshBasicMaterial map={map} transparent alphaTest={0.35} depthWrite={false} toneMapped={false} />
    </mesh>
  );
};

/** The shared zebra texture, created once for the whole street. */
export function useCrossingTexture(): CanvasTexture {
  return useMemo(() => getCrossingTexture(), []);
}
