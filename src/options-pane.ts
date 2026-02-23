/**
 * Streamonio options Script to define & CRUD endpoints (extension-context)
 */

import browser from './browser-api.js';
import buildInfo from './build-info.json';
import { initLogging } from './components-ui';
import {
  type ApiEndpoint,
  applyTemplate,
  callEndpoint,
  DEFAULT_CONFIG,
  detectUserVarConflicts,
  formatResponseBody,
  generateUniqueName,
  getBuiltInEndpoints,
  getDefaultUserVars,
  loadUserVars,
  previewCall,
  saveUserVars,
  sortEndpointsByMRU,
  suggestEndpointName,
  validateEndpoints,
  validateUserVarKey,
} from './endpoint';
import { createLogViewer } from './logger-ui';
import type { StreamInfo } from './types';
import { ICONS } from './ui-constants';

declare global {
  interface Window {
    updateBodyState?: () => void;
  }
}

type Config = typeof DEFAULT_CONFIG;

let endpoints: ApiEndpoint[] = [];
let editingIndex: number | null = null;
let pendingImportEndpoints: ApiEndpoint[] = [];

const els = {
  alert: () => document.getElementById('alert'),
  statusBar: () => document.getElementById('status-bar') as HTMLDivElement,
  statusIcon: () => document.getElementById('status-icon') as HTMLSpanElement,
  statusMsg: () => document.getElementById('status-message') as HTMLSpanElement,
  endpointsList: () =>
    document.getElementById('endpoints-list') as HTMLDivElement,
  endpointsEmpty: () =>
    document.getElementById('endpoints-empty') as HTMLDivElement,
  editorCard: () => document.getElementById('editor-card') as HTMLDivElement,
  editorTitle: () =>
    document.getElementById('editor-title') as HTMLHeadingElement,
  saveBtn: () =>
    document.getElementById('save-endpoint-btn') as HTMLButtonElement,
  saveNewBtn: () =>
    document.getElementById('save-new-btn') as HTMLButtonElement,
  name: () => document.getElementById('endpoint-name') as HTMLInputElement,
  description: () =>
    document.getElementById('endpoint-description') as HTMLInputElement,
  method: () => document.getElementById('endpoint-method') as HTMLSelectElement,
  contentType: () =>
    document.getElementById('endpoint-content-type') as HTMLInputElement,
  username: () =>
    document.getElementById('endpoint-username') as HTMLInputElement,
  password: () =>
    document.getElementById('endpoint-password') as HTMLInputElement,
  bearerToken: () =>
    document.getElementById('endpoint-bearer-token') as HTMLInputElement,
  endpoint: () =>
    document.getElementById('endpoint-endpoint') as HTMLInputElement,
  body: () => document.getElementById('endpoint-body') as HTMLTextAreaElement,
  includeCookies: () =>
    document.getElementById('endpoint-include-cookies') as HTMLInputElement,
  includeHeaders: () =>
    document.getElementById('endpoint-include-headers') as HTMLInputElement,
  headersRows: () => document.getElementById('headers-rows') as HTMLDivElement,
  logViewer: () => document.getElementById('log-viewer') as HTMLDivElement,
  enableHoverPanel: () =>
    document.getElementById('enable-hover-panel') as HTMLInputElement,
  detectionDebounce: () =>
    document.getElementById('detection-debounce') as HTMLInputElement,
  detectionInterval: () =>
    document.getElementById('detection-interval') as HTMLInputElement,
  aboutVersion: () => document.getElementById('about-version') as HTMLElement,
  importModal: () => document.getElementById('import-modal') as HTMLDivElement,
  importPreview: () =>
    document.getElementById('import-preview') as HTMLDivElement,
  importUrlModal: () =>
    document.getElementById('import-url-modal') as HTMLDivElement,
  importUrlInput: () =>
    document.getElementById('import-url-input') as HTMLInputElement,
};

// Initialize logging infrastructure
const logging = initLogging('options', {
  statusBar: els.statusBar(),
  statusMsg: els.statusMsg(),
  logViewer: els.logViewer(),
});
const logger = logging.logger;

function addHeaderRow(key = '', value = '') {
  const row = document.createElement('div');
  row.className = 'header-row';

  const keyInput = document.createElement('input');
  keyInput.type = 'text';
  keyInput.placeholder = 'Header name';
  keyInput.value = key;

  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.placeholder = 'Header value';
  valueInput.value = value;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-secondary btn-danger';
  removeBtn.textContent = ICONS.DELETE;
  removeBtn.addEventListener('click', () => row.remove());

  row.appendChild(keyInput);
  row.appendChild(valueInput);
  row.appendChild(removeBtn);
  els.headersRows().appendChild(row);
}

function setHeadersRows(headers?: Record<string, string>) {
  els.headersRows().innerHTML = '';
  const entries = headers ? Object.entries(headers) : [];
  entries.forEach(([key, value]) => addHeaderRow(key, value));
}

function loadSettings() {
  browser.storage.sync
    .get(DEFAULT_CONFIG)
    .then((config) => {
      const validated = validateEndpoints(
        (config as Config).apiEndpoints || '[]',
      );
      endpoints = validated.valid ? validated.parsed : [];
      // Sort by MRU (most recently used first)
      endpoints = sortEndpointsByMRU(endpoints);
      els.enableHoverPanel().checked =
        (config as Config).enableHoverPanel ?? false;
      els.detectionDebounce().value = String(
        (config as Config).detectionDebounceMs ??
          DEFAULT_CONFIG.detectionDebounceMs,
      );
      els.detectionInterval().value = String(
        (config as Config).detectionIntervalMs ??
          DEFAULT_CONFIG.detectionIntervalMs,
      );
      renderList();
      if (endpoints.length === 0) {
        logger.info(
          'No API endpoints configured yet. Add your first endpoint below.',
        );
      }
    })
    .catch((error) => {
      // Actual storage errors (not empty storage on first run)
      logger.error('Failed to access browser storage', error);
    });
}

