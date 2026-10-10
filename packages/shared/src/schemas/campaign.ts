/**
 * Campaign Schema
 * Defines campaign structure, history, and rotation state.
 */

import type { CreativeMode, VoiceMode, Mood, VisualStyle, Pace, CreativeTerritory, NarrativeStructure } from './creative.js';

export interface Campaign {
  id: string;
  date: string;
  name: string;
  concept_id: string;
  service: string;
  objective: string;
  creative_mode: CreativeMode;
  voice_mode: VoiceMode;
  territory: CreativeTerritory;
  mood: Mood;
  visual_style: VisualStyle;
  pace: Pace;
  narrative_structure: NarrativeStructure;
  palette: string;
  formats: string[];
  status: CampaignStatus;
  outputs: CampaignOutput[];
  score: number;
  assets_used: string[];
  caption: string;
}

export type CampaignStatus =
  | 'concept'
  | 'script'
  | 'storyboard'
  | 'production'
  | 'qa'
  | 'export'
  | 'complete';

export interface CampaignOutput {
  format: string;
  path: string;
  resolution?: string;
  duration_seconds?: number;
  file_size_bytes?: number;
}

export interface CampaignHistory {
  campaigns: Campaign[];
  last_updated: string;
  creative_patterns: {
    recent_styles: string[];
    recent_palettes: string[];
    recent_narratives: string[];
    recent_formats: string[];
    recent_voice_modes: VoiceMode[];
  };
  rotation_state: {
    last_mood: Mood | null;
    last_visual_style: VisualStyle | null;
    last_narrative: NarrativeStructure | null;
    last_format: string | null;
    last_voice_mode: VoiceMode | null;
    consecutive_similar: number;
  };
}

export interface DailyCampaignResult {
  date: string;
  campaign: Campaign;
  concept: string;
  script: string;
  storyboard: string;
  outputs: CampaignOutput[];
  score: number;
  creative_dna: {
    mode: CreativeMode;
    territory: CreativeTerritory;
    mood: Mood;
    visual_style: VisualStyle;
    pace: Pace;
    voice_mode: VoiceMode;
    narrative: NarrativeStructure;
  };
}
