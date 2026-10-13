import { CanvasTexture, SRGBColorSpace } from 'three';
import type { ArtworkSpec } from '@printsync/motion-engine';

const SIZE = 1024;
const FONT = "'Arial Black', 'Helvetica Neue', Arial, sans-serif";
const FONT_TEXT = "Arial, 'Helvetica Neue', sans-serif";

/**
 * Procedurally draw brand artwork for a catalogue item onto an offscreen canvas
 * and return it as a CanvasTexture. Deterministic — the same ArtworkSpec always
 * produces the same pixels, so the same item always prints the same artwork.
 *
 * The canvas is transparent outside the printed form, so the item's material
 * (kraft, metal, plastic...) shows through around the label.
 */
export function createArtworkTexture(spec: ArtworkSpec): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SIZE, SIZE);

  switch (spec.shape) {
    case 'circle':
      drawCircle(ctx, spec);
      break;
    case 'band':
      drawBand(ctx, spec);
      break;
    default:
      drawRect(ctx, spec);
      break;
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// --- Shared primitives -----------------------------------------------------

function drawWordmark(
  ctx: CanvasRenderingContext2D,
  spec: ArtworkSpec,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = 'center',
): void {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.fillText(spec.wordmark, x, y);
}

function drawBarcode(
  ctx: CanvasRenderingContext2D,
  spec: ArtworkSpec,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  let cx = x;
  let seed = spec.barcodeSeed;
  while (cx < x + w - 4) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const barW = ((seed >> 16) & 0x3) + 1;
    if (barW > 2) ctx.fillRect(cx, y, barW, h);
    cx += barW + 3;
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
): void {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function registrationMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.moveTo(cx - size, cy);
  ctx.lineTo(cx + size, cy);
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx, cy + size);
  ctx.stroke();
}

// --- Surface shapes --------------------------------------------------------

function drawRect(ctx: CanvasRenderingContext2D, spec: ArtworkSpec): void {
  const margin = 56;
  const w = SIZE - margin * 2;
  const h = SIZE - margin * 2;
  const x = margin;
  const y = margin;
  const radius = 26;

  ctx.fillStyle = spec.paper;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();

  switch (spec.variant) {
    case 'banner':
      drawRectBanner(ctx, spec, x, y, w, h, radius);
      break;
    case 'monogram':
      drawRectMonogram(ctx, spec, x, y, w, h);
      break;
    case 'grid':
      drawRectGrid(ctx, spec, x, y, w, h);
      break;
    default:
      drawRectEditorial(ctx, spec, x, y, w, h, radius);
      break;
  }

  registrationMark(ctx, x + 34, y + 34, 12, spec.secondary);
  registrationMark(ctx, x + w - 34, y + h - 34, 12, spec.secondary);
}

function drawRectEditorial(
  ctx: CanvasRenderingContext2D,
  spec: ArtworkSpec,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.fillStyle = spec.primary;
  roundRect(ctx, x, y, w, 190, radius);
  ctx.fill();
  ctx.fillRect(x, y + 190 - radius, w, radius);
  drawWordmark(ctx, spec, x + w / 2, y + 95, 84, spec.paper);

  ctx.fillStyle = spec.accent;
  ctx.fillRect(x, y + 190, w, 8);

  ctx.fillStyle = spec.secondary;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 230px ${FONT}`;
  ctx.fillText(String(spec.index).padStart(2, '0'), x + 44, y + 470);

  ctx.fillStyle = spec.ink;
  ctx.textAlign = 'center';
  ctx.font = `400 34px ${FONT_TEXT}`;
  wrapText(ctx, spec.tagline, x + w / 2, y + 560, w - 80, 42);

  drawBarcode(ctx, spec, x + 44, y + h - 130, w - 88, 74, spec.ink);
}

function drawRectBanner(
  ctx: CanvasRenderingContext2D,
  spec: ArtworkSpec,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.fillStyle = spec.primary;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.62);
  ctx.lineTo(x + w, y + h * 0.34);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  drawWordmark(ctx, spec, x + w / 2, y + h * 0.26, 78, spec.secondary);

  ctx.fillStyle = spec.secondary;
  ctx.textAlign = 'center';
  ctx.font = `400 36px ${FONT_TEXT}`;
  wrapText(ctx, spec.tagline, x + w / 2, y + h * 0.37, w - 100, 44);

  ctx.fillStyle = spec.paper;
  ctx.textAlign = 'left';
  ctx.font = `900 150px ${FONT}`;
  ctx.fillText(String(spec.index).padStart(2, '0'), x + 44, y + h - 150);

  drawBarcode(ctx, spec, x + w * 0.45, y + h - 150, w * 0.5 - 44, 70, spec.paper);
}

function drawRectMonogram(
  ctx: CanvasRenderingContext2D,
  spec: ArtworkSpec,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const cx = x + w / 2;
  const cy = y + h * 0.4;
  const r = Math.min(w, h) * 0.24;

  ctx.fillStyle = spec.primary;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = spec.paper;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${r * 1.05}px ${FONT}`;
  ctx.fillText(spec.wordmark.slice(0, 1), cx, cy + r * 0.06);

  drawWordmark(ctx, spec, cx, y + h * 0.72, 62, spec.secondary);

  ctx.fillStyle = spec.ink;
  ctx.textAlign = 'center';
  ctx.font = `400 32px ${FONT_TEXT}`;
  wrapText(ctx, spec.tagline, cx, y + h * 0.82, w - 100, 40);

  drawBarcode(ctx, spec, x + w * 0.28, y + h - 120, w * 0.44, 58, spec.ink);
}

