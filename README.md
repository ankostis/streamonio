# 🎵 *Streamonio*

A cross-browser extension (Firefox & Chrome) to extract streaming media URLs
(podcasts, radio stations, live streams) and send to HTTP API endpoint(s).

**Platform**: Works on desktop browsers (Firefox, Chrome, Chromium) and mobile
Firefox Nightly.

## Features

- 🔍 **Page Stream Detection** - Detects HLS, DASH, MP3, AAC, OGG, RTMP,
  RTSP, Icecast, Shoutcast from the current page.
- 0️⃣ **Zero-Stream Support** - Extension works even without detected streams:
  shows '0' badge, allows API calls with page URL/title. Name endpoints clearly
  to distinguish page-only vs stream-dependent calls.
- 📡 **Configurable Endpoints** - Define multiple API endpoints with template placeholders, export & import bluprints from files or sites
- 🌐 **Two API call Modes** - "Open in Tab" (GET via navigation or POST/PUT/DELETE via form submission - bypasses CORS), "Call API" (`fetch` HTTP request with full control: custom headers, body templates, programmatic response handling)
- 📋 **Copy URLs** - Quick copy stream URLs to clipboard.
- 🔔 **Badge Notifications** - Shows number of detected streams on the
  extension icon (including '0' when no streams).
- **Mobile Firefox Nightly Support** - Extension works also on mobile Firefox Nightly.


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
3. Define one or more API endpoints as a JSON array
4. Click "💾 Save Settings"
5. Click "🧪 Test API" to verify the connection

#### Endpoint Fields

- **name** (required): Display name shown in popup
- **endpointTemplate** (required): API URL (supports _placeholders_)
- **description** (optional): Description shown in options
- **method** (optional): HTTP method (GET, POST, PUT, DELETE; defaults to POST)
- **contentType** (optional): Content-Type header (defaults to application/json)
- **username** (optional): Username for Basic authentication
- **password** (optional): Password for Basic authentication
- **bearerToken** (optional): Bearer token for token-based authentication (takes precedence over username/password)
- **headers** (optional): Custom headers object
- **bodyTemplate** (optional): Request body template (supports _placeholders_)
- **includeCookies** (optional): Include page cookies in request (defaults to false)
- **includePageHeaders** (optional): Include page headers in request (defaults to false)
- **active** (optional): Enable/disable endpoint (defaults to true)

The payload sent to your API endpoint depends on your endpoint configuration:

- `GET` & `HEAD` requests lack body.
- If you use `bodyTemplate`, the extension sends that template with placeholders
  replaced.
- If you omit `bodyTemplate` the request an empty body is sent (except `GET`/`HEAD`).

#### Available Placeholders

- `{{streamUrl}}` - The detected stream URL
- `{{pageUrl}}` - The webpage URL where the stream was found
- `{{pageTitle}}` - The webpage title
- `{{timestamp}}` - Current timestamp in ISO format

Placeholders are *case-insensitive* and support 2 jinja-like filters eg. `{{streamUrl | url }}`:

- `url` - URL-encoded stream URL
- `json` - JSON-encoded value


### 2. Detect Streams & call API endpoint

1. Navigate to any website with streaming media (e.g., online radio, podcast player).
2. The extension will automatically detect streams and on its icon a badge will appear
   showing the number of detected streams (including '0' when no streams found).
3. Click the extension icon to view all detected streams.
4. Select the desired API Endpoint (pre-configured above).
5. Choose action:
   - **📤 Call API** - Send HTTP request (fetch) with full control over headers/body. Receives programmatic response, shows success/error in log.
   - **🌐 Open in Tab** - Open URL in new browser tab. GET/HEAD uses simple navigation, POST/PUT/DELETE uses form submission to bypass CORS and sen. Useful for HTML-returning services where you want to see the rendered page.

