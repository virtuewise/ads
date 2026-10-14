/**
 * Creative Director
 * The first intelligence layer. Generates concepts, selects the strongest,
 * and ensures every idea meets PrintSync's creative standards.
 */

import type {
  Concept,
  CreativeBrief,
  CreativeHistoryEntry,
  CreativeMode,
  CreativeTerritory,
  Mood,
  NarrativeStructure,
  Pace,
  VisualStyle,
  VoiceMode,
} from '@printsync/shared';
import { checkAntiGeneric } from './anti-generic.js';
import { CREATIVE_MODES } from './modes.js';
import { getStoryTemplate } from './story-grammar.js';

// ─── Concept Generation ──────────────────────────────────────────────────────

interface ConceptSeed {
  title: string;
  logline: string;
  key_visual: string;
  story_summary: string;
  cta: string;
}

const CONCEPT_LIBRARY: Record<string, ConceptSeed[]> = {
  'large-format-printing': [
    {
      title: 'BIG IDEAS NEED BIG PRINT',
      logline: 'When your idea is too big for ordinary print, it needs PrintSync large format.',
      key_visual: 'A business card grows into a building-sized banner, transforming the cityscape.',
      story_summary:
        'Follow a single idea as it scales from a tiny business card to a massive building wrap, showing how PrintSync large-format printing transforms visibility.',
      cta: 'Go big with PrintSync',
    },
    {
      title: 'IMPOSSIBLE TO IGNORE',
      logline: 'Some brands blend in. PrintSync brands stand out.',
      key_visual:
        'A dull street transforms as vibrant large-format prints appear on every surface.',
      story_summary:
        'A monotonous urban environment comes alive as PrintSync large-format prints transform buildings, vehicles, and spaces into brand experiences.',
      cta: 'Transform your visibility',
    },
    {
      title: 'FROM SCREEN TO SOMETHING REAL',
      logline: 'Digital ambition meets physical impact.',
      key_visual:
        'A digital design on screen physically prints itself into a massive outdoor installation.',
      story_summary:
        'Watch a digital design journey from screen to physical reality through PrintSync large-format printing, becoming an impossible-to-miss outdoor installation.',
      cta: 'Make it real',
    },
  ],
  'digital-printing': [
    {
      title: 'EVERY COPY PERFECT',
      logline: '3,000 copies. Zero compromise.',
      key_visual: 'A production line of identical perfect prints, each one flawless.',
      story_summary:
        'A high-speed digital printing production line produces thousands of identical, perfect prints — each one meeting the same exacting standard.',
      cta: 'Start your print order',
    },
    {
      title: 'THE PRINT ENGINE',
      logline: 'Precision-engineered printing for brands that refuse to blend in.',
      key_visual: 'A mechanical engine made of print components — gears of paper, pistons of ink.',
      story_summary:
        'A mechanical engine constructed from print components comes to life, showing how PrintSync digital printing is precision-engineered for maximum impact.',
      cta: 'Engineer your brand',
    },
  ],
  signage: [
    {
      title: 'BE SEEN',
      logline: 'Signage that works as hard as you do.',
      key_visual: 'A dark street illuminated by a single, perfectly crafted sign.',
      story_summary:
        'A dark, quiet street is transformed by a single, perfectly crafted PrintSync sign — proving that great signage is impossible to ignore.',
      cta: 'Get noticed',
    },
    {
      title: 'THE CASE OF THE INVISIBLE BRAND',
      logline: 'A detective investigates why a business is not being noticed.',
      key_visual: 'A detective examines faded, broken signage under a magnifying glass.',
      story_summary:
        'A print detective investigates why a business is invisible, discovering faded signage and weak branding — then reveals the PrintSync solution.',
      cta: 'Solve your visibility problem',
    },
  ],
  branding: [
    {
      title: 'BRAND WITH PRECISION',
      logline: 'Identity that works. Every touchpoint. Every time.',
      key_visual: 'A brand identity system assembling itself across multiple touchpoints.',
      story_summary:
        'Watch a complete brand identity system assemble itself across stationery, signage, packaging, and digital — all perfectly consistent, all PrintSync precision.',
      cta: 'Build your brand',
    },
    {
      title: 'YOUR VISION. OUR PRECISION.',
      logline: 'The core PrintSync promise, visualized.',
      key_visual: 'A vision (abstract light) being shaped into precise physical form.',
      story_summary:
        'An abstract vision of light and color is shaped, refined, and transformed into precise physical brand materials — the PrintSync promise made visible.',
      cta: 'Start your brand',
    },
  ],
  default: [
    {
      title: 'IDEAS BECOMING PHYSICAL IMPACT',
      logline: 'The PrintSync visual principle, brought to life.',
      key_visual:
        'Abstract ideas (light, data, typography) transforming into physical print objects.',
      story_summary:
        'Abstract ideas — light, data, typography — transform into tangible print objects, showing how PrintSync turns concepts into physical brand experiences.',
      cta: 'Create with PrintSync',
    },
    {
      title: 'PRECISION IN MOTION',
      logline: 'Every movement intentional. Every detail perfect.',
      key_visual: 'A printing press in motion, each component moving with mechanical precision.',
      story_summary:
        'A printing press operates in perfect mechanical harmony, each component moving with precision — the PrintSync motion principle visualized.',
      cta: 'Experience precision',
    },
    {
      title: 'FROM IDEA TO IMPACT',
      logline: 'The complete PrintSync journey.',
      key_visual: 'A single idea traveling through design, production, and installation.',
      story_summary:
        'Follow a single idea through the complete PrintSync journey — from digital design through precision production to real-world impact.',
      cta: 'Start your journey',
    },
  ],
};

