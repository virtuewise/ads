// Build the native module for wasm32-unknown-unknown, then stage the artefacts.
// Mirrors `build-native.js`: skips gracefully when Cargo is unavailable.
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARGO_MANIFEST = path.resolve(__dirname, '../../rust/core-native/Cargo.toml');

function hasCargo() {
  try {
    execSync('cargo --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (!hasCargo()) {
  console.warn('WARNING: Cargo not found in PATH. Skipping WASM build.');
  console.warn('   To enable the WASM build, install Rust: https://rustup.rs/');
  process.exit(0);
}

console.log('Building @printsync/core-native (wasm32-unknown-unknown)...');
execSync(
  `cargo build --manifest-path "${CARGO_MANIFEST}" --release --target wasm32-unknown-unknown`,
  { stdio: 'inherit' },
);

// Stage the artefact and emit the JS wrapper (shared with the copy-only helper).
await import('./copy-wasm.js');
