/**
 * Story Grammar Engine
 * Defines narrative structures and generates story beats.
 */

import type { NarrativeStructure, StoryBeat, StoryGrammar } from '@printsync/shared';

interface StoryTemplate {
  structure: NarrativeStructure;
  name: string;
  description: string;
  beats: Omit<StoryBeat, 'id'>[];
}

const STORY_TEMPLATES: StoryTemplate[] = [
  {
    structure: 'PROBLEM_TENSION_DISCOVERY_TRANSFORMATION_PROOF_BRAND',
    name: 'Problem-Solution',
    description: 'Classic problem-solution narrative arc',
    beats: [
      {
        name: 'PROBLEM',
        description: 'Establish the customer pain point',
        duration_seconds: 5,
        visual_description: 'Show the problem in a relatable, visually striking way',
        audio_description: 'Tension building, problem-focused sound design',
      },
      {
        name: 'TENSION',
        description: 'Amplify the problem and its impact',
        duration_seconds: 5,
        visual_description: 'Escalate the visual tension, show consequences',
        audio_description: 'Rising tension, urgency in sound',
      },
      {
        name: 'DISCOVERY',
        description: 'Introduce PrintSync as the solution',
        duration_seconds: 5,
        visual_description: 'The reveal — PrintSync appears as the answer',
        audio_description: 'Resolution, hope, brand introduction',
      },
      {
        name: 'TRANSFORMATION',
        description: 'Show the transformation in action',
        duration_seconds: 8,
        visual_description: 'Before/after, process, the magic of print',
        audio_description: 'Energetic, transformative sound design',
      },
      {
        name: 'PROOF',
        description: 'Demonstrate results and credibility',
        duration_seconds: 4,
        visual_description: 'Finished product, real-world application, quality',
        audio_description: 'Confidence, proof, satisfaction',
      },
      {
        name: 'BRAND',
        description: 'Brand reveal and CTA',
        duration_seconds: 3,
        visual_description: 'PrintSync logo, tagline, call to action',
        audio_description: 'Brand anthem, memorable closing',
      },
    ],
  },
  {
    structure: 'MYSTERY_CLUE_INVESTIGATION_REVEAL_PRODUCT_CTA',
    name: 'Mystery Detective',
    description: 'Detective investigates a brand problem',
    beats: [
      {
        name: 'MYSTERY',
        description: 'Open with a mysterious brand problem',
        duration_seconds: 5,
        visual_description: 'CASE FILE 001 — a business is invisible',
        audio_description: 'Mysterious, investigative tone',
      },
      {
        name: 'CLUE',
        description: 'Discover clues about the problem',
        duration_seconds: 5,
        visual_description: 'Evidence: old sign, low visibility, boring branding',
        audio_description: 'Investigative, clue-by-clue sound',
      },
      {
        name: 'INVESTIGATION',
        description: 'Detective examines the evidence',
        duration_seconds: 8,
        visual_description: 'Close-ups of evidence, technical analysis',
        audio_description: 'Analytical, methodical sound design',
      },
      {
        name: 'REVEAL',
        description: 'The solution is revealed',
        duration_seconds: 5,
        visual_description: 'WE FOUND THE PROBLEM — and the solution',
        audio_description: 'Revelation, dramatic reveal',
      },
      {
        name: 'PRODUCT',
        description: 'PrintSync solution in action',
        duration_seconds: 5,
        visual_description: 'PrintSync transforms the business',
        audio_description: 'Confident, solution-focused',
      },
      {
        name: 'CTA',
        description: 'Case closed, brand reveal',
        duration_seconds: 2,
        visual_description: 'CASE CLOSED. PrintSync.',
        audio_description: 'Satisfying closure, brand anthem',
      },
    ],
  },
  {
    structure: 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
    name: 'Creation Process',
    description: 'Follow the journey from idea to impact',
    beats: [
      {
        name: 'IDEA',
        description: 'The spark of an idea',
        duration_seconds: 4,
        visual_description: 'Digital screen, concept, the beginning',
        audio_description: 'Spark, inspiration, digital pulse',
      },
      {
        name: 'DESIGN',
        description: 'Design and refinement',
        duration_seconds: 5,
        visual_description: 'Design process, typography, color, layout',
        audio_description: 'Creative, design-focused sound',
      },
      {
        name: 'MACHINE',
        description: 'Production begins',
        duration_seconds: 5,
        visual_description: 'Printing machinery, precision, production line',
        audio_description: 'Mechanical, rhythmic, industrial',
      },
      {
        name: 'MATERIAL',
        description: 'Material and substrate',
        duration_seconds: 4,
        visual_description: 'Paper, vinyl, metal, texture, quality',
        audio_description: 'Tactile, material-focused sound',
      },
      {
        name: 'SCALE',
        description: 'Scale and impact',
        duration_seconds: 5,
        visual_description: 'From small to enormous, poster to building',
        audio_description: 'Epic, scale-building sound',
      },
      {
        name: 'IMPACT',
        description: 'Real-world impact',
        duration_seconds: 7,
        visual_description: 'Installed, visible, making a difference',
        audio_description: 'Impactful, memorable, brand anthem',
      },
    ],
  },
  {
    structure: 'CHAOS_PRECISION_CONTROL_RESULT',
    name: 'Chaos to Control',
    description: 'From disorder to precision',
    beats: [
      {
        name: 'CHAOS',
        description: 'Visual and conceptual chaos',
        duration_seconds: 5,
        visual_description: 'Cluttered, inconsistent, messy branding',
        audio_description: 'Chaotic, dissonant sound',
      },
      {
        name: 'PRECISION',
        description: 'PrintSync brings order',
        duration_seconds: 5,
        visual_description: 'Grids, alignment, technical precision',
        audio_description: 'Order emerging, rhythmic precision',
      },
      {
        name: 'CONTROL',
        description: 'Full control over the process',
        duration_seconds: 5,
        visual_description: 'Production control, quality management',
        audio_description: 'Controlled, confident sound',
      },
      {
        name: 'RESULT',
        description: 'The perfect result',
        duration_seconds: 10,
        visual_description: 'Flawless execution, premium output',
        audio_description: 'Satisfying, premium, brand anthem',
      },
    ],
  },
  {
    structure: 'BORING_PRINTSYNC_TRANSFORMATION',
    name: 'Boring to Brilliant',
    description: 'Transformation from generic to premium',
    beats: [
      {
        name: 'BORING',
        description: 'The generic, forgettable state',
        duration_seconds: 5,
        visual_description: 'Generic, template-looking, forgettable',
        audio_description: 'Flat, uninspiring sound',
      },
      {
        name: 'PRINTSYNC',
        description: 'PrintSync enters',
        duration_seconds: 5,
        visual_description: 'PrintSync brand, quality, capability',
        audio_description: 'Brand introduction, rising energy',
      },
      {
        name: 'TRANSFORMATION',
        description: 'The dramatic transformation',
        duration_seconds: 15,
        visual_description: 'Complete visual and quality transformation',
        audio_description: 'Transformative, energetic, satisfying',
      },
    ],
  },
  {
    structure: 'DIGITAL_PHYSICAL_EXPERIENCE',
    name: 'Digital to Physical',
    description: 'From screen to something real',
    beats: [
      {
        name: 'DIGITAL',
        description: 'The digital concept',
        duration_seconds: 5,
        visual_description: 'Screen, pixels, digital design',
        audio_description: 'Digital, electronic sound',
      },
      {
        name: 'PHYSICAL',
        description: 'Becoming physical',
        duration_seconds: 10,
        visual_description: 'Ink, paper, print, material reality',
        audio_description: 'Material, tactile, real',
      },
      {
        name: 'EXPERIENCE',
        description: 'The human experience',
        duration_seconds: 10,
        visual_description: 'People interacting with the printed piece',
        audio_description: 'Human, emotional, memorable',
      },
    ],
  },
];

