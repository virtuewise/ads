// ── Scopes Panel ─────────────────────────────────────────────────────────────
// Live histogram, luminance waveform, and vectorscope sampled from the actual
// WebGPU viewport. The readback is demand-driven: `captureFrame` is called only
// while this panel is mounted, and the GPU copies one frame at a time.
// See docs/23-COLOR.md §5.

import { useEffect, useRef, useState } from 'react';

type ScopeType = 'histogram' | 'waveform' | 'vectorscope';

interface ScopesPanelProps {
  /** Returns the current viewport frame, or null when no frame is available. */
  captureFrame?: () => Promise<ImageData | null>;
}

interface Analysis {
  histogram: {
    r: Uint32Array;
    g: Uint32Array;
    b: Uint32Array;
    luma: Uint32Array;
    max: number;
  };
  waveform: {
    columns: number;
    bins: Float32Array;
    max: number;
  };
  vectorscope: {
    bins: Float32Array;
    size: number;
    max: number;
  };
  stats: {
    meanLuma: number;
    minLuma: number;
    maxLuma: number;
    meanSaturation: number;
    sampleCount: number;
  };
}

const SCOPE_TYPES: Array<{ id: ScopeType; label: string }> = [
  { id: 'histogram', label: 'Histogram' },
  { id: 'waveform', label: 'Waveform' },
  { id: 'vectorscope', label: 'Vector' },
];

const WAVEFORM_BINS = 256;
const WAVEFORM_COLUMNS = 512;
const VECTOR_SIZE = 128;
const SAMPLE_INTERVAL_MS = 300;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function analyze(image: ImageData): Analysis {
  const { width, height, data } = image;
  const step = Math.max(1, Math.floor(Math.max(width, height) / 360));

  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const luma = new Uint32Array(256);
  const waveformBins = new Float32Array(WAVEFORM_COLUMNS * WAVEFORM_BINS);
  const vectorBins = new Float32Array(VECTOR_SIZE * VECTOR_SIZE);

  let minLuma = 255;
  let maxLuma = 0;
  let lumaSum = 0;
  let saturationSum = 0;
  let sampleCount = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const red = data[i];
      const green = data[i + 1];
      const blue = data[i + 2];
      const lum = Math.round(0.2126 * red + 0.7152 * green + 0.0722 * blue);
      const maxChannel = Math.max(red, green, blue);
      const minChannel = Math.min(red, green, blue);

      r[red]++;
      g[green]++;
      b[blue]++;
      luma[lum]++;

      const column = clamp(
        Math.round((x / Math.max(1, width - 1)) * (WAVEFORM_COLUMNS - 1)),
        0,
        WAVEFORM_COLUMNS - 1,
      );
      const row = clamp(Math.round((1 - lum / 255) * (WAVEFORM_BINS - 1)), 0, WAVEFORM_BINS - 1);
      waveformBins[column * WAVEFORM_BINS + row]++;

      const cb = ((blue - lum) / 255) * 0.565;
      const cr = ((red - lum) / 255) * 0.713;
      const vx = clamp(Math.round((cr + 0.5) * (VECTOR_SIZE - 1)), 0, VECTOR_SIZE - 1);
      const vy = clamp(Math.round((0.5 - cb) * (VECTOR_SIZE - 1)), 0, VECTOR_SIZE - 1);
      vectorBins[vy * VECTOR_SIZE + vx]++;

      minLuma = Math.min(minLuma, lum);
      maxLuma = Math.max(maxLuma, lum);
      lumaSum += lum;
      saturationSum += maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;
      sampleCount++;
    }
  }

  let histMax = 1;
  for (let i = 0; i < 256; i++) {
    histMax = Math.max(histMax, r[i], g[i], b[i], luma[i]);
  }

  let waveMax = 1;
  for (let i = 0; i < waveformBins.length; i++) waveMax = Math.max(waveMax, waveformBins[i]);

  let vectorMax = 1;
  for (let i = 0; i < vectorBins.length; i++) vectorMax = Math.max(vectorMax, vectorBins[i]);

  return {
    histogram: { r, g, b, luma, max: histMax },
    waveform: { columns: WAVEFORM_COLUMNS, bins: waveformBins, max: waveMax },
    vectorscope: { bins: vectorBins, size: VECTOR_SIZE, max: vectorMax },
    stats: {
      meanLuma: sampleCount > 0 ? lumaSum / sampleCount : 0,
      minLuma: sampleCount > 0 ? minLuma : 0,
      maxLuma: sampleCount > 0 ? maxLuma : 0,
      meanSaturation: sampleCount > 0 ? saturationSum / sampleCount : 0,
      sampleCount,
    },
  };
}

