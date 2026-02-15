/**
 * Configuration and templating utilities for Streamonio
 * Centralized endpoint parsing, validation, normalization, and template interpolation
 */

import browser from './browser-api.js';
import type { Logger } from './logger';
import type { StreamInfo } from './types';

export type ApiEndpoint = {
  name: string;
  endpointTemplate: string;
  description?: string;
  method?: string;
  headers?: Record<string, string>;
  bodyTemplate?: string;
  contentType?: string;
  username?: string;
  password?: string;
  bearerToken?: string;
  includeCookies?: boolean;
  includePageHeaders?: boolean;
  lastUsedAt?: number;
};

/**
 * Default configuration with demo endpoints (blueprints)
 * Single source of truth for built-in endpoints
 * Built-ins are identified by name prefix 'httpbingo'
 */
export const DEFAULT_CONFIG = {
  enableHoverPanel: false,
  detectionDebounceMs: 1000,
  detectionIntervalMs: 3000,
  userVars: JSON.stringify(
    {
      WiiM: '192.168.1.100',
    },
    null,
    2,
  ),
  apiEndpoints: JSON.stringify(
    [
      {
        name: 'WiiM play',
        description:
          'WiiM streamers support a GET API call that can play arbitrary streams, see PDF: https://www.wiimhome.com/pdf/HTTP%20API%20for%20WiiM%20Mini.pdf',
        endpointTemplate:
          'https://{{WiiM}}/httpapi.asp?command=setPlayerCmd:play:{{streamUrl}}',
        method: 'GET',
      },
      {
        name: 'WiiM status',
        description: 'Get WiiM device status',
        endpointTemplate: 'https://{{WiiM}}/httpapi.asp?command=getStatusEx',
        method: 'GET',
      },
      {
        name: 'httpbingo',
        description: 'Simple GET request to just test the call ',
        endpointTemplate: 'https://httpbingo.org/anything',
        method: 'GET',
      },
      {
        name: 'httpbingo POST + auth',
        description: 'Example with Basic authentication (username/password)',
        endpointTemplate: 'https://httpbingo.org/anything',
        method: 'POST',
        contentType: 'application/json',
        username: 'user',
        password: 'pass',
        bodyTemplate:
          '{"streamUrl":"{{streamUrl}}","seekPosition":{{seekTimeSecs}}}',
      },
      {
        name: 'httpbingo Bearer token',
        description: 'Example with Bearer token authentication',
        endpointTemplate: 'https://httpbingo.org/anything',
        method: 'POST',
        contentType: 'application/json',
        bearerToken: 'your-token-here',
        bodyTemplate: '{"streamUrl":"{{streamUrl}}","pageUrl":"{{pageUrl}}"}',
      },
    ],
    null,
    2,
  ),
} as const;

/**
 * Get built-in blueprint endpoints from DEFAULT_CONFIG
 */
export function getBuiltInEndpoints(): ApiEndpoint[] {
  return parseEndpoints(DEFAULT_CONFIG.apiEndpoints);
}

/**
 * Suggest an endpoint name from an endpoint URL (extract hostname)
 * Example: https://api.example.com/stream → api.example.com
 */
export function suggestEndpointName(endpointUrl: string): string {
  try {
    const url = new URL(endpointUrl);
    return url.hostname || 'API Endpoint';
  } catch {
    // Fallback if URL is invalid
    return endpointUrl.substring(0, 30).replace(/[^a-z0-9.-]/gi, '');
  }
}

/**
 * Parse raw JSON string into validated ApiEndpoint array
 * Requires name field; enforces uniqueness by name
 * Throws on invalid JSON or invalid endpoint structure
 */