export function getStoryTemplate(structure: NarrativeStructure): StoryTemplate | undefined {
  return STORY_TEMPLATES.find((t) => t.structure === structure);
}

export function generateStoryGrammar(structure: NarrativeStructure): StoryGrammar {
  const template = getStoryTemplate(structure);
  if (!template) {
    throw new Error(`Unknown narrative structure: ${structure}`);
  }

  const beats: StoryBeat[] = template.beats.map((beat, index) => ({
    ...beat,
    id: `beat_${index}`,
  }));

  return {
    structure,
    beats,
  };
}

export function getAllStoryTemplates(): StoryTemplate[] {
  return STORY_TEMPLATES;
}

export function getStructuresByComplexity(): {
  simple: NarrativeStructure[];
  medium: NarrativeStructure[];
  complex: NarrativeStructure[];
} {
  return {
    simple: ['BORING_PRINTSYNC_TRANSFORMATION', 'CHAOS_PRECISION_CONTROL_RESULT'],
    medium: ['PROBLEM_TENSION_DISCOVERY_TRANSFORMATION_PROOF_BRAND', 'DIGITAL_PHYSICAL_EXPERIENCE'],
    complex: [
      'MYSTERY_CLUE_INVESTIGATION_REVEAL_PRODUCT_CTA',
      'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
    ],
  };
}
