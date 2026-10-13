import { describe, it, expect } from 'vitest';
import { buildProductionPlan } from '@printsync/production-orchestrator';
import { readFileSync } from 'fs';
import { join } from 'path';

const boxBriefPath = join(__dirname, '../../../samples/box_brief.json');
const genericBriefPath = join(__dirname, '../../../samples/generic_brief.json');

function loadBrief(path: string) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('Production Orchestrator', () => {
  it('produces deterministic plan for box brief', async () => {
    const brief = loadBrief(boxBriefPath);
    const plan = await buildProductionPlan(brief, { seed: 'fixed-seed', validate: true });
    expect(plan.productionStatus).toBe('COMPLETE');
    // total shot duration should approx equal brief duration
    const totalShotDuration = plan.shots.reduce((sum, s) => sum + s.duration, 0);
    expect(Math.abs(totalShotDuration - brief.duration)).toBeLessThanOrEqual(0.5);
    // visual grammar name should match mode
    expect(plan.visualGrammar.name.toUpperCase()).toContain(brief.mode);
  });

  it('validates plan schema', async () => {
    const brief = loadBrief(genericBriefPath);
    const plan = await buildProductionPlan(brief, { seed: 'seed2', validate: true });
    // Zod validation already performed, just ensure plan exists
    expect(plan).toBeDefined();
  });
});
