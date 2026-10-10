/**
 * @printsync/campaign-engine
 * Active intelligence system for campaign history.
 * Campaign history is no longer a passive JSON file.
 */

export { InMemoryCampaignRepository } from './repository.js';
export type { CampaignRepository } from './repository.js';
export { generateCreativeGenome } from './genome.js';
export { calculateCreativeSimilarity, areTooSimilar, calculateAverageSimilarity } from './similarity.js';
export { detectCreativeFatigue, getUnderusedDimensions, getOverusedDimensions } from './fatigue.js';
export { identifyCreativeOpportunities } from './opportunity.js';
