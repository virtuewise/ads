/**
 * Anti-Generic Engine V2
 * Multi-layer detection system for generic, templated, or repetitive creative.
 */

import type { AntiGenericReport, Concept, CreativeHistoryEntry } from '@printsync/shared';

interface DetectionLayer {
  name: string;
  detect: (concept: Concept, history: CreativeHistoryEntry[]) => string[];
}

const DETECTION_LAYERS: DetectionLayer[] = [
  {
    name: 'Structural Detection',
    detect: (concept) => {
      const issues: string[] = [];
      const text =
        `${concept.title} ${concept.logline} ${concept.key_visual} ${concept.story_summary}`.toLowerCase();

      if (text.includes('quality') && text.includes('service'))
        issues.push('generic service messaging');
      if (text.includes('innovation') || text.includes('excellence'))
        issues.push('empty buzzwords');
      if (text.includes('we provide') || text.includes('we offer'))
        issues.push('generic corporate opening');
      if (text.includes('contact us') && text.length < 100) issues.push('generic CTA');
      if (concept.key_visual.length < 30) issues.push('weak visual concept');
      if (concept.story_summary.length < 50) issues.push('thin narrative');

      return issues;
    },
  },
  {
    name: 'Creative Similarity',
    detect: (concept, history) => {
      const issues: string[] = [];
      const recentSimilar = history.filter(
        (h) => h.creative_mode === concept.creative_mode && h.territory === concept.territory,
      ).length;

      if (recentSimilar >= 3) issues.push('overused creative mode + territory combination');
      if (recentSimilar >= 2) issues.push('recently used similar approach');

      return issues;
    },
  },
  {
    name: 'Concept Originality',
    detect: (concept) => {
      const issues: string[] = [];
      const text = `${concept.title} ${concept.logline} ${concept.key_visual}`.toLowerCase();

      const hasMetaphor = [
        'becomes',
        'transforms',
        'like',
        'as if',
        'journey',
        'engine',
        'architecture',
      ].some((m) => text.includes(m));
      const hasTransition = ['match cut', 'morph', 'transform', 'transition', 'becomes'].some((t) =>
        text.includes(t),
      );
      const hasScale = ['tiny', 'enormous', 'massive', 'scale', 'building'].some((s) =>
        text.includes(s),
      );
      const hasTypography =
        concept.visual_style === 'typography' || concept.creative_mode === 'TYPOGRAPHIC_FILM';
      const hasHumor = ['funny', 'humor', 'joke', 'comedy', 'detective'].some((h) =>
        text.includes(h),
      );
      const hasVFX = ['particle', 'explode', 'glitch', 'vfx', 'effect'].some((v) =>
        text.includes(v),
      );

      if (!hasMetaphor && !hasTransition && !hasScale && !hasTypography && !hasHumor && !hasVFX) {
        issues.push('lacks creative device');
      }

      return issues;
    },
  },
  {
    name: 'Visual Distinctiveness',
    detect: (concept) => {
      const issues: string[] = [];
      const text = `${concept.title} ${concept.logline} ${concept.key_visual}`.toLowerCase();

      if (text.includes('printer') && !text.includes('precision') && !text.includes('engine')) {
        issues.push('generic printer imagery');
      }
      if (text.includes('office') && !text.includes('brand') && !text.includes('print')) {
        issues.push('generic office setting');
      }

      return issues;
    },
  },
  {
    name: 'Brand Signature',
    detect: (concept) => {
      const issues: string[] = [];
      const text =
        `${concept.title} ${concept.logline} ${concept.key_visual} ${concept.story_summary}`.toLowerCase();

      const hasPrintSyncSignature = [
        'precision',
        'print',
        'brand',
        'sign',
        'label',
        'packag',
        'poster',
        'banner',
        'display',
        'format',
        'cmyk',
        'registration',
      ].some((s) => text.includes(s));

      if (!hasPrintSyncSignature) {
        issues.push('lacks PrintSync brand signature');
      }

      return issues;
    },
  },
];

/**
 * Run multi-layer anti-generic analysis.
 */
