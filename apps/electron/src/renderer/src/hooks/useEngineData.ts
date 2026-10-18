import { useEffect, useState } from 'react';

interface CreativeMode {
  id: string;
  name: string;
  territory: string;
}

interface Concept {
  title: string;
  score?: number;
}

interface EngineData {
  modes: CreativeMode[];
  concepts: Concept[];
  loading: boolean;
  error: string | null;
}

export function useEngineData(): EngineData {
  const [modes, setModes] = useState<CreativeMode[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = (
          window as unknown as {
            studio?: {
              getModes: () => Promise<CreativeMode[]>;
              getConcepts: () => Promise<Concept[]>;
            };
          }
        ).studio;
        const [m, c] = await Promise.all([
          api?.getModes?.() ?? Promise.resolve([]),
          api?.getConcepts?.() ?? Promise.resolve([]),
        ]);
        if (!cancelled) {
          setModes(m);
          setConcepts(c);
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

  return { modes, concepts, loading, error };
}
