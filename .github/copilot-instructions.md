# Copilot Instructions for *Streamonio*

## Project coordinates
- **Project name**: *Streamonio*
- **Blip**: Send page streams to API calls
- **Short description**: A cross-browser extension (Firefox & Chrome) to extract streaming media URLs (podcasts, radio stations, live streams) and send to HTTP API endpoint(s)

## Architecture

### Project essentials
- Cross-browser WebExtension; manifest points to built assets in `dist/` (tsc + copy,
  no bundler). Keep manifest paths in sync with `dist` outputs.
- TypeScript sources in `src/` (`broker.ts`, `page.ts`, `popup.ts`,
  `options.ts`); `popup.html` and `options.html` are copied to `dist/`.
- Build: `npm install` then `npm run build` (clean + tsc + copy HTML). Package:
  `npm run build && zip -r streamonio.zip manifest.json dist icons -x
  "icons/generate-icons.html"`.
- APIs: `browser` namespace with `@types/firefox-webext-browser`; no framework/
  bundler.
- Tests: `npm test` (unit, node --test + tsx); `npm run test:integration`
  (web-ext, Firefox, local HTTP server on 9090).
- Templating placeholders for endpoints/bodies: `streamUrl`, `pageUrl`,
  `pageTitle`, `timestamp`.
- **Mobile Firefox Nightly**: Must have good UX on mobile browsers where options UI panels
  cannot float/dock alongside the webpage.

### Architecture principles
- Message-based flow: content -> `STREAM_DETECTED`; popup -> PING + `GET_STREAMS`.
  All cross-component comms via `browser.runtime.sendMessage()`.
- Bounded state: broker caps 200 streams/tab (LRU) and cleans on close/nav;
  popup caches endpoints in-memory per session.
- Shared utilities: `config.ts` (parse/validate endpoints), `template.ts` (interpolate placeholders),
  `detect.ts` (detection patterns), `debounce.ts` (throttle). Content imports patterns
  from `detect.ts` instead of duplicating.
- All UI panels (hover-panel & options, Phase 5+) will reuse Logger & StatusBar
  for in-page diagnostics (See `notes/logger-plan.md`).
- Endpoint-first config: Only API endpoints, keyed by unique `name`. Names
  auto-suggested from endpoint host via `suggestEndpointName()`.
- Debounced detection: media scan 1s delay/2s interval; DOM mutation debounce
  500ms.


### Conventions & pitfalls
- **Exception handling**: Follow `notes/exception-handling-policy.md` strictly:
  - DON'T swallow silently exceptions.
  - Avoid early handling of exceptions, prefer to let them bubble to console via logger or statusbar,
  - early handling of exceptions preferable only when fail cause is known or where remedy is possible.
- Type isolation: each TS file `export {}` to avoid globals.
- Endpoint keying: unique `name`; `suggestEndpointName()` derives from hostname; `parseEndpoints()` filters dupes; `validateEndpoints()` surfaces dups.
- Template errors: handled separately in `callStreamAPI()`/`testAPI()` to distinguish placeholder issues from network errors.
- Detection patterns: extend `STREAM_PATTERNS` and `getStreamType()` together; DASH before HLS to avoid `.mpd` false HLS matches.

### UI, CSS

- Prefer `rem` units.
- Static assets: if adding runtime HTML/assets, ensure copy step/manifest puts them in `dist/`. Icons via `icons/generate-icons.html`.

### Logging Architecture Rules
- **Don't use naked console-log statements**; use logger or statusbar methods.
- **Slots/Categories** = WHAT you're logging about, domain names, concerns (eg. `endpoint`, `storage`, `apicall`)
- **Levels** = severity enums (`LogLevel.Error/Warn/Info/Debug`) - HOW important it is
- Categories are **separate parameters** from levels: `statusBar.post(level, category, message)`
- Categories must **never** embed level names (❌ `endpoint-error`, ✅ `endpoint`)
- StatusBar slots Map: one message per category, `getCurrent()` returns highest-priority level across all slots
- Consolidate log calls, do not spilt them in separate calls, it's slow & waste of bytecodes.
- Print a textual msg for the log-boxes or statusbars, and include the actual objects for consle to inspect them.
- `error-handling-audit.md`: Silent error sinks fixed (PING checks, template
  error separation, better UI feedback).

