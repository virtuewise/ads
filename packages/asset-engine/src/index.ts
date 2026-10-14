// Asset Engine – determines asset requirements from shots
import type { AssetRequirement, Shot } from '@printsync/common';

const ASSET_BASE = 'file:///assets';

function assetUrl(path: string): string {
  return `${ASSET_BASE}/${path}`;
}

export interface AssetEngineOptions {
  includeStock?: boolean;
  include3D?: boolean;
  includeBrand?: boolean;
}

export class AssetEngine {
  /**
   * Analyze shots and determine required assets.
   */
  async analyzeAssets(
    shots: Shot[],
    options: AssetEngineOptions = {},
  ): Promise<AssetRequirement[]> {
    const { includeStock = true, include3D = false, includeBrand = true } = options;
    const assets: AssetRequirement[] = [];

    // Brand assets (always needed for PrintSync)
    if (includeBrand) {
      assets.push(
        {
          type: 'brand_mark',
          url: assetUrl('brand/printsync/logo.svg'),
          description: 'PrintSync primary logo',
        },
        {
          type: 'brand_guidelines',
          url: assetUrl('brand/printsync/guidelines.pdf'),
          description: 'Brand usage guidelines',
        },
        {
          type: 'color_palette',
          url: assetUrl('brand/printsync/palette.json'),
          description: 'Brand color tokens',
        },
      );
    }

    // Per-shot assets
    for (const shot of shots) {
      // Typography assets
      if (shot.typography) {
        assets.push({
          type: 'typography',
          url: assetUrl(`typography/${shot.typography}.json`),
          description: `Typography preset: ${shot.typography}`,
        });
      }

      // VFX assets
      if (shot.vfx) {
        assets.push({
          type: 'vfx_preset',
          url: assetUrl(`vfx/${shot.vfx}.json`),
          description: `VFX preset: ${shot.vfx}`,
        });
      }

      // 3D assets for 3D-requiring modes
      if (include3D && (shot.camera.type === 'ESTABLISHING' || shot.camera.type === 'HERO')) {
        assets.push({
          type: 'model',
          url: assetUrl(`models/scene-${shot.id}.glb`),
          description: `3D scene for ${shot.purpose} shot`,
        });
      }

      // Stock footage for live-action modes
      if (includeStock && shot.environment) {
        assets.push({
          type: 'footage',
          url: assetUrl(`stock/${shot.environment.toLowerCase().replace(/\s+/g, '-')}.mp4`),
          description: `Stock footage: ${shot.environment}`,
        });
      }

      // Audio assets
      if (shot.audio?.includes('voiceover')) {
        assets.push({
          type: 'voiceover',
          url: assetUrl(`audio/voiceover-${shot.id}.wav`),
          description: `Voiceover for shot ${shot.id}`,
        });
      }
      if (shot.audio?.includes('music')) {
        assets.push({
          type: 'music',
          url: assetUrl('audio/brand-theme.wav'),
          description: 'Brand music theme',
        });
      }
      if (shot.audio?.includes('sfx')) {
        assets.push({
          type: 'sfx',
          url: assetUrl(`audio/sfx-${shot.vfx || 'transition'}.wav`),
          description: `Sound effect for ${shot.vfx || 'transition'}`,
        });
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    return assets.filter((a) => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });
  }
}

export default AssetEngine;
