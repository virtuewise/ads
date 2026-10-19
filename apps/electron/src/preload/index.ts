import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('studio', {
  getModes: () => ipcRenderer.invoke('engine:getModes'),
  getConcepts: () => ipcRenderer.invoke('engine:getConcepts'),
  generateConcepts: (brief: unknown) => ipcRenderer.invoke('engine:generateConcepts', brief),
  getMetaphors: (territory?: string) => ipcRenderer.invoke('engine:getMetaphors', territory),
  getMetaphorsForService: (service: string) =>
    ipcRenderer.invoke('engine:getMetaphorsForService', service),
  getStats: () => ipcRenderer.invoke('engine:getStats'),
  getTypographyPresets: () => ipcRenderer.invoke('engine:getTypographyPresets'),
  getVFXEffects: () => ipcRenderer.invoke('engine:getVFXEffects'),
  getVisualGrammars: () => ipcRenderer.invoke('engine:getVisualGrammars'),

  // ── Project documents ──────────────────────────────────────────────────────
  saveProject: (doc: unknown, opts?: { path?: string; format?: 'json' | 'binary' }) =>
    ipcRenderer.invoke('project:save', doc, opts),
  openProject: () => ipcRenderer.invoke('project:open'),
  writeProject: (filePath: string, doc: unknown, format: 'json' | 'binary') =>
    ipcRenderer.invoke('project:write', filePath, doc, format),
  readProject: (filePath: string) => ipcRenderer.invoke('project:read', filePath),
});
