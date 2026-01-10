/**
 * Browser API shim - provides cross-browser compatibility
 * In extension context: uses webextension-polyfill for Chrome/Firefox compatibility
 * In test context: provides mock implementation
 */

// Check if running in Node.js (test environment)
const isNode = typeof process !== 'undefined' && process.versions?.node;

let browser: any;

if (isNode) {
  // Mock browser API for tests
  browser = {
    storage: {
      sync: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve(),
      },
      session: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve(),
      },
    },
    tabs: {
      get: () => Promise.resolve({ id: 1, url: 'https://example.com' }),
      create: () => Promise.resolve({ id: 1 }),
      update: () => Promise.resolve(),
      query: () => Promise.resolve([]),
    },
    cookies: {
      getAll: () => Promise.resolve([]),
    },
    runtime: {
      getURL: (path: string) => `moz-extension://test/${path}`,
      getManifest: () => ({ version: '0.0.0-test' }),
      sendMessage: () => Promise.resolve(),
      onMessage: {
        addListener: () => {},
      },
      onInstalled: {
        addListener: () => {},
      },
    },
    webRequest: {
      onSendHeaders: {
        addListener: () => {},
      },
    },
    action: {
      setBadgeText: () => {},
      setBadgeBackgroundColor: () => {},
    },
  };
} else {
  // Real browser extension context (Firefox/Chrome)
  // This module is bundled by esbuild and polyfill is inlined
  // We MUST use require() for esbuild to bundle it properly
  // The trick: import is hoisted, but bundler will inline it into the else branch
  const polyfill = require('webextension-polyfill');
  browser = polyfill.default || polyfill;
}

export default browser;