function renderList() {
  const list = els.endpointsList();
  const emptyState = els.endpointsEmpty();
  list.innerHTML = '';

  if (endpoints.length === 0) {
    emptyState.classList.remove('hidden');
    list.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  list.classList.remove('hidden');

  endpoints.forEach((endpoint, index) => {
    const item = document.createElement('div');
    item.className = 'endpoint-item';
    if (editingIndex === index) item.classList.add('selected');
    item.style.cursor = 'pointer';
    item.title = 'Click to edit';

    // Make entire item clickable
    item.addEventListener('click', (e) => {
      // Don't trigger if clicking on interactive elements
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.tagName === 'INPUT') {
        return;
      }
      openEditor(index);
    });

    // Content wrapper for header + summary
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'endpoint-content';

    // Header row: name only (no active checkbox)
    const header = document.createElement('div');
    header.className = 'endpoint-header';

    const name = document.createElement('span');
    name.className = 'endpoint-name';
    name.textContent = endpoint.name;

    header.appendChild(name);

    // Add description as tooltip to entire item
    if (endpoint.description) {
      item.title = endpoint.description;
    }

    contentWrapper.appendChild(header);

    // Summary row: method + url + headers count + flags
    const summary = document.createElement('div');
    summary.className = 'endpoint-summary';
    const method = (endpoint.method || 'POST').toUpperCase();
    const headersCount = endpoint.headers
      ? Object.keys(endpoint.headers).length
      : 0;
    const flags = [];
    if (endpoint.includeCookies) flags.push(ICONS.COOKIE);
    if (endpoint.includePageHeaders) flags.push(ICONS.CLIPBOARD);
    if (endpoint.bodyTemplate) flags.push(ICONS.DOCUMENT);
    const flagsStr = flags.length ? ` ${flags.join(' ')}` : '';
    summary.textContent = `${method} → ${endpoint.endpointTemplate}${headersCount > 0 ? ` [${headersCount} headers]` : ''}${flagsStr}`;
    summary.title = `${method} ${endpoint.endpointTemplate}`;

    contentWrapper.appendChild(header);
    contentWrapper.appendChild(summary);

    // Actions span with delete button (spans full height)
    const actionsSpan = document.createElement('span');
    actionsSpan.className = 'endpoint-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon btn-danger';
    deleteBtn.textContent = ICONS.DELETE;
    deleteBtn.title = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteEndpoint(index);
    });

    actionsSpan.appendChild(deleteBtn);

    item.appendChild(contentWrapper);
    item.appendChild(actionsSpan);
    list.appendChild(item);
  });
}

function openEditor(index: number | null) {
  editingIndex = index;
  const endpoint = index === null ? newEndpointDefaults() : endpoints[index];
  fillForm(endpoint);

  if (index === null) {
    els.editorTitle().textContent = 'Add endpoint';
    els.saveBtn().textContent = `${ICONS.SAVE} Save`;
    els.saveNewBtn().style.display = 'none';
  } else {
    els.editorTitle().textContent = 'Edit endpoint';
    els.saveBtn().textContent = `${ICONS.SAVE} Save`;
    els.saveNewBtn().style.display = 'inline-block';
  }

  renderList(); // Update selected state in UI
}

function closeEditor() {
  editingIndex = null;
  fillForm(newEndpointDefaults());
  els.editorTitle().textContent = 'Add new endpoint';
  els.saveBtn().textContent = `${ICONS.SAVE} Save`;
  els.saveNewBtn().style.display = 'none';
  renderList(); // Clear selected state in UI
}

function fillForm(endpoint: ApiEndpoint) {
  els.name().value = endpoint.name || '';
  els.description().value = endpoint.description || '';
  els.method().value = (endpoint.method || 'POST').toUpperCase();
  els.contentType().value = endpoint.contentType || '';
  els.username().value = endpoint.username || '';
  els.password().value = endpoint.password || '';
  els.bearerToken().value = endpoint.bearerToken || '';
  els.endpoint().value = endpoint.endpointTemplate || '';
  els.body().value = endpoint.bodyTemplate || '';
  els.includeCookies().checked = endpoint.includeCookies === true;
  els.includeHeaders().checked = endpoint.includePageHeaders === true;
  setHeadersRows(endpoint.headers);

  // Update body field state based on method
  if (window.updateBodyState) {
    window.updateBodyState();
  }
}

function newEndpointDefaults(): ApiEndpoint {
  return {
    name: '',
    description: '',
    endpointTemplate: '',
    method: 'POST',
    contentType: '',
    username: '',
    password: '',
    bearerToken: '',
    headers: {},
    bodyTemplate: '',
    includeCookies: false,
    includePageHeaders: false,
  };
}

