/**
 * A single, shared studio rig. Every composition that renders catalogue items
 * uses this so lighting, background and floor are perfectly consistent.
 */
export const Studio: React.FC = () => {
  return (
    <>
      <color attach="background" args={['#0a0a0a']} />
      <fog attach="fog" args={['#0a0a0a', 9, 20]} />

      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 9, 6]} intensity={2.4} color="#ffffff" />
      <directionalLight position={[-6, 4, -5]} intensity={0.9} color="#8fb7ff" />
      <pointLight position={[0, 3.5, 6]} intensity={40} color="#ffffff" />
      <pointLight position={[0, 1.2, -6]} intensity={18} color="#c8001c" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[16, 96]} />
        <meshStandardMaterial color="#101012" roughness={0.55} metalness={0.25} />
      </mesh>
    </>
  );
};
