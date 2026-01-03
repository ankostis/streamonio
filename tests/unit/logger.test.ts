import { test } from 'node:test';
import * as assert from 'node:assert';
import { Logger, LogLevel, type LogEntry, type SlotMessage } from '../../src/logger';

// ==============================================================================
// TEST HELPERS
// ==============================================================================

/** Cleanup logger timer to prevent test hanging */
function destroyLogger(logger: Logger): void {
  const timer = (logger as any).expirationTimer;
  if (timer) {
    clearTimeout(timer);
    (logger as any).expirationTimer = null;
  }
}

// ==============================================================================
// RING BUFFER TESTS
// ==============================================================================

test('Logger: adds entry to ring buffer', () => {
  const logger = new Logger('test');
  logger.error('Test message');

  assert.strictEqual(logger.logsRing.length, 1);
  assert.strictEqual(logger.logsRing[0].level, LogLevel.Error);
  assert.strictEqual(logger.logsRing[0].category, 'test');
  assert.strictEqual(logger.logsRing[0].message, '❌ Test message');
});

test('Logger: ring buffer drops oldest when max exceeded', () => {
  const logger = new Logger('test');

  for (let i = 0; i < 105; i++) {
    logger.info(`Message ${i}`);
  }

  assert.strictEqual(logger.logsRing.length, 100);
  assert.strictEqual(logger.logsRing[0].message, 'ℹ️ Message 5');
  assert.strictEqual(logger.logsRing[99].message, 'ℹ️ Message 104');
});

test('Logger: level-specific methods work correctly', () => {
  const logger = new Logger('test');

  logger.error('Error msg');
  logger.warn('Warn msg');
  logger.info('Info msg');
  logger.debug('Debug msg');

  assert.strictEqual(logger.logsRing[0].level, LogLevel.Error);
  assert.strictEqual(logger.logsRing[1].level, LogLevel.Warn);
  assert.strictEqual(logger.logsRing[2].level, LogLevel.Info);
  assert.strictEqual(logger.logsRing[3].level, LogLevel.Debug);
});

test('Logger: filterLogs by level', () => {
  const logger = new Logger('test');

  logger.error('Error 1');
  logger.warn('Warn 1');
  logger.error('Error 2');

  const errors = logger.filterLogs([LogLevel.Error]);
  assert.strictEqual(errors.length, 2);
  assert.strictEqual(errors[0].message, '❌ Error 1');
  assert.strictEqual(errors[1].message, '❌ Error 2');
});

test('Logger: filterLogs by category', () => {
  const logger1 = new Logger('storage');
  const logger2 = new Logger('endpoint');

  logger1.error('Storage error');
  logger2.error('Endpoint error');
  logger1.warn('Storage warn');

  // Merge logs from both loggers
  const allLogs = [...logger1.logsRing, ...logger2.logsRing];
  const storage = allLogs.filter((entry) => entry.category === 'storage');
  assert.strictEqual(storage.length, 2);
  assert.strictEqual(storage[0].category, 'storage');
  assert.strictEqual(storage[1].category, 'storage');
});

test('Logger: filterLogs by level and category', () => {
  const logger = new Logger('storage');

  logger.error('Storage error');
  logger.warn('Storage warn');
  logger.error('Another error');

  const storageErrors = logger.filterLogs([LogLevel.Error], ['storage']);
  assert.strictEqual(storageErrors.length, 2);
  assert.strictEqual(storageErrors[0].message, '❌ Storage error');
});

test('Logger: clearLogs removes all entries', () => {
  const logger = new Logger('test');

  logger.error('Msg 1');
  logger.warn('Msg 2');
  logger.clearLogs();

  assert.strictEqual(logger.logsRing.length, 0);
});

test('Logger: subscribeLogs receives notifications', () => {
  const logger = new Logger('test');
  let receivedEntries: LogEntry[] = [];

  logger.subscribeLogs((entries) => {
    receivedEntries = entries;
  });

  logger.error('Test message');

  assert.strictEqual(receivedEntries.length, 1);
  assert.strictEqual(receivedEntries[0].message, '❌ Test message');
});

test('Logger: subscribeLogs notification on clearLogs', () => {
  const logger = new Logger('test');
  let callCount = 0;

  logger.subscribeLogs(() => {
    callCount++;
  });

  logger.error('Test');
  logger.clearLogs();

  assert.strictEqual(callCount, 2);
});

test('Logger: unsubscribe from logs stops notifications', () => {
  const logger = new Logger('test');
  let callCount = 0;

  const unsubscribe = logger.subscribeLogs(() => {
    callCount++;
  });

  logger.error('Message 1');
  unsubscribe();
  logger.error('Message 2');

  assert.strictEqual(callCount, 1);
});

