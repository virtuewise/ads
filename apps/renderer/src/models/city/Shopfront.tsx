import { useMemo } from 'react';
import { AdditiveBlending, DoubleSide } from 'three';
import {
  SHOPFRONT_AWNING_M,
  SHOPFRONT_FASCIA_M,
  hashSeed,
  type CityPalette,
  type CityShopfront,
} from '@printsync/motion-engine';
import {
  createAboardTexture,
  createAwningFabricTexture,
  createBannerTexture,
  createCounterFrontTexture,
  createFasciaTextures,
  createInteriorWallTexture,
  createStripTexture,
  createWindowVinylTexture,
  getLightPoolTexture,
} from './cityArtwork';

interface ShopfrontProps {
  shopfront: CityShopfront;
  palette: CityPalette;
  /** Copy lines for the trade, from the engine — set on the counter and A-board. */
  lines: readonly string[];
  wordmark: string;
  primary: string;
}

/** Height of the solid stall riser under the glazing, in metres. */
const STALL_RISER_M = 0.42;
/** Width of a glazing mullion and its spacing, in metres. */
const MULLION_M = 0.09;
const MULLION_SPACING_M = 2.3;
/** Depth of the shopfront's own side walls: the whole ground floor slab. */

/**
 * A retail shopfront, and everything printed for it.
 *
 * The point of this component is that a shop is a *portfolio*, not a prop. From
 * the street you get the fabrication — piers, stall riser, glazing with its
 * mullions, printed window vinyl, an illuminated fascia, an awning with a
 * printed valance, an A-board on the pavement. Behind the glass you get the fit
 * out: a printed wall graphic, printed counter fronts, shelf-edge strips, a
 * hanging banner and a floor graphic.
 *
 * The interior is deliberately lit by *emissive print* rather than by lights.
 * A shop seen from the street at night is mostly backlit silhouette against a
 * glowing back wall, which is both what it really looks like and what keeps the
 * scene inside a sane light budget. The glow that spills onto the pavement is an
 * additive pool, the same trick the street lights use.
 *
 * Local frame: +Z faces the street, +X runs along it, and the interior occupies
 * z ∈ [-depth, 0].
 */
