/**
 * PrintSync Brand Engine
 * Authoritative interface between the rest of the system and PrintSync brand files.
 * The rest of the system should NOT directly read arbitrary brand JSON/Markdown files.
 * Everything flows through the Brand Engine.
 */

import type {
  BrandContext,
  BrandIdentity,
  BrandPersonality as BrandPersonalitySchema,
  BrandVoice as BrandVoiceSchema,
  ColorSystem,
  CreativeDNA,
  ForbiddenStyle,
  LogoRules,
  MessagingSystem,
  MotionLanguage,
  ServiceDefinition,
  TypographySystem,
  VisualSystem,
} from '@printsync/shared';

export interface BrandEngineConfig {
  brandPath: string;
  historyPath: string;
  autoSave: boolean;
}

/**
 * Load and normalize all PrintSync brand files into a single immutable context.
 */
export class BrandEngine {
  /** Brand file locations and options, retained for brand-file loading. */
  readonly config: BrandEngineConfig;

  constructor(config: BrandEngineConfig) {
    this.config = config;
  }

  private cachedContext: BrandContext | null = null;

  /**
   * Load the complete PrintSync brand context.
   * This is the primary entry point for all creative decisions.
   */
  async load(): Promise<BrandContext> {
    if (this.cachedContext) return this.cachedContext;

    const context: BrandContext = {
      identity: this.getBrandIdentity(),
      personality: this.getBrandPersonality(),
      voice: this.getBrandVoice(),
      creativeDNA: this.getCreativeDNA(),
      visualSystem: this.getVisualSystem(),
      typography: this.getTypographySystem(),
      colors: this.getColorSystem(),
      motion: this.getMotionLanguage(),
      services: this.getServices(),
      messaging: this.getMessaging(),
      forbiddenStyles: this.getForbiddenStyles(),
      logoRules: this.getLogoRules(),
    };

    this.cachedContext = context;
    return context;
  }

  /**
   * Get normalized brand identity.
   */
  getBrandIdentity(): BrandIdentity {
    return {
      name: 'PrintSync',
      tagline: 'Your Vision. Our Precision.',
      positioning:
        'Premium printing, branding, signage and visual communication solutions that transform ideas into tangible brand experiences.',
      pillars: ['CONSISTENCY', 'PERSEVERANCE', 'CREATIVITY', 'PRECISION'],
    };
  }

  /**
   * Get brand personality traits.
   */
  getBrandPersonality(): BrandPersonalitySchema {
    return {
      traits: [
        'precise',
        'creative',
        'intelligent',
        'modern',
        'reliable',
        'ambitious',
        'technically capable',
        'premium',
        'energetic',
        'persistent',
        'detail-oriented',
        'confident',
      ],
      creativeRule: 'Never look generic.',
      coreMessage: 'Your Vision. Our Precision.',
      visualPrinciple: 'Ideas becoming physical impact',
      motionPrinciple: 'Precision in motion',
    };
  }

  /**
   * Get brand voice definition.
   */
  getBrandVoice(): BrandVoiceSchema {
    return {
      primary: 'confident and precise',
      secondary: 'intelligent and modern',
      avoid: 'generic corporate speak, empty buzzwords, overly casual',
      toneExamples: {
        confident: "We don't print. We engineer brand experiences.",
        technical: 'Every micron matters. Every registration is precise.',
        creative: 'Where digital ambition meets physical impact.',
        premium: 'Not just printed. Perfected.',
        direct: "Your vision. Our precision. Let's build something real.",
      },
    };
  }

  /**
   * Get creative DNA — territories, signatures, and principles.
   */
  getCreativeDNA(): CreativeDNA {
    return {
      territories: ['PRECISION', 'TRANSFORMATION', 'SCALE', 'HUMAN_IMPACT', 'PLAY'],
      signatures: [
        'Kinetic Typography',
        'Print Physics',
        'Technical Graphics',
        'Scale Transitions',
        'Digital to Physical',
      ],
      antiGenericPrinciples: [
        'No generic office workers',
        'No generic handshakes',
        'No generic stock photography',
        'No template-looking layouts',
        'No empty marketing buzzwords',
        'No repetitive compositions',
      ],
      creativeDevices: [
        'visual metaphors',
        'unexpected transitions',
        'unusual scale relationships',
        'kinetic typography',
        'graphic information systems',
        'humour mechanisms',
        'VFX ideas',
        'storytelling devices',
      ],
      forbiddenPatterns: [
        'Canva template aesthetics',
        'Shutterstock photography',
        'Generic AI corporate video',
        'Generic marketing agency output',
        'Generic printing company imagery',
        'Repetitive compositions',
      ],
    };
  }

