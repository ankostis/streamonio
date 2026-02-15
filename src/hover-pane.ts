/**
 * Streamonio Hover Panel UI (page/iframe context)
 * In-page overlay for mobile UX. Mirrors popup.ts structure.
 * Uses browser.runtime.sendMessage - broker gets sender.tab.id automatically.
 */

import browser from './browser-api.js';
import buildInfo from './build-info.json';
import {
  displayStreams,
  initLogging,
  populateStreamPanel,
  type StreamActionHandlers,
} from './components-ui';
import {
  type ApiEndpoint,
  applyTemplate,
  formatResponseBody,
  loadUserVars,
  parseEndpoints,
  previewCall,
  sortEndpointsByMRU,
} from './endpoint';
import { applyLogFiltering } from './logger-ui';
import type { RuntimeMessage, StreamInfo } from './types';

let apiEndpoints: ApiEndpoint[] = [];

// Logging utilities (initialized in initialize() after DOM ready)
let logger: ReturnType<typeof initLogging>['logger'];

// Cached DOM elements (initialized in initialize())
let els: {
  loading: HTMLElement | null;
  status: HTMLElement | null;
  emptyState: HTMLElement | null;
  streamCount: HTMLElement | null;
  streamsList: HTMLElement | null;
  streamsListContainer: HTMLElement | null;
  streamPanel: HTMLElement | null;
};

/**
 * Initialize hover panel
 */
async function initialize() {
  // Initialize logging infrastructure FIRST to ensure logger available for all code paths
  const logging = initLogging('hover', {
    statusBar: document.getElementById('status-bar') as HTMLDivElement,
    statusMsg: document.getElementById('status-message') as HTMLSpanElement,
    logViewer: document.getElementById('log-viewer') as HTMLDivElement,
  });
  logger = logging.logger;

  // Display version
  const manifest = browser.runtime.getManifest();
  const versionEl = document.getElementById('hover-version');
  if (versionEl) {
    const devSuffix = buildInfo.isDev ? '-dev' : '';
    versionEl.textContent = `v${manifest.version}${devSuffix}`;
    if (buildInfo.isDev) {
      versionEl.style.color = '#ff9800'; // Orange for dev builds
    }
  }

  // Cache DOM elements
  els = {
    loading: document.getElementById('loading'),
    status: document.getElementById('status'),
    emptyState: document.getElementById('empty-state'),
    streamCount: document.getElementById('stream-count'),
    streamsList: document.getElementById('streams-list'),
    streamsListContainer: document.getElementById('streams-list-container'),
    streamPanel: document.getElementById('stream-panel'),
  };

  // Wire log filtering
  const levelCheckboxes = document.querySelectorAll(
    '.log-level-filter',
  ) as NodeListOf<HTMLInputElement>;
  applyLogFiltering(
    document.getElementById('log-viewer') as HTMLDivElement,
    levelCheckboxes,
  );

  // Load data
  await loadEndpoints();
  await loadStreams();

  // Wire action buttons
  document
    .getElementById('refresh-btn')
    ?.addEventListener('click', handleRefresh);
  document
    .getElementById('options-btn')
    ?.addEventListener('click', handleOptions);

  logger.debug('Hover panel initialized successfully');
}

/**
 * Load endpoints from storage via broker GET_ENDPOINTS message
 */
async function loadEndpoints() {
  try {
    const response = (await browser.runtime.sendMessage({
      type: 'GET_ENDPOINTS',
    } as RuntimeMessage)) as
      | { endpoints?: ReturnType<typeof parseEndpoints> }
      | undefined;
    if (response?.endpoints) {
      apiEndpoints = sortEndpointsByMRU(response.endpoints);
      logger.debug(`Loaded ${apiEndpoints.length} endpoints`);
    } else {
      logger.warn('No endpoints configured');
      apiEndpoints = [];
    }
  } catch (error) {
    logger.error('Failed to load endpoints', error);
    apiEndpoints = [];
  }
}

