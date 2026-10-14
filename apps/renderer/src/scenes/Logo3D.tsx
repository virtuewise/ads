import { ThreeCanvas } from '@remotion/three';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const BRAND = '#c8001c';

interface LogoMarkProps {
  frame: number;
  fps: number;
}

const LogoMark: React.FC<LogoMarkProps> = ({ frame, fps }) => {
  const time = frame / fps;
  // Slow, confident rotation — derived from the frame so every frame is
  // deterministic and independently renderable.
  const rotationY = time * 0.9;
  const rotationX = Math.sin(time * 0.8) * 0.22;
  const scale = interpolate(frame, [0, 24], [0.6, 1], {
    extrapolateRight: 'clamp',
    easing: (t) => 1 - (1 - t) ** 3,
  });

  return (
    <group rotation={[rotationX, rotationY, 0]} scale={scale}>
      <mesh>
        <torusKnotGeometry args={[1, 0.3, 240, 32]} />
        <meshStandardMaterial color={BRAND} metalness={0.85} roughness={0.18} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.95, 0.015, 16, 160]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
      </mesh>
      <mesh rotation={[Math.PI / 2, Math.PI / 3, 0]}>
        <torusGeometry args={[2.35, 0.01, 16, 160]} />
        <meshBasicMaterial color={BRAND} transparent opacity={0.5} />
      </mesh>
    </group>
  );
};

/**
 * A programmatic, WebGL logo mark rendered with React Three Fiber inside
 * Remotion. Fully frame-addressable: no timers, no external assets.
 */
export const Logo3D: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  return (
    <ThreeCanvas width={width} height={height} camera={{ position: [0, 0, 5], fov: 42 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 5]} intensity={2.4} color="#ffffff" />
      <pointLight position={[4, -3, -4]} intensity={45} color={BRAND} />
      <LogoMark frame={frame} fps={fps} />
    </ThreeCanvas>
  );
};
