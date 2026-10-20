// ── Scopes Panel ─────────────────────────────────────────────────────────────
// Real-time scopes: histogram, waveform, vectorscope.
// See docs/23-COLOR.md §scopes.

import { useEffect, useRef } from 'react';

interface ScopesPanelProps {
  /** The canvas to sample from. */
  sourceCanvas?: HTMLCanvasElement | null;
  /** Scope type. */
  type?: 'histogram' | 'waveform' | 'vectorscope';
}

export function ScopesPanel({ sourceCanvas, type = 'histogram' }: ScopesPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = '#07090d';
    ctx.fillRect(0, 0, width, height);

    if (!sourceCanvas) {
      ctx.fillStyle = '#5eead4';
      ctx.font = '10px monospace';
      ctx.fillText('No source', 10, 20);
      return;
    }

    // Sample the source canvas
    const srcCtx = sourceCanvas.getContext('2d');
    if (!srcCtx) return;

    const imageData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const data = imageData.data;

    if (type === 'histogram') {
      // RGB histogram
      const bins = 256;
      const rHist = new Array(bins).fill(0);
      const gHist = new Array(bins).fill(0);
      const bHist = new Array(bins).fill(0);
      const lHist = new Array(bins).fill(0);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        rHist[r]++;
        gHist[g]++;
        bHist[b]++;
        const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
        lHist[lum]++;
      }

      const maxVal = Math.max(...lHist, 1);
      const barWidth = width / bins;

      // Draw luma histogram
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      for (let i = 0; i < bins; i++) {
        const h = (lHist[i] / maxVal) * height;
        ctx.fillRect(i * barWidth, height - h, barWidth, h);
      }

      // Draw RGB histograms
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255, 50, 50, 0.4)';
      for (let i = 0; i < bins; i++) {
        const h = (rHist[i] / maxVal) * height;
        ctx.fillRect(i * barWidth, height - h, barWidth, h);
      }
      ctx.fillStyle = 'rgba(50, 255, 50, 0.4)';
      for (let i = 0; i < bins; i++) {
        const h = (gHist[i] / maxVal) * height;
        ctx.fillRect(i * barWidth, height - h, barWidth, h);
      }
      ctx.fillStyle = 'rgba(50, 50, 255, 0.4)';
      for (let i = 0; i < bins; i++) {
        const h = (bHist[i] / maxVal) * height;
        ctx.fillRect(i * barWidth, height - h, barWidth, h);
      }
      ctx.globalCompositeOperation = 'source-over';
    } else if (type === 'waveform') {
      // Luma waveform
      ctx.strokeStyle = '#5eead4';
      ctx.lineWidth = 1;
      const cols = sourceCanvas.width;
      const colWidth = width / cols;
      for (let x = 0; x < cols; x++) {
        let minLum = 255;
        let maxLum = 0;
        for (let y = 0; y < sourceCanvas.height; y++) {
          const idx = (y * cols + x) * 4;
          const lum = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
          minLum = Math.min(minLum, lum);
          maxLum = Math.max(maxLum, lum);
        }
        const x0 = x * colWidth;
        ctx.beginPath();
        ctx.moveTo(x0, height - (minLum / 255) * height);
        ctx.lineTo(x0, height - (maxLum / 255) * height);
        ctx.stroke();
      }
    } else if (type === 'vectorscope') {
      // Vectorscope
      const cx = width / 2;
      const cy = height / 2;
      const scale = Math.min(width, height) / 2 - 10;
      ctx.fillStyle = 'rgba(94, 234, 212, 0.3)';
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        // Convert to YCbCr
        const cb = ((b - (0.2126 * r + 0.7152 * g + 0.0722 * b)) * 0.5) / (1 - 0.0722);
        const cr = ((r - (0.2126 * r + 0.7152 * g + 0.0722 * b)) * 0.5) / (1 - 0.2126);
        const px = cx + cr * scale;
        const py = cy - cb * scale;
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }, [sourceCanvas, type]);

  return (
    <canvas ref={canvasRef} width={200} height={150} className="w-full h-full bg-ink rounded" />
  );
}
