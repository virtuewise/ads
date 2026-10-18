import { SAFE_ZONES, type SafeZoneRatio } from '../engine/types';

interface SafeZonesProps {
  active: boolean;
  ratio: SafeZoneRatio;
  onToggle: () => void;
  onRatioChange: (r: SafeZoneRatio) => void;
}

export function SafeZones({ active, ratio }: SafeZonesProps) {
  const zones = SAFE_ZONES.filter((z) => z.ratio === ratio);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {active && (
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <title>Safe zones</title>
          {zones.map((z) => {
            const x = z.margins.left;
            const y = z.margins.top;
            const w = 100 - z.margins.left - z.margins.right;
            const h = 100 - z.margins.top - z.margins.bottom;
            return (
              <g key={z.label}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="none"
                  stroke="#5eead4"
                  strokeWidth="0.3"
                  strokeDasharray="1 1"
                  opacity="0.6"
                />
                <text
                  x={x + 0.5}
                  y={y + 2}
                  fontSize="1.5"
                  fill="#5eead4"
                  opacity="0.8"
                  fontFamily="monospace"
                >
                  {z.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export function SafeZoneControls({ active, ratio, onToggle, onRatioChange }: SafeZonesProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${active ? 'bg-cool/20 text-cool border border-cool/30' : 'bg-ink border border-line text-muted hover:text-text'}`}
      >
        Safe Zones
      </button>
      <select
        value={ratio}
        onChange={(e) => onRatioChange(e.target.value as SafeZoneRatio)}
        className="px-1.5 py-1 rounded bg-ink border border-line text-[10px] text-muted"
      >
        <option value="16:9">16:9</option>
        <option value="9:16">9:16</option>
        <option value="1:1">1:1</option>
        <option value="4:5">4:5</option>
      </select>
    </div>
  );
}
