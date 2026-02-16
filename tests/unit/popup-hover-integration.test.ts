import assert from 'node:assert';
import test from 'node:test';
import { JSDOM } from 'jsdom';

test('popup/hover integration: logs should appear in DOM after createLogViewer', () => {
  // Simulate the popup/hover HTML structure
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <div id="status-bar"></div>
        <span id="status-message"></span>
        <div id="log-viewer" class="log-viewer"></div>
      </body>
    </html>
  `);
  global.document = dom.window.document as any;
  global.window = dom.window as any;

  // Import modules after DOM is set up
  const { initLogging } = require('../../src/components-ui');
  const { createLogViewer } = require('../../src/logger-ui');

  // STEP 1: Initialize logging with temp div (simulating popup/hover behavior)
  const tempLogViewer = dom.window.document.createElement('div');
  const { logger } = initLogging('test', {
    statusBar: document.getElementById('status-bar') as HTMLDivElement,
    statusMsg: document.getElementById('status-message') as HTMLSpanElement,
    logViewer: tempLogViewer, // Temp div, not in DOM
  });

  // STEP 2: Create log viewer in actual DOM (what popup/hover do later)
  const logViewerContainer = document.getElementById('log-viewer');
  createLogViewer(logViewerContainer!, logger);

  // STEP 3: Log something
  logger.info('Test message');

  // STEP 4: Verify log appears in the DOM (not in temp div)
  const logContent = document.getElementById('log-content');
  assert.notStrictEqual(
    logContent,
    null,
    'log-content should exist in DOM after createLogViewer',
  );

  const logLines = logContent!.querySelectorAll('div:not(.log-empty)');
  assert.strictEqual(
    logLines.length,
    1,
    `Expected 1 log line in DOM, found ${logLines.length}`,
  );

  const logText = logLines[0].textContent || '';
  assert.match(
    logText,
    /Test message/,
    `Log should contain "Test message", got: ${logText}`,
  );
});

test('options integration: logs should appear in log-content not parent', () => {
  // Simulate the options HTML structure
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <div id="status-bar"></div>
        <span id="status-message"></span>
        <div id="log-viewer" class="log-viewer"></div>
      </body>
    </html>
  `);
  global.document = dom.window.document as any;
  global.window = dom.window as any;

  // Import modules after DOM is set up
  const { initLogging } = require('../../src/components-ui');
  const { createLogViewer } = require('../../src/logger-ui');

  // STEP 1: Initialize logging with log-viewer container (simulating options behavior)
  const logViewerContainer = document.getElementById(
    'log-viewer',
  ) as HTMLDivElement;
  const { logger } = initLogging('test', {
    statusBar: document.getElementById('status-bar') as HTMLDivElement,
    statusMsg: document.getElementById('status-message') as HTMLSpanElement,
    logViewer: logViewerContainer, // Parent container
  });

  // STEP 2: Create log viewer structure (creates log-content child)
  createLogViewer(logViewerContainer, logger);

  // STEP 3: Log something
  logger.info('Test message');

  // STEP 4: Verify log appears in log-content (not in parent log-viewer)
  const logContent = document.getElementById('log-content');
  assert.notStrictEqual(
    logContent,
    null,
    'log-content should exist after createLogViewer',
  );

  const logContentLines = logContent!.querySelectorAll('div:not(.log-empty)');
  assert.strictEqual(
    logContentLines.length,
    1,
    `Expected 1 log line in log-content, found ${logContentLines.length}`,
  );

  // Also verify logs are NOT in the parent (direct children of log-viewer)
  const parentChildren = Array.from(logViewerContainer.children);
  const logsInParent = parentChildren.filter(
    (el) =>
      el.id !== 'log-content' &&
      !el.classList.contains('log-filter-bar') &&
      !el.classList.contains('log-action-bar'),
  );
  assert.strictEqual(
    logsInParent.length,
    0,
    `Expected no log lines directly in log-viewer parent, found ${logsInParent.length}`,
  );
});
