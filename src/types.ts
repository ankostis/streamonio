/**
 * Shared type definitions for Streamonio
 * Single source of truth for domain types used across multiple modules
 */

/**
 * Unified stream context for detection, storage, and API calls
 * All fields required - callers provide empty strings/defaults for missing data
 * Used by: broker (storage), UI (display), endpoint (templates)
 */
export type StreamInfo = {
  streamUrl: string; // Detected stream URL
  streamType: string; // Classification (HLS, DASH, MP4, etc)
  pageUrl: string; // Page URL (empty string if unavailable)
  pageTitle: string; // Page title (empty string if unavailable)
  seekTimeSecs: number; // Seek position in stream (seconds), 0 if unknown
};

/**
 * Runtime message types for cross-component communication
 * Used by: broker.ts (handlers), hover-ui.ts (sender), page.ts (sender), tests
 */
export type RuntimeMessage =
  | { type: 'STREAM_DETECTED'; url: string; streamType: string }
  | { type: 'GET_STREAMS'; tabId?: number } // tabId optional - uses sender.tab.id if omitted
  | {
      type: 'CALL_API';
      stream: Omit<StreamInfo, 'currentTime'>; // currentTime added by broker
      endpointName?: string;
    }
  | {
      type: 'OPEN_IN_TAB';
      stream: Omit<StreamInfo, 'currentTime'>; // currentTime added by broker
      endpointName?: string;
    }
  | { type: 'GET_ENDPOINTS' }
  | { type: 'OPEN_OPTIONS' }
  | { type: 'CLOSE_HOVER_PANEL' } // postMessage from hover-ui to page.ts
  | { type: 'PING' };
