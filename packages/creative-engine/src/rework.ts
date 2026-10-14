/**
 * Concept Rework Loop
 * Do not simply reject — rework concepts to improve them.
 */

import type { Concept, CreativeHistoryEntry, ReworkResult } from '@printsync/shared';
import { DEFAULT_THRESHOLDS } from '@printsync/shared';
import { analyzeAntiGeneric } from './anti-generic-v2.js';
import { judgeConceptV2 } from './judge-v2.js';

const MAX_ITERATIONS = 3;

/**
 * Rework a concept based on judge feedback.
 * Returns an improved concept or rejects it if it cannot be improved.
 */
export function reworkConcept(concept: Concept, history: CreativeHistoryEntry[]): ReworkResult {
  let currentConcept = { ...concept };
  let currentVerdict = judgeConceptV2(currentConcept, history);
  const originalScore = currentVerdict.total;
  const improvements: string[] = [];
  let iterations = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (currentVerdict.status === 'APPROVE' || currentVerdict.status === 'SIGNATURE') {
      break;
    }

    iterations++;
    const antiGenericReport = analyzeAntiGeneric(currentConcept, history);
    const reworkStrategy = generateReworkStrategy(
      currentConcept,
      currentVerdict,
      antiGenericReport,
    );

    if (reworkStrategy.length === 0) break;

    // Apply rework strategy
    const reworkedConcept = applyRework(currentConcept, reworkStrategy);
    const newVerdict = judgeConceptV2(reworkedConcept, history);

    if (newVerdict.total > currentVerdict.total) {
      improvements.push(...reworkStrategy);
      currentConcept = reworkedConcept;
      currentVerdict = newVerdict;
    } else {
      break;
    }
  }

  const newScore = currentVerdict.total;
  const remainingIssues = currentVerdict.feedback;

  let status: 'IMPROVED' | 'UNCHANGED' | 'REJECTED' = 'UNCHANGED';
  if (newScore > originalScore) status = 'IMPROVED';
  if (newScore < DEFAULT_THRESHOLDS.rework) status = 'REJECTED';

  return {
    originalScore,
    reworkedConcept: currentConcept,
    newScore,
    improvements,
    remainingIssues,
    iterations,
    status,
  };
}

/**
 * Generate a rework strategy based on judge feedback.
 */
function generateReworkStrategy(
  _concept: Concept,
  verdict: { feedback: string[]; hardGates: Record<string, boolean> },
  antiGenericReport: { recommendations: string[] },
): string[] {
  const strategies: string[] = [];

  // Address hard gate failures
  if (!verdict.hardGates['BRAND_FIT']) {
    strategies.push('Strengthen PrintSync brand connection');
  }
  if (!verdict.hardGates['SERVICE_CLARITY']) {
    strategies.push('Clarify service connection');
  }
  if (!verdict.hardGates['ORIGINALITY']) {
    strategies.push('Increase originality — avoid familiar patterns');
  }
  if (!verdict.hardGates['NON_GENERIC']) {
    strategies.push('Reduce generic indicators');
  }

  // Address anti-generic recommendations
  for (const rec of antiGenericReport.recommendations) {
    if (!strategies.includes(rec)) {
      strategies.push(rec);
    }
  }

  return strategies.slice(0, 3); // Limit to 3 strategies per iteration
}

/**
 * Apply rework strategy to a concept.
 */
function applyRework(concept: Concept, strategies: string[]): Concept {
  const reworked = { ...concept };
  reworked.id = concept.id; // Preserve original ID

  for (const strategy of strategies) {
    if (strategy.includes('brand') || strategy.includes('PrintSync')) {
      // Strengthen brand connection
      if (!reworked.story_summary.toLowerCase().includes('printsync')) {
        reworked.story_summary = `PrintSync ${reworked.story_summary}`;
      }
    }
    if (strategy.includes('service') || strategy.includes('clarify')) {
      // Clarify service connection
      if (!reworked.story_summary.toLowerCase().includes('print')) {
        reworked.story_summary = `${reworked.story_summary} — precision printing by PrintSync`;
      }
    }
    if (strategy.includes('originality') || strategy.includes('creative device')) {
      // Add creative device
      if (!reworked.key_visual.toLowerCase().includes('transform')) {
        reworked.key_visual = `${reworked.key_visual} — a transformation that reveals PrintSync precision`;
      }
    }
    if (strategy.includes('generic') || strategy.includes('brand-specific')) {
      // Reduce generic indicators
      reworked.title = reworked.title.replace(/quality/gi, 'precision');
      reworked.logline = reworked.logline.replace(/solution/gi, 'precision');
    }
  }

  return reworked;
}
