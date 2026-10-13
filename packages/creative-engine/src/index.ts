/**
 * @printsync/creative-engine
 * Core creative intelligence for Virtue Studio.
 * Handles concept generation, creative scoring, anti-generic detection,
 * and story grammar.
 */

// V1 exports
export { CreativeDirector } from './director.js';
export { CreativeJudge } from './judge.js';
export { CREATIVE_MODES, getCreativeMode, getAllCreativeModes, getModesByTerritory, getModesByMood } from './modes.js';
export { generateStoryGrammar, getAllStoryTemplates, getStructuresByComplexity } from './story-grammar.js';
export { checkAntiGeneric, generateAntiGenericSuggestions } from './anti-generic.js';

// V2 exports
export { analyzeAntiGeneric } from './anti-generic-v2.js';
export { judgeConceptV2, judgeConceptsV2 } from './judge-v2.js';
export { reworkConcept } from './rework.js';
export { analyzeDiversity, selectDiverseTop3 } from './diversity.js';
export { generateCreativeBrief } from './brief-generator.js';
export { VISUAL_METAPHORS, getMetaphorsForService, getMetaphorsForTerritory, getRandomMetaphor } from './metaphors.js';
export { generateConceptSeeds, seedToConcept } from './seeds.js';
export { runDailyCreativeEngine } from './daily-v2.js';
export type { DailyCreativeReport } from './daily-v2.js';

// Inlined campaign functions (from @printsync/campaign-engine)
export { generateCreativeGenome, calculateCreativeSimilarity, detectCreativeFatigue, identifyCreativeOpportunities } from './campaign-functions.js';
