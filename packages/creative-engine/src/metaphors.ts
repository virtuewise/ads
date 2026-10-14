/**
 * Visual Metaphor Library
 * Reusable metaphors for PrintSync creative concepts.
 */

export interface VisualMetaphor {
  name: string;
  description: string;
  services: string[];
  territories: string[];
  visualDescription: string;
}

export const VISUAL_METAPHORS: VisualMetaphor[] = [
  {
    name: 'PRINT AS ARCHITECTURE',
    description: 'Print objects become buildings, structures, and spaces',
    services: ['large-format-printing', 'signage', 'displays'],
    territories: ['SCALE', 'TRANSFORMATION'],
    visualDescription:
      'A business card grows into a building. A poster becomes a wall. Print creates physical space.',
  },
  {
    name: 'PRINT AS ENGINE',
    description: 'Print objects become mechanical engines and machines',
    services: ['digital-printing', 'commercial-printing', 'finishing'],
    territories: ['PRECISION', 'TRANSFORMATION'],
    visualDescription: 'Gears of paper, pistons of ink. Print as precision machinery.',
  },
  {
    name: 'PRINT AS IDENTITY',
    description: 'Print objects express brand identity and personality',
    services: ['branding', 'corporate-stationery', 'packaging'],
    territories: ['HUMAN_IMPACT', 'TRANSFORMATION'],
    visualDescription: 'Stationery, packaging, and branding that express who you are.',
  },
  {
    name: 'PRINT AS ARMOR',
    description: 'Print objects protect and strengthen brands',
    services: ['packaging', 'labels', 'signage'],
    territories: ['HUMAN_IMPACT', 'SCALE'],
    visualDescription: 'Packaging that protects. Labels that authenticate. Signs that endure.',
  },
  {
    name: 'PRINT AS LANGUAGE',
    description: 'Print objects communicate and speak for brands',
    services: ['branding', 'graphic-design', 'posters'],
    territories: ['HUMAN_IMPACT', 'PLAY'],
    visualDescription: 'Typography that speaks. Design that communicates. Print as voice.',
  },
  {
    name: 'PRINT AS MEMORY',
    description: 'Print objects preserve and remember',
    services: ['posters', 'packaging', 'corporate-stationery'],
    territories: ['HUMAN_IMPACT', 'TRANSFORMATION'],
    visualDescription: 'Print that lasts. Materials that preserve moments and messages.',
  },
  {
    name: 'PRINT AS SIGNAL',
    description: 'Print objects attract attention and communicate at distance',
    services: ['signage', 'banners', 'large-format-printing', 'road-signs'],
    territories: ['SCALE', 'PRECISION'],
    visualDescription: 'Signs that guide. Banners that announce. Print as beacon.',
  },
  {
    name: 'PRINT AS SCALE',
    description: 'Print objects demonstrate dramatic size relationships',
    services: ['large-format-printing', 'posters', 'banners'],
    territories: ['SCALE', 'TRANSFORMATION'],
    visualDescription: 'From business card to building. From sticker to skyscraper.',
  },
  {
    name: 'PRINT AS TRANSFORMATION',
    description: 'Print objects transform from one state to another',
    services: ['digital-printing', 'finishing', 'packaging'],
    territories: ['TRANSFORMATION', 'PRECISION'],
    visualDescription: 'Digital to physical. Flat to dimensional. Idea to object.',
  },
  {
    name: 'PRINT AS EVIDENCE',
    description: 'Print objects prove and demonstrate',
    services: ['labels', 'signage', 'road-signs', 'safety-signs'],
    territories: ['PRECISION', 'HUMAN_IMPACT'],
    visualDescription: 'Labels that certify. Signs that prove. Print as proof.',
  },
  {
    name: 'PRINT AS CURRENCY',
    description: 'Print objects represent value and exchange',
    services: ['branding', 'packaging', 'corporate-stationery'],
    territories: ['HUMAN_IMPACT', 'PLAY'],
    visualDescription:
      'Business cards that open doors. Packaging that adds value. Print as investment.',
  },
  {
    name: 'PRINT AS STORY',
    description: 'Print objects tell narratives and stories',
    services: ['posters', 'brochures', 'packaging'],
    territories: ['HUMAN_IMPACT', 'PLAY'],
    visualDescription: 'Every print object tells a story. Print as narrative.',
  },
  {
    name: 'PRINT AS MOVEMENT',
    description: 'Print objects are dynamic and kinetic',
    services: ['digital-printing', 'large-format-printing', 'displays'],
    territories: ['TRANSFORMATION', 'SCALE'],
    visualDescription: 'Print in motion. Kinetic typography. Dynamic displays.',
  },
  {
    name: 'PRINT AS CONNECTION',
    description: 'Print objects connect people and brands',
    services: ['branding', 'corporate-stationery', 'labels'],
    territories: ['HUMAN_IMPACT', 'PLAY'],
    visualDescription: 'Business cards that connect. Labels that link. Print as bridge.',
  },
  {
    name: 'PRINT AS IMPACT',
    description: 'Print objects create force and impression',
    services: ['large-format-printing', 'posters', 'banners'],
    territories: ['SCALE', 'TRANSFORMATION'],
    visualDescription: 'Print that makes an impact. Impossible to ignore.',
  },
];

/**
 * Get metaphors suitable for a service.
 */
export function getMetaphorsForService(service: string): VisualMetaphor[] {
  return VISUAL_METAPHORS.filter((m) => m.services.includes(service));
}

/**
 * Get metaphors suitable for a territory.
 */
export function getMetaphorsForTerritory(territory: string): VisualMetaphor[] {
  return VISUAL_METAPHORS.filter((m) => m.territories.includes(territory));
}

/**
 * Get a random metaphor.
 */
export function getRandomMetaphor(): VisualMetaphor {
  return VISUAL_METAPHORS[Math.floor(Math.random() * VISUAL_METAPHORS.length)]!;
}
