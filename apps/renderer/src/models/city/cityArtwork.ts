import {
  type CityPalette,
  mulberry32,
  type OohArtworkSpec,
  type RoadSignKind,
  type RoadSignSpec,
  roadSignOutlinePoints,
  type ShopfrontBackWall,
  type ShopfrontFasciaKind,
  type ShopfrontWindowKind,
  type TimeOfDay,
} from '@printsync/motion-engine';
import { type CanvasTexture, RepeatWrapping } from 'three';
import {
  ARTWORK_FONT,
  ARTWORK_FONT_TEXT,
  type BrandMarkOptions,
  canvasTexture,
  createCanvas,
  drawBrandMark,
  drawLabel,
  roundRect,
  wrapText,
} from '../artwork';

/** Window emissive variants the city can draw from. */
export const WINDOW_VARIANTS = ['warm', 'cool', 'mixed'] as const;
export type WindowVariant = (typeof WINDOW_VARIANTS)[number];

/** A building facade expressed as two textures: what you see, and what glows. */
export interface FacadeTextures {
  /** Albedo: cladding + glass panes, tinted for the time of day. */
  readonly map: CanvasTexture;
  /** Emissive: lit windows only, black everywhere else. */
  readonly emissive: CanvasTexture;
}

/**
 * Tileable building facade: cladding at the palette's facade colour with a grid
 * of glass panes, plus a separate emissive map carrying only the lit windows.
 *
 * Splitting the two is what lets one building look right at every time of day —
 * midnight cladding is near-black with warm glowing windows, midday cladding is
 * light concrete with cold glass — without the albedo ever being multiplied
 * into invisibility. Deterministic from `seed`.
 */
export function createFacadeTextures(
  variant: WindowVariant,
  palette: CityPalette,
  seed: number,
): FacadeTextures {
  const W = 256;
  const H = 256;
  const cols = 6;
  const rows = 8;
  const albedo = createCanvas(W, H);
  const emissive = createCanvas(W, H);
  const rand = mulberry32(seed >>> 0 || 1);
  const rand2 = mulberry32((seed >>> 0 || 1) ^ 0x5bf03635);

  albedo.ctx.fillStyle = palette.facade;
  albedo.ctx.fillRect(0, 0, W, H);
  albedo.ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let r = 0; r < rows; r++) albedo.ctx.fillRect(0, r * (H / rows), W, 1.5);

  emissive.ctx.fillStyle = '#000000';
  emissive.ctx.fillRect(0, 0, W, H);

  const cw = W / cols;
  const ch = H / rows;
  const winW = cw * 0.6;
  const winH = ch * 0.46;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw + (cw - winW) / 2;
      const y = r * ch + (ch - winH) / 2;

      // Glass pane, always dark so the cladding reads as the lit surface by day.
      albedo.ctx.fillStyle = '#0b0f16';
      albedo.ctx.fillRect(x, y, winW, winH);
      albedo.ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      albedo.ctx.lineWidth = 1;
      albedo.ctx.strokeRect(x + 0.5, y + 0.5, winW - 1, winH - 1);

      if (rand() < 0.55) {
        const warm = variant === 'warm' ? true : variant === 'cool' ? false : rand2() < 0.62;
        const gradient = emissive.ctx.createLinearGradient(x, y, x, y + winH);
        gradient.addColorStop(0, warm ? '#fff0cf' : '#d6e6ff');
        gradient.addColorStop(1, warm ? '#f0b566' : '#8fb4e8');
        emissive.ctx.fillStyle = gradient;
        emissive.ctx.fillRect(x, y, winW, winH);

        if (rand2() < 0.3) {
          emissive.ctx.fillStyle = 'rgba(0,0,0,0.55)';
          emissive.ctx.fillRect(x, y, winW, winH * 0.34);
        }

        // A hint of warmth in the albedo too, so lit windows read in daylight.
        albedo.ctx.fillStyle = 'rgba(255,240,210,0.18)';
        albedo.ctx.fillRect(x, y, winW, winH);
      }
    }
  }

  return { map: canvasTexture(albedo.canvas), emissive: canvasTexture(emissive.canvas) };
}

/** Horizontal pixels in the sky dome texture. */
const SKY_WIDTH = 1024;
/** Vertical pixels in the sky dome texture. */
const SKY_HEIGHT = 512;
/**
 * Canvas row of the dome's true horizon. The dome is a sphere, so the equator
 * sits at UV v = 0.5; with the texture's default `flipY` that is the middle row.
 * The gradient is aligned to it so the horizon glow lands where the geometry
 * actually meets the eye.
 */
const SKY_HORIZON_ROW = SKY_HEIGHT * 0.5;

/**
 * The sky dome: a vertical gradient from zenith to horizon, carrying a warm
 * city light-dome just above the horizon, stars and a moon at night, and a hazy
 * sun by day.
 *
 * The texture is wider than the old single-column gradient so it can hold
 * point features (stars, moon, sun) at their correct places on the dome. It is
 * deterministic: the same palette always paints the same sky.
 */