export function ScopesPanel({ captureFrame }: ScopesPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureRef = useRef(captureFrame);
  const [type, setType] = useState<ScopeType>('histogram');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFrameAt, setLastFrameAt] = useState<number | null>(null);

  captureRef.current = captureFrame;

  useEffect(() => {
    let cancelled = false;
    let busy = false;

    const sample = async () => {
      if (busy || !captureRef.current) return;
      busy = true;
      try {
        const image = await captureRef.current();
        if (cancelled || !image) return;
        setAnalysis(analyze(image));
        setLastFrameAt(Date.now());
        setError(null);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        busy = false;
      }
    };

    void sample();
    const timer = window.setInterval(() => void sample(), SAMPLE_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = { left: 34, right: 10, top: 12, bottom: 22 };
    const plot = {
      x: padding.left,
      y: padding.top,
      width: width - padding.left - padding.right,
      height: height - padding.top - padding.bottom,
    };

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#07090d';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#090d14';
    ctx.fillRect(plot.x, plot.y, plot.width, plot.height);

    if (!analysis) {
      ctx.fillStyle = '#5eead4';
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(
        error ? 'Readback failed' : 'Waiting for a GPU frame…',
        plot.x + 10,
        plot.y + 24,
      );
      if (error) {
        ctx.fillStyle = '#8b93a7';
        ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText(error.slice(0, 52), plot.x + 10, plot.y + 42);
      }
      return;
    }

    if (type === 'histogram') {
      drawGrid(ctx, plot);
      drawHistogram(ctx, plot, analysis);
    } else if (type === 'waveform') {
      drawGrid(ctx, plot);
      drawWaveform(ctx, plot, analysis);
    } else {
      drawVectorscope(ctx, plot, analysis);
    }
  }, [analysis, type, error]);

  const stats = analysis?.stats;
  const timestamp = lastFrameAt
    ? new Date(lastFrameAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  return (
    <div className="scopes">
      <div className="scopes__tabs" role="tablist" aria-label="Scope type">
        {SCOPE_TYPES.map((scope) => (
          <button
            key={scope.id}
            type="button"
            role="tab"
            aria-selected={type === scope.id}
            className={`scopes__tab ${type === scope.id ? 'scopes__tab--active' : ''}`}
            onClick={() => setType(scope.id)}
          >
            {scope.label}
          </button>
        ))}
      </div>

      <div className="scopes__frame">
        <canvas ref={canvasRef} width={560} height={320} aria-label={`${type} scope`} />
        <span className={`scopes__live ${analysis ? 'scopes__live--on' : ''}`}>
          {analysis ? 'LIVE' : 'IDLE'}
        </span>
      </div>

      <dl className="scopes__stats">
        <div>
          <dt>Mean</dt>
          <dd>{stats ? stats.meanLuma.toFixed(1) : '—'}</dd>
        </div>
        <div>
          <dt>Range</dt>
          <dd>{stats ? `${stats.minLuma}–${stats.maxLuma}` : '—'}</dd>
        </div>
        <div>
          <dt>Saturation</dt>
          <dd>{stats ? `${Math.round(stats.meanSaturation * 100)}%` : '—'}</dd>
        </div>
        <div>
          <dt>Frame</dt>
          <dd>{timestamp}</dd>
        </div>
      </dl>

      <p className="scopes__note">
        Viewport readback, sampled every {Math.round(SAMPLE_INTERVAL_MS / 100) / 10}s. Values are
        8-bit display-referred sRGB.
      </p>
    </div>
  );
}

interface PlotRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function drawGrid(ctx: CanvasRenderingContext2D, plot: PlotRect): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.055)';
  ctx.lineWidth = 1;
  ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#6f7789';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const y = plot.y + plot.height * (1 - t);
    ctx.beginPath();
    ctx.moveTo(plot.x, Math.round(y) + 0.5);
    ctx.lineTo(plot.x + plot.width, Math.round(y) + 0.5);
    ctx.stroke();
    ctx.fillText(String(i * 25), plot.x - 7, y);
  }

  for (let i = 0; i <= 4; i++) {
    const x = plot.x + plot.width * (i / 4);
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, plot.y);
    ctx.lineTo(Math.round(x) + 0.5, plot.y + plot.height);
    ctx.stroke();
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#576077';
  ctx.fillText('IRE', 8, plot.y + plot.height + 13);
  ctx.restore();
}

