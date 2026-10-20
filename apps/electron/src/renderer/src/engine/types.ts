// ── Core DAG Types ────────────────────────────────────────────────────────────

export type PortType = 'texture' | 'number' | 'color' | 'boolean' | 'audio' | 'string';

export interface Port {
  id: string;
  name: string;
  type: PortType;
  direction: 'input' | 'output';
  default?: unknown;
}

export interface NodeInstance {
  id: string;
  type: string;
  position: { x: number; y: number };
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  code?: string; // custom WGSL/JS for script nodes
}

export interface Edge {
  id: string;
  from: { node: string; port: string };
  to: { node: string; port: string };
}

export interface DAG {
  nodes: NodeInstance[];
  edges: Edge[];
}

// ── Genre System ──────────────────────────────────────────────────────────────

export type GenreId =
  | '3d-animation'
  | 'narrative'
  | 'corporate'
  | 'explainer'
  | 'documentary'
  | 'detective';

export interface Genre {
  id: GenreId;
  name: string;
  icon: string;
  description: string;
  pacing: string;
  primaryFocus: string;
  keyFeatures: string[];
  color: string;
}

export const GENRES: Genre[] = [
  {
    id: '3d-animation',
    name: '3D Animation & CGI',
    icon: 'box',
    description: 'Animatic pre-vis, multi-pass compositing, VFX workflows',
    pacing: 'Highly calculated, rigid',
    primaryFocus: 'Timing & Pre-vis',
    keyFeatures: [
      'Multi-pass renders',
      'Animatic editing',
      'VFX compositing',
      'Frame-rate conversion',
    ],
    color: '#a78bfa',
  },
  {
    id: 'narrative',
    name: 'Narrative Fiction',
    icon: 'pen',
    description: 'Performance selection, invisible cutting, emotional continuity',
    pacing: 'Fluid, human-driven',
    primaryFocus: 'Emotion & Performance',
    keyFeatures: [
      'J/L cuts',
      'Continuity editing',
      'Performance selection',
      'Structural flexibility',
    ],
    color: '#f472b6',
  },
  {
    id: 'corporate',
    name: 'Corporate & Commercial',
    icon: 'chart',
    description: 'Retention hooks, brand compliance, maximum impact minimum time',
    pacing: 'Aggressive, fast, punchy',
    primaryFocus: 'Conversion & Brand',
    keyFeatures: ['Brand LUTs', 'Safe zones', 'Hook-driven structure', 'Pattern interrupts'],
    color: '#ff5a2c',
  },
  {
    id: 'explainer',
    name: 'Explainer & Infographic',
    icon: 'compass',
    description: 'Information architecture, kinetic typography, visual metaphors',
    pacing: 'Steady, voiceover-matched',
    primaryFocus: 'Clarity & Education',
    keyFeatures: ['Kinetic type', 'Motion graphics', 'Visual metaphors', 'Info hierarchy'],
    color: '#5eead4',
  },
  {
    id: 'documentary',
    name: 'Documentary',
    icon: 'film',
    description: 'Script-from-footage, juxtaposition mastery, B-roll layering',
    pacing: 'Natural, interview-driven',
    primaryFocus: 'Authenticity & Truth',
    keyFeatures: ['Metadata tagging', 'Transcript search', 'B-roll layering', 'Kuleshov effect'],
    color: '#ffb347',
  },
  {
    id: 'detective',
    name: 'Detective & Mystery',
    icon: 'search',
    description: 'Misdirection, tension building, clue tracking',
    pacing: 'Unpredictable, tense',
    primaryFocus: 'Suspense & Clues',
    keyFeatures: ['Precision trimming', 'Frame caching', 'Tension building', 'Red herrings'],
    color: '#ef4444',
  },
];

// ── Export Pipeline ──────────────────────────────────────────────────────────

export type ExportFormat = 'mp4' | 'mov' | 'webm' | 'prores';
export type ExportResolution = '1080p' | '4k' | '8k';

export interface ExportSettings {
  format: ExportFormat;
  resolution: ExportResolution;
  fps: number;
  codec: string;
  bitrate: number;
  colorSpace: string;
  useHardwareEncoder: boolean;
}