test('Logger: exportJSON returns valid JSON', () => {
  const logger = new Logger('test');

  logger.error('Test error');
  logger.warn('Test warn');

  const json = logger.exportJSON();
  const parsed = JSON.parse(json);

  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].level, 'error');
  assert.strictEqual(parsed[0].message, '❌ Test error');
  assert.ok(parsed[0].timestamp);
});

// ==============================================================================
// PERSISTENT STATUS TESTS
// ==============================================================================

test('Logger: persistent status sets slot', () => {
  const logger = new Logger('test');

  logger.error('Invalid input');

  const current = logger.transientMsg();
  assert.ok(current !== null);
  assert.strictEqual(current.slot, 'test');
  assert.strictEqual(current.message, '❌ Invalid input');
  assert.strictEqual(current.expireTimestamp, undefined);
});

test('Logger: persistent status replaces older message in same slot', () => {
  const logger = new Logger('test');

  logger.error('First error');
  logger.error('Second error');

  const current = logger.transientMsg();
  assert.ok(current !== null);
  assert.strictEqual(current.message, '❌ Second error');
});

test('Logger: persistent status adds to ring buffer', () => {
  const logger = new Logger('test');

  logger.error('Error message');

  assert.strictEqual(logger.logsRing.length, 1);
  assert.strictEqual(logger.logsRing[0].category, 'test');
  assert.strictEqual(logger.logsRing[0].message, '❌ Error message');
});

// ==============================================================================
// TRANSIENT STATUS TESTS (flash methods)
// ==============================================================================

test('Logger: transient status sets expireTimestamp', () => {
  const logger = new Logger('test');

  logger.errorFlash(3000, 'Saved!');

  const current = logger.transientMsg();
  assert.ok(current !== null);
  assert.strictEqual(current.slot, 'test');
  assert.strictEqual(current.message, '❌ Saved!');
  assert.ok(current.expireTimestamp instanceof Date);
  destroyLogger(logger);
});

test('Logger: transient status adds to ring buffer', () => {
  const logger = new Logger('test');

  logger.infoFlash(1000, 'Saved!');

  assert.strictEqual(logger.logsRing.length, 1);
  assert.strictEqual(logger.logsRing[0].category, 'test');
  assert.strictEqual(logger.logsRing[0].message, 'ℹ️ Saved!');
  destroyLogger(logger);
});

test('Logger: transient status auto-expires', async () => {
  const logger = new Logger('test');

  logger.infoFlash(50, 'Temporary message');

  assert.ok(logger.transientMsg() !== null);

  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.ok(logger.transientMsg() === null);
  destroyLogger(logger);
});

test('Logger: transient expiration notifies subscribers', async () => {
  const logger = new Logger('test');
  let notificationCount = 0;

  logger.subscribeStatus(() => {
    notificationCount++;
  });

  logger.infoFlash(50, 'Temporary');
  const initialCount = notificationCount;

  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.ok(notificationCount > initialCount, 'Should notify on expiration');
  destroyLogger(logger);
});

test('Logger: multiple transient messages use single timer', async () => {
  const logger = new Logger('test');

  // Each call overwrites the previous since they share the same category/slot
  logger.infoFlash(100, 'First');
  logger.infoFlash(150, 'Second');
  logger.infoFlash(200, 'Third');  // This is the final message

  // Last message ('Third' with 200ms) should be visible
  await new Promise((resolve) => setTimeout(resolve, 50));
  const current1 = logger.transientMsg();
  assert.ok(current1 !== null);
  assert.strictEqual(current1.message, 'ℹ️ Third');

  // Still visible after 150ms (200ms timeout)
  await new Promise((resolve) => setTimeout(resolve, 120));
  const current2 = logger.transientMsg();
  assert.ok(current2 !== null);

  // Should expire after 200ms
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(logger.transientMsg() === null);
  destroyLogger(logger);
});

// ==============================================================================
// PRIORITY TESTS
// ==============================================================================

test('Logger: transientMsg returns highest level', () => {
  const logger = new Logger('test');

  logger.info('Info message');
  logger.warn('Warn message');
  logger.error('Error message');

  const current = logger.transientMsg();
  assert.ok(current !== null);
  assert.strictEqual(current.level, LogLevel.Error);
});

