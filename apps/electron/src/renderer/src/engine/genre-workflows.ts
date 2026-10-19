// ── Genre Workflows ──────────────────────────────────────────────────────────
// Maps what we know about the installed CapCut smart_cut bundle onto the six
// genre pipelines. The OFX bundle exposes a scene-detection + auto-reframe +
// speed-tracking model (param_scenes, param_crop_coordinate, param_scale,
// param_output_ratio, param_ratio, param_need_crop, param_track_speed, ...),
// so each genre is expressed as concrete values for those same knobs rather
// than vague prose. That is what makes a genre selectable and actionable.

import type { GenreId, KeyframeEasing, SafeZoneRatio } from './types';

export interface SmartCutProfile {
  /** param_scenes: how aggressively to cut on scene boundaries. */
  scenes: 'off' | 'loose' | 'balanced' | 'aggressive';
  /** param_need_crop / param_crop_coordinate target framing. */
  reframe: 'none' | 'subject-lock' | 'center-crop' | 'smooth-follow';
  /** param_output_ratio / param_ratio - delivery aspect. */
  outputRatio: SafeZoneRatio;
  /** video_reframe_smoothness_level (0-1). */
  smoothness: number;
  /** param_track_speed / shift_speed: allowed retime range, 1.0 = untouched. */
  speedRange: [number, number];
  /** faster_speed_resize / slower_speed_resize: keep audio pitch intact. */
  preservePitch: boolean;
}

export interface KeyframePreset {
  id: string;
  label: string;
  property: string;
  easing: KeyframeEasing;
  /** Seconds the move should occupy; the timeline lays frames out from this. */
  duration: number;
  detail: string;
}

export interface GenreTemplate {
  id: string;
  name: string;
  /** Structure in beats, surfaced as a starting timeline. */
  beats: string[];
  /** Caption/title treatment pulled from the engine typography presets. */
  captionStyle: string;
  /** Brand-LUT id applied by default. */
  lut: string;
  /** Optional filter graph hint for the DAG. */
  graphHint: string;
}

export interface GenreWorkflow {
  id: GenreId;
  /** What this genre optimises for, in one line. */
  objective: string;
  smartCut: SmartCutProfile;
  keyframes: KeyframePreset[];
  templates: GenreTemplate[];
  /** Ordered production pipeline steps shown in the panel. */
  pipeline: string[];
}

