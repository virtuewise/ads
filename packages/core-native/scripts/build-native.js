// Build native module with graceful fallback
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARGO_MANIFEST = path.resolve(__dirname, '../../rust/core-native/Cargo.toml');
const DIST_DIR = path.resolve(__dirname, '../dist');

const isDev = process.argv.includes('--dev');
const isRelease = !isDev;

function hasCargo() {
  try {
    execSync('cargo --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runCargo(args) {
  console.log(`Running: cargo ${args.join(' ')}`);
  execFileSync('cargo', args, { stdio: 'inherit', cwd: path.dirname(CARGO_MANIFEST) });
}

function copyArtifacts() {
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  const platform = process.platform;
  let artifacts = [];

  if (platform === 'win32') {
    artifacts = ['core_native.dll', 'core_native.dll.lib'];
  } else if (platform === 'darwin') {
    artifacts = ['libcore_native.dylib'];
  } else {
    artifacts = ['libcore_native.so'];
  }

  const profile = isRelease ? 'release' : 'debug';
  const targetDir = path.resolve(__dirname, `../../rust/target/${profile}`);

  let copied = 0;
  for (const artifact of artifacts) {
    const src = path.join(targetDir, artifact);
    const dest = path.join(DIST_DIR, artifact);

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`Copied ${artifact} -> dist/`);
      copied++;
    }
  }

  if (copied === 0) {
    console.warn('No native artifacts found to copy');
  }

  // Copy package.json
  const pkgSrc = path.resolve(__dirname, '../package.json');
  const pkgDest = path.join(DIST_DIR, 'package.json');
  fs.copyFileSync(pkgSrc, pkgDest);
}

function main() {
  console.log(`Building @printsync/core-native (${isRelease ? 'release' : 'dev'})...`);

  if (!hasCargo()) {
    console.warn('WARNING: Cargo not found in PATH. Skipping native build.');
    console.warn('   Native module will use TypeScript fallbacks at runtime.');
    console.warn('   To enable native acceleration, install Rust: https://rustup.rs/');

    // Create empty dist dir for fallback
    if (!fs.existsSync(DIST_DIR)) {
      fs.mkdirSync(DIST_DIR, { recursive: true });
    }
    return;
  }

  try {
    const args = ['build', '--manifest-path', CARGO_MANIFEST];
    if (isRelease) args.push('--release');
    runCargo(args);
    copyArtifacts();
    console.log('Native module built successfully');
  } catch (error) {
    console.error('Native build failed:', error.message);
    console.warn('Falling back to TypeScript implementations');
    process.exitCode = 0; // Don't fail the build
  }
}

main();