function buildEndpointFromForm(): ApiEndpoint | null {
  const nameRaw = els.name().value.trim();
  const description = els.description().value.trim();
  const endpoint = els.endpoint().value.trim();
  const method = els.method().value.trim().toUpperCase() || 'POST';
  const contentType = els.contentType().value.trim();
  const username = els.username().value.trim();
  const password = els.password().value.trim();
  const bearerToken = els.bearerToken().value.trim();
  const bodyTemplate = els.body().value.trim();
  const includeCookies = els.includeCookies().checked;
  const includePageHeaders = els.includeHeaders().checked;

  if (!endpoint) {
    logger.error('Endpoint URL is required');
    return null;
  }

  const headers: Record<string, string> = {};
  els
    .headersRows()
    .querySelectorAll('.header-row')
    .forEach((row) => {
      const [keyInput, valueInput] = Array.from(
        row.querySelectorAll('input'),
      ) as [HTMLInputElement, HTMLInputElement];
      const key = keyInput.value.trim();
      const value = valueInput.value.trim();
      if (key) {
        headers[key] = value;
      }
    });

  const apiEndpoint: ApiEndpoint = {
    name: nameRaw || suggestEndpointName(endpoint),
    endpointTemplate: endpoint,
    description: description || undefined,
    method,
    contentType: contentType || undefined,
    username: username || undefined,
    password: password || undefined,
    bearerToken: bearerToken || undefined,
    headers: Object.keys(headers).length ? headers : undefined,
    bodyTemplate: bodyTemplate || undefined,
    includeCookies,
    includePageHeaders,
  };

  return apiEndpoint;
}

function saveEndpoint() {
  const candidate = buildEndpointFromForm();
  if (!candidate) return;

  const updated = [...endpoints];
  if (editingIndex === null) {
    updated.push(candidate);
  } else {
    updated[editingIndex] = candidate;
  }

  const validated = validateEndpoints(JSON.stringify(updated));
  if (!validated.valid) {
    logger.error(validated.errorMessage || 'Invalid API endpoint');
    return;
  }

  endpoints = validated.parsed;

  browser.storage.sync
    .set({ apiEndpoints: validated.formatted })
    .then(() => {
      renderList();
      logger.info(`Endpoint saved: ${endpoints[editingIndex!].name}`);
    })
    .catch((error) => {
      logger.error('Failed to save API endpoint', error);
    });
}

function saveAsNew() {
  if (editingIndex === null) {
    // If not editing, just use regular save
    saveEndpoint();
    return;
  }

  const candidate = buildEndpointFromForm();
  if (!candidate) return;

  // Generate unique name using helper
  const baseName = candidate.name || 'endpoint';
  const existingNames = endpoints.map((e) => e.name);
  const newName = generateUniqueName(baseName, existingNames);

  candidate.name = newName;
  const updated = [...endpoints, candidate];

  const validated = validateEndpoints(JSON.stringify(updated));
  if (!validated.valid) {
    logger.error(validated.errorMessage || 'Invalid API endpoint');
    return;
  }

  endpoints = validated.parsed;

  browser.storage.sync
    .set({ apiEndpoints: validated.formatted })
    .then(() => {
      renderList();
      logger.info(`Endpoint saved: ${newName}`);
    })
    .catch((error) => {
      logger.error('Failed to save API endpoint', error);
    });
}

function deleteEndpoint(index: number) {
  const endpoint = endpoints[index];
  if (!endpoint) return;

  if (!confirm(`Delete API endpoint "${endpoint.name}"?`)) {
    return;
  }

  const updated = endpoints.filter((_, i) => i !== index);
  const validated = validateEndpoints(JSON.stringify(updated));
  if (!validated.valid) {
    logger.error(validated.errorMessage || 'Failed to delete API endpoint');
    return;
  }

  endpoints = validated.parsed;

  browser.storage.sync
    .set({ apiEndpoints: validated.formatted })
    .then(() => {
      renderList();
      closeEditor();
      logger.info(`Endpoint deleted: ${endpoint.name}`);
    })
    .catch((error) => {
      logger.error('Failed to delete API endpoint', error);
    });
}

async function handlePreview() {
  const candidate = buildEndpointFromForm();
  if (!candidate) return;

  const context: StreamInfo = {
    streamUrl: 'https://example.com/stream.m3u8',
    streamType: 'HLS',
    pageUrl: 'https://example.com/page',
    pageTitle: 'Example page',
    seekTimeSecs: 0, // Seek position (0 = unknown)
  };

  await previewCall(context, candidate.name, [candidate], logger);
}

/**
 * Handle copy button (copy interpolated endpoint URL to clipboard)
 */
async function handleCopyBtn() {
  try {
    const candidate = buildEndpointFromForm();
    if (!candidate) {
      logger.warn('No endpoint configured for copy');
      return;
    }

    // Use same test data as preview/call
    const testStream: StreamInfo = {
      streamUrl: 'https://example.com/stream.m3u8',
      streamType: 'HLS',
      pageUrl: 'https://example.com/page',
      pageTitle: 'Example page',
      seekTimeSecs: 0,
    };

    const userVars = await loadUserVars();
    const finalUrl = applyTemplate(
      candidate.endpointTemplate,
      testStream,
      userVars,
    );
    await navigator.clipboard.writeText(finalUrl);
    logger.infoFlash(2000, `${ICONS.COPY} Copied: ${finalUrl}`);
  } catch (error) {
    logger.warn('Failed to copy URL', error);
  }
}

/**
 * Render user variables list
 */
