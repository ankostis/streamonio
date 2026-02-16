import assert from 'node:assert';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { applyLogFilter, createLogAppender } from '../../src/logger-ui';

// Mock DOM for tests
function createMockViewer(): HTMLDivElement {
  const dom = new JSDOM('<!DOCTYPE html><div id="viewer"></div>');
  const viewer = dom.window.document.getElementById('viewer') as HTMLDivElement;

  // Add scroll properties for auto-scroll tests
  Object.defineProperty(viewer, 'scrollHeight', {
    value: 0,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(viewer, 'scrollTop', {
    value: 0,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(viewer, 'clientHeight', {
    value: 0,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(viewer, 'addEventListener', {
    value: (_event: string, _listener: any) => {
      // Mock addEventListener to prevent scroll listener from breaking tests
    },
    writable: true,
  });

  return viewer;
}

test('applyLogFilter: shows only selected levels', () => {
  const viewer = createMockViewer();

  // Add log lines with dataset.level
  const line1 = viewer.ownerDocument.createElement('div');
  line1.textContent = '[2024-01-01T00:00:00.000Z] ERROR storage: Error msg';
  line1.dataset.level = 'error';
  viewer.appendChild(line1);

  const line2 = viewer.ownerDocument.createElement('div');
  line2.textContent = '[2024-01-01T00:00:01.000Z] WARN api-test: Warn msg';
  line2.dataset.level = 'warn';
  viewer.appendChild(line2);

  const line3 = viewer.ownerDocument.createElement('div');
  line3.textContent = '[2024-01-01T00:00:02.000Z] INFO endpoint-list: Info msg';
  line3.dataset.level = 'info';
  viewer.appendChild(line3);

  const line4 = viewer.ownerDocument.createElement('div');
  line4.textContent = '[2024-01-01T00:00:03.000Z] DEBUG form-input: Debug msg';
  line4.dataset.level = 'debug';
  viewer.appendChild(line4);

  // Filter to show only error and warn
  applyLogFilter(viewer, 'warn');

  assert.strictEqual(line1.style.display, 'block', 'ERROR should be visible');
  assert.strictEqual(line2.style.display, 'block', 'WARN should be visible');
  assert.strictEqual(line3.style.display, 'none', 'INFO should be hidden');
  assert.strictEqual(line4.style.display, 'none', 'DEBUG should be hidden');
});

test('applyLogFilter: shows all when all levels selected', () => {
  const viewer = createMockViewer();

  const line1 = viewer.ownerDocument.createElement('div');
  line1.textContent = '[2024-01-01T00:00:00.000Z] ERROR storage: Error';
  line1.dataset.level = 'error';
  viewer.appendChild(line1);

  const line2 = viewer.ownerDocument.createElement('div');
  line2.textContent = '[2024-01-01T00:00:01.000Z] INFO api-test: Info';
  line2.dataset.level = 'info';
  viewer.appendChild(line2);

  applyLogFilter(viewer, 'debug');

  assert.strictEqual(line1.style.display, 'block');
  assert.strictEqual(line2.style.display, 'block');
});

test('applyLogFilter: hides all when error level selected', () => {
  const viewer = createMockViewer();

  const line1 = viewer.ownerDocument.createElement('div');
  line1.textContent = '[2024-01-01T00:00:00.000Z] WARN storage: Warn';
  line1.dataset.level = 'warn';
  viewer.appendChild(line1);

  const line2 = viewer.ownerDocument.createElement('div');
  line2.textContent = '[2024-01-01T00:00:00.000Z] ERROR storage: Error';
  line2.dataset.level = 'error';
  viewer.appendChild(line2);

  applyLogFilter(viewer, 'error');

  assert.strictEqual(
    line1.style.display,
    'none',
    'WARN should be hidden with error filter',
  );
  assert.strictEqual(
    line2.style.display,
    'block',
    'ERROR should be visible with error filter',
  );
});

test('applyLogFilter: ignores .log-empty placeholder', () => {
  const viewer = createMockViewer();

  const empty = viewer.ownerDocument.createElement('div');
  empty.className = 'log-empty';
  empty.textContent = 'No logs yet';
  viewer.appendChild(empty);

  applyLogFilter(viewer, ['error']);

  // Should not throw or modify the empty placeholder
  assert.strictEqual(viewer.children.length, 1);
  assert.strictEqual(
    empty.style.display,
    '',
    'Empty placeholder should not be affected',
  );
});

test('createLogAppender: appends log lines to viewer', () => {
  const viewer = createMockViewer();
  const appendLog = createLogAppender(viewer);

  appendLog('error', 'storage', 'Test error');
  appendLog('info', 'api-test', 'Test info');

  assert.strictEqual(viewer.children.length, 2);
  assert(viewer.children[0].textContent?.includes('ERROR'));
  assert(viewer.children[0].textContent?.includes('storage'));
  assert(viewer.children[1].textContent?.includes('INFO'));
  assert(viewer.children[1].textContent?.includes('api-test'));
});

test('createLogAppender: removes .log-empty placeholder on first log', () => {
  const viewer = createMockViewer();

  const empty = viewer.ownerDocument.createElement('div');
  empty.className = 'log-empty';
  empty.textContent = 'No logs yet';
  viewer.appendChild(empty);

  const appendLog = createLogAppender(viewer);
  appendLog('info', 'storage', 'First log');

  assert.strictEqual(
    viewer.querySelectorAll('.log-empty').length,
    0,
    'Empty placeholder should be removed',
  );
  assert.strictEqual(viewer.children.length, 1, 'Only log line should remain');
});
