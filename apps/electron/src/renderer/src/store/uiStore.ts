import { create } from 'zustand';

export type Tool = 'select' | 'text' | 'shape' | 'pen' | 'node' | 'hand' | 'zoom';
export type Panel =
  | 'assets'
  | 'layers'
  | 'templates'
  | 'effects'
  | 'fonts'
  | 'transitions'
  | 'properties';
export type View = 'canvas' | 'nodes';

interface UIState {
  activeTool: Tool;
  setActiveTool: (t: Tool) => void;
  leftPanel: Panel;
  setLeftPanel: (p: Panel) => void;
  rightPanel: Panel;
  setRightPanel: (p: Panel) => void;
  view: View;
  setView: (v: View) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  playhead: number;
  setPlayhead: (n: number) => void;
  playing: boolean;
  setPlaying: (b: boolean) => void;
  duration: number;
  setDuration: (n: number) => void;
  fps: number;
  zoom: number;
  setZoom: (n: number) => void;
  sidebarWidth: number;
  timelineHeight: number;
}

export const useUI = create<UIState>((set) => ({
  activeTool: 'select',
  setActiveTool: (t) => set({ activeTool: t }),
  leftPanel: 'assets',
  setLeftPanel: (p) => set({ leftPanel: p }),
  rightPanel: 'properties',
  setRightPanel: (p) => set({ rightPanel: p }),
  view: 'canvas',
  setView: (v) => set({ view: v }),
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  playhead: 0,
  setPlayhead: (n) => set({ playhead: n }),
  playing: false,
  setPlaying: (b) => set({ playing: b }),
  duration: 5,
  setDuration: (n) => set({ duration: n }),
  fps: 30,
  zoom: 1,
  setZoom: (n) => set({ zoom: n }),
  sidebarWidth: 280,
  timelineHeight: 220,
}));
