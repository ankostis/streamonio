# Copilot Instructions for *Streamonio*

**Meta**: Keep this file <100 lines - compress when needed without losing points.

## Project
- **Name**: Streamonio - Send page streams to API calls
- **Description**: Cross-browser extension (Firefox & Chrome) extracting streaming media URLs (podcasts, radio, live streams) to HTTP API endpoints

## Architecture

### Essentials
- WebExtension: manifest → `dist/` (tsc + copy HTML). Keep paths synced.
- Sources: `src/*.ts` (broker, page, popup, options); HTMLs copied to `dist/`
- APIs: `browser` namespace (`@types/firefox-webext-browser`), no framework
- Tests: `npm test` (unit), `npm run test:integration` (web-ext, port 9090)
- Templates: `streamUrl`, `pageUrl`, `pageTitle`, `timestamp`
- Messages: `STREAM_DETECTED`, `PING`, `GET_STREAMS` via `browser.runtime.sendMessage()` etc
- Debounced detection: 1s delay, 2s interval, 500ms DOM mutation, bounded state: 200 streams/tab (LRU), cleanup on close/nav
- Shared utils: `config.ts`, `template.ts`, `detect.ts`, `debounce.ts`
- Endpoint config: keyed by unique `name`, auto-suggested from hostname
- **Cross-browser**: webextension-polyfill, verify permissions before manifest updates, mobile Firefox Nightly support required

### Conventions
- **Exceptions**: Follow `notes/exception-handling-policy.md` - don't swallow, let bubble via logger/statusbar, handle only when cause known
- Types: `export {}` per file to avoid globals
- Endpoints: unique names, `parseEndpoints()` filters dupes

### UI
- Use `rem` units; ensure `dist/` copy for runtime assets
- **Theme & Constants**: Centralized in `src/theme.css` (110 CSS vars) and `src/ui-constants.ts` (27 icons + colors)
  - Colors: `src/theme.css` defines `--color-primary`, `--color-success`, `--color-danger-*`, etc.
  - Icons: `src/ui-constants.ts` exports `ICONS.SAVE`, `ICONS.DELETE`, etc. as TypeScript consts
  - **popup-pane**: Uses theme variables via `shared-pane.css` (green rgb(69,160,73), banner rgb(241,248,244))
  - **hover-pane**: Uses theme variables via `shared-pane.css` (same colors as popup)
  - **options-pane**: Uses `shared-pane.css` + inline `<style>` (legacy hardcoded colors - not yet refactored)
  - Always use CSS variables (`var(--color-*)`) in shared-pane.css, avoid hardcoding colors in HTML files

### Logging
- No naked `console.*` - use logger/statusbar
- **Slots/Categories** = WHAT (domain: `endpoint`, `storage`, `apicall`)
- **Levels** = HOW important (`Error/Warn/Info/Debug`)
- Never embed levels in categories (❌ `endpoint-error`, ✅ `endpoint`)
- Consolidate log calls; include textual msg + objects for inspection

## Development

- Build: `npm run build`. Package: `npm run package"`, explore other package.json scripts occasionally.

### Workflow
After code/HTML/CSS changes:
1. Modify, format & build (verify types, update browser)

2. Test, lint, check dupes (`npm test`, `npm run lint`, `npm run dupes`)
3. Update docs (if really needed) and the prepare (or update) SUMMARY.md for commit.
4. **Revert failed experiments** - when code change didn't work or had no visible effect, remove it. But don't retract aggressively - keep changes that work or that the user explicitly praises.  Always inform what you kept.

### Testing
- Scripts in `package.json`; manual via httpbin.org/anything + `DEFAULT_CONFIG` tweaks
- Debug: broker (about:debugging), content (page console), PING (popup health)

### Quality
- Run after features: `npm run lint`, `npm run dupes`, `npm run dead-code`
- Keep duplication <5%, refactor if >8 clones; see `notes/linting-report.md`
- **Succinct code & docs**: Terseness matters - long code/docs hard to maintain/confuse


## Git

- Segregate commits by functionality (not location)
- Never `git add` files - I plan multiple commits from workspace
- I rewrite history ([Sausage Making](https://gist.github.com/SethRobertson/1540906/de2387189cc924c2b24ad867e6f81b29a9ced1a7#sausage-making))
- Ask if commit finished when unclear

### SUMMARY.md - Commit Messages

**IMPORTANT**: "summarize" → write to SUMMARY.md

- Document staged/uncommitted changes (`git diff --staged`)
- Lines <90 chars, suitable for git commit

**Header** (1st line):
- Format: `type(scope) phrase` or `type: phrase` (<50 chars)
- Types: feat/enh/refact/drop/chore/doc/style
- Scope lowercase; can be `tests`/`TCs`
- End with ` >` if body follows; `;` separates distinct changes

**Body**:
- Present tense (changes), past tense (bugs)
- Big picture first, succinct, use "etc"
- What changed + why (skip file listings)
- NO `#` headers (vim rebase issues)
- Backticks for code, *italics* for concepts, **bold** for emphasis
- Bullets for actions, paragraphs for explanations
- TODOs/performance at bottom
- "Why" only if non-obvious

### Releases
- Collect commits since last release
- Capitalize = significance: FIX > Fix > fix. Fixes > features > docs
- Merge & consolidate commits by domain (eg logging) per type
