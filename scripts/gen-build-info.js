#!/usr/bin/env node
/**
 * Generate build-info.json with git commit date
 * Sync manifest.json version from package.json (single source of truth)
 * Run during build to embed release metadata
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

try {
  // Read version from package.json (single source of truth)
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  const version = packageJson.version;

  // Sync version to manifest.json
  const manifestPath = path.join(__dirname, '../manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== version) {
    manifest.version = version;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`✓ Synced manifest.json version: ${version}`);
  }

  // Get last commit date in ISO format
  const commitDate = execSync('git log -1 --format=%cI', { encoding: 'utf8' }).trim();
  const commitHash = execSync('git log -1 --format=%h', { encoding: 'utf8' }).trim();

  // Check if this is a dev build (no tag, or tag doesn't match version, or NODE_ENV=development)
  let isDev = process.env.NODE_ENV === 'development';
  if (!isDev) {
    try {
      const tagOnHead = execSync('git tag --points-at HEAD', { encoding: 'utf8' }).trim();
      // Dev if no tag, or tag doesn't match current version (with or without 'v' prefix)
      isDev = !tagOnHead || !(tagOnHead === version || tagOnHead === `v${version}`);
    } catch {
      isDev = true; // If git tag fails, assume dev
    }
  }

  const buildInfo = {
    commitDate,
    commitHash,
    buildDate: new Date().toISOString(),
    isDev,
  };

  const outputPath = path.join(__dirname, '../src/build-info.json');
  fs.writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2));

  console.log('✓ Generated build-info.json:', buildInfo);
} catch (error) {
  console.warn('⚠ Could not generate build info (not in git repo?):', error.message);
  // Create fallback build info
  const buildInfo = {
    commitDate: null,
    commitHash: null,
    buildDate: new Date().toISOString(),
    isDev: true, // Assume dev if not in git
  };
  const outputPath = path.join(__dirname, '../src/build-info.json');
  fs.writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2));
}
