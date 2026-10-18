import { BRAND_LUTS } from '../engine/types';

interface BrandLUTPanelProps {
  active: string;
  onChange: (id: string) => void;
}

export function BrandLUTPanel({ active, onChange }: BrandLUTPanelProps) {
  return (
    <div className="p-3 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Brand LUT</div>
      <div className="space-y-1">
        {BRAND_LUTS.map((lut) => (
          <button
            key={lut.id}
            type="button"
            onClick={() => onChange(lut.id)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all border ${
              active === lut.id
                ? 'border-accent/50 bg-accent/10'
                : 'border-line hover:border-white/20'
            }`}
          >
            <div className="flex gap-0.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: lut.colors.shadow }} />
              <div className="w-3 h-3 rounded-sm" style={{ background: lut.colors.midtone }} />
              <div className="w-3 h-3 rounded-sm" style={{ background: lut.colors.highlight }} />
            </div>
            <span className="text-[11px] font-medium">{lut.name}</span>
          </button>
        ))}
      </div>
      <div className="p-2 rounded bg-ink border border-line text-[10px] text-muted">
        LUTs apply real-time color correction via WGSL fragment shaders on the WebGPU pipeline.
      </div>
    </div>
  );
}
