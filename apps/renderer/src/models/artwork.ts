import { CanvasTexture, SRGBColorSpace } from 'three';
import type { ArtworkSpec } from '@printsync/motion-engine';

const SIZE = 1024;

/**
 * Procedurally draw brand artwork for a catalogue item onto an offscreen
 * canvas and return it as a CanvasTexture. Deterministic — same ArtworkSpec
 * always produces the same pixels.
 */
export function createArtworkTexture(spec: ArtworkSpec): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // Transparent background — the item material shows through
  ctx.clearRect(0, 0, SIZE, SIZE);

  if (spec.mode === 'wrap') {
    drawWrapLabel(ctx, spec);
  } else {
    drawLabel(ctx, spec);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function drawLabel(ctx: CanvasRenderingContext2D, spec: ArtworkSpec): void {
  const w = SIZE;
  const h = SIZE;
  const margin = 60;
  const labelW = w - margin * 2;
  const labelH = h - margin * 2;
  const radius = 24;

  // Label background
  ctx.fillStyle = spec.paper;
  roundRect(ctx, margin, margin, labelW, labelH, radius);
  ctx.fill();

  // Primary color header band
  ctx.fillStyle = spec.primary;
  roundRect(ctx, margin, margin, labelW, 180, radius);
  ctx.fill();
  ctx.fillRect(margin, margin + 180 - radius, labelW, radius);

  // Wordmark in header
  ctx.fillStyle = spec.paper;
  ctx.font = `900 ${spec.layout === 'landscape' ? 88 : 72}px 'Inter', 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.wordmark, w / 2, margin + 90);

  // Accent stripe
  ctx.fillStyle = spec.accent;
  ctx.fillRect(margin, margin + 180, labelW, 8);

  // Index number
  ctx.fillStyle = spec.secondary;
  ctx.font = `900 200px 'Inter', 'Arial Black', sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(String(spec.index).padStart(2, '0'), margin + 40, margin + 420);

  // Tagline
  ctx.fillStyle = spec.ink;
  ctx.font = `400 36px 'Inter', Arial, sans-serif`;
  ctx.textAlign = 'center';
  wrapText(ctx, spec.tagline, w / 2, margin + 560, labelW - 80, 44);

  // Barcode strip
  drawBarcode(ctx, spec, margin + 40, h - margin - 120, labelW - 80, 80);

  // Registration marks
  drawRegistrationMarks(ctx, spec, margin, margin, labelW, labelH);
}

function drawWrapLabel(ctx: CanvasRenderingContext2D, spec: ArtworkSpec): void {
  const w = SIZE;
  const h = SIZE;
  const bandTop = h * 0.3;
  const bandH = h * 0.4;

  // Semi-transparent wrap band
  ctx.fillStyle = spec.paper;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(0, bandTop, w, bandH);
  ctx.globalAlpha = 1;

  // Primary band at top of wrap
  ctx.fillStyle = spec.primary;
  ctx.fillRect(0, bandTop, w, 60);

  // Wordmark
  ctx.fillStyle = spec.paper;
  ctx.font = `900 64px 'Inter', 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.wordmark, w / 2, bandTop + 30);

  // Index
  ctx.fillStyle = spec.secondary;
  ctx.font = `900 160px 'Inter', 'Arial Black', sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(String(spec.index).padStart(2, '0'), 40, bandTop + bandH / 2 + 20);

  // Tagline
  ctx.fillStyle = spec.ink;
  ctx.font = `400 32px 'Inter', Arial, sans-serif`;
  ctx.textAlign = 'center';
  wrapText(ctx, spec.tagline, w / 2, bandTop + bandH / 2 + 40, w - 80, 40);

  // Barcode
  drawBarcode(ctx, spec, 40, bandTop + bandH - 100, w - 80, 60);
}

function drawBarcode(
  ctx: CanvasRenderingContext2D,
  spec: ArtworkSpec,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = spec.ink;
  let cx = x;
  let seed = spec.barcodeSeed;
  while (cx < x + w - 4) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const barW = ((seed >> 16) & 0x3) + 1;
    if (barW > 2) ctx.fillRect(cx, y, barW, h);
    cx += barW + 3;
  }
}

function drawRegistrationMarks(
  ctx: CanvasRenderingContext2D,
  spec: ArtworkSpec,
  lx: number,
  ly: number,
  w: number,
  h: number,
): void {
  const size = 16;
  const off = 24;
  ctx.strokeStyle = spec.secondary;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.5;
  // top-left
  ctx.strokeRect(lx - off, ly - off, size, size);
  ctx.beginPath();
  ctx.moveTo(lx - off + size / 2, ly - off);
  ctx.lineTo(lx - off + size / 2, ly - off + size);
  ctx.moveTo(lx - off, ly - off + size / 2);
  ctx.lineTo(lx - off + size, ly - off + size / 2);
  ctx.stroke();
  // bottom-right
  ctx.strokeRect(lx + w + off - size, ly + h + off - size, size, size);
  ctx.beginPath();
  ctx.moveTo(lx + w + off - size / 2, ly + h + off - size);
  ctx.lineTo(lx + w + off - size / 2, ly + h + off);
  ctx.moveTo(lx + w + off - size, ly + h + off - size / 2);
  ctx.lineTo(lx + w + off, ly + h + off - size / 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
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
    const test = line ? line + ' ' + word : word;
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
