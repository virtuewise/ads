/**
 * Daily Ad Engine V2
 * Full pipeline: brand → history → fatigue → opportunities → concepts → judge → diversity → select → brief
 */

import type {
  CampaignObjective,
  Concept,
  CreativeFatigueReport,
  CreativeHistoryEntry,
  CreativeOpportunity,
  DiversityAnalysis,
  EnhancedCreativeBrief,
  JudgeVerdict,
} from '@printsync/shared';
import { generateCreativeBrief } from './brief-generator.js';
import {
  detectCreativeFatigue,
  generateCreativeGenome,
  identifyCreativeOpportunities,
} from './campaign-functions.js';
import { analyzeDiversity, selectDiverseTop3 } from './diversity.js';
import { judgeConceptsV2 } from './judge-v2.js';
import { reworkConcept } from './rework.js';
import { generateConceptSeeds, seedToConcept } from './seeds.js';

export interface DailyCreativeReport {
  date: string;
  creativeOpportunity: CreativeOpportunity | null;
  creativeFatigue: CreativeFatigueReport[];
  concepts: Concept[];
  antiGenericReports: Map<
    string,
    {
      genericityScore: number;
      originalityScore: number;
      distinctivenessScore: number;
      brandSpecificityScore: number;
      detectedPatterns: string[];
      recommendations: string[];
      verdict: 'PASS' | 'REWORK' | 'REJECT';
      competitorTest: { passes: boolean; issues: string[] };
    }
  >;
  judgeResults: Array<{ concept: Concept; verdict: JudgeVerdict }>;
  diversityAnalysis: DiversityAnalysis;
  topThree: Concept[];
  reworkResults: Array<{
    original: Concept;
    result: {
      originalScore: number;
      reworkedConcept: unknown;
      newScore: number;
      improvements: string[];
      remainingIssues: string[];
      iterations: number;
      status: 'IMPROVED' | 'UNCHANGED' | 'REJECTED';
    };
  }>;
  winner: Concept | null;
  creativeBrief: EnhancedCreativeBrief | null;
  campaignGenome: ReturnType<typeof generateCreativeGenome> | null;
}

/**
 * Run the full Daily Ad Engine V2 pipeline.
 */
export async function runDailyCreativeEngine(
  history: CreativeHistoryEntry[],
  availableServices: string[],
  objective: CampaignObjective = 'AWARENESS',
): Promise<DailyCreativeReport> {
  const date = new Date().toISOString().slice(0, 10);

  // Step 1: Calculate creative fatigue
  const genomes = history.map(() =>
    generateCreativeGenome({
      id: 'temp',
      title: 'temp',
      logline: 'temp',
      creative_mode: 'CINEMATIC_BRAND_FILM',
      narrative_structure: 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
      territory: 'PRECISION',
      mood: 'technical',
      visual_style: 'typography',
      pace: 'rhythmic',
      voice_mode: 'TYPOGRAPHY_ONLY',
      key_visual: 'temp',
      story_summary: 'temp',
      target_duration_seconds: 30,
      formats: ['16:9'],
      cta: 'temp',
    }),
  );
  const creativeFatigue = detectCreativeFatigue(genomes);

  // Step 2: Identify creative opportunities
  const opportunities = identifyCreativeOpportunities(genomes, creativeFatigue, availableServices);
  const topOpportunity = opportunities[0] ?? null;

  // Step 3: Generate 10 diverse concepts
  const seeds = generateConceptSeeds(10);
  const concepts = seeds.map((seed, i) => seedToConcept(seed, i));

  // Step 4: Anti-generic analysis
  const antiGenericReports = new Map();
  const { analyzeAntiGeneric } = await import('./anti-generic-v2.js');
  for (const concept of concepts) {
    const report = analyzeAntiGeneric(concept, history);
    antiGenericReports.set(concept.id, report);
  }

  // Step 5: Creative judge
  const judgeResults = judgeConceptsV2(concepts, history);

  // Step 6: Diversity analysis
  const topConcepts = judgeResults.slice(0, 5).map((j) => j.concept);
  const diversityAnalysis = analyzeDiversity(topConcepts);

  // Step 7: Select diverse top 3
  const topThree = selectDiverseTop3(topConcepts);

  // Step 8: Rework if necessary
  const reworkResults = [];
  for (const concept of topThree) {
    const verdict = judgeResults.find((j) => j.concept.id === concept.id)?.verdict;
    if (verdict && (verdict.status === 'REWORK' || verdict.status === 'REJECT')) {
      const result = reworkConcept(concept, history);
      reworkResults.push({ original: concept, result });
    }
  }

  // Step 9: Select winner
  const winner = topThree[0] ?? null;

  // Step 10: Create creative brief
  const creativeBrief = winner ? generateCreativeBrief(winner, objective) : null;

  // Step 11: Create campaign genome
  const campaignGenome = winner ? generateCreativeGenome(winner) : null;

  return {
    date,
    creativeOpportunity: topOpportunity,
    creativeFatigue,
    concepts,
    antiGenericReports,
    judgeResults,
    diversityAnalysis,
    topThree,
    reworkResults,
    winner,
    creativeBrief,
    campaignGenome,
  };
}
