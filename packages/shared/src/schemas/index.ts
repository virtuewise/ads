/**
 * PrintSync Shared Schemas
 * Central export for all type definitions used across the creative OS.
 */

export type {
  Brand,
  BrandPersonality,
  BrandVoice,
  BrandAudience,
  BrandColors,
  ColorDefinition,
  BrandTypography,
  FontDefinition,
  BrandAsset,
} from './brand.js';

export type {
  CreativeMode,
  VoiceMode,
  NarrativeStructure,
  CreativeTerritory,
  Mood,
  VisualStyle,
  Pace,
  CreativeBrief,
  Concept,
  CreativeScore,
  CreativeScoreThresholds,
  AntiGenericCheck,
  StoryGrammar,
  StoryBeat,
  CreativeHistoryEntry,
} from './creative.js';

export { DEFAULT_THRESHOLDS } from './creative.js';

export type {
  Campaign,
  CampaignStatus,
  CampaignOutput,
  CampaignHistory,
  DailyCampaignResult,
} from './campaign.js';

export type {
  AssetType,
  AssetMetadata,
  ShotInfo,
  TimeRange,
  Asset,
  AssetQuery,
  AssetRegistry,
} from './asset.js';

// Phase 2 exports
export type {
  BrandIdentity,
  BrandPersonality as BrandPersonalitySchema,
  BrandVoice as BrandVoiceSchema,
  CreativeDNA,
  VisualSystem,
  TypographySystem,
  ColorSystem,
  MotionLanguage,
  ServiceDefinition,
  MessagingSystem,
  ForbiddenStyle,
  LogoRules,
  BrandContext,
} from './brand-context.js';

export type {
  CreativeGenome,
  SimilarityResult,
  CreativeFatigueReport,
  CreativeOpportunity,
  DiversityAnalysis,
  ReworkResult,
  AntiGenericReport,
  CampaignObjective,
  EnhancedCreativeBrief,
  JudgeVerdict,
} from './creative-genome.js';
