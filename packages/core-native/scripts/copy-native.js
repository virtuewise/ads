// Copy native artifacts to package dist/
const fs = require('fs');
const path = require('path');

const CARGO_TARGET_DIR = path.resolve(__dirname, '../../rust/target/release');
const DIST_DIR = path.resolve(__dirname, '../dist');

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Platform-specific artifact names
const platform = process.platform;
const artifacts = [];

if (platform === 'win32') {
  artifacts.push('core_native.dll', 'core_native.dll.lib');
} else if (platform === 'darwin') {
  artifacts.push('libcore_native.dylib');
} else {
  artifacts.push('libcore_native.so');
}

for (const artifact of artifacts) {
  const src = path.join(CARGO_TARGET_DIR, artifact);
  const dest = path.join(DIST_DIR, artifact);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${artifact} -> dist/`);
  } else {
    console.warn(`Artifact not found: ${artifact}`);
  }
}

// Copy package.json for publishing
const pkgSrc = path.resolve(__dirname, '../package.json');
const pkgDest = path.join(DIST_DIR, 'package.json');
fs.copyFileSync(pkgSrc, pkgDest);

console.log('Native artifacts copied to dist/');