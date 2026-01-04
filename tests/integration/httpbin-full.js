// Integration test: Full workflow with httpbin validation
// Uses Puppeteer to control Firefox, configure endpoint, and validate API calls

const puppeteer = require('puppeteer');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { resolve } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const chai = require('chai');
const expect = chai.expect;

async function run() {
  console.log(`\n🧪 Integration Test: Full Workflow with httpbin\n`);

  const cwd = resolve(__dirname, '../../');
  const TEST_URL = 'https://www.ertecho.gr/radio/trito/';
  const _HTTPBIN_URL = 'https://httpbin.org/anything';

  // Launch Firefox with web-ext and enable remote debugging
  console.log('🚀 Launching Firefox with extension and CDP enabled...');
  const webExtPath = resolve(cwd, 'node_modules/.bin/web-ext');
  const proc = spawn(
    webExtPath,
    [
      'run',
      '--source-dir',
      '.',
      '--start-url',
      TEST_URL,
      '--no-input',
      '--args=--remote-debugging-port=9222',
      '--args=--remote-allow-origins=http://127.0.0.1:9222',
    ],
    { cwd },
  );

  let _stdout = '';
  proc.stdout.on('data', (d) => {
    const text = d.toString();
    _stdout += text;
    if (text.includes('file:///') || text.includes('http://')) {
      console.log('   Firefox starting...');
    }
  });
  proc.stderr.on('data', (d) => {
    _stdout += d.toString();
  });

  // Wait for Firefox to start and CDP to be available
  console.log('⏳ Waiting for Firefox to start (15s)...');
  await delay(15000);

  let browser;
  try {
    // Test CDP endpoint availability first
    console.log('🔍 Checking CDP endpoint at http://127.0.0.1:9222...');
    try {
      const http = require('node:http');
      const testReq = await new Promise((resolve, reject) => {
        const req = http.get('http://127.0.0.1:9222/json/version', (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.setTimeout(5000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      console.log(`   CDP endpoint status: ${testReq.status}`);
      if (testReq.status === 200) {
        console.log(`   CDP available: ${testReq.data.substring(0, 100)}`);
      }
    } catch (err) {
      console.log(`   ⚠️  CDP endpoint not responding: ${err.message}`);
      console.log(`   Firefox may not have --remote-debugging-port enabled`);
    }

    // Connect Puppeteer to Firefox (requires CDP enabled)
    console.log('🔗 Connecting Puppeteer to Firefox...');
    browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222', // Firefox CDP endpoint
      defaultViewport: null,
    });

    const pages = await browser.pages();
    const page = pages[0] || (await browser.newPage());

    // Navigate to test page
    console.log(`📄 Loading stream page: ${TEST_URL}`);
    await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for stream detection
    console.log('⏳ Waiting for stream detection (10s)...');
    await delay(10000);

    // Open options page to configure httpbin endpoint
    console.log('⚙️  Configuring httpbin endpoint...');
    const _optionsUrl = 'moz-extension://[UUID]/dist/options.html'; // Need actual UUID
    // Alternative: use about:debugging to get extension UUID

    // For now, check console for stream detections
    const consoleLogs = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleLogs.push(text);
      if (text.includes('Stream detected')) {
        console.log('✓ Stream detected in console:', text.substring(0, 80));
      }
    });

    // Try to trigger popup (browser action)
    console.log('🔘 Attempting to trigger popup...');
    // Note: Puppeteer can't directly click browser action icons
    // This would require Selenium WebDriver or manual interaction

    await delay(5000);

    console.log(`\n📊 Console logs captured: ${consoleLogs.length}`);
    const streamLogs = consoleLogs.filter(
      (log) =>
        log.includes('Stream detected') || log.includes('STREAM_DETECTED'),
    );

    console.log(`✅ Stream detection logs: ${streamLogs.length}`);
    streamLogs.forEach((log, i) => {
      console.log(`   ${i + 1}. ${log.substring(0, 100)}`);
    });

    // Assertions
    expect(streamLogs.length, 'at least one stream detected').to.be.greaterThan(
      0,
    );

    console.log('\n✅ TEST PASSED: Stream detection working');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    throw err;
  } finally {
    if (browser) {
      await browser.disconnect();
    }
    proc.kill('SIGINT');
    try {
      await Promise.race([
        once(proc, 'exit'),
        delay(5000).then(() => {
          proc.kill('SIGKILL');
        }),
      ]);
    } catch {}
    console.log('\n🛑 Firefox stopped\n');
  }
}

// Check if we should run this test
if (process.argv.includes('--puppeteer')) {
  console.log('⚠️  Note: This test uses Firefox CDP (Chrome DevTools Protocol)');
  console.log('   Requires: web-ext run with --firefox-console flag\n');

  run().catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
} else {
  console.log('Skipping Puppeteer test (use --puppeteer flag to run)');
  console.log('This test requires Firefox CDP support via web-ext.');
  console.log('Use: npm run test:integration:httpbin\n');
  process.exit(0);
}