**Zero-Stream Mode**: Even when no streams are detected, the extension remains
functional. The badge shows '0' and you can still call endpoints using page URL/title
placeholders (`{{pageUrl}}`, `{{pageTitle}}`). Consider naming your endpoints
clearly (e.g., "Bookmark Page", "Send to Wallabag") to distinguish page-only
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
├── manifest.json              # Extension manifest
├── tsconfig.json             # TypeScript configuration
├── package.json              # Node.js dependencies & scripts
├── README.md                 # This file
├── CHANGES.md                # Version history
├── LICENSE.txt               # GPL-3.0 license
├── MOBILE_TESTING.md         # Mobile Firefox testing guide
├── popup-pane.html           # Popup UI
├── options-pane.html         # Options page UI
├── hover-pane.html           # In-page overlay UI
├── src/                      # TypeScript sources
│   ├── broker.ts             # Broker service worker (utility)
│   ├── page.ts               # Content script for stream detection (utility)
│   ├── popup-pane.ts         # Popup pane logic
│   ├── options-pane.ts       # Options pane logic
│   ├── hover-pane.ts         # Hover pane logic
│   ├── endpoint.ts           # Endpoint config & API calling (utility)
│   ├── detect.ts             # Stream detection patterns (utility)
│   ├── logger.ts             # Unified Logger class (utility)
│   ├── types.ts              # Type definitions (utility)
│   ├── components-ui.ts      # Shared UI component builders (UI)
│   ├── logger-ui.ts          # Logger UI renderers (UI)
│   ├── debounce.ts           # Debounce utility
│   └── COMMIT_MSG.md         # Commit message template
├── dist/                     # Build output (generated by tsc + copy)
├── icons/                    # Extension icons
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   ├── icon-128.png
│   └── generate-icons.html   # Icon generator (not in package)
├── tests/                    # Test suite
│   ├── unit/                 # Unit tests (node --test + tsx)
│   └── integration/          # Integration tests (web-ext)
├── notes/                    # Design & planning docs
└── .github/
    └── copilot-instructions.md
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

## Architecture & Terminology

The extension architecture revolves around six core concepts that work together in a message-driven flow:

| Concept | 🎯 What | 📍 Where | 🔧 Purpose |
|---------|---------|----------|------------|
| **Detection Patterns** | Regex for stream URLs | `STREAM_PATTERNS` in `detect.ts` | • Match streaming media URLs<br>• Built-in, not user-configurable<br>• Tested via `content.test.ts` |
| **Streams** | Detected URLs + metadata + classification | `StreamInfo` in `broker.ts` | • Store detected media per tab<br>• Typed as HLS, DASH, MP3, RTMP, etc.<br>• Include page context + timestamp |
| **API Endpoints** | User-configured HTTP targets | `storage.sync.apiEndpoints`, `config.ts` | • Webhooks/APIs for detected streams<br>• Support templating<br>• Fully customizable |
| **Interpolation Templates** | Placeholder strings | Endpoint/body templates | • Dynamic value insertion<br>• `{{streamUrl}}`, `{{pageUrl}}`, `{{pageTitle}}`, `{{timestamp}}` |
| **Execution Contexts** | Isolated JavaScript environments | Page context vs Extension context | • Content script runs in page context<br>• Broker/popup run in extension context<br>• Cannot share variables/functions<br>• Communication only via messages |
| **Runtime Messages** | Cross-component IPC | `RuntimeMessage` type | • `STREAM_DETECTED` (page→bg), `GET_STREAMS` (popup→bg)<br>• `CALL_API` (hover→bg), `OPEN_IN_TAB` (hover→bg), `PING` |

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
- **Two contexts**:
  - **Page Context** (`page.ts`): Runs inside the webpage DOM, has access to page resources (images, media, scripts) but **isolated memory** from extension
  - **Extension Context** (`broker.ts`, `popup.ts`, `options.ts`): Runs in browser's extension sandbox, has access to `browser.*` APIs, storage, and network requests
- **Why it matters**: Content scripts cannot directly call functions in broker/popup or access their variables — they are in **separate JavaScript worlds**
- **Root cause of messages**: This isolation is why `browser.runtime.sendMessage()` exists — it's the **only way** to pass data between contexts
- **Security benefit**: Page scripts cannot access extension internals (API keys, stored endpoints, etc.)
- **Common pitfall**: Trying to `import` shared utilities in both contexts requires careful module design (e.g., `detect.ts` exports pure functions usable in both)

### 6. Runtime Messages
- **What**: Cross-component communication protocol via `browser.runtime.sendMessage()`
- **Where**: `RuntimeMessage` type in `src/broker.ts`
- **Purpose**: Message-passing between page script (page context), broker worker, and popup (extension context)
- **Message Types**:
  - `STREAM_DETECTED` (content → broker): Reports newly detected stream URL with type
  - `GET_STREAMS` (popup → broker): Requests all streams for current tab
  - `CALL_API` (hover-panel → broker): Triggers API call with stream data (popup/options call directly)
  - `PING` (popup → broker): Health check to verify broker worker is alive

