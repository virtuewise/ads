import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCampaignRepository } from './repository.js';
import { generateCreativeGenome } from './genome.js';
import { calculateCreativeSimilarity, areTooSimilar } from './similarity.js';
import { detectCreativeFatigue, getUnderusedDimensions, getOverusedDimensions } from './fatigue.js';
import { identifyCreativeOpportunities } from './opportunity.js';
import type { Campaign, Concept, CreativeGenome } from '@printsync/shared';

describe('CampaignEngine', () => {
  let repository: InMemoryCampaignRepository;

  beforeEach(() => {
    repository = new InMemoryCampaignRepository();
  });

  describe('Repository', () => {
    it('creates and retrieves campaigns', async () => {
      const campaign: Campaign = {
        id: 'test-1',
        date: '2026-10-08',
        name: 'Test Campaign',
        concept_id: 'concept-1',
        service: 'branding',
        objective: 'AWARENESS',
        creative_mode: 'CINEMATIC_BRAND_FILM',
        voice_mode: 'VOICEOVER',
        territory: 'PRECISION',
        mood: 'technical',
        visual_style: 'typography',
        pace: 'rhythmic',
        narrative_structure: 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
        palette: 'dark technical',
        formats: ['16:9'],
        status: 'concept',
        outputs: [],
        score: 85,
        assets_used: [],
        caption: 'Test caption',
      };

      await repository.createCampaign(campaign);
      const retrieved = await repository.getCampaign('test-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Campaign');
    });

    it('lists campaigns', async () => {
      const campaign: Campaign = {
        id: 'test-1',
        date: '2026-10-08',
        name: 'Test Campaign',
        concept_id: 'concept-1',
        service: 'branding',
        objective: 'AWARENESS',
        creative_mode: 'CINEMATIC_BRAND_FILM',
        voice_mode: 'VOICEOVER',
        territory: 'PRECISION',
        mood: 'technical',
        visual_style: 'typography',
        pace: 'rhythmic',
        narrative_structure: 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
        palette: 'dark technical',
        formats: ['16:9'],
        status: 'concept',
        outputs: [],
        score: 85,
        assets_used: [],
        caption: 'Test caption',
      };

      await repository.createCampaign(campaign);
      const campaigns = await repository.listCampaigns();
      expect(campaigns.length).toBe(1);
    });

    it('searches campaigns', async () => {
      const campaign: Campaign = {
        id: 'test-1',
        date: '2026-10-08',
        name: 'Print Engine Campaign',
        concept_id: 'concept-1',
        service: 'branding',
        objective: 'AWARENESS',
        creative_mode: 'CINEMATIC_BRAND_FILM',
        voice_mode: 'VOICEOVER',
        territory: 'PRECISION',
        mood: 'technical',
        visual_style: 'typography',
        pace: 'rhythmic',
        narrative_structure: 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
        palette: 'dark technical',
        formats: ['16:9'],
        status: 'concept',
        outputs: [],
        score: 85,
        assets_used: [],
        caption: 'Test caption',
      };

      await repository.createCampaign(campaign);
      const results = await repository.searchCampaigns('Print Engine');
      expect(results.length).toBe(1);
    });

    it('filters campaigns by service', async () => {
      const campaign: Campaign = {
        id: 'test-1',
        date: '2026-10-08',
        name: 'Test Campaign',
        concept_id: 'concept-1',
        service: 'branding',
        objective: 'AWARENESS',
        creative_mode: 'CINEMATIC_BRAND_FILM',
        voice_mode: 'VOICEOVER',
        territory: 'PRECISION',
        mood: 'technical',
        visual_style: 'typography',
        pace: 'rhythmic',
        narrative_structure: 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
        palette: 'dark technical',
        formats: ['16:9'],
        status: 'concept',
        outputs: [],
        score: 85,
        assets_used: [],
        caption: 'Test caption',
      };

      await repository.createCampaign(campaign);
      const results = await repository.getCampaignsByService('branding');
      expect(results.length).toBe(1);
    });

    it('filters campaigns by score', async () => {
      const campaign: Campaign = {
        id: 'test-1',
        date: '2026-10-08',
        name: 'Test Campaign',
        concept_id: 'concept-1',
        service: 'branding',
        objective: 'AWARENESS',
        creative_mode: 'CINEMATIC_BRAND_FILM',
        voice_mode: 'VOICEOVER',
        territory: 'PRECISION',
        mood: 'technical',
        visual_style: 'typography',
        pace: 'rhythmic',
        narrative_structure: 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
        palette: 'dark technical',
        formats: ['16:9'],
        status: 'concept',
        outputs: [],
        score: 85,
        assets_used: [],
        caption: 'Test caption',
      };

      await repository.createCampaign(campaign);
      const results = await repository.getCampaignsByScore(80);
      expect(results.length).toBe(1);
    });
  });

  describe('Creative Genome', () => {
    const concept: Concept = {
      id: 'test-1',
      title: 'THE PRINT ENGINE',
      logline: 'Precision-engineered printing for brands that refuse to blend in.',
      creative_mode: 'TYPOGRAPHIC_FILM',
      narrative_structure: 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
      territory: 'PRECISION',
      mood: 'technical',
      visual_style: 'typography',
      pace: 'rhythmic',
      voice_mode: 'TYPOGRAPHY_ONLY',
      key_visual: 'A mechanical engine made of print components — gears of paper, pistons of ink — comes to life with precision.',
      story_summary: 'A mechanical engine constructed from print components comes to life, showing how PrintSync digital printing is precision-engineered for maximum impact.',
      target_duration_seconds: 20,
      formats: ['16:9', '9:16', '1:1'],
      cta: 'Engineer your brand',
    };

    it('generates a creative genome', () => {
      const genome = generateCreativeGenome(concept);
      expect(genome).toBeDefined();
      expect(genome.creativeMode).toBe('TYPOGRAPHIC_FILM');
      expect(genome.narrativeStructure).toBe('IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT');
      expect(genome.visualTerritories).toContain('PRECISION');
    });

    it('extracts visual metaphors', () => {
      const genome = generateCreativeGenome(concept);
      expect(genome.visualMetaphors).toContain('PRINT AS ENGINE');
    });

    it('calculates humor level', () => {
      const genome = generateCreativeGenome(concept);
      expect(genome.humorLevel).toBeGreaterThanOrEqual(0);
      expect(genome.humorLevel).toBeLessThanOrEqual(10);
    });

    it('calculates cinematic level', () => {
      const genome = generateCreativeGenome(concept);
      expect(genome.cinematicLevel).toBeGreaterThanOrEqual(0);
      expect(genome.cinematicLevel).toBeLessThanOrEqual(10);
    });
  });

  describe('Creative Similarity', () => {
    const genomeA: CreativeGenome = {
      narrative: 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
      creativeMode: 'TYPOGRAPHIC_FILM',
      service: 'digital-printing',
      emotionalTone: ['technical'],
      visualTerritories: ['PRECISION'],
      typographyBehaviors: ['TYPE-SLAM', 'TYPE-BUILD'],
      motionBehaviors: ['mechanical-rhythm'],
      transitionTypes: ['hard-cut'],
      colorProfile: ['monochrome', 'technical'],
      cameraLanguage: ['static'],
      soundLanguage: ['sfx-focused'],
      narrativeStructure: 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
      visualMetaphors: ['PRINT AS ENGINE'],
      humorLevel: 0,
      cinematicLevel: 5,
      technicalLevel: 8,
      humanPresence: 2,
      aiGenerationLevel: 2,
    };

    const genomeB: CreativeGenome = {
      narrative: 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
      creativeMode: 'TYPOGRAPHIC_FILM',
      service: 'digital-printing',
      emotionalTone: ['technical'],
      visualTerritories: ['PRECISION'],
      typographyBehaviors: ['TYPE-SLAM', 'TYPE-BUILD'],
      motionBehaviors: ['mechanical-rhythm'],
      transitionTypes: ['hard-cut'],
      colorProfile: ['monochrome', 'technical'],
      cameraLanguage: ['static'],
      soundLanguage: ['sfx-focused'],
      narrativeStructure: 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
      visualMetaphors: ['PRINT AS ENGINE'],
      humorLevel: 0,
      cinematicLevel: 5,
      technicalLevel: 8,
      humanPresence: 2,
      aiGenerationLevel: 2,
    };

    const genomeC: CreativeGenome = {
      narrative: 'MYSTERY_CLUE_INVESTIGATION_REVEAL_PRODUCT_CTA',
      creativeMode: 'DETECTIVE_AD',
      service: 'signage',
      emotionalTone: ['dramatic'],
      visualTerritories: ['PLAY'],
      typographyBehaviors: ['TYPE-REVEAL'],
      motionBehaviors: ['rapid-cut'],
      transitionTypes: ['match-cut'],
      colorProfile: ['high-contrast', 'dark'],
      cameraLanguage: ['tracking'],
      soundLanguage: ['voiceover'],
      narrativeStructure: 'MYSTERY_CLUE_INVESTIGATION_REVEAL_PRODUCT_CTA',
      visualMetaphors: ['PRINT AS EVIDENCE'],
      humorLevel: 5,
      cinematicLevel: 8,
      technicalLevel: 3,
      humanPresence: 7,
      aiGenerationLevel: 4,
    };

    it('calculates similarity between identical genomes', () => {
      const result = calculateCreativeSimilarity(genomeA, genomeB);
      expect(result.score).toBe(1);
    });

    it('calculates similarity between different genomes', () => {
      const result = calculateCreativeSimilarity(genomeA, genomeC);
      expect(result.score).toBeLessThan(0.5);
    });

    it('detects overlapping dimensions', () => {
      const result = calculateCreativeSimilarity(genomeA, genomeB);
      expect(result.overlappingDimensions).toContain('creative-mode');
      expect(result.overlappingDimensions).toContain('visual-territory');
    });

    it('detects when genomes are too similar', () => {
      expect(areTooSimilar(genomeA, genomeB, 0.7)).toBe(true);
      expect(areTooSimilar(genomeA, genomeC, 0.7)).toBe(false);
    });
  });

  describe('Creative Fatigue', () => {
    it('detects fatigue in empty history', () => {
      const reports = detectCreativeFatigue([]);
      expect(reports.length).toBeGreaterThan(0);
    });

    it('detects underused dimensions', () => {
      const genomes: CreativeGenome[] = [];
      const reports = detectCreativeFatigue(genomes);
      const underused = getUnderusedDimensions(reports);
      expect(underused.length).toBeGreaterThan(0);
    });

    it('detects overused dimensions', () => {
      const genomes: CreativeGenome[] = [];
      const reports = detectCreativeFatigue(genomes);
      const overused = getOverusedDimensions(reports);
      expect(overused).toBeDefined();
    });
  });

  describe('Creative Opportunities', () => {
    it('identifies opportunities', () => {
      const genomes: CreativeGenome[] = [];
      const fatigueReports = detectCreativeFatigue(genomes);
      const opportunities = identifyCreativeOpportunities(genomes, fatigueReports, ['branding', 'packaging', 'signage']);
      expect(opportunities.length).toBeGreaterThan(0);
    });

    it('opportunities have confidence scores', () => {
      const genomes: CreativeGenome[] = [];
      const fatigueReports = detectCreativeFatigue(genomes);
      const opportunities = identifyCreativeOpportunities(genomes, fatigueReports, ['branding']);
      expect(opportunities[0]).toHaveProperty('confidence');
      expect(opportunities[0]).toHaveProperty('novelty');
      expect(opportunities[0]).toHaveProperty('brandFit');
    });
  });
});