export class CreativeDirector {
  private history: CreativeHistoryEntry[];

  constructor(history: CreativeHistoryEntry[] = []) {
    this.history = history;
  }

  /**
   * Generate multiple concepts for a brief.
   * Returns 10 concepts internally, but only the strongest 3 are marked for development.
   */
  generateConcepts(brief: CreativeBrief): Concept[] {
    const seeds = this.getConceptSeeds(brief);
    const concepts: Concept[] = [];

    for (let i = 0; i < 10; i++) {
      const seed = seeds[i % seeds.length]!;
      const mode = this.selectCreativeMode(brief, i);
      const territory = this.selectTerritory(brief, i);
      const mood = this.selectMood(brief, i);
      const pace = this.selectPace(brief, i);
      const voiceMode = brief.voice_mode || this.selectVoiceMode(mode, i);
      const narrative = this.selectNarrativeStructure(i);

      const concept: Concept = {
        id: `concept_${Date.now()}_${i}`,
        title: seed.title,
        logline: seed.logline,
        creative_mode: mode,
        narrative_structure: narrative,
        territory,
        mood,
        visual_style: this.selectVisualStyle(brief, i),
        pace,
        voice_mode: voiceMode,
        key_visual: seed.key_visual,
        story_summary: seed.story_summary,
        target_duration_seconds: this.estimateDuration(mode, brief),
        formats: brief.formats,
        cta: seed.cta,
      };

      // Run anti-generic check
      const antiGeneric = checkAntiGeneric(concept, this.history);
      if (!antiGeneric.passed) {
        // Mark for rework but still include
        concept.score = {
          brand_fit: 5,
          originality: 5,
          commercial_value: 5,
          visual_potential: 5,
          emotional_impact: 5,
          memorability: 5,
          social_stop_power: 5,
          production_quality: 5,
          service_relevance: 5,
          non_generic_quality: 0,
          total: 5,
          status: 'REJECT',
          feedback: antiGeneric.issues,
        };
      }

      concepts.push(concept);
    }

    return concepts;
  }

