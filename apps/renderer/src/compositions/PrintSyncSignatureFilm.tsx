import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Logo3D } from '../scenes/Logo3D';
import { Spectrum } from '../scenes/Spectrum';

type SignatureFilmProps = {
  title: string;
  tagline: string;
  audioSrc: string;
};

/**
 * PrintSync Signature Film — a motion-first composition that fuses a
 * programmatic WebGL logo with an audio-reactive spectrum and brand
 * typography. Every property is driven by the frame, so it is deterministic
 * and renderable at any resolution.
 */
export const PrintSyncSignatureFilm: React.FC<SignatureFilmProps> = ({
  title,
  tagline,
  audioSrc,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 24], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const titleScale = spring({ frame, fps, config: { damping: 200 } });
  const taglineOpacity = interpolate(frame, [18, 42], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const endFade = interpolate(frame, [durationInFrames - 30, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <AbsoluteFill style={{ opacity: 0.9 }}>
        <Logo3D />
      </AbsoluteFill>

      <Spectrum audioSrc={staticFile(audioSrc)} bars={56} />

      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <h1
          style={{
            fontSize: '5.5rem',
            fontWeight: 900,
            color: '#C8001C',
            margin: 0,
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
            letterSpacing: '-0.02em',
            textShadow: '0 4px 40px rgba(0, 0, 0, 0.6)',
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: '1.5rem',
            color: '#ffffff',
            margin: '1rem 0 0',
            opacity: taglineOpacity,
            fontFamily: 'JetBrains Mono, monospace',
            textShadow: '0 2px 24px rgba(0, 0, 0, 0.8)',
          }}
        >
          {tagline}
        </p>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          backgroundColor: '#0a0a0a',
          opacity: endFade,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
