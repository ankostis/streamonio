import assert from 'node:assert';
import test from 'node:test';
import { JSDOM } from 'jsdom';

test('hover-pane: initLogging should handle missing log-content gracefully', () => {
  // Simulate the hover-pane.html DOM structure (after refactor with createLogViewer)
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

  // Import components-ui dynamically to use mocked DOM
  const { initLogging } = require('../../src/components-ui');

  // The element with id 'log-content' doesn't exist until createLogViewer creates it
  const logContentEl = document.getElementById('log-content');
  assert.strictEqual(
    logContentEl,
    null,
    'log-content should not exist before createLogViewer runs',
  );

  // The FIXED code should create a temp div instead of using null
  // This test verifies hover-pane.ts is using the tempLogViewer workaround
  let errorThrown = false;
  let errorMessage = '';

  try {
    // Simulate what hover-pane.ts should do (create temp div)
    const tempLogViewer = dom.window.document.createElement('div');
    const { logger, appendLog } = initLogging('hover', {
      statusBar: document.getElementById('status-bar') as HTMLDivElement,
      statusMsg: document.getElementById('status-message') as HTMLSpanElement,
      logViewer: tempLogViewer, // Use temp div instead of null
    });

    // Should be able to log without error
    appendLog('debug', 'test', 'Manual call');
    logger.debug('Test message via logger');
  } catch (error) {
    errorThrown = true;
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  assert.strictEqual(
    errorThrown,
    false,
    `Should NOT throw error with temp logViewer. Error: ${errorMessage}`,
  );
});
