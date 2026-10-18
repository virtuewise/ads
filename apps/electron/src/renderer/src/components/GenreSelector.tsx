import { motion } from 'motion/react';
import { GENRES, type GenreId } from '../engine/types';

interface GenreSelectorProps {
  active: GenreId;
  onChange: (g: GenreId) => void;
}

export function GenreSelector({ active, onChange }: GenreSelectorProps) {
  return (
    <div className="flex gap-1.5 p-2 overflow-x-auto">
      {GENRES.map((g) => (
        <motion.button
          key={g.id}
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onChange(g.id)}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            active === g.id
              ? 'border-transparent text-white shadow-lg'
              : 'border-line text-muted hover:text-text hover:border-white/20 bg-ink'
          }`}
          style={
            active === g.id
              ? {
                  background: `linear-gradient(135deg, ${g.color}, ${g.color}88)`,
                  boxShadow: `0 4px 14px ${g.color}44`,
                }
              : undefined
          }
          title={g.description}
        >
          <span className="mr-1">{g.icon}</span>
          {g.name}
        </motion.button>
      ))}
    </div>
  );
}

export function GenrePanel({ active }: { active: GenreId }) {
  const genre = GENRES.find((g) => g.id === active);
  if (!genre) return null;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{genre.icon}</span>
        <div>
          <div className="text-sm font-semibold">{genre.name}</div>
          <div className="text-[10px] text-muted">{genre.description}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded-md bg-ink border border-line">
          <div className="text-[10px] uppercase tracking-wider text-muted">Pacing</div>
          <div className="text-xs font-medium mt-0.5">{genre.pacing}</div>
        </div>
        <div className="p-2 rounded-md bg-ink border border-line">
          <div className="text-[10px] uppercase tracking-wider text-muted">Focus</div>
          <div className="text-xs font-medium mt-0.5">{genre.primaryFocus}</div>
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Key Features</div>
        <div className="flex flex-wrap gap-1">
          {genre.keyFeatures.map((f) => (
            <span
              key={f}
              className="px-2 py-0.5 rounded-full text-[10px] font-mono border"
              style={{
                borderColor: `${genre.color}44`,
                color: genre.color,
                background: `${genre.color}11`,
              }}
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
