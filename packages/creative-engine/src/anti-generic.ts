/**
 * Anti-Generic Engine
 * Detects and prevents generic, templated, or repetitive creative.
 */

import type { AntiGenericCheck, Concept, CreativeHistoryEntry } from '@printsync/shared';

export interface GenericPattern {
  name: string;
  description: string;
  indicators: string[];
  weight: number;
}

const _GENERIC_PATTERNS: GenericPattern[] = [
  {
    name: 'canva_template',
    description: 'Looks like a Canva template',
    indicators: ['centered text', 'stock photo background', 'generic gradient', 'decorative shapes'],
    weight: 10,
  },
  {
    name: 'shutterstock',
    description: 'Looks like stock photography',
    indicators: ['generic office', 'handshake', 'smiling business people', 'generic cityscape'],
    weight: 10,
  },
  {
    name: 'generic_ai_corporate',
    description: 'Looks like generic AI corporate video',
    indicators: ['uncanny humans', 'inconsistent lighting', 'morphing artifacts', 'generic transitions'],
    weight: 15,
  },
  {
    name: 'generic_marketing_agency',
    description: 'Looks like generic marketing agency output',
    indicators: ['buzzword slides', 'generic charts', 'stock icons', 'template layout'],
    weight: 8,
  },
  {
    name: 'generic_printing_company',
    description: 'Looks like generic printing company',
    indicators: ['just a printer', 'paper stack', 'ink cartridges', 'generic print shop'],
    weight: 8,
  },
  {
    name: 'repetitive_composition',
    description: 'Repetitive composition pattern',
    indicators: ['same layout as previous', 'same color scheme', 'same typography style', 'same structure'],
    weight: 12,
  },
];
void _GENERIC_PATTERNS; // Reserved for future use

export function checkAntiGeneric(
  concept: Concept,
  history: CreativeHistoryEntry[]
): AntiGenericCheck {
  const issues: string[] = [];

  // Check for generic indicators in concept
  const conceptText = `${concept.title} ${concept.logline} ${concept.key_visual} ${concept.story_summary}`.toLowerCase();

  // Check for generic patterns
  const looks_canva = checkCanvaIndicators(conceptText);
  const looks_shutterstock = checkShutterstockIndicators(conceptText);
  const looks_generic_ai = checkGenericAIIndicators(conceptText);
  const looks_generic_marketing = checkGenericMarketingIndicators(conceptText);
  const looks_generic_printing = checkGenericPrintingIndicators(conceptText);

  // Check for repetition against history
  const looks_already_produced = checkRepetition(concept, history);

  // Check for strong creative elements
  const has_strong_visual_idea = checkStrongVisualIdea(concept);
  const has_metaphor = checkMetaphor(conceptText);
  const has_unexpected_transition = checkUnexpectedTransition(conceptText);
  const has_unusual_scale = checkUnusualScale(conceptText);
  const has_kinetic_typography = checkKineticTypography(concept);
  const has_graphic_information_system = checkGraphicInformationSystem(conceptText);
  const has_humour_mechanism = checkHumourMechanism(conceptText);
  const has_vfx_idea = checkVFXIdea(conceptText);
  const has_storytelling_device = checkStorytellingDevice(concept);

  // Collect issues
  if (looks_canva) issues.push('Concept shows Canva template indicators');
  if (looks_shutterstock) issues.push('Concept shows stock photography indicators');
  if (looks_generic_ai) issues.push('Concept shows generic AI corporate video indicators');
  if (looks_generic_marketing) issues.push('Concept shows generic marketing agency indicators');
  if (looks_generic_printing) issues.push('Concept shows generic printing company indicators');
  if (looks_already_produced) issues.push('Concept is too similar to previously produced campaigns');
  if (!has_strong_visual_idea) issues.push('Concept lacks a strong visual idea');
  if (!has_metaphor && !has_unexpected_transition && !has_unusual_scale && !has_kinetic_typography && !has_graphic_information_system && !has_humour_mechanism && !has_vfx_idea && !has_storytelling_device) {
    issues.push('Concept lacks any creative device (metaphor, transition, scale, typography, information system, humour, VFX, or storytelling)');
  }

  const passed = issues.length === 0;

  return {
    looks_canva,
    looks_shutterstock,
    looks_generic_ai_corporate: looks_generic_ai,
    looks_generic_marketing_agency: looks_generic_marketing,
    looks_generic_printing_company: looks_generic_printing,
    looks_like_competitor: false, // Would need competitor analysis
    looks_already_produced,
    has_strong_visual_idea,
    has_metaphor,
    has_unexpected_transition,
    has_unusual_scale,
    has_kinetic_typography,
    has_graphic_information_system,
    has_humour_mechanism,
    has_vfx_idea,
    has_storytelling_device,
    passed,
    issues,
  };
}

function checkCanvaIndicators(text: string): boolean {
  const indicators = ['centered', 'gradient', 'decorative', 'template', 'stock'];
  return indicators.some(i => text.includes(i));
}

