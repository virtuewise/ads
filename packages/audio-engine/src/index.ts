// Audio Engine – audio planning and frequency analysis
import { Shot, AudioPlan } from "@printsync/common";

export interface AudioClip {
  id: string;
  type: 'VOICEOVER' | 'MUSIC' | 'SFX' | 'AMBIENCE' | 'STING';
  url: string;
  duration: number;
  startTime: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export interface AudioEngineOptions {
  mode?: string;
  voice?: string;
  musicStyle?: 'CINEMATIC' | 'TECHNICAL' | 'PLAYFUL' | 'MINIMAL' | 'DRAMATIC' | undefined;
}

export const AUDIO_TEMPLATES: Record<string, { clips: AudioClip[]; totalDuration: number }> = {
  CINEMATIC: {
    clips: [
      { id: 'music_main', type: 'MUSIC', url: 'audio/cinematic-theme.wav', duration: 30, startTime: 0, volume: 0.6, fadeIn: 1.0, fadeOut: 2.0 },
      { id: 'sting_open', type: 'STING', url: 'audio/sting-cinematic.wav', duration: 1.5, startTime: 0, volume: 0.8, fadeIn: 0.1, fadeOut: 0.5 },
      { id: 'sting_close', type: 'STING', url: 'audio/sting-cinematic.wav', duration: 1.5, startTime: 28.5, volume: 0.8, fadeIn: 0.1, fadeOut: 0.5 },
    ],
    totalDuration: 30,
  },
  TECHNICAL: {
    clips: [
      { id: 'music_main', type: 'MUSIC', url: 'audio/tech-theme.wav', duration: 30, startTime: 0, volume: 0.4, fadeIn: 0.5, fadeOut: 1.0 },
      { id: 'ui_clicks', type: 'SFX', url: 'audio/ui-clicks.wav', duration: 30, startTime: 0, volume: 0.3, fadeIn: 0, fadeOut: 0 },
    ],
    totalDuration: 30,
  },
  PLAYFUL: {
    clips: [
      { id: 'music_main', type: 'MUSIC', url: 'audio/playful-theme.wav', duration: 15, startTime: 0, volume: 0.7, fadeIn: 0.2, fadeOut: 0.5 },
      { id: 'pop_sfx', type: 'SFX', url: 'audio/pop.wav', duration: 0.3, startTime: 2, volume: 0.5, fadeIn: 0, fadeOut: 0 },
      { id: 'whoosh_sfx', type: 'SFX', url: 'audio/whoosh.wav', duration: 0.5, startTime: 5, volume: 0.4, fadeIn: 0, fadeOut: 0 },
    ],
    totalDuration: 15,
  },
  MINIMAL: {
    clips: [
      { id: 'ambience', type: 'AMBIENCE', url: 'audio/ambient-room.wav', duration: 30, startTime: 0, volume: 0.2, fadeIn: 2.0, fadeOut: 2.0 },
    ],
    totalDuration: 30,
  },
  DRAMATIC: {
    clips: [
      { id: 'music_main', type: 'MUSIC', url: 'audio/dramatic-theme.wav', duration: 30, startTime: 0, volume: 0.7, fadeIn: 1.0, fadeOut: 2.0 },
      { id: 'impact_sfx', type: 'SFX', url: 'audio/impact.wav', duration: 0.5, startTime: 10, volume: 0.6, fadeIn: 0, fadeOut: 0 },
      { id: 'riser', type: 'SFX', url: 'audio/riser.wav', duration: 3, startTime: 25, volume: 0.5, fadeIn: 0.5, fadeOut: 0.5 },
    ],
    totalDuration: 30,
  },
};

export class AudioEngine {
  /**
   * Generate audio plan from shots and mode.
   */
  async planAudio(shots: Shot[], options: AudioEngineOptions = {}): Promise<AudioPlan> {
    const { mode = 'CINEMATIC', voice, musicStyle } = options;
    const style = musicStyle || this.inferStyle(mode);
    const template = (AUDIO_TEMPLATES[style] ?? AUDIO_TEMPLATES.CINEMATIC) as NonNullable<typeof AUDIO_TEMPLATES[typeof style]>;
    const clips: string[] = [];

    // Add template clips
    for (const clip of template.clips) {
      clips.push(`${clip.type.toLowerCase()}:${clip.id}`);
    }

    // Add voiceover if specified
    if (voice && voice !== 'NONE' && voice !== 'TYPOGRAPHY_ONLY' && voice !== 'MUSIC_ONLY') {
      clips.push(`voiceover:${voice.toLowerCase()}`);
      // Add voiceover clips per shot with dialogue
      for (const shot of shots) {
        if (shot.audio?.includes('voiceover')) {
          clips.push(`voiceover:shot-${shot.id}`);
        }
      }
    }

    // Add SFX for VFX shots
    for (const shot of shots) {
      if (shot.vfx) {
        clips.push(`sfx:${shot.vfx}`);
      }
    }

    return { clips: Array.from(new Set(clips)) };
  }

  private inferStyle(mode: string): keyof typeof AUDIO_TEMPLATES {
    const m = mode.toUpperCase();
    if (m.includes('CINEMATIC') || m.includes('BRAND_FILM') || m.includes('STORY')) return 'CINEMATIC';
    if (m.includes('TECHNICAL') || m.includes('INFOGRAPHIC') || m.includes('EDUCATIONAL') || m.includes('PRODUCT')) return 'TECHNICAL';
    if (m.includes('PLAYFUL') || m.includes('HUMOR') || m.includes('SOCIAL') || m.includes('UGC') || m.includes('PLAY')) return 'PLAYFUL';
    if (m.includes('MINIMAL') || m.includes('TYPOGRAPHIC') || m.includes('POSTER')) return 'MINIMAL';
    if (m.includes('DRAMATIC') || m.includes('TRANSFORMATION') || m.includes('BEFORE_AFTER')) return 'DRAMATIC';
    return 'CINEMATIC';
  }

  /** Analyze frequency bands for audio-reactive animation */
  analyzeFrequencyBands(audioData: ReadonlyArray<number>, bands: number): number[] {
    return analyzeFrequencyBands(audioData, bands);
  }
}

/**
 * Analyze frequency bands for audio-reactive animation.
 * Divides the spectrum into `bands` equal parts and returns the average
 * amplitude of each band. Input values are clamped to [0, 1].
 */
export function analyzeFrequencyBands(spectrum: ReadonlyArray<number>, bands: number): number[] {
  if (bands <= 0 || spectrum.length === 0) return [];

  const bandSize = spectrum.length / bands;
  const result: number[] = [];

  for (let b = 0; b < bands; b++) {
    const start = Math.floor(b * bandSize);
    const end = Math.min(Math.floor((b + 1) * bandSize), spectrum.length);
    let sum = 0;
    let count = 0;
    for (let i = start; i < end; i++) {
      const v = spectrum[i];
      if (v === undefined) continue;
      sum += v < 0 ? 0 : v > 1 ? 1 : v;
      count++;
    }
    result.push(count > 0 ? sum / count : 0);
  }
  return result;
}

export default AudioEngine;