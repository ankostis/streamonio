/**
 * stream-call Popup Script that calls the API endpoint (extension-context)
 */

import {
  displayStreams,
  initLogging,
  populateStreamPanel,
  type StreamActionHandlers,
} from './components-ui';
import {
  type ApiEndpoint,
  callEndpoint,
  formatResponseBody,
  parseEndpoints,
  previewCall,
  sortEndpointsByMRU,
} from './endpoint';
import { applyLogFiltering } from './logger-ui';
import type { StreamInfo } from './types';

let currentTabId: number | null = null;
let apiEndpoints: ApiEndpoint[] = [];

// Cache endpoints in memory for the popup's lifetime to avoid repeated storage reads
let endpointsCached = false;

// Logging utilities (initialized in initialize() after DOM ready)
let logger: ReturnType<typeof initLogging>['logger'];

// Cached DOM elements (initialized in initialize())
let els: {
  loading: HTMLElement | null;
  status: HTMLElement | null;
  emptyState: HTMLElement | null;
  streamCount: HTMLElement | null;
  streamsContainer: HTMLElement | null;
};

/**
 * Open URL in tab, reusing existing tab if found
 */
async function openOrSwitchToTab(url: string): Promise<void> {
  const tabs = await browser.tabs.query({ url });
  if (tabs.length > 0 && tabs[0].id) {
    await browser.tabs.update(tabs[0].id, { active: true });
  } else {
    await browser.tabs.create({ url, active: true });
  }
}

/**
 * Initialize popup
 */
async function initialize() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) return;

  currentTabId = tabs[0].id ?? null;

  // Initialize logging infrastructure
  const logging = initLogging('popup', {
    statusBar: document.getElementById('status-bar') as HTMLDivElement,
    statusMsg: document.getElementById('status-message') as HTMLSpanElement,
    logViewer: document.getElementById('log-viewer') as HTMLDivElement,
  });
  logger = logging.logger;
  _appendLog = logging.appendLog;

  // Cache DOM elements
  els = {
    loading: document.getElementById('loading'),
    status: document.getElementById('status'),
    emptyState: document.getElementById('empty-state'),
    streamCount: document.getElementById('stream-count'),
    streamsContainer: document.getElementById('streams-container'),
  };

  // Wire log filtering (always visible)
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

  logger.debug('Popup initialized successfully');
}

async function loadEndpoints() {
  // Return cached endpoints if available (avoids repeated storage reads during popup lifetime)
  if (endpointsCached) return;

  // Use empty object as defaults - browser.storage.sync.get returns stored values or empty object
  // On first run (no stored config), storage is empty, so we get no defaults
  const stored = await browser.storage.sync.get('apiEndpoints');
  const apiEndpointsStr = stored.apiEndpoints || '[]';

  try {
    apiEndpoints = parseEndpoints(apiEndpointsStr);
    // Sort by MRU (most recently used first)
    apiEndpoints = sortEndpointsByMRU(apiEndpoints);
    logger.debug(`Loaded ${apiEndpoints.length} API endpoints`);
  } catch (error: any) {
    // Parse error is expected if config is corrupted - show to user via logger
    logger.error(
      'Invalid API endpoints configured. Check options.',
      error,
    );
    apiEndpoints = [];
  }
  endpointsCached = true;
  // Note: storage.get errors bubble up to caller (initialize)
}

/**
 * Load and display streams for current tab
 */
async function loadStreams() {
  if (currentTabId === null) return;

  // Verify background worker is alive before fetching streams
  try {
    await browser.runtime.sendMessage({ type: 'PING' });
  } catch (pingError) {
    // Known issue: background worker crashed or not loaded.
    logger.error(
      'messaging',
      'Extension background service not responding. Try reloading the extension.',
      pingError,
    );
    if (els.loading) els.loading.style.display = 'none';
    return;
  }

  let response;
  try {
    response = await browser.runtime.sendMessage({
      type: 'GET_STREAMS',
      tabId: currentTabId,
    });
  } catch (error) {
    // Message passing error - log and display
    logger.error('Failed to fetch streams from broker', error);
    if (els.loading) els.loading.style.display = 'none';
    return;
  }

  const streams = (response?.streams as StreamInfo[] | undefined) || [];
  logger.debug(`Loaded ${streams.length} streams for tab ${currentTabId}`);

  if (els.loading) els.loading.style.display = 'none';

  if (streams.length === 0) {
    // Show UI even without streams - user selects endpoints for page-URL calls
    if (els.emptyState) els.emptyState.style.display = 'none';
    if (els.status) {
      els.status.style.display = 'block';
      els.status.classList.remove('detected');
    }
    if (els.streamCount) els.streamCount.textContent = '0';
    const container = document.getElementById('streams-list');
    if (container) container.innerHTML = '';
    // Create page-only stream object with page metadata
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tabs.length > 0 && tabs[0]) {
      const pageStream: StreamInfo = {
        url: tabs[0].url || '',
        type: 'PAGE',
        pageUrl: tabs[0].url,
        pageTitle: tabs[0].title,
        timestamp: Date.now(),
      };
      populatePanel(pageStream, 0, [pageStream]);
    }
  } else {
    if (els.emptyState) els.emptyState.style.display = 'none';
    if (els.status) {
      els.status.style.display = 'block';
      els.status.classList.add('detected');
    }

    if (els.streamCount)
      els.streamCount.textContent = streams.length.toString();

    displayStreamsPopup(streams);
  }
  // Note: Other errors bubble to caller (initialize) with full context
}

