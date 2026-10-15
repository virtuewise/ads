/**
 * Creative Engine Tests
 */

import type { Concept, CreativeBrief } from '@printsync/shared';
import { describe, expect, it } from 'vitest';
import { checkAntiGeneric, generateAntiGenericSuggestions } from './anti-generic.js';
import { at } from './arrays.js';
import { CreativeDirector } from './director.js';
import { CreativeJudge } from './judge.js';
import {
  getAllCreativeModes,
  getCreativeMode,
  getModesByMood,
  getModesByTerritory,
} from './modes.js';
import {
  generateStoryGrammar,
  getAllStoryTemplates,
  getStructuresByComplexity,
} from './story-grammar.js';

describe('CreativeDirector', () => {
  const director = new CreativeDirector();

  const brief: CreativeBrief = {
    objective: 'Advertise large format printing',
    service: 'large-format-printing',
    audience: 'businesses',
    emotional_objective: 'confidence',
    platform: ['instagram', 'youtube'],
    formats: ['16:9', '9:16'],
  };

  it('generates 10 concepts', () => {
    const concepts = director.generateConcepts(brief);
    expect(concepts).toHaveLength(10);
  });

  it('concepts have required fields', () => {
    const concepts = director.generateConcepts(brief);
    for (const concept of concepts) {
      expect(concept.id).toBeDefined();
      expect(concept.title).toBeDefined();
      expect(concept.logline).toBeDefined();
      expect(concept.creative_mode).toBeDefined();
      expect(concept.territory).toBeDefined();
      expect(concept.mood).toBeDefined();
      expect(concept.visual_style).toBeDefined();
      expect(concept.pace).toBeDefined();
      expect(concept.voice_mode).toBeDefined();
      expect(concept.key_visual).toBeDefined();
      expect(concept.story_summary).toBeDefined();
      expect(concept.cta).toBeDefined();
    }
  });

  it('selects top 3 concepts', () => {
    const concepts = director.generateConcepts(brief);
    const top3 = director.selectTopConcepts(concepts);
    expect(top3.length).toBeLessThanOrEqual(3);
  });

  it('develops a treatment', () => {
    const concepts = director.generateConcepts(brief);
    const concept = at(concepts, 0);
    const treatment = director.developConcept(concept);
    expect(treatment).toContain(concept.title);
    expect(treatment).toContain(concept.logline);
  });
});

describe('CreativeJudge', () => {
  const judge = new CreativeJudge();

  const goodConcept: Concept = {
    id: 'test_1',
    title: 'THE PRINT ENGINE',
    logline: 'Precision-engineered printing for brands that refuse to blend in.',
    creative_mode: 'TYPOGRAPHIC_FILM',
    narrative_structure: 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
    territory: 'PRECISION',
    mood: 'technical',
    visual_style: 'typography',
    pace: 'rhythmic',
    voice_mode: 'TYPOGRAPHY_ONLY',
    key_visual:
      'A mechanical engine made of print components — gears of paper, pistons of ink — comes to life with precision.',
    story_summary:
      'A mechanical engine constructed from print components comes to life, showing how PrintSync digital printing is precision-engineered for maximum impact.',
    target_duration_seconds: 20,
    formats: ['16:9', '9:16', '1:1'],
    cta: 'Engineer your brand',
  };

  it('scores a concept', () => {
    const score = judge.scoreConcept(goodConcept);
    expect(score.total).toBeGreaterThan(0);
    expect(score.total).toBeLessThanOrEqual(100);
    expect(score.status).toBeDefined();
    expect(score.feedback).toBeDefined();
  });

  it('approves strong concepts', () => {
    const evaluation = judge.evaluateConcept(goodConcept);
    expect(evaluation.score.total).toBeGreaterThan(0);
    expect(['APPROVE', 'SIGNATURE', 'REWORK', 'REJECT']).toContain(evaluation.action);
  });

  it('scores multiple concepts and sorts by total', () => {
    const concepts = [
      { ...goodConcept, id: '1' },
      { ...goodConcept, id: '2', title: 'GENERIC PRINTING SOLUTION' },
    ];
    const scored = judge.scoreConcepts(concepts);
    const first = at(scored, 0);
    const second = at(scored, 1);
    if (!first.score || !second.score) {
      throw new Error('scoreConcepts must attach a score to every concept');
    }
    expect(first.score.total).toBeGreaterThanOrEqual(second.score.total);
  });
});

