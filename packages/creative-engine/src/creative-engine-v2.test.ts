import type { Concept, CreativeHistoryEntry } from '@printsync/shared';
import { describe, expect, it } from 'vitest';
import { analyzeAntiGeneric } from './anti-generic-v2.js';
import { at } from './arrays.js';
import { generateCreativeBrief } from './brief-generator.js';
import { runDailyCreativeEngine } from './daily-v2.js';
import { analyzeDiversity, selectDiverseTop3 } from './diversity.js';
import { judgeConceptsV2, judgeConceptV2 } from './judge-v2.js';
import { getMetaphorsForService, getMetaphorsForTerritory, VISUAL_METAPHORS } from './metaphors.js';
import { reworkConcept } from './rework.js';
import { generateConceptSeeds, seedToConcept } from './seeds.js';

describe('Creative Engine V2', () => {
  const goodConcept: Concept = {
    id: 'test_1',
    title: 'THE PRINT ENGINE',
    logline: 'Precision-engineered printing for brands that refuse to blend in.',
    creative_mode: 'TYPOGRAPHIC_FILM',
    narrative_structure: 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
    territory: 'PRECISION',
    mood: 'technical',
    visual_style: 'typography',
    pace: 'rhythmic',
    voice_mode: 'TYPOGRAPHY_ONLY',
    key_visual:
      'A mechanical engine made of print components — gears of paper, pistons of ink — comes to life with precision.',
    story_summary:
      'A mechanical engine constructed from print components comes to life, showing how PrintSync digital printing is precision-engineered for maximum impact.',
    target_duration_seconds: 20,
    formats: ['16:9', '9:16', '1:1'],
    cta: 'Engineer your brand',
  };

  const genericConcept: Concept = {
    id: 'test_2',
    title: 'QUALITY PRINTING SOLUTIONS',
    logline: 'We provide quality printing solutions for all your needs.',
    creative_mode: 'CORPORATE_AD',
    narrative_structure: 'PROBLEM_TENSION_DISCOVERY_TRANSFORMATION_PROOF_BRAND',
    territory: 'HUMAN_IMPACT',
    mood: 'minimal',
    visual_style: 'live_action',
    pace: 'slow_premium',
    voice_mode: 'VOICEOVER',
    key_visual: 'A printer in an office.',
    story_summary: 'We provide quality printing solutions.',
    target_duration_seconds: 30,
    formats: ['16:9'],
    cta: 'Contact us for a quote',
  };

  const emptyHistory: CreativeHistoryEntry[] = [];

  describe('Anti-Generic V2', () => {
    it('analyzes a concept and provides verdict', () => {
      const report = analyzeAntiGeneric(goodConcept, emptyHistory);
      expect(report).toBeDefined();
      expect(report.verdict).toBeDefined();
      expect(['PASS', 'REWORK', 'REJECT']).toContain(report.verdict);
      expect(report.genericityScore).toBeGreaterThanOrEqual(0);
    });

    it('flags a generic concept', () => {
      const report = analyzeAntiGeneric(genericConcept, emptyHistory);
      expect(report.verdict).toBe('REJECT');
      expect(report.detectedPatterns.length).toBeGreaterThan(0);
    });

    it('runs competitor test', () => {
      const report = analyzeAntiGeneric(goodConcept, emptyHistory);
      expect(report.competitorTest).toBeDefined();
      expect(typeof report.competitorTest.passes).toBe('boolean');
    });

    it('fails competitor test for generic concept', () => {
      const report = analyzeAntiGeneric(genericConcept, emptyHistory);
      expect(report.competitorTest.passes).toBe(false);
    });

    it('generates recommendations', () => {
      const report = analyzeAntiGeneric(genericConcept, emptyHistory);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Creative Judge V2', () => {
    it('scores a concept', () => {
      const verdict = judgeConceptV2(goodConcept, emptyHistory);
      expect(verdict.total).toBeGreaterThan(0);
      expect(verdict.total).toBeLessThanOrEqual(100);
      expect(verdict.status).toBeDefined();
    });

    it('has hard gates', () => {
      const verdict = judgeConceptV2(goodConcept, emptyHistory);
      expect(verdict.hardGates).toBeDefined();
      expect(verdict.hardGates).toHaveProperty('BRAND_FIT');
      expect(verdict.hardGates).toHaveProperty('SERVICE_CLARITY');
    });

    it('scores multiple concepts', () => {
      const concepts = [goodConcept, genericConcept];
      const results = judgeConceptsV2(concepts, emptyHistory);
      expect(results.length).toBe(2);
      expect(at(results, 0).verdict.total).toBeGreaterThanOrEqual(at(results, 1).verdict.total);
    });

    it('rejects weak concepts', () => {
      const verdict = judgeConceptV2(genericConcept, emptyHistory);
      expect(verdict.status).toBe('REJECT');
    });
  });

  describe('Concept Rework', () => {
    it('reworks a weak concept', () => {
      const result = reworkConcept(genericConcept, emptyHistory);
      expect(result).toBeDefined();
      expect(result.originalScore).toBeGreaterThan(0);
      expect(result.status).toBeDefined();
    });

    it('tracks iterations', () => {
      const result = reworkConcept(genericConcept, emptyHistory);
      expect(result.iterations).toBeGreaterThanOrEqual(0);
      expect(result.iterations).toBeLessThanOrEqual(3);
    });
  });

  describe('Diversity Engine', () => {
    it('analyzes diversity', () => {
      const concepts = [goodConcept, genericConcept];
      const analysis = analyzeDiversity(concepts);
      expect(analysis).toBeDefined();
      expect(analysis.diversityScore).toBeGreaterThanOrEqual(0);
      expect(analysis.diversityScore).toBeLessThanOrEqual(100);
    });

    it('selects diverse top 3', () => {
      const seeds = generateConceptSeeds(10);
      const concepts = seeds.map((s, i) => seedToConcept(s, i));
      const top3 = selectDiverseTop3(concepts);
      expect(top3.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Brief Generator', () => {
    it('generates a creative brief', () => {
      const brief = generateCreativeBrief(goodConcept);
      expect(brief).toBeDefined();
      expect(brief.brand).toBe('PrintSync');
      expect(brief.objective).toBe('AWARENESS');
      expect(brief.service).toBeDefined();
      expect(brief.cta).toBeDefined();
    });

    it('includes constraints', () => {
      const brief = generateCreativeBrief(goodConcept);
      expect(brief.constraints.length).toBeGreaterThan(0);
    });
  });

  describe('Concept Seeds', () => {
    it('generates 10 seeds', () => {
      const seeds = generateConceptSeeds(10);
      expect(seeds.length).toBe(10);
    });

    it('seeds are diverse', () => {
      const seeds = generateConceptSeeds(10);
      const territories = new Set(seeds.map((s) => s.territory));
      expect(territories.size).toBeGreaterThan(1);
    });

    it('converts seed to concept', () => {
      const seeds = generateConceptSeeds(1);
      const concept = seedToConcept(at(seeds, 0), 0);
      expect(concept).toBeDefined();
      expect(concept.title).toBeDefined();
      expect(concept.creative_mode).toBeDefined();
    });
  });

  describe('Visual Metaphors', () => {
    it('has 15 metaphors', () => {
      expect(VISUAL_METAPHORS.length).toBe(15);
    });

    it('gets metaphors for service', () => {
      const metaphors = getMetaphorsForService('large-format-printing');
      expect(metaphors.length).toBeGreaterThan(0);
    });

    it('gets metaphors for territory', () => {
      const metaphors = getMetaphorsForTerritory('PRECISION');
      expect(metaphors.length).toBeGreaterThan(0);
    });
  });

  describe('Daily Creative Engine V2', () => {
    it('runs the full pipeline', async () => {
      const report = await runDailyCreativeEngine([], ['branding', 'packaging', 'signage']);
      expect(report).toBeDefined();
      expect(report.date).toBeDefined();
      expect(report.creativeFatigue).toBeDefined();
      expect(report.concepts.length).toBe(10);
      expect(report.judgeResults.length).toBe(10);
    });

    it('produces a winner', async () => {
      const report = await runDailyCreativeEngine([], ['branding', 'packaging', 'signage']);
      expect(report.winner).toBeDefined();
    });

    it('produces a creative brief', async () => {
      const report = await runDailyCreativeEngine([], ['branding', 'packaging', 'signage']);
      expect(report.creativeBrief).toBeDefined();
    });

    it('produces a campaign genome', async () => {
      const report = await runDailyCreativeEngine([], ['branding', 'packaging', 'signage']);
      expect(report.campaignGenome).toBeDefined();
    });
  });
});
