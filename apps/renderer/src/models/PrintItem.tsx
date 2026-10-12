import { useMemo } from 'react';
import type { PrintItemSpec } from '@printsync/motion-engine';
import { createItemParts } from './geometry';
import { materialConfig } from './materials';

interface PrintItemProps {
  spec: PrintItemSpec;
  /** Uniform display scale, applied about the item's base. */
  scale?: number;
}

/**
 * Renders a single catalogue item. Geometry is generated once from the
 * millimetre spec and shared across frames; the item is always grounded at
 * Y = 0 and faces +Z, so every product lines up consistently.
 */
export const PrintItem: React.FC<PrintItemProps> = ({ spec, scale = 1 }) => {
  const parts = useMemo(() => createItemParts(spec), [spec]);

  return (
    <group scale={scale}>
      {parts.map((part, index) => (
        <mesh key={index} geometry={part.geometry}>
          <meshPhysicalMaterial {...materialConfig(part.material)} />
        </mesh>
      ))}
    </group>
  );
};