async function renderUserVarsList() {
  const list = document.getElementById('user-vars-list');
  if (!list) return;

  const userVars = await loadUserVars();
  const conflicts = detectUserVarConflicts(userVars);
  list.innerHTML = '';

  for (const [key, value] of Object.entries(userVars)) {
    const item = document.createElement('div');
    item.className = 'var-item';
    item.dataset.originalKey = key;
    item.dataset.originalValue = value;

    const conflict = conflicts.find((c) => c.key === key);
    const validation = validateUserVarKey(key);

    // Key wrapper (holds input and warning icon)
    const keyWrapper = document.createElement('div');
    keyWrapper.className = 'var-key-wrapper';

    // Key input
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.className = 'var-key-input';
    keyInput.value = key;
    keyInput.addEventListener('input', () => {
      updateVarValidation(item);
      markVarDirty(item);
    });
    keyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveUserVar(item);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelUserVar(item);
      }
    });
    keyWrapper.appendChild(keyInput);

    // Warning icon (inside key field for conflicts)
    const warnIcon = document.createElement('span');
    warnIcon.className = 'var-warn-icon';
    if (conflict) {
      item.classList.add('has-conflict');
      warnIcon.textContent = ICONS.WARNING;
      warnIcon.title = `Conflicts with built-in placeholder: ${conflict.conflict}`;
    }
    keyWrapper.appendChild(warnIcon);
    item.appendChild(keyWrapper);

    // Value input
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = 'var-value-input';
    valueInput.value = value;
    valueInput.addEventListener('input', () => markVarDirty(item));
    valueInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveUserVar(item);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelUserVar(item);
      }
    });
    item.appendChild(valueInput);

    // Save button (green check) - hidden when status icon shows error
    const saveBtn = document.createElement('button');
    saveBtn.className = 'var-save-btn';
    saveBtn.textContent = ICONS.SUCCESS;
    saveBtn.title = 'Save changes (Enter)';
    saveBtn.addEventListener('click', () => handleSaveUserVar(item));
    item.appendChild(saveBtn);

    // Status icon (error only) - shares btn1 position with save button
    const statusIcon = document.createElement('span');
    statusIcon.className = 'var-status-icon';
    if (!validation.valid) {
      item.classList.add('has-invalid');
      statusIcon.textContent = ICONS.ERROR;
      statusIcon.title = `Invalid key: ${validation.error}`;
    }
    item.appendChild(statusIcon);

    // Cancel button (red X)
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'var-cancel-btn';
    cancelBtn.textContent = ICONS.CANCEL;
    cancelBtn.title = 'Cancel changes (Esc)';
    cancelBtn.addEventListener('click', () => handleCancelUserVar(item));
    item.appendChild(cancelBtn);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'var-delete-btn';
    deleteBtn.textContent = ICONS.DELETE;
    deleteBtn.title = 'Delete variable';
    deleteBtn.addEventListener('click', () => handleDeleteUserVar(key));
    item.appendChild(deleteBtn);

    // Clone button
    const cloneBtn = document.createElement('button');
    cloneBtn.className = 'var-clone-btn';
    cloneBtn.textContent = ICONS.CLONE;
    cloneBtn.title = 'Clone variable';
    cloneBtn.addEventListener('click', () => {
      const currentKey = keyInput.value.trim();
      const currentValue = valueInput.value;
      handleCloneUserVar(item, currentKey, currentValue);
    });
    item.appendChild(cloneBtn);

    list.appendChild(item);
  }

  // Add empty row at the end (always ready for new variable)
  const emptyItem = document.createElement('div');
  emptyItem.className = 'var-item';
  emptyItem.dataset.originalKey = '';
  emptyItem.dataset.originalValue = '';

  // Key wrapper
  const emptyKeyWrapper = document.createElement('div');
  emptyKeyWrapper.className = 'var-key-wrapper';

  // Key input
  const emptyKeyInput = document.createElement('input');
  emptyKeyInput.type = 'text';
  emptyKeyInput.className = 'var-key-input';
  emptyKeyInput.placeholder = 'Variable name...';
  emptyKeyInput.addEventListener('input', () => {
    updateVarValidation(emptyItem);
    markVarDirty(emptyItem);
  });
  emptyKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveUserVar(emptyItem);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelUserVar(emptyItem);
    }
  });
  emptyKeyWrapper.appendChild(emptyKeyInput);

  // Warning icon
  const emptyWarnIcon = document.createElement('span');
  emptyWarnIcon.className = 'var-warn-icon';
  emptyKeyWrapper.appendChild(emptyWarnIcon);
  emptyItem.appendChild(emptyKeyWrapper);

  // Value input
  const emptyValueInput = document.createElement('input');
  emptyValueInput.type = 'text';
  emptyValueInput.className = 'var-value-input';
  emptyValueInput.placeholder = 'Value...';
  emptyValueInput.addEventListener('input', () => markVarDirty(emptyItem));
  emptyValueInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveUserVar(emptyItem);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelUserVar(emptyItem);
    }
  });
  emptyItem.appendChild(emptyValueInput);

  // Save button
  const emptySaveBtn = document.createElement('button');
  emptySaveBtn.className = 'var-save-btn';
  emptySaveBtn.textContent = ICONS.SUCCESS;
  emptySaveBtn.title = 'Save (Enter)';
  emptySaveBtn.addEventListener('click', () => handleSaveUserVar(emptyItem));
  emptyItem.appendChild(emptySaveBtn);

  // Status icon
  const emptyStatusIcon = document.createElement('span');
  emptyStatusIcon.className = 'var-status-icon';
  emptyItem.appendChild(emptyStatusIcon);

  // Cancel button
  const emptyCancelBtn = document.createElement('button');
  emptyCancelBtn.className = 'var-cancel-btn';
  emptyCancelBtn.textContent = ICONS.CANCEL;
  emptyCancelBtn.title = 'Cancel (Esc)';
  emptyCancelBtn.addEventListener('click', () =>
    handleCancelUserVar(emptyItem),
  );
  emptyItem.appendChild(emptyCancelBtn);

  // Delete button (hidden via CSS for empty row)
  const emptyDeleteBtn = document.createElement('button');
  emptyDeleteBtn.className = 'var-delete-btn';
  emptyDeleteBtn.textContent = ICONS.DELETE;
  emptyDeleteBtn.title = 'Delete';
  emptyItem.appendChild(emptyDeleteBtn);

  // Clone button (hidden via CSS for empty row)
  const emptyCloneBtn = document.createElement('button');
  emptyCloneBtn.className = 'var-clone-btn';
  emptyCloneBtn.textContent = ICONS.CLONE;
  emptyCloneBtn.title = 'Clone';
  emptyItem.appendChild(emptyCloneBtn);

  list.appendChild(emptyItem);
}

