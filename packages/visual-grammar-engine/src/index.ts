// Visual Grammar Engine
import { VisualGrammar, CreativeBrief } from "@printsync/common";

/** Predefined visual grammars */
export const ExplainerGrammar: VisualGrammar = {
  name: "Explainer",
  description: "Modern product explainer with UI choreography and kinetic typography.",
  sequence: ["Hook", "Problem", "Mechanism", "Transformation", "Benefit", "CTA"],
};

export const CorporateGrammar: VisualGrammar = {
  name: "Corporate",
  description: "Cinematic corporate storytelling with world, challenge, system, people, impact, brand signature.",
  sequence: ["World", "Challenge", "System", "People", "Impact", "BrandSignature"],
};

export const DetectiveGrammar: VisualGrammar = {
  name: "Detective",
  description: "Suspenseful investigative flow with mystery, clue, evidence, connection, discovery, reveal.",
  sequence: ["Mystery", "Clue", "Evidence", "Connection", "Discovery", "Reveal"],
};

export const DataGeographicGrammar: VisualGrammar = {
  name: "DataGeographic",
  description: "Data‑driven geographic narrative with question, data, pattern, location, insight.",
  sequence: ["Question", "Data", "Pattern", "Location", "Insight"],
};

export const TransformationGrammar: VisualGrammar = {
  name: "Transformation",
  description: "Before/after narrative with dramatic state change.",
  sequence: ["Before", "Catalyst", "Transition", "After", "Benefit", "CTA"],
};

export const HeroJourneyGrammar: VisualGrammar = {
  name: "HeroJourney",
  description: "Classic hero arc: ordinary world, call, trials, reward, return.",
  sequence: ["OrdinaryWorld", "CallToAdventure", "Trials", "Reward", "Return", "CTA"],
};

export const MinimalistGrammar: VisualGrammar = {
  name: "Minimalist",
  description: "Clean, typographic, brand-first visual language.",
  sequence: ["Statement", "Evidence", "Detail", "CTA"],
};

export const PlayfulGrammar: VisualGrammar = {
  name: "Playful",
  description: "Energetic, fast-paced, typography-driven for social.",
  sequence: ["Hook", "Surprise", "Delight", "CTA"],
};

/** Visual grammar registry */
export const VISUAL_GRAMMARS: Record<string, VisualGrammar> = {
  EXPLAINER: ExplainerGrammar,
  CORPORATE: CorporateGrammar,
  DETECTIVE: DetectiveGrammar,
  DATA_GEOGRAPHIC: DataGeographicGrammar,
  TRANSFORMATION: TransformationGrammar,
  HERO_JOURNEY: HeroJourneyGrammar,
  MINIMALIST: MinimalistGrammar,
  PLAYFUL: PlayfulGrammar,
};

/** Simple selector based on brief.mode */
export function selectVisualGrammar(brief: CreativeBrief): VisualGrammar {
  const mode = brief.mode.toUpperCase();

  // Direct mode match
  for (const [key, grammar] of Object.entries(VISUAL_GRAMMARS)) {
    if (mode.includes(key)) return grammar;
  }

  // Territory-based fallbacks
  if (mode.includes('TRANSFORMATION') || mode.includes('BEFORE_AFTER')) return TransformationGrammar;
  if (mode.includes('HERO') || mode.includes('STORY') || mode.includes('CASE_STUDY')) return HeroJourneyGrammar;
  if (mode.includes('DATA') || mode.includes('INFOGRAPHIC') || mode.includes('EDUCATIONAL')) return DataGeographicGrammar;
  if (mode.includes('CORPORATE') || mode.includes('BRAND_FILM')) return CorporateGrammar;
  if (mode.includes('SOCIAL') || mode.includes('POSTER') || mode.includes('UGC') || mode.includes('PLAY')) return PlayfulGrammar;
  if (mode.includes('TYPOGRAPHIC') || mode.includes('MINIMAL')) return MinimalistGrammar;

  // Default
  return ExplainerGrammar;
}

/** Get all available grammars */
export function getAllVisualGrammars(): VisualGrammar[] {
  return Object.values(VISUAL_GRAMMARS);
}

export default {
  ExplainerGrammar,
  CorporateGrammar,
  DetectiveGrammar,
  DataGeographicGrammar,
  TransformationGrammar,
  HeroJourneyGrammar,
  MinimalistGrammar,
  PlayfulGrammar,
  VISUAL_GRAMMARS,
  selectVisualGrammar,
  getAllVisualGrammars,
};