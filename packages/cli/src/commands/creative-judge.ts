/**
 * creative:judge — Judge a concept or campaign
 */

import chalk from 'chalk';
import type { Concept } from '@printsync/shared';
import { CreativeJudge } from '@printsync/creative-engine';

export async function creativeJudge(options: {
  concept?: string;
  file?: string;
}): Promise<void> {
  console.log(chalk.red.bold('\n⚖️  PRINTSYNC CREATIVE JUDGE\n'));

  // Demo concept for testing
  const demoConcept: Concept = {
    id: options.concept ?? 'demo_concept',
    title: 'THE PRINT ENGINE',
    logline: 'Precision-engineered printing for brands that refuse to blend in.',
    creative_mode: 'TYPOGRAPHIC_FILM',
    narrative_structure: 'IDEA_DESIGN_MACHINE_MATERIAL_SCALE_IMPACT',
    territory: 'PRECISION',
    mood: 'technical',
    visual_style: 'typography',
    pace: 'rhythmic',
    voice_mode: 'TYPOGRAPHY_ONLY',
    key_visual: 'A mechanical engine made of print components — gears of paper, pistons of ink — comes to life with precision.',
    story_summary: 'A mechanical engine constructed from print components comes to life, showing how PrintSync digital printing is precision-engineered for maximum impact.',
    target_duration_seconds: 20,
    formats: ['16:9', '9:16', '1:1'],
    cta: 'Engineer your brand',
  };

  console.log(chalk.blue('Judging concept:'), demoConcept.title);
  console.log();

  const judge = new CreativeJudge();
  const score = judge.scoreConcept(demoConcept);

  // Display scorecard
  console.log(chalk.yellow('┌──────────────────────────────┐'));
  console.log(chalk.yellow('│ PRINTSYNC CREATIVE JUDGE     │'));
  console.log(chalk.yellow('├──────────────────────────────┤'));
  console.log(chalk.yellow(`│ Brand consistency       ${score.brand_fit.toString().padStart(2)}   │`));
  console.log(chalk.yellow(`│ Originality              ${score.originality.toString().padStart(2)}   │`));
  console.log(chalk.yellow(`│ Visual impact            ${score.visual_potential.toString().padStart(2)}   │`));
  console.log(chalk.yellow(`│ Commercial clarity       ${score.commercial_value.toString().padStart(2)}   │`));
  console.log(chalk.yellow(`│ Service accuracy         ${score.service_relevance.toString().padStart(2)}   │`));
  console.log(chalk.yellow(`│ Typography               ${score.production_quality.toString().padStart(2)}   │`));
  console.log(chalk.yellow(`│ Motion                    ${score.emotional_impact.toString().padStart(2)}   │`));
  console.log(chalk.yellow(`│ Memorability              ${score.memorability.toString().padStart(2)}   │`));
  console.log(chalk.yellow(`│ Social stop power         ${score.social_stop_power.toString().padStart(2)}   │`));
  console.log(chalk.yellow(`│ Genericity                ${score.non_generic_quality.toString().padStart(2)}   │`));
  console.log(chalk.yellow('├──────────────────────────────┤'));

  const statusColor = score.status === 'SIGNATURE' ? chalk.red.bold
    : score.status === 'APPROVE' ? chalk.green
    : score.status === 'REWORK' ? chalk.yellow
    : chalk.red;

  console.log(chalk.yellow(`│ FINAL SCORE              ${score.total.toString().padStart(2)}   │`));
  console.log(chalk.yellow(`│ STATUS: ${statusColor(score.status.padEnd(18))}│`));
  console.log(chalk.yellow('└──────────────────────────────┘'));
  console.log();

  if (score.feedback.length > 0) {
    console.log(chalk.blue('Feedback:'));
    for (const item of score.feedback) {
      console.log(`  • ${item}`);
    }
    console.log();
  }

  const evaluation = judge.evaluateConcept(demoConcept);
  console.log(chalk.green(`✓ ${evaluation.reason}\n`));
}