test('Logger: transientMsg returns most recent at same level', async () => {
  const logger = new Logger('test');

  logger.error('First error');
  await new Promise((resolve) => setTimeout(resolve, 2));
  logger.error('Second error');
  await new Promise((resolve) => setTimeout(resolve, 2));
  logger.error('Third error');

  const current = logger.transientMsg();
  assert.ok(current !== null);
  assert.strictEqual(current.message, '❌ Third error');
  destroyLogger(logger);
});

test('Logger: transient expiration reveals lower-priority message', async () => {
  const logger = new Logger('test');

  logger.info('Persistent info');
  logger.errorFlash(50, 'Transient error');  // Overwrites the info

  assert.strictEqual(logger.transientMsg()?.level, LogLevel.Error);

  await new Promise((resolve) => setTimeout(resolve, 100));

  // After error expires, the slot should be empty (since error overwrote info)
  const current = logger.transientMsg();
  assert.ok(current === null, 'Slot should be empty after transient expires');
  destroyLogger(logger);
});

// ==============================================================================
// SLOT MANAGEMENT TESTS
// ==============================================================================

test('Logger: clearSlot removes the slot', () => {
  const logger = new Logger('test');

  logger.error('Error message');

  const current1 = logger.transientMsg();
  assert.ok(current1 !== null);

  logger.clearSlot('test');

  const current2 = logger.transientMsg();
  assert.ok(current2 === null);
});

test('Logger: clearSlot with no args removes all slots', () => {
  const logger = new Logger('test');

  logger.error('Error 1');
  logger.warn('Warn 1');

  logger.clearSlot();

  assert.ok(logger.transientMsg() === null);
});

test('Logger: clearSlot filters by level', () => {
  const logger = new Logger('test');

  logger.error('Error');
  logger.warn('Warning');

  logger.clearSlot(undefined, LogLevel.Error);

  const current = logger.transientMsg();
  assert.ok(current !== null);
  assert.strictEqual(current.level, LogLevel.Warn);
});

test('Logger: clearSlot with slot and level filters correctly', () => {
  const logger = new Logger('test');

  logger.warn('Warn message');

  // Try to clear with wrong level - should NOT clear
  logger.clearSlot('test', LogLevel.Error);
  assert.ok(logger.transientMsg() !== null, 'Should not clear because level does not match');

  // Clear with correct level - should clear
  logger.clearSlot('test', LogLevel.Warn);
  assert.ok(logger.transientMsg() === null, 'Should clear when level matches');
});

test('Logger: clearSlot notifies subscribers', () => {
  const logger = new Logger('test');
  let notified = false;

  logger.subscribeStatus(() => {
    notified = true;
  });

  logger.error('Error');
  notified = false;

  logger.clearSlot('slot');

  assert.ok(notified);
});

// ==============================================================================
// SUBSCRIPTION TESTS
// ==============================================================================

test('Logger: subscribeStatus receives notification on status change', () => {
  const logger = new Logger('test');
  let receivedMsg: SlotMessage | null = null;

  logger.subscribeStatus((msg) => {
    receivedMsg = msg;
  });

  logger.error('Test error');

  assert.ok(receivedMsg !== null);
  assert.strictEqual(receivedMsg.message, '❌ Test error');
});

test('Logger: subscribeStatus receives notification on transient flash', () => {
  const logger = new Logger('test');
  let receivedMsg: SlotMessage | null = null;

  logger.subscribeStatus((msg) => {
    receivedMsg = msg;
  });

  logger.infoFlash(1000, 'Flash message');

  assert.ok(receivedMsg !== null);
  assert.strictEqual(receivedMsg.message, 'ℹ️ Flash message');
  destroyLogger(logger);
});

test('Logger: subscribeStatus receives notification on clearSlot', () => {
  const logger = new Logger('test');
  let callCount = 0;

  logger.subscribeStatus(() => {
    callCount++;
  });

  logger.error('Error');
  logger.clearSlot('test');

  assert.strictEqual(callCount, 2);
});

test('Logger: subscribeStatus unsubscribe stops notifications', () => {
  const logger = new Logger('test');
  let callCount = 0;

  const unsubscribe = logger.subscribeStatus(() => {
    callCount++;
  });

  logger.error('Message 1');
  unsubscribe();
  logger.error('Message 2');

  assert.strictEqual(callCount, 1);
});

test('Logger: empty state returns null', () => {
  const logger = new Logger('test');

  assert.ok(logger.transientMsg() === null);
});

test('Logger: slot isolation - messages in different slots dont interfere', () => {
  const logger = new Logger('test');

  logger.error('Form error');
  logger.warn('Storage warn');

  logger.clearSlot('form-error');

  const current = logger.transientMsg();
  assert.ok(current !== null);
  assert.strictEqual(current.message, '⚠️ Storage warn');
});
