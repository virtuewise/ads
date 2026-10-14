/**
 * Inlined Campaign Engine Functions
 * These functions are inlined from @printsync/campaign-engine to avoid module resolution issues.
 */

import type {
  Concept,
  CreativeFatigueReport,
  CreativeGenome,
  CreativeOpportunity,
  SimilarityResult,
} from '@printsync/shared';

// ─── Creative Genome ────────────────────────────────────────────────────────

export function generateCreativeGenome(concept: Concept): CreativeGenome {
  const text =
    `${concept.title} ${concept.logline} ${concept.key_visual} ${concept.story_summary}`.toLowerCase();

  return {
    narrative: concept.narrative_structure,
    creativeMode: concept.creative_mode,
    service: concept.story_summary.toLowerCase().includes('large format')
      ? 'large-format-printing'
      : concept.story_summary.toLowerCase().includes('digital')
        ? 'digital-printing'
        : concept.story_summary.toLowerCase().includes('sign')
          ? 'signage'
          : concept.story_summary.toLowerCase().includes('brand')
            ? 'branding'
            : concept.story_summary.toLowerCase().includes('packag')
              ? 'packaging'
              : 'custom-print-solutions',
    emotionalTone: extractEmotionalTone(text),
    visualTerritories: [concept.territory],
    typographyBehaviors: extractTypographyBehaviors(concept, text),
    motionBehaviors: extractMotionBehaviors(concept, text),
    transitionTypes: extractTransitionTypes(text),
    colorProfile: extractColorProfile(concept),
    cameraLanguage: extractCameraLanguage(text),
    soundLanguage: extractSoundLanguage(concept, text),
    narrativeStructure: concept.narrative_structure,
    visualMetaphors: extractVisualMetaphors(text),
    humorLevel: calculateHumorLevel(text),
    cinematicLevel: calculateCinematicLevel(concept, text),
    technicalLevel: calculateTechnicalLevel(concept, text),
    humanPresence: calculateHumanPresence(text),
    aiGenerationLevel: calculateAIGenerationLevel(concept),
  };
}

function extractEmotionalTone(text: string): string[] {
  const tones: string[] = [];
  if (text.includes('dramatic') || text.includes('epic')) tones.push('dramatic');
  if (text.includes('humor') || text.includes('funny') || text.includes('comedy'))
    tones.push('humorous');
  if (text.includes('technical') || text.includes('precision')) tones.push('technical');
  if (text.includes('minimal') || text.includes('clean')) tones.push('minimal');
  if (text.includes('playful') || text.includes('surprise')) tones.push('playful');
  if (text.includes('cinematic') || text.includes('film')) tones.push('cinematic');
  if (tones.length === 0) tones.push('neutral');
  return tones;
}

function extractTypographyBehaviors(concept: Concept, text: string): string[] {
  const behaviors: string[] = [];
  if (concept.visual_style === 'typography' || concept.creative_mode === 'TYPOGRAPHIC_FILM') {
    behaviors.push('TYPE-SLAM', 'TYPE-BUILD');
  }
  if (text.includes('explode') || text.includes('burst')) behaviors.push('TYPE-EXPLODE');
  if (text.includes('morph') || text.includes('transform')) behaviors.push('TYPE-MORPH');
  if (text.includes('scan') || text.includes('reveal')) behaviors.push('TYPE-SCAN');
  if (text.includes('slice') || text.includes('cut')) behaviors.push('TYPE-SLICE');
  if (text.includes('build') || text.includes('assemble')) behaviors.push('TYPE-BUILD');
  if (text.includes('slam') || text.includes('impact')) behaviors.push('TYPE-SLAM');
  if (behaviors.length === 0) behaviors.push('TYPE-REVEAL');
  return behaviors;
}

