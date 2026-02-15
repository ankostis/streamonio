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
    item.style.background = '#e0e0e0';
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

  // Create split-button groups
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

  // Append split-button groups
  panelActions.appendChild(testGroup);
  panelActions.appendChild(actionGroup);

  panel.style.display = 'block';
}
