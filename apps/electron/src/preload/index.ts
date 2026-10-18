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
});
