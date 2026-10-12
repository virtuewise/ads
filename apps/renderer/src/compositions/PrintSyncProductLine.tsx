import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import {
  animatePrintObject,
  DEFAULT_BRAND_TOKENS,
  getPrintItem,
  printItemBoundingRadius,
  type PrintItemSpec,
  type PrintObjectAnimation,
} from '@printsync/motion-engine';
import { PrintItem } from '../models/PrintItem';
import { Studio } from '../models/Studio';

/** Curated hero set — all items share real-world millimetre dimensions. */
const FEATURED = [
  'business-card',
  'postcard-a6',
  'folding-carton',
  'mailer-box',
  'rigid-box',
  'bottle-500',
  'can-330',
  'tube-50',
  'coffee-pouch',
  'rollup-850',
];

const ITEMS = FEATURED.map((id) => getPrintItem(id)).filter(
  (item): item is PrintItemSpec => item !== undefined
);

/** Per-item choreography — each item gets a distinct, spec-driven animation. */
const ITEM_ANIMATIONS: PrintObjectAnimation[] = [
  'reveal',   // business-card
  'rise',     // postcard-a6
  'float',    // folding-carton
  'orbit',    // mailer-box
  'reveal',   // rigid-box
  'float',    // bottle-500
  'orbit',    // can-330
  'rise',     // tube-50
  'float',    // coffee-pouch
  'reveal',   // rollup-850
];

const RING_RADIUS = 3.1;
/** Every item is normalised to the same display radius for a consistent set. */
const DISPLAY_RADIUS = 0.55;
const BRAND = '#c8001c';

type ProductLineProps = {
  title: string;
  tagline: string;
  brand?: typeof DEFAULT_BRAND_TOKENS;
};

/**
 * PrintSync Product Line — a slow turntable of the catalogue. Items are built
 * from exact millimetre specs via the shared model library, then framed to a
 * consistent display size and animated through spec-driven choreography via the
 * shared studio rig. Brand artwork is drawn procedurally onto each surface.
 */
export const PrintSyncProductLine: React.FC<ProductLineProps> = ({
  title,
  tagline,
  brand = DEFAULT_BRAND_TOKENS,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();

  const count = ITEMS.length;
  const progress = frame / durationInFrames;
  const angle = progress * Math.PI * 2;
  const activeIndex = Math.min(count - 1, Math.floor(progress * count));
  const active = ITEMS[activeIndex];

  const segmentLength = durationInFrames / count;
  const captionOpacity = interpolate(frame - activeIndex * segmentLength, [0, 8], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const introOpacity = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const outroOpacity = interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0], {
    extrapolateRight: 'clamp',
  });
  const chromeOpacity = Math.min(introOpacity, outroOpacity);

  return (
    <AbsoluteFill>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ position: [0, 0.9, 5.6], fov: 40 }}
        gl={{ antialias: true }}
      >
        <Studio />
        <group rotation={[0, angle, 0]}>
          {ITEMS.map((item, index) => {
            const itemAngle = -(index / count) * Math.PI * 2;
            const x = Math.sin(itemAngle) * RING_RADIUS;
            const z = Math.cos(itemAngle) * RING_RADIUS;
            const scale = DISPLAY_RADIUS / printItemBoundingRadius(item);
            const animation = ITEM_ANIMATIONS[index] ?? 'float';
            const transform = animatePrintObject(item, animation, frame, fps, index * 7);
            return (
              <group
                key={item.id}
                position={[x + transform.position[0], transform.position[1], z + transform.position[2]]}
                rotation={[transform.rotation[0], itemAngle + transform.rotation[1], transform.rotation[2]]}
                scale={scale * transform.scale}
              >
                <PrintItem spec={item} brand={brand} />
              </group>
            );
          })}
        </group>
      </ThreeCanvas>

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Chrome */}
      <AbsoluteFill style={{ opacity: chromeOpacity, pointerEvents: 'none' }}>
        {/* Safe-area frame */}
        <div
          style={{
            position: 'absolute',
            inset: 48,
            border: '1px solid rgba(200,0,28,0.35)',
          }}
        />

        <div style={{ position: 'absolute', top: 80, left: 88 }}>
          <div
            style={{
              fontSize: '0.85rem',
              letterSpacing: '0.42em',
              color: BRAND,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {brand.wordmark}
          </div>
          <h1
            style={{
              fontSize: '3.4rem',
              fontWeight: 900,
              color: '#ffffff',
              margin: '0.4rem 0 0',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontSize: '1.1rem',
              color: '#9a9a9a',
              margin: '0.5rem 0 0',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {tagline}
          </p>
        </div>

        {/* Active item caption */}
        <div
          style={{
            position: 'absolute',
            left: 88,
            bottom: 132,
            opacity: captionOpacity,
            maxWidth: 620,
          }}
        >
          <div
            style={{
              fontSize: '0.78rem',
              letterSpacing: '0.34em',
              textTransform: 'uppercase',
              color: BRAND,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {active?.category ?? ''}
          </div>
          <div
            style={{
              fontSize: '2.4rem',
              fontWeight: 800,
              color: '#ffffff',
              marginTop: '0.35rem',
              letterSpacing: '-0.01em',
            }}
          >
            {active?.name ?? ''}
          </div>
          <div
            style={{
              fontSize: '1.05rem',
              color: '#c9c9c9',
              marginTop: '0.35rem',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {active?.label ?? ''}
          </div>
        </div>

        {/* Progress rail */}
        <div
          style={{
            position: 'absolute',
            left: 88,
            right: 88,
            bottom: 64,
            height: 3,
            backgroundColor: 'rgba(255,255,255,0.12)',
            display: 'flex',
          }}
        >
          {ITEMS.map((item, index) => (
            <div
              key={item.id}
              style={{
                flex: 1,
                marginRight: index === count - 1 ? 0 : 4,
                backgroundColor: index <= activeIndex ? BRAND : 'rgba(255,255,255,0.18)',
                opacity: index === activeIndex ? 1 : 0.6,
              }}
            />
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            right: 88,
            bottom: 80,
            fontSize: '0.8rem',
            color: '#666',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {String(activeIndex + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
