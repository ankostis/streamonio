#!/usr/bin/env node
/**
 * Generate build-info.json with git commit date
 * Run during build to embed release metadata
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

try {
  // Get last commit date in ISO format
  const commitDate = execSync('git log -1 --format=%cI', { encoding: 'utf8' }).trim();
  const commitHash = execSync('git log -1 --format=%h', { encoding: 'utf8' }).trim();

  // Check if this is a dev build (no version tag on HEAD, or NODE_ENV=development)
  let isDev = process.env.NODE_ENV === 'development';
  if (!isDev) {
    try {
      const tagOnHead = execSync('git tag --points-at HEAD', { encoding: 'utf8' }).trim();
      isDev = !tagOnHead || !tagOnHead.match(/^v?\d+\.\d+\.\d+$/);
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
    commitHash: null,
    buildDate: new Date().toISOString(),
  };
  const outputPath = path.join(__dirname, '../src/build-info.json');
  fs.writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2));
}
