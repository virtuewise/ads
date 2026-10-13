// Story Engine – turn subject info into a high-level outline
import { SubjectInfo, Entity } from "@printsync/subject-engine";

export interface StoryBeat {
  id: string;
  label: string;
  purpose: 'HOOK' | 'PROBLEM' | 'SOLUTION' | 'PROOF' | 'BENEFIT' | 'CTA' | 'BRAND' | 'EDUCATION';
  durationRatio: number; // proportion of total duration
  entities: Entity[];
  visualHint: string;
}

export interface StoryOutline {
  beats: StoryBeat[];
  structure: 'THREE_ACT' | 'PROBLEM_SOLUTION' | 'BEFORE_AFTER' | 'DETECTIVE' | 'EDUCATIONAL' | 'HERO_JOURNEY';
  totalBeats: number;
}

/** Narrative structures per territory/tone */
const STRUCTURES: Record<StoryOutline['structure'], Omit<StoryBeat, 'id' | 'entities'>[]> = {
  THREE_ACT: [
    { label: 'Setup', purpose: 'HOOK', durationRatio: 0.2, visualHint: 'Wide establishing shot' },
    { label: 'Confrontation', purpose: 'PROBLEM', durationRatio: 0.3, visualHint: 'Tension-building close-ups' },
    { label: 'Resolution', purpose: 'SOLUTION', durationRatio: 0.3, visualHint: 'Product reveal / transformation' },
    { label: 'Call to Action', purpose: 'CTA', durationRatio: 0.2, visualHint: 'Brand mark + contact' },
  ],
  PROBLEM_SOLUTION: [
    { label: 'Problem', purpose: 'PROBLEM', durationRatio: 0.35, visualHint: 'Pain point visualization' },
    { label: 'Solution', purpose: 'SOLUTION', durationRatio: 0.4, visualHint: 'Product in action' },
    { label: 'Proof', purpose: 'PROOF', durationRatio: 0.15, visualHint: 'Data / testimonial' },
    { label: 'CTA', purpose: 'CTA', durationRatio: 0.1, visualHint: 'Clear next step' },
  ],
  BEFORE_AFTER: [
    { label: 'Before', purpose: 'PROBLEM', durationRatio: 0.3, visualHint: 'Current state (dim/flat)' },
    { label: 'Transition', purpose: 'SOLUTION', durationRatio: 0.2, visualHint: 'Dynamic transformation' },
    { label: 'After', purpose: 'BENEFIT', durationRatio: 0.3, visualHint: 'Improved state (bright/clear)' },
    { label: 'CTA', purpose: 'CTA', durationRatio: 0.2, visualHint: 'Brand + offer' },
  ],
  DETECTIVE: [
    { label: 'Mystery', purpose: 'HOOK', durationRatio: 0.2, visualHint: 'Intriguing question' },
    { label: 'Clues', purpose: 'PROBLEM', durationRatio: 0.3, visualHint: 'Evidence accumulation' },
    { label: 'Revelation', purpose: 'SOLUTION', durationRatio: 0.3, visualHint: 'Aha! moment' },
    { label: 'CTA', purpose: 'CTA', durationRatio: 0.2, visualHint: 'Brand resolution' },
  ],
  EDUCATIONAL: [
    { label: 'Question', purpose: 'HOOK', durationRatio: 0.15, visualHint: 'Curiosity gap' },
    { label: 'Concept', purpose: 'EDUCATION', durationRatio: 0.35, visualHint: 'Animated explanation' },
    { label: 'Application', purpose: 'PROOF', durationRatio: 0.3, visualHint: 'Real-world example' },
    { label: 'Summary', purpose: 'CTA', durationRatio: 0.2, visualHint: 'Key takeaway + brand' },
  ],
  HERO_JOURNEY: [
    { label: 'Ordinary World', purpose: 'HOOK', durationRatio: 0.15, visualHint: 'Status quo' },
    { label: 'Call to Adventure', purpose: 'PROBLEM', durationRatio: 0.15, visualHint: 'Inciting incident' },
    { label: 'Trials', purpose: 'PROBLEM', durationRatio: 0.3, visualHint: 'Challenges overcome' },
    { label: 'Reward', purpose: 'SOLUTION', durationRatio: 0.2, visualHint: 'Achievement moment' },
    { label: 'Return', purpose: 'CTA', durationRatio: 0.2, visualHint: 'Brand promise' },
  ],
};

/** Select structure based on subject info */
function selectStructure(subject: SubjectInfo): StoryOutline['structure'] {
  switch (subject.territory) {
    case 'TRANSFORMATION': return 'BEFORE_AFTER';
    case 'HUMAN_IMPACT': return 'HERO_JOURNEY';
    case 'PRECISION': return subject.tone === 'TECHNICAL' ? 'EDUCATIONAL' : 'THREE_ACT';
    case 'SCALE': return 'THREE_ACT';
    case 'PLAY': return 'PROBLEM_SOLUTION';
    default: return 'THREE_ACT';
  }
}

/** Map entities to beats based on relevance */
function assignEntitiesToBeats(beats: Omit<StoryBeat, 'id' | 'entities'>[], entities: Entity[]): StoryBeat[] {
  return beats.map((beat, i) => ({
    ...beat,
    id: `beat-${i + 1}`,
    entities: entities.filter(e => {
      const label = beat.label.toLowerCase();
      if (e.type === 'BRAND' && (label.includes('brand') || label.includes('cta') || label.includes('resolution'))) return true;
      if (e.type === 'PRODUCT' && (label.includes('solution') || label.includes('product') || label.includes('reveal'))) return true;
      if (e.type === 'SERVICE' && (label.includes('solution') || label.includes('service'))) return true;
      if (e.type === 'AUDIENCE' && (label.includes('hook') || label.includes('problem'))) return true;
      return false;
    }),
  }));
}

export class StoryEngine {
  /**
   * Deterministic story planning based on subject info.
   * Returns structured beats with timing ratios and visual hints.
   */
  async planStory(subject: SubjectInfo): Promise<StoryOutline> {
    const structure = selectStructure(subject);
    const template = STRUCTURES[structure];
    const beats = assignEntitiesToBeats(template, subject.keyEntities);

    // Normalize duration ratios to sum to 1
    const totalRatio = beats.reduce((sum, b) => sum + b.durationRatio, 0);
    const normalizedBeats = beats.map(b => ({
      ...b,
      durationRatio: Math.round((b.durationRatio / totalRatio) * 1000) / 1000,
    }));

    return {
      beats: normalizedBeats,
      structure,
      totalBeats: normalizedBeats.length,
    };
  }
}

export default StoryEngine;