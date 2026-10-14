/**
 * PrintSync Shared Schemas
 * Central export for all type definitions used across Virtue Studio.
 */

export type {
  Asset,
  AssetMetadata,
  AssetQuery,
  AssetRegistry,
  AssetType,
  ShotInfo,
  TimeRange,
} from './asset.js';
export type {
  Brand,
  BrandAsset,
  BrandAudience,
  BrandColors,
  BrandPersonality,
  BrandTypography,
  BrandVoice,
  ColorDefinition,
  FontDefinition,
} from './brand.js';
// Phase 2 exports
export type {
  BrandContext,
  BrandIdentity,
  BrandPersonality as BrandPersonalitySchema,
  BrandVoice as BrandVoiceSchema,
  ColorSystem,
  CreativeDNA,
  ForbiddenStyle,
  LogoRules,
  MessagingSystem,
  MotionLanguage,
  ServiceDefinition,
  TypographySystem,
  VisualSystem,
} from './brand-context.js';

export type {
  Campaign,
  CampaignHistory,
  CampaignOutput,
  CampaignStatus,
  DailyCampaignResult,
} from './campaign.js';
export type {
  AntiGenericCheck,
  Concept,
  CreativeBrief,
  CreativeHistoryEntry,
  CreativeMode,
  CreativeScore,
  CreativeScoreThresholds,
  CreativeTerritory,
  Mood,
  NarrativeStructure,
  Pace,
  StoryBeat,
  StoryGrammar,
  VisualStyle,
  VoiceMode,
} from './creative.js';
export { DEFAULT_THRESHOLDS, getScoreStatus } from './creative.js';

export type {
  AntiGenericReport,
  CampaignObjective,
  CreativeFatigueReport,
  CreativeGenome,
  CreativeOpportunity,
  DiversityAnalysis,
  EnhancedCreativeBrief,
  JudgeVerdict,
  ReworkResult,
  SimilarityResult,
} from './creative-genome.js';
