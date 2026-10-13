import { useMemo } from 'react';
import type { CanvasTexture } from 'three';
import {
  CITY_BOULEVARD_HALF_WIDTH,
  CITY_EXTENT_M,
  CITY_SIDEWALK_WIDTH,
  type CityPalette,
  type CityRoad,
} from '@printsync/motion-engine';
import { ROAD_TILE_METRES, createRoadTexture } from './cityArtwork';

/** Height of the kerb / pavement above the carriageway, in metres. */
export const KERB_HEIGHT = 0.18;

interface RoadSurfaceProps {
  road: CityRoad;
  base: CanvasTexture;
}

function RoadSurface({ road, base }: RoadSurfaceProps) {
  const texture = useMemo(() => {
    const clone = base.clone();
    clone.wrapS = base.wrapS;
    clone.wrapT = base.wrapT;
    clone.repeat.set(1, road.length / ROAD_TILE_METRES);
    clone.needsUpdate = true;
    return clone;
  }, [base, road.length]);

  // A plane lies in XY with u along +x and v along +y; rotating -90° about X
  // lays it flat with v running down -z. An extra quarter-turn returns the
  // markings to running along x for the cross streets.
  const rotation: [number, number, number] =
    road.axis === 'z' ? [-Math.PI / 2, 0, 0] : [-Math.PI / 2, 0, Math.PI / 2];

  return (
    <mesh position={[road.position[0], 0.01, road.position[2]]} rotation={rotation} receiveShadow>
      <planeGeometry args={[road.width, road.length]} />
      <meshStandardMaterial map={texture} roughness={0.88} metalness={0.04} />
    </mesh>
  );
}

interface StreetProps {
  roads: readonly CityRoad[];
  palette: CityPalette;
}

/**
 * The street surface: the carriageway with painted lane markings, plus kerbs
 * and pavements along the boulevard. Lane markings live in the repeating road
 * texture (measured in real metres via `ROAD_TILE_METRES`), so they stay the
 * right size whatever the street length.
 */
export const Street: React.FC<StreetProps> = ({ roads, palette }) => {
  const roadTexture = useMemo(() => createRoadTexture(), []);
  const boulevard = roads.find((road) => road.axis === 'z');
  const pavementLength = boulevard?.length ?? CITY_EXTENT_M * 2 + 60;
  const pavementCentre = CITY_BOULEVARD_HALF_WIDTH + CITY_SIDEWALK_WIDTH / 2;

  return (
    <group>
      {roads.map((road) => (
        <RoadSurface key={road.id} road={road} base={roadTexture} />
      ))}

      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * pavementCentre, KERB_HEIGHT / 2, 0]}
          receiveShadow
        >
          <boxGeometry args={[CITY_SIDEWALK_WIDTH, KERB_HEIGHT, pavementLength]} />
          <meshStandardMaterial color={palette.facade} roughness={0.92} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
};
