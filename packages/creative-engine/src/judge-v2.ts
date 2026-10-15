/**
 * Creative Judge V2
 * Expanded scoring with hard gates and competitor test.
 */

import type { Concept, CreativeHistoryEntry, JudgeVerdict } from '@printsync/shared';
import { DEFAULT_THRESHOLDS } from '@printsync/shared';
import { analyzeAntiGeneric } from './anti-generic-v2.js';

interface JudgeDimension {
  name: string;
  weight: number;
  score: (concept: Concept, history: CreativeHistoryEntry[]) => number;
}

const DIMENSIONS: JudgeDimension[] = [
  {
    name: 'BRAND_FIT',
    weight: 10,
    score: (concept) => {
      let score = 7;
      if (concept.territory === 'PRECISION' || concept.territory === 'TRANSFORMATION') score += 1;
      if (concept.mood === 'technical' || concept.mood === 'minimal') score += 0.5;
      if (concept.visual_style === 'typography') score += 0.5;
      if (concept.title.toLowerCase().includes('quality')) score -= 2;
      return Math.min(10, Math.max(1, Math.round(score)));
    },
  },
  {
    name: 'ORIGINALITY',
    weight: 10,
    score: (concept, history) => {
      let score = 6;
      if (concept.creative_mode === 'DETECTIVE_AD') score += 2;
      if (concept.creative_mode === 'VFX_EXPERIMENT') score += 1.5;
      if (concept.creative_mode === 'TYPOGRAPHIC_FILM') score += 1;
      if (concept.territory === 'PLAY') score += 1;
      const recentSimilar = history.filter(
        (h) => h.creative_mode === concept.creative_mode && h.territory === concept.territory,
      ).length;
      score -= recentSimilar * 1.5;
      return Math.min(10, Math.max(1, Math.round(score)));
    },
  },
  {
    name: 'COMMERCIAL_VALUE',
    weight: 10,
    score: (concept) => {
      let score = 7;
      if (concept.cta.length > 0 && concept.cta.length < 30) score += 1;
      if (concept.story_summary.toLowerCase().includes('print')) score += 0.5;
      if (concept.story_summary.toLowerCase().includes('brand')) score += 0.5;
      if (concept.logline.toLowerCase().includes('solution')) score -= 1;
      return Math.min(10, Math.max(1, Math.round(score)));
    },
  },
  {
    name: 'VISUAL_IMPACT',
    weight: 10,
    score: (concept) => {
      let score = 6;
      if (concept.visual_style === 'vfx') score += 2;
      if (concept.visual_style === 'typography') score += 1.5;
      if (concept.visual_style === 'mixed') score += 1;
      if (concept.key_visual.length > 50) score += 1;
      return Math.min(10, Math.max(1, Math.round(score)));
    },
  },
  {
    name: 'MEMORABILITY',
    weight: 10,
    score: (concept) => {
      let score = 6;
      if (concept.title.length < 30) score += 1.5;
      if (concept.title.length < 20) score += 0.5;
      if (concept.creative_mode === 'DETECTIVE_AD') score += 1;
      if (concept.creative_mode === 'HUMOR_AD') score += 0.5;
      return Math.min(10, Math.max(1, Math.round(score)));
    },
  },
  {
    name: 'SERVICE_CLARITY',
    weight: 10,
    score: (concept) => {
      let score = 7;
      const text = `${concept.title} ${concept.logline} ${concept.story_summary}`.toLowerCase();
      const services = ['print', 'sign', 'brand', 'label', 'packag', 'banner', 'poster', 'display'];
      const matches = services.filter((s) => text.includes(s)).length;
      score += Math.min(3, matches);
      return Math.min(10, Math.max(1, Math.round(score)));
    },
  },
  {
    name: 'SOCIAL_STOP_POWER',
    weight: 10,
    score: (concept) => {
      let score = 6;
      if (concept.formats.includes('9:16')) score += 1;
      if (concept.formats.includes('1:1')) score += 0.5;
      if (concept.target_duration_seconds <= 15) score += 1.5;
      if (concept.target_duration_seconds <= 30) score += 0.5;
      if (concept.voice_mode === 'TYPOGRAPHY_ONLY' || concept.voice_mode === 'MUSIC_ONLY')
        score += 1;
      return Math.min(10, Math.max(1, Math.round(score)));
    },
  },
  {
    name: 'PRODUCTION_FEASIBILITY',
    weight: 5,
    score: (concept) => {
      let score = 7;
      if (concept.creative_mode === 'TYPOGRAPHIC_FILM') score += 1;
      if (concept.creative_mode === 'TYPOGRAPHY_ONLY') score += 1;
      if (concept.creative_mode === '3D_PRODUCT_FILM') score -= 0.5;
      if (concept.creative_mode === 'VFX_EXPERIMENT') score -= 0.5;
      return Math.min(10, Math.max(1, Math.round(score)));
    },
  },
  {
    name: 'BRAND_SPECIFICITY',
    weight: 5,
    score: (concept) => {
      let score = 6;
      const text = `${concept.title} ${concept.logline} ${concept.story_summary}`.toLowerCase();
      if (text.includes('precision') || text.includes('printsync')) score += 2;
      if (text.includes('cmyk') || text.includes('registration')) score += 1;
      if (text.includes('large format') || text.includes('digital print')) score += 1;
      return Math.min(10, Math.max(1, Math.round(score)));
    },
  },
  {
    name: 'NON_GENERIC_QUALITY',
    weight: 5,
    score: (concept, history) => {
      const report = analyzeAntiGeneric(concept, history);
      return Math.max(0, 10 - report.detectedPatterns.length * 2);
    },
  },
  {
    name: 'EMOTIONAL_IMPACT',
    weight: 5,
    score: (concept) => {
      let score = 6;
      if (concept.mood === 'dramatic') score += 1.5;
      if (concept.mood === 'cinematic') score += 1;
      if (concept.mood === 'playful') score += 0.5;
      if (concept.narrative_structure === 'MYSTERY_CLUE_INVESTIGATION_REVEAL_PRODUCT_CTA')
        score += 1;
      return Math.min(10, Math.max(1, Math.round(score)));
    },
  },
  {
    name: 'CAMPAIGN_POTENTIAL',
    weight: 5,
    score: (concept) => {
      let score = 6;
      if (concept.creative_mode === 'CAMPAIGN_FILM') score += 2;
      if (concept.creative_mode === 'DETECTIVE_AD') score += 1;
      if (concept.formats.length >= 3) score += 1;
      return Math.min(10, Math.max(1, Math.round(score)));
    },
  },
];