function updateVarValidation(item: HTMLElement) {
  const keyInput = item.querySelector('.var-key-input') as HTMLInputElement;
  const statusIcon = item.querySelector('.var-status-icon') as HTMLElement;
  const warnIcon = item.querySelector('.var-warn-icon') as HTMLElement;
  const key = keyInput.value.trim();
  const originalKey = item.dataset.originalKey;

  // Remove previous status classes (CSS controls visibility)
  item.classList.remove('has-invalid', 'has-conflict');
  statusIcon.textContent = '';
  statusIcon.title = '';
  warnIcon.textContent = '';
  warnIcon.title = '';

  // Check validation (cheap check)
  const validation = validateUserVarKey(key);
  if (!validation.valid) {
    item.classList.add('has-invalid');
    statusIcon.textContent = '❗'; // Red exclamation
    statusIcon.title = `Invalid key: ${validation.error}`;
    return;
  }

  // Check for duplicate keys (clash with existing user variables)
  const otherKeys = new Set(
    Array.from(document.querySelectorAll('.var-item'))
      .filter((el) => el !== item)
      .map((el) => (el as HTMLElement).dataset.originalKey)
      .filter(Boolean),
  );

  if (otherKeys.has(key) && key !== originalKey) {
    item.classList.add('has-conflict');
    warnIcon.textContent = ICONS.WARNING;
    warnIcon.title = `Clashes with existing variable: ${key}`;
    return;
  }

  // Check conflicts with built-in placeholders
  const userVars: Record<string, string> = {};
  userVars[key] = '';
  const conflicts = detectUserVarConflicts(userVars);
  if (conflicts.length > 0) {
    item.classList.add('has-conflict');
    warnIcon.textContent = ICONS.WARNING;
    warnIcon.title = `Conflicts with built-in placeholder: ${conflicts[0].conflict}`;
  }
}

function markVarDirty(item: HTMLElement) {
  item.classList.add('dirty');
}

async function handleCloneUserVar(
  item: HTMLElement,
  key: string,
  value: string,
) {
  // If item is dirty, reset it first then clone
  if (item.classList.contains('dirty')) {
    handleCancelUserVar(item);
  }

  const userVars = await loadUserVars();
  const existingKeys = Object.keys(userVars);
  const newKey = generateUniqueName(key, existingKeys, '_');

  userVars[newKey] = value;
  await saveUserVars(userVars);
  await renderUserVarsList();
  logger.info(`Variable cloned: ${key} → ${newKey}`);
}

async function handleDeleteUserVar(key: string) {
  if (!confirm(`Delete variable "${key}"?`)) return;

  const userVars = await loadUserVars();
  delete userVars[key];
  await saveUserVars(userVars);
  await renderUserVarsList();
  logger.info(`Variable deleted: ${key}`);
}

async function clearAllUserVars() {
  const userVars = await loadUserVars();
  const count = Object.keys(userVars).length;
  if (count === 0) {
    logger.info('No variables to clear');
    return;
  }
  if (!confirm(`Clear all ${count} variable(s)?`)) return;

  await saveUserVars({});
  await renderUserVarsList();
  logger.info(`Cleared ${count} variable(s)`);
}

async function resetUserVars() {
  const userVars = await loadUserVars();
  const count = Object.keys(userVars).length;
  const defaults = getDefaultUserVars();
  const defaultCount = Object.keys(defaults).length;

  if (count === 0 && defaultCount === 0) {
    logger.info('No variables to reset');
    return;
  }

  const msg =
    defaultCount > 0
      ? `Reset to ${defaultCount} default variable(s)? Current: ${count}`
      : `Clear all ${count} variable(s)? (No defaults available)`;

  if (!confirm(msg)) return;

  await saveUserVars(defaults);
  await renderUserVarsList();

  if (defaultCount > 0) {
    logger.info(`Reset to ${defaultCount} default variable(s)`);
  } else {
    logger.info('Variables cleared (no defaults available)');
  }
}

