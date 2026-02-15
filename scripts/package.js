#!/usr/bin/env node
/**
 * Package the extension with -dev suffix if isDev flag is set
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

try {
  const buildInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/build-info.json'), 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

  const version = packageJson.version;
  const suffix = buildInfo.isDev ? '-dev' : '';
  const filename = `streamonio-${version}${suffix}.zip`;

  console.log(`📦 Packaging: ${filename}`);

  execSync(`zip -r ${filename} manifest.json dist icons -x 'icons/generate-icons.html'`, {
    stdio: 'inherit',
    encoding: 'utf8'
  });

  console.log(`✓ Package created: ${filename}`);
} catch (error) {
  console.error('❌ Packaging failed:', error.message);
  process.exit(1);
}
