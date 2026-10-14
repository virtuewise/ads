import { ContactShadows, Environment, Lightformer } from '@react-three/drei';

/**
 * A single, shared studio rig. Every composition that renders catalogue items
 * uses this so lighting, environment, background and floor are consistent.
 *
 * The environment map is built procedurally from Lightformers (softbox panels)
 * — no external HDRI file needed — giving glass, foil and metal surfaces
 * realistic studio reflections. ContactShadows ground each item with a soft,
 * blurred shadow directly beneath it.
 */
export const Studio: React.FC = () => {
  return (
    <>
      <color attach="background" args={['#0a0a0a']} />
      <fog attach="fog" args={['#0a0a0a', 9, 20]} />

      {/* Key / fill / rim lights */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 9, 6]} intensity={1.8} color="#ffffff" />
      <directionalLight position={[-6, 4, -5]} intensity={0.7} color="#8fb7ff" />
      <pointLight position={[0, 3.5, 6]} intensity={28} color="#ffffff" />
      <pointLight position={[0, 1.2, -6]} intensity={14} color="#c8001c" />

      {/* Procedural studio environment — softbox reflections for glossy surfaces */}
      <Environment resolution={128} frames={1} background={false}>
        {/* Large overhead softbox */}
        <Lightformer
          form="rect"
          intensity={3}
          color="#ffffff"
          position={[0, 5, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[10, 10, 1]}
        />
        {/* Key softbox — front right */}
        <Lightformer
          form="rect"
          intensity={2.5}
          color="#ffffff"
          position={[4, 3, 4]}
          rotation={[0, -Math.PI / 4, 0]}
          scale={[6, 4, 1]}
        />
        {/* Fill softbox — front left */}
        <Lightformer
          form="rect"
          intensity={1.2}
          color="#dfe8ff"
          position={[-5, 2, 3]}
          rotation={[0, Math.PI / 3, 0]}
          scale={[5, 3, 1]}
        />
        {/* Rim strip — behind */}
        <Lightformer
          form="rect"
          intensity={1.5}
          color="#ffffff"
          position={[0, 4, -5]}
          rotation={[0, Math.PI, 0]}
          scale={[8, 2, 1]}
        />
        {/* Brand-red accent strip */}
        <Lightformer
          form="rect"
          intensity={0.6}
          color="#c8001c"
          position={[0, 1, 5]}
          rotation={[0, 0, 0]}
          scale={[12, 0.5, 1]}
        />
      </Environment>

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[16, 96]} />
        <meshStandardMaterial color="#101012" roughness={0.55} metalness={0.25} />
      </mesh>

      {/* Soft contact shadow — grounds every item */}
      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={0.55}
        scale={14}
        blur={2.5}
        far={4}
        resolution={256}
        color="#000000"
      />
    </>
  );
};