  /**
   * Get visual system definition.
   */
  getVisualSystem(): VisualSystem {
    return {
      designPhilosophy: 'Ideas becoming physical impact.',
      elements: [
        'Technical grids and measurement systems',
        'Registration marks and crop marks',
        'Print objects as characters',
        'Kinetic typography',
        'Scale transformations',
      ],
      compositionPrinciples: [
        'Intentional space',
        'Technical precision',
        'Scale contrast',
        'Material honesty',
        'Brand consistency',
      ],
      motionPrinciples: [
        'Precision in motion',
        'Mechanical rhythm',
        'Transformative transitions',
        'Typographic choreography',
        'Scale dynamics',
      ],
      colorApproach: 'True-to-life color accuracy with PrintSync red as accent.',
    };
  }

  /**
   * Get typography system.
   */
  getTypographySystem(): TypographySystem {
    return {
      primaryFont: 'Inter',
      secondaryFont: 'JetBrains Mono',
      kineticBehaviors: [
        'TYPE-SLAM',
        'TYPE-BUILD',
        'TYPE-SCAN',
        'TYPE-SLICE',
        'TYPE-EXPLODE',
        'TYPE-MORPH',
        'TYPE-STRETCH',
        'TYPE-TRACK',
        'TYPE-LOCK',
        'TYPE-REVEAL',
        'TYPE-IMPACT',
        'TYPE-PARTICLE',
        'TYPE-MATERIALIZE',
        'TYPE-PRINT',
        'TYPE-CUT',
        'TYPE-FOLD',
        'TYPE-STACK',
        'TYPE-SCALE',
      ],
      principles: {
        typeIsCharacter: true,
        neverDecorativeWithoutPurpose: true,
        precisionOverDecoration: true,
      },
    };
  }

  /**
   * Get color system.
   */
  getColorSystem(): ColorSystem {
    return {
      primary: '#C8001C',
      secondary: '#373435',
      neutrals: ['#FFFFFF', '#F5F5F5', '#9B9B9B'],
      accents: ['#00A8E0', '#E6007E', '#FFD100', '#000000'],
      semantic: {
        success: '#00A86B',
        warning: '#FF8C00',
        error: '#C8001C',
        info: '#00A8E0',
      },
    };
  }

  /**
   * Get motion language.
   */
  getMotionLanguage(): MotionLanguage {
    return {
      personalities: ['Mechanical', 'Transformative', 'Typographic', 'Cinematic', 'Playful'],
      timingPrinciples: [
        'Intentional pacing',
        'Mechanical rhythm',
        'Impact moments',
        'Breathing room',
        'Brand cadence',
      ],
      transitionLanguage: [
        'Match cuts',
        'Scale transitions',
        'Digital to physical transformations',
        'Typographic choreography',
        'Geometric transitions',
        'Light-based transitions',
      ],
      avoidPatterns: [
        'Random easing without purpose',
        'Overused stock transitions',
        'Generic AI video aesthetics',
        'Motion without meaning',
        'Repetitive movement patterns',
      ],
    };
  }

