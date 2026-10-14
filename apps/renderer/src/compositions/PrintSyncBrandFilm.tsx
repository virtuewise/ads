import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

type BrandFilmProps = {
  title: string;
  tagline: string;
};

export const PrintSyncBrandFilm: React.FC<BrandFilmProps> = ({ title, tagline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title animation
  const titleOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const titleScale = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  // Tagline animation
  const taglineOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Background grid
  const gridOffset = interpolate(frame, [0, 900], [0, 100]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
          linear-gradient(rgba(200, 0, 28, 0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(200, 0, 28, 0.1) 1px, transparent 1px)
        `,
          backgroundSize: '50px 50px',
          transform: `translateY(${gridOffset}px)`,
        }}
      />

      {/* Registration marks */}
      <RegistrationMark position="top-left" />
      <RegistrationMark position="top-right" />
      <RegistrationMark position="bottom-left" />
      <RegistrationMark position="bottom-right" />

      {/* Title */}
      <h1
        style={{
          fontSize: '6rem',
          fontWeight: 900,
          color: '#C8001C',
          margin: 0,
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontSize: '2rem',
          color: '#ffffff',
          margin: '1rem 0 0',
          opacity: taglineOpacity,
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        {tagline}
      </p>

      {/* Technical labels */}
      <div
        style={{
          position: 'absolute',
          bottom: '2rem',
          left: '2rem',
          color: '#666',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.75rem',
        }}
      >
        VIRTUE STUDIO — PRINTSYNC BRAND FILM v0.1.0
      </div>
    </div>
  );
};

function RegistrationMark({
  position,
}: {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}) {
  const posStyle: React.CSSProperties = {
    position: 'absolute',
    width: '20px',
    height: '20px',
    border: '2px solid #C8001C',
  };

  switch (position) {
    case 'top-left':
      return (
        <div
          style={{
            ...posStyle,
            top: '1rem',
            left: '1rem',
            borderRight: 'none',
            borderBottom: 'none',
          }}
        />
      );
    case 'top-right':
      return (
        <div
          style={{
            ...posStyle,
            top: '1rem',
            right: '1rem',
            borderLeft: 'none',
            borderBottom: 'none',
          }}
        />
      );
    case 'bottom-left':
      return (
        <div
          style={{
            ...posStyle,
            bottom: '1rem',
            left: '1rem',
            borderRight: 'none',
            borderTop: 'none',
          }}
        />
      );
    case 'bottom-right':
      return (
        <div
          style={{
            ...posStyle,
            bottom: '1rem',
            right: '1rem',
            borderLeft: 'none',
            borderTop: 'none',
          }}
        />
      );
  }
}
