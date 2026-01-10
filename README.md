# 🎵 *Streamonio*

A cross-browser extension to extract streaming media URLs
(podcasts, radio stations, live streams) and send to HTTP API endpoint(s).

**Platform**: Works on desktop browsers (Firefox, Chrome, Chromium) and
on *mobile Firefox Nightly*.

## Features

- 🔍 **Page Stream Detection** - Detects HLS, DASH, MP3, AAC, OGG, RTMP,
  RTSP, Icecast, Shoutcast
  from the current page, internal iframes & shadowDOMs.
- 📡 **Configurable Endpoints** - Define multiple API endpoints with template placeholders, export & import bluprints from files or sites
- 🌐 **Two API call Modes** - "Open in Tab" (GET via navigation or POST/PUT/DELETE via form submission - bypasses CORS), "Call API" (`fetch` HTTP request with full control: custom headers, body templates, programmatic response handling)
- 🔔 **Badge Notifications** - Shows number of detected streams on the
  extension icon (including '0' when no streams).


## Installation

### From Source (Development)

1. Clone or download this repository (folder slug: `streamonio`)
2. Install deps (TypeScript build):

  ```bash
  npm install
  npm run build
  ```

#### Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Navigate to the extension folder and select the `manifest.json` file
  (expects built assets in `dist/`)

#### Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Navigate to and select the extension folder (containing `manifest.json`)

#### Icon Generation

Generate icons by opening `icons/generate-icons.html` in a browser and
downloading them (only needed if you change the icon)

### For Production

Build and package (includes dist + manifest + icons):
```bash
npm run build
zip -r streamonio.zip manifest.json dist icons -x "icons/generate-icons.html"
```

