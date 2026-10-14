import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Remove build artefacts across every workspace project.
 *
 * Invoked by `pnpm clean` and by the `clean` task in `Makefile.toml`.
 */
const ARTEFACTS = ['dist', '.next', '.turbo', 'tsconfig.tsbuildinfo'];
const WORKSPACE_ROOTS = ['packages', 'apps'];

const projects = ['.'];
for (const base of WORKSPACE_ROOTS) {
  if (!existsSync(base)) continue;
  for (const name of readdirSync(base)) {
    const dir = join(base, name);
    if (existsSync(join(dir, 'package.json'))) projects.push(dir);
  }
}

for (const project of projects) {
  for (const artefact of ARTEFACTS) {
    rmSync(join(project, artefact), { recursive: true, force: true });
  }
}

console.log(`Cleaned build artefacts in ${projects.length} project folders.`);