// Hard gates — concept cannot PASS if any of these fail
const HARD_GATES = {
  BRAND_FIT: 7,
  SERVICE_CLARITY: 6,
  ORIGINALITY: 6,
  NON_GENERIC: 6,
};

/**
 * Score a concept using the expanded Judge V2 system.
 */
export function judgeConceptV2(concept: Concept, history: CreativeHistoryEntry[]): JudgeVerdict {
  const dimensions: Record<string, number> = {};
  let totalScore = 0;
  let totalWeight = 0;

  for (const dim of DIMENSIONS) {
    const score = dim.score(concept, history);
    dimensions[dim.name] = score;
    totalScore += score * dim.weight;
    totalWeight += dim.weight;
  }

  // Weighted average of the 0–10 dimensions, scaled to the shared 0–100 rubric
  // so the band thresholds (70/80/90) and `getScoreStatus` apply consistently.
  const total = Math.round((totalScore / totalWeight) * 10);

  // Check hard gates
  const hardGates: Record<string, boolean> = {
    BRAND_FIT: (dimensions.BRAND_FIT ?? 0) >= HARD_GATES.BRAND_FIT,
    SERVICE_CLARITY: (dimensions.SERVICE_CLARITY ?? 0) >= HARD_GATES.SERVICE_CLARITY,
    ORIGINALITY: (dimensions.ORIGINALITY ?? 0) >= HARD_GATES.ORIGINALITY,
    NON_GENERIC: (dimensions.NON_GENERIC_QUALITY ?? 0) >= HARD_GATES.NON_GENERIC,
  };

  // Run competitor test
  const antiGenericReport = analyzeAntiGeneric(concept, history);
  const competitorTestPasses = antiGenericReport.competitorTest.passes;

  // Determine status. Bands come from the shared rubric; V2 additionally
  // requires all hard gates (and the competitor test for SIGNATURE) to pass.
  let status: 'REJECT' | 'REWORK' | 'APPROVE' | 'SIGNATURE' = 'REJECT';
  const allGatesPass = Object.values(hardGates).every((v) => v);

  if (total >= DEFAULT_THRESHOLDS.signature && allGatesPass && competitorTestPasses) {
    status = 'SIGNATURE';
  } else if (total >= DEFAULT_THRESHOLDS.approve && allGatesPass) {
    status = 'APPROVE';
  } else if (total >= DEFAULT_THRESHOLDS.rework) {
    status = 'REWORK';
  }

  // Generate feedback
  const feedback: string[] = [];
  for (const [gate, passes] of Object.entries(hardGates)) {
    if (!passes) feedback.push(`Hard gate failed: ${gate}`);
  }
  if (!competitorTestPasses)
    feedback.push('Competitor test failed — concept is not brand-specific enough');
  if (total < DEFAULT_THRESHOLDS.approve)
    feedback.push(`Score ${total} is below approval threshold (${DEFAULT_THRESHOLDS.approve})`);
  if (feedback.length === 0) feedback.push('Strong concept across all dimensions');

  return {
    total,
    dimensions,
    hardGates,
    status,
    feedback,
    competitorTestPasses,
  };
}

/**
 * Score multiple concepts and return sorted by total score.
 */
export function judgeConceptsV2(
  concepts: Concept[],
  history: CreativeHistoryEntry[],
): Array<{ concept: Concept; verdict: JudgeVerdict }> {
  return concepts
    .map((concept) => ({ concept, verdict: judgeConceptV2(concept, history) }))
    .sort((a, b) => b.verdict.total - a.verdict.total);
}
