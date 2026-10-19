import {
  GENRE_WORKFLOWS,
  type GenreTemplate,
  genreLabel,
  type KeyframePreset,
  smartCutSummary,
} from '../engine/genre-workflows';
import { GENRES, type GenreId, type SafeZoneRatio } from '../engine/types';
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

interface GenrePanelProps {
  active: GenreId;
  /** Apply a keyframe preset so it is real, not just described. */
  onApplyKeyframe?: (preset: KeyframePreset) => void;
  /** Adopt a template: ratio + LUT + starting timeline. */
  onApplyTemplate?: (template: GenreTemplate, genre: GenreId) => void;
  /** Adopt the smart_cut profile's delivery ratio. */
  onApplySmartCut?: (ratio: SafeZoneRatio) => void;
}

export function GenrePanel({
  active,
  onApplyKeyframe,
  onApplyTemplate,
  onApplySmartCut,
}: GenrePanelProps) {
  const genre = GENRES.find((g) => g.id === active);
  const workflow = GENRE_WORKFLOWS[active];
  if (!genre || !workflow) return null;

  return (
    <>
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
        <p className="muted" style={{ marginTop: 8 }}>
          {workflow.objective}
        </p>
        <div className="chip-row" style={{ marginTop: 8 }}>
          {genre.keyFeatures.map((f) => (
            <span key={f} className="chip">
              {f}
            </span>
          ))}
        </div>
      </div>

      <div className="sect">
        <div className="sect__head">
          <span className="sect__title">Smart Cut Profile</span>
          <button
            type="button"
            className="iconbtn"
            title="Apply delivery ratio"
            aria-label="Apply smart cut delivery ratio"
            onClick={() => onApplySmartCut?.(workflow.smartCut.outputRatio)}
          >
            <Icon name="check" size={12} />
          </button>
        </div>
        <div className="chip-row">
          {smartCutSummary(workflow.smartCut).map((s) => (
            <span key={s} className="chip">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="sect">
        <div className="sect__head">
          <span className="sect__title">Keyframe Presets</span>
          <span className="sect__meta">{workflow.keyframes.length}</span>
        </div>
        {workflow.keyframes.map((k) => (
          <div key={k.id} className="row" style={{ cursor: 'default' }}>
            <span className="row__icon">
              <Icon name="keyframe" size={12} />
            </span>
            <span className="row__body">
              <span className="row__title">{k.label}</span>
              <span className="row__sub">
                {k.property} · {k.easing} · {k.duration}s
              </span>
            </span>
            <button
              type="button"
              className="iconbtn"
              title={`Add "${k.label}" keyframe to the selected clip`}
              aria-label={`Apply ${k.label} keyframe preset`}
              onClick={() => onApplyKeyframe?.(k)}
            >
              <Icon name="plus" size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="sect">
        <div className="sect__head">
          <span className="sect__title">Templates</span>
          <span className="sect__meta">{genreLabel(active)}</span>
        </div>
        <div className="cardgrid">
          {workflow.templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className="card"
              onClick={() => onApplyTemplate?.(t, active)}
            >
              <span className="card__icon">
                <Icon name="layers" size={14} />
              </span>
              <span className="card__title">{t.name}</span>
              <span className="card__desc">{t.beats.join(' → ')}</span>
              <span className="card__desc muted">{t.captionStyle}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sect">
        <div className="sect__head">
          <span className="sect__title">Pipeline</span>
        </div>
        {workflow.pipeline.map((step, i) => (
          <div key={step} className="row" style={{ cursor: 'default' }}>
            <span className="row__icon">
              <Icon name="check" size={11} />
            </span>
            <span className="row__body">
              <span className="row__sub">
                {i + 1}. {step}
              </span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