function extractMotionBehaviors(concept: Concept, text: string): string[] {
  const behaviors: string[] = [];
  if (concept.pace === 'fast_energetic') behaviors.push('rapid-cut');
  if (concept.pace === 'slow_premium') behaviors.push('slow-push');
  if (concept.pace === 'rhythmic') behaviors.push('mechanical-rhythm');
  if (text.includes('scale') || text.includes('grow')) behaviors.push('scale-transition');
  if (text.includes('transform') || text.includes('become')) behaviors.push('morph-transition');
  if (text.includes('wipe') || text.includes('slide')) behaviors.push('geometric-wipe');
  if (behaviors.length === 0) behaviors.push('standard-cut');
  return behaviors;
}

function extractTransitionTypes(text: string): string[] {
  const types: string[] = [];
  if (text.includes('match cut')) types.push('match-cut');
  if (text.includes('morph')) types.push('morph');
  if (text.includes('wipe')) types.push('wipe');
  if (text.includes('fade')) types.push('fade');
  if (text.includes('cut')) types.push('hard-cut');
  if (types.length === 0) types.push('standard');
  return types;
}

function extractColorProfile(concept: Concept): string[] {
  const profile: string[] = [];
  if (concept.mood === 'technical' || concept.mood === 'minimal')
    profile.push('monochrome', 'technical');
  if (concept.mood === 'dramatic') profile.push('high-contrast', 'dark');
  if (concept.mood === 'cinematic') profile.push('cinematic', 'graded');
  if (concept.mood === 'playful') profile.push('vibrant', 'colorful');
  if (profile.length === 0) profile.push('brand-standard');
  return profile;
}

function extractCameraLanguage(text: string): string[] {
  const language: string[] = [];
  if (text.includes('close-up') || text.includes('detail')) language.push('macro');
  if (text.includes('wide') || text.includes('establishing')) language.push('wide-shot');
  if (text.includes('aerial') || text.includes('drone')) language.push('aerial');
  if (text.includes('tracking') || text.includes('follow')) language.push('tracking');
  if (text.includes('static') || text.includes('locked')) language.push('static');
  if (language.length === 0) language.push('standard');
  return language;
}

function extractSoundLanguage(concept: Concept, text: string): string[] {
  const language: string[] = [];
  if (concept.voice_mode === 'VOICEOVER') language.push('voiceover');
  if (concept.voice_mode === 'MUSIC_ONLY') language.push('music-driven');
  if (concept.voice_mode === 'TYPOGRAPHY_ONLY') language.push('sfx-focused');
  if (text.includes('mechanical') || text.includes('machine')) language.push('mechanical-sfx');
  if (text.includes('impact') || text.includes('slam')) language.push('impact-sfx');
  if (language.length === 0) language.push('standard-score');
  return language;
}

function extractVisualMetaphors(text: string): string[] {
  const metaphors: string[] = [];
  if (text.includes('engine') || text.includes('machine')) metaphors.push('PRINT AS ENGINE');
  if (text.includes('architecture') || text.includes('building'))
    metaphors.push('PRINT AS ARCHITECTURE');
  if (text.includes('identity') || text.includes('brand')) metaphors.push('PRINT AS IDENTITY');
  if (text.includes('armor') || text.includes('protect')) metaphors.push('PRINT AS ARMOR');
  if (text.includes('language') || text.includes('speak')) metaphors.push('PRINT AS LANGUAGE');
  if (text.includes('memory') || text.includes('remember')) metaphors.push('PRINT AS MEMORY');
  if (text.includes('signal') || text.includes('visible')) metaphors.push('PRINT AS SIGNAL');
  if (text.includes('scale') || text.includes('grow')) metaphors.push('PRINT AS SCALE');
  if (text.includes('transform') || text.includes('become'))
    metaphors.push('PRINT AS TRANSFORMATION');
  if (text.includes('evidence') || text.includes('proof')) metaphors.push('PRINT AS EVIDENCE');
  if (text.includes('currency') || text.includes('value')) metaphors.push('PRINT AS CURRENCY');
  if (text.includes('story') || text.includes('narrative')) metaphors.push('PRINT AS STORY');
  if (text.includes('movement') || text.includes('motion')) metaphors.push('PRINT AS MOVEMENT');
  if (text.includes('connect') || text.includes('together')) metaphors.push('PRINT AS CONNECTION');
  if (text.includes('impact') || text.includes('force')) metaphors.push('PRINT AS IMPACT');
  if (metaphors.length === 0) metaphors.push('PRINT AS CRAFT');
  return metaphors;
}

