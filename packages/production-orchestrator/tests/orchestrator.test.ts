import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CreativeBrief } from '@printsync/common';
import { buildProductionPlan, finalizeProductionPlan } from '@printsync/production-orchestrator';
import { describe, expect, it } from 'vitest';

const boxBriefPath = join(__dirname, '../../../samples/box_brief.json');
const genericBriefPath = join(__dirname, '../../../samples/generic_brief.json');

function loadBrief(path: string) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function renderOutput(duration: number) {
  return {
    format: 'mp4',
    width: 1920,
    height: 1080,
    bitrate: 8_000_000,
    codec: 'h264',
    duration,
  };
}

/**
 * A brief whose creative decisions clear the judge's approve band (>= 80).
 * The QA gate judges the branded, service-specific creative implied by the
 * brief, so a generic brief is expected to fail it.
 */
const strongBrief: CreativeBrief = {
  id: 'strong-001',
  title: 'THE PRINT ENGINE',
  duration: 30,
  mode: 'TYPOGRAPHIC_FILM',
  service: 'PrintSync',
  objective:
    'PrintSync precision large format digital print with registration-perfect signage, branding, packaging, banners and posters that transform a brand.',
  voice: 'TYPOGRAPHY_ONLY',
  scenes: ['print', 'brand', 'signage', 'call_to_action'],
};

describe('Production Orchestrator', () => {
  it('produces deterministic plan for box brief', async () => {
    const brief = loadBrief(boxBriefPath);
    const plan = await buildProductionPlan(brief, { seed: 'fixed-seed', validate: true });
    // A freshly built plan is gated on QA and only becomes COMPLETE after finalizeProductionPlan.
    expect(plan.productionStatus).toBe('PENDING_QA');
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

  it('blocks finalize when the creative gate lands below approve', async () => {
    const brief = loadBrief(boxBriefPath);
    const plan = await buildProductionPlan(brief, { seed: 'fixed-seed', validate: true });
    const finalized = await finalizeProductionPlan(plan, renderOutput(brief.duration));

    expect(finalized.productionStatus).toBe('QA_FAILED');
    expect(finalized.qaReport).toBeDefined();
    expect(finalized.qaReport?.summary.failed).toBeGreaterThan(0);
    const creative = finalized.qaReport?.checks.find((c) => c.category === 'CREATIVE');
    expect(creative?.status).toBe('FAIL');
    // The finalize step appends the QA report to the plan's audit trail.
    expect(finalized.qa.checks.length).toBeGreaterThan(plan.qa.checks.length);
  });

  it('finalizes a plan to COMPLETE when the creative gate approves', async () => {
    const plan = await buildProductionPlan(strongBrief, { seed: 'strong-seed', validate: true });
    const finalized = await finalizeProductionPlan(plan, renderOutput(strongBrief.duration));

    expect(finalized.productionStatus).toBe('COMPLETE');
    expect(finalized.qaReport).toBeDefined();
    expect(finalized.qaReport?.summary.failed).toBe(0);
    expect(
      finalized.qaReport?.checks.some((c) => c.category === 'CREATIVE' && c.status === 'PASS'),
    ).toBe(true);
  });
});
