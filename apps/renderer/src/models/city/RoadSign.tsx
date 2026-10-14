import {
  type CityPalette,
  type CitySign,
  type RoadSignSpec,
  roadSignOutlinePoints,
  roadSignSceneHeight,
  roadSignSceneMountHeight,
  roadSignSceneWidth,
  SIGN_PANEL_MM,
  toSceneUnits,
} from '@printsync/motion-engine';
import { useMemo } from 'react';
import { BufferAttribute, ExtrudeGeometry, Shape, ShapeGeometry } from 'three';
import { createSignFaceTexture } from './cityArtwork';

interface RoadSignProps {
  slot: CitySign;
  sign: RoadSignSpec;
  palette: CityPalette;
}

/** Minimum panel thickness in metres, purely so the edge is visible on screen. */
const MIN_PANEL_THICKNESS = 0.02;

/**
 * A roadside sign built to its exact catalogue face size.
 *
 * The face outline comes from the same pure `roadSignOutlinePoints` the artwork
 * uses, so the physical panel and its printed legend can never disagree about
 * shape. UVs are normalised onto the face's bounding box so the printed design
 * lands exactly on the panel, triangles and octagons included.
 */
export const RoadSign: React.FC<RoadSignProps> = ({ slot, sign, palette }) => {
  const width = roadSignSceneWidth(sign);
  const height = roadSignSceneHeight(sign);
  const mount = roadSignSceneMountHeight(sign);
  const thickness = Math.max(MIN_PANEL_THICKNESS, toSceneUnits(sign.thickness ?? SIGN_PANEL_MM));

  const shape = useMemo(() => {
    const s = new Shape();
    roadSignOutlinePoints(sign.kind).forEach(([px, py], index) => {
      const x = px * width;
      const y = py * height;
      if (index === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    });
    s.closePath();
    return s;
  }, [sign.kind, width, height]);

  const faceGeometry = useMemo(() => {
    const geometry = new ShapeGeometry(shape);
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    if (position instanceof BufferAttribute && uv instanceof BufferAttribute) {
      for (let i = 0; i < position.count; i++) {
        uv.setXY(i, position.getX(i) / width + 0.5, position.getY(i) / height + 0.5);
      }
      uv.needsUpdate = true;
    }
    return geometry;
  }, [shape, width, height]);

  const bodyGeometry = useMemo(() => {
    const geometry = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geometry.translate(0, 0, -thickness / 2);
    return geometry;
  }, [shape, thickness]);

  const face = useMemo(() => createSignFaceTexture(sign), [sign]);

  const postCount: 1 | 2 = sign.posts ?? (sign.width > 900 ? 2 : 1);
  const postOffsets = postCount === 2 ? [-width * 0.3, width * 0.3] : [0];

  return (
    <group
      position={[slot.position[0], slot.position[1], slot.position[2]]}
      rotation={[0, slot.rotationY, 0]}
    >
      {/* Panel body, seen as aluminium from behind and at the edge. */}
      <mesh geometry={bodyGeometry} position={[0, mount + height / 2, 0]} castShadow>
        <meshStandardMaterial color="#b9bdc4" metalness={0.45} roughness={0.5} />
      </mesh>

      {/* Printed, retro-reflective face. */}
      <mesh geometry={faceGeometry} position={[0, mount + height / 2, thickness / 2 + 0.003]}>
        <meshStandardMaterial
          map={face}
          emissiveMap={face}
          emissive="#ffffff"
          emissiveIntensity={palette.windowIntensity * 0.22}
          roughness={0.34}
          metalness={0.05}
        />
      </mesh>

      {/* Supports. */}
      {postOffsets.map((offset) => (
        <mesh key={offset} position={[offset, mount / 2, -thickness]} castShadow>
          <cylinderGeometry args={[0.045, 0.06, mount, 8]} />
          <meshStandardMaterial color="#9aa0a8" metalness={0.6} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
};
