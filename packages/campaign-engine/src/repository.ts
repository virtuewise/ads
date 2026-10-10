/**
 * Campaign Repository
 * Active intelligence system for campaign history.
 * Campaign history is no longer a passive JSON file.
 */

import type { Campaign, CreativeHistoryEntry } from '@printsync/shared';

export interface CampaignRepository {
  createCampaign(campaign: Campaign): Promise<Campaign>;
  saveCampaign(campaign: Campaign): Promise<void>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  listCampaigns(): Promise<Campaign[]>;
  searchCampaigns(query: string): Promise<Campaign[]>;
  getRecentCampaigns(count: number): Promise<Campaign[]>;
  getCampaignsByService(service: string): Promise<Campaign[]>;
  getCampaignsByMode(mode: string): Promise<Campaign[]>;
  getCampaignsByStyle(style: string): Promise<Campaign[]>;
  getCampaignsByPlatform(platform: string): Promise<Campaign[]>;
  getCampaignsByScore(minScore: number): Promise<Campaign[]>;
  getCreativePatterns(): Promise<CreativeHistoryEntry[]>;
}

/**
 * In-memory campaign repository for development and testing.
 * In production, this would be backed by a database.
 */
export class InMemoryCampaignRepository implements CampaignRepository {
  private campaigns: Map<string, Campaign> = new Map();

  async createCampaign(campaign: Campaign): Promise<Campaign> {
    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  async saveCampaign(campaign: Campaign): Promise<void> {
    this.campaigns.set(campaign.id, campaign);
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    return this.campaigns.get(id);
  }

  async listCampaigns(): Promise<Campaign[]> {
    return Array.from(this.campaigns.values());
  }

  async searchCampaigns(query: string): Promise<Campaign[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.campaigns.values()).filter(c =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.service.toLowerCase().includes(lowerQuery) ||
      c.concept_id.toLowerCase().includes(lowerQuery)
    );
  }

  async getRecentCampaigns(count: number): Promise<Campaign[]> {
    return Array.from(this.campaigns.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, count);
  }

  async getCampaignsByService(service: string): Promise<Campaign[]> {
    return Array.from(this.campaigns.values()).filter(c => c.service === service);
  }

  async getCampaignsByMode(mode: string): Promise<Campaign[]> {
    return Array.from(this.campaigns.values()).filter(c => c.creative_mode === mode);
  }

  async getCampaignsByStyle(style: string): Promise<Campaign[]> {
    return Array.from(this.campaigns.values()).filter(c => c.visual_style === style);
  }

  async getCampaignsByPlatform(platform: string): Promise<Campaign[]> {
    return Array.from(this.campaigns.values()).filter(c => c.formats.includes(platform));
  }

  async getCampaignsByScore(minScore: number): Promise<Campaign[]> {
    return Array.from(this.campaigns.values()).filter(c => c.score >= minScore);
  }

  async getCreativePatterns(): Promise<CreativeHistoryEntry[]> {
    return Array.from(this.campaigns.values()).map(c => ({
      date: c.date,
      campaign: c.name,
      concept_id: c.concept_id,
      format: c.formats[0] ?? '',
      style: c.visual_style,
      services: [c.service],
      palette: c.palette,
      voice_mode: c.voice_mode,
      creative_mode: c.creative_mode,
      territory: c.territory,
      mood: c.mood,
      visual_style: c.visual_style,
      narrative_structure: c.narrative_structure,
      score: c.score,
      outputs: c.outputs.map(o => o.path),
    }));
  }

  /**
   * Clear all campaigns (useful for testing).
   */
  clear(): void {
    this.campaigns.clear();
  }

  /**
   * Get campaign count.
   */
  count(): number {
    return this.campaigns.size;
  }
}

export default InMemoryCampaignRepository;
