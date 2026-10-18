/// <reference types="vite/client" />
/// <reference types="node" />
interface Window {
  studio?: {
    getModes: () => Promise<Array<{ id: string; name: string; description: string; territory: string; territories: string[]; mood: string; voice: string; pace: string; duration: number; formats: string[]; requires3d: boolean; requiresVfx: boolean }>>;
    getConcepts: () => Promise<Array<{ title: string; score?: number; territory?: string; mood?: string }>>;
    getMetaphors: (territory?: string) => Promise<Array<{ name: string; description: string; territory: string }>>;
    getStats: () => Promise<{ modeCount: number; territoryCount: number; metaphorCount: number; modesRequiring3d: number; modesRequiringVfx: number }>;
  };
}
