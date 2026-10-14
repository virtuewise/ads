import { buildRenderPlan, type RenderJobSpec, type RenderTarget } from '@printsync/render-farm';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface RenderFarmHooks {
  useRenderPlan: (target: RenderTarget) => ReturnType<typeof useQuery<readonly RenderJobSpec[]>>;
  useSubmitRenderJob: () => ReturnType<typeof useMutation<void, Error, RenderJobSpec>>;
}

// Mock render service - in production this would call your render API
const mockRenderService = {
  async submitJob(job: RenderJobSpec): Promise<void> {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('Submitted render job:', job.id);
  },
  async getJobStatus(_jobId: string): Promise<{ status: string; progress: number }> {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { status: 'rendering', progress: Math.random() * 100 };
  },
};

export const useRenderFarm = (): RenderFarmHooks => {
  const queryClient = useQueryClient();

  const useRenderPlan = (target: RenderTarget) => {
    return useQuery({
      queryKey: ['renderPlan', target.composition, target.durationInFrames],
      queryFn: () => {
        const plan = buildRenderPlan({ targets: [target] });
        return plan.jobs;
      },
      enabled: !!target.composition,
    });
  };

  const useSubmitRenderJob = () => {
    return useMutation({
      mutationFn: mockRenderService.submitJob,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['renderQueue'] });
      },
    });
  };

  return { useRenderPlan, useSubmitRenderJob };
};
