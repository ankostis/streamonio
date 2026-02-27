## Changes

- [ ] Chromecast
- [ ] Music Assistant
- [ ] Snapcast
- [ ] Notify msg when endps/vars edited to auto refresh
- [ ] Undo option changes, instead of confirmation dialog.
- [ ] Feat(options,UI) draggable height of activity logs in
- [ ] Feat(options,UI) tabs on mobile
- [ ] fix touch infos in mobile api-call
- [ ] Feat(options.endp.UI) In-list edit; Mark editing endpoint dirty till saved

## v0.8.X - (TODO) Chromecast & Snapcast

## v0.7.2 - (2026-02-27) Hover UI fixes, MCP testing, refactor duplicates

- Fix(hover UI) zoom buttons now clickable on mobile: use CSS `zoom` instead of
  `transform: scale()` so event coordinates match visual rendering; add
  `touch-action: manipulation` for immediate `:active` state (no 300ms delay)
- Fix(UI) status bar was overflowing beyond screen on desktop
  (zoom from mobile fix incorrectly applied everywhere)
- Feat(test) add MCP Playwright integration test to fix hover panel initialization issues.
- Refact(UI) extract duplicate code to reduce duplication from 2.94% → 2.22%:
  - Extract `populatePanel()` handler construction into shared
    `populatePanelWithActions()` helper
  - Drop duplicate `displayStreams*()` wrappers, inline direct calls
  - Extract hover viewport calculation to `hover-viewport.ts` module
- Refact(UI) extract version display code into `components-ui::displayVersion()`
- Refact(log): replace naked `console` calls in shared components by passing a `logger` arg to them.
- Chore(AI) extract commit summarization and drafting of Release changes
  as reusable skill for AI agents.

**Sizing:** Bundles stable ~400KB; duplication 2.22% (873 tokens, well below 5%)

## v0.7.1 - (2026-02-24) Hover stable size, options UI, vars fix & feats, AI
- FIX(HOVER) page scale (meta) does not affect hover panel size & fonts.
- User variables (in options):
  - fix(UI): var-item as 2-rows on mobile, reduce padding to view more items
  - fix/Feat: always show empty var row instead of suggesting dummy var key for new var;  drop "Add" button
  - Feat: +Clear/Reset/Import/Export buttons also for vars list (like endps list)
  - feat(ui) mutual excl err-icon & accept button on each item
  - fix: default vars now loaded on first run
  - feat: warn consistently also for clashing with existing var names
- fix: replace forgotten `{{timestamp}}` with `{{seekTimeSecs}}`
- fix(logbox) clear/export btns were still toggles >
- Refact(opts.ui): group endpoint list buttons into themed split-btn groups
- Enh(options.ui) equalize all buttons
- fix(opts.ui) drop stray html closing mark ( `/>`) beneath authentication fields
- Feat(Build) dev builds show git-describe hash id
- drop(ui) no show-off animations on refresh/opts buttons
- chore(AI) +structured programming, no early returns, retract efforts

## v0.7.0 - (2026-02-15) User interpolation variables, enhance both UIs, themes

- FEAT(OPTIONS, ENDP) User-defined interpolations (eg server IPs)
- FEAT(CALLAPI.UI): endpoint dropdown -> 2-col list and and a slew of UI WORK
- Fix(hover) shrink hover mark and move it to the very edge, not to hinder page content.
- REFACT(UI) DRY, use constants in the code & CSS for icons & smileys (aka theme)
- Feat(options.UI) Touch friendly tooltips in options

### v0.6.2-DEV - version auto DEV by git-tag, ui work on split-buttons

- feat(UI) split-button groups in popup & hover panels>
- Feat(VER) auto DEV if tagged, ver in `package.json` >
- Chore(AI) build process in Copilot guidelines;  compressed to aid sonnet remember...

## v0.6.1 - (2026-02-14) Fix Hover, `+{{seekTimeSecs}}` `-{{timestamp}}`, unify StreamInfo+RequestContext, lint checks

- FIX(hover) was stuck on loading spinner.
  - feat(test.hover) +integration TC to capture init errors.
