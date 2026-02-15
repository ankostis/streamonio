/**
 * UI Constants - Centralized icons and design tokens
 */

// Icons
export const ICONS = {
  // Brand/App
  APP: '🎵',

  // Actions
  SAVE: '💾',
  ADD: '➕',
  DELETE: '\u2716', // ✖
  CLONE: '➕',
  CLEAR: '🗑',
  EXPORT: '⬇',
  REFRESH: '🔄',
  COPY: '📋',
  CANCEL: '✗',

  // Status indicators
  INFO: 'ℹ',
  WARNING: '⚠️',
  ERROR: '❌',
  SUCCESS: '✓',
  COOKIE: '🍪',
  CLIPBOARD: '📋',
  DOCUMENT: '📄',

  // Navigation/State
  CLOSE: '✖',
  TOGGLE: '🎵',
} as const;

// Gradients (for inline styles that can't use CSS variables easily)
export const GRADIENTS = {
  PRIMARY: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
} as const;

// Common colors (for TypeScript dynamic styling)
export const COLORS = {
  PRIMARY: '#667eea',
  PRIMARY_HOVER: '#5568d3',
  PRIMARY_ACTIVE: '#4557c2',

  DANGER_BG: '#fda4af',
  DANGER_TEXT: '#b91c1c',
  DANGER_BORDER: '#f87171',

  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',

  DEV_MODE: '#ff9800',
} as const;
