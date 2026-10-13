// Copy WASM artifacts to package dist/wasm/
const fs = require('fs');
const path = require('path');

const CARGO_TARGET_DIR = path.resolve(__dirname, '../../rust/target/wasm32-unknown-unknown/release');
const DIST_DIR = path.resolve(__dirname, '../dist/wasm');

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

const wasmFile = 'core_native.wasm';
const src = path.join(CARGO_TARGET_DIR, wasmFile);
const dest = path.join(DIST_DIR, wasmFile);

if (fs.existsSync(src)) {
  fs.copyFileSync(src, dest);
  console.log(`Copied ${wasmFile} -> dist/wasm/`);
} else {
  console.error(`WASM artifact not found: ${src}`);
  process.exit(1);
}

// Create a small JS wrapper for the WASM module
const wrapper = `
// WASM wrapper for @printsync/core-native
// Auto-generated - DO NOT EDIT MANUALLY

import init, { 
  fnv1a_64, fnv1a_32, mulberry32,
  frame_distance, boulevard_pose, subject_pose,
  analyze_frequency_bands, kerbside_clearance,
  lift_panel_above_shop, city_grid_positions
} from './core_native_bg.wasm';

let initialized = false;

export async function initCoreNative() {
  if (!initialized) {
    await init();
    initialized = true;
  }
}

export {
  fnv1a_64, fnv1a_32, mulberry32,
  frame_distance, boulevard_pose, subject_pose,
  analyze_frequency_bands, kerbside_clearance,
  lift_panel_above_shop, city_grid_positions
};

export type {
  Vec3,
  BoulevardPose,
  SubjectPose
} from './core_native';
`;

fs.writeFileSync(path.join(DIST_DIR, 'index.js'), wrapper);
console.log('WASM wrapper created at dist/wasm/index.js');