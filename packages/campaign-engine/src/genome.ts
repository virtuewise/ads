/**
 * Creative Genome System
 * Every completed concept receives a Creative Genome for intelligent comparison.
 */

import type { Concept, CreativeGenome } from '@printsync/shared';

/**
 * Generate a Creative Genome from a concept.
 * This captures the creative DNA of a concept for similarity detection.
 */
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
