import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { buildProductionPlan } from '@printsync/production-orchestrator';

type CreativeBrief = Parameters<typeof buildProductionPlan>[0];

/**
 * Minimal demo entry point: read a brief JSON file, run it through the
 * production orchestrator, and print the resulting ProductionPlan.
 *
 * Usage: node dist/cli.js <brief-json-path>
 */
async function main(): Promise<void> {
  const [briefArg] = process.argv.slice(2);
  if (!briefArg) {
    console.error('Usage: node dist/cli.js <brief-json-path>');
    process.exitCode = 1;
    return;
  }

  const briefPath = path.resolve(process.cwd(), briefArg);
  let brief: CreativeBrief;
  try {
    brief = JSON.parse(readFileSync(briefPath, 'utf-8')) as CreativeBrief;
  } catch (error) {
    console.error('Failed to read or parse brief:', error);
    process.exitCode = 1;
    return;
  }

  const plan = await buildProductionPlan(brief, { validate: true });
  console.log('=== Production Plan ===');
  console.log(JSON.stringify(plan, null, 2));
  console.log('\nPlan status:', plan.productionStatus);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