export const GENRE_WORKFLOWS: Record<GenreId, GenreWorkflow> = {
  '3d-animation': {
    id: '3d-animation',
    objective: 'Hold a locked frame while passes composite, then cut hard on impact.',
    smartCut: {
      scenes: 'loose',
      reframe: 'none',
      outputRatio: '16:9',
      smoothness: 0.9,
      speedRange: [0.5, 1.0],
      preservePitch: true,
    },
    keyframes: [
      {
        id: 'anim-in',
        label: 'Pass dissolve-in',
        property: 'opacity',
        easing: 'easeInOut',
        duration: 0.75,
        detail: 'Beauty over the lit pass without a visible pop.',
      },
      {
        id: 'anim-cam',
        label: 'Virtual camera push',
        property: 'scale',
        easing: 'easeInOut',
        duration: 2.5,
        detail: 'Sustained push matched to the animatic timing sheet.',
      },
      {
        id: 'anim-impact',
        label: 'Impact settle',
        property: 'scale',
        easing: 'easeOut',
        duration: 0.35,
        detail: 'Snap out of the decel so the hit reads on the frame it lands.',
      },
    ],
    templates: [
      {
        id: 'anim-3d-teaser',
        name: 'CGI Teaser',
        beats: ['Black', 'Pass reveal', 'Camera push', 'Impact cut', 'Logo hold'],
        captionStyle: 'Condensed uppercase, tight tracking',
        lut: 'cool-tech',
        graphHint: 'bloom -> tonemap -> grade',
      },
      {
        id: 'anim-3d-comp',
        name: 'Comp Breakdown',
        beats: ['Plate', 'Wireframe', 'Lighting pass', 'Beauty', 'Final'],
        captionStyle: 'Monospace slate labels',
        lut: 'vibrant',
        graphHint: 'passA + passB -> add -> grade',
      },
    ],
    pipeline: [
      'Import multi-pass renders as a stack',
      'Lock timing to the animatic',
      'Composite passes in the node graph',
      'Retime for frame-rate conversion',
      'Grade and deliver both aspect ratios',
    ],
  },

  narrative: {
    id: 'narrative',
    objective: 'Protect performances and hide the cut behind the emotion.',
    smartCut: {
      scenes: 'off',
      reframe: 'smooth-follow',
      outputRatio: '16:9',
      smoothness: 0.7,
      speedRange: [0.9, 1.0],
      preservePitch: true,
    },
    keyframes: [
      {
        id: 'nar-j',
        label: 'J-cut audio lead',
        property: 'opacity',
        easing: 'linear',
        duration: 0.6,
        detail: 'Audio of the next scene arrives before its picture.',
      },
      {
        id: 'nar-l',
        label: 'L-cut audio tail',
        property: 'opacity',
        easing: 'linear',
        duration: 0.9,
        detail: 'Previous scene audio carries over the new picture.',
      },
      {
        id: 'nar-hold',
        label: 'Performance hold',
        property: 'opacity',
        easing: 'easeInOut',
        duration: 1.2,
        detail: 'Let the take breathe before the next cut.',
      },
    ],
    templates: [
      {
        id: 'nar-scene',
        name: 'Scene Assembly',
        beats: ['Cold open', 'Establish', 'Dialogue', 'Reaction', 'Turn', 'Button'],
        captionStyle: 'Subtle lower-third, sentence case',
        lut: 'cinematic',
        graphHint: 'grade -> grain -> vignette',
      },
      {
        id: 'nar-trailer',
        name: 'Trailer Beat Sheet',
        beats: ['Setup', 'Escalation', 'False calm', 'Hard cut', 'Title'],
        captionStyle: 'Wide uppercase card titles',
        lut: 'cinematic',
        graphHint: 'grade -> bloom -> flash',
      },
    ],
    pipeline: [
      'Search the transcript for the strongest takes',
      'Assemble an invisible-cut scene',
      'Build J/L audio overlaps',
      'Track emotional continuity across the reel',
      'Grade for a consistent look',
    ],
  },

  corporate: {
    id: 'corporate',
    objective: 'Hook hard in the first two seconds, stay on brand, convert.',
    smartCut: {
      scenes: 'aggressive',
      reframe: 'subject-lock',
      outputRatio: '16:9',
      smoothness: 0.45,
      speedRange: [0.7, 1.6],
      preservePitch: true,
    },
    keyframes: [
      {
        id: 'corp-hook',
        label: 'Hook punch-in',
        property: 'scale',
        easing: 'easeOut',
        duration: 0.3,
        detail: 'Scale snap that stops the scroll on the first beat.',
      },
      {
        id: 'corp-interrupt',
        label: 'Pattern interrupt',
        property: 'opacity',
        easing: 'linear',
        duration: 0.18,
        detail: 'A flash frame where retention typically drops.',
      },
      {
        id: 'corp-cta',
        label: 'CTA emphasis',
        property: 'scale',
        easing: 'easeInOut',
        duration: 0.5,
        detail: 'Settle the logo and call to action into place.',
      },
    ],
    templates: [
      {
        id: 'corp-brand',
        name: 'Brand Anthem',
        beats: ['Hook', 'Problem', 'Product', 'Proof', 'CTA'],
        captionStyle: 'Bold uppercase, brand accent underline',
        lut: 'cool-tech',
        graphHint: 'grade -> bloom -> sharpen',
      },
      {
        id: 'corp-social',
        name: 'Social Cutdown (9:16)',
        beats: ['Hook', 'Value', 'Proof', 'CTA'],
        captionStyle: 'Large burned-in captions, safe-zone aware',
        lut: 'warm-brand',
        graphHint: 'reframe -> captions -> grade',
      },
    ],
    pipeline: [
      'Auto-cut on scene change for the punchy pace',
      'Reframe to subject for vertical delivery',
      'Apply the brand LUT and logo safe zones',
      'Burn captions and check every platform safe zone',
      'Export 1080p for review, 4K for the master',
    ],
  },

  explainer: {
    id: 'explainer',
    objective: 'Match the edit to the voiceover and make the idea legible.',
    smartCut: {
      scenes: 'balanced',
      reframe: 'center-crop',
      outputRatio: '16:9',
      smoothness: 0.6,
      speedRange: [0.85, 1.3],
      preservePitch: true,
    },
    keyframes: [
      {
        id: 'exp-type',
        label: 'Kinetic type in',
        property: 'opacity',
        easing: 'easeOut',
        duration: 0.4,
        detail: 'Word-level timing locked to the VO waveform.',
      },
      {
        id: 'exp-morph',
        label: 'Metaphor morph',
        property: 'scale',
        easing: 'easeInOut',
        duration: 0.8,
        detail: 'Scale a graphic between two metaphors without a visible seam.',
      },
      {
        id: 'exp-step',
        label: 'Step reveal',
        property: 'opacity',
        easing: 'easeInOut',
        duration: 0.5,
        detail: 'Build an ordered list at a readable rhythm.',
      },
    ],
    templates: [
      {
        id: 'exp-howto',
        name: 'How It Works',
        beats: ['Question', 'Metaphor', 'Step 1', 'Step 2', 'Step 3', 'Recap'],
        captionStyle: 'Sentence case, generous leading, high contrast',
        lut: 'none',
        graphHint: 'grade -> grain',
      },
      {
        id: 'exp-infographic',
        name: 'Data Story',
        beats: ['Headline stat', 'Context', 'Chart build', 'Takeaway'],
        captionStyle: 'Tabular numerals, aligned to grid',
        lut: 'cool-tech',
        graphHint: 'chart -> grade -> sharpen',
      },
    ],
    pipeline: [
      'Align beats to the voiceover track',
      'Lay in kinetic typography from the presets',
      'Pick and animate the visual metaphor',
      'Balance the information hierarchy',
      'Export with burned captions for accessibility',
    ],
  },

  documentary: {
    id: 'documentary',
    objective: 'Find the story in the footage, then let the archive carry it.',
    smartCut: {
      scenes: 'loose',
      reframe: 'subject-lock',
      outputRatio: '16:9',
      smoothness: 0.55,
      speedRange: [0.6, 1.0],
      preservePitch: false,
    },
    keyframes: [
      {
        id: 'doc-broll',
        label: 'B-roll dissolve',
        property: 'opacity',
        easing: 'easeInOut',
        duration: 1.1,
        detail: 'Slow cross-dissolve under interview audio.',
      },
      {
        id: 'doc-archive',
        label: 'Archive reveal',
        property: 'scale',
        easing: 'easeInOut',
        duration: 3.0,
        detail: 'Slow push through archival stills.',
      },
      {
        id: 'doc-kuleshov',
        label: 'Juxtaposition beat',
        property: 'opacity',
        easing: 'linear',
        duration: 0.5,
        detail: 'Cut two shots together to create a third meaning.',
      },
    ],
    templates: [
      {
        id: 'doc-script',
        name: 'Script From Footage',
        beats: ['Archive', 'Interview', 'B-roll', 'Interview', 'Resolution'],
        captionStyle: 'Speaker lower-thirds with source metadata',
        lut: 'cinematic',
        graphHint: 'grade -> grain -> vignette',
      },
      {
        id: 'doc-essay',
        name: 'Video Essay',
        beats: ['Thesis', 'Evidence', 'Counterpoint', 'Synthesis'],
        captionStyle: 'Editorial serif, wide measure',
        lut: 'vibrant',
        graphHint: 'grade -> blur(backdrop)',
      },
    ],
    pipeline: [
      'Tag every clip with metadata as it lands',
      'Search the transcript to script from the footage',
      'Layer B-roll under the interview spine',
      'Build meaning through juxtaposition',
      'Grade archive and modern footage into one look',
    ],
  },

  detective: {
    id: 'detective',
    objective: 'Withhold the answer, control the tempo, land the reveal.',
    smartCut: {
      scenes: 'off',
      reframe: 'smooth-follow',
      outputRatio: '16:9',
      smoothness: 0.8,
      speedRange: [0.7, 1.1],
      preservePitch: false,
    },
    keyframes: [
      {
        id: 'det-linger',
        label: 'Clue linger',
        property: 'opacity',
        easing: 'easeInOut',
        duration: 1.4,
        detail: 'Hold a beat longer than comfortable on the tell.',
      },
      {
        id: 'det-redherring',
        label: 'Red herring push',
        property: 'scale',
        easing: 'easeIn',
        duration: 0.7,
        detail: 'Creep the framing toward a false answer.',
      },
      {
        id: 'det-reveal',
        label: 'Reveal snap',
        property: 'opacity',
        easing: 'easeOut',
        duration: 0.22,
        detail: 'Hard cut on the answer - no smoothing, no warning.',
      },
    ],
    templates: [
      {
        id: 'det-mystery',
        name: 'Mystery Cold Open',
        beats: ['Incipient', 'Clue', 'Mischief', 'False trail', 'Reveal', 'Title'],
        captionStyle: 'Typewriter monospace, timed to the beat',
        lut: 'cinematic',
        graphHint: 'grade -> vignette -> contrast',
      },
      {
        id: 'det-interrogation',
        name: 'Interrogation Cut',
        beats: ['Question', 'Silence', 'Pressure', 'Crack'],
        captionStyle: 'Subtitle-only, no adornment',
        lut: 'none',
        graphHint: 'grade -> grain',
      },
    ],
    pipeline: [
      'Trim for precisely withheld information',
      'Cache and compare suspect frames',
      'Build tension with controlled pacing',
      'Place and time the red herrings',
      'Grade for cold, high-contrast mystery',
    ],
  },
};

