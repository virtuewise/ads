import { motion } from 'motion/react';
import { useState } from 'react';
import {
  EXPORT_PRESETS,
  type ExportFormat,
  type ExportResolution,
  type ExportSettings,
} from '../engine/types';

interface ExportPanelProps {
  onExport?: (settings: ExportSettings) => void;
}

export function ExportPanel({ onExport }: ExportPanelProps) {
  const [preset, setPreset] = useState('web-1080p');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [settings, setSettings] = useState<ExportSettings>(EXPORT_PRESETS['web-1080p']);

  const handlePresetChange = (key: string) => {
    setPreset(key);
    setSettings(EXPORT_PRESETS[key]);
  };

  const handleExport = () => {
    setExporting(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setExporting(false);
          onExport?.(settings);
          return 100;
        }
        return p + 2;
      });
    }, 50);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Export Pipeline</h3>
        <span className="text-[10px] text-muted font-mono">WebGPU → FFmpeg → SSD</span>
      </div>

      {/* Presets */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Presets</div>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(EXPORT_PRESETS).map(([key, p]) => (
            <button
              key={key}
              type="button"
              onClick={() => handlePresetChange(key)}
              className={`px-2 py-1.5 rounded text-left text-[10px] font-medium transition-all border ${
                preset === key
                  ? 'border-accent/50 bg-accent/10 text-text'
                  : 'border-line text-muted hover:text-text hover:border-white/20'
              }`}
            >
              <div>{key}</div>
              <div className="text-[9px] text-muted font-mono">
                {p.resolution} · {p.fps}fps · {p.codec}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-muted">Settings</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="fmt" className="text-[10px] text-muted">
              Format
            </label>
            <select
              value={settings.format}
              onChange={(e) => setSettings({ ...settings, format: e.target.value as ExportFormat })}
              className="w-full mt-0.5 px-2 py-1 rounded bg-ink border border-line text-xs"
            >
              <option value="mp4">MP4</option>
              <option value="mov">MOV</option>
              <option value="webm">WebM</option>
              <option value="prores">ProRes</option>
            </select>
          </div>
          <div>
            <label htmlFor="res" className="text-[10px] text-muted">
              Resolution
            </label>
            <select
              value={settings.resolution}
              onChange={(e) =>
                setSettings({ ...settings, resolution: e.target.value as ExportResolution })
              }
              className="w-full mt-0.5 px-2 py-1 rounded bg-ink border border-line text-xs"
            >
              <option value="1080p">1080p</option>
              <option value="4k">4K</option>
              <option value="8k">8K</option>
            </select>
          </div>
          <div>
            <label htmlFor="fps" className="text-[10px] text-muted">
              FPS
            </label>
            <input
              type="number"
              value={settings.fps}
              onChange={(e) => setSettings({ ...settings, fps: Number(e.target.value) })}
              className="w-full mt-0.5 px-2 py-1 rounded bg-ink border border-line text-xs"
              min={1}
              max={240}
            />
          </div>
          <div>
            <label htmlFor="br" className="text-[10px] text-muted">
              Bitrate (Mbps)
            </label>
            <input
              type="number"
              value={settings.bitrate}
              onChange={(e) => setSettings({ ...settings, bitrate: Number(e.target.value) })}
              className="w-full mt-0.5 px-2 py-1 rounded bg-ink border border-line text-xs"
              min={1}
              max={100}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="hw"
            checked={settings.useHardwareEncoder}
            onChange={(e) => setSettings({ ...settings, useHardwareEncoder: e.target.checked })}
            className="accent-accent"
          />
          <label htmlFor="hw" className="text-[10px] text-muted">
            Hardware encoder (NVENC/AMF)
          </label>
        </div>
      </div>

      {/* Progress */}
      {exporting && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-muted">Rendering frames…</span>
            <span className="font-mono text-accent">{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-ink overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent to-cool"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>
      )}

      {/* Export Button */}
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="w-full py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
      >
        {exporting ? 'Exporting…' : 'Export Video'}
      </button>

      {/* Pipeline Info */}
      <div className="p-2.5 rounded-md bg-ink border border-line text-[10px] text-muted space-y-1">
        <div className="font-semibold text-text">Pipeline Architecture</div>
        <div>WebGPU Frame Buffer → Shared Memory → FFmpeg Native Addon → NVMe SSD</div>
        <div>Worker thread renders frames · Zero-copy GPU readback · Hardware encode</div>
      </div>
    </div>
  );
}