async function handleSaveUserVar(item: HTMLElement) {
  const originalKey = item.dataset.originalKey ?? '';

  const keyInput = item.querySelector('.var-key-input') as HTMLInputElement;
  const valueInput = item.querySelector('.var-value-input') as HTMLInputElement;
  const newKey = keyInput.value.trim();
  const newValue = valueInput.value;

  // Validate key
  const validation = validateUserVarKey(newKey);
  if (!validation.valid) {
    logger.error(`Invalid variable key: ${validation.error}`);
    return;
  }

  const userVars = await loadUserVars();

  // Check if key already exists (for new variables or renames)
  if (newKey !== originalKey && userVars[newKey] !== undefined) {
    logger.warn(`Variable "${newKey}" clashes with existing variable`);
  }

  // Check for placeholder conflicts and warn
  const tempVars: Record<string, string> = {};
  tempVars[newKey] = '';
  const conflicts = detectUserVarConflicts(tempVars);
  if (conflicts.length > 0) {
    logger.warn(
      `Variable "${newKey}" conflicts with built-in placeholder: ${conflicts[0].conflict}`,
    );
  }

  // Remove old key if renamed (skip if originalKey is empty = new variable)
  if (originalKey && newKey !== originalKey) {
    delete userVars[originalKey];
  }

  userVars[newKey] = newValue;
  await saveUserVars(userVars);
  await renderUserVarsList();

  const action = originalKey ? 'saved' : 'added';
  logger.info(`Variable ${action}: ${newKey}`);
}

function handleCancelUserVar(item: HTMLElement) {
  const originalKey = item.dataset.originalKey ?? '';
  const originalValue = item.dataset.originalValue ?? '';

  const keyInput = item.querySelector('.var-key-input') as HTMLInputElement;
  const valueInput = item.querySelector('.var-value-input') as HTMLInputElement;

  // For empty row, just clear fields; for existing vars, revert to original
  keyInput.value = originalKey;
  valueInput.value = originalValue;
  item.classList.remove('dirty', 'has-invalid', 'has-conflict');

  // Clear validation icons
  const statusIcon = item.querySelector('.var-status-icon') as HTMLElement;
  const warnIcon = item.querySelector('.var-warn-icon') as HTMLElement;
  if (statusIcon) {
    statusIcon.textContent = '';
    statusIcon.title = '';
  }
  if (warnIcon) {
    warnIcon.textContent = '';
    warnIcon.title = '';
  }
}

/**
 * Handle endpoint action with test data (call API or open in tab)
 */
async function handleCallEndpoint(mode: 'fetch' | 'tab') {
  // Get current form endpoint
  const candidate = buildEndpointFromForm();
  if (!candidate) {
    logger.error('Invalid endpoint configuration');
    return;
  }

  const testUrl = 'https://example.com/test-stream.m3u8';
  const pageUrl = 'https://example.com/test-page';
  const pageTitle = 'Test Page - Streamonio';

  const action = mode === 'fetch' ? 'Validating endpoint' : 'Opening in tab';
  logger.info(`${action}: ${candidate.name} → ${testUrl}`, {
    endpoint: candidate,
  });

  // Direct call (options runs in extension context)
  const response = await callEndpoint({
    mode,
    stream: {
      streamUrl: testUrl,
      streamType: 'HLS',
      pageUrl: pageUrl || '',
      pageTitle: pageTitle || '',
      seekTimeSecs: 0,
    },
    endpointName: candidate.name,
    apiEndpoints: [candidate],
    logger,
  });

  if (response.success) {
    const successMsg =
      mode === 'fetch'
        ? `✅ ${candidate.name}: ${response.status || 'OK'}`
        : `✅ Opened in new tab: ${response.details || testUrl}`;
    logger.info(successMsg);

    // Log response body separately in debug (keep it out of status bar)
    if (mode === 'fetch' && response.response) {
      const formatted = formatResponseBody(response.response);
      logger.info(`Response body: ${formatted}`);
    }
  } else {
    logger.error(`${action} failed: ${candidate.name} - ${response.error}`, {
      error: response.error,
    });
  }
}

function resetBuiltIns() {
  if (
    !confirm(
      'Reset built-in blueprints to defaults? (User-defined endpoints will be preserved)',
    )
  )
    return;

  const builtIns = getBuiltInEndpoints();
  const builtInNames = new Set(builtIns.map((e) => e.name));
  const userEndpoints = endpoints.filter((e) => !builtInNames.has(e.name));
  const merged = [...builtIns, ...userEndpoints];

  const validated = validateEndpoints(JSON.stringify(merged));
  if (!validated.valid) {
    logger.error('Failed to validate merged endpoints');
    return;
  }

  browser.storage.sync
    .set({ apiEndpoints: validated.formatted })
    .then(() => {
      loadSettings();
      closeEditor();
      logger.info(
        `Built-ins restored: ${builtIns.length} built-in, ${userEndpoints.length} user`,
      );
    })
    .catch((error) => {
      logger.error('Failed to reset built-ins', error);
    });
}

function clearAllEndpoints() {
  if (!confirm('Remove ALL endpoints? This cannot be undone.')) return;

  browser.storage.sync
    .set({ apiEndpoints: '[]' })
    .then(() => {
      loadSettings();
      closeEditor();
      logger.info('All endpoints cleared');
    })
    .catch((error) => {
      logger.error('Failed to clear endpoints', error);
    });
}