function calculateHumorLevel(text: string): number {
  let level = 0;
  if (text.includes('funny') || text.includes('humor') || text.includes('comedy')) level += 3;
  if (text.includes('detective') || text.includes('case file')) level += 2;
  if (text.includes('joke') || text.includes('laugh')) level += 3;
  if (text.includes('playful') || text.includes('surprise')) level += 1;
  return Math.min(10, level);
}

function calculateCinematicLevel(concept: Concept, text: string): number {
  let level = 5;
  if (concept.mood === 'cinematic') level += 3;
  if (concept.mood === 'dramatic') level += 2;
  if (text.includes('film') || text.includes('cinematic')) level += 2;
  if (concept.pace === 'slow_premium') level += 1;
  return Math.min(10, level);
}

function calculateTechnicalLevel(concept: Concept, text: string): number {
  let level = 5;
  if (concept.mood === 'technical') level += 3;
  if (concept.territory === 'PRECISION') level += 2;
  if (text.includes('grid') || text.includes('data') || text.includes('measurement')) level += 2;
  if (concept.visual_style === 'typography') level += 1;
  return Math.min(10, level);
}

function calculateHumanPresence(text: string): number {
  let level = 3;
  if (text.includes('people') || text.includes('person') || text.includes('human')) level += 3;
  if (text.includes('business') || text.includes('customer')) level += 2;
  if (text.includes('hand') || text.includes('face')) level += 2;
  return Math.min(10, level);
}

function calculateAIGenerationLevel(concept: Concept): number {
  let level = 3;
  if (concept.creative_mode === 'VFX_EXPERIMENT') level += 4;
  if (concept.creative_mode === '3D_PRODUCT_FILM') level += 3;
  if (concept.visual_style === 'vfx') level += 2;
  if (concept.creative_mode === 'TYPOGRAPHIC_FILM') level -= 2;
  return Math.max(0, Math.min(10, level));
}

// ─── Creative Similarity ────────────────────────────────────────────────────

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
  service: 0.1,
  visualTerritory: 0.15,
  typography: 0.1,
  motion: 0.1,
  tone: 0.1,
  camera: 0.05,
  color: 0.05,
  transition: 0.05,
};

