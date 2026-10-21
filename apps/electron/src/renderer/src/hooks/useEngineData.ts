import { useEffect, useState } from 'react';
import type { OpenResult, SaveResult } from '../engine/project';
import type { ProjectFormat } from '../engine/types';

export interface CreativeMode {
  id: string;
  name: string;
  description: string;
  territory: string;
  territories: string[];
  mood: string;
  voice: string;
  pace: string;
  duration: number;
  formats: string[];
  requires3d: boolean;
  requiresVfx: boolean;
}

export interface Concept {
  id?: string;
  title: string;
  logline?: string;
  score?:
    | {
        brand_fit: number;
        originality: number;
        commercial_value: number;
        visual_potential: number;
        emotional_impact: number;
        memorability: number;
        social_stop_power: number;
        production_quality: number;
      }
    | number;
  territory?: string;
  mood?: string;
  creative_mode?: string;
  key_visual?: string;
  cta?: string;
  story_summary?: string;
}

export interface Metaphor {
  name: string;
  description: string;
  territory: string;
  territories?: string[];
}

export interface TypographyPreset {
  id: string;
  name: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  color: string;
  animation: string;
  animationDuration: number;
  stagger: number;
}

export interface VFXEffect {
  id: string;
  name: string;
  category: string;
  parameters: Record<string, unknown>;
  compatiblePurposes: string[];
}

export interface VisualGrammar {
  name: string;
  description: string;
  sequence: string[];
}

export interface EngineStats {
  modeCount: number;
  territoryCount: number;
  metaphorCount: number;
  modesRequiring3d: number;
  modesRequiringVfx: number;
}

export interface Brief {
  objective: string;
  service: string;
  audience: string;
  emotional_objective: string;
  platform: string[];
  formats: string[];
}

export interface EngineData {
  modes: CreativeMode[];
  metaphors: Metaphor[];
  typography: TypographyPreset[];
  effects: VFXEffect[];
  grammars: VisualGrammar[];
  stats: EngineStats | null;
  loading: boolean;
  error: string | null;
}

interface StudioApi {
  getModes: () => Promise<CreativeMode[]>;
  getConcepts: () => Promise<Concept[]>;
  generateConcepts: (brief: Brief) => Promise<Concept[]>;
  getMetaphors: (territory?: string) => Promise<Metaphor[]>;
  getMetaphorsForService: (service: string) => Promise<Metaphor[]>;
  getStats: () => Promise<EngineStats>;
  getTypographyPresets: () => Promise<TypographyPreset[]>;
  getVFXEffects: () => Promise<VFXEffect[]>;
  getVisualGrammars: () => Promise<VisualGrammar[]>;
  /** Turn a brief into a full production plan. */
  buildPlan: (brief: unknown) => Promise<unknown>;
  saveProject: (
    doc: unknown,
    opts?: { path?: string; format?: ProjectFormat },
  ) => Promise<SaveResult>;
  openProject: () => Promise<OpenResult>;
  writeProject: (filePath: string, doc: unknown, format: ProjectFormat) => Promise<SaveResult>;
  readProject: (filePath: string) => Promise<OpenResult>;
  pickMedia: () => Promise<MediaPickResult>;
  readMedia: (
    filePath: string,
  ) => Promise<{ ok: boolean; name?: string; data?: ArrayBuffer; error?: string }>;
  /** The project the app was launched with, if any. */
  initialProjectPath: () => string | null;
}

/** Shape returned by the main process after a media file dialog. */
export interface MediaPickResult {
  canceled: boolean;
  items: Array<{ path: string; name: string; data: ArrayBuffer }>;
}

/** Typed access to the preload bridge; undefined outside Electron. */
export function studioApi(): StudioApi | undefined {
  return (window as unknown as { studio?: StudioApi }).studio;
}

export function useEngineData(): EngineData {
  const [modes, setModes] = useState<CreativeMode[]>([]);
  const [metaphors, setMetaphors] = useState<Metaphor[]>([]);
  const [typography, setTypography] = useState<TypographyPreset[]>([]);
  const [effects, setEffects] = useState<VFXEffect[]>([]);
  const [grammars, setGrammars] = useState<VisualGrammar[]>([]);
  const [stats, setStats] = useState<EngineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = (window as unknown as { studio?: StudioApi }).studio;
        const [m, mm, tp, fx, gr, s] = await Promise.all([
          api?.getModes?.() ?? Promise.resolve([]),
          api?.getMetaphors?.() ?? Promise.resolve([]),
          api?.getTypographyPresets?.() ?? Promise.resolve([]),
          api?.getVFXEffects?.() ?? Promise.resolve([]),
          api?.getVisualGrammars?.() ?? Promise.resolve([]),
          api?.getStats?.() ?? Promise.resolve(null),
        ]);
        if (!cancelled) {
          setModes(m);
          setMetaphors(mm);
          setTypography(tp);
          setEffects(fx);
          setGrammars(gr);
          setStats(s);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { modes, metaphors, typography, effects, grammars, stats, loading, error };
}
