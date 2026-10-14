/**
 * Concept Seed Matrix
 * Generates concepts across deliberately different creative territories.
 * Service × Audience × Emotion × Narrative × Visual Metaphor × Creative Mode
 */

import type {
  Concept,
  CreativeMode,
  CreativeTerritory,
  Mood,
  NarrativeStructure,
  Pace,
  VisualStyle,
  VoiceMode,
} from '@printsync/shared';
import { VISUAL_METAPHORS } from './metaphors.js';

interface ConceptSeed {
  service: string;
  audience: string;
  emotion: string;
  narrative: NarrativeStructure;
  metaphor: string;
  mode: CreativeMode;
  territory: CreativeTerritory;
  mood: Mood;
  visualStyle: VisualStyle;
  pace: Pace;
  voiceMode: VoiceMode;
}

const SERVICES = [
  'large-format-printing',
  'digital-printing',
  'signage',
  'branding',
  'packaging',
  'labels',
  'posters',
  'banners',
  'commercial-printing',
  'finishing',
];

const AUDIENCES = [
  'small business owners',
  'marketing managers',
  'brand managers',
  'retail businesses',
  'event organizers',
  'healthcare facilities',
  'construction companies',
  'restaurant owners',
];

const EMOTIONS = [
  'confidence',
  'ambition',
  'trust',
  'excitement',
  'curiosity',
  'pride',
  'security',
  'inspiration',
];

/**
 * Generate 10 deliberately diverse concept seeds.
 */
export function generateConceptSeeds(count: number = 10): ConceptSeed[] {
  const seeds: ConceptSeed[] = [];
  const usedCombinations = new Set<string>();

  for (let i = 0; i < count; i++) {
    const seed = generateDiverseSeed(i, usedCombinations);
    seeds.push(seed);
    usedCombinations.add(`${seed.service}-${seed.territory}-${seed.mode}`);
  }

  return seeds;
}

function generateDiverseSeed(index: number, _usedCombinations: Set<string>): ConceptSeed {
  // Rotate through different creative territories
  const territories: CreativeTerritory[] = [
    'PRECISION',
    'TRANSFORMATION',
    'SCALE',
    'HUMAN_IMPACT',
    'PLAY',
  ];
  const territory = territories[index % territories.length]!;

  // Select service based on territory
  const service = selectServiceForTerritory(territory, index);

  // Select mode based on territory
  const mode = selectModeForTerritory(territory, index);

  // Select narrative
  const narratives: NarrativeStructure[] = [
    'PROBLEM_TENSION_DISCOVERY_TRANSFORMATION_PROOF_BRAND',
    'MYSTERY_CLUE_INVESTIGATION_REVEAL_PRODUCT_CTA',
    'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
    'CHAOS_PRECISION_CONTROL_RESULT',
    'BORING_PRINTSYNC_TRANSFORMATION',
    'DIGITAL_PHYSICAL_EXPERIENCE',
  ];
  const narrative = narratives[index % narratives.length]!;

  // Select metaphor
  const metaphors = VISUAL_METAPHORS.filter((m) => m.territories.includes(territory));
  const metaphor = (metaphors[index % metaphors.length] ?? VISUAL_METAPHORS[0]!).name;

  // Select mood based on territory
  const mood = selectMoodForTerritory(territory);

  // Select visual style
  const visualStyle = selectVisualStyleForMode(mode);

  // Select pace
  const pace = selectPaceForMode(mode);

  // Select voice mode
  const voiceMode = selectVoiceModeForMode(mode);

  // Select audience
  const audience = AUDIENCES[index % AUDIENCES.length]!;

  // Select emotion
  const emotion = EMOTIONS[index % EMOTIONS.length]!;

  return {
    service,
    audience,
    emotion,
    narrative,
    metaphor,
    mode,
    territory,
    mood,
    visualStyle,
    pace,
    voiceMode,
  };
}

