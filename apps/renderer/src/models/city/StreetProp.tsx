import type { CityPalette, CityProp, CityPropKind } from '@printsync/motion-engine';

interface StreetPropProps {
  prop: CityProp;
  palette: CityPalette;
}

const SIGNAL_RED = '#e02020';
const SIGNAL_AMBER = '#f0a020';
const SIGNAL_GREEN = '#20c060';
const SIGNAL_CASE = '#1a1d22';

/** Public-realm furniture dims with the palette, so it never glows by day. */
function furnitureColour(palette: CityPalette): string {
  return palette.facade;
}

function SignalHead({ palette, lit }: { palette: CityPalette; lit: 'red' | 'green' }) {
  return (
    <group position={[0, 3.05, 0.16]}>
      <mesh>
        <boxGeometry args={[0.34, 0.98, 0.28]} />
        <meshStandardMaterial color={SIGNAL_CASE} roughness={0.6} metalness={0.3} />
      </mesh>
      {(
        [
          [SIGNAL_RED, 0.31, 'red'],
          [SIGNAL_AMBER, 0, 'amber'],
          [SIGNAL_GREEN, -0.31, 'green'],
        ] as const
      ).map(([colour, y, name]) => {
        const on = name === lit;
        return (
          <mesh key={name} position={[0, y, 0.15]}>
            <circleGeometry args={[0.11, 16]} />
            <meshBasicMaterial
              color={colour}
              toneMapped={false}
              transparent
              opacity={on ? 1 : 0.22}
            />
          </mesh>
        );
      })}
      <mesh position={[0, 1.03, -0.1]}>
        <boxGeometry args={[0.1, 0.14, 0.2]} />
        <meshStandardMaterial color={SIGNAL_CASE} roughness={0.7} />
      </mesh>
      {palette.windowIntensity > 0.8 && (
        <pointLight
          color={lit === 'red' ? SIGNAL_RED : SIGNAL_GREEN}
          intensity={26}
          distance={9}
          decay={2}
        />
      )}
    </group>
  );
}

/**
 * The small pieces of public realm that make a street read as a real one:
 * bollards, litter bins, planters, benches, hydrants, a traffic signal and a bus
 * shelter. Each is built to a plausible real size, and each is a pure function
 * of its layout entry.
 */
export const StreetProp: React.FC<StreetPropProps> = ({ prop, palette }) => {
  const colour = furnitureColour(palette);
  const night = palette.windowIntensity > 0.8;

  const render = (kind: CityPropKind) => {
    switch (kind) {
      case 'bollard':
        return (
          <>
            <mesh position={[0, 0.5, 0]} castShadow>
              <cylinderGeometry args={[0.075, 0.09, 1, 10]} />
              <meshStandardMaterial color={colour} roughness={0.5} metalness={0.45} />
            </mesh>
            {night && (
              <mesh position={[0, 0.94, 0]}>
                <sphereGeometry args={[0.085, 10, 8]} />
                <meshBasicMaterial color="#d8e4ff" toneMapped={false} />
              </mesh>
            )}
          </>
        );

      case 'bin':
        return (
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.24, 1.1, 12]} />
            <meshStandardMaterial color={colour} roughness={0.62} metalness={0.35} />
          </mesh>
        );

      case 'planter':
        return (
          <group>
            <mesh position={[0, 0.42, 0]} castShadow>
              <boxGeometry args={[1.5, 0.84, 0.62]} />
              <meshStandardMaterial color={colour} roughness={0.8} metalness={0.1} />
            </mesh>
            <mesh position={[0, 0.92, 0]}>
              <boxGeometry args={[1.34, 0.28, 0.5]} />
              <meshStandardMaterial color="#233024" roughness={0.95} />
            </mesh>
          </group>
        );

      case 'bench':
        return (
          <group>
            <mesh position={[0, 0.45, 0]} castShadow>
              <boxGeometry args={[1.8, 0.09, 0.5]} />
              <meshStandardMaterial color={colour} roughness={0.62} metalness={0.28} />
            </mesh>
            <mesh position={[0, 0.68, -0.24]} rotation={[-0.18, 0, 0]}>
              <boxGeometry args={[1.8, 0.42, 0.07]} />
              <meshStandardMaterial color={colour} roughness={0.62} metalness={0.28} />
            </mesh>
            {[-0.76, 0.76].map((x) => (
              <mesh key={x} position={[x, 0.22, 0]}>
                <boxGeometry args={[0.07, 0.45, 0.44]} />
                <meshStandardMaterial color="#23262b" roughness={0.7} metalness={0.3} />
              </mesh>
            ))}
          </group>
        );

      case 'hydrant':
        return (
          <mesh position={[0, 0.34, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.15, 0.68, 10]} />
            <meshStandardMaterial color="#8d2a24" roughness={0.6} metalness={0.25} />
          </mesh>
        );

      case 'signal':
        return (
          <group>
            <mesh position={[0, 1.6, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.1, 3.2, 10]} />
              <meshStandardMaterial color={SIGNAL_CASE} roughness={0.6} metalness={0.4} />
            </mesh>
            <SignalHead palette={palette} lit={prop.position[2] > 0 ? 'green' : 'red'} />
          </group>
        );

      case 'shelter':
        return (
          <group>
            <mesh position={[0, 1.35, -0.9]} rotation={[0.06, 0, 0]}>
              <boxGeometry args={[4.2, 2.6, 0.1]} />
              <meshStandardMaterial
                color="#1b2b3a"
                roughness={0.12}
                metalness={0.5}
                transparent
                opacity={0.42}
              />
            </mesh>
            <mesh position={[0, 2.72, -0.45]} castShadow>
              <boxGeometry args={[4.4, 0.12, 1.1]} />
              <meshStandardMaterial color={colour} roughness={0.55} metalness={0.4} />
            </mesh>
            {[-2.05, 2.05].map((x) => (
              <mesh key={x} position={[x, 1.35, -0.85]} castShadow>
                <boxGeometry args={[0.12, 2.7, 0.14]} />
                <meshStandardMaterial color={colour} roughness={0.55} metalness={0.4} />
              </mesh>
            ))}
            <mesh position={[0, 0.46, -0.3]}>
              <boxGeometry args={[3.4, 0.08, 0.42]} />
              <meshStandardMaterial color={colour} roughness={0.6} metalness={0.35} />
            </mesh>
            {night && (
              <mesh position={[0, 2.62, -0.42]} rotation={[Math.PI / 2, 0, 0]}>
                <planeGeometry args={[3.6, 0.7]} />
                <meshBasicMaterial color="#fff2d8" toneMapped={false} transparent opacity={0.5} />
              </mesh>
            )}
          </group>
        );

      default:
        return null;
    }
  };

  return (
    <group
      position={[prop.position[0], prop.position[1], prop.position[2]]}
      rotation={[0, prop.rotationY, 0]}
    >
      {render(prop.kind)}
    </group>
  );
};
