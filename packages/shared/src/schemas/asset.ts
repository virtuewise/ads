/**
 * Asset Registry Schema
 * Defines the structure for asset intelligence and management.
 */

export type AssetType = 'video' | 'image' | 'audio' | 'font' | 'logo' | 'document';

export interface AssetMetadata {
  duration_seconds?: number;
  fps?: number;
  resolution?: { width: number; height: number };
  file_size_bytes: number;
  format: string;
  dominant_colors?: string[];
  keywords?: string[];
  service?: string;
  visual_energy?: 'low' | 'medium' | 'high';
  camera_movement?: string[];
  shots?: ShotInfo[];
  best_frames?: number[];
  usable_segments?: TimeRange[];
  subject?: string;
}

export interface ShotInfo {
  start_frame: number;
  end_frame: number;
  description: string;
  camera_movement: string;
  visual_energy: 'low' | 'medium' | 'high';
}

export interface TimeRange {
  start_seconds: number;
  end_seconds: number;
  description: string;
  quality: 'excellent' | 'good' | 'usable';
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  path: string;
  service?: string;
  metadata: AssetMetadata;
  tags: string[];
  date_added: string;
  last_used?: string;
  use_count: number;
}

export interface AssetQuery {
  service?: string;
  type?: AssetType;
  visual_energy?: 'low' | 'medium' | 'high';
  min_duration?: number;
  max_duration?: number;
  keywords?: string[];
  tags?: string[];
}

export interface AssetRegistry {
  assets: Asset[];
  last_scanned: string;
  version: string;
}