function selectServiceForTerritory(territory: CreativeTerritory, index: number): string {
  const serviceMap: Record<CreativeTerritory, string[]> = {
    PRECISION: ['digital-printing', 'labels', 'finishing'],
    TRANSFORMATION: ['digital-printing', 'packaging', 'branding'],
    SCALE: ['large-format-printing', 'posters', 'banners'],
    HUMAN_IMPACT: ['branding', 'signage', 'corporate-stationery'],
    PLAY: ['packaging', 'stickers', 'posters'],
  };
  const services = serviceMap[territory] ?? SERVICES;
  return services[index % services.length] ?? 'branding';
}

function selectModeForTerritory(territory: CreativeTerritory, index: number): CreativeMode {
  const modeMap: Record<CreativeTerritory, CreativeMode[]> = {
    PRECISION: ['TYPOGRAPHIC_FILM', 'TYPOGRAPHY_ONLY', 'INFOGRAPHIC'],
    TRANSFORMATION: ['TRANSFORMATION_AD', 'BEFORE_AFTER', 'CINEMATIC_BRAND_FILM'],
    SCALE: ['CINEMATIC_BRAND_FILM', 'VFX_EXPERIMENT', '3D_PRODUCT_FILM'],
    HUMAN_IMPACT: ['STORY_AD', 'TESTIMONIAL', 'CASE_STUDY'],
    PLAY: ['HUMOR_AD', 'DETECTIVE_AD', 'EDUCATIONAL_AD'],
  };
  const modes = modeMap[territory] ?? [];
  return modes[index % modes.length] ?? 'CINEMATIC_BRAND_FILM';
}

function selectMoodForTerritory(territory: CreativeTerritory): Mood {
  const moodMap: Record<CreativeTerritory, Mood> = {
    PRECISION: 'technical',
    TRANSFORMATION: 'dramatic',
    SCALE: 'dramatic',
    HUMAN_IMPACT: 'minimal',
    PLAY: 'playful',
  };
  return moodMap[territory] ?? 'minimal';
}

function selectVisualStyleForMode(mode: CreativeMode): VisualStyle {
  if (mode === 'TYPOGRAPHIC_FILM' || mode === 'TYPOGRAPHY_ONLY') return 'typography';
  if (mode === 'VFX_EXPERIMENT' || mode === '3D_PRODUCT_FILM') return 'vfx';
  if (mode === 'STORY_AD' || mode === 'TESTIMONIAL') return 'live_action';
  if (mode === 'INFOGRAPHIC' || mode === 'EDUCATIONAL_AD') return 'typography';
  return 'mixed';
}

function selectPaceForMode(mode: CreativeMode): Pace {
  if (mode === 'HUMOR_AD' || mode === 'VFX_EXPERIMENT') return 'fast_energetic';
  if (mode === 'CINEMATIC_BRAND_FILM' || mode === 'STORY_AD') return 'slow_premium';
  return 'rhythmic';
}

function selectVoiceModeForMode(mode: CreativeMode): VoiceMode {
  if (mode === 'TYPOGRAPHIC_FILM' || mode === 'TYPOGRAPHY_ONLY') return 'TYPOGRAPHY_ONLY';
  if (mode === 'VFX_EXPERIMENT' || mode === '3D_PRODUCT_FILM') return 'MUSIC_ONLY';
  if (mode === 'HUMOR_AD' || mode === 'DETECTIVE_AD') return 'DIALOGUE';
  return 'VOICEOVER';
}

/**
 * Convert a concept seed to a full concept.
 */
export function seedToConcept(seed: ConceptSeed, index: number): Concept {
  return {
    id: `concept_${Date.now()}_${index}`,
    title: generateTitle(seed, index),
    logline: generateLogline(seed),
    creative_mode: seed.mode,
    narrative_structure: seed.narrative,
    territory: seed.territory,
    mood: seed.mood,
    visual_style: seed.visualStyle,
    pace: seed.pace,
    voice_mode: seed.voiceMode,
    key_visual: generateKeyVisual(seed),
    story_summary: generateStorySummary(seed),
    target_duration_seconds: estimateDuration(seed.mode),
    formats: ['16:9', '9:16', '1:1'],
    cta: generateCTA(seed, index),
  };
}

