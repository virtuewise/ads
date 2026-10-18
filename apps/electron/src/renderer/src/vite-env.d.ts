/// <reference types="vite/client" />
/// <reference types="node" />
interface Window {
  studio?: {
    getModes: () => Promise<Array<{ id: string; name: string; territory: string }>>;
    getConcepts: () => Promise<Array<{ title: string; score?: number }>>;
  };
}
