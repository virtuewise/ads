// Shot Engine – deterministic shot planning
import { Storyboard, Shot } from "@printsync/common";

export class ShotEngine {
  /**
   * Plan shots based on storyboard entries.
   * Refines storyboard shots with detailed production specs.
   */
  async planShots(params: { storyboard: Storyboard; briefDuration: number }): Promise<Shot[]> {
    const { storyboard, briefDuration } = params;
    const shots = storyboard.shots;

    // Validate and normalize timing
    let cursor = 0;
    const refinedShots: Shot[] = shots.map((s, i) => {
      const duration = s.duration || briefDuration / shots.length;
      const start = cursor;
      const end = Math.min(cursor + duration, briefDuration);

      // Enhance camera spec with more detail
      const enhancedCamera = {
        type: s.camera.type || 'STATIC',
        lens: s.camera.lens || '35mm',
        movement: s.camera.movement || 'Locked off',
      };

      cursor = end;

      const shot: Shot = {
        id: s.id || `shot-${i + 1}`,
        start: Math.round(start * 100) / 100,
        duration: Math.round(duration * 100) / 100,
        purpose: s.purpose || `Purpose ${i + 1}`,
        camera: enhancedCamera,
      };

      // Conditionally add optional properties (exactOptionalPropertyTypes)
      if (s.subject) shot.subject = s.subject;
      if (s.environment) shot.environment = s.environment;
      if (s.action) shot.action = s.action;
      if (s.lighting) shot.lighting = s.lighting;
      if (s.typography) shot.typography = s.typography;
      if (s.vfx) shot.vfx = s.vfx;
      if (s.transition) shot.transition = s.transition;
      if (s.audio) shot.audio = s.audio;

      return shot;
    });

    // Ensure total duration matches brief
    const totalDuration = refinedShots.reduce((sum, s) => sum + s.duration, 0);
    if (Math.abs(totalDuration - briefDuration) > 0.1) {
      // Scale last shot to match
      const last = refinedShots[refinedShots.length - 1];
      if (last) {
        last.duration = Math.round((last.duration + (briefDuration - totalDuration)) * 100) / 100;
      }
    }

    return refinedShots;
  }
}

export default ShotEngine;