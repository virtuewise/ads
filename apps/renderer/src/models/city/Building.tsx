import { useMemo } from 'react';
import { MeshStandardMaterial, type Texture } from 'three';
import type { CityBuilding, CityPalette, CityShopfront } from '@printsync/motion-engine';
import { cloneWithRepeat, getFacadeTextures, type WindowVariant } from './cityArtwork';

interface BuildingProps {
  building: CityBuilding;
  palette: CityPalette;
  /**
   * The shopfront on this building's ground floor, if it has one. It opens the
   * mass at street level and pushes a rear wall back behind the retail fit-out.
   * The generator guarantees the opening fits with mass left above it.
   */
  shopfront?: CityShopfront;
}

/** Metres per window bay, so window sizes read consistently on every facade. */
const BAY_METRES = 3.2;
const FLOOR_METRES = 3.6;

function facadeVariant(tint: number): WindowVariant {
  if (tint < 0.34) return 'warm';
  if (tint < 0.67) return 'cool';
  return 'mixed';
}

/**
 * A single city block: a boxed mass with a window grid mapped to the correct
 * scale on every face (so windows never stretch), a parapet, and — for the
 * taller towers — a rooftop plant room that gives the skyline some silhouette.
 *
 * `BoxGeometry` has six material groups (+x, -x, +y, -y, +z, -z); the four wall
 * groups get their own cloned texture whose `repeat` matches that face's real
 * metres, while the roof and underside stay plain.
 *
 * When the block has a shopfront, the mass starts at the shopfront head height
 * and a smaller rear box closes the ground floor behind the shop, so the retail
 * unit is a real void in the building rather than a picture of a window.
 */
export const Building: React.FC<BuildingProps> = ({ building, palette, shopfront }) => {
  const { width, depth, height, style, tint, litRatio } = building;

  // The generator only puts a shopfront on a block tall enough to take the
  // opening with storeys left above it, so the mass starts exactly at the head
  // height and the opening fits under it.
  const shopH = shopfront ? shopfront.height : 0;
  const shopDepth = shopfront ? shopfront.depth : 0;
  const upperH = Math.max(1, height - shopH);

  const materials = useMemo(() => {
    const { map, emissive } = getFacadeTextures(facadeVariant(tint), palette);
    const sideXMap = cloneWithRepeat(map, depth / BAY_METRES, upperH / FLOOR_METRES);
    const sideXGlow = cloneWithRepeat(emissive, depth / BAY_METRES, upperH / FLOOR_METRES);
    const sideZMap = cloneWithRepeat(map, width / BAY_METRES, upperH / FLOOR_METRES);
    const sideZGlow = cloneWithRepeat(emissive, width / BAY_METRES, upperH / FLOOR_METRES);

    const wall = (mapTexture: Texture, glowTexture: Texture) =>
      new MeshStandardMaterial({
        color: '#ffffff',
        map: mapTexture,
        emissiveMap: glowTexture,
        emissive: palette.windowColour,
        emissiveIntensity: palette.windowIntensity * litRatio,
        roughness: 0.68,
        metalness: 0.1,
      });

    const roof = new MeshStandardMaterial({
      color: palette.ground,
      roughness: 0.9,
      metalness: 0.08,
    });

    return [
      wall(sideXMap, sideXGlow),
      wall(sideXMap, sideXGlow),
      roof,
      roof,
      wall(sideZMap, sideZGlow),
      wall(sideZMap, sideZGlow),
    ];
  }, [width, depth, upperH, tint, litRatio, palette]);

  return (
    <group position={[building.position[0], building.position[1], building.position[2]]}>
      <mesh position={[0, shopH + upperH / 2, 0]} material={materials}>
        <boxGeometry args={[width, upperH, depth]} />
      </mesh>

      {/* Behind a shopfront, a rear box closes the ground floor so the retail
          unit reads as a void in the mass rather than a facade treatment. */}
      {shopfront && (
        <mesh position={[building.side * (shopDepth / 2), shopH / 2, 0]}>
          <boxGeometry args={[Math.max(0.4, width - shopDepth), shopH, depth]} />
          <meshStandardMaterial color={palette.facade} roughness={0.85} metalness={0.08} />
        </mesh>
      )}

      {/* Parapet. */}
      <mesh position={[0, height + 0.3, 0]}>
        <boxGeometry args={[width + 0.5, 0.6, depth + 0.5]} />
        <meshStandardMaterial color={palette.facade} roughness={0.6} metalness={0.25} />
      </mesh>

      {/* Rooftop plant room on the towers. */}
      {style === 'tower' && (
        <group position={[width * 0.14, height + 0.6, -depth * 0.12]}>
          <mesh position={[0, height * 0.06, 0]}>
            <boxGeometry args={[width * 0.42, height * 0.12, depth * 0.4]} />
            <meshStandardMaterial
              color={palette.facade}
              emissive={palette.windowColour}
              emissiveIntensity={palette.windowIntensity * litRatio * 0.5}
              roughness={0.7}
            />
          </mesh>
          <mesh position={[width * 0.1, height * 0.18, 0]}>
            <cylinderGeometry args={[0.06, 0.09, height * 0.18, 6]} />
            <meshStandardMaterial color={palette.facade} metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      )}
    </group>
  );
};