**Single package works for both browsers!** The same `.zip` can be submitted to:
- [Firefox Add-ons](https://addons.mozilla.org/)
- [Chrome Web Store](https://chrome.google.com/webstore/devconsole/)

Chrome ignores the Firefox-specific `browser_specific_settings` section in the manifest.

### Mobile Installation

See [MOBILE_TESTING.md](MOBILE_TESTING.md)

## Usage

### 1. Configure API Endpoints

1. Click the *Streamonio* icon in your browser toolbar
2. Click the "⚙️ Options" button
3. Define one or more API endpoints (exported as a JSON array)
4. Click "💾 Save Settings"
5. Click "🧪 Test API" to verify the connection

The **url** & **body** endpoint fields support those *placeholders*:

- `{{streamUrl}}` - The detected stream URL
- `{{pageUrl}}`   - The webpage URL where the stream was found
- `{{pageTitle}}` - The webpage title
- `{{timestamp}}` - Current timestamp in ISO format

Placeholders are *case-insensitive* and support 2 jinja-like filters eg. `{{streamUrl | url }}`:

- `url` - URL-encoded stream URL
- `json` - JSON-encoded value


### 2. Detect Streams & call API endpoint

1. Navigate to any website with streaming media (e.g., online radio, podcast player).
2. The extension will automatically detect streams and on its icon
   a badge will appear showing the number of detected streams
   ("pin" it to always view the badge).
3. Click the extension icon to view all detected streams.
4. Select the desired API Endpoint (pre-configured earlier in the _options_).
5. Choose action:
   - **📤 Call API** - Send HTTP request (fetch) with full control over headers/body. Receives programmatic response, shows success/error in log.
   - **🌐 Open in Tab** - Open URL in new browser tab. GET/HEAD uses simple navigation, POST/PUT/DELETE uses form submission to bypass CORS and sen. Useful for HTML-returning services where you want to see the rendered page.

**Zero-Stream Mode**: Even when no streams are detected, the extension remains
functional. The badge shows '0' and you can still call endpoints using page URL/title
placeholders (`{{pageUrl}}`, `{{pageTitle}}`).
Consider naming your endpoints clearly in these cases
(e.g., "Bookmark Page", "Send to Wallabag") to distinguish page-only
endpoints from stream-dependent ones.

#### Supported Stream Types

- **HLS** - HTTP Live Streaming (.m3u8)
- **DASH** - Dynamic Adaptive Streaming over HTTP (.mpd)
- **HTTP Audio** - Direct audio files (MP3, AAC, OGG, FLAC, WAV, M4A, WMA)
- **RTMP** - Real-Time Messaging Protocol
- **RTSP** - Real-Time Streaming Protocol
- **Icecast/Shoutcast** - Internet radio streaming protocols
- **Playlist formats** - M3U, PLS, ASX


## Development

### Project Structure

```
streamonio/
├── manifest.json             # Extension manifest (cross-browser)
├── tsconfig.json             # TypeScript configuration
├── package.json              # Node.js dependencies & scripts
├── biome.json                # Linting & formatting config
├── README.md                 # This file
├── CHANGES.md                # Version history
├── LICENSE.txt               # GPL-3.0 license
├── popup-pane.html           # Popup UI
├── options-pane.html         # Options page UI
├── hover-pane.html           # In-page overlay UI (mobile)
├── src/                      # TypeScript sources
│   ├── browser-api.ts        # Cross-browser API shim
│   ├── broker.ts             # Background service worker/script
│   ├── page.ts               # Content script (stream detection)
│   ├── popup-pane.ts         # Popup pane logic
│   ├── options-pane.ts       # Options page logic
│   ├── hover-pane.ts         # Hover panel logic (mobile)
│   ├── endpoint.ts           # Endpoint config & API calls
│   ├── detect.ts             # Stream detection patterns
│   ├── logger.ts             # Logging infrastructure
│   ├── logger-ui.ts          # Logger UI rendering
│   ├── components-ui.ts      # Shared UI components
│   ├── debounce.ts           # Debounce utility
├── dist/                     # Build output compiled .ts -> .js
│   └── build-info.json       # Build metadata (generated)
├── icons/                    # Extension icons
│   └── generate-icons.html   # Icon generator (not packaged)
├── scripts/                  # Build scripts
│   └── gen-build-info.js     # Generates build-info.json
├── tests/                    # Test suite
│   ├── unit/                 # Unit tests (node --test + tsx)
│   │   ├── *.test.ts         # Test files
│   └── integration/          # Integration tests (web-ext)
│       ├── *.js              # Test scripts
│       ├── test-config.json  # Test configuration
│       ├── test-helper.js    # Test utilities
│       ├── TESTS.md          # Test documentation
│       └── README.md         # Integration test guide
├── notes/                    # Design & planning for AI
└── .github/
    └── copilot-instructions.md  # AI assistant guidelines
```

## Testing

### Unit-like checks (templating)

- Install deps and run the TypeScript tests:
  ```bash
  npm install
  npm test
  ```
- Covers placeholder interpolation, missing-key handling, and `url`/`json`
  filters.

### Integration tests

- Run full integration tests with Firefox:
  ```bash
  npm run test:integration
  ```
- Uses web-ext to launch Firefox and test real extension behavior

### Code Quality

The project uses Biome for linting/formatting, jscpd for duplication detection, and ts-prune for dead code analysis:

```bash
npm run lint         # Check code style and errors
npm run lint:fix     # Auto-fix safe linting issues
npm run format       # Format all files
npm run dupes        # Detect code duplication
npm run dead-code    # Find unused exports
```

### Live testing

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Load the extension

**Chrome:**
1. Open `chrome://extensions/`
2. Load the extension

**Test sites:**
   - BBC iPlayer Radio
   - TuneIn Radio
   - Any podcast website
   - YouTube (some streams may be detected)
   - [ERP Trito](https://www.ertecho.gr/radio/trito/)
   - [Lifegate radio](https://www.lifegate.it/lifegate-radio)

## Architecture & Terminology

The extension architecture revolves around six core concepts that work together in a message-driven flow:

| Concept | 🎯 What | 📍 Where | 🔧 Purpose |
|---------|---------|----------|------------|
| **Detection Patterns** | Regex for stream URLs | `STREAM_PATTERNS` in `detect.ts` | • Match streaming media URLs<br>• Built-in, not user-configurable<br>• Tested via `content.test.ts` |
| **Streams** | Detected URLs + metadata + classification | `StreamInfo` in `broker.ts` | • Store detected media per tab<br>• Typed as HLS, DASH, MP3, RTMP, etc.<br>• Include page context + timestamp |
| **API Endpoints** | User-configured HTTP targets | `storage.sync.apiEndpoints`, `config.ts` | • Webhooks/APIs for detected streams<br>• Support templating<br>• Fully customizable |
| **Interpolation Templates** | Placeholder strings | Endpoint/body templates | • Dynamic value insertion<br>• `{{streamUrl}}`, `{{pageUrl}}`, `{{pageTitle}}`, `{{timestamp}}` |
| **Execution Contexts** | Isolated JavaScript environments | Page context vs Extension context | • Content script runs in page context<br>• Broker/popup run in extension context<br>• Cannot share variables/functions<br>• Communication only via messages |
| **Runtime Messages** | Cross-component IPC | `RuntimeMessage` type | • `STREAM_DETECTED` (page→broker), `GET_STREAMS` (popup→broker)<br>• `CALL_API` (hover→broker), `OPEN_IN_TAB` (hover→broker)<br>• `GET_ENDPOINTS` (hover→broker), `OPEN_OPTIONS` (any→broker)<br>• `CLOSE_HOVER_PANEL` (hover→page), `PING` (any→broker) |

### 1. Detection Patterns
- **What**: Regular expression patterns (`STREAM_PATTERNS`) that match known streaming media URLs
- **Where**: Defined in `src/detect.ts` (separate from `page.ts` for modularity, reuse, and stateless testability)
- **Purpose**: Page script uses them to identify stream URLs (HLS, DASH, MP3, RTMP, Icecast, etc.)
- **Examples**: `/\.(m3u8|mpd)/i`, `/rtmp:/`, `/icecast|shoutcast/i`
- **Not configurable by users** — built-in to the extension
- **Testing**: Validated via `tests/unit/content.test.ts` (detection patterns and stream type classification)

### 2. Streams
- **What**: Detected media URLs with metadata (`StreamInfo`) and classification labels
- **Where**: `StreamInfo` type in `src/broker.ts`; `getStreamType()` in `src/detect.ts`
- **Purpose**: Store detected streaming resources with type (HLS, DASH, HTTP Audio, RTMP, Icecast/Shoutcast), page context, and timestamp
- **Examples**: `{ url: "https://example.com/live.m3u8", type: "HLS", pageUrl: "...", timestamp: 1234567890 }`

### 3. API Endpoints
- **What**: HTTP targets where detected stream URLs are sent
- **Where**: Configured in options page, stored as JSON in `browser.storage.sync.apiEndpoints`
- **Structure**: Name, URL template, HTTP method, headers, optional body template
- **Purpose**: Each endpoint is a webhook/API target the user defines (e.g., their own webhook, httpbin for testing)
- **Examples**:
  ```json
  {
    "name": "My API",
    "endpointTemplate": "https://api.example.com/stream",
    "method": "POST",
    "bodyTemplate": "{\"url\":\"{{streamUrl}}\",\"timestamp\":\"{{timestamp}}\"}"
  }
  ```
- **Fully customizable by users** in the options page

### 4. Interpolation Templates
- **What**: Strings in `endpointTemplate` and `bodyTemplate` that contain placeholders like `{{streamUrl}}`
- **Where**: Defined as endpoint field values; processed by `src/template.ts`
- **Purpose**: Allow dynamic values (stream URL, page title, timestamp) to be inserted at API call time
- **Available placeholders**: `{{streamUrl}}`, `{{pageUrl}}`, `{{pageTitle}}`, `{{timestamp}}`
- **Error handling**: "Interpolation error" occurs when a placeholder is undefined or malformed
- **Examples**:
  - Endpoint template: `https://api.example.com/notify?url={{streamUrl}}`
  - Body template: `{"stream":"{{streamUrl}}","detected":"{{timestamp}}"}`

### 5. Execution Contexts
- **What**: Isolated JavaScript environments where extension code runs
- **2 contexts**:
  1. **Page Context** (`page.ts`): Runs inside the webpage DOM,
     it has access to page resources (images, media, scripts) but **isolated memory** from extension
  2. **Extension Context** (`broker.ts`, `popup.ts`, `options.ts`):
     Runs in browser's extension sandbox, has access to `browser.*` APIs, storage, and network requests
- **Why it matters**: Content scripts cannot directly call functions in broker/popup or access their variables — they are in **separate JavaScript worlds**
- **Root cause of messages**: This isolation is why `browser.runtime.sendMessage()` exists — it's the **only way** to pass data between contexts
- **Security benefit**: Page scripts cannot access extension internals (API keys, stored endpoints, etc.)
- **Common pitfall**: Trying to `import` shared utilities in both contexts requires careful module design (e.g., `detect.ts` exports pure functions usable in both)

### 6. Runtime Messages
- **What**: Cross-component communication protocol via `browser.runtime.sendMessage()`
- **Where**: `RuntimeMessage` type in `src/types.ts`
- **Purpose**: Message-passing between page script (page context), broker worker, and popup (extension context)

#### Message Types

- `STREAM_DETECTED` (content → broker): Reports a newly detected stream URL with its type
- `GET_STREAMS` (popup → broker): Requests all streams for the current tab
- `CALL_API` (hover → broker): Triggers API call from page context (popup/options call `callEndpoint()` directly)
- `OPEN_IN_TAB` (hover → broker): Opens endpoint in new tab from page context (popup/options call endpoint function directly)
- `GET_ENDPOINTS` (hover → broker): Requests configured API endpoints list from storage
- `OPEN_OPTIONS` (any → broker): Opens extension options page in new tab
- `CLOSE_HOVER_PANEL` (hover → page): Closes hover panel overlay (uses `postMessage`, not `runtime.sendMessage`)
- `PING` (any → broker): Health check to verify broker worker is alive


## Privacy

*Streamonio*:
- Only sends data to **your configured API endpoint**
- Does not track browsing history, neither collect or transmit data to 3rd parties
- Stores configuration locally in Firefox sync storage

### Permissions

The extension requires the following permissions:

- `storage` - Save API endpoint configuration and detection settings
- `activeTab` - Access current tab information (URL, title) for placeholders
- `webRequest` - Monitor network requests to detect streaming media URLs
- `cookies` - Include cookies in API calls when configured (optional feature)
- `<all_urls>` (host_permissions) - Detect streams on any website you visit

All permissions are used only for the extension's core functionality. See [PRIVACY.md](PRIVACY.md) for details on data handling.

## Inspiration

This extension is my scratch reply for the itch of by Chromecast not working
in my home's WiiM Ultra music system, coupled with my curiosity for Claude's vibe coding,
TypoScript, and my [liberation talk](https://ankostis.io/data-liberation-talk/slides/).

Claude's inspiration list:
- **stream-recorder** - For stream detection techniques
- **stream-bypass** - For handling various streaming protocols

## License

GPLv3 License - See LICENSE file for details.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request
5. AI vibe-coding endorsed only with elaborate commit message (and notes/*);  see also Testing & Code Quality above.

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for solutions

Made for the ❤️ music, by the gift of Sonnet 4.5.
