# Copilot Instructions for *Streamonio*

**Meta**: Keep this file <100 lines - compress when needed without losing points.

## Project
- **Name**: Streamonio - Send page streams to API calls
- **Description**: Cross-browser extension (Firefox & Chrome) extracting streaming media URLs (podcasts, radio, live streams) to HTTP API endpoints

## Architecture
- Augment your coding principles with structured programming insights.
- start with functions, not classes
- extract objects out of common groups of arguments
- favor single exit points with clear control flow over early returns, keeping nesting manageable

### Essentials
- WebExtension: manifest → `dist/` (tsc + copy HTML). Keep paths synced.
- Sources: `src/*.ts` (broker, page, popup, options); HTMLs copied to `dist/`
- APIs: `browser` namespace (`@types/firefox-webext-browser`), no framework
- Tests: `npm test` (unit), `npm run test:integration` (web-ext, port 9090)
- Templates: `streamUrl`, `pageUrl`, `pageTitle`, `seekTimeSecs`
- **2 execution Contexts(Isolated JavaScript environments):**: Page context (page, hover-pane) vs Extension context (broker, popup-pane, options).  Common code must duplicate
- Messages across contexts: `STREAM_DETECTED`, `PING`, `GET_STREAMS` via `browser.runtime.sendMessage()` etc, see `types.ts::RuntimeMessage`
- Debounced detection, cleanup on close/nav
- Endpoints: stored in extension context, keyed by unique `name`, auto-suggested
- `export {}` per file to avoid globals
- **Cross-browser**: webextension-polyfill, verify permissions before manifest updates, mobile Firefox Nightly support required

### Error handling & logging
- **Exceptions**: Follow `notes/exception-handling-policy.md` - don't swallow, let bubble via logger/statusbar, handle only when cause known or able to react
- No naked `console.*` - use logger/statusbar
- **Slots/Categories** = WHAT (domain: `endpoint`, `storage`, `apicall`)
- **Levels** = HOW important (`Error/Warn/Info/Debug`)
- Never embed levels in categories (❌ `endpoint-error`, ✅ `endpoint`)
- Consolidate log calls; include textual msg + objects for inspection

### UI
- Use `rem` units; ensure `dist/` copy for runtime assets"
- **Theme & Constants**: Centralized in `src/theme.css` (110 CSS vars) and `src/ui-constants.ts` (27 icons + colors)
  - Colors: `src/theme.css` defines `--color-primary`, `--color-success`, `--color-danger-*`, etc.
  - Icons: `src/ui-constants.ts` exports `ICONS.SAVE`, `ICONS.DELETE`, etc. as TypeScript consts
  - **popup-pane**: Uses theme variables via `shared-pane.css` (green rgb(69,160,73), banner rgb(241,248,244))
  - **hover-pane**: Uses theme variables via `shared-pane.css` (same colors as popup)
  - **options-pane**: Uses `shared-pane.css` + inline `<style>` (legacy hardcoded colors - not yet refactored)
  - Always use CSS variables (`var(--color-*)`) in shared-pane.css, avoid hardcoding colors in HTML files

## Development process
- When prompts refer to past changes, it may imply 4 things: the past couple of prompts, diffs in git-workspace, staged index or past commits.  Ask if unclear.

### Workflow
After code/HTML/CSS changes:
1. Modify, format & build (verify types, update browser)
  - Build: `npm run build`.
  - Package: `npm run package"`,
  - explore other package.json scripts occasionally.

2. Test, lint, check dupes (`npm test`, `npm run lint`, `npm run dupes`)
3. Update docs (if really needed) and the prepare (or update) SUMMARY.md for commit.
4. **Revert failed experiments** - when code change didn't work or had no visible effect, remove it. But don't retract aggressively - keep changes that work or that the user explicitly praises.  Always inform what you kept.
5. Use MCP with Playwright on tough issues.

### Testing
- Scripts in `package.json`; manual via httpbin.org/anything + `DEFAULT_CONFIG` tweaks
- Debug: broker (about:debugging), content (page console), PING (popup health)

### Quality
- Run after features: `npm run lint`, `npm run dupes`, `npm run dead-code`
- Keep duplication <5%, refactor if >8 clones; see `notes/linting-report.md`
- **Succinct code & docs**: Terseness matters - long code/docs hard to maintain/confuse


## Git
- Segregate commits by functionality (not location)
- Never `git add` files - I plan to split workspace changes into multiple commits
- I rewrite history ([Sausage Making](https://gist.github.com/SethRobertson/1540906/de2387189cc924c2b24ad867e6f81b29a9ced1a7#sausage-making))
- Check if past changes have been committed, when unclear

### SUMMARY.md - Commit Messages

**IMPORTANT**: "summarize" → write to SUMMARY.md

- Document staged/uncommitted changes (`git diff --staged`)
- Lines <90 chars, suitable for git commit

#### Header (1st line):
- Format: semantic commits like `type(scope) phrase` or `type: phrase` (<50 chars)
- Types: feat/enh/refact/drop/chore/doc/style
- End with ` >` if body follows; `;` separates distinct changes

#### Body:
- Present tense (changes), past tense (bugs)
- Big picture first, succinct, use "etc"
- "What" only if non-obvious (skip file listings), focus on "Why"
- NO `#` headers (vim rebase issues), backticks for code, *italics* for concepts, **bold** for emphasis
- Bullets for actions, paragraphs for explanations
- TODOs, performance & sizings(bytes & LoCs) reports at the bottom

### Releases
- Collect commits since last release
- Capitalize = significance: FIX > Fix > fix. Fixes > features > docs
- Merge & consolidate commits by domain (eg logging) per type