  /**
   * Select the top 3 concepts after scoring.
   */
  selectTopConcepts(concepts: Concept[]): Concept[] {
    return concepts
      .filter((c) => c.score === undefined || c.score.status !== 'REJECT')
      .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))
      .slice(0, 3);
  }

  /**
   * Develop the winning concept into a full creative treatment.
   */
  developConcept(concept: Concept): string {
    const template = getStoryTemplate(concept.narrative_structure);
    const mode = CREATIVE_MODES[concept.creative_mode];

    let treatment = `# ${concept.title}\n\n`;
    treatment += `## Logline\n${concept.logline}\n\n`;
    treatment += `## Creative Mode\n${mode.name} — ${mode.description}\n\n`;
    treatment += `## Territory\n${concept.territory}\n\n`;
    treatment += `## Mood\n${concept.mood}\n\n`;
    treatment += `## Visual Style\n${concept.visual_style}\n\n`;
    treatment += `## Pace\n${concept.pace}\n\n`;
    treatment += `## Voice\n${concept.voice_mode}\n\n`;
    treatment += `## Key Visual\n${concept.key_visual}\n\n`;
    treatment += `## Story Summary\n${concept.story_summary}\n\n`;

    if (template) {
      treatment += `## Story Structure\n${template.name}\n\n`;
      treatment += `### Beats\n`;
      for (const beat of template.beats) {
        treatment += `- **${beat.name}** (${beat.duration_seconds}s): ${beat.description}\n`;
        treatment += `  - Visual: ${beat.visual_description}\n`;
        treatment += `  - Audio: ${beat.audio_description}\n`;
      }
      treatment += '\n';
    }
    void template;

    treatment += `## CTA\n${concept.cta}\n\n`;
    treatment += `## Target Duration\n${concept.target_duration_seconds}s\n\n`;
    treatment += `## Formats\n${concept.formats.join(', ')}\n`;

    return treatment;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private getConceptSeeds(brief: CreativeBrief): ConceptSeed[] {
    const serviceKey = brief.service.toLowerCase().replace(/\s+/g, '-');
    return CONCEPT_LIBRARY[serviceKey] ?? CONCEPT_LIBRARY['default']!;
  }

  private selectCreativeMode(brief: CreativeBrief, index: number): CreativeMode {
    if (brief.creative_mode) return brief.creative_mode;

    const modes = Object.keys(CREATIVE_MODES) as CreativeMode[];
    // Rotate through modes based on history to avoid repetition
    const recentModes = this.history.slice(-3).map((h) => h.creative_mode);
    const available = modes.filter((m) => !recentModes.includes(m));
    return available[index % available.length] ?? modes[index % modes.length]!;
  }

  private selectTerritory(brief: CreativeBrief, index: number): CreativeTerritory {
    if (brief.territory) return brief.territory;

    const territories: CreativeTerritory[] = [
      'PRECISION',
      'TRANSFORMATION',
      'SCALE',
      'HUMAN_IMPACT',
      'PLAY',
    ];
    const recentTerritories = this.history.slice(-3).map((h) => h.territory);
    const available = territories.filter((t: CreativeTerritory) => !recentTerritories.includes(t));
    return available[index % available.length] ?? territories[index % territories.length]!;
  }

  private selectMood(brief: CreativeBrief, index: number): Mood {
    if (brief.mood) return brief.mood;

    const moods: Mood[] = ['cinematic', 'playful', 'technical', 'minimal', 'dramatic'];
    const recentMoods = this.history.slice(-3).map((h) => h.mood);
    const available = moods.filter((m) => !recentMoods.includes(m));
    return available[index % available.length] ?? moods[index % moods.length]!;
  }

  private selectVisualStyle(brief: CreativeBrief, index: number): VisualStyle {
    if (brief.visual_style) return brief.visual_style;

    const styles: VisualStyle[] = ['typography', 'product', 'vfx', 'live_action', 'mixed'];
    const recentStyles = this.history.slice(-3).map((h) => h.visual_style as string);
    const available = styles.filter((s) => !recentStyles.includes(s));
    return available[index % available.length] ?? styles[index % styles.length]!;
  }

  private selectPace(brief: CreativeBrief, index: number): Pace {
    if (brief.pace) return brief.pace;

    const paces: Pace[] = ['slow_premium', 'fast_energetic', 'rhythmic'];
    return paces[index % paces.length]!;
  }

  private selectVoiceMode(mode: CreativeMode, index: number): VoiceMode {
    const modeDef = CREATIVE_MODES[mode];
    if (modeDef.default_voice_mode) return modeDef.default_voice_mode;

    const modes: VoiceMode[] = ['VOICEOVER', 'TYPOGRAPHY_ONLY', 'MUSIC_ONLY', 'DIALOGUE', 'HYBRID'];
    return modes[index % modes.length]!;
  }

  private selectNarrativeStructure(index: number): NarrativeStructure {
    const structures: NarrativeStructure[] = [
      'PROBLEM_TENSION_DISCOVERY_TRANSFORMATION_PROOF_BRAND',
      'MYSTERY_CLUE_INVESTIGATION_REVEAL_PRODUCT_CTA',
      'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
      'CHAOS_PRECISION_CONTROL_RESULT',
      'BORING_PRINTSYNC_TRANSFORMATION',
      'DIGITAL_PHYSICAL_EXPERIENCE',
    ];
    const recentStructures = this.history.slice(-3).map((h) => h.narrative_structure);
    const available = structures.filter((s: NarrativeStructure) => !recentStructures.includes(s));
    return available[index % available.length] ?? structures[index % structures.length]!;
  }

  private estimateDuration(mode: CreativeMode, brief: CreativeBrief): number {
    const modeDef = CREATIVE_MODES[mode];
    if (brief.formats.includes('9:16') && brief.formats.includes('1:1')) {
      return Math.min(modeDef.typical_duration_seconds, 15);
    }
    return modeDef.typical_duration_seconds;
  }
}
