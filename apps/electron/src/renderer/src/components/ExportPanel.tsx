import { useEffect, useRef, useState } from 'react';
import {
  EXPORT_TARGETS,
  type ExportProgressEvent,
  type ExportTarget,
  estimateBytes,
  formatBytes,
  runExport,
} from '../engine/export';
import type { BrandLUT, CompositionState } from '../engine/types';
import { Icon } from './Icon';

interface ExportPanelProps {
  composition: CompositionState;
  lut?: BrandLUT | null;
}

interface EncoderInfo {
  ffmpegPath: string | null;
  version: string | null;
  preferred: { h264: string | null; prores: string | null };
}

export function ExportPanel({ composition, lut }: ExportPanelProps) {
  const [target, setTarget] = useState<ExportTarget>(EXPORT_TARGETS[0]);
  const [info, setInfo] = useState<EncoderInfo | null>(null);
  const [progress, setProgress] = useState<ExportProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    const api = (window as unknown as { studio?: { probeEncoders: () => Promise<EncoderInfo> } })
      .studio;
    api
      ?.probeEncoders?.()
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  const seconds = composition.duration;
  const totalFrames = Math.max(1, Math.round(target.fps * seconds));
  const estimate = estimateBytes(target, seconds);
  const encoder =
    target.id === 'prores-4k'
      ? (info?.preferred.prores ?? 'prores_ks')
      : (info?.preferred.h264 ?? 'libx264');

  const handleExport = async () => {
    setError(null);
    setBusy(true);
    cancelRef.current = false;
    try {
      const api = (
        window as unknown as {
          studio?: {
            chooseExportPath: (o: {
              preset: string;
              suggestedName?: string;
            }) => Promise<{ canceled: boolean; path?: string }>;
          };
        }
      ).studio;
      const chosen = await api?.chooseExportPath?.({
        preset: target.id,
        suggestedName: composition.name,
      });
      if (!chosen || chosen.canceled || !chosen.path) {
        setBusy(false);
        return;
      }
      const result = await runExport({
        target,
        outputPath: chosen.path,
        duration: seconds,
        lut: lut ?? null,
        transform: composition.transform,
        onProgress: setProgress,
        shouldCancel: () => cancelRef.current,
      });
      if (!result.ok && result.stage === 'error') setError(result.message ?? 'Export failed');
    } catch (e) {
      setError(String(e));
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  const handleCancel = async () => {
    cancelRef.current = true;
    const api = (window as unknown as { studio?: { cancelExport: () => Promise<unknown> } }).studio;
    await api?.cancelExport?.();
  };

  const percent = progress?.percent ?? 0;

  return (
    <div className="sect">
      <div className="sect__head">
        <span className="sect__title">Export</span>
        <span className="sect__meta">
          {composition.width}×{composition.height}
        </span>
      </div>

      <div className="cardgrid">
        {EXPORT_TARGETS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`card ${target.id === t.id ? 'card--active' : ''}`}
            onClick={() => setTarget(t)}
            disabled={busy}
          >
            <span className="card__icon">
              <Icon name={t.heavy ? 'box' : 'zap'} size={14} />
            </span>
            <span className="card__title">{t.name}</span>
            <span className="card__desc">{t.note}</span>
          </button>
        ))}
      </div>

      <div className="field">
        <span className="field__label">Resolution</span>
        <span className="field__input">
          {target.width} × {target.height}
        </span>
      </div>
      <div className="field">
        <span className="field__label">Frame Rate</span>
        <span className="field__input">{target.fps} fps</span>
      </div>
      <div className="field">
        <span className="field__label">Frames</span>
        <span className="field__input">
          {totalFrames} · {seconds.toFixed(2)}s
        </span>
      </div>
      <div className="field">
        <span className="field__label">Est. Size</span>
        <span className="field__input">{formatBytes(estimate)}</span>
      </div>
      <div className="field">
        <span className="field__label">Encoder</span>
        <span className="field__input">{encoder}</span>
      </div>

      {info && !info.ffmpegPath && (
        <div className="err" role="alert">
          ffmpeg not found. Install it or set FFMPEG_PATH.
        </div>
      )}
      {info?.version && <p className="muted">ffmpeg {info.version}</p>}

      {busy ? (
        <>
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </div>
          <p className="muted">
            {progress?.stage ?? 'working'} · {progress?.framesWritten ?? 0}/{totalFrames} frames
            {progress?.message ? ` · ${progress.message}` : ''}
          </p>
          <button type="button" className="btn btn--block" onClick={handleCancel}>
            <Icon name="close" size={12} />
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={handleExport}
          disabled={!info?.ffmpegPath}
        >
          <Icon name="download" size={12} />
          Export {target.container.toUpperCase()}
        </button>
      )}

      {progress?.stage === 'done' && progress.outputPath && (
        <p className="muted">Wrote {progress.outputPath}</p>
      )}
      {error && (
        <div className="err" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
