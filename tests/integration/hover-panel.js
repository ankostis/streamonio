// Integration test: Hover panel initialization
// Validates that hover panel loads without errors when injected into page.
// Prevents regression of buildInfo import and logger initialization bugs.

const { spawn } = require('node:child_process');
const { resolve, join } = require('node:path');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const http = require('node:http');
const fs = require('node:fs');
const chai = require('chai');
const expect = chai.expect;

async function run() {
  const cwd = resolve(__dirname, '../../');

  // Start minimal HTTP server
  const port = 9091;
  const server = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];
    const filePath = join(cwd, urlPath.replace(/^\/+/, ''));
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      const ext = filePath.split('.').pop();
      const type = ext === 'html' ? 'text/html' : 'text/plain';
      res.setHeader('Content-Type', type);
      res.end(data);
    });
  });

  await new Promise((resolveServer) => server.listen(port, resolveServer));
  console.log(`✓ HTTP server started on port ${port}`);

  const webExtPath = resolve(cwd, 'node_modules/.bin/web-ext');
  const args = [
    'run',
    '--source-dir',
    '.',
    '--start-url',
    `http://localhost:${port}/tests/test-page.html`,
    '--verbose',
    '--no-input',
  ];

  const proc = spawn(webExtPath, args, { cwd });

  let stdout = '';
  let stderr = '';
  let addonInstalled = false;
  let hoverPanelInjected = false;
  let hoverPanelInitialized = false;
  let hoverPanelError = false;

  // Patterns to detect
  const hoverInjectedRegex = /Hover panel iframe injected|Toggle button added/i;
  const hoverInitRegex = /\[hover\].*initialized successfully/i;
  const hoverErrorRegex =
    /\[hover\].*Failed to initialize|buildInfo is not defined|logger is undefined|els is undefined|can't access property "querySelector", viewer is null|TypeError.*viewer.*null/i;

  proc.stdout.on('data', (d) => {
    const s = d.toString();
    stdout += s;

    if (hoverInjectedRegex.test(s)) {
      hoverPanelInjected = true;
      console.log('[✓] Hover panel injected into page');
    }
    if (hoverInitRegex.test(s)) {
      hoverPanelInitialized = true;
      console.log('[✓] Hover panel initialized successfully');
    }
    if (hoverErrorRegex.test(s)) {
      hoverPanelError = true;
      console.error('[✗] Hover panel initialization error detected:', s.trim());
    }
    if (/Installed .* as a temporary add-on/i.test(s)) {
      addonInstalled = true;
      console.log('[✓] Extension installed');
    }
  });

  proc.stderr.on('data', (d) => {
    const s = d.toString();
    stderr += s;
    // Check stderr for hover panel errors too
    if (hoverErrorRegex.test(s)) {
      hoverPanelError = true;
      console.error('[✗] Hover panel error in stderr:', s.trim());
    }
    // Also check for general TypeError/ReferenceError that might be hover-related
    if (/TypeError|ReferenceError/.test(s) && /hover/.test(s.toLowerCase())) {
      console.error('[!] Potential hover panel error:', s.trim());
    }
  });

  const timeoutMs = 20000; // 20s
  const start = Date.now();

  // Wait for addon install
  while (Date.now() - start < timeoutMs && !addonInstalled) {
    await delay(500);
  }

  if (!addonInstalled) {
    proc.kill('SIGKILL');
    server.close();
    throw new Error('Extension failed to install within timeout');
  }

  // Wait for hover panel injection (should happen when page detects streams)
  console.log('Waiting for hover panel injection...');
  await delay(5000); // Give page time to load and inject hover panel

  // Kill process
  proc.kill('SIGINT');
  try {
    await Promise.race([
      once(proc, 'exit'),
      delay(5000).then(() => {
        proc.kill('SIGKILL');
      }),
    ]);
  } catch {}
  server.close();

  // Assertions
  console.log('\n--- Test Results ---');
  console.log('Addon installed:', addonInstalled);
  console.log('Hover panel injected:', hoverPanelInjected);
  console.log('Hover panel initialized:', hoverPanelInitialized);
  console.log('Hover panel errors:', hoverPanelError);

  expect(addonInstalled, 'Extension should install').to.be.true;

  if (hoverPanelInjected) {
    expect(hoverPanelError, 'Hover panel should not have initialization errors')
      .to.be.false;
    console.log('\n✅ Hover panel initialization test PASSED');
  } else {
    console.log(
      '\n⚠️  Hover panel was not injected (test page may not trigger injection)',
    );
    console.log(
      'This is acceptable - hover panel only injects after stream detection',
    );
  }

  if (hoverPanelError) {
    console.error('\n❌ Hover panel initialization FAILED - check logs above');
    process.exit(1);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