function checkShutterstockIndicators(text: string): boolean {
  const indicators = ['handshake', 'office meeting', 'smiling', 'team collaboration', 'business people'];
  return indicators.some(i => text.includes(i));
}

function checkGenericAIIndicators(text: string): boolean {
  const indicators = ['uncanny', 'morphing', 'inconsistent', 'artifact', 'generic transition'];
  return indicators.some(i => text.includes(i));
}

function checkGenericMarketingIndicators(text: string): boolean {
  const indicators = ['buzzword', 'synergy', 'leverage', 'paradigm', 'disrupt'];
  return indicators.some(i => text.includes(i));
}

function checkGenericPrintingIndicators(text: string): boolean {
  const indicators = ['just a printer', 'paper stack', 'ink cartridge', 'print shop'];
  return indicators.some(i => text.includes(i));
}

function checkRepetition(concept: Concept, history: CreativeHistoryEntry[]): boolean {
  if (history.length === 0) return false;

  const recentCampaigns = history.slice(-5);
  return recentCampaigns.some(c =>
    c.creative_mode === concept.creative_mode &&
    c.territory === concept.territory &&
    c.mood === concept.mood
  );
}

function checkStrongVisualIdea(concept: Concept): boolean {
  return concept.key_visual.length > 20 && concept.key_visual !== concept.title;
}

function checkMetaphor(text: string): boolean {
  const indicators = ['becomes', 'transforms', 'metaphor', 'like a', 'as if', 'journey', 'evolution'];
  return indicators.some(i => text.includes(i));
}

function checkUnexpectedTransition(text: string): boolean {
  const indicators = ['match cut', 'morph', 'transform', 'transition', 'becomes', 'shifts'];
  return indicators.some(i => text.includes(i));
}

function checkUnusualScale(text: string): boolean {
  const indicators = ['tiny', 'enormous', 'massive', 'scale', 'building', 'card to', 'poster to'];
  return indicators.some(i => text.includes(i));
}

function checkKineticTypography(concept: Concept): boolean {
  return concept.visual_style === 'typography' || concept.creative_mode === 'TYPOGRAPHIC_FILM' || concept.creative_mode === 'TYPOGRAPHY_ONLY';
}

function checkGraphicInformationSystem(text: string): boolean {
  const indicators = ['grid', 'data', 'measurement', 'coordinate', 'technical', 'cmYK', 'registration'];
  return indicators.some(i => text.includes(i));
}

function checkHumourMechanism(text: string): boolean {
  const indicators = ['funny', 'humor', 'joke', 'comedy', 'detective', 'case file', 'investigation'];
  return indicators.some(i => text.includes(i));
}

function checkVFXIdea(text: string): boolean {
  const indicators = ['particle', 'explode', 'glitch', 'vfx', 'effect', 'burst', 'disintegrate', 'assemble'];
  return indicators.some(i => text.includes(i));
}

function checkStorytellingDevice(concept: Concept): boolean {
  return concept.narrative_structure !== undefined && concept.story_summary.length > 50;
}

export function generateAntiGenericSuggestions(check: AntiGenericCheck): string[] {
  const suggestions: string[] = [];

  if (check.looks_canva) {
    suggestions.push('Avoid centered compositions and generic gradients. Use asymmetric layouts and intentional color choices.');
  }
  if (check.looks_shutterstock) {
    suggestions.push('Replace stock photography with original print objects, technical graphics, or abstract visual metaphors.');
  }
  if (check.looks_generic_ai_corporate) {
    suggestions.push('Avoid generic AI aesthetics. Use deterministic rendering for typography and brand elements.');
  }
  if (check.looks_already_produced) {
    suggestions.push('Vary the creative mode, territory, or mood from recent campaigns.');
  }
  if (!check.has_strong_visual_idea) {
    suggestions.push('Develop a stronger central visual idea or metaphor.');
  }
  if (!check.has_metaphor) {
    suggestions.push('Introduce a visual metaphor that connects the service to a larger concept.');
  }
  if (!check.has_unexpected_transition) {
    suggestions.push('Add an unexpected transition or match cut.');
  }
  if (!check.has_unusual_scale) {
    suggestions.push('Play with scale relationships — tiny to enormous.');
  }
  if (!check.has_kinetic_typography) {
    suggestions.push('Consider making typography a character with kinetic behavior.');
  }
  if (!check.has_graphic_information_system) {
    suggestions.push('Add technical graphics, grids, or data visualization.');
  }
  if (!check.has_humour_mechanism) {
    suggestions.push('Consider adding humour or a detective narrative.');
  }
  if (!check.has_vfx_idea) {
    suggestions.push('Add a VFX idea — particles, transformations, or digital effects.');
  }
  if (!check.has_storytelling_device) {
    suggestions.push('Strengthen the narrative structure and storytelling.');

  }

  return suggestions;
}