export function createSkyTexture(
  palette: CityPalette,
  timeOfDay: TimeOfDay = 'night',
): CanvasTexture {
  const { canvas, ctx } = createCanvas(SKY_WIDTH, SKY_HEIGHT);
  const rand = mulberry32(0x5ee1 ^ Math.round(palette.sunIntensity * 1000));

  const gradient = ctx.createLinearGradient(0, 0, 0, SKY_HEIGHT);
  gradient.addColorStop(0, palette.skyTop);
  gradient.addColorStop(0.5, palette.skyHorizon);
  gradient.addColorStop(0.62, palette.fog);
  gradient.addColorStop(1, palette.fog);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SKY_WIDTH, SKY_HEIGHT);

  // City light-dome: warm haze rising off the rooftops, strongest at the
  // horizon. This is what makes a night skyline read as a living city.
  const dome = ctx.createLinearGradient(0, SKY_HORIZON_ROW - SKY_HEIGHT * 0.34, 0, SKY_HORIZON_ROW);
  dome.addColorStop(0, 'rgba(0,0,0,0)');
  dome.addColorStop(
    0.55,
    timeOfDay === 'day' ? 'rgba(255,255,255,0.06)' : 'rgba(255,176,102,0.16)',
  );
  dome.addColorStop(1, timeOfDay === 'day' ? 'rgba(255,255,255,0.02)' : 'rgba(255,150,86,0.05)');
  ctx.fillStyle = dome;
  ctx.fillRect(0, SKY_HORIZON_ROW - SKY_HEIGHT * 0.34, SKY_WIDTH, SKY_HEIGHT * 0.34);

  if (timeOfDay !== 'day') {
    // Stars thin out towards the horizon, as they do in a real sky.
    const starCount = timeOfDay === 'night' ? 520 : 170;
    for (let i = 0; i < starCount; i++) {
      const x = rand() * SKY_WIDTH;
      const elevation = rand() ** 1.6;
      const y = elevation * SKY_HORIZON_ROW * 0.94;
      const fade = 1 - y / (SKY_HORIZON_ROW * 0.94);
      const alpha = (0.18 + rand() * 0.72) * (0.35 + fade * 0.65);
      const radius = 0.6 + rand() * 1.1;
      const warm = rand() < 0.24;
      ctx.fillStyle = warm
        ? `rgba(255,236,206,${alpha.toFixed(3)})`
        : `rgba(226,236,255,${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // The moon, with a soft halo so it reads through the haze.
    const moonX = SKY_WIDTH * 0.68;
    const moonY = SKY_HORIZON_ROW * 0.26;
    const moonR = 13;
    const halo = ctx.createRadialGradient(moonX, moonY, moonR * 0.6, moonX, moonY, moonR * 3.6);
    halo.addColorStop(0, 'rgba(226,236,255,0.5)');
    halo.addColorStop(1, 'rgba(226,236,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(moonX - moonR * 4, moonY - moonR * 4, moonR * 8, moonR * 8);
    ctx.fillStyle = 'rgba(244,247,255,0.96)';
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();
    // A hint of maria so it is not a flat disc.
    ctx.fillStyle = 'rgba(206,214,232,0.5)';
    for (const [ox, oy, r] of [
      [-4, -3, 3.4],
      [3, 2, 2.6],
      [1, -5, 1.9],
    ] as const) {
      ctx.beginPath();
      ctx.arc(moonX + ox, moonY + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Daytime sun, hazed so it does not read as a hard disc.
    const sunX = SKY_WIDTH * 0.24;
    const sunY = SKY_HORIZON_ROW * 0.2;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, SKY_HEIGHT * 0.4);
    glow.addColorStop(0, 'rgba(255,250,232,0.95)');
    glow.addColorStop(0.14, 'rgba(255,240,205,0.35)');
    glow.addColorStop(1, 'rgba(255,240,205,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, SKY_WIDTH, SKY_HEIGHT);
  }

  return canvasTexture(canvas);
}

// --- Street surfaces and light ---------------------------------------------

/**
 * Worn zebra crossing bars, as a transparent overlay for the carriageway: off
 * white with ragged edges, because road paint is never pristine.
 */
export function createCrossingTexture(seed = 3): CanvasTexture {
  const W = 512;
  const H = 128;
  const { canvas, ctx } = createCanvas(W, H);
  const rand = mulberry32(seed);
  const bars = 11;
  const barWidth = W / (bars * 2 - 1);

  for (let i = 0; i < bars; i++) {
    const x = i * barWidth * 2;
    ctx.fillStyle = 'rgba(236,236,230,0.86)';
    ctx.fillRect(x, H * 0.06, barWidth, H * 0.88);
    // Scuff the paint so it reads as worn rather than printed.
    for (let s = 0; s < 26; s++) {
      const sx = x + rand() * barWidth;
      const sy = H * 0.06 + rand() * H * 0.88;
      ctx.clearRect(sx, sy, 1 + rand() * 3, 1 + rand() * 2);
    }
  }

  return canvasTexture(canvas);
}

/**
 * A radial pool of warm lamp light, faded to nothing at the rim. Drawn as an
 * additive overlay on the road, it gives the carriageway its pools of light
 * without a light source per lamp.
 */
export function createLightPoolTexture(colour = '#fff1d6'): CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvas(size, size);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `${colour}`);
  gradient.addColorStop(0.42, `${colour}66`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvasTexture(canvas);
}

/** A soft round glow for lamp heads, used as an additive sprite. */
export function createGlowTexture(colour = '#fff4e2'): CanvasTexture {
  const size = 128;
  const { canvas, ctx } = createCanvas(size, size);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.22, colour);
  gradient.addColorStop(0.6, `${colour}33`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvasTexture(canvas);
}

/** `'aabbcc'` + alpha to `'rgba(a,b,c,alpha)'`, for gradients that need alpha. */
function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

/**
 * The face of a PrintSync building sign: the real roundel locked up with the
 * wordmark. Roof signs are individual channel letters on a dark plate; fascia
 * signs are a solid brand plate with reversed artwork — the two ways brand
 * signage is actually made.
 */
export function createBrandSignTexture(
  wordmark: string,
  primary: string,
  paper: string,
  mount: 'roof' | 'facade',
): CanvasTexture {
  const W = 768;
  const H = 256;
  const { canvas, ctx } = createCanvas(W, H);
  const lockupSize = H * 0.6;
  const pad = H * 0.2;

  if (mount === 'facade') {
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = withAlpha('#000000', 0.18);
    ctx.fillRect(0, H - 10, W, 10);
  } else {
    ctx.fillStyle = '#0d0f13';
    ctx.fillRect(0, 0, W, H);
    // Mounting rails, so the panel reads as fabricated.
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(0, 0, W, 6);
    ctx.fillRect(0, H - 6, W, 6);
  }

  const markX = pad + lockupSize / 2;
  drawBrandMark(ctx, markX, H / 2, {
    size: lockupSize,
    colours:
      mount === 'facade'
        ? { primary: paper, secondary: paper, ink: paper }
        : { primary, secondary: paper, ink: paper },
  });

  ctx.fillStyle = paper;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${H * 0.44}px ${ARTWORK_FONT}`;
  ctx.fillText(wordmark, markX + lockupSize * 0.72, H / 2 + H * 0.02);

  return canvasTexture(canvas);
}

/** Metres covered by one tile of the road texture (two lane dashes). */
export const ROAD_TILE_METRES = 18;

/**
 * Tileable asphalt with lane markings. The tile spans the road across `u` and
 * one `ROAD_TILE_METRES` stretch along `v`, so repeating it by road length keeps
 * dashes a realistic size regardless of street length.
 */
export function createRoadTexture(seed = 7): CanvasTexture {
  const W = 256;
  const H = 1024;
  const { canvas, ctx } = createCanvas(W, H);
  const rand = mulberry32(seed);

  ctx.fillStyle = '#191a1e';
  ctx.fillRect(0, 0, W, H);

  // Aggregate speckle so the tarmac is not a flat colour.
  for (let i = 0; i < 6000; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const tone = 18 + Math.floor(rand() * 26);
    ctx.fillStyle = `rgb(${tone},${tone},${tone + 3})`;
    ctx.fillRect(x, y, 1.6, 1.6);
  }

  const paint = 'rgba(232,232,226,0.82)';
  ctx.fillStyle = paint;
  // Solid edge lines.
  ctx.fillRect(W * 0.045, 0, 4, H);
  ctx.fillRect(W * 0.955 - 4, 0, 4, H);
  // Lane dividers: two dashes per tile.
  for (const u of [0.27, 0.5, 0.73]) {
    for (let k = 0; k < 2; k++) {
      ctx.fillRect(W * u - 2, k * (H / 2) + H * 0.1, 4, H * 0.18);
    }
  }

  return canvasTexture(canvas, [1, 1]);
}

// --- Out-of-home -----------------------------------------------------------------

function oohCanvasSize(aspect: number): { width: number; height: number } {
  const base = 1024;
  return aspect >= 1
    ? { width: base, height: Math.round(base / aspect) }
    : { width: Math.round(base * aspect), height: base };
}

function traceSignOutline(
  ctx: CanvasRenderingContext2D,
  points: readonly (readonly [number, number])[],
  w: number,
  h: number,
): void {
  ctx.beginPath();
  points.forEach(([px, py], index) => {
    const x = (px + 0.5) * w;
    const y = (0.5 - py) * h;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function drawProductSilhouette(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  spec: OohArtworkSpec,
): void {
  const shape = spec.seed % 3;
  const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
  gradient.addColorStop(0, spec.accent);
  gradient.addColorStop(1, spec.primary);
  ctx.fillStyle = gradient;

  if (shape === 0) {
    // Carton / box.
    roundRect(ctx, x, y, w, h, Math.min(w, h) * 0.06);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(x + w * 0.1, y + h * 0.18, w * 0.8, h * 0.1);
    ctx.fillRect(x + w * 0.1, y + h * 0.36, w * 0.5, h * 0.06);
  } else if (shape === 1) {
    // Bottle.
    const bodyW = w * 0.5;
    roundRect(ctx, x + (w - bodyW) / 2, y + h * 0.24, bodyW, h * 0.76, bodyW * 0.24);
    ctx.fill();
    ctx.fillRect(x + w * 0.44, y, w * 0.12, h * 0.3);
  } else {
    // Disc / round pack.
    const r = Math.min(w, h) * 0.46;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, r * 0.52, 0, Math.PI * 2);
    ctx.fill();
  }
}

function productionMarks(ctx: CanvasRenderingContext2D, w: number, h: number, color: string): void {
  const size = Math.min(w, h) * 0.02;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, size * 0.22);
  for (const [cx, cy] of [
    [size * 2, size * 2],
    [w - size * 2, h - size * 2],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.moveTo(cx - size * 1.6, cy);
    ctx.lineTo(cx + size * 1.6, cy);
    ctx.moveTo(cx, cy - size * 1.6);
    ctx.lineTo(cx, cy + size * 1.6);
    ctx.stroke();
  }
}

/** Paint a large-format paper poster: big type, product block, production marks. */
export function createOohTexture(spec: OohArtworkSpec): CanvasTexture {
  const { width: W, height: H } = oohCanvasSize(spec.aspect);
  const { canvas, ctx } = createCanvas(W, H);
  const pad = Math.round(Math.min(W, H) * 0.07);

  ctx.fillStyle = spec.paper;
  ctx.fillRect(0, 0, W, H);

  // Top brand bar: the real roundel, reversed, beside the wordmark.
  const barMark = Math.min(W, H) * 0.082;
  ctx.fillStyle = spec.primary;
  ctx.fillRect(0, 0, W, H * 0.13);
  drawBrandMark(ctx, W - pad - barMark / 2, H * 0.065, { size: barMark, flatten: spec.paper });
  drawLabel(
    ctx,
    spec.wordmark,
    W - pad - barMark - Math.min(W, H) * 0.022,
    H * 0.065,
    Math.min(W, H) * 0.052,
    spec.paper,
    'right',
  );
  drawLabel(
    ctx,
    spec.kicker.toUpperCase(),
    pad,
    H * 0.065,
    Math.min(W, H) * 0.032,
    spec.paper,
    'left',
    700,
    ARTWORK_FONT_TEXT,
  );

  // Headline block.
  const headlineSize = Math.min(W, H) * 0.14;
  ctx.fillStyle = spec.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 ${headlineSize}px ${ARTWORK_FONT}`;
  const headlineTop = H * 0.26;
  const headlineLines = spec.headline.split(' ');
  let line = '';
  let cy = headlineTop;
  for (const word of headlineLines) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > W - pad * 2 && line) {
      ctx.fillText(line, pad, cy);
      line = word;
      cy += headlineSize * 1.02;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, pad, cy);

  // Body copy.
  ctx.fillStyle = spec.secondary;
  ctx.font = `400 ${Math.min(W, H) * 0.038}px ${ARTWORK_FONT_TEXT}`;
  wrapText(ctx, spec.body, pad, cy + headlineSize * 1.2, W - pad * 2, Math.min(W, H) * 0.05);

  // Product block.
  const blockH = H * 0.3;
  const blockY = H - pad - blockH;
  drawProductSilhouette(ctx, pad, blockY, W * 0.26, blockH, spec);

  // CTA strip.
  ctx.fillStyle = spec.primary;
  ctx.fillRect(
    pad + W * 0.32,
    blockY + blockH - Math.min(W, H) * 0.07,
    W - pad * 2 - W * 0.32,
    Math.min(W, H) * 0.07,
  );
  drawLabel(
    ctx,
    'PRINTSYNC.EXAMPLE / INSTALLED NATIONWIDE',
    pad + W * 0.34,
    blockY + blockH - Math.min(W, H) * 0.035,
    Math.min(W, H) * 0.03,
    spec.paper,
    'left',
    700,
    ARTWORK_FONT_TEXT,
  );

  ctx.fillStyle = spec.accent;
  ctx.fillRect(0, H - Math.min(W, H) * 0.02, W, Math.min(W, H) * 0.02);

  productionMarks(ctx, W, H, spec.ink);
  return canvasTexture(canvas);
}

/**
 * Paint a digital screen: the same brand system, lit for a dark LED panel, with
 * a pixel grid and horizontal refresh banding baked in.
 */
export function createDigitalTexture(spec: OohArtworkSpec): CanvasTexture {
  const { width: W, height: H } = oohCanvasSize(spec.aspect);
  const { canvas, ctx } = createCanvas(W, H);
  const rand = mulberry32(spec.seed);
  const pad = Math.round(Math.min(W, H) * 0.08);

  const background = ctx.createLinearGradient(0, 0, W, H);
  background.addColorStop(0, '#05060b');
  background.addColorStop(0.55, spec.secondary);
  background.addColorStop(1, '#05060b');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);

  // Radial brand glow.
  const glow = ctx.createRadialGradient(
    W * 0.72,
    H * 0.34,
    0,
    W * 0.72,
    H * 0.34,
    Math.max(W, H) * 0.7,
  );
  glow.addColorStop(0, `${spec.primary}cc`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = spec.accent;
  ctx.fillRect(pad, pad, Math.min(W, H) * 0.09, Math.min(W, H) * 0.012);
  drawLabel(
    ctx,
    spec.kicker.toUpperCase(),
    pad,
    pad + Math.min(W, H) * 0.05,
    Math.min(W, H) * 0.034,
    '#ffffff',
    'left',
    700,
    ARTWORK_FONT_TEXT,
  );

  const headlineSize = Math.min(W, H) * 0.155;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 ${headlineSize}px ${ARTWORK_FONT}`;
  let line = '';
  let cy = H * 0.4;
  for (const word of spec.headline.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > W - pad * 2 && line) {
      ctx.fillText(line, pad, cy);
      line = word;
      cy += headlineSize * 1.02;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, pad, cy);

  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = `400 ${Math.min(W, H) * 0.04}px ${ARTWORK_FONT_TEXT}`;
  wrapText(ctx, spec.body, pad, cy + headlineSize * 1.25, W - pad * 2, Math.min(W, H) * 0.052);

  // Signed off with the real mark, reversed for the LED surface.
  const footerMark = Math.min(W, H) * 0.09;
  drawBrandMark(ctx, W - pad - footerMark / 2, H - pad, { size: footerMark, flatten: spec.paper });
  drawLabel(
    ctx,
    spec.wordmark,
    W - pad - footerMark - Math.min(W, H) * 0.024,
    H - pad,
    Math.min(W, H) * 0.05,
    spec.paper,
    'right',
  );

  // LED pixel grid.
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  const cell = Math.max(3, Math.round(Math.min(W, H) / 160));
  for (let x = 0; x < W; x += cell) ctx.fillRect(x, 0, 1, H);
  for (let y = 0; y < H; y += cell) ctx.fillRect(0, y, W, 1);

  // Refresh banding.
  for (let i = 0; i < 3; i++) {
    const y = rand() * H;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, y, W, Math.max(2, H * 0.02));
  }

  return canvasTexture(canvas);
}

// --- Signage ---------------------------------------------------------------------

/**
 * Paint a sign's face: field, border / ring and legend, clipped to the face
 * outline so triangles and octagons stay crisp and the corners stay transparent.
 */
export function createSignFaceTexture(sign: RoadSignSpec): CanvasTexture {
  const aspect = sign.width / sign.height;
  const { width: W, height: H } = oohCanvasSize(aspect);
  const { canvas, ctx } = createCanvas(W, H);
  const outline = roadSignOutlinePoints(sign.kind);
  const unit = Math.min(W, H);

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  traceSignOutline(ctx, outline, W, H);
  ctx.clip();

  // Field.
  ctx.fillStyle = sign.field;
  ctx.fillRect(0, 0, W, H);

  const detail = sign.detail;
  const legendColor = sign.legendColor ?? detail;

  drawSignDetail(ctx, sign.kind, W, H, unit, detail, legendColor, sign.field);

  ctx.restore();

  // Border riding the face outline.
  traceSignOutline(ctx, outline, W, H);
  ctx.strokeStyle = sign.kind === 'warning' || sign.kind === 'giveWay' ? detail : detail;
  ctx.lineWidth = unit * 0.045;
  ctx.stroke();

  if (sign.legend) {
    ctx.save();
    traceSignOutline(ctx, outline, W, H);
    ctx.clip();
    drawSignLegend(ctx, sign, W, H, unit, legendColor);
    ctx.restore();
  }

  return canvasTexture(canvas);
}

function drawSignDetail(
  ctx: CanvasRenderingContext2D,
  kind: RoadSignKind,
  W: number,
  H: number,
  unit: number,
  detail: string,
  legendColor: string,
  field: string,
): void {
  switch (kind) {
    case 'regulation': {
      // White face with a thick red ring.
      ctx.strokeStyle = detail;
      ctx.lineWidth = unit * 0.13;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, unit * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'prohibition': {
      // Brand-red disc gets a white bar (no entry); the blue variant gets a
      // white disc, a red ring and a red diagonal (no parking).
      if (field.toLowerCase() === '#c8001c') {
        ctx.fillStyle = legendColor;
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.fillRect(-unit * 0.36, -unit * 0.075, unit * 0.72, unit * 0.15);
        ctx.restore();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, unit * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = detail;
        ctx.lineWidth = unit * 0.09;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, unit * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = detail;
        ctx.fillRect(-unit * 0.42, -unit * 0.055, unit * 0.84, unit * 0.11);
        ctx.restore();
      }
      break;
    }
    case 'stop': {
      ctx.strokeStyle = detail;
      ctx.lineWidth = unit * 0.04;
      const k = unit * 0.42;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = Math.PI / 8 + (i * Math.PI) / 4;
        const x = W / 2 + Math.cos(angle) * k;
        const y = H / 2 - Math.sin(angle) * k;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'chevron': {
      ctx.strokeStyle = detail;
      ctx.lineWidth = unit * 0.07;
      const chevrons = 3;
      for (let i = 0; i < chevrons; i++) {
        const cy = H * (0.25 + i * 0.25);
        ctx.beginPath();
        ctx.moveTo(W * 0.2, cy + H * 0.09);
        ctx.lineTo(W * 0.5, cy - H * 0.06);
        ctx.lineTo(W * 0.8, cy + H * 0.09);
        ctx.stroke();
      }
      break;
    }
    case 'direction':
    case 'information': {
      ctx.strokeStyle = detail;
      ctx.lineWidth = unit * 0.04;
      ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, W - ctx.lineWidth * 2, H - ctx.lineWidth * 2);
      break;
    }
    default:
      break;
  }
}

function drawSignLegend(
  ctx: CanvasRenderingContext2D,
  sign: RoadSignSpec,
  W: number,
  H: number,
  unit: number,
  color: string,
): void {
  const text = sign.legend ?? '';
  if (!text) return;

  if (sign.kind === 'direction') {
    drawLabel(ctx, text, W * 0.06, H / 2, unit * 0.42, color, 'left');
    // Arrow.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(W * 0.9, H / 2);
    ctx.lineTo(W * 0.76, H * 0.28);
    ctx.lineTo(W * 0.76, H * 0.72);
    ctx.closePath();
    ctx.fill();
    return;
  }

  const size =
    sign.kind === 'stop'
      ? unit * 0.34
      : sign.kind === 'warning'
        ? unit * 0.7
        : sign.kind === 'information'
          ? unit * 0.6
          : unit * 0.5;
  drawLabel(ctx, text, W / 2, H / 2, size, color);
}

// --- Route ribbon ----------------------------------------------------------------

/** A glowing route ribbon texture: soft edges with direction chevrons. */
export function createRouteRibbonTexture(): CanvasTexture {
  const W = 128;
  const H = 512;
  const { canvas, ctx } = createCanvas(W, H);

  const across = ctx.createLinearGradient(0, 0, W, 0);
  across.addColorStop(0, 'rgba(200,0,28,0)');
  across.addColorStop(0.32, 'rgba(255,90,90,0.55)');
  across.addColorStop(0.5, 'rgba(255,255,255,0.95)');
  across.addColorStop(0.68, 'rgba(255,90,90,0.55)');
  across.addColorStop(1, 'rgba(200,0,28,0)');
  ctx.fillStyle = across;
  ctx.fillRect(0, 0, W, H);

  // Direction chevrons.
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 10;
  for (let i = 0; i < 5; i++) {
    const cy = (i + 0.5) * (H / 5);
    ctx.beginPath();
    ctx.moveTo(W * 0.24, cy + H * 0.045);
    ctx.lineTo(W * 0.5, cy - H * 0.02);
    ctx.lineTo(W * 0.76, cy + H * 0.045);
    ctx.stroke();
  }

  return canvasTexture(canvas, [1, 1]);
}

// --- Shared textures -------------------------------------------------------------

// --- Shopfronts ------------------------------------------------------------

/** A shopfront fascia's face plus its glow map, so lit signage reads at night. */
export interface FasciaTextures {
  readonly map: CanvasTexture;
  readonly emissive: CanvasTexture;
}

const FASCIA_W = 1536;
const FASCIA_H = 128;
const VINYL_W = 1024;
const VINYL_H = 360;
const WALL_W = 1024;
const WALL_H = 360;
const ABOARD_W = 384;
const ABOARD_H = 560;

/**
 * The face of a shopfront fascia, fabricated one of the three ways shopfronts
 * really are: a solid printed panel, individual illuminated channel letters on a
 * tray, or an internally lit lightbox.
 *
 * Returns an albedo *and* an emissive map, because what glows differs by
 * fabrication — a lightbox glows across its whole face, channel letters glow
 * only where the letters are, a printed panel is merely floodlit. That is the
 * same split the building facades use, and for the same reason.
 */
export function createFasciaTextures(
  name: string,
  accent: string,
  kind: ShopfrontFasciaKind,
  isPrintSync: boolean,
  wordmark: string,
): FasciaTextures {
  const albedo = createCanvas(FASCIA_W, FASCIA_H);
  const glow = createCanvas(FASCIA_W, FASCIA_H);
  const label = isPrintSync ? wordmark : name;
  const markSize = FASCIA_H * 0.62;
  const pad = FASCIA_H * 0.4;
  const textX = isPrintSync ? pad + markSize * 1.32 : pad;
  const maxTextWidth = FASCIA_W - textX - pad;

  const paint = (c: CanvasRenderingContext2D, lit: boolean): void => {
    if (lit) {
      c.fillStyle = '#000000';
      c.fillRect(0, 0, FASCIA_W, FASCIA_H);
      if (kind === 'panel' || kind === 'lightbox') {
        const inset = kind === 'lightbox' ? 9 : 0;
        c.fillStyle = withAlpha(accent, kind === 'lightbox' ? 0.9 : 0.5);
        c.fillRect(inset, inset, FASCIA_W - inset * 2, FASCIA_H - inset * 2);
      }
    } else if (kind === 'panel') {
      c.fillStyle = accent;
      c.fillRect(0, 0, FASCIA_W, FASCIA_H);
      c.fillStyle = withAlpha('#000000', 0.22);
      c.fillRect(0, 0, FASCIA_W, 6);
      c.fillRect(0, FASCIA_H - 6, FASCIA_W, 6);
    } else if (kind === 'lightbox') {
      c.fillStyle = '#0f1116';
      c.fillRect(0, 0, FASCIA_W, FASCIA_H);
      c.fillStyle = accent;
      c.fillRect(9, 9, FASCIA_W - 18, FASCIA_H - 18);
      c.fillStyle = withAlpha('#ffffff', 0.14);
      c.fillRect(9, 9, FASCIA_W - 18, 14);
    } else {
      // Channel letters on a dark tray, the letters themselves doing the work.
      c.fillStyle = '#0a0c10';
      c.fillRect(0, 0, FASCIA_W, FASCIA_H);
      c.fillStyle = 'rgba(255,255,255,0.05)';
      c.fillRect(0, 0, FASCIA_W, 5);
      c.fillRect(0, FASCIA_H - 5, FASCIA_W, 5);
    }

    if (isPrintSync) {
      const markOptions: BrandMarkOptions = lit
        ? { size: markSize, flatten: '#ffffff' }
        : { size: markSize };
      drawBrandMark(c, pad + markSize / 2, FASCIA_H / 2, markOptions);
    }

    c.textAlign = 'left';
    c.textBaseline = 'middle';
    let fontPx = FASCIA_H * 0.52;
    c.font = `900 ${fontPx}px ${ARTWORK_FONT}`;
    const textWidth = c.measureText(label).width;
    if (textWidth > maxTextWidth) {
      fontPx *= maxTextWidth / textWidth;
      c.font = `900 ${fontPx}px ${ARTWORK_FONT}`;
    }
    c.fillStyle = lit || kind !== 'letters' ? '#ffffff' : accent;
    c.fillText(label, textX, FASCIA_H / 2 + FASCIA_H * 0.02);
  };

  paint(albedo.ctx, false);
  paint(glow.ctx, true);
  return { map: canvasTexture(albedo.canvas), emissive: canvasTexture(glow.canvas) };
}

/**
 * Printed window vinyl as a transparent overlay on the glazing — the four
 * treatments that are actually specified: clear glass with just an etched
 * opening-hours strip, a frosted band across the middle, perforated one-way
 * vision film, or a full printed graphic.
 */
export function createWindowVinylTexture(
  kind: ShopfrontWindowKind,
  name: string,
  accent: string,
  seed: number,
): CanvasTexture {
  const { canvas, ctx } = createCanvas(VINYL_W, VINYL_H);
  ctx.clearRect(0, 0, VINYL_W, VINYL_H);
  const rand = mulberry32(seed >>> 0 || 1);

  if (kind === 'perforated') {
    ctx.fillStyle = withAlpha(accent, 0.88);
    ctx.fillRect(0, 0, VINYL_W, VINYL_H);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';
    for (let y = 12; y < VINYL_H; y += 22) {
      for (let x = 12; x < VINYL_W; x += 22) {
        ctx.beginPath();
        ctx.arc(x, y, 4.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  } else if (kind === 'vinyl') {
    ctx.fillStyle = withAlpha(accent, 0.95);
    ctx.fillRect(0, 0, VINYL_W, VINYL_H);
  } else if (kind === 'band') {
    ctx.fillStyle = withAlpha('#ffffff', 0.9);
    ctx.fillRect(0, VINYL_H * 0.32, VINYL_W, VINYL_H * 0.22);
    ctx.fillStyle = withAlpha('#000000', 0.12);
    ctx.fillRect(0, VINYL_H * 0.32, VINYL_W, 3);
    ctx.fillRect(0, VINYL_H * 0.54 - 3, VINYL_W, 3);
  }

  const banded = kind === 'band';
  const ink = banded ? '#111418' : '#ffffff';

  if (kind !== 'clear') {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const size = (banded ? 0.13 : 0.17) * VINYL_H;
    const label = name.toUpperCase();
    ctx.font = `900 ${size}px ${ARTWORK_FONT}`;
    ctx.fillStyle = ink;
    const cx = VINYL_W * 0.06;
    const cy = banded ? VINYL_H * 0.43 : VINYL_H * 0.4;
    ctx.fillText(label, cx, cy);
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = banded ? withAlpha('#111418', 0.55) : withAlpha('#ffffff', 0.75);
    ctx.fillRect(
      cx,
      cy + size * 0.8,
      Math.min(textWidth, VINYL_W * 0.72),
      Math.max(3, size * 0.09),
    );
  }

  // Opening hours and a founding date etched along the base of the glass.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${VINYL_H * 0.055}px ${ARTWORK_FONT_TEXT}`;
  ctx.fillStyle = withAlpha('#ffffff', kind === 'clear' ? 0.62 : 0.9);
  ctx.fillText(banded ? 'MON–SAT 9–6' : 'OPEN 7 DAYS', VINYL_W * 0.06, VINYL_H * 0.94);
  ctx.textAlign = 'right';
  ctx.fillText(`EST. ${1965 + Math.floor(rand() * 55)}`, VINYL_W * 0.94, VINYL_H * 0.94);

  return canvasTexture(canvas);
}

/**
 * The interior's street-facing back wall — the largest printed surface inside a
 * shop, and the one that makes an interior read as *branded* rather than merely
 * furnished. Three real treatments: a printed colour mural, a gallery wall of
 * framed prints, or a panelled wall with a printed signage band.
 */
export function createInteriorWallTexture(
  name: string,
  accent: string,
  backWall: ShopfrontBackWall,
  seed: number,
): CanvasTexture {
  const { canvas, ctx } = createCanvas(WALL_W, WALL_H);
  const rand = mulberry32(seed >>> 0 || 1);

  if (backWall === 'mural') {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, WALL_W, WALL_H);
    ctx.fillStyle = withAlpha('#ffffff', 0.1);
    for (let i = 0; i < 90; i++) {
      ctx.beginPath();
      ctx.arc(rand() * WALL_W, rand() * WALL_H, 6 + rand() * 26, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = withAlpha('#ffffff', 0.92);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${WALL_H * 0.32}px ${ARTWORK_FONT}`;
    ctx.fillText(name.toUpperCase(), WALL_W * 0.06, WALL_H * 0.46);
  } else if (backWall === 'poster') {
    ctx.fillStyle = '#e9e6df';
    ctx.fillRect(0, 0, WALL_W, WALL_H);
    const cols = 5;
    const rows = 2;
    const gap = 22;
    const cw = (WALL_W - gap * (cols + 1)) / cols;
    const ch = (WALL_H - gap * (rows + 1)) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = gap + c * (cw + gap);
        const y = gap + r * (ch + gap);
        ctx.fillStyle = '#fbfaf7';
        ctx.fillRect(x, y, cw, ch);
        ctx.strokeStyle = 'rgba(0,0,0,0.32)';
        ctx.lineWidth = 5;
        ctx.strokeRect(x + 4, y + 4, cw - 8, ch - 8);
        const tone = (r * cols + c) % 4;
        ctx.fillStyle = tone === 0 ? accent : withAlpha('#111418', 0.82);
        if (tone === 0) {
          ctx.beginPath();
          ctx.arc(x + cw / 2, y + ch * 0.44, Math.min(cw, ch) * 0.24, 0, Math.PI * 2);
          ctx.fill();
        } else if (tone === 1) {
          ctx.fillRect(x + cw * 0.16, y + ch * 0.22, cw * 0.68, ch * 0.3);
        } else if (tone === 2) {
          ctx.beginPath();
          ctx.moveTo(x + cw * 0.5, y + ch * 0.16);
          ctx.lineTo(x + cw * 0.84, y + ch * 0.62);
          ctx.lineTo(x + cw * 0.16, y + ch * 0.62);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(x + cw * 0.16, y + ch * 0.22, cw * 0.68, ch * 0.13);
          ctx.fillRect(x + cw * 0.16, y + ch * 0.44, cw * 0.46, ch * 0.13);
        }
      }
    }
  } else {
    ctx.fillStyle = '#d9d3c8';
    ctx.fillRect(0, 0, WALL_W, WALL_H);
    ctx.fillStyle = withAlpha('#000000', 0.08);
    for (let x = 0; x < WALL_W; x += 96) ctx.fillRect(x, 0, 3, WALL_H);
    ctx.fillStyle = withAlpha('#000000', 0.05);
    ctx.fillRect(0, 0, WALL_W, 26);
    ctx.fillStyle = accent;
    ctx.fillRect(0, WALL_H * 0.3, WALL_W, WALL_H * 0.24);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${WALL_H * 0.15}px ${ARTWORK_FONT}`;
    ctx.fillText(name.toUpperCase(), WALL_W / 2, WALL_H * 0.42);
  }

  return canvasTexture(canvas);
}

/** The printed front of a shop counter: the name in the trade accent. */
export function createCounterFrontTexture(
  name: string,
  accent: string,
  lines: readonly string[],
): CanvasTexture {
  const W = 512;
  const H = 160;
  const { canvas, ctx } = createCanvas(W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = withAlpha('#000000', 0.2);
  ctx.fillRect(0, H - 8, W, 8);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${H * 0.3}px ${ARTWORK_FONT}`;
  ctx.fillText(name.toUpperCase(), W * 0.06, H * 0.38);
  ctx.font = `600 ${H * 0.14}px ${ARTWORK_FONT_TEXT}`;
  ctx.fillStyle = withAlpha('#ffffff', 0.85);
  ctx.fillText(lines[0] ?? '', W * 0.06, H * 0.72);
  return canvasTexture(canvas);
}

/**
 * A thin printed strip: shelf-edge labels inside, and the valance along an
 * awning outside. Both are the same product — a continuous printed band — so
 * they share one painter.
 */
export function createStripTexture(name: string, accent: string, height = 48): CanvasTexture {
  const W = 1024;
  const { canvas, ctx } = createCanvas(W, height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, height);
  ctx.fillStyle = withAlpha('#ffffff', 0.9);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${height * 0.42}px ${ARTWORK_FONT}`;
  const label = name.toUpperCase();
  const step = ctx.measureText(label).width + height * 1.1;
  for (let x = height * 0.5; x < W; x += step) {
    ctx.fillText(label, x, height / 2);
    ctx.beginPath();
    ctx.arc(x + step - height * 0.5, height / 2, height * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvasTexture(canvas, [1, 1]);
}

/** A printed banner hung under a shop's ceiling: slogan above, name below. */
export function createBannerTexture(text: string, name: string, accent: string): CanvasTexture {
  const W = 1024;
  const H = 128;
  const { canvas, ctx } = createCanvas(W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = withAlpha('#000000', 0.14);
  ctx.fillRect(0, 0, W, 6);
  ctx.fillRect(0, H - 6, W, 6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${H * 0.4}px ${ARTWORK_FONT}`;
  ctx.fillText(text.toUpperCase(), W / 2, H * 0.4);
  ctx.font = `700 ${H * 0.16}px ${ARTWORK_FONT_TEXT}`;
  ctx.fillStyle = withAlpha('#ffffff', 0.85);
  ctx.fillText(name.toUpperCase(), W / 2, H * 0.76);
  return canvasTexture(canvas);
}

/** The face of the A-board on the pavement outside. */
export function createAboardTexture(
  name: string,
  accent: string,
  lines: readonly string[],
  isPrintSync: boolean,
  wordmark: string,
): CanvasTexture {
  const { canvas, ctx } = createCanvas(ABOARD_W, ABOARD_H);
  const pad = ABOARD_W * 0.08;
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, ABOARD_W, ABOARD_H);
  ctx.fillStyle = accent;
  ctx.fillRect(pad, pad, ABOARD_W - pad * 2, ABOARD_H * 0.19);

  ctx.textBaseline = 'middle';
  if (isPrintSync) {
    const markSize = ABOARD_H * 0.11;
    drawBrandMark(ctx, pad + markSize * 0.9, pad + ABOARD_H * 0.095, { size: markSize });
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${ABOARD_H * 0.095}px ${ARTWORK_FONT}`;
    ctx.fillText(wordmark, pad + markSize * 1.8, pad + ABOARD_H * 0.095);
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${ABOARD_H * 0.092}px ${ARTWORK_FONT}`;
    ctx.fillText(name.toUpperCase(), ABOARD_W / 2, pad + ABOARD_H * 0.095);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#1a1c20';
  ctx.font = `700 ${ABOARD_H * 0.06}px ${ARTWORK_FONT_TEXT}`;
  let y = ABOARD_H * 0.4;
  for (const line of lines.slice(0, 4)) {
    ctx.fillText(line, pad, y);
    y += ABOARD_H * 0.082;
  }

  ctx.fillStyle = withAlpha('#000000', 0.16);
  ctx.fillRect(pad, y + ABOARD_H * 0.02, ABOARD_W - pad * 2, 3);

  ctx.fillStyle = accent;
  ctx.font = `900 ${ABOARD_H * 0.07}px ${ARTWORK_FONT}`;
  ctx.fillText('10% OFF', pad, y + ABOARD_H * 0.12);
  ctx.fillStyle = withAlpha('#1a1c20', 0.6);
  ctx.font = `600 ${ABOARD_H * 0.045}px ${ARTWORK_FONT_TEXT}`;
  wrapText(
    ctx,
    'Show this board in store. One per customer.',
    pad,
    y + ABOARD_H * 0.19,
    ABOARD_W - pad * 2,
    ABOARD_H * 0.058,
  );

  return canvasTexture(canvas);
}

/** Striped awning canvas. Tiles along the frontage. */
export function createAwningFabricTexture(accent: string): CanvasTexture {
  const W = 256;
  const H = 64;
  const { canvas, ctx } = createCanvas(W, H);
  ctx.fillStyle = '#efece4';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  const stripe = W / 8;
  for (let i = 0; i < 8; i += 2) ctx.fillRect(i * stripe, 0, stripe, H);
  ctx.fillStyle = withAlpha('#000000', 0.05);
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  return canvasTexture(canvas, [1, 1]);
}

const FACADE_CACHE = new Map<string, FacadeTextures>();

/**
 * The shared facade texture pair for a variant at a given palette. Cached so the
 * whole city shares a handful of canvases instead of one per building;
 * buildings clone the pair to set their own window `repeat`.
 */
export function getFacadeTextures(variant: WindowVariant, palette: CityPalette): FacadeTextures {
  const key = `${variant}|${palette.facade}`;
  let textures = FACADE_CACHE.get(key);
  if (!textures) {
    const seed = (variant === 'warm' ? 1 : variant === 'cool' ? 2 : 3) * 2654435761;
    textures = createFacadeTextures(variant, palette, seed);
    FACADE_CACHE.set(key, textures);
  }
  return textures;
}

/** Clone a base texture and give it its own window tiling. */
export function cloneWithRepeat(
  base: CanvasTexture,
  repeatX: number,
  repeatY: number,
): CanvasTexture {
  const texture = base.clone();
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(Math.max(0.5, repeatX), Math.max(0.5, repeatY));
  texture.needsUpdate = true;
  return texture;
}

const LIGHT_POOL_CACHE = new Map<string, CanvasTexture>();
const GLOW_CACHE = new Map<string, CanvasTexture>();
const CROSSING_CACHE = new Map<number, CanvasTexture>();

/**
 * The shared additive light pool for a lamp colour. One canvas is reused by
 * every lamp in the city — the pools only differ by scale and opacity.
 */
export function getLightPoolTexture(colour: string): CanvasTexture {
  let texture = LIGHT_POOL_CACHE.get(colour);
  if (!texture) {
    texture = createLightPoolTexture(colour);
    LIGHT_POOL_CACHE.set(colour, texture);
  }
  return texture;
}

/** The shared additive glow sprite for a lamp colour. */
export function getGlowTexture(colour: string): CanvasTexture {
  let texture = GLOW_CACHE.get(colour);
  if (!texture) {
    texture = createGlowTexture(colour);
    GLOW_CACHE.set(colour, texture);
  }
  return texture;
}

/** The shared worn zebra crossing overlay. */
export function getCrossingTexture(seed = 3): CanvasTexture {
  let texture = CROSSING_CACHE.get(seed);
  if (!texture) {
    texture = createCrossingTexture(seed);
    CROSSING_CACHE.set(seed, texture);
  }
  return texture;
}
