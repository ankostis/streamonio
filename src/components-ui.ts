/**
 * Shared UI component builders for popup and options panels
 */

import type { ApiEndpoint } from './endpoint';
import { Logger } from './logger';
import { createLogAppender, createStatusRenderer } from './logger-ui';
import type { StreamInfo } from './types';

/**
 * Button configuration
 */
export type ButtonConfig = {
  className: 'btn-primary' | 'btn-secondary' | 'btn-action' | 'btn-test';
  text: string;
  onClick: () => void;
};

/**
 * Create a styled button element
 */
export function createButton(config: ButtonConfig): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = config.className;
  btn.textContent = config.text;
  btn.addEventListener('click', config.onClick);
  return btn;
}

/**
 * Initialize logging infrastructure with UI wiring
 *
 * @param elements - DOM elements for status bar and log viewer
 * @returns Configured logger, statusBar, and appendLog function
 */
export function initLogging(
  category: string,
  elements: {
    statusBar: HTMLElement;
    statusMsg: HTMLElement;
    logViewer: HTMLElement;
  },
): {
  logger: Logger;
  appendLog: ReturnType<typeof createLogAppender>;
} {
  const logger = new Logger(category);

  const renderStatus = createStatusRenderer({
    bar: elements.statusBar,
    message: elements.statusMsg,
  });

  // Subscribe to status changes
  logger.subscribeStatus((current) => {
    if (current) {
      renderStatus({
        level: current.level,
        message: current.message,
      });
    } else {
      renderStatus(null);
    }
  });

  const appendLog = createLogAppender(elements.logViewer);
  logger.subscribeLogs((entries) => {
    entries.slice(-1).forEach((e) => appendLog(e.level, e.category, e.message));
  });

  return { logger, appendLog };
}

/**
 * Create compact stream list item (master)
 * Extracted from popup.ts for reuse in hover-ui
 */
export function createStreamListItem(
  stream: StreamInfo,
  index: number,
  isSelected: boolean,
  onSelect: () => void,
): HTMLElement {
  const item = document.createElement('div');
  item.className = 'stream-list-item';
  if (isSelected) item.classList.add('selected');
  item.setAttribute('data-index', index.toString());

  // Mark blob URLs as non-functional
  const isBlob = stream.url.startsWith('blob:');
  if (isBlob) {
    item.style.background = '#e0e0e0';
    item.style.cursor = 'default';
    item.title = 'Blob URLs cannot be sent to APIs (memory-only references)';
  }

  const type = document.createElement('span');
  type.className = 'stream-type';
  type.textContent = stream.type;

  const url = document.createElement('div');
  url.className = 'stream-url';
  url.textContent = stream.url;
  url.title = isBlob ? 'Blob URL - cannot be sent to APIs' : stream.url;

  item.appendChild(type);
  item.appendChild(url);

  // Only add click handler for non-blob URLs
  if (!isBlob) {
    item.addEventListener('click', onSelect);
  }

  return item;
}

/**
 * Display streams in list UI with master-detail pattern
 * Extracted from popup.ts for reuse in hover-ui
 */
export function displayStreams(
  streams: StreamInfo[],
  onSelectStream: (stream: StreamInfo, index: number) => void,
): void {
  const listContainer = document.getElementById('streams-list-container');
  const list = document.getElementById('streams-list');
  const panel = document.getElementById('stream-panel');

  if (!list || !listContainer || !panel) return;

  list.innerHTML = '';

  streams.forEach((stream, index) => {
    const item = createStreamListItem(stream, index, index === 0, () => {
      // Update selected state
      document
        .querySelectorAll('.stream-list-item')
        .forEach((el) => el.classList.remove('selected'));
      item.classList.add('selected');
      onSelectStream(stream, index);
    });
    list.appendChild(item);
  });

  listContainer.style.display = 'block';

  // Auto-select first stream
  if (streams.length > 0) {
    onSelectStream(streams[0], 0);
  }
}

/**
 * Action handlers for stream operations
 */
export type StreamActionHandlers = {
  onPreview: (stream: StreamInfo, endpointName?: string) => void;
  onCopy: (url: string) => void;
  onCall: (
    mode: 'fetch' | 'tab',
    stream: StreamInfo,
    endpointName?: string,
  ) => void;
};

/**
 * Populate stream detail panel with action buttons
 * Extracted from popup.ts for reuse in hover-ui
 */
export function populateStreamPanel(
  stream: StreamInfo,
  activeEndpoints: ApiEndpoint[],
  handlers: StreamActionHandlers,
): void {
  const panel = document.getElementById('stream-panel');
  const panelActions = document.getElementById('panel-actions');

  if (!panel || !panelActions) return;

  // Rebuild actions
  panelActions.innerHTML = '';

  let endpointName: string | undefined = activeEndpoints[0]?.name;

  if (activeEndpoints.length > 0) {
    const select = document.createElement('select');
    select.className = 'endpoint-select';

    // Update select tooltip on change (option titles don't work in most browsers)
    const updateTooltip = () => {
      const selectedEndpoint = activeEndpoints.find(
        (ep) => ep.name === select.value,
      );
      select.title = selectedEndpoint?.description || '';
    };

    activeEndpoints.forEach((endpoint, index) => {
      const option = document.createElement('option');
      option.value = endpoint.name;
      option.textContent = endpoint.name;
      option.selected = index === 0; // Select first (MRU) endpoint
      select.appendChild(option);
    });

    updateTooltip(); // Set initial tooltip

    select.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      endpointName = target.value;
      updateTooltip();
    });
    panelActions.appendChild(select);
  }

  const previewBtn = createButton({
    className: 'btn-test',
    text: '👁 Preview',
    onClick: () => handlers.onPreview(stream, endpointName),
  });

  const copyBtn = createButton({
    className: 'btn-secondary',
    text: '📋 Copy',
    onClick: () => handlers.onCopy(stream.url),
  });

  const callBtn = createButton({
    className: 'btn-action',
    text: '📤 Call',
    onClick: () => handlers.onCall('fetch', stream, endpointName),
  });

  const openTabBtn = createButton({
    className: 'btn-action',
    text: '🌐 Open tab',
    onClick: () => handlers.onCall('tab', stream, endpointName),
  });

  // Append buttons directly - CSS flexbox with wrap handles 2-row layout
  panelActions.appendChild(previewBtn);
  panelActions.appendChild(copyBtn);
  panelActions.appendChild(callBtn);
  panelActions.appendChild(openTabBtn);

  panel.style.display = 'block';
}