/**
 * Load and display streams for current tab.
 * Broker uses sender.tab.id automatically - no need to pass tabId explicitly.
 */
async function loadStreams() {
  // Verify broker is alive
  try {
    await browser.runtime.sendMessage({ type: 'PING' } as RuntimeMessage);
  } catch (pingError) {
    logger.error('Broker not responding', pingError);
    showEmptyState('⚠️ Extension not ready', 'Try refreshing the page');
    return;
  }

  try {
    // Use GET_STREAMS without tabId - broker will use sender.tab.id
    const response = (await browser.runtime.sendMessage({
      type: 'GET_STREAMS',
    } as RuntimeMessage)) as { streams?: StreamInfo[] } | undefined;

    if (!response?.streams) {
      showEmptyState();
      return;
    }

    const streams = response.streams as StreamInfo[];
    logger.debug(`Loaded ${streams.length} streams`);

    if (els.loading) els.loading.style.display = 'none';

    if (streams.length === 0) {
      // Show UI even without streams - user selects endpoints for page-URL calls
      if (els.status) {
        els.status.style.display = 'block';
        els.status.classList.remove('detected');
      }
      if (els.streamCount) els.streamCount.textContent = '0';
      if (els.loading) els.loading.style.display = 'none';
      if (els.streamPanel) els.streamPanel.style.display = 'block';
      const list = els.streamsList;
      if (list) list.innerHTML = '';
      // Create page-only stream object (use window location since no browser.tabs in iframe)
      const pageStream: StreamInfo = {
        streamUrl: window.location.href,
        streamType: 'PAGE',
        pageUrl: window.location.href,
        pageTitle: document.title,
        seekTimeSecs: 0,
      };
      populatePanel(pageStream, 0, [pageStream]);
      return;
    }

    if (els.status) {
      els.status.style.display = 'block';
      els.status.classList.add('detected');
    }

    if (els.streamCount)
      els.streamCount.textContent = streams.length.toString();

    displayStreamsHover(streams);
  } catch (error) {
    logger.error('Failed to load streams', error);
    showEmptyState('❌ Error loading streams', error.message);
  }
}

/**
 * Display detected streams using shared UI components
 */
function displayStreamsHover(streams: StreamInfo[]) {
  displayStreams(streams, (stream, index) => {
    populatePanel(stream, index, streams);
  });
}

/**
 * Populate the detail panel with selected stream (uses shared component)
 */
function populatePanel(
  stream: StreamInfo,
  _index: number,
  _allStreams: StreamInfo[],
) {
  const handlers: StreamActionHandlers = {
    onPreview: (stream, endpointName) => handlePreview(stream, endpointName),
    onCopy: (stream, endpointName) => handleCopyBtn(stream, endpointName),
    onCall: (mode, stream, endpointName) =>
      handleCallEndpoint(mode, stream, endpointName),
  };

  populateStreamPanel(stream, apiEndpoints, handlers);
}

/**
 * Show empty state with optional custom message
 */
function showEmptyState(
  title = '🔍 No streams detected',
  subtitle = 'Browse to a page with streaming media to detect streams',
) {
  if (els.loading) els.loading.style.display = 'none';
  if (els.streamsListContainer) els.streamsListContainer.style.display = 'none';
  if (els.streamPanel) els.streamPanel.style.display = 'none';

  if (els.emptyState) {
    els.emptyState.style.display = 'block';
    const titleEl = els.emptyState.querySelector('p:first-of-type');
    const subtitleEl = els.emptyState.querySelector('p:last-of-type');

    if (titleEl) titleEl.innerHTML = `<strong>${title}</strong>`;
    if (subtitleEl) subtitleEl.textContent = subtitle;
  }
}

/**
 * Handle preview - shows formatted API request details in logger
 */
