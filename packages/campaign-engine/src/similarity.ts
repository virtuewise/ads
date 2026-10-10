/**
 * Creative Similarity Engine
 * Deterministic similarity system using weighted attributes.
 * No embeddings or external AI services required.
 */

import type { CreativeGenome, SimilarityResult } from '@printsync/shared';

interface SimilarityWeights {
  creativeMode: number;
  narrativeStructure: number;
  service: number;
  visualTerritory: number;
  typography: number;
  motion: number;
  tone: number;
  camera: number;
  color: number;
  transition: number;
}

const DEFAULT_WEIGHTS: SimilarityWeights = {
  creativeMode: 0.15,
  narrativeStructure: 0.15,
  service: 0.10,
  visualTerritory: 0.15,
  typography: 0.10,
  motion: 0.10,
  tone: 0.10,
  camera: 0.05,
  color: 0.05,
  transition: 0.05,
};

/**
 * Calculate creative similarity between two genomes.
 * Returns a score from 0 (completely different) to 1 (identical).
 */
export function calculateCreativeSimilarity(
  a: CreativeGenome,
  b: CreativeGenome,
  weights: SimilarityWeights = DEFAULT_WEIGHTS
): SimilarityResult {
  const details: Record<string, number> = {};

  // Creative mode similarity
  details.creativeMode = a.creativeMode === b.creativeMode ? 1 : 0;

  // Narrative structure similarity
  details.narrativeStructure = a.narrativeStructure === b.narrativeStructure ? 1 : 0;

  // Service similarity
  details.service = a.service === b.service ? 1 : 0;

  // Visual territory similarity (Jaccard index)
  const territoryA = new Set(a.visualTerritories);
  const territoryB = new Set(b.visualTerritories);
  const territoryIntersection = new Set([...territoryA].filter(x => territoryB.has(x)));
  const territoryUnion = new Set([...territoryA, ...territoryB]);
  details.visualTerritory = territoryUnion.size > 0 ? territoryIntersection.size / territoryUnion.size : 0;

  // Typography behavior similarity (Jaccard index)
  const typoA = new Set(a.typographyBehaviors);
  const typoB = new Set(b.typographyBehaviors);
  const typoIntersection = new Set([...typoA].filter(x => typoB.has(x)));
  const typoUnion = new Set([...typoA, ...typoB]);
  details.typography = typoUnion.size > 0 ? typoIntersection.size / typoUnion.size : 0;

  // Motion behavior similarity (Jaccard index)
  const motionA = new Set(a.motionBehaviors);
  const motionB = new Set(b.motionBehaviors);
  const motionIntersection = new Set([...motionA].filter(x => motionB.has(x)));
  const motionUnion = new Set([...motionA, ...motionB]);
  details.motion = motionUnion.size > 0 ? motionIntersection.size / motionUnion.size : 0;

  // Emotional tone similarity (Jaccard index)
  const toneA = new Set(a.emotionalTone);
  const toneB = new Set(b.emotionalTone);
  const toneIntersection = new Set([...toneA].filter(x => toneB.has(x)));
  const toneUnion = new Set([...toneA, ...toneB]);
  details.tone = toneUnion.size > 0 ? toneIntersection.size / toneUnion.size : 0;

  // Camera language similarity (Jaccard index)
  const cameraA = new Set(a.cameraLanguage);
  const cameraB = new Set(b.cameraLanguage);
  const cameraIntersection = new Set([...cameraA].filter(x => cameraB.has(x)));
  const cameraUnion = new Set([...cameraA, ...cameraB]);
  details.camera = cameraUnion.size > 0 ? cameraIntersection.size / cameraUnion.size : 0;

  // Color profile similarity (Jaccard index)
  const colorA = new Set(a.colorProfile);
  const colorB = new Set(b.colorProfile);
  const colorIntersection = new Set([...colorA].filter(x => colorB.has(x)));
  const colorUnion = new Set([...colorA, ...colorB]);
  details.color = colorUnion.size > 0 ? colorIntersection.size / colorUnion.size : 0;

  // Transition type similarity (Jaccard index)
  const transA = new Set(a.transitionTypes);
  const transB = new Set(b.transitionTypes);
  const transIntersection = new Set([...transA].filter(x => transB.has(x)));
  const transUnion = new Set([...transA, ...transB]);
  details.transition = transUnion.size > 0 ? transIntersection.size / transUnion.size : 0;

  // Calculate weighted score
  const score =
    details.creativeMode * weights.creativeMode +
    details.narrativeStructure * weights.narrativeStructure +
    details.service * weights.service +
    details.visualTerritory * weights.visualTerritory +
    details.typography * weights.typography +
    details.motion * weights.motion +
    details.tone * weights.tone +
    details.camera * weights.camera +
    details.color * weights.color +
    details.transition * weights.transition;

  // Determine overlapping dimensions
  const overlappingDimensions: string[] = [];
  if (details.creativeMode > 0) overlappingDimensions.push('creative-mode');
  if (details.narrativeStructure > 0) overlappingDimensions.push('narrative-structure');
  if (details.service > 0) overlappingDimensions.push('service');
  if (details.visualTerritory > 0) overlappingDimensions.push('visual-territory');
  if (details.typography > 0) overlappingDimensions.push('typography');
  if (details.motion > 0) overlappingDimensions.push('motion');
  if (details.tone > 0) overlappingDimensions.push('tone');
  if (details.camera > 0) overlappingDimensions.push('camera');
  if (details.color > 0) overlappingDimensions.push('color');
  if (details.transition > 0) overlappingDimensions.push('transition');

  return {
    score: Math.round(score * 100) / 100,
    overlappingDimensions,
    details,
  };
}

/**
 * Check if two genomes are too similar (above threshold).
 */
export function areTooSimilar(
  a: CreativeGenome,
  b: CreativeGenome,
  threshold: number = 0.7
): boolean {
  return calculateCreativeSimilarity(a, b).score >= threshold;
}

/**
 * Calculate average similarity of a genome against a list of genomes.
 */
export function calculateAverageSimilarity(
  genome: CreativeGenome,
  others: CreativeGenome[]
): number {
  if (others.length === 0) return 0;
  const total = others.reduce((sum, other) => sum + calculateCreativeSimilarity(genome, other).score, 0);
  return Math.round((total / others.length) * 100) / 100;
}
