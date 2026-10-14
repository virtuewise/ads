# Virtue Studio Dashboard

High-performance web frontend built with **Vite + React + Tailwind CSS + Motion + Zustand + TanStack Query**.

## Tech Stack

- **Vite**: Lightning-fast HMR and optimized bundling for rapid UI iteration
- **React 19**: Modern React with concurrent features
- **Tailwind CSS 4**: Utility-first styling aligned with brand tokens
- **Framer Motion**: Fluid, motion-first UI transitions
- **Zustand**: Lightweight state management for campaigns, render queues, and preview parameters
- **TanStack Query**: Robust server-state synchronization for render-farm jobs and QA reports

## Architecture

### State Management (Zustand)
Located in `src/store/studioStore.ts`:
- Campaign state (active campaign)
- Render queue (jobs, progress, status)
- QA reports (reports, active report)
- Preview state (mode, parameters)
- UI state (sidebar)

### Data Fetching (TanStack Query)
- **Render Farm** (`src/hooks/useRenderFarm.ts`): Query render plans, submit jobs
- **QA Engine** (`src/hooks/useQAEngine.ts`): Query QA reports, run QA checks

### Integration Points

#### Render Farm Integration
```typescript
import { useRenderFarm } from '@/hooks/useRenderFarm';

const { useRenderPlan, useSubmitRenderJob } = useRenderFarm();

// Query render plan
const { data: jobs } = useRenderPlan({
  composition: 'PrintSyncProductLine',
  durationInFrames: 450,
  fps: 30,
  width: 1920,
  height: 1080,
});

// Submit render job
const submitJob = useSubmitRenderJob();
submitJob.mutate(jobs[0]);
```

#### QA Engine Integration
```typescript
import { useQAEngine } from '@/hooks/useQAEngine';
import type { ProductionPlan } from '@printsync/common';

const { useQAReport, useRunQA } = useQAEngine();

// Query QA report
const { data: report } = useQAReport(planId);

// Run QA
const runQA = useRunQA();
runQA.mutate({
  plan: productionPlan,
  renderOutput: { format: 'mp4', width: 1920, height: 1080, bitrate: 8000000, codec: 'h264', duration: 30 },
});
```

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Migration from Next.js

This was migrated from Next.js to Vite + React:
- Removed Next.js-specific files (next.config.ts, next-env.d.ts, app/ directory)
- Created Vite configuration with React plugin
- Restructured to standard React app (index.html, main.tsx, App.tsx)
- Updated tsconfig for Vite + React
- Added TanStack Query provider in main.tsx
- Integrated motion (Framer Motion) animations
- Created Zustand store for state management
- Created hooks for Render Farm and QA Engine integration

## Future Enhancements

- Connect to actual render-farm API endpoint
- Connect to actual QA engine API endpoint
- Add real-time WebSocket updates for render progress
- Add campaign management UI
- Add asset browser
- Add concept review interface
- Add creative scoring visualization