/** Flatten every genre template for the templates browser. */
export function allTemplates(): Array<GenreTemplate & { genre: GenreId; genreName: string }> {
  return Object.values(GENRE_WORKFLOWS).flatMap((w) => {
    const genre = w.id;
    return w.templates.map((t) => ({ ...t, genre, genreName: genreLabel(genre) }));
  });
}

const LABELS: Record<GenreId, string> = {
  '3d-animation': '3D Animation & CGI',
  narrative: 'Narrative Fiction',
  corporate: 'Corporate & Commercial',
  explainer: 'Explainer & Infographic',
  documentary: 'Documentary',
  detective: 'Detective & Mystery',
};

export function genreLabel(id: GenreId): string {
  return LABELS[id];
}

/** Human-readable summary of a smart_cut profile for the UI. */
export function smartCutSummary(p: SmartCutProfile): string[] {
  return [
    `scenes: ${p.scenes}`,
    `reframe: ${p.reframe}`,
    `ratio: ${p.outputRatio}`,
    `smoothness: ${p.smoothness.toFixed(2)}`,
    `speed: ${p.speedRange[0].toFixed(2)}–${p.speedRange[1].toFixed(2)}×`,
    p.preservePitch ? 'pitch: preserved' : 'pitch: natural',
  ];
}
