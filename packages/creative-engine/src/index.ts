/**
 * @printsync/creative-engine
 * Core creative intelligence for Virtue Studio.
 * Handles concept generation, creative scoring, anti-generic detection,
 * and story grammar.
 */

export { checkAntiGeneric, generateAntiGenericSuggestions } from './anti-generic.js';
// V2 exports
export { analyzeAntiGeneric } from './anti-generic-v2.js';
export { generateCreativeBrief } from './brief-generator.js';
// Inlined campaign functions (from @printsync/campaign-engine)
export {
  calculateCreativeSimilarity,
  detectCreativeFatigue,
  generateCreativeGenome,
  identifyCreativeOpportunities,
} from './campaign-functions.js';
export type { DailyCreativeReport } from './daily-v2.js';
export { runDailyCreativeEngine } from './daily-v2.js';
// V1 exports
export { CreativeDirector } from './director.js';
export { analyzeDiversity, selectDiverseTop3 } from './diversity.js';
export { CreativeJudge } from './judge.js';
export { judgeConceptsV2, judgeConceptV2 } from './judge-v2.js';
export {
  getMetaphorsForService,
  getMetaphorsForTerritory,
  getRandomMetaphor,
  VISUAL_METAPHORS,
} from './metaphors.js';
export {
  CREATIVE_MODES,
  getAllCreativeModes,
  getCreativeMode,
  getModesByMood,
  getModesByTerritory,
} from './modes.js';
export { reworkConcept } from './rework.js';
export { generateConceptSeeds, seedToConcept } from './seeds.js';
export {
  generateStoryGrammar,
  getAllStoryTemplates,
  getStructuresByComplexity,
} from './story-grammar.js';
