import type { ProductionPlan } from '@printsync/common';
import { QAEngine, type QAReport } from '@printsync/qa-engine';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface RenderOutputDescriptor {
  format: string;
  width: number;
  height: number;
  bitrate: number;
  codec: string;
  duration: number;
  filePath?: string;
}

interface QAEngineHooks {
  useQAReport: (planId: string) => ReturnType<typeof useQuery<QAReport | null>>;
  useRunQA: () => ReturnType<
    typeof useMutation<
      QAReport,
      Error,
      { plan: ProductionPlan; renderOutput: RenderOutputDescriptor }
    >
  >;
}

// Mock QA service - in production this would call your QA API
const mockQAService = {
  async runQA(plan: ProductionPlan, renderOutput: RenderOutputDescriptor): Promise<QAReport> {
    const engine = new QAEngine();
    return engine.runQA(plan, renderOutput);
  },
  async getQAReport(_planId: string): Promise<QAReport | null> {
    // Simulate API call - in production fetch from database
    await new Promise((resolve) => setTimeout(resolve, 500));
    return null;
  },
};

export const useQAEngine = (): QAEngineHooks => {
  const queryClient = useQueryClient();

  const useQAReport = (planId: string) => {
    return useQuery({
      queryKey: ['qaReport', planId],
      queryFn: () => mockQAService.getQAReport(planId),
      enabled: !!planId,
    });
  };

  const useRunQA = () => {
    return useMutation({
      mutationFn: async ({
        plan,
        renderOutput,
      }: {
        plan: ProductionPlan;
        renderOutput: RenderOutputDescriptor;
      }) => {
        return mockQAService.runQA(plan, renderOutput);
      },
      onSuccess: (data, variables) => {
        queryClient.setQueryData(['qaReport', variables.plan.id], data);
        queryClient.invalidateQueries({ queryKey: ['qaReports'] });
      },
    });
  };

  return { useQAReport, useRunQA };
};
