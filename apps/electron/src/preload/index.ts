import { contextBridge, ipcRenderer } from 'electron';

// Engine-driven API surface: everything the UI needs comes from the engines.
contextBridge.exposeInMainWorld('studio', {
  getModes: () => ipcRenderer.invoke('engine:getModes'),
  getConcepts: () => ipcRenderer.invoke('engine:getConcepts'),
  getMetaphors: (territory?: string) => ipcRenderer.invoke('engine:getMetaphors', territory),
  getStats: () => ipcRenderer.invoke('engine:getStats'),
});
