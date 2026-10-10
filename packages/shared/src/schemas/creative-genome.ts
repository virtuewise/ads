/**
 * Creative Genome Schema
 * Every completed concept receives a Creative Genome for intelligent comparison.
 */

export interface CreativeGenome {
  narrative: string;
  creativeMode: string;
  service: string;
  emotionalTone: string[];
  visualTerritories: string[];
  typographyBehaviors: string[];
  motionBehaviors: string[];
  transitionTypes: string[];
  colorProfile: string[];
  cameraLanguage: string[];
  soundLanguage: string[];
  narrativeStructure: string;
  visualMetaphors: string[];
  humorLevel: number;
  cinematicLevel: number;
  technicalLevel: number;
  humanPresence: number;
  aiGenerationLevel: number;
}

export interface SimilarityResult {
  score: number;
  overlappingDimensions: string[];
  details: Record<string, number>;
}

export interface CreativeFatigueReport {
  dimension: string;
  usageLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recentCount: number;
  totalCount: number;
  percentage: number;
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
}

export interface CreativeOpportunity {
  service: string;
  territory: string;
  narrative: string;
  mode: string;
  confidence: number;
  novelty: number;
  brandFit: number;
  reasoning: string;
  fatigueDimensions: string[];
}

export interface DiversityAnalysis {
  topConcepts: string[];
  diversityScore: number;
  dimensions: Record<string, number[]>;
  verdict: 'DIVERSE' | 'ACCEPTABLE' | 'REPETITIVE';
  issues: string[];
}

export interface ReworkResult {
  originalScore: number;
  reworkedConcept: unknown;
  newScore: number;
  improvements: string[];
  remainingIssues: string[];
  iterations: number;
  status: 'IMPROVED' | 'UNCHANGED' | 'REJECTED';
}

export interface AntiGenericReport {
  genericityScore: number;
  originalityScore: number;
  distinctivenessScore: number;
  brandSpecificityScore: number;
  detectedPatterns: string[];
  recommendations: string[];
  verdict: 'PASS' | 'REWORK' | 'REJECT';
  competitorTest: {
    passes: boolean;
    issues: string[];
  };
}

export type CampaignObjective =
  | 'AWARENESS'
  | 'LEAD_GENERATION'
  | 'SERVICE_EDUCATION'
  | 'BRAND_POSITIONING'
  | 'TRUST'
  | 'ENGAGEMENT'
  | 'PRODUCT_PROMOTION'
  | 'SEASONAL_CAMPAIGN'
  | 'CUSTOMER_RETENTION'
  | 'CROSS_SELL'
  | 'REMARKETING';

export interface EnhancedCreativeBrief {
  brand: string;
  objective: CampaignObjective;
  audience: string;
  service: string;
  keyMessage: string;
  emotionalGoal: string;
  creativeConcept: string;
  visualConcept: string;
  narrativeStructure: string;
  creativeMode: string;
  voiceMode: 'VOICEOVER' | 'NO_VOICE' | 'DIALOGUE' | 'MUSIC_ONLY';
  platform: string[];
  duration?: number;
  cta: string;
  constraints: string[];
}

export interface JudgeVerdict {
  total: number;
  dimensions: Record<string, number>;
  hardGates: Record<string, boolean>;
  status: 'REJECT' | 'REWORK' | 'APPROVE' | 'SIGNATURE';
  feedback: string[];
  competitorTestPasses: boolean;
}
