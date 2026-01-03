# Test Helper Notes

## Detecting Stuck Tests

If tests hang, use these commands to isolate the problem:

```bash
# Test each file individually with timeout
for f in tests/unit/*.test.ts; do 
  echo "=== Testing $f ==="; 
  timeout 5 npx tsx --test "$f" 2>&1 | tail -5 || echo "TIMEOUT or ERROR"; 
done

# Run specific test file with output
timeout 10 npx tsx --test tests/unit/logger.test.ts 2>&1 | tee /tmp/test-output.txt

# Capture test progress before timeout
(timeout 12 npx tsx --test tests/unit/logger.test.ts 2>&1 &)
sleep 8
pkill -9 tsx
```

## Logger Test Cleanup

Logger tests use timers for transient messages. Always call `destroyLogger(logger)` after tests that use flash methods to prevent hanging:

```typescript
test('Logger: transient message test', async () => {
  const logger = new Logger('test');
  
  logger.infoFlash(100, 'Message');
  
  // Test assertions...
  
  destroyLogger(logger);  // ← IMPORTANT: Clean up timer
});
```

## Category Refactoring Notes

After moving category from method parameter to constructor:
- OLD: `logger.error('category', 'message')`  
- NEW: `const logger = new Logger('category'); logger.error('message')`

Tests need updates:
1. Fix `new Logger()` → `new Logger('test')`
2. Remove category param from all log calls
3. Update assertions expecting `slot` to match constructor category
4. Fix tests that assumed multiple slots per logger (now one slot = category)
