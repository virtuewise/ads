// Script Engine – deterministic script generation
import type {
  CreativeBrief,
  Script,
  ScriptStep,
  StoryOutline,
  VisualGrammar,
} from '@printsync/common';
import type { SubjectInfo } from '@printsync/subject-engine';

export const SCRIPT_ENGINE_VERSION = '1.0.0';

/** Dialogue templates per voice mode */
const DIALOGUE_TEMPLATES: Record<string, Record<string, string>> = {
  NARRATION: {
    HOOK: 'In a world where {problem}, one solution stands apart.',
    PROBLEM: 'The challenge is clear: {problem}.',
    SOLUTION: 'Enter {brand} — {solution}.',
    PROOF: 'The results speak for themselves: {proof}.',
    BENEFIT: 'That means {benefit} for you.',
    CTA: 'Discover {brand} today.',
  },
  DIALOGUE: {
    HOOK: '"We needed something better."',
    PROBLEM: '"The old way just wasn\'t working."',
    SOLUTION: '"Then we found {brand}."',
    PROOF: '"The difference was immediate."',
    BENEFIT: '"Now everything flows."',
    CTA: '"You should see this."',
  },
  TYPOGRAPHY_ONLY: {
    HOOK: '{hook}',
    PROBLEM: '{problem}',
    SOLUTION: '{brand}: {solution}',
    PROOF: '{proof}',
    BENEFIT: '{benefit}',
    CTA: '{brand}',
  },
  MUSIC_ONLY: {},
  HYBRID: {},
};

/** Generate dialogue for a beat */
function generateDialogue(
  beat: StoryOutline['beats'][0],
  brief: CreativeBrief,
  subject: SubjectInfo,
): string {
  const voice = brief.voice.toUpperCase();
  const templates = (DIALOGUE_TEMPLATES[voice] ?? DIALOGUE_TEMPLATES.NARRATION) as NonNullable<
    (typeof DIALOGUE_TEMPLATES)[typeof voice]
  >;
  const template = templates[beat.purpose] ?? templates.HOOK ?? '';

  const brand = subject.keyEntities.find((e) => e.type === 'BRAND')?.name || 'PrintSync';
  const problem = subject.primaryGoal.description;
  const solution = subject.keyMessages[1] || 'the solution you need';
  const proof = 'proven results';
  const benefit = 'better outcomes';
  const hook = subject.keyMessages[0] || 'Attention';

  return template
    .replace('{brand}', brand)
    .replace('{problem}', problem)
    .replace('{solution}', solution)
    .replace('{proof}', proof)
    .replace('{benefit}', benefit)
    .replace('{hook}', hook);
}

/** Generate visual description for a beat */
function generateVisual(beat: StoryOutline['beats'][0], visualGrammar: VisualGrammar): string {
  return `${visualGrammar.name} — ${beat.visualHint}: ${beat.label}`;
}

/** Generate camera direction for a beat */
function generateCamera(beat: StoryOutline['beats'][0]): string {
  const cameraMap: Record<string, string> = {
    HOOK: 'WIDE ESTABLISHING, SLOW PUSH IN',
    PROBLEM: 'HANDHELD CLOSE-UPS, QUICK CUTS',
    SOLUTION: 'SMOOTH TRACKING, PRODUCT ROTATION',
    PROOF: 'SPLIT SCREEN, DATA VISUALIZATION',
    BENEFIT: 'WARM LIGHTING, HUMAN SCALE',
    CTA: 'STATIC, BRAND CENTER FRAME',
    EDUCATION: 'TOP-DOWN, ANNOTATED',
    BRAND: 'HERO SHOT, LOGO LOCKUP',
  };
  return cameraMap[beat.purpose] || 'STATIC, 35mm';
}

export class ScriptEngine {
  /**
   * Generate a script based on brief, subject info, visual grammar and story outline.
   * Deterministic: splits duration across beats, generates dialogue/visual/camera per beat.
   */
  async generateScript(params: {
    brief: CreativeBrief;
    subjectInfo: SubjectInfo;
    visualGrammar: VisualGrammar;
    storyOutline: StoryOutline;
    seed?: string;
  }): Promise<Script> {
    const { brief, storyOutline, visualGrammar, subjectInfo } = params;
    const totalDuration = brief.duration;
    const beats = storyOutline.beats;

    // Allocate time per beat by ratio
    let cursor = 0;
    const steps: ScriptStep[] = [];

    for (const beat of beats) {
      const duration = totalDuration * beat.durationRatio;
      const start = cursor;
      const end = Math.min(cursor + duration, totalDuration);

      const visual = generateVisual(beat, visualGrammar);
      const dialogue = generateDialogue(beat, brief, subjectInfo);
      const camera = generateCamera(beat);

      steps.push({
        start: Math.round(start * 100) / 100,
        end: Math.round(end * 100) / 100,
        visual,
        dialogue,
        camera,
        text: beat.label,
      });

      cursor = end;
    }

    return { steps };
  }

  /** Generate voiceover script from steps */
  generateVoiceover(steps: ScriptStep[]): string[] {
    return steps.filter((s) => s.dialogue && s.dialogue.trim()).map((s) => s.dialogue!);
  }
}

export default ScriptEngine;