function exportEndpoints() {
  if (endpoints.length === 0) {
    logger.warn('No API endpoints to export');
    return;
  }

  const json = JSON.stringify(endpoints, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `streamonio-endpoints-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  logger.info(`Exported ${endpoints.length} endpoint(s)`);
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const content = event.target?.result as string;
      const parsed = JSON.parse(content);
      const validated = validateEndpoints(JSON.stringify(parsed));

      if (!validated.valid) {
        logger.error(`Invalid file: ${validated.errorMessage}`);
        return;
      }

      pendingImportEndpoints = validated.parsed;
      showImportModal();
    } catch (error) {
      logger.error(`Failed to read file: ${error?.message ?? 'Invalid JSON'}`);
    }
  };
  reader.readAsText(file);

  // Reset file input
  input.value = '';
}

function showImportUrlModal() {
  const modal = els.importUrlModal() as HTMLDivElement;
  const input = els.importUrlInput() as HTMLInputElement;
  input.value = '';
  modal.style.display = 'flex';
  input.focus();
}

function hideImportUrlModal() {
  const modal = els.importUrlModal() as HTMLDivElement;
  modal.style.display = 'none';
}

function convertGistUrl(url: string): string {
  // Convert GitHub gist URLs to raw format
  // https://gist.github.com/user/abc123 -> https://gist.githubusercontent.com/user/abc123/raw/
  // https://gist.github.com/user/abc123/def456 -> https://gist.githubusercontent.com/user/abc123/raw/def456/
  const gistMatch = url.match(
    /^https?:\/\/gist\.github\.com\/([^/]+)\/([a-f0-9]+)(?:\/([a-f0-9]+))?/,
  );
  if (gistMatch) {
    const [, user, gistId, revision] = gistMatch;
    return revision
      ? `https://gist.githubusercontent.com/${user}/${gistId}/raw/${revision}/`
      : `https://gist.githubusercontent.com/${user}/${gistId}/raw/`;
  }
  return url;
}

async function fetchFromUrl() {
  const input = els.importUrlInput() as HTMLInputElement;
  const url = input.value.trim();

  if (!url) {
    logger.error('URL is required');
    return;
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    logger.error('Invalid URL format');
    return;
  }

  const fetchUrl = convertGistUrl(url);
  logger.infoFlash(2000, `Fetching from URL...`);

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      logger.error(
        `Failed to fetch: ${response.status} ${response.statusText}`,
      );
      return;
    }

    const content = await response.text();
    const parsed = JSON.parse(content);
    const validated = validateEndpoints(JSON.stringify(parsed));

    if (!validated.valid) {
      logger.error(`Invalid JSON: ${validated.errorMessage}`);
      return;
    }

    pendingImportEndpoints = validated.parsed;
    hideImportUrlModal();
    showImportModal();
    logger.info(`Fetched ${validated.parsed.length} endpoint(s) from URL`);
  } catch (error) {
    logger.error(
      `Failed to fetch: ${error?.message ?? 'Unknown error'}`,
      error,
    );
  }
}

function showImportModal() {
  const modal = els.importModal() as HTMLDivElement;
  const preview = els.importPreview() as HTMLDivElement;

  const dupes = pendingImportEndpoints.filter((p) =>
    endpoints.some((existing) => existing.name === p.name),
  );
  const newEndpoints = pendingImportEndpoints.filter(
    (p) => !endpoints.some((existing) => existing.name === p.name),
  );

  let previewText = `Importing ${pendingImportEndpoints.length} endpoint(s):\n\n`;
  if (newEndpoints.length > 0) {
    previewText += `New endpoints:\n${newEndpoints.map((p) => `  • ${p.name}`).join('\n')}\n\n`;
  }
  if (dupes.length > 0) {
    previewText += `Duplicate names (will be updated if merging):\n${dupes.map((p) => `  • ${p.name}`).join('\n')}`;
  }

  preview.textContent = previewText;
  modal.style.display = 'flex';
}

function closeImportModal() {
  const modal = els.importModal() as HTMLDivElement;
  modal.style.display = 'none';
  pendingImportEndpoints = [];
}

function performImport(merge: boolean) {
  const updated = merge
    ? [
        ...endpoints.filter(
          (p) =>
            !pendingImportEndpoints.some(
              (imported) => imported.name === p.name,
            ),
        ),
        ...pendingImportEndpoints,
      ]
    : pendingImportEndpoints;

  const validated = validateEndpoints(JSON.stringify(updated));
  if (!validated.valid) {
    logger.error(`Invalid endpoints import: ${validated.errorMessage}`);
    return;
  }

  endpoints = validated.parsed;

  browser.storage.sync
    .set({ apiEndpoints: validated.formatted })
    .then(() => {
      renderList();
      closeImportModal();
      const action = merge ? 'merged' : 'replaced';
      logger.info(`${validated.parsed.length} endpoint(s) ${action}`);
    })
    .catch((error) => {
      logger.error('Failed to import endpoints', error);
    });
}