/**
 * Display detected streams using shared UI components
 */
function displayStreamsPopup(streams: StreamInfo[]) {
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
    onCopy: (url) => handleCopyUrl(url),
    onCall: (mode, stream, endpointName) =>
      handleCallEndpoint(mode, stream, endpointName),
  };

  populateStreamPanel(stream, apiEndpoints, handlers);
}

/**
 * Handle preview - shows formatted API request details in logger
 */
function handlePreview(stream: StreamInfo, endpointName?: string) {
  if (apiEndpoints.length === 0) {
    logger.warn('No endpoints configured');
    return;
  }

  const endpoint =
    apiEndpoints.find((ep) => ep.name === endpointName) || apiEndpoints[0];
  const context = {
    streamUrl: stream.url,
    timestamp: Date.now(),
    pageUrl: stream.pageUrl,
    pageTitle: stream.pageTitle,
  } as Record<string, unknown>;

  previewCall(endpoint, context, logger);
}

/**
 * Handle endpoint action (call API or open in tab)
 */
async function handleCallEndpoint(
  mode: 'fetch' | 'tab',
  stream: StreamInfo,
  endpointName?: string,
) {
  const config = await browser.storage.sync.get(['apiEndpoints']);
  let endpoints: ReturnType<typeof parseEndpoints>;
  try {
    endpoints = parseEndpoints(config.apiEndpoints || '[]');
  } catch (parseError: any) {
    logger.error(
      'endpoint',
      'Invalid endpoint configuration. Check options.',
      parseError,
    );
    return;
  }

  if (endpoints.length === 0) {
    logger.warn('Please configure API endpoints in options first');
    setTimeout(async () => {
      const optionsUrl = browser.runtime.getURL('dist/options-pane.html');
      await openOrSwitchToTab(optionsUrl);
    }, 2000);
    return;
  }

  const action = mode === 'fetch' ? 'API call' : 'Open in tab';
  const endpoint = endpointName || 'default';
  logger.info(`${action} starting: ${endpoint} → ${stream.type}`);

  // Direct call (popup runs in extension context)
  const response = await callEndpoint({
    mode,
    streamUrl: stream.url,
    pageUrl: stream.pageUrl,
    pageTitle: stream.pageTitle,
    endpointName,
    logger,
  });

  if (response?.success) {
    const successMsg =
      mode === 'fetch'
        ? `✅ ${endpoint}: ${response.status || 'OK'}`
        : `✅ Opened in tab: ${response.details || stream.url}`;
    logger.info(successMsg);

    // Update lastUsedAt for the called endpoint and save to storage
    const calledEndpoint =
      endpoints.find((ep) => ep.name === endpointName) || endpoints[0];
    if (calledEndpoint) {
      calledEndpoint.lastUsedAt = Date.now();
      // Re-sort and save to storage
      const sorted = sortEndpointsByMRU(endpoints);
      await browser.storage.sync.set({
        apiEndpoints: JSON.stringify(sorted, null, 2),
      });
      // Update in-memory cache
      apiEndpoints = sorted;
    }

    // Log response body separately in debug (keep it out of status bar)
    if (response.response) {
      const formatted = formatResponseBody(response.response);
      logger.info(`Response body: ${formatted}`);
    }
  } else {
    const errorMsg = response?.error ?? 'Unknown error';
    logger.error(`${action} failed: ${endpoint} - ${errorMsg}`, response);
  }
}

/**
 * Handle copy URL
 */
async function handleCopyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    logger.infoFlash(2000, `📋 Copied URL: ${url}`);
  } catch (error) {
    // Clipboard write may fail due to permissions.
    logger.warn('Failed to copy URL', error);
  }
}

/**
 * Handle refresh
 */
async function handleRefresh() {
  try {
    if (els.loading) els.loading.style.display = 'block';
    if (els.streamsContainer) els.streamsContainer.innerHTML = '';

    logger.debug('Refresh button clicked');
    await loadStreams();
  } catch (error) {
    // Unexpected error in refresh - log and display
    logger.error('Failed to refresh streams', error);
    if (els.loading) els.loading.style.display = 'none';
  }
}

/**
 * Handle options button
 */
async function handleOptions() {
  logger.debug('Options button clicked');
  const optionsUrl = browser.runtime.getURL('dist/options-pane.html');
  await openOrSwitchToTab(optionsUrl);
}

/**
 * Show notification
 */
// Inline notification UI removed; delegate to Logger for feedback

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initialize();
  } catch (error) {
    // Top-level exception handler - log and display to user
    logger.error('Failed to initialize popup', error);
    if (els.loading) els.loading.style.display = 'none';
  }
});
