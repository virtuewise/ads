/**
 * Creative Opportunity Engine
 * Analyzes recent campaigns and identifies creative gaps and opportunities.
 */

import type { CreativeFatigueReport, CreativeGenome, CreativeOpportunity } from '@printsync/shared';
import { getOverusedDimensions, getUnderusedDimensions } from './fatigue.js';

void (0 as unknown as {
  service: string;
  territory: string;
  narrative: string;
  mode: string;
  confidence: number;
  novelty: number;
  brandFit: number;
  reasoning: string;
  fatigueDimensions: string[];
});

/**
 * Analyze campaign history and identify creative opportunities.
 */
export function identifyCreativeOpportunities(
  genomes: CreativeGenome[],
  fatigueReports: CreativeFatigueReport[],
  availableServices: string[],
): CreativeOpportunity[] {
  const underused = getUnderusedDimensions(fatigueReports);
  const _overused = getOverusedDimensions(fatigueReports);
  void _overused;
  const opportunities: CreativeOpportunity[] = [];

  // Find services that are underused
  const underusedServices = availableServices.filter(
    (service) => !genomes.some((g) => g.service === service),
  );

  // Find territories that are underused
  const allTerritories = ['PRECISION', 'TRANSFORMATION', 'SCALE', 'HUMAN_IMPACT', 'PLAY'];
  const usedTerritories = new Set(genomes.map((g) => g.visualTerritories[0]));
  const underusedTerritories = allTerritories.filter((t) => !usedTerritories.has(t));

  // Find narrative structures that are underused
  const allNarratives = [
    'PROBLEM_TENSION_DISCOVERY_TRANSFORMATION_PROOF_BRAND',
    'MYSTERY_CLUE_INVESTIGATION_REVEAL_PRODUCT_CTA',
    'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
    'CHAOS_PRECISION_CONTROL_RESULT',
    'BORING_PRINTSYNC_TRANSFORMATION',
    'DIGITAL_PHYSICAL_EXPERIENCE',
  ];
  const usedNarratives = new Set(genomes.map((g) => g.narrativeStructure));
  const underusedNarratives = allNarratives.filter((n) => !usedNarratives.has(n));

  // Generate opportunities based on underused dimensions
  for (const service of underusedServices.slice(0, 3)) {
    const territory =
      underusedTerritories[Math.floor(Math.random() * underusedTerritories.length)] ??
      'TRANSFORMATION';
    const narrative =
      underusedNarratives[Math.floor(Math.random() * underusedNarratives.length)] ??
      'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT';
    const mode = selectModeForTerritory(territory);

    const confidence = calculateConfidence(service, territory, narrative, genomes);
    const novelty = calculateNovelty(service, territory, narrative, genomes);
    const brandFit = calculateBrandFit(territory, narrative);

    opportunities.push({
      service,
      territory,
      narrative,
      mode,
      confidence,
      novelty,
      brandFit,
      reasoning: `Service "${service}" has not been recently active. Territory "${territory}" is underused. Narrative "${narrative}" offers fresh perspective.`,
      fatigueDimensions: [...underused.slice(0, 3)],
    });
  }

  // Generate opportunities based on fatigue dimensions
  for (const dimension of underused.slice(0, 3)) {
    const service =
      availableServices[Math.floor(Math.random() * availableServices.length)] ?? 'branding';
    const territory = allTerritories[Math.floor(Math.random() * allTerritories.length)] ?? 'PLAY';
    const narrative =
      allNarratives[Math.floor(Math.random() * allNarratives.length)] ??
      'CHAOS_PRECISION_CONTROL_RESULT';
    const mode = selectModeForTerritory(territory);

    const confidence = calculateConfidence(service, territory, narrative, genomes) * 0.9;
    const novelty = calculateNovelty(service, territory, narrative, genomes) * 1.1;
    const brandFit = calculateBrandFit(territory, narrative);

    opportunities.push({
      service,
      territory,
      narrative,
      mode,
      confidence: Math.min(100, Math.round(confidence)),
      novelty: Math.min(100, Math.round(novelty)),
      brandFit,
      reasoning: `Dimension "${dimension}" is underused. This opportunity addresses creative fatigue.`,
      fatigueDimensions: [dimension],
    });
  }

  // Sort by confidence and return top opportunities
  return opportunities.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

function selectModeForTerritory(territory: string): string {
  const modeMap: Record<string, string> = {
    PRECISION: 'TYPOGRAPHIC_FILM',
    TRANSFORMATION: 'TRANSFORMATION_AD',
    SCALE: 'CINEMATIC_BRAND_FILM',
    HUMAN_IMPACT: 'STORY_AD',
    PLAY: 'HUMOR_AD',
  };
  return modeMap[territory] ?? 'CINEMATIC_BRAND_FILM';
}

function calculateConfidence(
  service: string,
  territory: string,
  narrative: string,
  genomes: CreativeGenome[],
): number {
  let confidence = 70;

  // Boost if service is completely unused
  if (!genomes.some((g) => g.service === service)) confidence += 15;

  // Boost if territory is unused
  if (!genomes.some((g) => g.visualTerritories.includes(territory))) confidence += 10;

  // Boost if narrative is unused
  if (!genomes.some((g) => g.narrativeStructure === narrative)) confidence += 5;

  return Math.min(100, confidence);
}

function calculateNovelty(
  service: string,
  territory: string,
  narrative: string,
  genomes: CreativeGenome[],
): number {
  let novelty = 60;

  // Boost if service is completely unused
  if (!genomes.some((g) => g.service === service)) novelty += 20;

  // Boost if territory is unused
  if (!genomes.some((g) => g.visualTerritories.includes(territory))) novelty += 15;

  // Boost if narrative is unused
  if (!genomes.some((g) => g.narrativeStructure === narrative)) novelty += 5;

  return Math.min(100, novelty);
}

function calculateBrandFit(territory: string, narrative: string): number {
  let fit = 80;

  // Territories that align well with PrintSync brand
  if (territory === 'PRECISION' || territory === 'TRANSFORMATION') fit += 10;
  if (territory === 'SCALE') fit += 5;

  // Narratives that align well with PrintSync brand
  if (narrative === 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT') fit += 5;
  if (narrative === 'CHAOS_PRECISION_CONTROL_RESULT') fit += 5;

  return Math.min(100, fit);
}