async function wireEvents() {
  // Disable body field for methods that don't support request body
  const methodSelect = els.method();
  const bodyField = els.body();
  window.updateBodyState = () => {
    const method = methodSelect.value;
    const hasBody = !['GET', 'HEAD', 'DELETE'].includes(method);
    bodyField.disabled = !hasBody;
    bodyField.style.opacity = hasBody ? '1' : '0.5';
    bodyField.style.cursor = hasBody ? 'text' : 'not-allowed';
  };
  methodSelect.addEventListener('change', window.updateBodyState);
  // Initial state
  window.updateBodyState();

  document
    .getElementById('save-endpoint-btn')
    ?.addEventListener('click', saveEndpoint);
  document.getElementById('save-new-btn')?.addEventListener('click', saveAsNew);
  document
    .getElementById('clear-edit-btn')
    ?.addEventListener('click', closeEditor);
  document
    .getElementById('preview-btn')
    ?.addEventListener('click', handlePreview);
  document
    .getElementById('add-header-row')
    ?.addEventListener('click', () => addHeaderRow());
  document
    .getElementById('call-api-btn')
    ?.addEventListener('click', () => handleCallEndpoint('fetch'));
  document
    .getElementById('open-tab-btn')
    ?.addEventListener('click', () => handleCallEndpoint('tab'));
  document.getElementById('copy-btn')?.addEventListener('click', handleCopyBtn);
  document
    .getElementById('reset-btn')
    ?.addEventListener('click', resetBuiltIns);
  document
    .getElementById('clear-btn')
    ?.addEventListener('click', clearAllEndpoints);
  document
    .getElementById('to-file-btn')
    ?.addEventListener('click', exportEndpoints);
  document.getElementById('from-file-btn')?.addEventListener('click', () => {
    (document.getElementById('import-file-input') as HTMLInputElement).click();
  });
  document
    .getElementById('from-site-btn')
    ?.addEventListener('click', showImportUrlModal);

  // User variables
  document
    .getElementById('reset-vars-btn')
    ?.addEventListener('click', resetUserVars);
  document
    .getElementById('clear-vars-btn')
    ?.addEventListener('click', clearAllUserVars);
  await renderUserVarsList();

  document
    .getElementById('import-url-cancel-btn')
    ?.addEventListener('click', hideImportUrlModal);
  document
    .getElementById('import-url-fetch-btn')
    ?.addEventListener('click', fetchFromUrl);
  document
    .getElementById('import-file-input')
    ?.addEventListener('change', handleFileSelect);
  document
    .getElementById('import-merge-btn')
    ?.addEventListener('click', () => performImport(true));
  document
    .getElementById('import-replace-btn')
    ?.addEventListener('click', () => performImport(false));
  document
    .getElementById('import-cancel-btn')
    ?.addEventListener('click', closeImportModal);
  els.endpoint().addEventListener('blur', () => {
    if (!els.name().value.trim() && els.endpoint().value.trim()) {
      els.name().value = suggestEndpointName(els.endpoint().value.trim());
    }
  });
}

async function initialize() {
  // Display version from manifest
  const manifest = browser.runtime.getManifest();
  const devSuffix = buildInfo.isDev ? '-dev' : '';
  const versionText = `Version ${manifest.version}${devSuffix}`;
  const dateText = buildInfo.commitDate
    ? ` • Released ${new Date(buildInfo.commitDate).toLocaleDateString()}`
    : '';
  const versionEl = els.aboutVersion();
  versionEl.textContent = versionText + dateText;
  if (buildInfo.isDev) {
    versionEl.style.color = '#ff9800'; // Orange for dev builds
  }

  loadSettings();
  await wireEvents();
  setHeadersRows();

  // Wire log viewer
  const logViewerEl = els.logViewer();
  createLogViewer(logViewerEl, logger);

  // Settings checkbox
  els.enableHoverPanel().addEventListener('change', () => {
    browser.storage.sync
      .set({ enableHoverPanel: els.enableHoverPanel().checked })
      .then(() => {
        const status = els.enableHoverPanel().checked ? 'enabled' : 'disabled';
        logger.info(`Hover panel ${status}`);
      })
      .catch((err) => {
        logger.error('Failed to save hover panel setting:', err);
      });
  });

  els.detectionDebounce().addEventListener('change', () => {
    const value = Number.parseInt(els.detectionDebounce().value, 10);
    if (Number.isNaN(value) || value < 100 || value > 5000) {
      logger.warn('storage', `${ICONS.WARNING} Debounce must be 100-5000ms`);
      return;
    }
    browser.storage.sync
      .set({ detectionDebounceMs: value })
      .then(() => {
        logger.infoFlash(
          3000,
          'storage',
          `✅ Detection debounce set to ${value}ms`,
        );
      })
      .catch((err) => {
        logger.error('Failed to save debounce setting:', err);
      });
  });

  els.detectionInterval().addEventListener('change', () => {
    const value = Number.parseInt(els.detectionInterval().value, 10);
    if (Number.isNaN(value) || value < 500 || value > 10000) {
      logger.warn('storage', `${ICONS.WARNING} Interval must be 500-10000ms`);
      return;
    }
    browser.storage.sync
      .set({ detectionIntervalMs: value })
      .then(() => {
        logger.infoFlash(
          3000,
          'storage',
          `✅ Detection interval set to ${value}ms`,
        );
      })
      .catch((err) => {
        logger.error('Failed to save interval setting:', err);
      });
  });

  // Make help icons tappable on mobile - toggle tooltip on click/tap
  const handleTooltipToggle = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.target as HTMLElement;
    const wasShowing = el.classList.contains('show-tooltip');

    // Hide all other tooltips
    document.querySelectorAll('.help-icon.show-tooltip').forEach((other) => {
      if (other !== el) other.classList.remove('show-tooltip');
    });

    // Toggle this one
    el.classList.toggle('show-tooltip', !wasShowing);
  };

  document.querySelectorAll('.help-icon').forEach((icon) => {
    // Use both touchstart and click for better mobile support
    icon.addEventListener('touchstart', handleTooltipToggle, {
      passive: false,
    });
    icon.addEventListener('click', handleTooltipToggle);
  });

  // Hide tooltips when clicking elsewhere
  document.addEventListener('click', () => {
    document.querySelectorAll('.help-icon.show-tooltip').forEach((icon) => {
      icon.classList.remove('show-tooltip');
    });
  });

  // Make template placeholder codes selectable on tap
  document.querySelectorAll('.template-help code').forEach((code) => {
    code.addEventListener('click', (e) => {
      const el = e.target as HTMLElement;
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initialize);
}