  /**
   * Get all service definitions.
   */
  getServices(): ServiceDefinition[] {
    return [
      {
        id: 'digital-printing',
        name: 'Digital Printing',
        category: 'print',
        description:
          'High-quality digital printing for short runs, quick turnaround, and variable data',
        customerProblems: ['need fast turnaround', 'small print runs', 'variable data printing'],
        applications: ['brochures', 'flyers', 'business cards', 'booklets'],
        visualOpportunities: ['precision registration', 'color accuracy', 'short-run efficiency'],
        proofAssets: ['printed samples', 'color calibration', 'registration marks'],
        campaignAngles: ['speed meets precision', 'every copy perfect', 'on-demand capability'],
        ctaOptions: ['Start your print order', 'Get a quote today', 'Upload your design'],
      },
      {
        id: 'commercial-printing',
        name: 'Commercial Printing',
        category: 'print',
        description: 'Large-scale commercial printing for high-volume projects',
        customerProblems: ['high-volume needs', 'consistent quality at scale', 'tight deadlines'],
        applications: ['magazines', 'catalogs', 'annual reports', 'brochures'],
        visualOpportunities: ['production lines', 'volume', 'consistency', 'scale'],
        proofAssets: ['production facility', 'large print runs', 'quality control'],
        campaignAngles: ['scale without compromise', 'volume with precision'],
        ctaOptions: ['Scale your print', 'Request commercial quote'],
      },
      {
        id: 'large-format-printing',
        name: 'Large Format Printing',
        category: 'print',
        description:
          'Oversized printing for banners, signage, displays, and environmental graphics',
        customerProblems: ['need visibility', 'large-scale branding', 'outdoor durability'],
        applications: ['banners', 'billboards', 'building wraps', 'vehicle graphics'],
        visualOpportunities: ['scale', 'transformation', 'environmental impact', 'visibility'],
        proofAssets: ['large installations', 'building wraps', 'outdoor signage'],
        campaignAngles: [
          'big ideas need big print',
          'impossible to ignore',
          'scale that transforms',
        ],
        ctaOptions: ['Go big with PrintSync', 'Request large-format quote'],
      },
      {
        id: 'signage',
        name: 'Signage',
        category: 'signage',
        description: 'Professional signage solutions for businesses, retail, and public spaces',
        customerProblems: ['need visibility', 'brand consistency', 'professional appearance'],
        applications: ['storefront signs', 'directional signage', 'wayfinding', 'retail displays'],
        visualOpportunities: ['dimensional lettering', 'illumination', 'material variety'],
        proofAssets: ['installed signage', 'illuminated signs', 'dimensional lettering'],
        campaignAngles: ['be seen', 'signage that works', 'brand in three dimensions'],
        ctaOptions: ['Design your sign', 'Request signage consultation'],
      },
      {
        id: 'road-signs',
        name: 'Road Signs',
        category: 'signage',
        description: 'Traffic and road signage meeting safety standards and regulations',
        customerProblems: ['regulatory compliance', 'safety requirements', 'durability'],
        applications: ['traffic signs', 'directional signs', 'warning signs'],
        visualOpportunities: ['reflective materials', 'standardized precision', 'safety'],
        proofAssets: ['road installations', 'reflective signage'],
        campaignAngles: ['safety in precision', 'signs that save lives'],
        ctaOptions: ['Ensure compliance', 'Request road sign quote'],
      },
      {
        id: 'safety-signs',
        name: 'Safety Signs',
        category: 'signage',
        description: 'Workplace safety signage for compliance and protection',
        customerProblems: ['workplace safety', 'legal compliance', 'employee protection'],
        applications: ['warning signs', 'prohibition signs', 'mandatory signs'],
        visualOpportunities: ['universal symbols', 'high visibility', 'instant recognition'],
        proofAssets: ['workplace installations', 'safety compliance'],
        campaignAngles: ['safety speaks clearly', 'signs that protect'],
        ctaOptions: ['Protect your workplace', 'Request safety audit'],
      },
      {
        id: 'medical-safety-signs',
        name: 'Medical Safety Signs',
        category: 'signage',
        description: 'Specialized safety signage for healthcare and medical environments',
        customerProblems: ['healthcare compliance', 'infection control', 'patient safety'],
        applications: ['hospital signage', 'clinic wayfinding', 'hazard warnings'],
        visualOpportunities: ['clean precision', 'healthcare environments', 'critical clarity'],
        proofAssets: ['hospital installations', 'medical facility signage'],
        campaignAngles: ['precision in care', 'signs that protect lives'],
        ctaOptions: ['Protect patients', 'Request medical signage'],
      },
      {
        id: 'branding',
        name: 'Branding',
        category: 'creative',
        description: 'Comprehensive brand identity and visual communication solutions',
        customerProblems: ['brand inconsistency', 'weak visual identity', 'need differentiation'],
        applications: ['logo design', 'brand guidelines', 'visual identity', 'brand strategy'],
        visualOpportunities: ['identity systems', 'brand consistency', 'visual storytelling'],
        proofAssets: ['brand guidelines', 'identity systems', 'before/after rebrands'],
        campaignAngles: ['brand with precision', 'identity that works', 'be remembered'],
        ctaOptions: ['Build your brand', 'Request brand consultation'],
      },
      {
        id: 'graphic-design',
        name: 'Graphic Design',
        category: 'creative',
        description: 'Professional graphic design for print and digital media',
        customerProblems: ['need professional design', 'stand out from competitors'],
        applications: ['marketing materials', 'digital graphics', 'print design'],
        visualOpportunities: [
          'visual communication',
          'creative concepts',
          'professional execution',
        ],
        proofAssets: ['design portfolios', 'client work'],
        campaignAngles: ['design that communicates', 'visual impact'],
        ctaOptions: ['Start your design', 'Request design portfolio'],
      },
      {
        id: 'labels',
        name: 'Labels',
        category: 'print',
        description: 'Custom label printing for products, packaging, and identification',
        customerProblems: ['product identification', 'brand consistency', 'regulatory labeling'],
        applications: ['product labels', 'barcode labels', 'warning labels'],
        visualOpportunities: ['precision printing', 'material variety', 'adhesive technology'],
        proofAssets: ['label samples', 'product applications'],
        campaignAngles: ['every label perfect', 'brand in every detail'],
        ctaOptions: ['Label your products', 'Request label samples'],
      },
      {
        id: 'stickers',
        name: 'Stickers',
        category: 'print',
        description: 'Custom sticker printing for branding, promotion, and identification',
        customerProblems: ['brand promotion', 'product identification', 'event branding'],
        applications: ['brand stickers', 'promotional stickers', 'vinyl decals'],
        visualOpportunities: ['die-cut shapes', 'material variety', 'vibrant colors'],
        proofAssets: ['sticker samples', 'die-cut examples'],
        campaignAngles: ['stick your brand', 'precision in every shape'],
        ctaOptions: ['Create your stickers', 'Request sticker samples'],
      },
      {
        id: 'packaging',
        name: 'Packaging',
        category: 'print',
        description: 'Custom packaging printing for products, retail, and shipping',
        customerProblems: ['product protection', 'brand presentation', 'shelf impact'],
        applications: ['product boxes', 'retail packaging', 'luxury packaging'],
        visualOpportunities: ['structural design', 'material variety', 'brand experience'],
        proofAssets: ['packaging samples', 'structural designs'],
        campaignAngles: ['packaging that sells', 'brand in every box'],
        ctaOptions: ['Package your product', 'Request packaging design'],
      },
      {
        id: 'corporate-stationery',
        name: 'Corporate Stationery',
        category: 'print',
        description: 'Professional stationery for business communication and branding',
        customerProblems: ['professional image', 'brand consistency', 'first impressions'],
        applications: ['letterheads', 'business cards', 'envelopes'],
        visualOpportunities: ['paper quality', 'printing precision', 'tactile experience'],
        proofAssets: ['stationery sets', 'paper samples'],
        campaignAngles: ['first impressions matter', 'brand in every detail'],
        ctaOptions: ['Elevate your stationery', 'Request stationery samples'],
      },
      {
        id: 'posters',
        name: 'Posters',
        category: 'print',
        description: 'High-impact poster printing for advertising, promotion, and decoration',
        customerProblems: ['need visibility', 'promotional impact', 'event advertising'],
        applications: ['event posters', 'promotional posters', 'advertising posters'],
        visualOpportunities: ['large format', 'vibrant colors', 'visual impact'],
        proofAssets: ['poster installations', 'event promotions'],
        campaignAngles: ['ideas that demand attention', 'poster power'],
        ctaOptions: ['Print your poster', 'Request poster quote'],
      },
      {
        id: 'banners',
        name: 'Banners',
        category: 'print',
        description: 'Custom banner printing for events, promotions, and advertising',
        customerProblems: ['event visibility', 'promotional impact', 'outdoor advertising'],
        applications: ['event banners', 'promotional banners', 'outdoor banners'],
        visualOpportunities: ['large scale', 'vibrant colors', 'durability'],
        proofAssets: ['banner installations', 'event applications'],
        campaignAngles: ['banner visibility', 'impossible to ignore'],
        ctaOptions: ['Banner your brand', 'Request banner quote'],
      },
      {
        id: 'displays',
        name: 'Displays',
        category: 'signage',
        description: 'Point-of-sale and exhibition displays for retail and events',
        customerProblems: ['need visibility', 'brand presence', 'customer engagement'],
        applications: ['POS displays', 'exhibition stands', 'retail displays'],
        visualOpportunities: ['structural design', 'brand integration', 'visual impact'],
        proofAssets: ['display installations', 'exhibition stands'],
        campaignAngles: ['display your brand', 'engage your audience'],
        ctaOptions: ['Design your display', 'Request display consultation'],
      },
      {
        id: 'finishing',
        name: 'Finishing',
        category: 'finishing',
        description: 'Professional finishing services including laminating, binding, and cutting',
        customerProblems: ['professional appearance', 'durability', 'presentation quality'],
        applications: ['lamination', 'binding', 'die-cutting', 'foiling'],
        visualOpportunities: ['material transformation', 'tactile quality', 'premium finishes'],
        proofAssets: ['finished samples', 'material transformations'],
        campaignAngles: ['finish with precision', 'the final touch'],
        ctaOptions: ['Finish with PrintSync', 'Request finishing samples'],
      },
      {
        id: 'custom-print-solutions',
        name: 'Custom Print Solutions',
        category: 'specialty',
        description: 'Bespoke printing solutions for unique and specialized requirements',
        customerProblems: ['unique requirements', 'specialized materials', 'creative challenges'],
        applications: ['specialty printing', 'unusual substrates', 'custom formats'],
        visualOpportunities: ['innovation', 'material exploration', 'creative problem-solving'],
        proofAssets: ['custom projects', 'innovative solutions'],
        campaignAngles: ['if you can imagine it', 'print the impossible'],
        ctaOptions: ['Challenge us', 'Request custom consultation'],
      },
    ];
  }