function drawRectGrid(
  ctx: CanvasRenderingContext2D,
  spec: ArtworkSpec,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const cols = 7;
  const rows = 4;
  const dot = 10;
  ctx.fillStyle = spec.primary;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const px = x + 70 + (c * (w - 140)) / (cols - 1);
      const py = y + 80 + (r * (h * 0.42)) / (rows - 1);
      ctx.beginPath();
      ctx.arc(px, py, dot, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = spec.secondary;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 120px ${FONT}`;
  ctx.fillText(spec.wordmark, x + w / 2, y + h * 0.72);

  ctx.fillStyle = spec.accent;
  ctx.fillRect(x + 80, y + h * 0.75, w - 160, 6);

  ctx.fillStyle = spec.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 30px ${FONT_TEXT}`;
  wrapText(ctx, spec.tagline, x + w / 2, y + h * 0.86, w - 120, 38);
}

function drawCircle(ctx: CanvasRenderingContext2D, spec: ArtworkSpec): void {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const r = SIZE * 0.47;

  ctx.fillStyle = spec.paper;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = spec.primary;
  ctx.fillRect(cx - r, cy + r * 0.36, r * 2, r * 0.9);

  ctx.strokeStyle = spec.primary;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  drawWordmark(ctx, spec, cx, cy - r * 0.28, 88, spec.secondary);

  ctx.fillStyle = spec.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 30px ${FONT_TEXT}`;
  wrapText(ctx, spec.tagline, cx, cy + r * 0.05, r * 1.3, 36);

  ctx.fillStyle = spec.paper;
  ctx.textAlign = 'center';
  ctx.font = `900 120px ${FONT}`;
  ctx.fillText(String(spec.index).padStart(2, '0'), cx, cy + r * 0.66);
}

function drawBand(ctx: CanvasRenderingContext2D, spec: ArtworkSpec): void {
  const w = SIZE;
  const bandTop = SIZE * 0.3;
  const bandH = SIZE * 0.4;

  ctx.fillStyle = spec.paper;
  ctx.globalAlpha = 0.94;
  ctx.fillRect(0, bandTop, w, bandH);
  ctx.globalAlpha = 1;

  ctx.fillStyle = spec.primary;
  ctx.fillRect(0, bandTop, w, 64);
  drawWordmark(ctx, spec, w / 2, bandTop + 32, 62, spec.paper);

  ctx.fillStyle = spec.secondary;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `900 150px ${FONT}`;
  ctx.fillText(String(spec.index).padStart(2, '0'), 40, bandTop + bandH / 2 + 10);

  ctx.fillStyle = spec.ink;
  ctx.textAlign = 'center';
  ctx.font = `400 32px ${FONT_TEXT}`;
  wrapText(ctx, spec.tagline, w / 2, bandTop + bandH / 2 + 30, w - 100, 40);

  ctx.fillStyle = spec.accent;
  ctx.fillRect(0, bandTop + bandH - 6, w, 6);

  drawBarcode(ctx, spec, 40, bandTop + bandH - 96, w - 80, 58, spec.ink);
}