export function parseEndpoints(raw: string): ApiEndpoint[] {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('API endpoints must be a JSON array.');
  }

  const names = new Set<string>();
  return parsed
    .map((p) => ({
      name: p.name || suggestEndpointName(p.endpointTemplate),
      endpointTemplate: p.endpointTemplate,
      description: p.description,
      method: p.method,
      headers: p.headers,
      bodyTemplate: p.bodyTemplate,
      contentType: p.contentType,
      username: p.username,
      password: p.password,
      bearerToken: p.bearerToken,
      includeCookies: p.includeCookies,
      includePageHeaders: p.includePageHeaders,
      lastUsedAt: p.lastUsedAt,
    }))
    .filter((p) => {
      // Require endpoint and unique name
      if (
        typeof p.endpointTemplate !== 'string' ||
        p.endpointTemplate.length === 0 ||
        !p.name ||
        names.has(p.name)
      ) {
        return false;
      }
      names.add(p.name);
      return true;
    });
}

/**
 * Sort endpoints by Most Recently Used (MRU)
 * Endpoints with lastUsedAt are sorted first (most recent first), then never-used endpoints alphabetically
 */
export function sortEndpointsByMRU(endpoints: ApiEndpoint[]): ApiEndpoint[] {
  return [...endpoints].sort((a, b) => {
    const aUsed = a.lastUsedAt ?? 0;
    const bUsed = b.lastUsedAt ?? 0;

    // Both used: sort by timestamp (most recent first)
    if (aUsed > 0 && bUsed > 0) {
      return bUsed - aUsed;
    }

    // Only one used: used endpoint comes first
    if (aUsed > 0) return -1;
    if (bUsed > 0) return 1;

    // Neither used: alphabetical by name
    return a.name.localeCompare(b.name);
  });
}

/**
 * Load endpoints from storage or use provided array
 * @throws Error with message on parse failure
 */
async function loadEndpoints(
  apiEndpoints?: ApiEndpoint[],
): Promise<ApiEndpoint[]> {
  if (apiEndpoints) return apiEndpoints;

  const defaults = { apiEndpoints: '[]' } as const;
  const config = (await browser.storage.sync.get(defaults)) as typeof defaults;
  try {
    return parseEndpoints(config.apiEndpoints);
    // biome-ignore lint/suspicious/noExplicitAny: Standard error handling pattern
  } catch (parseError: any) {
    throw new Error(
      `Failed to parse API endpoints: ${parseError?.message ?? 'Unknown error'}`,
    );
  }
}

/**
 * Load user-defined variables from storage
 * Returns empty object if not found or parse fails
 */
