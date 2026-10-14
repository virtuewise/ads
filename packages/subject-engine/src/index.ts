// Subject Engine – analyses a brief into subject insights
import type { CreativeBrief } from '@printsync/common';

export interface Entity {
  name: string;
  type: 'BRAND' | 'PRODUCT' | 'SERVICE' | 'CONCEPT' | 'AUDIENCE' | 'COMPETITOR' | 'METRIC';
  confidence: number; // 0-1
  mentions: number;
}

export interface SubjectInfo {
  keyEntities: Entity[];
  primaryGoal: Goal;
  secondaryGoals: Goal[];
  targetAudience: string[];
  keyMessages: string[];
  tone: 'CINEMATIC' | 'TECHNICAL' | 'PLAYFUL' | 'DRAMATIC' | 'MINIMAL';
  territory: 'TRANSFORMATION' | 'SCALE' | 'HUMAN_IMPACT' | 'PRECISION' | 'PLAY';
}

export interface Goal {
  description: string;
  type: 'AWARENESS' | 'CONVERSION' | 'EDUCATION' | 'ENGAGEMENT' | 'LOYALTY';
  priority: number; // 1-10
}

/** Heuristic entity extraction from brief text */
function extractEntities(brief: CreativeBrief): Entity[] {
  const text = `${brief.title} ${brief.objective} ${brief.service}`.toLowerCase();
  const entities: Entity[] = [];

  // Brand detection
  if (text.includes('printsync')) {
    entities.push({ name: 'PrintSync', type: 'BRAND', confidence: 0.95, mentions: 1 });
  }

  // Product/Service type classification
  const serviceMap: Record<string, Entity['type']> = {
    print: 'PRODUCT',
    signage: 'PRODUCT',
    branding: 'SERVICE',
    design: 'SERVICE',
    campaign: 'SERVICE',
  };

  for (const [keyword, type] of Object.entries(serviceMap)) {
    if (text.includes(keyword)) {
      entities.push({ name: keyword, type, confidence: 0.8, mentions: 1 });
    }
  }

  // Audience hints
  const audienceKeywords = ['enterprise', 'smb', 'consumer', 'b2b', 'b2c', 'retail', 'corporate'];
  for (const kw of audienceKeywords) {
    if (text.includes(kw)) {
      entities.push({ name: kw, type: 'AUDIENCE', confidence: 0.7, mentions: 1 });
    }
  }

  // Deduplicate by name
  const seen = new Set<string>();
  return entities.filter((e) => {
    if (seen.has(e.name.toLowerCase())) return false;
    seen.add(e.name.toLowerCase());
    return true;
  });
}

/** Classify primary goal from objective text */
function classifyGoal(objective: string): Goal {
  const obj = objective.toLowerCase();
  if (obj.includes('awareness') || obj.includes('reach') || obj.includes('visibility')) {
    return { description: objective, type: 'AWARENESS', priority: 9 };
  }
  if (
    obj.includes('convert') ||
    obj.includes('sales') ||
    obj.includes('lead') ||
    obj.includes('signup')
  ) {
    return { description: objective, type: 'CONVERSION', priority: 10 };
  }
  if (
    obj.includes('educate') ||
    obj.includes('explain') ||
    obj.includes('teach') ||
    obj.includes('demo')
  ) {
    return { description: objective, type: 'EDUCATION', priority: 8 };
  }
  if (obj.includes('engage') || obj.includes('interact') || obj.includes('community')) {
    return { description: objective, type: 'ENGAGEMENT', priority: 7 };
  }
  if (obj.includes('loyal') || obj.includes('retain') || obj.includes('advocate')) {
    return { description: objective, type: 'LOYALTY', priority: 6 };
  }
  return { description: objective, type: 'AWARENESS', priority: 5 };
}

/** Infer tone from mode and mood keywords */
function inferTone(brief: CreativeBrief): SubjectInfo['tone'] {
  const mode = brief.mode.toUpperCase();
  if (mode.includes('CINEMATIC') || mode.includes('BRAND_FILM') || mode.includes('STORY'))
    return 'CINEMATIC';
  if (mode.includes('TECHNICAL') || mode.includes('EDUCATIONAL') || mode.includes('INFOGRAPHIC'))
    return 'TECHNICAL';
  if (mode.includes('HUMOR') || mode.includes('PLAY') || mode.includes('UGC')) return 'PLAYFUL';
  if (mode.includes('DRAMATIC') || mode.includes('TRANSFORMATION') || mode.includes('BEFORE_AFTER'))
    return 'DRAMATIC';
  return 'MINIMAL';
}

/** Infer territory from mode */
function inferTerritory(brief: CreativeBrief): SubjectInfo['territory'] {
  const mode = brief.mode.toUpperCase();
  if (mode.includes('TRANSFORMATION') || mode.includes('BEFORE_AFTER')) return 'TRANSFORMATION';
  if (mode.includes('SCALE') || mode.includes('CORPORATE')) return 'SCALE';
  if (mode.includes('HUMAN') || mode.includes('TESTIMONIAL') || mode.includes('CASE_STUDY'))
    return 'HUMAN_IMPACT';
  if (mode.includes('PRECISION') || mode.includes('PRODUCT') || mode.includes('TYPOGRAPHIC'))
    return 'PRECISION';
  return 'PLAY';
}

export class SubjectEngine {
  /**
   * Analyze the brief and extract high-level subject information.
   * Deterministic, frame-addressable, no external dependencies.
   */
  async analyze(brief: CreativeBrief): Promise<SubjectInfo> {
    const entities = extractEntities(brief);
    const primaryGoal = classifyGoal(brief.objective);

    // Secondary goals from scenes
    const secondaryGoals: Goal[] = brief.scenes
      .map((s) => classifyGoal(s))
      .filter((g, i, arr) => arr.findIndex((x) => x.type === g.type) === i)
      .slice(0, 3);

    // Audience from scenes and service
    const targetAudience = [
      ...new Set(
        brief.scenes
          .flatMap((s) => s.toLowerCase().split(/[\s,]+/))
          .filter((w) =>
            [
              'enterprise',
              'smb',
              'consumer',
              'b2b',
              'b2c',
              'retail',
              'corporate',
              'developers',
              'marketers',
            ].includes(w),
          ),
      ),
    ];

    // Key messages from title + objective
    const keyMessages = [brief.title, brief.objective].filter(Boolean);

    return {
      keyEntities: entities,
      primaryGoal,
      secondaryGoals,
      targetAudience: targetAudience.length ? targetAudience : ['general'],
      keyMessages,
      tone: inferTone(brief),
      territory: inferTerritory(brief),
    };
  }
}

export default SubjectEngine;
