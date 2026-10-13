import { useMemo } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import {
  cityPalette,
  resolveCityCameraPlan,
  resolveCityInputs,
  shopfrontCopy,
  type CityInputs,
} from '@printsync/motion-engine';
import { CameraRig } from '../models/CameraRig';
import { Billboard } from '../models/city/Billboard';
import { BrandSign } from '../models/city/BrandSign';
import { Building } from '../models/city/Building';
import { CityEnvironment } from '../models/city/CityEnvironment';
import { Crossing, useCrossingTexture } from '../models/city/Crossing';
import { RoadSign } from '../models/city/RoadSign';
import { RouteLine } from '../models/city/RouteLine';
import { Shopfront } from '../models/city/Shopfront';
import { Street } from '../models/city/Street';
import { StreetProp } from '../models/city/StreetProp';
import { STREET_LIGHT_HEIGHT, StreetLight } from '../models/city/StreetLight';
import { Vehicle } from '../models/city/Vehicle';

type LivingCityProps = Partial<CityInputs>;

/** Sodium-warm lamp colour, matching the luminaire mesh. */
const LAMP_COLOUR = '#fff1d6';

/** Seconds each digital advert holds before the next one comes on air. */
const AD_SECONDS = 4;
/** Fraction of the film over which the route draws itself in. */
const ROUTE_DRAW = 0.72;

/**
 * PrintSync Living City — a night drive through a working city that is
 * advertising PrintSync's own offering.
 *
 * Everything on screen comes from render inputs resolved through
 * `@printsync/motion-engine`: a deterministic street layout, out-of-home panels
 * sized to real formats (a 96-sheet really is 12.192 m wide), road signage at
 * TSRGD sizes, a self-drawing route and a camera plan. Nothing is hand-placed,
 * so the same brief always renders the same city.
 */