export const EXPORT_PRESETS: Record<string, ExportSettings> = {
  'web-1080p': {
    format: 'mp4',
    resolution: '1080p',
    fps: 30,
    codec: 'h264',
    bitrate: 8000,
    colorSpace: 'rec709',
    useHardwareEncoder: true,
  },
  'web-4k': {
    format: 'mp4',
    resolution: '4k',
    fps: 60,
    codec: 'h265',
    bitrate: 35000,
    colorSpace: 'rec709',
    useHardwareEncoder: true,
  },
  'prores-4k': {
    format: 'mov',
    resolution: '4k',
    fps: 24,
    codec: 'prores',
    bitrate: 0,
    colorSpace: 'p3-d65',
    useHardwareEncoder: false,
  },
  'social-916': {
    format: 'mp4',
    resolution: '1080p',
    fps: 30,
    codec: 'h264',
    bitrate: 6000,
    colorSpace: 'rec709',
    useHardwareEncoder: true,
  },
};

// ── Safe Zones ───────────────────────────────────────────────────────────────

export type SafeZoneRatio = '1:1' | '9:16' | '16:9' | '4:5';

export interface SafeZone {
  ratio: SafeZoneRatio;
  label: string;
  margins: { top: number; bottom: number; left: number; right: number };
}

export const SAFE_ZONES: SafeZone[] = [
  { ratio: '16:9', label: '16:9 Action Safe', margins: { top: 5, bottom: 5, left: 5, right: 5 } },
  {
    ratio: '16:9',
    label: '16:9 Title Safe',
    margins: { top: 10, bottom: 10, left: 10, right: 10 },
  },
  { ratio: '9:16', label: '9:16 Action Safe', margins: { top: 5, bottom: 5, left: 5, right: 5 } },
  { ratio: '9:16', label: '9:16 Title Safe', margins: { top: 12, bottom: 12, left: 8, right: 8 } },
  { ratio: '1:1', label: '1:1 Action Safe', margins: { top: 5, bottom: 5, left: 5, right: 5 } },
  { ratio: '4:5', label: '4:5 Title Safe', margins: { top: 10, bottom: 10, left: 10, right: 10 } },
];

// ── Brand LUT ────────────────────────────────────────────────────────────────

export interface BrandLUT {
  id: string;
  name: string;
  colors: { shadow: string; midtone: string; highlight: string };
  intensity: number;
}

export const BRAND_LUTS: BrandLUT[] = [
  {
    id: 'none',
    name: 'None',
    colors: { shadow: '#000000', midtone: '#808080', highlight: '#ffffff' },
    intensity: 0,
  },
  {
    id: 'warm-brand',
    name: 'Warm Brand',
    colors: { shadow: '#1a0a00', midtone: '#804020', highlight: '#fff0e0' },
    intensity: 0.3,
  },
  {
    id: 'cool-tech',
    name: 'Cool Tech',
    colors: { shadow: '#000a1a', midtone: '#204080', highlight: '#e0f0ff' },
    intensity: 0.3,
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    colors: { shadow: '#0a0a0a', midtone: '#404040', highlight: '#f5f5f5' },
    intensity: 0.5,
  },
  {
    id: 'vibrant',
    name: 'Vibrant',
    colors: { shadow: '#1a001a', midtone: '#802080', highlight: '#ffe0ff' },
    intensity: 0.4,
  },
];

// ── Composition & Timeline ───────────────────────────────────────────────────

export interface TransformState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export interface CompositionState {
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  background: string;
  transform: TransformState;
}

export type KeyframeEasing =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'sineIn'
  | 'sineOut'
  | 'sineInOut'
  | 'cubicIn'
  | 'cubicOut'
  | 'cubicInOut'
  | 'quartIn'
  | 'quartOut'
  | 'quartInOut'
  | 'expoIn'
  | 'expoOut'
  | 'expoInOut'
  | 'backIn'
  | 'backOut'
  | 'backInOut'
  | 'elasticIn'
  | 'elasticOut'
  | 'elasticInOut'
  | 'bounceIn'
  | 'bounceOut'
  | 'bounceInOut';

export interface Keyframe {
  id: string;
  time: number;
  property: string;
  value: number;
  easing: KeyframeEasing;
}

export interface TimelineClip {
  id: string;
  trackId: string;
  start: number;
  end: number;
  name: string;
  keyframes: Keyframe[];
}

export interface TimelineDoc {
  duration: number;
  clips: TimelineClip[];
}

export interface SafeZoneState {
  active: boolean;
  ratio: SafeZoneRatio;
}

// ── Project Document (.vfxproj) ──────────────────────────────────────────────

export type ProjectFormat = 'json' | 'binary';

export interface ProjectDocument {
  format: 'vfxproj';
  version: number;
  savedAt: string;
  app: { name: string; version: string };
  composition: CompositionState;
  genre: GenreId;
  safeZones: SafeZoneState;
  brandLUT: string;
  timeline: TimelineDoc;
  graph: DAG;
  effectsStack: string[];
}