- Feat(endp) add `{{seekTimeSecs}}` interpolation, drop useless `{{timestamp}}`.
- feat(endp) Log call & better preview
- feat(ui) refresh button reloads also endpoints.
- feat(ui) copy button now copies final interpolated URL.
- Feat(options.ui) rework edit-endpoint section.
- fix(ui) preview button yellow
- REFACT: unify STREAMINFO & eliminate RequestContext>
- Refact(Endp) unify API call & preview code paths >
- Refact(LINT) relax type checks, fix most lint errors & warns, also on test-code.
- Feat(build) compiler checks TypeScript Types.

## v0.6.0 - (2026-02-08) MSE & blob(informational) Support

- FEAT(detect) Intercepts MediaSource Extensions (MSE) usually originating from blob URLs
 (eg youtube). Hook fetch, XMLHttpRequest, and MediaSource constructor.
 Blob URLs are grey background, unselectable, with a tooltip explaining limitation.
- Drop(detect) `interceptNetworkRequests()` that ran in isolated extension context
  and never intercepted page's fetch/XHR calls from day one, out of missunderstanding
  of the various contexts involved.
- FIX(options.ui) Endpoint list was not scrollable.
- Feat(options.ui) Split-button imports to fit better in mobile.
- FEAT(version) DEV build indicator in `manifest.json::version_name`.

## v0.5.1 - (2026-01-10) unreleased

- REFACT(CSS) DRY between popup & hover panes

## v0.5.0 - (2026-01-09) STREAMONIO: +Chrome, Authed APIs, ShadowDOM streams, call page's url alone

- Renamed _Stream call_ → **Streamonio**
- FEAT: CHROME support
- FEAT(endp) Authentication support - username/password (Basic auth) and bearer token, plus content-type field
- FEAT(ui) Endpoint editor restructured - organized sections for name/desc, URL/body, method/content-type, auth, cookies/headers, custom headers
- FEAT(page) Detect streams in ShadowDOMs inside IFrames (eg Lifegate)
- FEAT(ui) Extension/Hover now functional even when no streams detected; it shows '0' badge but endpoint selector remains available (acts like "share" for mobile apps).
- FIX(ui) Hover panel sizing consistent across pages
- Feat(detect) Configurable DOM rescan intervals
- Feat/drop: MRU Endpoint Sorting;  drop enable flag.
- Feat(ui) disable endpoint Body area on GET, HEAD, DELETE methods.
- Fix: logger areas don't wrap lines
- Feat/STYLE(BUILD) Linting, FORMATting, Dedupe(PMD), Dead code elimination
- Fix(ui) usability fixes on hover-panel
- feat(ui) github home & Lic & Date in About
- refact: `logger` accepts category only on its constructor.
- refact: de-dupe getElementById; fix Stuck Tests
- Doc: Trim and correct README (not yet prime time).

## v0.4.1 - (2025-12-24) lost close hover button fix

- Fix(ui) Show/hide hover-pane button no longer moves outside screen panel, it remains fixed in its original position instead.

## v0.4.0 - (2025-12-23) GUI beauty, Hover pane, open in Tab POST

- FEAT: Hover pane now works (opt-in from preferences).
- FEAT(apicall) POST/PUT/etc can "Open in Tab" (not just GET) button with dynamic `<form>` submission.
- Fix(ui) fixes for mobile
- feat(ui) consistent API-calling buttons in popup vs options; added preview in popup.
- Feat(endp) add "Description" field.
- Feat: UI work on shared components (eg actiontbuttons)
- Refact(ui) extract DOM-builders for common UIs across `popup.ts` - `options.ts`
- Refact(endp) Unified API/UI calling, 6% bundle size improvements.
- Refct(broker) dropped needless messaging from same exec context.
- Refact(log) Merge Logger/StatusBar as LIFO stack, much simpler & lighter.
- Feat: rework log, status & emoji icons.
- Refact: renames to denote structure:
  - rename `background.ts` -> `broker.ts`
  - denote Pane UIs with `-pane` suffix.

## v0.3.0 - (2025-12-16) GUI also works ok now

- Feat(ui) Consistent API call action buttons (Call, Open, Preview) in popup & options UIs
- FIX(ui) Touch-friendly UI & hints, improved look & feel of options page.
- feat(ui) Don't jerk when adding endpoint in options page.
- refact(ui) css units from px -> rem for scalable UI
- doc: consistent project description across README, UI & manifest paraphernalia
- feat(build) "About" section get its version from extension's Manifest.
- feat(build) include version in zip fname when packaging the extension.
- drop(broker) minor messaging dead code
- chore: my project coordinates in `manifest.json`
- [x] TODO/Enh(API) support POST for "Open in Tab" button with dynamic `<form>` submission.
- [x] TODO/FEAT: hover panel full implementation (WIP since v0.1.0)

