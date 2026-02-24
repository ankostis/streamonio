/**
 * Streamonio Content Script (page-context)
 * Detects streaming media on web pages
 */

import browser from './browser-api.js';
import { debounce } from './debounce';
import {
  getStreamType as getStreamTypeShared,
  isStreamUrl as isStreamUrlShared,
} from './detect';
import { DEFAULT_CONFIG } from './endpoint';
import { Logger } from './logger';

// Module content script (no exports needed)

(() => {
  const logger = new Logger('page');
  const detectedStreams = new Set<string>();

  /**
   * Check if a URL is likely a stream
   */
  function isStreamUrl(url: string | null | undefined): boolean {
    if (!url || typeof url !== 'string') return false;

    return isStreamUrlShared(url ?? null, window.location.href);
  }

  /**
   * Determine stream type from URL
   */
  function getStreamType(url: string): string {
    return getStreamTypeShared(url);
  }

  /**
   * Report detected stream to broker script
   */
  async function reportStream(url: string) {
    if (detectedStreams.has(url)) return;

    detectedStreams.add(url);
    logger.info('Detected stream:', url);

    // Inject hover panel button when first stream is detected
    // (if enabled and not already present)
    if (detectedStreams.size === 1) {
      injectHoverPanel().catch((err) => {
        logger.warn('Failed to inject hover panel after stream detection', err);
      });
    }

    browser.runtime
      .sendMessage({
        type: 'STREAM_DETECTED',
        url,
        streamType: getStreamType(url),
      })
      .then(() => {
        // Relay detection status to a test ping if needed
        const win = window as Window & {
          testIntegrationPingHandler?: (msg: { detected: boolean }) => void;
        };
        if (win.testIntegrationPingHandler) {
          win.testIntegrationPingHandler({ detected: true });
        }
      })
      .catch((err) => {
        // Message send can fail during page navigation/unload - this is expected
        logger.warn(`Failed to report stream '${url}' to broker worker`, err);
        // In a future enhancement, could track failure count and surface via a UI overlay.
      });
  }

  /**
   * Recursively find all media elements, including those in shadow roots
   */
  function getAllMediaElements(
    root: Document | ShadowRoot = document,
  ): HTMLMediaElement[] {
    const elements: HTMLMediaElement[] = [];

    // Get direct media elements
    const directMedia = root.querySelectorAll<HTMLMediaElement>('audio, video');
    elements.push(...Array.from(directMedia));

    // Recursively search shadow roots
    const allElements = root.querySelectorAll('*');
    allElements.forEach((element) => {
      if (element.shadowRoot) {
        elements.push(...getAllMediaElements(element.shadowRoot));
      }
    });

    return elements;
  }

  /**
   * Monitor media elements (audio/video)
   */
  function monitorMediaElements() {
    const mediaElements = getAllMediaElements();

    mediaElements.forEach((element) => {
      if (element.src && isStreamUrl(element.src)) {
        reportStream(element.src);
      }

      const sources = element.querySelectorAll('source');
      sources.forEach((source) => {
        if (source.src && isStreamUrl(source.src)) {
          reportStream(source.src);
        }
      });

      if (!element.dataset.streamonioMonitored) {
        element.dataset.streamonioMonitored = 'true';

        const observer = new MutationObserver(() => {
          if (element.src && isStreamUrl(element.src)) {
            reportStream(element.src);
          }
        });

        observer.observe(element, {
          attributes: true,
          attributeFilter: ['src'],
        });
      }
    });
  }

  /**
   * Intercept MediaSource Extensions (MSE)
   * MUST run in page's main world, not content script isolated world.
   * Injects hooks via <script> tag to access page's MediaSource global.
   */
  function interceptMediaSource() {
    // Inject script into page's main world (where YouTube's JS runs)
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        console.log('[Streamonio MSE] Intercepting MediaSource in main world');

        // Hook fetch to capture manifest/segment URLs
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
          const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
          if (url && (
            url.includes('.m3u8') ||
            url.includes('.mpd') ||
            url.includes('/manifest') ||
            url.includes('videoplayback') ||
            url.includes('segment')
          )) {
            console.log('[Streamonio MSE] Fetching stream URL:', url);
            // Dispatch event to content script
            window.dispatchEvent(new CustomEvent('streamonio-stream-url', {
              detail: { url, source: 'fetch' }
            }));
          }
          return originalFetch.apply(this, args);
        };

        // Hook XMLHttpRequest
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
          if (typeof url === 'string' && (
            url.includes('.m3u8') ||
            url.includes('.mpd') ||
            url.includes('/manifest') ||
            url.includes('videoplayback') ||
            url.includes('segment')
          )) {
            console.log('[Streamonio MSE] XHR opening stream URL:', url);
            window.dispatchEvent(new CustomEvent('streamonio-stream-url', {
              detail: { url, source: 'xhr' }
            }));
          }
          return originalOpen.call(this, method, url, ...rest);
        };

        // Hook MediaSource creation
        const OriginalMediaSource = window.MediaSource;
        window.MediaSource = class extends OriginalMediaSource {
          constructor() {
            super();
            console.log('[Streamonio MSE] MediaSource created');
            window.dispatchEvent(new CustomEvent('streamonio-mse-created'));
          }
        };
        Object.setPrototypeOf(window.MediaSource, OriginalMediaSource);
        Object.setPrototypeOf(window.MediaSource.prototype, OriginalMediaSource.prototype);
      })();
    `;
    (document.head || document.documentElement).prepend(script);
    script.remove(); // Clean up after injection

    // Listen for events from injected script
    window.addEventListener('streamonio-stream-url', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { url, source } = customEvent.detail;
      logger.info(`stream-url`, `MSE ${source}: ${url}`);
      // Treat it like a detected stream
      reportStream(url);
    });

    window.addEventListener('streamonio-mse-created', () => {
      logger.debug(`mse`, 'MediaSource instance created');
    });
  }

  /**
   * Monitor DOM for new media elements
   */
  async function monitorDOMChanges() {
    const config = (await browser.storage.sync.get({
      detectionDebounceMs: DEFAULT_CONFIG.detectionDebounceMs,
    })) as { detectionDebounceMs?: number };
    const debounceMs =
      config.detectionDebounceMs ?? DEFAULT_CONFIG.detectionDebounceMs;

    const debouncedMonitor = debounce(() => {
      monitorMediaElements();
    }, debounceMs);

    const observer = new MutationObserver(() => {
      debouncedMonitor();
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  /**
   * Check common streaming player frameworks
   */
  function checkStreamingFrameworks() {
    const anyWindow = window;

    const frameworks = [
      { name: 'HLS.js', key: 'Hls' },
      { name: 'Video.js', key: 'videojs' },
      { name: 'JW Player', key: 'jwplayer' },
      { name: 'Shaka Player', key: 'shaka' },
    ];

    const detected = frameworks
      .filter((fw) => anyWindow[fw.key])
      .map((fw) => fw.name);
    if (detected.length > 0) {
      logger.debug(`Frameworks detected: ${detected.join(', ')}`);
    }
  }

  async function startDetection() {
    const config = (await browser.storage.sync.get({
      detectionDebounceMs: DEFAULT_CONFIG.detectionDebounceMs,
      detectionIntervalMs: DEFAULT_CONFIG.detectionIntervalMs,
    })) as {
      detectionDebounceMs?: number;
      detectionIntervalMs?: number;
    };
    const intervalMs =
      config.detectionIntervalMs ?? DEFAULT_CONFIG.detectionIntervalMs;
    const debounceMs = Math.min(
      config.detectionDebounceMs ?? DEFAULT_CONFIG.detectionDebounceMs,
      intervalMs / 2,
    );

    checkStreamingFrameworks();
    interceptMediaSource();
    monitorMediaElements();
    monitorDOMChanges();

    // Periodic media element scan with configurable interval
    const debouncedMediaScan = debounce(() => {
      monitorMediaElements();
    }, debounceMs);

    setInterval(() => {
      debouncedMediaScan();
    }, intervalMs);
  }

  /**
   * Inject hover panel button on all pages (if enabled)
   */
  async function injectHoverPanel() {
    // Only inject once
    if (document.getElementById('streamonio-toggle-btn')) return;

    // Check if hover panel is enabled in settings
    const config = (await browser.storage.sync.get({
      enableHoverPanel: false,
    })) as { enableHoverPanel?: boolean };
    if (!config.enableHoverPanel) {
      logger.info('Hover panel disabled in settings, skipping injection');
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'streamonio-hover-frame';
    iframe.allow = 'clipboard-write'; // Required for Clipboard API in iframe (Chrome)

    // Counter-scale for pages without viewport meta tag.
    // Without meta: layout is ~980px but displayed in 360px physical → elements appear smaller.
    // Scale up by (innerWidth / screen.width) to maintain consistent physical size.
    // Only apply on mobile (layoutScale > 1.1) - on desktop this ratio is < 1 which would
    // incorrectly enlarge the iframe beyond the window.
    const layoutScale = window.innerWidth / screen.width;
    const needsScale = layoutScale > 1.1;
    iframe.src = browser.runtime.getURL('dist/hover-pane.html');
    const getViewportSize = () => ({
      width: screen.width, // Physical width (unscaled)
      height: needsScale
        ? (window.visualViewport?.height ?? window.innerHeight) / layoutScale
        : (window.visualViewport?.height ?? window.innerHeight),
    });

    const vp = getViewportSize();
    const targetPhysicalWidth = 324; // Physical pixels on mobile
    const maxWidth = Math.min(targetPhysicalWidth, Math.floor(vp.width * 0.9));
    const height = vp.height;

    // Use CSS zoom to scale iframe up - unlike transform, zoom affects both
    // visual appearance AND event coordinates, making buttons clickable.
    const zoomValue = needsScale ? layoutScale : 1;
    iframe.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: ${maxWidth}px;
      height: ${height}px;
      border: none;
      z-index: 999999;
      zoom: ${zoomValue};
      transform: translateX(100%);
      transform-origin: top right;
      transition: transform 0.3s ease-in-out;
      box-shadow: -4px 0 12px rgba(0,0,0,0.3);
    `;

    document.body.appendChild(iframe);
    logger.debug('Hover panel iframe injected');

    // Update iframe size on viewport resize (handles device rotation etc.)
    const updateIframeSize = () => {
      const v = getViewportSize();
      iframe.style.width = `${Math.min(400, Math.floor(v.width * 0.9))}px`;
      iframe.style.height = `${v.height}px`;
    };
    window.addEventListener('resize', updateIframeSize);
    window.visualViewport?.addEventListener('resize', updateIframeSize);

    // Toggle function shared by button and iframe close
    const togglePanel = (forceClose = false) => {
      const isVisible = !iframe.style.transform.includes('translateX(100%)');
      const shouldHide = forceClose || isVisible;
      iframe.style.transform = shouldHide
        ? 'translateX(100%)'
        : 'translateX(0)';
      // Button stays fixed, no transform needed
    };

    // Listen for close message from iframe
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'CLOSE_HOVER_PANEL') {
        togglePanel(true);
      }
    });

    // Add toggle button - rhomboid shape pinned to right edge
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'streamonio-toggle-btn';
    toggleBtn.innerHTML = '🎵';
    toggleBtn.title = 'Toggle Streamonio panel';
    // Scale button using layoutScale for consistent physical size across viewport meta variations
    const btnWidth = Math.round(32 * layoutScale);
    const btnHeight = Math.round(56 * layoutScale);
    const btnTop = Math.round(72 * layoutScale);
    const btnFontSize = Math.round(18 * layoutScale);
    toggleBtn.style.cssText = `
      position: fixed;
      top: ${btnTop}px;
      right: 0;
      width: ${btnWidth}px;
      height: ${btnHeight}px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px 0 0 8px;
      font-size: ${btnFontSize}px;
      cursor: pointer;
      box-shadow: -2px 2px 8px rgba(102, 126, 234, 0.4);
      z-index: 1000001;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transform: translateY(-50%);
      clip-path: polygon(0 0, 100% 20%, 100% 80%, 0 100%);
    `;

    const btnWidthHover = Math.round(40 * layoutScale);
    toggleBtn.addEventListener('mouseenter', () => {
      toggleBtn.style.width = `${btnWidthHover}px`;
      toggleBtn.style.boxShadow = '-4px 4px 12px rgba(102, 126, 234, 0.6)';
    });

    toggleBtn.addEventListener('mouseleave', () => {
      toggleBtn.style.width = `${btnWidth}px`;
      toggleBtn.style.boxShadow = '-2px 2px 8px rgba(102, 126, 234, 0.4)';
    });

    toggleBtn.addEventListener('click', () => togglePanel());

    document.body.appendChild(toggleBtn);
    logger.debug('Toggle button added');
  }

  function initialize() {
    logger.info('Page script initialized at', window.location.href);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        startDetection();
        // Hover panel button now injected only when first stream detected
      });
    } else {
      startDetection();
      // Hover panel button now injected only when first stream detected
    }
  }

  initialize();
})();