export const Shopfront: React.FC<ShopfrontProps> = ({
  shopfront,
  palette,
  lines,
  wordmark,
  primary,
}) => {
  const { width: frontW, span, height: h, depth: room, isPrintSync } = shopfront;
  const accent = isPrintSync ? primary : shopfront.accent;
  const night = palette.windowIntensity > 0.8;

  const textures = useMemo(() => {
    const seed = hashSeed(shopfront.id);
    const interior = shopfront.interior;
    return {
      fascia: createFasciaTextures(
        shopfront.name,
        accent,
        shopfront.fasciaKind,
        isPrintSync,
        wordmark,
      ),
      vinyl: createWindowVinylTexture(shopfront.windowKind, shopfront.name, accent, seed),
      wall: createInteriorWallTexture(shopfront.name, accent, interior.backWall, seed ^ 0x9e3779b9),
      counter: createCounterFrontTexture(shopfront.name, accent, lines),
      strip: createStripTexture(shopfront.name, accent),
      valance: createStripTexture(shopfront.name, accent, 40),
      awning: createAwningFabricTexture(accent),
      aboard: createAboardTexture(shopfront.name, accent, lines, isPrintSync, wordmark),
      banner: interior.banner
        ? createBannerTexture(interior.banner, shopfront.name, accent)
        : null,
      spill: getLightPoolTexture(accent),
    };
  }, [shopfront, accent, isPrintSync, wordmark, lines]);

  const halfSpan = span / 2;
  const halfFront = frontW / 2;
  const fasciaH = SHOPFRONT_FASCIA_M;
  const glazingTop = h - fasciaH;
  const glassH = Math.max(1.4, glazingTop - STALL_RISER_M);
  const glazingCentre = STALL_RISER_M + glassH / 2;
  const mullionCount = Math.max(0, Math.round(frontW / MULLION_SPACING_M) - 1);

  const interiorWall = useMemo(
    () => ({
      color: '#d8d2c8',
      emissive: '#ffffff',
      emissiveMap: textures.wall,
      emissiveIntensity: night ? 0.85 : 0.3,
      roughness: 0.9,
      metalness: 0,
    }),
    [textures.wall, night],
  );

  return (
    <group position={[shopfront.position[0], 0, shopfront.position[2]]} rotation={[0, shopfront.rotationY, 0]}>
      {/* --- Interior shell, which is what closes the building's ground floor -- */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -room / 2]}>
        <planeGeometry args={[span, room]} />
        <meshStandardMaterial color={palette.ground} roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h - 0.04, -room / 2]}>
        <planeGeometry args={[span, room]} />
        <meshStandardMaterial
          color="#e6e2da"
          emissive={palette.windowColour}
          emissiveIntensity={night ? 0.55 : 0.22}
          roughness={0.9}
        />
      </mesh>
      <mesh position={[0, h / 2, -room + 0.02]}>
        <planeGeometry args={[span, h]} />
        <meshStandardMaterial map={textures.wall} {...interiorWall} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (halfSpan - 0.03), h / 2, -room / 2]}
          rotation={[0, side * (Math.PI / 2), 0]}
        >
          <planeGeometry args={[room, h]} />
          <meshStandardMaterial
            color="#cfc9bf"
            emissive={palette.windowColour}
            emissiveIntensity={night ? 0.22 : 0.1}
            roughness={0.95}
          />
        </mesh>
      ))}

      {/* --- Printed interior fit-out, seen through the glass ------------------- */}
      {shopfront.interior.counter && (
        <group position={[-halfSpan + 2.1, 0, -room + 1.5]}>
          <mesh position={[0, 0.52, 0]}>
            <boxGeometry args={[2.8, 1.04, 0.62]} />
            <meshStandardMaterial color="#2a2c31" roughness={0.6} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.56, 0.32]}>
            <planeGeometry args={[2.8, 0.96]} />
            <meshStandardMaterial
              map={textures.counter}
              emissive="#ffffff"
              emissiveMap={textures.counter}
              emissiveIntensity={night ? 0.35 : 0.12}
              roughness={0.7}
            />
          </mesh>
          <mesh position={[0, 1.08, 0.02]}>
            <boxGeometry args={[2.9, 0.06, 0.72]} />
            <meshStandardMaterial color="#8f8a82" roughness={0.25} metalness={0.35} />
          </mesh>
        </group>
      )}

      {Array.from({ length: shopfront.interior.shelfBays }, (_, bay) => {
        const bayW = 1.7;
        const x = -halfSpan + 1.2 + bay * (bayW + 0.35);
        return (
          <group key={`bay-${bay}`} position={[x, 0, -room + 0.3]}>
            <mesh position={[0, 1.05, 0]}>
              <boxGeometry args={[bayW, 2.1, 0.42]} />
              <meshStandardMaterial color="#3a3d43" roughness={0.75} metalness={0.15} />
            </mesh>
            {[0.42, 0.98, 1.54, 2.02].map((y) => (
              <mesh key={y} position={[0, y, 0.23]}>
                <planeGeometry args={[bayW, 0.13]} />
                <meshStandardMaterial
                  map={textures.strip}
                  emissive="#ffffff"
                  emissiveMap={textures.strip}
                  emissiveIntensity={night ? 0.5 : 0.15}
                  roughness={0.6}
                />
              </mesh>
            ))}
          </group>
        );
      })}

      {textures.banner && (
        <mesh position={[0.6, h - 0.72, -room / 2]}>
          <planeGeometry args={[3.4, 0.5]} />
          <meshStandardMaterial
            map={textures.banner}
            emissive="#ffffff"
            emissiveMap={textures.banner}
            emissiveIntensity={night ? 0.6 : 0.2}
            side={DoubleSide}
            roughness={0.7}
          />
        </mesh>
      )}

      {shopfront.interior.floorDecal && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.4, 0.03, -1.3]}>
          <planeGeometry args={[2.6, 1.1]} />
          <meshStandardMaterial
            map={textures.strip}
            transparent
            opacity={0.92}
            roughness={0.5}
            metalness={0.1}
          />
        </mesh>
      )}

      {shopfront.interior.standee && (
        <group position={[halfSpan - 1.3, 0, -1.6]} rotation={[0, -0.5, 0]}>
          <mesh position={[0, 0.72, 0]}>
            <planeGeometry args={[0.62, 0.92]} />
            <meshStandardMaterial
              map={textures.aboard}
              emissive="#ffffff"
              emissiveMap={textures.aboard}
              emissiveIntensity={night ? 0.35 : 0.1}
              side={DoubleSide}
              roughness={0.7}
            />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <boxGeometry args={[0.56, 0.26, 0.3]} />
            <meshStandardMaterial color="#22242a" roughness={0.6} metalness={0.3} />
          </mesh>
        </group>
      )}

      {/* --- Storefront fabrication -------------------------------------------- */}
      {/* Piers either side of the glazing. */}
      {[-1, 1].map((side) => (
        <mesh key={`pier-${side}`} position={[side * (halfFront + (halfSpan - halfFront) / 2), h / 2, -0.05]}>
          <boxGeometry args={[halfSpan - halfFront, h, 0.34]} />
          <meshStandardMaterial color={palette.facade} roughness={0.7} metalness={0.15} />
        </mesh>
      ))}

      {/* Stall riser. */}
      <mesh position={[0, STALL_RISER_M / 2, -0.02]}>
        <boxGeometry args={[frontW, STALL_RISER_M, 0.2]} />
        <meshStandardMaterial color="#1c1e22" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Glazing. */}
      <mesh position={[0, glazingCentre, 0.04]}>
        <planeGeometry args={[frontW, glassH]} />
        <meshStandardMaterial
          color="#9aa6b4"
          transparent
          opacity={0.17}
          roughness={0.06}
          metalness={0.55}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>

      {/* Printed window vinyl, sitting on the inside of the glass. */}
      <mesh position={[0, glazingCentre, 0.045]}>
        <planeGeometry args={[frontW, glassH]} />
        <meshStandardMaterial
          map={textures.vinyl}
          transparent
          depthWrite={false}
          roughness={0.5}
          metalness={0.05}
          side={DoubleSide}
        />
      </mesh>

      {/* Mullions and the transom under the fascia. */}
      {Array.from({ length: mullionCount }, (_, i) => {
        const x = -frontW / 2 + ((i + 1) * frontW) / (mullionCount + 1);
        return (
          <mesh key={`mullion-${i}`} position={[x, glazingCentre, 0.02]}>
            <boxGeometry args={[MULLION_M, glassH, 0.12]} />
            <meshStandardMaterial color="#20232a" roughness={0.5} metalness={0.4} />
          </mesh>
        );
      })}
      <mesh position={[0, glazingTop - 0.04, 0.03]}>
        <boxGeometry args={[frontW, 0.1, 0.16]} />
        <meshStandardMaterial color="#20232a" roughness={0.5} metalness={0.4} />
      </mesh>

      {/* Fascia: a fabricated tray with the printed face on it. */}
      <mesh position={[0, h - fasciaH / 2, -0.02]}>
        <boxGeometry args={[span + 0.12, fasciaH + 0.06, 0.24]} />
        <meshStandardMaterial color="#14161b" roughness={0.65} metalness={0.25} />
      </mesh>
      <mesh position={[0, h - fasciaH / 2, 0.1]}>
        <planeGeometry args={[span, fasciaH]} />
        <meshStandardMaterial
          map={textures.fascia.map}
          emissive="#ffffff"
          emissiveMap={textures.fascia.emissive}
          emissiveIntensity={night ? 0.95 : 0.08}
          roughness={0.55}
          metalness={0.1}
          side={DoubleSide}
        />
      </mesh>

      {/* Awning, with a printed valance. */}
      {shopfront.awning !== 'none' && (
        <group>
          <mesh
            position={[0, glazingTop - 0.02, SHOPFRONT_AWNING_M / 2]}
            rotation={[shopfront.awning === 'wedge' ? 0.24 : 0.1, 0, 0]}
          >
            <boxGeometry args={[frontW, 0.05, SHOPFRONT_AWNING_M]} />
            <meshStandardMaterial map={textures.awning} roughness={0.85} metalness={0} side={DoubleSide} />
          </mesh>
          <mesh
            position={[0, glazingTop - 0.2, SHOPFRONT_AWNING_M - 0.02]}
            rotation={[0, 0, 0]}
          >
            <planeGeometry args={[frontW, 0.4]} />
            <meshStandardMaterial
              map={textures.valance}
              emissive="#ffffff"
              emissiveMap={textures.valance}
              emissiveIntensity={night ? 0.3 : 0.1}
              side={DoubleSide}
              roughness={0.85}
              metalness={0}
            />
          </mesh>
        </group>
      )}

      {/* A-board on the pavement, an A-frame of two printed panels. */}
      {shopfront.aBoard && (
        <group position={[-halfSpan * 0.45, 0, 1.85]}>
          {[-1, 1].map((face) => (
            <mesh
              key={`aboard-${face}`}
              position={[0, 0.46, face * 0.11]}
              rotation={[face * 0.13, 0, 0]}
            >
              <planeGeometry args={[0.62, 0.92]} />
              <meshStandardMaterial
                map={textures.aboard}
                emissive="#ffffff"
                emissiveMap={textures.aboard}
                emissiveIntensity={night ? 0.25 : 0.08}
                side={DoubleSide}
                roughness={0.75}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* Shop light spilling onto the pavement. */}
      {night && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 1.1]}>
          <planeGeometry args={[span * 0.95, 3.6]} />
          <meshBasicMaterial
            map={textures.spill}
            transparent
            opacity={0.4}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
};