describe('Anti-Generic Engine', () => {
  it('passes a strong concept', () => {
    const concept: Concept = {
      id: 'test_1',
      title: 'THE PRINT ENGINE',
      logline: 'Precision-engineered printing for brands that refuse to blend in.',
      creative_mode: 'TYPOGRAPHIC_FILM',
      narrative_structure: 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
      territory: 'PRECISION',
      mood: 'technical',
      visual_style: 'typography',
      pace: 'rhythmic',
      voice_mode: 'TYPOGRAPHY_ONLY',
      key_visual:
        'A mechanical engine made of print components — gears of paper, pistons of ink — comes to life with precision.',
      story_summary:
        'A mechanical engine constructed from print components comes to life, showing how PrintSync digital printing is precision-engineered for maximum impact.',
      target_duration_seconds: 20,
      formats: ['16:9', '9:16', '1:1'],
      cta: 'Engineer your brand',
    };

    const check = checkAntiGeneric(concept, []);
    expect(check.has_strong_visual_idea).toBe(true);
    expect(check.has_kinetic_typography).toBe(true);
  });

  it('detects generic patterns', () => {
    const genericConcept: Concept = {
      id: 'test_2',
      title: 'QUALITY PRINTING SOLUTIONS',
      logline: 'We provide quality printing solutions for all your needs.',
      creative_mode: 'CORPORATE_AD',
      narrative_structure: 'PROBLEM_TENSION_DISCOVERY_TRANSFORMATION_PROOF_BRAND',
      territory: 'HUMAN_IMPACT',
      mood: 'minimal',
      visual_style: 'live_action',
      pace: 'slow_premium',
      voice_mode: 'VOICEOVER',
      key_visual: 'A printer in an office.',
      story_summary: 'We provide quality printing solutions.',
      target_duration_seconds: 30,
      formats: ['16:9'],
      cta: 'Contact us for a quote',
    };

    const check = checkAntiGeneric(genericConcept, []);
    expect(check.passed).toBe(false);
  });

  it('generates suggestions for failed checks', () => {
    const failedCheck = {
      looks_canva: true,
      looks_shutterstock: false,
      looks_generic_ai_corporate: false,
      looks_generic_marketing_agency: false,
      looks_generic_printing_company: false,
      looks_like_competitor: false,
      looks_already_produced: false,
      has_strong_visual_idea: false,
      has_metaphor: false,
      has_unexpected_transition: false,
      has_unusual_scale: false,
      has_kinetic_typography: false,
      has_graphic_information_system: false,
      has_humour_mechanism: false,
      has_vfx_idea: false,
      has_storytelling_device: false,
      passed: false,
      issues: ['Concept shows Canva template indicators', 'Concept lacks a strong visual idea'],
    };

    const suggestions = generateAntiGenericSuggestions(failedCheck);
    expect(suggestions.length).toBeGreaterThan(0);
  });
});

describe('Story Grammar', () => {
  it('generates story grammar for a structure', () => {
    const grammar = generateStoryGrammar('IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT');
    expect(grammar.structure).toBe('IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT');
    expect(grammar.beats.length).toBeGreaterThan(0);
  });

  it('returns all story templates', () => {
    const templates = getAllStoryTemplates();
    expect(templates.length).toBe(6);
  });

  it('returns structures by complexity', () => {
    const byComplexity = getStructuresByComplexity();
    expect(byComplexity.simple.length).toBeGreaterThan(0);
    expect(byComplexity.medium.length).toBeGreaterThan(0);
    expect(byComplexity.complex.length).toBeGreaterThan(0);
  });
});

describe('Creative Modes', () => {
  it('has 26 creative modes', () => {
    const modes = getAllCreativeModes();
    expect(modes.length).toBe(26);
  });

  it('gets a specific mode', () => {
    const mode = getCreativeMode('CINEMATIC_BRAND_FILM');
    expect(mode.name).toBe('Cinematic Brand Film');
  });

  it('gets modes by territory', () => {
    const modes = getModesByTerritory('PRECISION');
    expect(modes.length).toBeGreaterThan(0);
  });

  it('gets modes by mood', () => {
    const modes = getModesByMood('cinematic');
    expect(modes.length).toBeGreaterThan(0);
  });
});
