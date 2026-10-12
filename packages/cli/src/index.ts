#!/usr/bin/env node

/**
 * PrintSync Creative OS — CLI
 * Command-line interface for the PrintSync advertising engine.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { adsCreate } from './commands/ads-create.js';
import { adsDaily } from './commands/ads-daily.js';
import { campaignCreate } from './commands/campaign-create.js';
import { filmCreate } from './commands/film-create.js';
import { posterCreate } from './commands/poster-create.js';
import { socialCreate } from './commands/social-create.js';
import { creativeJudge } from './commands/creative-judge.js';

const program = new Command();

program
  .name('printsync')
  .description('PrintSync Creative Operating System')
  .version('0.1.0');

program
  .command('ads:create')
  .description('Create a new advert from a creative brief')
  .option('-s, --service <service>', 'Service to advertise')
  .option('-f, --formats <formats>', 'Output formats (comma-separated)')
  .option('-v, --voice <mode>', 'Voice mode (voiceover|typography|music|dialogue|hybrid)')
  .option('-m, --mode <mode>', 'Creative mode')
  .action(adsCreate);

program
  .command('ads:daily')
  .description('Generate today\'s advert automatically')
  .option('-b, --brand <brand>', 'Brand name', 'printsync')
  .option('-f, --formats <formats>', 'Output formats (comma-separated)')
  .action(adsDaily);

program
  .command('campaign:create')
  .description('Create a full campaign')
  .option('-n, --name <name>', 'Campaign name')
  .option('-s, --service <service>', 'Primary service')
  .option('-e, --episodes <count>', 'Number of episodes', '5')
  .action(campaignCreate);

program
  .command('film:create')
  .description('Create a brand film')
  .option('-d, --duration <seconds>', 'Duration in seconds', '30')
  .option('-s, --style <style>', 'Film style')
  .option('-v, --voice <mode>', 'Voice mode')
  .action(filmCreate);

program
  .command('poster:create')
  .description('Create a motion-designed poster (animated master + print keyframes)')
  .option('-s, --size <size>', 'Poster size (A4|A3|A2|A1)', 'A2')
  .option('-t, --title <title>', 'Poster title')
  .action(posterCreate);

program
  .command('social:create')
  .description('Create animated social/story content')
  .option('-p, --platform <platform>', 'Platform (instagram|tiktok|linkedin)')
  .option('-f, --format <format>', 'Format (1:1|4:5|9:16)')
  .action(socialCreate);

program
  .command('creative:judge')
  .description('Judge a concept or campaign')
  .option('-c, --concept <id>', 'Concept ID to judge')
  .option('-f, --file <file>', 'Concept file to judge')
  .action(creativeJudge);

// ─── Banner ─────────────────────────────────────────────────────────────────

console.log(chalk.red.bold('PRINTSYNC CREATIVE OS'));
console.log(chalk.gray('Precision in motion. Ideas becoming physical impact.\n'));

program.parse();
