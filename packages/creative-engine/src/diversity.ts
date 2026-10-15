/**
 * Creative Diversity Engine
 * Ensures the top three concepts are not all visually similar.
 */

import type { Concept, DiversityAnalysis } from '@printsync/shared';
import { at } from './arrays.js';
import { calculateCreativeSimilarity, generateCreativeGenome } from './campaign-functions.js';

/**
 * Analyze diversity of the top concepts.
 */
export function analyzeDiversity(concepts: Concept[]): DiversityAnalysis {
  if (concepts.length < 2) {
    return {
      topConcepts: concepts.map((c) => c.title),
      diversityScore: 100,
      dimensions: {},
      verdict: 'DIVERSE',
      issues: [],
    };
  }

  const genomes = concepts.map((c) => generateCreativeGenome(c));
  const dimensions: Record<string, number[]> = {};

  // Calculate pairwise similarity for each dimension
  const dimensionNames = [
    'creativeMode',
    'narrativeStructure',
    'service',
    'visualTerritory',
    'typography',
    'motion',
    'tone',
  ];

  for (const dim of dimensionNames) {
    dimensions[dim] = [];
    for (let i = 0; i < genomes.length; i++) {
      for (let j = i + 1; j < genomes.length; j++) {
        const similarity = calculateCreativeSimilarity(at(genomes, i), at(genomes, j));
        const dimScore = similarity.details[dim] ?? 0;
        dimensions[dim].push(dimScore);
      }
    }
  }

  // Calculate overall diversity score
  const allScores = Object.values(dimensions).flat();
  const averageSimilarity =
    allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
  const diversityScore = Math.round((1 - averageSimilarity) * 100);

  // Determine verdict
  let verdict: 'DIVERSE' | 'ACCEPTABLE' | 'REPETITIVE' = 'DIVERSE';
  const issues: string[] = [];

  if (diversityScore < 30) {
    verdict = 'REPETITIVE';
    issues.push('Top concepts are too similar to each other');
  } else if (diversityScore < 60) {
    verdict = 'ACCEPTABLE';
    issues.push('Some similarity between top concepts');
  }

  // Check for specific repetitive patterns
  const creativeModes = new Set(concepts.map((c) => c.creative_mode));
  if (creativeModes.size === 1) {
    issues.push('All top concepts use the same creative mode');
  }

  const territories = new Set(concepts.map((c) => c.territory));
  if (territories.size === 1) {
    issues.push('All top concepts use the same visual territory');
  }

  return {
    topConcepts: concepts.map((c) => c.title),
    diversityScore,
    dimensions,
    verdict,
    issues,
  };
}

/**
 * Select diverse top 3 concepts from a larger pool.
 */
export function selectDiverseTop3(concepts: Concept[]): Concept[] {
  if (concepts.length <= 3) return concepts;

  const selected: Concept[] = [];
  const remaining = [...concepts];

  // First concept: highest scored
  const first = remaining.shift();
  if (!first) return selected;
  selected.push(first);

  // Second concept: most different from first
  let maxDiversity = -1;
  let maxIndex = 0;
  for (let i = 0; i < remaining.length; i++) {
    const diversity = calculateDiversityScore(at(selected, 0), at(remaining, i));
    if (diversity > maxDiversity) {
      maxDiversity = diversity;
      maxIndex = i;
    }
  }
  selected.push(at(remaining.splice(maxIndex, 1), 0));

  // Third concept: most different from both selected
  maxDiversity = -1;
  maxIndex = 0;
  for (let i = 0; i < remaining.length; i++) {
    const diversity =
      (calculateDiversityScore(at(selected, 0), at(remaining, i)) +
        calculateDiversityScore(at(selected, 1), at(remaining, i))) /
      2;
    if (diversity > maxDiversity) {
      maxDiversity = diversity;
      maxIndex = i;
    }
  }
  selected.push(at(remaining.splice(maxIndex, 1), 0));

  return selected;
}

function calculateDiversityScore(a: Concept, b: Concept): number {
  const genomeA = generateCreativeGenome(a);
  const genomeB = generateCreativeGenome(b);
  return 1 - calculateCreativeSimilarity(genomeA, genomeB).score;
}