### Message Flow

The extension uses a message-driven architecture via `browser.runtime.sendMessage()`:

```
       PAGE CONTEXT (webpage)                EXTENSION CONTEXT (browser)
┌────────────────────────────────────┐  ┌────────────────────────────────────┐
│                                    │  │                                    │
│  ┌─────────────┐  STREAM_DETECTED  │  │  ┌────────────────┐  GET_STREAMS   │
│  │   Content   ├───────────────────┼──┼─>│    Broker      │<──────────┐    │
│  │   Script    │                   │  │  │   (broker.ts)  │           │    │
│  │   (page.ts) │                   │  │  │   endpoint.ts) │           │    │
│  └─────────────┘                   │  │  └────────┬───────┘           │    │
│       ▲                            │  │           │                   │    │
│       │ Detects streams via        │  │           │ Stores streams    │    │
│       │ STREAM_PATTERNS            │  │           │ per tab (max 200) │    │
│       │   (detect.ts)              │  │           │                   │    │
│  ┌────┴─────┐                      │  │           │ CALL_API          │    │
│  │ Webpage  │                      │  │           │ (user triggered)  │    │
│  │   DOM    │                      │  │           ▼                   │    │
│  └──────────┘                      │  │  ┌─────────────────┐   ┌──────┴──┐ │
│                                    │  │  │  API Endpoint   │   │ Popup   │ │
│                                    │  │  │ (user-configured│   │ (popup  │ │
│                                    │  │  │   via options)  │   │  .ts)   │ │
│                                    │  │  └─────────────────┘   └─────────┘ │
└────────────────────────────────────┘  └────────────────────────────────────┘
     Isolated from extension APIs            Has browser.* API access
     Can access page DOM/resources           Cannot access page DOM directly
```

#### Message Types

- `STREAM_DETECTED` (content → broker): Reports a newly detected stream URL with its type
- `GET_STREAMS` (popup → broker): Requests all streams for the current tab
- `CALL_API` (hover-panel → broker): Triggers API call from page context (popup/options call `callEndpointAPI()` directly)
- `OPEN_IN_TAB` (hover-panel → broker): Opens endpoint in new tab from page context (popup/options call `openEndpointInTab()` directly)
- `PING` (popup → broker): Health check to verify broker worker is alive


### Logging Categories

Logger provides audit trail (ring buffer) + UI status (slot-based):

**API**: `logger.error(slot, msg)`, `logger.infoFlash(timeout, slot, msg)`
**~65 total logging calls** across all components
**1 legacy console call** (WIP hover-panel.ts stub)

| Category | Occurrences | Purpose |
|----------|:-----------:|---------|
| endpoint | 19 | Endpoint operations (config/validation/save/delete/tab-open/api-call) |
| apicall  | 10 | API call operations (HTTP requests/responses/testing) |
| storage  |  9 | Storage operations (load/save/reset/export/import/initialization) |
| popup    |  7 | Popup component operations (initialization/refresh/UI actions) |
| page     |  6 | Page script operations (stream detection/player detection/UI injection) |
| broker | 6 | Broker worker operations (stream management/tab lifecycle/initialization) |
| messaging | 5 | Cross-component message passing (page↔broker via browser.runtime.sendMessage) |
| stat     |  3 | General status/progress messages |
| interpolation | 2 | Template placeholder interpolation |
| clipboard | 2 | Clipboard copy operations |


## Privacy

*Streamonio*:
- Only sends data to **your configured API endpoint**
- Does not track browsing history, neither collect or transmit data to 3rd parties
- Stores configuration locally in Firefox sync storage

## Inspiration

This extension is my scratch reply for the itch of by Chromecast not working
in my home's WiiM Ultra music system, coupled with my curiosity for Claude's vibe coding,
TypoScript, and my [liberation talk](https://ankostis.io/data-liberation-talk/slides/).

Claude's inspiration list:
- **stream-recorder** - For stream detection techniques
- **stream-bypass** - For handling various streaming protocols

## Permissions

The extension requires the following permissions:

- `storage` - To save API configuration
- `activeTab` - To access the current tab information
- `webRequest` - To monitor network requests for streams
- `<all_urls>` - To detect streams on any website

## License

GPLv3 License - See LICENSE file for details.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request
5. AI vibe-coding endorsed only with elaborate commit message (and notes/*).

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for solutions

Made for the ❤️ music, by the gift of Sonnet 4.5.
