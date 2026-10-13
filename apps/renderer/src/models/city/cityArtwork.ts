import { RepeatWrapping, type CanvasTexture } from 'three';
import {
  mulberry32,
  roadSignOutlinePoints,
  type CityPalette,
  type OohArtworkSpec,
  type RoadSignKind,
  type RoadSignSpec,
} from '@printsync/motion-engine';
import {
  ARTWORK_FONT,
  ARTWORK_FONT_TEXT,
  canvasTexture,
  createCanvas,
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

/** A vertical sky gradient for the dome: zenith to city-glow horizon. */
export function createSkyTexture(palette: CityPalette): CanvasTexture {
  const { canvas, ctx } = createCanvas(8, 512);
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, palette.skyTop);
  gradient.addColorStop(0.66, palette.skyHorizon);
  gradient.addColorStop(1, palette.fog);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 8, 512);
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

  // Top brand bar.
  ctx.fillStyle = spec.primary;
  ctx.fillRect(0, 0, W, H * 0.13);
  drawLabel(ctx, spec.wordmark, W - pad, H * 0.065, Math.min(W, H) * 0.052, spec.paper, 'right');
  drawLabel(ctx, spec.kicker.toUpperCase(), pad, H * 0.065, Math.min(W, H) * 0.032, spec.paper, 'left', 700, ARTWORK_FONT_TEXT);

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
  ctx.fillRect(pad + W * 0.32, blockY + blockH - Math.min(W, H) * 0.07, W - pad * 2 - W * 0.32, Math.min(W, H) * 0.07);
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
  const glow = ctx.createRadialGradient(W * 0.72, H * 0.34, 0, W * 0.72, H * 0.34, Math.max(W, H) * 0.7);
  glow.addColorStop(0, `${spec.primary}cc`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = spec.accent;
  ctx.fillRect(pad, pad, Math.min(W, H) * 0.09, Math.min(W, H) * 0.012);
  drawLabel(ctx, spec.kicker.toUpperCase(), pad, pad + Math.min(W, H) * 0.05, Math.min(W, H) * 0.034, '#ffffff', 'left', 700, ARTWORK_FONT_TEXT);

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

  drawLabel(ctx, spec.wordmark, W - pad, H - pad, Math.min(W, H) * 0.05, spec.paper, 'right');

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
