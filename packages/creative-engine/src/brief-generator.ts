/**
 * Creative Brief Generator
 * Produces a full Creative Brief before script generation.
 */

import type { EnhancedCreativeBrief, Concept, CampaignObjective } from '@printsync/shared';

/**
 * Generate a complete Creative Brief from a winning concept.
 */
export function generateCreativeBrief(
  concept: Concept,
  objective: CampaignObjective = 'AWARENESS',
  audience: string = 'businesses needing premium print and branding solutions'
): EnhancedCreativeBrief {
  return {
    brand: 'PrintSync',
    objective,
    audience,
    service: extractService(concept),
    keyMessage: concept.logline,
    emotionalGoal: extractEmotionalGoal(concept),
    creativeConcept: concept.title,
    visualConcept: concept.key_visual,
    narrativeStructure: concept.narrative_structure,
    creativeMode: concept.creative_mode,
    voiceMode: mapVoiceMode(concept.voice_mode),
    platform: concept.formats,
    duration: concept.target_duration_seconds,
    cta: concept.cta,
    constraints: extractConstraints(concept),
  };
}

function extractService(concept: Concept): string {
  const text = `${concept.title} ${concept.logline} ${concept.story_summary}`.toLowerCase();
  if (text.includes('large format') || text.includes('banner')) return 'large-format-printing';
  if (text.includes('digital') || text.includes('digital print')) return 'digital-printing';
  if (text.includes('sign') || text.includes('signage')) return 'signage';
  if (text.includes('brand') || text.includes('branding')) return 'branding';
  if (text.includes('packag') || text.includes('box')) return 'packaging';
  if (text.includes('label') || text.includes('sticker')) return 'labels';
  if (text.includes('poster')) return 'posters';
  return 'custom-print-solutions';
}

function extractEmotionalGoal(concept: Concept): string {
  switch (concept.mood) {
    case 'dramatic': return 'awe and confidence';
    case 'playful': return 'amusement and interest';
    case 'technical': return 'confidence in precision';
    case 'minimal': return 'clarity and focus';
    case 'cinematic': return 'inspiration and desire';
    default: return 'confidence and trust';
  }
}

function mapVoiceMode(mode: string): 'VOICEOVER' | 'NO_VOICE' | 'DIALOGUE' | 'MUSIC_ONLY' {
  switch (mode) {
    case 'VOICEOVER': return 'VOICEOVER';
    case 'TYPOGRAPHY_ONLY': return 'NO_VOICE';
    case 'DIALOGUE': return 'DIALOGUE';
    case 'MUSIC_ONLY': return 'MUSIC_ONLY';
    default: return 'VOICEOVER';
  }
}

function extractConstraints(concept: Concept): string[] {
  const constraints: string[] = [];
  constraints.push('Must feel like PrintSync — precise, premium, technically capable');
  constraints.push('No generic corporate advertising');
  constraints.push('No stock photography or generic office imagery');
  if (concept.creative_mode === 'TYPOGRAPHY_ONLY') {
    constraints.push('Typography must be rendered deterministically');
  }
  if (concept.creative_mode === 'VFX_EXPERIMENT') {
    constraints.push('VFX must serve the story, not decorate it');
  }
  return constraints;
}
