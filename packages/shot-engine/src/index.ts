// Shot Engine – deterministic shot planning
import { Storyboard, Shot } from "@printsync/common";

export class ShotEngine {
  /**
   * Plan shots based on storyboard entries.
   * Each storyboard shot becomes a Shot with equal duration division.
   */
  async planShots(params: { storyboard: Storyboard; briefDuration: number }): Promise<Shot[]> {
    const { storyboard, briefDuration } = params;
    const count = Math.max(storyboard.shots.length, 1);
    const shotDuration = briefDuration / count;
    return storyboard.shots.map((s, i) => ({
      id: `shot-${i + 1}`,
      start: i * shotDuration,
      duration: shotDuration,
      purpose: s.purpose ?? `Purpose ${i + 1}`,
      camera: { type: "STATIC", lens: "35mm" },
      ...(s.subject ? { subject: s.subject } : {}),
      ...(s.environment ? { environment: s.environment } : {}),
    }));
  }
}

export default ShotEngine;

