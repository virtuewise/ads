import { useEffect, useState } from 'react';

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
  title: string;
  score?: number;
  territory?: string;
  mood?: string;
}

export interface Metaphor {
  name: string;
  description: string;
  territory: string;
}

export interface EngineStats {
  modeCount: number;
  territoryCount: number;
  metaphorCount: number;
  modesRequiring3d: number;
  modesRequiringVfx: number;
}

export interface EngineData {
  modes: CreativeMode[];
  concepts: Concept[];
  metaphors: Metaphor[];
  stats: EngineStats | null;
  loading: boolean;
  error: string | null;
}

interface StudioApi {
  getModes: () => Promise<CreativeMode[]>;
  getConcepts: () => Promise<Concept[]>;
  getMetaphors: (territory?: string) => Promise<Metaphor[]>;
  getStats: () => Promise<EngineStats>;
}

export function useEngineData(): EngineData {
  const [modes, setModes] = useState<CreativeMode[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [metaphors, setMetaphors] = useState<Metaphor[]>([]);
  const [stats, setStats] = useState<EngineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = (window as unknown as { studio?: StudioApi }).studio;
        const [m, c, mm, s] = await Promise.all([
          api?.getModes?.() ?? Promise.resolve([]),
          api?.getConcepts?.() ?? Promise.resolve([]),
          api?.getMetaphors?.() ?? Promise.resolve([]),
          api?.getStats?.() ?? Promise.resolve(null),
        ]);
        if (!cancelled) {
          setModes(m);
          setConcepts(c);
          setMetaphors(mm);
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

  return { modes, concepts, metaphors, stats, loading, error };
}
