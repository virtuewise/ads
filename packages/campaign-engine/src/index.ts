/**
 * @printsync/campaign-engine
 * Active intelligence system for campaign history.
 * Campaign history is no longer a passive JSON file.
 */

export { detectCreativeFatigue, getOverusedDimensions, getUnderusedDimensions } from './fatigue.js';
export { generateCreativeGenome } from './genome.js';
export { identifyCreativeOpportunities } from './opportunity.js';
export type { CampaignRepository } from './repository.js';
export { InMemoryCampaignRepository } from './repository.js';
export {
  areTooSimilar,
  calculateAverageSimilarity,
  calculateCreativeSimilarity,
} from './similarity.js';
