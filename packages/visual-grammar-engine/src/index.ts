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

/** Simple selector based on brief.mode */
export function selectVisualGrammar(brief: CreativeBrief): VisualGrammar {
  const mode = brief.mode?.toUpperCase();
  if (mode?.includes("EXPLAINER")) return ExplainerGrammar;
  if (mode?.includes("CORPORATE")) return CorporateGrammar;
  if (mode?.includes("DETECTIVE")) return DetectiveGrammar;
  if (mode?.includes("DATA") || mode?.includes("GEOGRAPHIC")) return DataGeographicGrammar;
  // Fallback
  return ExplainerGrammar;
}

export default {
  ExplainerGrammar,
  CorporateGrammar,
  DetectiveGrammar,
  DataGeographicGrammar,
  selectVisualGrammar,
};