function drawHistogram(ctx: CanvasRenderingContext2D, plot: PlotRect, analysis: Analysis): void {
  const { histogram } = analysis;
  const barWidth = plot.width / 256;
  const channelAlpha = 0.52;

  const gradient = ctx.createLinearGradient(0, plot.y, 0, plot.y + plot.height);
  gradient.addColorStop(0, 'rgba(233,236,243,0.26)');
  gradient.addColorStop(1, 'rgba(233,236,243,0.03)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(plot.x, plot.y + plot.height);
  for (let i = 0; i < 256; i++) {
    const h = (histogram.luma[i] / histogram.max) ** 0.52 * plot.height;
    ctx.lineTo(plot.x + i * barWidth, plot.y + plot.height - h);
  }
  ctx.lineTo(plot.x + plot.width, plot.y + plot.height);
  ctx.closePath();
  ctx.fill();

  const channels: Array<[Uint32Array, string]> = [
    [histogram.r, `rgba(255, 92, 92, ${channelAlpha})`],
    [histogram.g, `rgba(94, 234, 140, ${channelAlpha})`],
    [histogram.b, `rgba(116, 158, 255, ${channelAlpha})`],
  ];

  ctx.globalCompositeOperation = 'lighter';
  for (const [bins, color] of channels) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const h = (bins[i] / histogram.max) ** 0.52 * plot.height;
      const x = plot.x + i * barWidth + barWidth / 2;
      const y = plot.y + plot.height - h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';

  ctx.fillStyle = '#8b93a7';
  ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('0', plot.x, plot.y + plot.height + 13);
  ctx.fillText('128', plot.x + plot.width / 2, plot.y + plot.height + 13);
  ctx.fillText('255', plot.x + plot.width, plot.y + plot.height + 13);
}

function drawWaveform(ctx: CanvasRenderingContext2D, plot: PlotRect, analysis: Analysis): void {
  const { waveform } = analysis;
  const { columns, bins } = waveform;
  const cellWidth = plot.width / columns;
  const cellHeight = plot.height / WAVEFORM_BINS;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let column = 0; column < columns; column++) {
    const x = plot.x + column * cellWidth;
    for (let row = 0; row < WAVEFORM_BINS; row++) {
      const count = bins[column * WAVEFORM_BINS + row];
      if (count === 0) continue;
      const alpha = clamp((count / waveform.max) ** 0.45 * 0.85, 0.035, 0.9);
      ctx.fillStyle = `rgba(94, 234, 212, ${alpha})`;
      ctx.fillRect(x, plot.y + row * cellHeight, Math.max(1, cellWidth), Math.max(1, cellHeight));
    }
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#576077';
  ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i <= 4; i++) {
    const x = plot.x + plot.width * (i / 4);
    ctx.fillText(`${i * 25}`, x, plot.y + plot.height + 13);
  }
  ctx.restore();
}

function drawVectorscope(ctx: CanvasRenderingContext2D, plot: PlotRect, analysis: Analysis): void {
  const { vectorscope } = analysis;
  const side = Math.min(plot.width, plot.height);
  const cx = plot.x + plot.width / 2;
  const cy = plot.y + plot.height / 2;
  const radius = side / 2 - 4;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (const scale of [0.25, 0.5, 0.75, 1]) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.stroke();

  // Skin-tone line: the conventional vector is 123° from +Cr toward +Cb.
  ctx.strokeStyle = 'rgba(255, 90, 44, 0.4)';
  ctx.setLineDash([3, 3]);
  const angle = (-123 * Math.PI) / 180;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  ctx.stroke();
  ctx.setLineDash([]);

  const { bins, size } = vectorscope;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const count = bins[y * size + x];
      if (count === 0) continue;
      const nx = (x / (size - 1) - 0.5) * 2;
      const ny = (y / (size - 1) - 0.5) * 2;
      const alpha = clamp((count / vectorscope.max) ** 0.42 * 0.9, 0.04, 0.92);
      ctx.fillStyle = `rgba(94, 234, 212, ${alpha})`;
      ctx.fillRect(cx + nx * radius - 1, cy + ny * radius - 1, 2, 2);
    }
  }

  ctx.fillStyle = '#576077';
  ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Cr', cx + radius - 10, cy - 8);
  ctx.textAlign = 'left';
  ctx.fillText('Cb', cx + 7, cy - radius + 10);
  ctx.restore();
}
