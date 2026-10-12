/**
 * Creative Engine Schemas
 * Defines concepts, scores, modes, and creative structures.
 */

export type CreativeMode =
  | 'CINEMATIC_BRAND_FILM'
  | 'TYPOGRAPHIC_FILM'
  | 'PRODUCT_AD'
  | 'SERVICE_AD'
  | 'SOCIAL_POST'
  | 'SOCIAL_CAROUSEL'
  | 'POSTER'
  | 'MOTION_POSTER'
  | 'INFOGRAPHIC'
  | 'EDUCATIONAL_AD'
  | 'SALES_AD'
  | 'CORPORATE_AD'
  | 'HUMOR_AD'
  | 'DETECTIVE_AD'
  | 'STORY_AD'
  | 'TRANSFORMATION_AD'
  | 'BEFORE_AFTER'
  | 'CASE_STUDY'
  | 'TESTIMONIAL'
  | 'UGC'
  | 'VFX_EXPERIMENT'
  | '3D_PRODUCT_FILM'
  | 'TYPOGRAPHY_ONLY'
  | 'NO_VOICE_FILM'
  | 'VOICEOVER_FILM'
  | 'CAMPAIGN_FILM';

export type VoiceMode =
  | 'VOICEOVER'
  | 'TYPOGRAPHY_ONLY'
  | 'MUSIC_ONLY'
  | 'DIALOGUE'
  | 'HYBRID';

export type NarrativeStructure =
  | 'PROBLEM_TENSION_DISCOVERY_TRANSFORMATION_PROOF_BRAND'
  | 'MYSTERY_CLUE_INVESTIGATION_REVEAL_PRODUCT_CTA'
  | 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT'
  | 'CHAOS_PRECISION_CONTROL_RESULT'
  | 'BORING_PRINTSYNC_TRANSFORMATION'
  | 'DIGITAL_PHYSICAL_EXPERIENCE';

export type CreativeTerritory =
  | 'PRECISION'
  | 'TRANSFORMATION'
  | 'SCALE'
  | 'HUMAN_IMPACT'
  | 'PLAY';

export type Mood =
  | 'cinematic'
  | 'playful'
  | 'technical'
  | 'minimal'
  | 'dramatic';

export type VisualStyle =
  | 'typography'
  | 'product'
  | 'vfx'
  | 'live_action'
  | 'mixed';

export type Pace =
  | 'slow_premium'
  | 'fast_energetic'
  | 'rhythmic';

export interface CreativeBrief {
  objective: string;
  service: string;
  audience: string;
  emotional_objective: string;
  platform: string[];
  formats: string[];
  voice_mode?: VoiceMode;
  creative_mode?: CreativeMode;
  territory?: CreativeTerritory;
  mood?: Mood;
  visual_style?: VisualStyle;
  pace?: Pace;
  constraints?: string[];
  reference_campaigns?: string[];
}

export interface Concept {
  id: string;
  title: string;
  logline: string;
  creative_mode: CreativeMode;
  narrative_structure: NarrativeStructure;
  territory: CreativeTerritory;
  mood: Mood;
  visual_style: VisualStyle;
  pace: Pace;
  voice_mode: VoiceMode;
  key_visual: string;
  story_summary: string;
  target_duration_seconds: number;
  formats: string[];
  cta: string;
  score?: CreativeScore;
}

export interface CreativeScore {
  brand_fit: number;
  originality: number;
  commercial_value: number;
  visual_potential: number;
  emotional_impact: number;
  memorability: number;
  social_stop_power: number;
  production_quality: number;
  service_relevance: number;
  non_generic_quality: number;
  total: number;
  status: 'REJECT' | 'REWORK' | 'APPROVE' | 'SIGNATURE';
  feedback: string[];
}

/**
 * Score-band thresholds for the Creative Judge.
 *
 * Bands are contiguous and lower-bound inclusive:
 *
 * | Total score      | Status    |
 * |------------------|-----------|
 * | `>= signature`   | SIGNATURE |
 * | `>= approve`     | APPROVE   |
 * | `>= rework`      | REWORK    |
 * | `<  rework`      | REJECT    |
 *
 * `reject` is the exclusive upper bound of the REJECT band. For a contiguous
 * rubric it equals `rework`; it is kept explicit for readability and backward
 * compatibility.
 *
 * Always resolve a score to a status with {@link getScoreStatus} rather than
 * comparing against these fields directly, so every judge applies the same
 * bands.
 */
export interface CreativeScoreThresholds {
  reject: number;
  rework: number;
  approve: number;
  signature: number;
}

/**
 * Canonical PrintSync creative scoring rubric (single source of truth).
 *
 * REJECT < 70 · REWORK 70–79 · APPROVE 80–89 · SIGNATURE 90–100
 */
export const DEFAULT_THRESHOLDS: CreativeScoreThresholds = {
  reject: 70,
  rework: 70,
  approve: 80,
  signature: 90,
};

/**
 * Map a total creative score (0–100) to its status using the given thresholds.
 *
 * This is the only place the score bands are evaluated; both the V1 and V2
 * judges call it so they can never drift apart.
 */
export function getScoreStatus(
  total: number,
  thresholds: CreativeScoreThresholds = DEFAULT_THRESHOLDS
): 'REJECT' | 'REWORK' | 'APPROVE' | 'SIGNATURE' {
  if (total >= thresholds.signature) return 'SIGNATURE';
  if (total >= thresholds.approve) return 'APPROVE';
  if (total >= thresholds.rework) return 'REWORK';
  return 'REJECT';
}

export interface AntiGenericCheck {
  looks_canva: boolean;
  looks_shutterstock: boolean;
  looks_generic_ai_corporate: boolean;
  looks_generic_marketing_agency: boolean;
  looks_generic_printing_company: boolean;
  looks_like_competitor: boolean;
  looks_already_produced: boolean;
  has_strong_visual_idea: boolean;
  has_metaphor: boolean;
  has_unexpected_transition: boolean;
  has_unusual_scale: boolean;
  has_kinetic_typography: boolean;
  has_graphic_information_system: boolean;
  has_humour_mechanism: boolean;
  has_vfx_idea: boolean;
  has_storytelling_device: boolean;
  passed: boolean;
  issues: string[];
}

export interface StoryGrammar {
  structure: NarrativeStructure;
  beats: StoryBeat[];
}

export interface StoryBeat {
  id: string;
  name: string;
  description: string;
  duration_seconds: number;
  visual_description: string;
  audio_description: string;
  text_overlay?: string;
}

export interface CreativeHistoryEntry {
  date: string;
  campaign: string;
  concept_id: string;
  format: string;
  style: string;
  services: string[];
  palette: string;
  voice_mode: VoiceMode;
  creative_mode: CreativeMode;
  territory: CreativeTerritory;
  mood: Mood;
  visual_style: VisualStyle;
  narrative_structure: NarrativeStructure;
  score: number;
  outputs: string[];
}
