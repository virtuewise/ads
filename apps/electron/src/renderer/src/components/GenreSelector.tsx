import { GENRES, type GenreId } from '../engine/types';
import { Icon, type IconName } from './Icon';

interface GenreSelectorProps {
  active: GenreId;
  onChange: (g: GenreId) => void;
}

export function GenreSelector({ active, onChange }: GenreSelectorProps) {
  return (
    <div className="chip-row">
      {GENRES.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => onChange(g.id)}
          title={g.description}
          className={`chip ${active === g.id ? 'chip--accent' : ''}`}
        >
          <Icon name={g.icon as IconName} size={12} />
          {g.name}
        </button>
      ))}
    </div>
  );
}

export function GenrePanel({ active }: { active: GenreId }) {
  const genre = GENRES.find((g) => g.id === active);
  if (!genre) return null;

  return (
    <div className="sect">
      <div className="sect__head">
        <span className="sect__title">Workflow Profile</span>
        <span className="sect__meta">{genre.pacing}</span>
      </div>
      <div className="row" style={{ cursor: 'default' }}>
        <span className="row__icon" style={{ color: genre.color }}>
          <Icon name={genre.icon as IconName} size={14} />
        </span>
        <span className="row__body">
          <span className="row__title">{genre.primaryFocus}</span>
          <span className="row__sub">{genre.description}</span>
        </span>
      </div>
      <div className="chip-row" style={{ marginTop: 8 }}>
        {genre.keyFeatures.map((f) => (
          <span key={f} className="chip">
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}
