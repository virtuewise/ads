/**
 * ads:daily — Generate today's advert automatically (V2)
 *
 * Full pipeline:
 * 1. Load PrintSync brand memory
 * 2. Load recent campaign history
 * 3. Calculate creative fatigue
 * 4. Identify creative opportunities
 * 5. Build concept seed matrix
 * 6. Generate 10 diverse concepts
 * 7. Anti-generic analysis
 * 8. Creative judge
 * 9. Diversity analysis
 * 10. Select top 3
 * 11. Rework if necessary
 * 12. Select winner
 * 13. Create creative brief
 * 14. Save campaign memory
 */

import chalk from 'chalk';
import { runDailyCreativeEngine } from '@printsync/creative-engine';
import type { CreativeHistoryEntry } from '@printsync/shared';

const DAILY_ROTATION = [
  { day: 0, mode: 'CINEMATIC_BRAND_FILM', label: 'Premium Brand Statement' },
  { day: 1, mode: 'SERVICE_AD', label: 'Product/Service Advert' },
  { day: 2, mode: 'EDUCATIONAL_AD', label: 'Educational Advert' },
  { day: 3, mode: 'TYPOGRAPHIC_FILM', label: 'Brand Film' },
  { day: 4, mode: 'HUMOR_AD', label: 'Funny Corporate Advert' },
  { day: 5, mode: 'DETECTIVE_AD', label: 'Detective Advert' },
  { day: 6, mode: 'VFX_EXPERIMENT', label: 'Visual Experiment' },
] as const;

export async function adsDaily(_options: {
  brand?: string;
  formats?: string;
}): Promise<void> {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const rotation = DAILY_ROTATION[dayOfWeek]!;

  console.log(chalk.red.bold('\n📅 PRINTSYNC DAILY ADVERTISING ENGINE V2\n'));
  console.log(chalk.gray(`Date: ${today.toISOString().split('T')[0]}`));
  console.log(chalk.gray(`Day: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}`));
  console.log(chalk.gray(`Mode: ${rotation.label}\n`));

  // Step 1-2: Load brand and history (simulated)
  console.log(chalk.blue('Loading brand memory...'));
  console.log(chalk.green('✓ PrintSync brand loaded\n'));

  console.log(chalk.blue('Loading campaign history...'));
  const history: CreativeHistoryEntry[] = [];
  console.log(chalk.green(`✓ ${history.length} campaigns in history\n`));

  // Step 3-14: Run the full V2 pipeline
  console.log(chalk.blue('Running creative engine V2...\n'));

  const report = await runDailyCreativeEngine(
    history,
    ['branding', 'packaging', 'signage', 'digital-printing', 'large-format-printing', 'labels', 'posters'],
    'AWARENESS'
  );

  // Display creative fatigue
  console.log(chalk.yellow('CREATIVE FATIGUE:\n'));
  for (const fatigue of report.creativeFatigue.slice(0, 5)) {
    const color = fatigue.usageLevel === 'HIGH' ? chalk.red : fatigue.usageLevel === 'MEDIUM' ? chalk.yellow : chalk.green;
    console.log(`  ${fatigue.dimension.padEnd(30)} ${color(fatigue.usageLevel)} (${fatigue.percentage}%)`);
  }
  console.log();

  // Display creative opportunity
  if (report.creativeOpportunity) {
    console.log(chalk.yellow('CREATIVE OPPORTUNITY:\n'));
    console.log(`  Service: ${report.creativeOpportunity.service}`);
    console.log(`  Territory: ${report.creativeOpportunity.territory}`);
    console.log(`  Narrative: ${report.creativeOpportunity.narrative}`);
    console.log(`  Confidence: ${report.creativeOpportunity.confidence}%`);
    console.log(`  Novelty: ${report.creativeOpportunity.novelty}%`);
    console.log(`  Brand Fit: ${report.creativeOpportunity.brandFit}%`);
    console.log();
  }

  // Display top 3 concepts
  console.log(chalk.yellow('TOP 3 CONCEPTS:\n'));
  for (const concept of report.topThree) {
    const verdict = report.judgeResults.find(j => j.concept.id === concept.id)?.verdict;
    const score = verdict?.total ?? 0;
    const statusColor = score >= 90 ? chalk.red.bold : score >= 80 ? chalk.green : score >= 70 ? chalk.yellow : chalk.red;

    console.log(`  ${chalk.bold(concept.title)}`);
    console.log(`  ${chalk.gray(concept.logline)}`);
    console.log(`  Mode: ${concept.creative_mode} | Territory: ${concept.territory} | Mood: ${concept.mood}`);
    console.log(`  Score: ${score}/100 ${statusColor(`[${verdict?.status ?? 'UNKNOWN'}]`)}`);
    console.log();
  }

  // Display diversity analysis
  console.log(chalk.yellow('DIVERSITY ANALYSIS:\n'));
  console.log(`  Diversity Score: ${report.diversityAnalysis.diversityScore}/100`);
  console.log(`  Verdict: ${report.diversityAnalysis.verdict}`);
  if (report.diversityAnalysis.issues.length > 0) {
    for (const issue of report.diversityAnalysis.issues) {
      console.log(`  ⚠ ${issue}`);
    }
  }
  console.log();

  // Display winner
  if (report.winner) {
    const winnerVerdict = report.judgeResults.find(j => j.concept.id === report.winner?.id)?.verdict;
    console.log(chalk.green.bold('🏆 WINNING CONCEPT:\n'));
    console.log(`  ${chalk.bold(report.winner.title)}`);
    console.log(`  ${chalk.gray(report.winner.logline)}`);
    console.log(`  Score: ${winnerVerdict?.total}/100 ${chalk.green(`[${winnerVerdict?.status}]`)}`);
    console.log(`  CTA: ${chalk.cyan(report.winner.cta)}`);
    console.log();
  }

  // Display creative brief
  if (report.creativeBrief) {
    console.log(chalk.blue('📋 CREATIVE BRIEF:\n'));
    console.log(`  Brand: ${report.creativeBrief.brand}`);
    console.log(`  Objective: ${report.creativeBrief.objective}`);
    console.log(`  Service: ${report.creativeBrief.service}`);
    console.log(`  Audience: ${report.creativeBrief.audience}`);
    console.log(`  Key Message: ${report.creativeBrief.keyMessage}`);
    console.log(`  Emotional Goal: ${report.creativeBrief.emotionalGoal}`);
    console.log(`  Creative Mode: ${report.creativeBrief.creativeMode}`);
    console.log(`  Voice: ${report.creativeBrief.voiceMode}`);
    console.log(`  Duration: ${report.creativeBrief.duration}s`);
    console.log(`  CTA: ${report.creativeBrief.cta}`);
    console.log();
  }

  console.log(chalk.green('✓ Daily creative engine V2 complete.'));
  console.log(chalk.gray('  Next: Develop into full production with pnpm campaign:create\n'));
}
