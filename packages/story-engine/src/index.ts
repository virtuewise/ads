// Story Engine – turn subject info into a high‑level outline
import { SubjectInfo } from "@printsync/subject-engine";

export interface StoryOutline {
  outline: string[]; // ordered narrative beats
}

export class StoryEngine {
  /**
   * Deterministic story planning based on subject key entities.
   * For now we simply map each key entity to a generic beat.
   */
  async planStory(subject: SubjectInfo): Promise<StoryOutline> {
    const outline = subject.keyEntities.map((entity) => `Introduce ${entity}`);
    // Ensure at least three beats for a decent structure
    if (outline.length < 3) {
      outline.push('Develop concept', 'Conclude');
    }
    return { outline };
  }
}

export default StoryEngine;
