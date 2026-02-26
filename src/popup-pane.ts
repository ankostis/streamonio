/**
 * Streamonio Popup Script that calls the API endpoint (extension-context)
 */

import browser from './browser-api.js';
import {
  displayStreams,
  displayVersion,
  initLogging,
  populateStreamPanel,
  type StreamActionHandlers,
} from './components-ui';
import {
  type ApiEndpoint,
  applyTemplate,
  callEndpoint,
  formatResponseBody,
  loadUserVars,
  parseEndpoints,
  previewCall,
  sortEndpointsByMRU,
} from './endpoint';
import { createLogViewer } from './logger-ui';
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
  endpointCount: HTMLElement | null;
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
  // Initialize logging infrastructure FIRST to ensure logger available for all code paths
  // Note: logViewer element created by createLogViewer() later, so we pass a temporary div
  const tempLogViewer = document.createElement('div');
  const logging = initLogging('popup', {
    statusBar: document.getElementById('status-bar') as HTMLDivElement,
    statusMsg: document.getElementById('status-message') as HTMLSpanElement,
    logViewer: tempLogViewer,
  });
  logger = logging.logger;

  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) return;

  currentTabId = tabs[0].id ?? null;

  // Display version
  const versionEl = document.getElementById('popup-version');
  if (versionEl) displayVersion(versionEl);

  // Cache DOM elements
  els = {
    loading: document.getElementById('loading'),
    status: document.getElementById('status'),
    emptyState: document.getElementById('empty-state'),
    streamCount: document.getElementById('stream-count'),
    endpointCount: document.getElementById('endpoint-count'),
    streamsContainer: document.getElementById('streams-scrollp'),
  };

  // Wire log viewer
  const logViewer = document.getElementById('log-viewer');
  if (logViewer) createLogViewer(logViewer, logger);

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
  const stored = (await browser.storage.sync.get('apiEndpoints')) as {
    apiEndpoints?: string;
  };
  const apiEndpointsStr = stored.apiEndpoints || '[]';

  try {
    apiEndpoints = parseEndpoints(apiEndpointsStr);
    // Sort by MRU (most recently used first)
    apiEndpoints = sortEndpointsByMRU(apiEndpoints);
    logger.infoFlash(3000, `Loaded ${apiEndpoints.length} API endpoints`);
  } catch (error) {
    // Parse error is expected if config is corrupted - show to user via logger
    logger.error('Invalid API endpoints configured. Check options.', error);
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

  let response: { streams?: StreamInfo[] } | void;
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

  const streams =
    (response && 'streams' in response
      ? (response.streams as StreamInfo[])
      : []) || [];
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
    if (els.endpointCount)
      els.endpointCount.textContent = apiEndpoints.length.toString();
    const listContainer = document.getElementById('streams-scrollp');
    const container = document.getElementById('streams');
    if (container) container.innerHTML = '';
    if (listContainer) listContainer.style.display = 'block'; // Show scrollpane to display placeholder
    // Create page-only stream object with page metadata
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tabs.length > 0 && tabs[0]) {
      const pageStream: StreamInfo = {
        streamUrl: tabs[0].url || '',
        streamType: 'PAGE',
        pageUrl: tabs[0].url || '',
        pageTitle: tabs[0].title || '',
        seekTimeSecs: 0,
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
    if (els.endpointCount)
      els.endpointCount.textContent = apiEndpoints.length.toString();

    displayStreams(
      streams,
      (stream, index) => populatePanel(stream, index, streams),
      logger,
    );
  }
  // Note: Other errors bubble to caller (initialize) with full context
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

  populateStreamPanel(stream, apiEndpoints, handlers, logger);
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
 * Handle endpoint action (call API or open in tab)
 */
async function handleCallEndpoint(
  mode: 'fetch' | 'tab',
  stream: StreamInfo,
  endpointName?: string,
) {
  const config = (await browser.storage.sync.get(['apiEndpoints'])) as {
    apiEndpoints?: string;
  };
  let endpoints: ReturnType<typeof parseEndpoints>;
  try {
    endpoints = parseEndpoints(config.apiEndpoints || '[]');
    // biome-ignore lint/suspicious/noExplicitAny: Standard error handling
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
  logger.info(`${action} starting: ${endpoint} → ${stream.streamType}`);

  // Direct call (popup runs in extension context)
  const response = await callEndpoint({
    mode,
    stream,
    endpointName,
    logger,
  });

  if (response?.success) {
    const successMsg =
      mode === 'fetch'
        ? `✅ ${endpoint}: ${response.status || 'OK'}`
        : `✅ Opened in tab: ${response.details || stream.streamUrl}`;
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
 * Handle refresh
 */
async function handleRefresh() {
  try {
    if (els.loading) els.loading.style.display = 'block';
    const streamsContainer = document.getElementById('streams');
    if (streamsContainer) streamsContainer.innerHTML = '';

    logger.debug('Refresh button clicked');
    // Clear cache to refetch endpoints from storage (may have changed in options)
    endpointsCached = false;
    await loadEndpoints();
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
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'none';
  }
});
