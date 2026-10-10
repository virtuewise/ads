/**
 * Brand Context Schema
 * Normalized immutable context that flows through every creative decision.
 */

export interface BrandIdentity {
  name: string;
  tagline: string;
  positioning: string;
  pillars: string[];
}

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

export interface CreativeDNA {
  territories: string[];
  signatures: string[];
  antiGenericPrinciples: string[];
  creativeDevices: string[];
  forbiddenPatterns: string[];
}

export interface VisualSystem {
  designPhilosophy: string;
  elements: string[];
  compositionPrinciples: string[];
  motionPrinciples: string[];
  colorApproach: string;
}

export interface TypographySystem {
  primaryFont: string;
  secondaryFont: string;
  kineticBehaviors: string[];
  principles: Record<string, string | boolean>;
}

export interface ColorSystem {
  primary: string;
  secondary: string;
  neutrals: string[];
  accents: string[];
  semantic: Record<string, string>;
}

export interface MotionLanguage {
  personalities: string[];
  timingPrinciples: string[];
  transitionLanguage: string[];
  avoidPatterns: string[];
}

export interface ServiceDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  customerProblems: string[];
  applications: string[];
  visualOpportunities: string[];
  proofAssets: string[];
  campaignAngles: string[];
  ctaOptions: string[];
}

export interface MessagingSystem {
  coreMessages: Record<string, string>;
  valuePropositions: Array<{ headline: string; body: string }>;
  proofPoints: string[];
  ctaLibrary: Record<string, string[]>;
}

export interface ForbiddenStyle {
  category: string;
  description: string;
  indicators: string[];
  weight: number;
}

export interface LogoRules {
  filePath: string;
  clearSpace: string;
  minimumSize: Record<string, string>;
  colorUsage: string[];
  incorrectUsage: string[];
}

export interface BrandContext {
  identity: BrandIdentity;
  personality: BrandPersonality;
  voice: BrandVoice;
  creativeDNA: CreativeDNA;
  visualSystem: VisualSystem;
  typography: TypographySystem;
  colors: ColorSystem;
  motion: MotionLanguage;
  services: ServiceDefinition[];
  messaging: MessagingSystem;
  forbiddenStyles: ForbiddenStyle[];
  logoRules: LogoRules;
}
