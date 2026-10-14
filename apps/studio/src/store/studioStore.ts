import { create } from 'zustand';

interface RenderJob {
  id: string;
  composition: string;
  status: 'pending' | 'rendering' | 'completed' | 'failed';
  progress: number;
  output?: string;
  error?: string;
}

interface QACheck {
  id: string;
  category: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  score: number;
  threshold: number;
  message: string;
}

interface QAReport {
  id: string;
  productionPlanId: string;
  score: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    blockers: number;
  };
  checks: QACheck[];
  timestamp: string;
}

interface StudioState {
  // Campaign state
  activeCampaign: string | null;
  setActiveCampaign: (campaignId: string | null) => void;

  // Render queue state
  renderQueue: RenderJob[];
  addRenderJob: (job: Omit<RenderJob, 'progress'>) => void;
  updateRenderJob: (id: string, updates: Partial<RenderJob>) => void;
  removeRenderJob: (id: string) => void;

  // QA state
  qaReports: QAReport[];
  activeQAReport: QAReport | null;
  setActiveQAReport: (report: QAReport | null) => void;
  addQAReport: (report: QAReport) => void;

  // Preview state
  previewMode: 'composition' | 'storyboard' | 'output';
  setPreviewMode: (mode: 'composition' | 'storyboard' | 'output') => void;
  previewParameters: Record<string, unknown>;
  setPreviewParameters: (params: Record<string, unknown>) => void;

  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  // Campaign state
  activeCampaign: null,
  setActiveCampaign: (campaignId) => set({ activeCampaign: campaignId }),

  // Render queue state
  renderQueue: [],
  addRenderJob: (job) =>
    set((state) => ({
      renderQueue: [...state.renderQueue, { ...job, progress: 0 }],
    })),
  updateRenderJob: (id, updates) =>
    set((state) => ({
      renderQueue: state.renderQueue.map((job) => (job.id === id ? { ...job, ...updates } : job)),
    })),
  removeRenderJob: (id) =>
    set((state) => ({
      renderQueue: state.renderQueue.filter((job) => job.id !== id),
    })),

  // QA state
  qaReports: [],
  activeQAReport: null,
  setActiveQAReport: (report) => set({ activeQAReport: report }),
  addQAReport: (report) =>
    set((state) => ({
      qaReports: [...state.qaReports, report],
    })),

  // Preview state
  previewMode: 'composition',
  setPreviewMode: (mode) => set({ previewMode: mode }),
  previewParameters: {},
  setPreviewParameters: (params) => set({ previewParameters: params }),

  // UI state
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
