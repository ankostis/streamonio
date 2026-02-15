/**
 * Browser API shim - provides cross-browser compatibility
 * In extension context: uses webextension-polyfill for Chrome/Firefox compatibility
 * In test context: provides mock implementation
 */
import type { Browser } from 'webextension-polyfill';

// Check if running in Node.js (test environment)
const isNode = typeof process !== 'undefined' && process.versions?.node;

const mockBrowser = {
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

// Use `any` type for browser to allow both real Browser API and mockBrowser
// This avoids type mismatch between partial mock and full Browser interface
let browser: Browser;

if (isNode) {
  // Mock browser API for tests
  browser = mockBrowser as unknown as Browser;
} else {
  // Real browser extension context
  // Firefox has native browser API, Chrome needs polyfill
  if (typeof globalThis.browser !== 'undefined' && globalThis.browser.runtime) {
    // Firefox: use native browser API (no polyfill overhead)
    browser = globalThis.browser as unknown as Browser;
  } else {
    // Chrome: load polyfill to convert chrome.* to browser.*
    // We MUST use require() for esbuild to bundle it properly
    const polyfill = require('webextension-polyfill');
    browser = polyfill.default || polyfill;
  }
}

export default browser;
