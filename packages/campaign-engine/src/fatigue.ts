/**
 * Creative Fatigue Detector
 * Detects when PrintSync is overusing a creative language.
 */

import type { CreativeFatigueReport, CreativeGenome } from '@printsync/shared';

interface FatigueDimension {
  name: string;
  extract: (genome: CreativeGenome) => string[];
}

const FATIGUE_DIMENSIONS: FatigueDimension[] = [
  {
    name: 'Kinetic Typography',
    extract: (g) => (g.typographyBehaviors.length > 0 ? ['typography'] : []),
  },
  {
    name: 'Dark Technical Aesthetic',
    extract: (g) =>
      g.colorProfile.includes('dark') || g.colorProfile.includes('monochrome')
        ? ['dark-technical']
        : [],
  },
  {
    name: 'Large Format Service',
    extract: (g) => (g.service === 'large-format-printing' ? ['large-format'] : []),
  },
  {
    name: 'Detective Narrative',
    extract: (g) => (g.narrativeStructure.includes('MYSTERY') ? ['detective'] : []),
  },
  { name: 'Humour', extract: (g) => (g.humorLevel > 3 ? ['humour'] : []) },
  { name: 'Human Storytelling', extract: (g) => (g.humanPresence > 5 ? ['human-story'] : []) },
  { name: 'Packaging', extract: (g) => (g.service === 'packaging' ? ['packaging'] : []) },
  {
    name: 'Minimalist Print Photography',
    extract: (g) =>
      g.colorProfile.includes('monochrome') && g.cinematicLevel < 5 ? ['minimal-photo'] : [],
  },
  { name: 'Cinematic Film', extract: (g) => (g.cinematicLevel > 7 ? ['cinematic'] : []) },
  { name: 'Technical Grids', extract: (g) => (g.technicalLevel > 7 ? ['technical-grids'] : []) },
  {
    name: 'Particle Effects',
    extract: (g) => (g.motionBehaviors.some((b) => b.includes('particle')) ? ['particles'] : []),
  },
  {
    name: 'Scale Transitions',
    extract: (g) =>
      g.motionBehaviors.some((b) => b.includes('scale')) ? ['scale-transitions'] : [],
  },
];

/**
 * Analyze creative fatigue across all campaign genomes.
 */
export function detectCreativeFatigue(genomes: CreativeGenome[]): CreativeFatigueReport[] {
  const reports: CreativeFatigueReport[] = [];

  for (const dimension of FATIGUE_DIMENSIONS) {
    const matchingGenomes = genomes.filter((g) => dimension.extract(g).length > 0);
    const recentGenomes = matchingGenomes.slice(-5);
    const totalCount = matchingGenomes.length;
    const recentCount = recentGenomes.length;
    const percentage = genomes.length > 0 ? (totalCount / genomes.length) * 100 : 0;

    let usageLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (percentage > 40 || recentCount >= 3) usageLevel = 'HIGH';
    else if (percentage > 20 || recentCount >= 2) usageLevel = 'MEDIUM';

    let trend: 'INCREASING' | 'STABLE' | 'DECREASING' = 'STABLE';
    if (recentCount >= 3) trend = 'INCREASING';
    else if (recentCount === 0 && totalCount > 0) trend = 'DECREASING';

    reports.push({
      dimension: dimension.name,
      usageLevel,
      recentCount,
      totalCount,
      percentage: Math.round(percentage),
      trend,
    });
  }

  return reports;
}

/**
 * Get underused creative dimensions (opportunities).
 */
export function getUnderusedDimensions(reports: CreativeFatigueReport[]): string[] {
  return reports.filter((r) => r.usageLevel === 'LOW').map((r) => r.dimension);
}

/**
 * Get overused creative dimensions (fatigue).
 */
export function getOverusedDimensions(reports: CreativeFatigueReport[]): string[] {
  return reports.filter((r) => r.usageLevel === 'HIGH').map((r) => r.dimension);
}