export async function loadUserVars(): Promise<Record<string, string>> {
  const defaults = { userVars: '{}' } as const;
  const config = (await browser.storage.sync.get(defaults)) as typeof defaults;
  try {
    const parsed = JSON.parse(config.userVars);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Save user-defined variables to storage
 */
export async function saveUserVars(
  vars: Record<string, string>,
): Promise<void> {
  await browser.storage.sync.set({ userVars: JSON.stringify(vars, null, 2) });
}

/**
 * Validate user variable key format
 * Keys must be alphanumeric + underscore only
 */
export function validateUserVarKey(key: string): {
  valid: boolean;
  error?: string;
} {
  if (!key || key.trim().length === 0) {
    return { valid: false, error: 'Key cannot be empty' };
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
    return {
      valid: false,
      error:
        'Key must start with letter/underscore, contain only alphanumeric and underscore',
    };
  }
  return { valid: true };
}

/**
 * Detect conflicts between user variables and built-in placeholders
 * Returns array of conflicts (empty if none)
 */
export function detectUserVarConflicts(
  userVars: Record<string, string>,
): Array<{ key: string; conflict: string }> {
  const builtInPlaceholders = [
    'streamUrl',
    'streamType',
    'pageUrl',
    'pageTitle',
    'seekTimeSecs',
  ];
  const conflicts: Array<{ key: string; conflict: string }> = [];

  for (const key of Object.keys(userVars)) {
    const lowerKey = key.toLowerCase();
    const builtIn = builtInPlaceholders.find(
      (p) => p.toLowerCase() === lowerKey,
    );
    if (builtIn) {
      conflicts.push({ key, conflict: builtIn });
    }
  }

  return conflicts;
}

/**
 * Generate unique name by appending counter (-2, -3, etc.)
 * Reused for both endpoints and user variables
 */
export function generateUniqueName(
  baseName: string,
  existingNames: string[],
  separator = '-',
): string {
  const existingSet = new Set(existingNames);
  let uniqueName = baseName;
  let counter = 2;

  while (existingSet.has(uniqueName)) {
    uniqueName = `${baseName}${separator}${counter}`;
    counter++;
  }

  return uniqueName;
}

/**
 * Preview an API endpoint call and log the formatted request details.
 * Unified function used by popup and options panels.
 */
export async function previewCall(
  stream: StreamInfo,
  endpointName: string | undefined,
  apiEndpoints: ApiEndpoint[] | undefined,
  logger: { info: (message: string, ...args: unknown[]) => void },
): Promise<void> {
  try {
    const [endpoints, userVars] = await Promise.all([
      loadEndpoints(apiEndpoints),
      loadUserVars(),
    ]);
    const endpoint = endpointName
      ? endpoints.find((ep) => ep.name === endpointName)
      : endpoints[0];

    if (!endpoint) {
      logger.info(
        'No API endpoints configured. Please add an endpoint in the extension options.',
      );
      return;
    }

    const finalUrl = applyTemplate(endpoint.endpointTemplate, stream, userVars);
    const body = endpoint.bodyTemplate
      ? applyTemplate(endpoint.bodyTemplate, stream, userVars)
      : JSON.stringify(stream, null, 2);

    const preview = [
      `Endpoint: ${endpoint.name}`,
      `URL: ${finalUrl}`,
      `Method: ${(endpoint.method || 'POST').toUpperCase()}`,
      '',
      `Headers: ${JSON.stringify(endpoint.headers || {}, null, 2)}`,
      '',
      `Body:`,
      body,
    ].join('\n');

    logger.info(preview, { endpoint, stream });
    // biome-ignore lint/suspicious/noExplicitAny: Standard error handling
  } catch (error: any) {
    logger.info(`Preview failed: ${error?.message ?? 'Unknown error'}`);
  }
}

/**
 * Validate and normalize raw JSON string into formatted array
 * Returns validation result with parsed endpoints, formatted JSON, and error message if invalid
 */
export function validateEndpoints(raw: string): {
  valid: boolean;
  parsed: ApiEndpoint[];
  formatted: string;
  errorMessage?: string;
} {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return {
        valid: false,
        parsed: [],
        formatted: '[]',
        errorMessage: 'API endpoints must be a JSON array.',
      };
    }

    const names = new Set<string>();
    const cleaned = parsed
      .map((p: unknown, index: number) => {
        const parsed = p as Record<string, unknown>;
        if (
          !p ||
          typeof parsed.endpointTemplate !== 'string' ||
          !parsed.endpointTemplate.trim()
        ) {
          throw new Error(
            `Endpoint ${index + 1} is missing an endpointTemplate.`,
          );
        }
        const name =
          (parsed.name as string) ||
          suggestEndpointName(parsed.endpointTemplate);
        if (names.has(name)) {
          throw new Error(
            `Duplicate endpoint name: "${name}" (Endpoint ${index + 1})`,
          );
        }
        names.add(name);
        return {
          name,
          endpointTemplate: parsed.endpointTemplate as string,
          description: (parsed.description as string) || undefined,
          method: (parsed.method as string) || 'GET',
          headers: (parsed.headers as Record<string, string>) || undefined,
          bodyTemplate: (parsed.bodyTemplate as string) || undefined,
          contentType: (parsed.contentType as string) || undefined,
          username: (parsed.username as string) || undefined,
          password: (parsed.password as string) || undefined,
          bearerToken: (parsed.bearerToken as string) || undefined,
          includeCookies: (parsed.includeCookies as boolean) || false,
          includePageHeaders: (parsed.includePageHeaders as boolean) || false,
          lastUsedAt: (parsed.lastUsedAt as number) || undefined,
        };
      })
      .filter(Boolean);

    return {
      valid: true,
      parsed: cleaned,
      formatted: JSON.stringify(cleaned, null, 2),
    };
  } catch (e) {
    return {
      valid: false,
      parsed: [],
      formatted: '[]',
      errorMessage: e?.message,
    };
  }
}