  /**
   * Get messaging system.
   */
  getMessaging(): MessagingSystem {
    return {
      coreMessages: {
        primary: 'Your Vision. Our Precision.',
        secondary: 'Ideas becoming physical impact.',
        tertiary: 'From screen to something real.',
      },
      valuePropositions: [
        {
          headline: 'Precision-Engineered Print',
          body: 'Every project is executed with technical precision.',
        },
        {
          headline: 'Brand Thinking, Print Execution',
          body: "We don't just print. We engineer brand experiences.",
        },
        {
          headline: 'Scale Without Compromise',
          body: 'From one business card to ten thousand banners.',
        },
        {
          headline: 'Creative Capability, Technical Excellence',
          body: 'Premium printing, branding, signage and visual communication.',
        },
      ],
      proofPoints: [
        'CMYK-calibrated color management',
        'Precision registration on every print',
        'Premium substrate selection',
        'Professional finishing options',
        'Quality control at every stage',
      ],
      ctaLibrary: {
        primary: ['Start your project', 'Get a quote', 'Upload your design'],
        secondary: ['Request samples', 'Book a consultation', 'Explore services'],
        urgent: ['Order now', 'Fast turnaround', 'Express service'],
        soft: ['Learn more', 'See our work', 'Discover PrintSync'],
      },
    };
  }

