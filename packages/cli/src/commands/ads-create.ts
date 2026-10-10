/**
 * ads:create — Create a new advert from a creative brief
 */

import chalk from 'chalk';
import type { CreativeBrief } from '@printsync/shared';
import { CreativeDirector, CreativeJudge } from '@printsync/creative-engine';

export async function adsCreate(options: {
  service?: string;
  formats?: string;
  voice?: string;
  mode?: string;
}): Promise<void> {
  console.log(chalk.blue('\n🎨 PRINTSYNC CREATIVE DIRECTOR\n'));

  const brief: CreativeBrief = {
    objective: options.service
      ? `Advertise ${options.service}`
      : 'Create a premium PrintSync advert',
    service: options.service ?? 'custom-print-solutions',
    audience: 'businesses needing premium print and branding solutions',
    emotional_objective: 'confidence and desire',
    platform: ['instagram', 'tiktok', 'linkedin', 'youtube'],
    formats: options.formats?.split(',') ?? ['16:9', '9:16', '1:1'],
    voice_mode: (options.voice as CreativeBrief['voice_mode']) ?? 'VOICEOVER',
    creative_mode: (options.mode as CreativeBrief['creative_mode']) ?? 'CINEMATIC_BRAND_FILM',
  };

  console.log(chalk.gray('Generating concepts...\n'));

  const director = new CreativeDirector();
  const concepts = director.generateConcepts(brief);

  console.log(chalk.green(`✓ Generated ${concepts.length} concepts\n`));

  const judge = new CreativeJudge();
  const scored = judge.scoreConcepts(concepts);

  console.log(chalk.yellow('TOP 3 CONCEPTS:\n'));
  for (const concept of scored.slice(0, 3)) {
    const score = concept.score!;
    const statusColor = score.status === 'SIGNATURE' ? chalk.red.bold
      : score.status === 'APPROVE' ? chalk.green
      : score.status === 'REWORK' ? chalk.yellow
      : chalk.red;

    console.log(`  ${chalk.bold(concept.title)}`);
    console.log(`  ${chalk.gray(concept.logline)}`);
    console.log(`  Mode: ${concept.creative_mode} | Territory: ${concept.territory} | Mood: ${concept.mood}`);
    console.log(`  Score: ${score.total}/100 ${statusColor(`[${score.status}]`)}`);
    console.log(`  CTA: ${chalk.cyan(concept.cta)}`);
    console.log();
  }

  const topConcept = scored[0];
  if (topConcept) {
    console.log(chalk.blue('\n📋 DEVELOPING WINNING CONCEPT:\n'));
    const treatment = director.developConcept(topConcept);
    console.log(treatment);
  }

  console.log(chalk.green('\n✓ Concept generation complete.'));
  console.log(chalk.gray('  Next: pnpm ads:daily to run the full pipeline.\n'));
}