export function calculateCreativeSimilarity(
  a: CreativeGenome,
  b: CreativeGenome,
  weights: SimilarityWeights = DEFAULT_WEIGHTS,
): SimilarityResult {
  const details: Record<string, number> = {};

  details.creativeMode = a.creativeMode === b.creativeMode ? 1 : 0;
  details.narrativeStructure = a.narrativeStructure === b.narrativeStructure ? 1 : 0;
  details.service = a.service === b.service ? 1 : 0;

  const territoryA = new Set(a.visualTerritories);
  const territoryB = new Set(b.visualTerritories);
  const territoryIntersection = new Set([...territoryA].filter((x) => territoryB.has(x)));
  const territoryUnion = new Set([...territoryA, ...territoryB]);
  details.visualTerritory =
    territoryUnion.size > 0 ? territoryIntersection.size / territoryUnion.size : 0;

  const typoA = new Set(a.typographyBehaviors);
  const typoB = new Set(b.typographyBehaviors);
  const typoIntersection = new Set([...typoA].filter((x) => typoB.has(x)));
  const typoUnion = new Set([...typoA, ...typoB]);
  details.typography = typoUnion.size > 0 ? typoIntersection.size / typoUnion.size : 0;

  const motionA = new Set(a.motionBehaviors);
  const motionB = new Set(b.motionBehaviors);
  const motionIntersection = new Set([...motionA].filter((x) => motionB.has(x)));
  const motionUnion = new Set([...motionA, ...motionB]);
  details.motion = motionUnion.size > 0 ? motionIntersection.size / motionUnion.size : 0;

  const toneA = new Set(a.emotionalTone);
  const toneB = new Set(b.emotionalTone);
  const toneIntersection = new Set([...toneA].filter((x) => toneB.has(x)));
  const toneUnion = new Set([...toneA, ...toneB]);
  details.tone = toneUnion.size > 0 ? toneIntersection.size / toneUnion.size : 0;

  const cameraA = new Set(a.cameraLanguage);
  const cameraB = new Set(b.cameraLanguage);
  const cameraIntersection = new Set([...cameraA].filter((x) => cameraB.has(x)));
  const cameraUnion = new Set([...cameraA, ...cameraB]);
  details.camera = cameraUnion.size > 0 ? cameraIntersection.size / cameraUnion.size : 0;

  const colorA = new Set(a.colorProfile);
  const colorB = new Set(b.colorProfile);
  const colorIntersection = new Set([...colorA].filter((x) => colorB.has(x)));
  const colorUnion = new Set([...colorA, ...colorB]);
  details.color = colorUnion.size > 0 ? colorIntersection.size / colorUnion.size : 0;

  const transA = new Set(a.transitionTypes);
  const transB = new Set(b.transitionTypes);
  const transIntersection = new Set([...transA].filter((x) => transB.has(x)));
  const transUnion = new Set([...transA, ...transB]);
  details.transition = transUnion.size > 0 ? transIntersection.size / transUnion.size : 0;

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

// ─── Creative Fatigue ───────────────────────────────────────────────────────

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

export function getUnderusedDimensions(reports: CreativeFatigueReport[]): string[] {
  return reports.filter((r) => r.usageLevel === 'LOW').map((r) => r.dimension);
}

export function getOverusedDimensions(reports: CreativeFatigueReport[]): string[] {
  return reports.filter((r) => r.usageLevel === 'HIGH').map((r) => r.dimension);
}

// ─── Creative Opportunities ─────────────────────────────────────────────────

export function identifyCreativeOpportunities(
  genomes: CreativeGenome[],
  fatigueReports: CreativeFatigueReport[],
  availableServices: string[],
): CreativeOpportunity[] {
  const underused = getUnderusedDimensions(fatigueReports);
  const _overused = getOverusedDimensions(fatigueReports);
  void _overused;
  const opportunities: CreativeOpportunity[] = [];

  const underusedServices = availableServices.filter(
    (service) => !genomes.some((g) => g.service === service),
  );

  const allTerritories = ['PRECISION', 'TRANSFORMATION', 'SCALE', 'HUMAN_IMPACT', 'PLAY'];
  const usedTerritories = new Set(genomes.map((g) => g.visualTerritories[0]));
  const underusedTerritories = allTerritories.filter((t) => !usedTerritories.has(t));

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
  if (!genomes.some((g) => g.service === service)) confidence += 15;
  if (!genomes.some((g) => g.visualTerritories.includes(territory))) confidence += 10;
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
  if (!genomes.some((g) => g.service === service)) novelty += 20;
  if (!genomes.some((g) => g.visualTerritories.includes(territory))) novelty += 15;
  if (!genomes.some((g) => g.narrativeStructure === narrative)) novelty += 5;
  return Math.min(100, novelty);
}

function calculateBrandFit(territory: string, narrative: string): number {
  let fit = 80;
  if (territory === 'PRECISION' || territory === 'TRANSFORMATION') fit += 10;
  if (territory === 'SCALE') fit += 5;
  if (narrative === 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT') fit += 5;
  if (narrative === 'CHAOS_PRECISION_CONTROL_RESULT') fit += 5;
  return Math.min(100, fit);
}
