import { readFileSync } from 'fs';
import * as path from 'path';
import { buildProductionPlan } from '@printsync/production-orchestrator';

// Simple CLI entry point
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node cli.js <brief-json-path>');
    process.exit(1);
  }
  const briefPath = path.resolve(process.cwd(), args[0]);
  let brief;
  try {
    brief = JSON.parse(readFileSync(briefPath, 'utf-8'));
  } catch (e) {
    console.error('Failed to read or parse brief:', e);
    process.exit(1);
  }
  const plan = await buildProductionPlan(brief, { validate: true });
  console.log('=== Production Plan ===');
  console.log(JSON.stringify(plan, null, 2));
  console.log('\nPlan status:', plan.productionStatus);
}

if (require.main === module) {
  main();
}