export function analyzeAntiGeneric(
  concept: Concept,
  history: CreativeHistoryEntry[],
): AntiGenericReport {
  const allIssues: string[] = [];
  const layerResults: Record<string, string[]> = {};

  for (const layer of DETECTION_LAYERS) {
    const issues = layer.detect(concept, history);
    layerResults[layer.name] = issues;
    allIssues.push(...issues);
  }

  // Calculate scores
  const genericityScore = Math.min(100, allIssues.length * 15);
  const originalityScore = Math.max(0, 100 - allIssues.length * 20);
  const distinctivenessScore = Math.max(
    0,
    100 - (layerResults['Visual Distinctiveness']?.length ?? 0) * 25,
  );
  const brandSpecificityScore = Math.max(
    0,
    100 - (layerResults['Brand Signature']?.length ?? 0) * 30,
  );

  // Competitor test
  const competitorTest = runCompetitorTest(concept);

  // Determine verdict
  let verdict: 'PASS' | 'REWORK' | 'REJECT' = 'PASS';
  if (genericityScore > 60 || !competitorTest.passes) verdict = 'REJECT';
  else if (genericityScore > 30 || allIssues.length > 2) verdict = 'REWORK';

  // Generate recommendations
  const recommendations = generateRecommendations(allIssues, layerResults);

  return {
    genericityScore,
    originalityScore,
    distinctivenessScore,
    brandSpecificityScore,
    detectedPatterns: allIssues,
    recommendations,
    verdict,
    competitorTest,
  };
}

/**
 * The "Could a competitor use this?" test.
 * If replacing the PrintSync logo with another printing company's logo
 * would still make the advertisement work, the concept is insufficiently brand-specific.
 */
function runCompetitorTest(concept: Concept): { passes: boolean; issues: string[] } {
  const issues: string[] = [];
  const text =
    `${concept.title} ${concept.logline} ${concept.key_visual} ${concept.story_summary}`.toLowerCase();

  // Check for PrintSync-specific elements
  const hasPrintSyncSpecifics = [
    'printsync',
    'precision',
    'cmyk',
    'registration',
    'large format',
    'digital print',
    'signage',
    'branding',
    'packaging',
  ].some((s) => text.includes(s));

  if (!hasPrintSyncSpecifics) {
    issues.push('No PrintSync-specific services or capabilities mentioned');
  }

  // Check for generic visual language
  const hasGenericVisuals = [
    'office',
    'handshake',
    'meeting',
    'laptop',
    'coffee',
    'smiling',
    'team',
    'collaboration',
  ].some((v) => text.includes(v));

  if (hasGenericVisuals) {
    issues.push('Uses generic visual language that any competitor could use');
  }

  // Check for distinctive creative devices
  const hasDistinctiveDevice = [
    'typography',
    'kinetic',
    'metaphor',
    'transformation',
    'scale',
    'detective',
    'humor',
    'vfx',
    'particle',
    'explode',
  ].some((d) => text.includes(d));

  if (!hasDistinctiveDevice) {
    issues.push('Lacks distinctive creative device that would be associated with PrintSync');
  }

  return {
    passes: issues.length === 0,
    issues,
  };
}

function generateRecommendations(
  issues: string[],
  layerResults: Record<string, string[]>,
): string[] {
  const recommendations: string[] = [];

  if (issues.includes('generic service messaging')) {
    recommendations.push('Replace generic service messaging with specific PrintSync capabilities');
  }
  if (issues.includes('empty buzzwords')) {
    recommendations.push('Remove empty buzzwords and replace with concrete proof points');
  }
  if (issues.includes('overused creative mode + territory combination')) {
    recommendations.push('Vary the creative mode or territory from recent campaigns');
  }
  if (issues.includes('lacks creative device')) {
    recommendations.push(
      'Introduce a creative device: metaphor, transition, scale, typography, or humor',
    );
  }
  if (issues.includes('generic printer imagery')) {
    recommendations.push('Replace generic printer imagery with PrintSync-specific visual language');
  }
  if (issues.includes('lacks PrintSync brand signature')) {
    recommendations.push(
      'Add PrintSync-specific elements: precision, print physics, technical graphics',
    );
  }
  if ((layerResults['Brand Signature']?.length ?? 0) > 0) {
    recommendations.push('Strengthen brand-specific elements to pass the competitor test');
  }

  if (recommendations.length === 0) {
    recommendations.push('Concept passes all anti-generic checks');
  }

  return recommendations;
}