## v0.2.0 - (2025-12-15) FIXED and ENHANCED

- FEAT: Dual call modes — "Open in Tab" (simple GET) vs "Call API" (full HTTP with
  POST/headers/body)
- FEAT: Options page complete overhaul — responsive 2-column UI, CRUD editor,
  import/export (file/URL/Gist), active toggles, validate/call testing, inline help,
  integrated log viewer
- refact: Endpoint module extraction — merged `template.ts` into `endpoint.ts`,
  centralized API logic, eliminated duplicate DEFAULT_CONFIG
- refact/fix: Logger, separate category/slot from levels, no naked console calls,
  eliminated duplicate.
- Feat: Popup master-detail pattern — compact scrollable list + single detail panel,
  saves 60% vertical space
- FIX: Hover panel still WIP but  for mobile — in-page iframe overlay with toggle button, clone of
  popup UI
- fix: Tab reuse logic — query existing tabs before creating new ones, prevents mobile
  tab bloat
- refact: Content → Page rename — `content.ts` → `page.ts` throughout codebase
- fix: GET/HEAD body exclusion — fixed "Request cannot have a body" errors
- fix: Demo endpoint for HTTPBin → HTTPBingo — updated dead test endpoint to working alternative
- doc: Mobile testing docs — comprehensive `MOBILE_TESTING.md` with Firefox Nightly
  setup
- cod: Copilot instructions — enhanced with logging rules, git workflow, testing
  conventions
- doc: README overhaul — updated architecture, logging stats (61 calls), project
  structure
- doc: Test improvements — endpoint.test.ts expanded, template.test.ts merged into
  endpoint
- enh: 2400+ line delta — 24 files changed, 2422 insertions, 900 deletions since
  v0.1.0
- FIX: `GET` requests fail because they include an (empty) body.
lg- FIX: had duplicate endpoint DEFAULTS.
plb- Feat: Refactored options UI for mobile-friendly experience:
- Enhanced API validation with real calls and detailed logging
- Logger architecture hardening (required logger, no console.* calls)
- Fix(mobile) options button in popup not quite working:
  opens new tab without switching to it, filling up the tab list.  Reuse tab??
- doc: improve README.
- [ ] TODO/CHORE: prepare for Mozilla extension site submission.
- [x] TODO: transfer popup logs from extension-context -> page's console.
- [x] TODO/BUG: popup cannot see responses from fetch-calls.
- [ ] TODO/BUG: persist popup logs & logbox-expanded choice in popup panel.
- [x] TODO: logging message texts, levels & timeout in status bar
- [ ] TODO: improve icons

## v0.1.0 - (2025-12-14) it almost Works

- Rough implementation complete.
- Packaged as a Firefox extension zip to install manually.
- Comprised of:
  - page script for stream-url detection (page context)
  - extension-popup panel with detected stream list & call button (extension context)
  - options-page with endpoint config editor (extension context)
  - communication between contexts via `browser.runtime.sendMessage()`
  - logbox & statusbar in both popup & options
- Package contents:

  | Size  | File |
  |-------|------|
  |  1314 | manifest.json |
  |     0 | dist/ |
  | 10149 | dist/background.js |
  | 32133 | dist/options.js |
  | 20866 | dist/popup.js |
  | 17308 | dist/options.html |
  |  9527 | dist/hover-panel.html |
  |   535 | dist/hover-panel.js |
  | 11230 | dist/content.js |
  | 11015 | dist/popup.html |
  |     0 | icons/ |
  |   568 | icons/icon-16.png |
  |  1252 | icons/icon-32.png |
  |  4207 | icons/icon-96.png |
  |  1959 | icons/icon-48.png |
  |  5809 | icons/icon-128.png |
  | **137399** | **17 files** |

- NOTE: it contains a dummy hover-panel expandable with a hover button bottom-right of the page,
 to check implementation on mobile firefox: not working yet
- BUG: `GET` requests fail because they include an (empty) body.

## v0.0.0 - (2025-12-12) initial commit

- Scaffolding for Firefox extension and stated project coal to copilot (Claude Sonnet 4.5).
- Stated goal: an extension that captures audio/video streams from pages (radio, podcasts, etc.) and send them to a specified endpoint(s).