async function handlePreview(stream: StreamInfo, endpointName?: string) {
  if (apiEndpoints.length === 0) {
    logger.warn('No endpoints configured');
    return;
  }

  // Stream already has all fields, just pass it
  await previewCall(stream, endpointName, apiEndpoints, logger);
}

/**
 * Handle endpoint action (call API or open in tab) via messaging
 * Broker handles CORS and tabs - hover-ui delegates everything.
 */
async function handleCallEndpoint(
  mode: 'fetch' | 'tab',
  stream: StreamInfo,
  endpointName?: string,
) {
  if (apiEndpoints.length === 0) {
    logger.warn('Please configure API endpoints in options first');
    return;
  }

  const action = mode === 'fetch' ? 'API call' : 'Open in tab';
  const endpoint = endpointName || 'default';
  logger.info(`${action} starting: ${endpoint} → ${stream.streamType}`);

  // Delegate to broker via message
  try {
    const response = (await browser.runtime.sendMessage({
      type: mode === 'fetch' ? 'CALL_API' : 'OPEN_IN_TAB',
      stream,
      endpointName,
    } as RuntimeMessage)) as
      | {
          success: boolean;
          status?: number;
          response?: unknown;
          error?: string;
        }
      | undefined;

    if (response?.success) {
      const successMsg =
        mode === 'fetch'
          ? `✅ ${endpoint}: ${response.status || 'OK'}`
          : `✅ Opened in tab`;
      logger.info(successMsg);

      // Update endpoint MRU and reload (broker handles storage update)
      await loadEndpoints();

      // Log response body separately in debug (keep it out of status bar)
      if (response.response) {
        const formatted = formatResponseBody(response.response);
        logger.info(`Response body: ${formatted}`);
      }
    } else {
      const errorMsg = response?.error ?? 'Unknown error';
      logger.error(`${action} failed: ${endpoint} - ${errorMsg}`, response);
    }
    // biome-ignore lint/suspicious/noExplicitAny: Standard error handling
  } catch (error: any) {
    logger.error(`Message failed: ${error.message}`, error);
  }
}

/**
 * Handle copy URL - copies final interpolated endpoint URL
 */
async function handleCopyBtn(stream: StreamInfo, endpointName?: string) {
  try {
    const endpoint = endpointName
      ? apiEndpoints.find((ep) => ep.name === endpointName)
      : apiEndpoints[0];

    if (!endpoint) {
      logger.warn('No endpoint available for copy');
      return;
    }

    const userVars = await loadUserVars();
    const finalUrl = applyTemplate(endpoint.endpointTemplate, stream, userVars);
    await navigator.clipboard.writeText(finalUrl);
    logger.infoFlash(2000, `📋 Copied: ${finalUrl}`);
  } catch (error) {
    logger.warn('Failed to copy URL', error);
  }
}

/**
 * Handle refresh button
 */
async function handleRefresh() {
  try {
    if (els.loading) els.loading.style.display = 'block';

    logger.debug('Refresh clicked');
    // Refetch endpoints from storage (may have changed in options)
    await loadEndpoints();
    await loadStreams();
  } catch (error) {
    logger.error('Failed to refresh streams', error);
    if (els.loading) els.loading.style.display = 'none';
  }
}

/**
 * Handle options button - delegate to broker (can't open tabs from iframe)
 */
async function handleOptions() {
  logger.debug('Options button clicked');
  try {
    await browser.runtime.sendMessage({
      type: 'OPEN_OPTIONS',
    } as RuntimeMessage);
  } catch (error) {
    logger.error('Failed to open options', error);
  }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initialize();
  } catch (error) {
    logger.error('Failed to initialize:', error);
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'none';
  }
});
// Listen for new stream detections from any frame
browser.runtime.onMessage.addListener((message: RuntimeMessage) => {
  if (message.type === 'STREAM_DETECTED') {
    logger.debug('New stream detected, refreshing panel');
    loadStreams().catch((err) => {
      logger.error('Failed to reload streams after detection', err);
    });
  }
});