export const PrintSyncLivingCity: React.FC<LivingCityProps> = (props) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();

  const {
    title,
    tagline,
    brand,
    layout,
    route,
    billboards,
    signs,
    vehicles,
    props: streetProps,
    crossings,
    brandSigns,
    shopfronts,
    shotSubjects,
    playlist,
    cameraPath,
  } = resolveCityInputs(props);

  const progress = durationInFrames > 0 ? frame / durationInFrames : 0;
  const pose = resolveCityCameraPlan(cameraPath, progress, layout.extent, shotSubjects).pose;
  const palette = cityPalette(layout.timeOfDay);
  const crossingTexture = useCrossingTexture();
  /** Seconds into the film: traffic motion is a pure function of this. */
  const seconds = fps > 0 ? frame / fps : 0;
  /** Shopfronts by the building they occupy, so a block can open its ground floor. */
  const shopfrontByBuilding = useMemo(
    () => new Map(shopfronts.map((shop) => [shop.buildingId, shop] as const)),
    [shopfronts],
  );

  const activeIndex = playlist.length > 0 ? Math.floor(frame / (fps * AD_SECONDS)) % playlist.length : 0;
  const active = playlist[activeIndex];

  const routeProgress = interpolate(frame, [0, durationInFrames * ROUTE_DRAW], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const introOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  const outroOpacity = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], {
    extrapolateRight: 'clamp',
  });
  const chromeOpacity = Math.min(introOpacity, outroOpacity);
  const captionOpacity = interpolate(frame % (fps * AD_SECONDS), [0, 10], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ position: [0, 6, layout.extent * 0.6], fov: 52, near: 0.4, far: 2000 }}
        gl={{ antialias: true }}
      >
        <CityEnvironment palette={palette} timeOfDay={layout.timeOfDay} extent={layout.extent} />
        <CameraRig pose={pose} />

        <Street roads={layout.roads} palette={palette} />

        {/* Zebra crossings on the junction approaches, painted on the tarmac. */}
        {crossings.map((crossing) => (
          <Crossing key={crossing.id} crossing={crossing} texture={crossingTexture} />
        ))}

        {/* Carriageway light, anchored to the real street lamps: every second
            lamp gets a physical point light, so the pools of light line up with
            the fittings and the road reads as lit. */}
        {layout.streetLights
          .filter((_, index) => index % 2 === 0)
          .map((light) => (
            <pointLight
              key={`lamp-${light.id}`}
              position={[
                light.position[0] + (light.side > 0 ? -1.8 : 1.8),
                STREET_LIGHT_HEIGHT - 0.5,
                light.position[2],
              ]}
              color={LAMP_COLOUR}
              intensity={520}
              distance={80}
              decay={2}
            />
          ))}

        {/* A few brand-accent pools so the road picks up the brand palette. */}
        {[-0.42, 0.42].map((offset) => (
          <pointLight
            key={`accent-${offset}`}
            position={[offset > 0 ? -7 : 7, 6, offset * layout.extent * 2]}
            color={brand.accent}
            intensity={420}
            distance={70}
            decay={2}
          />
        ))}

        {route && <RouteLine route={route} progress={routeProgress} />}

        {layout.buildings.map((building) => {
          const shopfront = shopfrontByBuilding.get(building.id);
          return (
            <Building
              key={building.id}
              building={building}
              palette={palette}
              {...(shopfront ? { shopfront } : {})}
            />
          );
        })}

        {/* Retail shopfronts, with everything printed for them: fascia, window
            vinyl, awning, A-board, and the branded interior behind the glass. */}
        {shopfronts.map((shop) => (
          <Shopfront
            key={shop.id}
            shopfront={shop}
            palette={palette}
            lines={shopfrontCopy(shop.trade)}
            wordmark={brand.wordmark}
            primary={brand.primary}
          />
        ))}

        {billboards.map((entry) => (
          <Billboard
            key={entry.slot.id}
            entry={entry}
            brand={brand}
            playlist={playlist}
            activeIndex={activeIndex}
            palette={palette}
          />
        ))}

        {signs.map((entry) => (
          <RoadSign key={entry.slot.id} slot={entry.slot} sign={entry.sign} palette={palette} />
        ))}

        {/* PrintSync signage on the buildings: roof signs on the towers, fascia
            signs over the entrances. */}
        {brandSigns.map((sign) => (
          <BrandSign
            key={sign.id}
            sign={sign}
            palette={palette}
            wordmark={brand.wordmark}
            primary={brand.primary}
            paper={brand.paper}
          />
        ))}

        {/* Public realm: bollards, bins, benches, planters, signals, a shelter. */}
        {streetProps.map((prop) => (
          <StreetProp key={prop.id} prop={prop} palette={palette} />
        ))}

        {layout.streetLights.map((light) => (
          <StreetLight key={light.id} light={light} palette={palette} />
        ))}

        {/* Traffic, moving and parked, positioned purely from the frame time. */}
        {vehicles.map((vehicle) => (
          <Vehicle
            key={vehicle.id}
            vehicle={vehicle}
            seconds={seconds}
            palette={palette}
            brandPrimary={brand.primary}
          />
        ))}
      </ThreeCanvas>

      {/* Cinematic vignette and a cool grade for the night city. */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.62) 100%)',
          pointerEvents: 'none',
        }}
      />

      <AbsoluteFill style={{ opacity: chromeOpacity, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 44, border: '1px solid rgba(200,0,28,0.32)' }} />

        {/* Title block. */}
        <div style={{ position: 'absolute', top: 76, left: 84 }}>
          <div
            style={{
              fontSize: '0.85rem',
              letterSpacing: '0.42em',
              color: brand.primary,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {brand.wordmark}
          </div>
          <h1
            style={{
              fontSize: '3.2rem',
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
              fontSize: '1.05rem',
              color: '#b6bcc8',
              margin: '0.5rem 0 0',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {tagline}
          </p>
        </div>

        {/* Live badge. */}
        <div
          style={{
            position: 'absolute',
            top: 84,
            right: 88,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 16px',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.35)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.8rem',
            letterSpacing: '0.3em',
            color: '#ffffff',
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: brand.primary,
              boxShadow: `0 0 14px ${brand.primary}`,
              opacity: 0.55 + 0.45 * Math.abs(Math.sin(frame / 12)),
            }}
          />
          ON AIR
        </div>

        {/* On-air advert. */}
        {active && (
          <div
            style={{
              position: 'absolute',
              left: 84,
              bottom: 116,
              maxWidth: 720,
              opacity: captionOpacity,
            }}
          >
            <div
              style={{
                fontSize: '0.85rem',
                letterSpacing: '0.34em',
                color: brand.accent,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {active.kicker.toUpperCase()}
            </div>
            <div
              style={{
                fontSize: '2.5rem',
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: '-0.01em',
                lineHeight: 1.05,
                marginTop: 6,
              }}
            >
              {active.headline}
            </div>
            <div
              style={{
                fontSize: '1rem',
                color: '#c2c8d4',
                marginTop: 10,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {active.body}
            </div>
          </div>
        )}

        {/* Capability strip. */}
        <div
          style={{
            position: 'absolute',
            right: 88,
            bottom: 120,
            textAlign: 'right',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.82rem',
            letterSpacing: '0.22em',
            color: '#8f97a6',
            lineHeight: 1.9,
          }}
        >
          <div>LARGE FORMAT · 6/48/96-SHEET</div>
          <div>ROAD SAFETY SIGNAGE · TSRGD</div>
          <div>DIGITAL OUT-OF-HOME</div>
          <div>PACKAGING · LABELS · WAYFINDING</div>
        </div>

        {/* Route progress rail. */}
        <div
          style={{
            position: 'absolute',
            left: 88,
            right: 88,
            bottom: 64,
            height: 3,
            background: 'rgba(255,255,255,0.14)',
          }}
        >
          <div
            style={{
              width: `${routeProgress * 100}%`,
              height: '100%',
              background: brand.primary,
              boxShadow: `0 0 12px ${brand.primary}`,
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
