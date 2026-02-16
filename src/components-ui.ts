/**
 * Shared UI component builders for popup and options panels
 */

import type { ApiEndpoint } from './endpoint';
import { Logger } from './logger';
import { createLogAppender, createStatusRenderer } from './logger-ui';
import type { StreamInfo } from './types';
import { ICONS } from './ui-constants';

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
 * Split-button group configuration
 */
export type SplitButtonConfig = {
  variant: 'test-group' | 'action-group' | 'primary-group';
  buttons: Array<{
    icon: string;
    label: string;
    className: 'btn-primary' | 'btn-secondary' | 'btn-action' | 'btn-test';
    onClick: () => void;
  }>;
};

/**
 * Create a split-button group container with multiple buttons
 */
export function createSplitButtonGroup(
  config: SplitButtonConfig,
): HTMLDivElement {
  const group = document.createElement('div');
  group.className = `split-btn-group ${config.variant}`;

  config.buttons.forEach((btnConfig) => {
    const btn = document.createElement('button');
    btn.className = btnConfig.className;
    btn.innerHTML = `${btnConfig.icon}<br>${btnConfig.label}`;
    btn.addEventListener('click', btnConfig.onClick);
    group.appendChild(btn);
  });

  return group;
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
  const isBlob = stream.streamUrl.startsWith('blob:');
  if (isBlob) {
    item.classList.add('blob-url');
    item.style.cursor = 'default';
    item.title = 'Blob URLs cannot be sent to APIs (memory-only references)';
  }

  const type = document.createElement('span');
  type.className = 'stream-type';
  type.textContent = stream.streamType;

  const url = document.createElement('div');
  url.className = 'stream-url';
  url.textContent = stream.streamUrl;
  url.title = isBlob ? 'Blob URL - cannot be sent to APIs' : stream.streamUrl;

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
  console.log(
    '[components-ui] displayStreams called with',
    streams.length,
    'streams',
  );
  const listContainer = document.getElementById('streams-scrollp');
  const list = document.getElementById('streams');

  console.log('[components-ui] Found elements:', {
    listContainer: !!listContainer,
    list: !!list,
  });

  if (!list || !listContainer) {
    console.error('[components-ui] Missing elements, aborting displayStreams');
    return;
  }

  list.innerHTML = '';
  console.log(
    '[components-ui] Cleared list, appending',
    streams.length,
    'items',
  );

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

  console.log(
    '[components-ui] Appended all items, list.children.length =',
    list.children.length,
  );
  console.log('[components-ui] Setting listContainer display to block');

  // Always show scrollpane (placeholder visible when empty)
  listContainer.style.display = 'block';

  // Auto-select first stream
  if (streams.length > 0) {
    console.log('[components-ui] Auto-selecting first stream');
    onSelectStream(streams[0], 0);
  }
}

/**
 * Action handlers for stream operations
 */
export type StreamActionHandlers = {
  onPreview: (stream: StreamInfo, endpointName?: string) => void;
  onCopy: (stream: StreamInfo, endpointName?: string) => void;
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
  console.log(
    '[components-ui] populateStreamPanel called with',
    activeEndpoints.length,
    'endpoints',
  );
  const endpListScrollpane = document.getElementById('endps-scrollp');
  const endpList = document.getElementById('endps');
  const actionButtons = document.getElementById('btns');

  console.log('[components-ui] Found elements:', {
    endpListScrollpane: !!endpListScrollpane,
    endpList: !!endpList,
    actionButtons: !!actionButtons,
  });

  if (!endpListScrollpane || !endpList || !actionButtons) {
    console.error(
      '[components-ui] Missing elements, aborting populateStreamPanel',
    );
    return;
  }

  // Preserve previously selected endpoint BEFORE clearing
  const previouslySelected = document.querySelector(
    '.endpoint-list-item.selected',
  );
  const previousEndpointName = previouslySelected?.querySelector(
    '.endpoint-list-name',
  )?.textContent;

  // Rebuild endpoint list and buttons
  endpList.innerHTML = '';
  actionButtons.innerHTML = '';
  console.log('[components-ui] Cleared endpList and actionButtons');

  // Use preserved selection if it still exists, otherwise default to first
  const selectedEndpoint =
    activeEndpoints.find((ep) => ep.name === previousEndpointName) ||
    activeEndpoints[0];
  let endpointName: string | undefined = selectedEndpoint?.name;

  // Append endpoint items directly (no wrapper) - will be 2-column grid via CSS
  if (activeEndpoints.length > 0) {
    activeEndpoints.forEach((endpoint, index) => {
      const item = document.createElement('div');
      item.className = 'endpoint-list-item';
      if (endpoint.name === endpointName) item.classList.add('selected');

      // Endpoint name
      const nameSpan = document.createElement('span');
      nameSpan.className = 'endpoint-list-name';
      nameSpan.textContent = endpoint.name;

      // Info tooltip icon (larger clickable area)
      const infoIcon = document.createElement('span');
      infoIcon.className = 'endpoint-info-icon';
      infoIcon.innerHTML = `<span class="info-circle">${ICONS.INFO}</span>`;
      infoIcon.title = `${endpoint.description || endpoint.name}\n${endpoint.method || 'POST'} → ${endpoint.endpointTemplate}`;

      item.appendChild(nameSpan);
      item.appendChild(infoIcon);

      // Click to select endpoint
      item.addEventListener('click', () => {
        document
          .querySelectorAll('.endpoint-list-item')
          .forEach((el) => el.classList.remove('selected'));
        item.classList.add('selected');
        endpointName = endpoint.name;
      });

      endpList.appendChild(item); // Direct child
    });
    console.log(
      '[components-ui] Appended',
      activeEndpoints.length,
      'endpoints, endpList.children.length =',
      endpList.children.length,
    );
  } else {
    console.log('[components-ui] No endpoints to display');
  }

  // Append button groups to separate container
  const testGroup = createSplitButtonGroup({
    variant: 'test-group',
    buttons: [
      {
        icon: '👁',
        label: 'Preview',
        className: 'btn-test',
        onClick: () => handlers.onPreview(stream, endpointName),
      },
      {
        icon: '📋',
        label: 'Copy',
        className: 'btn-test',
        onClick: () => handlers.onCopy(stream, endpointName),
      },
    ],
  });

  const actionGroup = createSplitButtonGroup({
    variant: 'action-group',
    buttons: [
      {
        icon: '⚡',
        label: 'Call',
        className: 'btn-action',
        onClick: () => handlers.onCall('fetch', stream, endpointName),
      },
      {
        icon: '🌐',
        label: 'Open',
        className: 'btn-action',
        onClick: () => handlers.onCall('tab', stream, endpointName),
      },
    ],
  });

  // Append to button container
  actionButtons.appendChild(testGroup);
  actionButtons.appendChild(actionGroup);

  console.log(
    '[components-ui] Appended buttons, actionButtons.children.length =',
    actionButtons.children.length,
  );
  console.log('[components-ui] Setting display styles');

  // Always show scrollpane (placeholder visible when empty)
  endpListScrollpane.style.display = 'block';
  endpList.style.display = 'grid';
  actionButtons.style.display = 'grid';

  console.log('[components-ui] populateStreamPanel complete');
}