## Development

### Code change workflow
After ANY code/HTML/CSS changes:
1. modify, format & build - always, to verify types and update browser for me to review
2. Test, Lint, DeadCode - run test-cases & integration test (if needed), check for dupes.
4. Update SUMMARY.md for commit (see SUMMARY.md section below)

### Testing & debugging
- Unit & Integrations are launched by the `package.json:scripts`.
- Manual API: use https://httpbin.org/anything to validate templating; tweak
  `DEFAULT_CONFIG` in `src/options.ts` for quick tests.
- Debugging: broker via about:debugging > Inspect; content in page console;
  PING handler for popup health checks; use logs.

### Code quality checks
- **Run after features & refactoring**: `npm run lint`, `npm run dupes`, `npm run dead-code`
- Linting: `npm run lint` (Biome checks); `npm run lint:fix` (auto-fix safe issues)
- Duplication: `npm run dupes` (jscpd analysis); keep below 5%, refactor if >8 clones
- Dead code: `npm run dead-code` (ts-prune for unused exports)
- See `notes/linting-report.md` for current metrics & refactoring priorities

### Quick references
- Build: `npm run build` (clean + tsc + copy HTML)
- Package: `npm run build && zip -r streamonio.zip manifest.json dist icons -x
  "icons/generate-icons.html"`
- Tests: `npm test`; `npm run test:integration`
- Quality: `npm run lint`; `npm run dupes`; `npm run dead-code`

## Ask when unclear
- Extension supports both Firefox and Chrome via webextension-polyfill - no browser-specific code needed.
- Verify new permissions/host permissions before adding to manifest.
- If touching shared utilities (`config.ts`, `template.ts`, `detect.ts`), update
  related tests.

## Be succinct when coding, creative when elaborating
- Terseness is important both for code and documentation; long code is slow and hard to maintain,
  long docs are confusing in addition.
- Don't forget the tests & documentation when making updates.

## Skillful Git artisan
- Segregate changes for distinct commits by functionality (not location).
- Don't `git add` files, i may plan to derive multiple commits from existing workspace changes.
- I frequently rewrite my history to hide the [Sausage Making](https://gist.github.com/SethRobertson/1540906/de2387189cc924c2b24ad867e6f81b29a9ced1a7#sausage-making).  Read history and help.
- Ask me if a commit has finished, when you can't tell.

### Release & Changes

List epigrammatically the most significant changes since last release.

- Collect all commits since the last release commit.
- An indication of significance of a commit is the capitalization of its header: FIX is more eimportant than Fix & fix.  Fixes useally are more important than features & enhancements docs.
- Merge & consolidate all commits about an domain (eg logging) per type  (fix, feat, etc)

### SUMMARY.md - Git Commit Message Draft

**IMPORTANT**: Whenever user asks to "summarize", do it in SUMMARY.md file as commit msg.

Maintain in repo root as working doc for commits:
- Clear when describing new changes (ask if unsure)
- Document staged/uncommitted changes (specify which)
- Use `git diff --staged` to check index (not `get_changed_files` API)
- Lines <90 chars, concise, suitable for git commit

Header line (1st line):
- Syntax: `type(scope) phrase` or `type: phrase` (skip `:` if scope present)
- Types: feat/enh/refact/drop/chore/doc/style, lowercase scope
- Scope can be `tests`/`TCs` (no `test` type exists)
- <50ish chars, end with `>` if body follows
- Separate distinct changes with `;`
- Loosely follow "conventional commits"

Body (after header):
- Simple/direct tone: present tense (changes), past tense (bugs/old behavior)
- Big picture first, be succinct, use "etc" freely
- What changed and why (skip file listings, reviewer sees diffs)
- NO markdown headers (#), confuses vim rebase-interactive
- Backticks for code, italics for concepts, bold for emphasis
- Bullet points for actions/todos, paragraphs for explanations
- TODOs/performance/test changes at bottom if present
- Include "Why" only when non-obvious (workarounds, arch decisions, timing)