  /**
   * Get forbidden styles.
   */
  getForbiddenStyles(): ForbiddenStyle[] {
    return [
      {
        category: 'generic_corporate',
        description: 'Generic corporate advertising',
        indicators: ['generic office workers', 'handshakes', 'stock photography'],
        weight: 10,
      },
      {
        category: 'template_aesthetics',
        description: 'Template aesthetics',
        indicators: ['Canva-style layouts', 'template-looking social posts', 'generic gradients'],
        weight: 10,
      },
      {
        category: 'visual_cliches',
        description: 'Visual cliches',
        indicators: ['excessive gradients', 'generic printer imagery', 'AI-looking typography'],
        weight: 8,
      },
      {
        category: 'content',
        description: 'Content violations',
        indicators: ['empty buzzwords', 'fake testimonials', 'invented statistics'],
        weight: 10,
      },
      {
        category: 'ai_specific',
        description: 'AI-specific issues',
        indicators: ['uncanny humans', 'inconsistent lighting', 'morphing artifacts'],
        weight: 15,
      },
    ];
  }

  /**
   * Get logo rules.
   */
  getLogoRules(): LogoRules {
    return {
      filePath: 'assets/logo/printsync-official-logo.svg',
      clearSpace: '25% of logo width on all sides',
      minimumSize: { digital: '120px width', print: '25mm width' },
      colorUsage: [
        'Primary: Red (#C8001C) on white',
        'Reversed: White on dark',
        'Monochrome: Charcoal on light',
      ],
      incorrectUsage: [
        'Changing logo colors',
        'Adding effects',
        'Rotating or skewing',
        'Placing on low-contrast backgrounds',
      ],
    };
  }

  /**
   * Get a service by ID.
   */
  getServiceById(id: string): ServiceDefinition | undefined {
    return this.getServices().find((s) => s.id === id);
  }

  /**
   * Get services by category.
   */
  getServicesByCategory(category: string): ServiceDefinition[] {
    return this.getServices().filter((s) => s.category === category);
  }

  /**
   * Get creative context for the creative engine.
   * This is the normalized context that the creative engine receives.
   */
  async getCreativeContext(): Promise<BrandContext> {
    return this.load();
  }

  /**
   * Invalidate cached context (useful for testing).
   */
  invalidateCache(): void {
    this.cachedContext = null;
  }
}

export default BrandEngine;