function generateTitle(seed: ConceptSeed, index: number): string {
  const titles: Record<string, string[]> = {
    'PRINT AS ARCHITECTURE': ['BUILT TO BE NOTICED', 'PRINT BECOMES PLACE'],
    'PRINT AS ENGINE': ['THE PRINT ENGINE', 'PRECISION IN MOTION'],
    'PRINT AS IDENTITY': ['BRAND WITH PRECISION', 'IDENTITY THAT WORKS'],
    'PRINT AS ARMOR': ['PROTECTED BY PRINT', 'STRENGTH IN EVERY LAYER'],
    'PRINT AS LANGUAGE': ['PRINT SPEAKS', 'THE LANGUAGE OF BRAND'],
    'PRINT AS MEMORY': ['PRINTED TO LAST', 'MEMORY IN MATERIAL'],
    'PRINT AS SIGNAL': ['IMPOSSIBLE TO IGNORE', 'THE SIGNAL THAT WORKS'],
    'PRINT AS SCALE': ['BIG IDEAS NEED BIG PRINT', 'FROM CARD TO CITY'],
    'PRINT AS TRANSFORMATION': ['FROM IDEA TO IMPACT', 'TRANSFORMED BY PRINT'],
    'PRINT AS EVIDENCE': ['PROOF IN PRINT', 'EVIDENCE OF QUALITY'],
    'PRINT AS CURRENCY': ['PRINT THAT PAYS', 'VALUE IN EVERY SHEET'],
    'PRINT AS STORY': ['THE STORY PRINT TELLS', 'NARRATIVE IN MATERIAL'],
    'PRINT AS MOVEMENT': ['PRINT IN MOTION', 'DYNAMIC BY DESIGN'],
    'PRINT AS CONNECTION': ['CONNECTED BY PRINT', 'THE BRIDGE THAT PRINTS'],
    'PRINT AS IMPACT': ['IMPACT IN PRINT', 'FORCE OF BRAND'],
  };
  const options = titles[seed.metaphor] ?? ['PRINTSYNC PRECISION'];
  return options[index % options.length] ?? 'PRINTSYNC PRECISION';
}

function generateLogline(seed: ConceptSeed): string {
  return `${seed.metaphor.toLowerCase()} — ${seed.emotion} for ${seed.audience}.`;
}

function generateKeyVisual(seed: ConceptSeed): string {
  const metaphor = VISUAL_METAPHORS.find((m) => m.name === seed.metaphor);
  return metaphor?.visualDescription ?? 'PrintSync precision in action.';
}

function generateStorySummary(seed: ConceptSeed): string {
  return `A ${seed.mood} ${seed.narrative.toLowerCase().replace(/_/g, ' ')} showing how PrintSync ${seed.service.replace(/-/g, ' ')} delivers ${seed.emotion} for ${seed.audience}.`;
}

function estimateDuration(mode: CreativeMode): number {
  if (mode === 'TYPOGRAPHIC_FILM' || mode === 'TYPOGRAPHY_ONLY') return 20;
  if (mode === 'CINEMATIC_BRAND_FILM' || mode === 'STORY_AD') return 30;
  if (mode === 'VFX_EXPERIMENT') return 20;
  if (mode === 'HUMOR_AD' || mode === 'DETECTIVE_AD') return 30;
  return 30;
}

function generateCTA(_seed: ConceptSeed, index: number): string {
  const ctas = [
    'Start your project',
    'Get a quote',
    'Transform your brand',
    'Go big with PrintSync',
    'Engineer your brand',
  ];
  return ctas[index % ctas.length] ?? 'Start your project';
}
