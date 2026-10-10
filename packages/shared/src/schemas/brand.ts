/**
 * PrintSync Brand Schema
 * Defines the structure for brand data that the creative engine reads.
 */

export interface BrandPersonality {
  traits: string[];
  creativeRule: string;
  coreMessage: string;
  visualPrinciple: string;
  motionPrinciple: string;
}

export interface BrandVoice {
  primary: string;
  secondary: string;
  avoid: string;
  toneExamples: Record<string, string>;
}

export interface BrandAudience {
  primary: string;
  secondary: string;
  decision_makers: string[];
}

export interface Brand {
  name: string;
  tagline: string;
  positioning: string;
  personality: BrandPersonality;
  voice: BrandVoice;
  audience: BrandAudience;
  brand_pillars: string[];
  competitors: {
    positioning: string;
    differentiation: string;
  };
}

export interface BrandColors {
  primary: {
    red: ColorDefinition;
  };
  secondary: {
    charcoal: ColorDefinition;
  };
  neutrals: {
    white: ColorDefinition;
    lightGray: ColorDefinition;
    mediumGray: ColorDefinition;
  };
  accents: {
    cyan: ColorDefinition;
    magenta: ColorDefinition;
    yellow: ColorDefinition;
    black: ColorDefinition;
  };
  semantic: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
}

export interface ColorDefinition {
  hex: string;
  rgb: [number, number, number];
  cmyk?: [number, number, number, number];
  pantone?: string;
  usage: string;
}

export interface BrandTypography {
  primary: FontDefinition;
  secondary: FontDefinition;
  kinetic_behaviors: string[];
  principles: {
    type_is_character: boolean;
    never_decorative_without_purpose: boolean;
    precision_over_decoration: boolean;
    kinetic_intent: string;
  };
}

export interface FontDefinition {
  family: string;
  fallback: string[];
  weights: Record<string, number>;
  usage: string;
}

export interface BrandAsset {
  id: string;
  type: 'logo' | 'font' | 'image' | 'video' | 'audio';
  path: string;
  metadata: Record<string, unknown>;
}