/**
 * Apply template with placeholder interpolation
 * Supports {{placeholder}}, {{placeholder|url}}, {{placeholder|json}}
 * Case-insensitive placeholder matching
 * Merges optional userVars with context (userVars have lower priority)
 */
export function applyTemplate(
  template: string,
  context: StreamInfo,
  userVars?: Record<string, string>,
  options: { onMissing?: 'leave' | 'empty' | 'throw' } = { onMissing: 'leave' },
): string {
  const onMissing = options.onMissing ?? 'leave';
  const placeholderRe = /\{\{(\w+)(?:\|(url|json))?\}\}/gi;

  // Merge userVars and context with case-insensitive keys (context overrides userVars)
  const normalizedUserVars = userVars
    ? Object.fromEntries(
        Object.entries(userVars).map(([k, v]) => [k.toLowerCase(), v]),
      )
    : {};
  const normalizedContext = Object.fromEntries(
    Object.entries(context).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const merged = { ...normalizedUserVars, ...normalizedContext };

  const encodeJsonString = (val: unknown) => JSON.stringify(String(val));
  const applyFilter = (val: unknown, filter?: 'url' | 'json') => {
    if (filter === 'url') return encodeURIComponent(String(val ?? ''));
    if (filter === 'json') return encodeJsonString(val);
    return String(val ?? '');
  };

  return template.replace(
    placeholderRe,
    (_m, key: string, filter?: 'url' | 'json') => {
      const value = merged[key.toLowerCase()];
      const hasValue = value !== undefined && value !== null;
      if (!hasValue) {
        if (onMissing === 'empty') return '';
        if (onMissing === 'throw')
          throw new Error(`Missing placeholder: ${key}`);
        return `{{${key}${filter ? `|${filter}` : ''}}}`;
      }
      return applyFilter(value, filter);
    },
  );
}

/**
 * Call API endpoint or open in tab with stream information
 * Handles template interpolation, headers, cookies, and HTTP methods
 *
 * @param mode - 'fetch' for HTTP request, 'tab' to open URL in browser tab
 * @param apiEndpoints - Optional override for endpoints (used by options page for testing)
 * Returns success/error result with detailed error messages
 */
export async function callEndpoint({
  mode,
  stream,
  endpointName,
  tabHeaders,
  apiEndpoints,
  logger,
}: {
  mode: 'fetch' | 'tab';
  stream: StreamInfo;
  endpointName?: string;
  tabHeaders?: Record<string, string>;
  apiEndpoints?: ApiEndpoint[];
  logger: Logger;
}) {
  try {
    // Load endpoints and user variables
    const [endpoints, userVars] = await Promise.all([
      loadEndpoints(apiEndpoints),
      loadUserVars(),
    ]);
    const selectedEndpoint = endpointName
      ? endpoints.find((ep) => ep.name === endpointName)
      : endpoints[0];

    if (!selectedEndpoint) {
      return {
        success: false,
        error:
          'No API endpoints configured. Please add an endpoint in the extension options.',
      };
    }

    // Interpolate templates
    const finalUrl = applyTemplate(
      selectedEndpoint.endpointTemplate,
      stream,
      userVars,
    );
    const body = selectedEndpoint.bodyTemplate
      ? applyTemplate(selectedEndpoint.bodyTemplate, stream, userVars)
      : mode === 'fetch'
        ? JSON.stringify(stream)
        : undefined;

    // Mode: open in tab
    if (mode === 'tab') {
      // Validate URL format
      try {
        new URL(finalUrl);
        // biome-ignore lint/suspicious/noExplicitAny: Standard error handling
      } catch (urlError: any) {
        logger.warn(`Invalid URL after interpolation: ${finalUrl}`, {
          endpoint: selectedEndpoint.name,
          url: finalUrl,
          error: urlError,
        });
        return {
          success: false,
          error: `Invalid URL after interpolation: ${finalUrl}`,
        };
      }

      const method = (selectedEndpoint.method || 'GET').toUpperCase();

      logger.info(`Opening URL in tab (${method}): ${selectedEndpoint.name}`, {
        endpoint: selectedEndpoint.name,
        url: finalUrl,
        method,
      });

      // For GET/HEAD or no method specified: use simple tab navigation
      if (!method || method === 'GET' || method === 'HEAD') {
        // Store tab ID in session storage for reuse by endpoint name
        const storageKey = `tabId-${selectedEndpoint.name}`;
        const stored = await browser.storage.session.get(storageKey);
        const storedTabId = stored[storageKey] as number | undefined;

        // Try to reuse the stored tab
        if (storedTabId) {
          try {
            const tab = await browser.tabs.get(storedTabId);
            if (tab) {
              await browser.tabs.update(storedTabId, {
                url: finalUrl,
                active: true,
              });
              return {
                success: true,
                message: 'Reused existing tab',
                details: finalUrl,
              };
            }
          } catch (tabError: unknown) {
            logger.warn(
              `Stored tab ${storedTabId} no longer exists, creating new tab: ${tabError instanceof Error ? tabError.message : String(tabError)}`,
            );
          }
        }

        // Create new tab and store its ID
        const newTab = await browser.tabs.create({
          url: finalUrl,
          active: true,
        });
        if (newTab.id) {
          await browser.storage.session.set({ [storageKey]: newTab.id });
        }

        return {
          success: true,
          message: `Opened URL in new tab: (${finalUrl}`,
          details: finalUrl,
        };
      }

      // For POST/PUT/DELETE: use form submission to bypass CORS
      // Create hidden form in current document, submit to named window
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = finalUrl;
      // Use consistent window name per endpoint for tab reuse
      const windowName = `streamonio-${selectedEndpoint.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
      form.target = windowName;
      form.style.display = 'none';

      // Parse body template and create hidden inputs
      if (body) {
        try {
          const bodyData = typeof body === 'string' ? JSON.parse(body) : body;
          if (typeof bodyData === 'object' && bodyData !== null) {
            Object.entries(bodyData).forEach(([key, value]) => {
              const input = document.createElement('input');
              input.type = 'hidden';
              input.name = key;
              input.value = String(value);
              form.appendChild(input);
            });
          }
          // biome-ignore lint/suspicious/noExplicitAny: Standard error handling
        } catch (parseError: any) {
          logger.warn(
            `Could not parse body as JSON for form submission: ${parseError.message}. Sending as raw field.`,
          );
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'data';
          input.value = String(body);
          form.appendChild(input);
        }
      }

      // Add method override field for PUT/DELETE
      if (method !== 'POST') {
        const methodInput = document.createElement('input');
        methodInput.type = 'hidden';
        methodInput.name = '_method';
        methodInput.value = method;
        form.appendChild(methodInput);
      }

      // Submit form to named window - browser will create/reuse window by name
      document.body.appendChild(form);
      form.submit();

      // Clean up after brief delay to ensure submission completes
      setTimeout(() => {
        if (form.parentNode) {
          document.body.removeChild(form);
        }
      }, 100);

      return {
        success: true,
        message: `Opened URL in tab via ${method} form submission`,
        details: `${finalUrl} (window: ${windowName})`,
      };
    }

    // Mode: fetch (HTTP request)
    const method = (selectedEndpoint.method || 'POST').toUpperCase();
    let headers: Record<string, string> = {
      'Content-Type': selectedEndpoint.contentType || 'application/json',
    };
    if (selectedEndpoint.headers) {
      headers = { ...headers, ...selectedEndpoint.headers };
    }

    // Add authentication headers
    if (selectedEndpoint.bearerToken) {
      headers.Authorization = `Bearer ${selectedEndpoint.bearerToken}`;
    } else if (selectedEndpoint.username && selectedEndpoint.password) {
      const credentials = btoa(
        `${selectedEndpoint.username}:${selectedEndpoint.password}`,
      );
      headers.Authorization = `Basic ${credentials}`;
    }

    // Add cookies to headers if flag is enabled
    if (selectedEndpoint.includeCookies && stream.pageUrl) {
      try {
        const cookies = await browser.cookies.getAll({ url: stream.pageUrl });
        if (cookies.length > 0) {
          const cookieHeader = cookies
            .map((c) => `${c.name}=${c.value}`)
            .join('; ');
          headers.Cookie = cookieHeader;
        }
        // biome-ignore lint/suspicious/noExplicitAny: Standard error handling
      } catch (cookieError: any) {
        logger.warn(`Failed to get cookies: ${cookieError}`, {
          pageUrl: stream.pageUrl,
          cookieError,
        });
      }
    }

    // Add page headers if flag is enabled
    if (selectedEndpoint.includePageHeaders && tabHeaders) {
      for (const [key, value] of Object.entries(tabHeaders)) {
        if (!(key in headers)) {
          headers[key] = value;
        }
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = body;
    }
    logger.info(`API Request: ${selectedEndpoint.name}: ${method} ${finalUrl}`);
    // Log actual HTTP request details in debug.
    logger.debug(
      [
        `=== HTTP Request: ${selectedEndpoint.name} ===`,
        `${method} ${finalUrl}`,
        '',
        'Headers:',
        JSON.stringify(headers, null, 2),
        '',
        'Body:',
        fetchOptions.body || '(none)',
        'Context:',
        stream,
      ].join('\n'),
    );

    const response = await fetch(finalUrl, fetchOptions);

    if (!response.ok) {
      let errorDetail = response.statusText;
      let errorBody = '';
      try {
        errorBody = await response.text();
        if (errorBody && errorBody.length < 500) {
          errorDetail = errorBody;
        }
      } catch {
        // Ignore if we can't read error body
      }
      logger.error(
        `API Error Response: ${response.status} ${response.statusText}`,
        {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(
            Array.from(
              response.headers as unknown as Iterable<[string, string]>,
            ),
          ),
          body:
            errorBody.substring(0, 500) + (errorBody.length > 500 ? '...' : ''),
        },
      );
      throw new Error(`API returned ${response.status}: ${errorDetail}`);
    }

    const result = await response.text();
    logger.info(
      `API Success Response: ${response.status} ${response.statusText}`,
      {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(
          Array.from(response.headers as any as Iterable<[string, string]>),
        ),
        body: result.substring(0, 500) + (result.length > 500 ? '...' : ''),
      },
    );

    return {
      success: true,
      message: `${response.status} ${response.statusText}`,
      status: response.status,
      response: result,
    };
    // biome-ignore lint/suspicious/noExplicitAny: Standard error handling
  } catch (error: any) {
    const action = mode === 'tab' ? 'open URL' : 'API call';
    logger.error(`${action} failed: ${error?.message ?? 'Unknown error'}`, {
      error,
    });

    let errorMsg = error?.message ?? 'Unknown error';
    if (
      mode === 'fetch' &&
      (errorMsg.includes('NetworkError') || errorMsg.includes('fetch'))
    ) {
      errorMsg += ` (Check: 1) Server is reachable, 2) CORS/host permissions, 3) HTTP vs HTTPS)`;
    }

    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Format response body as indented JSON
 */
export function formatResponseBody(response: any): string {
  try {
    const parsed =
      typeof response === 'string' ? JSON.parse(response) : response;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(response);
  }
}
