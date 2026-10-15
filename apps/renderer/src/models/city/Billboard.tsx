import {
  type BrandTokens,
  buildOohArtworkSpec,
  type CityPalette,
  type OohHeadline,
  oohSceneHeight,
  oohSceneWidth,
  type ResolvedCityBillboard,
} from '@printsync/motion-engine';
import { useMemo } from 'react';
import { createDigitalTexture, createOohTexture } from './cityArtwork';

interface BillboardProps {
  entry: ResolvedCityBillboard;
  brand: BrandTokens;
  playlist: readonly OohHeadline[];
  /** Playlist entry currently on air, for digital screens. */
  activeIndex: number;
  palette: CityPalette;
}

/**
 * A single out-of-home panel, built to its exact format size.
 *
 * Paper formats are printed once (deterministic artwork from the item and the
 * format) and read as floodlit; digital formats rotate the playlist and read as
 * self-lit LED. Both share one frame, one mount vocabulary (rooftop / facade /
 * kerb) and one brand system, so the whole street sells the same story.
 */
export const Billboard: React.FC<BillboardProps> = ({
  entry,
  brand,
  playlist,
  activeIndex,
  palette,
}) => {
  const { slot, format, item } = entry;
  const width = oohSceneWidth(format);
  const height = oohSceneHeight(format);
  const isDigital = format.medium === 'digital';

  const { texture, emissiveIntensity } = useMemo(() => {
    // A panel always advertises at least one headline; a missing playlist is a
    // configuration error rather than something to assert inside the render.
    const fallbackHeadline = playlist[0];
    if (!fallbackHeadline) throw new Error('Billboard requires a non-empty playlist');

    if (isDigital) {
      const spec = buildOohArtworkSpec(
        format,
        brand,
        playlist[activeIndex % playlist.length] ?? fallbackHeadline,
      );
      return { texture: createDigitalTexture(spec), emissiveIntensity: 1 };
    }
    const spec = buildOohArtworkSpec(
      format,
      brand,
      playlist[slot.playlistIndex % playlist.length] ?? fallbackHeadline,
      item?.id,
    );
    // Kerbside units are backlit lightboxes; roadside paper is floodlit.
    const intensity =
      slot.mount === 'kerb' ? Math.max(0.55, palette.floodlitIntensity) : palette.floodlitIntensity;
    return { texture: createOohTexture(spec), emissiveIntensity: intensity };
  }, [
    isDigital,
    format,
    brand,
    playlist,
    activeIndex,
    slot.playlistIndex,
    slot.mount,
    item,
    palette.floodlitIntensity,
  ]);

  const legHeight = 1.6;
  const panelBottom = -height / 2;
  const plinthHeight = slot.position[1] - height / 2;

  return (
    <group
      position={[slot.position[0], slot.position[1], slot.position[2]]}
      rotation={[0, slot.rotationY, 0]}
    >
      {/* Frame / bezel. Its front face sits 2 cm behind the panel plane: put it
          flush and the two coplanar surfaces z-fight, and the frame wins. */}
      <mesh position={[0, 0, -0.18]}>
        <boxGeometry args={[width + 0.6, height + 0.6, 0.32]} />
        <meshStandardMaterial color="#2a2d33" metalness={0.5} roughness={0.55} />
      </mesh>

      {/* The panel itself. */}
      <mesh>
        <planeGeometry args={[width, height]} />
        {isDigital ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshStandardMaterial
            map={texture}
            emissiveMap={texture}
            emissive="#ffffff"
            emissiveIntensity={emissiveIntensity}
            roughness={0.55}
            metalness={0.03}
          />
        )}
      </mesh>

      {/* Rooftop legs. */}
      {slot.mount === 'rooftop' &&
        [-1, 1].map((side) => (
          <mesh key={side} position={[side * width * 0.28, panelBottom - legHeight / 2, -0.2]}>
            <boxGeometry args={[0.22, legHeight, 0.22]} />
            <meshStandardMaterial color="#2a2d33" metalness={0.5} roughness={0.55} />
          </mesh>
        ))}

      {/* Kerbside plinth. */}
      {slot.mount === 'kerb' && plinthHeight > 0 && (
        <mesh position={[0, panelBottom - plinthHeight / 2, -0.1]}>
          <boxGeometry args={[width * 0.62, plinthHeight, 0.55]} />
          <meshStandardMaterial color="#1d2025" metalness={0.3} roughness={0.7} />
        </mesh>
      )}

      {/* Local spill from the big digital spectaculars. */}
      {isDigital && width > 10 && (
        <pointLight
          position={[0, -height * 0.2, 3.5]}
          color={brand.accent}
          intensity={palette.floodlitIntensity * 900}
          distance={width * 2}
          decay={2}
        />
      )}
    </group>
  );
};
