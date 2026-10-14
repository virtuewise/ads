/**
 * creative:judge — Judge a concept or campaign
 */

import { CreativeJudge } from '@printsync/creative-engine';
import type { Concept } from '@printsync/shared';
import chalk from 'chalk';

export async function creativeJudge(options: { concept?: string; file?: string }): Promise<void> {
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
    key_visual:
      'A mechanical engine made of print components — gears of paper, pistons of ink — comes to life with precision.',
    story_summary:
      'A mechanical engine constructed from print components comes to life, showing how PrintSync digital printing is precision-engineered for maximum impact.',
    target_duration_seconds: 20,
    formats: ['16:9', '9:16', '1:1'],
    cta: 'Engineer your brand',
  };

  console.log(chalk.blue('Judging concept:'), demoConcept.title);
  console.log();

  const judge = new CreativeJudge();
  const score = judge.scoreConcept(demoConcept);

  // Display scorecard
  // Fixed-width box; sized for the 0–100 rubric so a 3-digit total still aligns.
  const row = (label: string, value: string | number): string =>
    `│ ${label.padEnd(25)}${String(value).padStart(3)} │`;
  const border = (left: string, right: string): string => `${left}${'─'.repeat(30)}${right}`;

  console.log(chalk.yellow(border('┌', '┐')));
  console.log(chalk.yellow(row('PRINTSYNC CREATIVE JUDGE', '')));
  console.log(chalk.yellow(border('├', '┤')));
  console.log(chalk.yellow(row('Brand consistency', score.brand_fit)));
  console.log(chalk.yellow(row('Originality', score.originality)));
  console.log(chalk.yellow(row('Visual impact', score.visual_potential)));
  console.log(chalk.yellow(row('Commercial clarity', score.commercial_value)));
  console.log(chalk.yellow(row('Service accuracy', score.service_relevance)));
  console.log(chalk.yellow(row('Typography', score.production_quality)));
  console.log(chalk.yellow(row('Motion', score.emotional_impact)));
  console.log(chalk.yellow(row('Memorability', score.memorability)));
  console.log(chalk.yellow(row('Social stop power', score.social_stop_power)));
  console.log(chalk.yellow(row('Genericity', score.non_generic_quality)));
  console.log(chalk.yellow(border('├', '┤')));

  const statusColor =
    score.status === 'SIGNATURE'
      ? chalk.red.bold
      : score.status === 'APPROVE'
        ? chalk.green
        : score.status === 'REWORK'
          ? chalk.yellow
          : chalk.red;

  console.log(chalk.yellow(row('FINAL SCORE', score.total)));
  console.log(chalk.yellow(`│ STATUS: ${statusColor(score.status.padEnd(20))} │`));
  console.log(chalk.yellow(border('└', '┘')));
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
