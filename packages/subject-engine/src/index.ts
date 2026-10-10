// Subject Engine – analyses a brief into subject insights
import { CreativeBrief } from "@printsync/common";

export interface SubjectInfo {
  keyEntities: string[];
  primaryGoal: string;
}

export class SubjectEngine {
  /**
   * Analyze the brief and extract high‑level subject information.
   * Deterministic placeholder – can be replaced by LLM later.
   */
  async analyze(brief: CreativeBrief): Promise<SubjectInfo> {
    // Simple deterministic extraction based on title and service
    return {
      keyEntities: [brief.title, brief.service],
      primaryGoal: brief.objective,
    };
  }
}

export default SubjectEngine;
