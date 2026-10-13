import { useMemo } from 'react';
import type { CanvasTexture } from 'three';
import {
  VEHICLE_SIZES,
  vehiclePoseAt,
  type CityPalette,
  type CityVehicle,
} from '@printsync/motion-engine';
import { canvasTexture, createCanvas, drawBrandMark } from '../artwork';

interface VehicleProps {
  vehicle: CityVehicle;
  /** Seconds into the film; traffic pose is a pure function of this. */
  seconds: number;
  palette: CityPalette;
  /** Colour of the PrintSync livery vehicle's flank branding. */
  brandPrimary: string;
}

const GLASS = '#0b1019';
const TYRE = '#121317';

/**
 * One vehicle, modelled to its real envelope. Built from a body, a glazed
 * cabin, four wheels and emissive lamps — the level of detail that reads
 * correctly at street scale without pretending to be a hero asset.
 *
 * The single PrintSync-liveried van carries the real roundel on its flank, so
 * the brand takes part in the traffic rather than only on the billboards.
 */
function vehicleBrandTexture(wordmark: string, primary: string): CanvasTexture {
  const W = 512;
  const H = 256;
  const { canvas, ctx } = createCanvas(W, H);
  ctx.fillStyle = '#f4f5f7';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = primary;
  ctx.fillRect(0, H * 0.62, W, H * 0.38);
  drawBrandMark(ctx, H * 0.5, H * 0.33, { size: H * 0.52, flatten: primary });
  ctx.fillStyle = '#1b1d21';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${H * 0.2}px Arial, sans-serif`;
  ctx.fillText(wordmark, H * 0.86, H * 0.34);
  return canvasTexture(canvas);
}

export const Vehicle: React.FC<VehicleProps> = ({
  vehicle,
  seconds,
  palette,
  brandPrimary,
}) => {
  const size = VEHICLE_SIZES[vehicle.kind];
  const pose = vehiclePoseAt(vehicle, seconds);
  const night = palette.windowIntensity > 0.8;

  const flank = useMemo(
    () => (vehicle.brand ? vehicleBrandTexture('PRINTSYNC', brandPrimary) : null),
    [vehicle.brand, brandPrimary],
  );

  const bodyColour = vehicle.brand ? '#f4f5f7' : vehicle.colour;
  const bodyY = size.wheelRadius + (size.height - size.wheelRadius) / 2;
  const glassHeight = size.height * (vehicle.kind === 'car' || vehicle.kind === 'taxi' ? 0.4 : 0.3);

  return (
    <group position={[pose.x, 0, pose.z]} rotation={[0, pose.heading, 0]}>
      {/* Body, sitting on its wheels. */}
      <mesh position={[0, bodyY, 0]} castShadow>
        <boxGeometry args={[size.width, size.height - size.wheelRadius, size.length]} />
        <meshStandardMaterial
          color={bodyColour}
          roughness={0.42}
          metalness={0.34}
        />
      </mesh>

      {/* Glazing, inset slightly so it never z-fights the body. */}
      <mesh position={[0, bodyY + (size.height - size.wheelRadius) / 2 - glassHeight / 2, 0]}>
        <boxGeometry args={[size.width * 1.005, glassHeight, size.length * 0.62]} />
        <meshStandardMaterial
          color={GLASS}
          roughness={0.14}
          metalness={0.72}
          emissive={night ? '#0d1626' : '#000000'}
          emissiveIntensity={night ? 0.5 : 0}
        />
      </mesh>

      {flank && (
        <>
          <mesh position={[size.width / 2 + 0.004, bodyY, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[size.length * 0.72, (size.height - size.wheelRadius) * 0.78]} />
            <meshStandardMaterial map={flank} roughness={0.42} metalness={0.18} />
          </mesh>
          <mesh position={[-size.width / 2 - 0.004, bodyY, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[size.length * 0.72, (size.height - size.wheelRadius) * 0.78]} />
            <meshStandardMaterial map={flank} roughness={0.42} metalness={0.18} />
          </mesh>
        </>
      )}

      {/* Wheels at the real wheelbase. */}
      {(
        [
          [size.width / 2, size.wheelBase / 2],
          [-size.width / 2, size.wheelBase / 2],
          [size.width / 2, -size.wheelBase / 2],
          [-size.width / 2, -size.wheelBase / 2],
        ] as const
      ).map(([x, z]) => (
        <mesh
          key={`wheel-${x}-${z}`}
          position={[x, size.wheelRadius, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[size.wheelRadius, size.wheelRadius, 0.22, 14]} />
          <meshStandardMaterial color={TYRE} roughness={0.85} metalness={0.05} />
        </mesh>
      ))}

      {/* Lamps. Full beams read at night; parked and idle vehicles stay dark. */}
      {!vehicle.parked && (
        <>
          <mesh position={[0, bodyY - size.height * 0.12, size.length / 2 + 0.01]}>
            <planeGeometry args={[size.width * 0.78, 0.16]} />
            <meshBasicMaterial
              color="#fff6da"
              toneMapped={false}
              transparent
              opacity={night ? 1 : 0.55}
            />
          </mesh>
          <mesh position={[0, bodyY - size.height * 0.12, -size.length / 2 - 0.01]}>
            <planeGeometry args={[size.width * 0.78, 0.14]} />
            <meshBasicMaterial color="#ff2b1c" toneMapped={false} transparent opacity={0.9} />
          </mesh>
        </>
      )}
    </group>
  );
};
