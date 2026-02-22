/**
 * Lightweight UI helpers for rendering StatusBar and Logger output
 */

import type { LogLevel } from './logger';

// Lightweight UI helpers for rendering StatusBar and Logger output

export function createStatusRenderer(elements: {
  bar: HTMLElement;
  message: HTMLSpanElement;
}) {
  return function renderStatus(msg: { level: LogLevel; message: string }) {
    const bar = elements.bar;
    elements.message.innerHTML = msg.message;
    // Vary background color by level
    if (msg.level === 'error') {
      bar.style.backgroundColor = '#fee';
      bar.style.borderLeftColor = '#b91c1c';
    } else if (msg.level === 'warn') {
      bar.style.backgroundColor = '#fef3c7';
      bar.style.borderLeftColor = '#d97706';
    } else {
      bar.style.backgroundColor = '#dbeafe';
      bar.style.borderLeftColor = '#2563eb';
    }
  };
}

export function createLogAppender(viewer: HTMLElement) {
  return function appendLog(
    level: 'error' | 'warn' | 'info' | 'debug',
    category: string,
    message: string,
  ) {
    const empty = viewer.querySelector('.log-empty');
    if (empty) empty.remove();

    // Check if user has scrolled up before adding new content
    const wasAtBottom =
      viewer.scrollHeight - viewer.scrollTop - viewer.clientHeight < 5;

    const line = viewer.ownerDocument.createElement('div');
    line.textContent = `[${new Date().toISOString()}] ${level.toUpperCase()} ${category}: ${message}`;
    line.dataset.level = level;

    // Apply color by level
    if (level === 'error') {
      line.style.color = '#f87171';
    } else if (level === 'warn') {
      line.style.color = '#fbbf24';
    } else if (level === 'info') {
      line.style.color = '#60a5fa';
    } else {
      line.style.color = '#9ca3af';
    }

    viewer.appendChild(line);

    // Auto-scroll only if user was at bottom
    if (wasAtBottom) {
      viewer.scrollTop = viewer.scrollHeight;
    }
  };
}
const LOG_LEVELS = [
  { value: 'error', icon: '‼️', title: 'Toggle Error+' },
  { value: 'warn', icon: '⚠️', title: 'Toggle Warn+' },
  { value: 'info', icon: 'ℹ️', title: 'Toggle Info+' },
  { value: 'debug', icon: '🐛', title: 'Toggle Debug+' },
] as const;

export function createLogFilterBar(container: HTMLElement) {
  const bar = document.createElement('div');
  bar.className = 'log-filter-bar';

  LOG_LEVELS.forEach(({ value, icon, title }) => {
    const label = document.createElement('label');
    label.className = 'filter-icon';
    label.title = title;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'log-level-filter';
    input.value = value;
    input.checked = true;

    const span = document.createElement('span');
    span.textContent = icon;

    label.appendChild(input);
    label.appendChild(span);
    bar.appendChild(label);
  });

  container.appendChild(bar);
  return bar;
}

export function createLogActionBar(container: HTMLElement, logger: any) {
  const bar = document.createElement('div');
  bar.className = 'log-action-bar';

  // Clear button
  const clearBtn = document.createElement('label');
  clearBtn.className = 'filter-icon';
  clearBtn.title = 'Clear logs';
  const clearInput = document.createElement('input');
  clearInput.type = 'checkbox';
  clearInput.className = 'log-level-filter';
  const clearSpan = document.createElement('span');
  clearSpan.textContent = '🧹';
  clearBtn.appendChild(clearInput);
  clearBtn.appendChild(clearSpan);
  clearBtn.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent checkbox toggle
    logger.clearLogs();
    const viewer = container.querySelector('.log-content') as HTMLDivElement;
    if (viewer) viewer.innerHTML = '<div class="log-empty">No logs yet</div>';
  });

  // Export button
  const exportBtn = document.createElement('label');
  exportBtn.className = 'filter-icon';
  exportBtn.title = 'Export logs';
  const exportInput = document.createElement('input');
  exportInput.type = 'checkbox';
  exportInput.className = 'log-level-filter';
  const exportSpan = document.createElement('span');
  exportSpan.textContent = '⬇️';
  exportBtn.appendChild(exportInput);
  exportBtn.appendChild(exportSpan);
  exportBtn.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent checkbox toggle
    const json = logger.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `streamonio-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  bar.appendChild(clearBtn);
  bar.appendChild(exportBtn);
  container.appendChild(bar);
  return bar;
}

export function createLogViewer(container: HTMLElement, logger: any) {
  // Create filter bar
  createLogFilterBar(container);

  // Create action bar
  createLogActionBar(container, logger);

  // Create content
  const content = document.createElement('div');
  content.id = 'log-content';
  content.className = 'log-content';
  container.appendChild(content);

  // Wire filtering
  const levelCheckboxes = container.querySelectorAll(
    '.log-level-filter',
  ) as NodeListOf<HTMLInputElement>;
  enableClickedLogLevels(content as HTMLDivElement, levelCheckboxes);

  // Set up log appending to the actual log-content div
  const appendLog = createLogAppender(content);
  logger.subscribeLogs((entries: any[]) => {
    entries
      .slice(-1)
      .forEach((e: any) => appendLog(e.level, e.category, e.message));
  });

  return content;
}

export function applyLogFilter(viewer: HTMLDivElement, maxLevel: string) {
  const maxIdx = LOG_LEVELS.findIndex((l) => l.value === maxLevel);
  const enabledLevels = LOG_LEVELS.slice(0, maxIdx + 1).map((l) => l.value);

  viewer
    .querySelectorAll('div:not(.log-empty)')
    .forEach((line: HTMLElement) => {
      line.style.display = enabledLevels.includes(line.dataset.level as any)
        ? 'block'
        : 'none';
    });
}

export function enableClickedLogLevels(
  viewer: HTMLDivElement,
  levelCheckboxes: NodeListOf<HTMLInputElement>,
) {
  levelCheckboxes.forEach((el, idx) => {
    el.addEventListener('click', () => {
      levelCheckboxes.forEach((cb, i) => {
        cb.checked = i <= idx;
      });
      applyLogFilter(viewer, el.value);
    });
  });
}
