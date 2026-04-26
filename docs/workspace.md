# TokenLens — Workspace Documentation

## Overview

**TokenLens** (package name `token-lens`) is a VS Code extension that displays LLM token usage and cost analytics directly in the VS Code status bar and a sidebar panel. It polls the [z.ai](https://z.ai) cloud API for quota limits, queries the local Kilo SQLite database for per-project and per-day usage data, and fetches OpenRouter pricing data for model cost estimation.

- **Version:** 1.3.0
- **Engine:** VS Code ^1.116.0
- **Language:** TypeScript (strict mode, ES2022, Node16 modules)
- **Build:** esbuild → two bundled files: `dist/extension.js` (CJS, Node) and `dist/webview-client.js` (IIFE, browser)

---

## Architecture

```
src/
├── extension.ts      # Extension entry point — status bar item, commands, quota polling, persisted snapshot recovery, and retry scheduling
├── tokenSidebar.ts   # WebviewViewProvider for the sidebar panel
├── html.ts           # Assembles the sidebar shell HTML from shared webview data/section builders
├── db.ts             # Queries the local Kilo SQLite database via Drizzle ORM on top of the `sql.js` SQLite driver
├── types.ts          # ProjectTokens, DayTokens, ProjectDayTokens, ModelUsage, ModelCost, QuotaSummary, QuotaState, and QuotaStateStatus type definitions
├── bars.ts           # Stacked bar chart HTML helpers and segment colors
├── format.ts         # Number/token formatting, HTML escaping, date formatting
├── model-data.ts     # Fetches and caches OpenRouter model pricing data; maps provider/model IDs to OpenRouter format for later project-level filtering and cost comparisons
├── styles.ts         # All CSS styles for the webview sidebar
├── webview-contract.ts # Shared extension/webview types for chart data, persisted UI state, and payload structure
├── webview-model-cost.ts # Shared model-cost calculation used by both the extension and the webview bundle
├── webview/
│   ├── data.ts       # Builds the serialized webview payload and render metadata from DB/query results
│   ├── document.ts   # Builds the final HTML document, JSON payload script, CSP, nonce, and client bundle tag
│   └── sections.ts   # Renders quota, project, daily, and global cost HTML sections
└── sql.js.d.ts       # Custom type declarations for the sql.js WASM module
webview-ui/
└── src/
    ├── bootstrap.ts  # Reads the JSON payload and persists UI state via VS Code webview state
    ├── charting.ts   # SVG chart, tooltip, legend-toggle, and pie-chart rendering
    ├── cost-panel.ts # Cost filters, model pinning, and project cost-list re-rendering
    ├── daily-list.ts # Virtualized daily cards list and expand/collapse measurement logic
    ├── constants.ts  # Shared browser-side visual constants
    ├── view-helpers.ts # Shared browser-side HTML/token formatting helpers
    └── main.ts       # Browser entrypoint that wires tabs, period aggregation, cards, charts, list virtualization, and cost panel modules
```

### Data Sources

| Source | Location | Purpose |
|--------|----------|---------|
| z.ai API | `https://api.z.ai/api/monitor/usage/quota/limit` | Quota percentage, reset time (status bar) |
| OpenRouter API | `https://openrouter.ai/api/v1/models` | Model pricing data for cost estimation (cached 1 hour; project-level comparisons additionally apply provider and recency filters, while the global cost list applies UI filters client-side) |
| Local DB | `~/.local/share/kilo/kilo.db` | Per-project and per-day token breakdowns (sidebar) |

### UI Components

1. **Status Bar Item** (`extension.ts`)
   - Shows current token usage percentage (e.g. `$(zap) 42%`)
   - Color-coded background: normal → warning (≥50%) → error (≥80%)
   - Rich Markdown tooltip with `Token Lens - zai`, a single-row gradient z.ai usage bar plus percentage, and time until reset
   - Auto-refreshes every 5 minutes
   - Distinguishes loading, missing-key/auth failures, and transient API failures instead of treating every failure as "no API key"
   - Keeps the last successful quota snapshot during transient failures or rate limits, marks it stale, and retries with backoff before returning to the normal 5-minute poll

2. **Sidebar Panel** (`tokenSidebar.ts` + `html.ts` + `src/webview/*` + `styles.ts` + `webview-ui/src/*`)
    - Activity bar icon (`icons/token-stack-lens.svg`; legacy variant: `icons/zai.svg`)
    - Webview with three tabs: **Projects**, **Time**, and **$**
      - **Quota section:** Progress bar showing current quota usage percentage and time until reset (fed by `QuotaSummary` from the z.ai API), plus explicit loading/stale/unavailable/auth states when quota refreshes fail.
      - **Hero section:** Summary stats — today's tokens, total tokens, total cost, and total steps across all projects.
      - **Projects tab:** Expandable cards showing the project name with a total-token badge, per-project token breakdown (input, output, reasoning, cache read/write), cost, step count, session count, and duration. Includes stacked color bar visualization. Expanded view includes per-project SVG line chart, LLM usage breakdown, and model cost estimates from OpenRouter pricing data.
      - **Time tab:** Includes a Daily/Weekly/Monthly period switcher and two sub-views toggled via a Cards/Graph pill switcher:
        - **Cards view:** Virtualized scrollable list of day-by-day usage with horizontal bar charts. Rows support expand/collapse, and the virtual list measures rendered row heights so long lists remain performant even when rows expand.
        - **Graph view:** SVG line charts for Total Tokens (area fill), Token Breakdown (multi-series), Sessions And Steps, and LLM Usage (pie chart). Summary stat labels and chart data update with the active daily/weekly/monthly aggregation, and series can be toggled via legend buttons.
      - **$ tab:** Estimated per-model cost list with provider/sort/age filters. Clicking a model in this list pins it in webview state so the saved models are reused for project-level cost comparisons in the Projects tab.
     - **Data injection:** `src/webview/document.ts` serializes the payload into a `<script type="application/json">` tag; `webview-ui/src/bootstrap.ts` parses that payload and the browser modules render charts client-side.
     - **Webview persistence:** cost filters and pinned models are stored with VS Code webview state (`acquireVsCodeApi().getState()/setState()`) instead of `localStorage`.

### Commands

| Command | ID | Description |
|---------|----|-------------|
| TokenLens: Refresh | `token-lens.refresh` | Manually refreshes both status bar and sidebar |
| TokenLens: Set API Key | `token-lens.setApiKey` | Prompts for API key, stores via VS Code SecretStorage |

### Token Segment Colors

| Segment | Color | Hex |
|---------|-------|-----|
| Input | Blue | `#3794ff` |
| Output | Green | `#89d185` |
| Reasoning | Purple | `#b180d7` |
| Cache Read | Orange | `#d18616` |
| Cache Write | Teal | `#4ec9b0` |

---

## Build & Development

### Prerequisites

- Node.js (with npm)
- VS Code ^1.116.0

### Dependencies

#### Runtime

- `dayjs` - local day bucketing, cache timing, and date-based summary calculations
- `drizzle-orm` - typed query layer over the local Kilo SQLite database
- `sql.js` - WASM SQLite runtime used to read `~/.local/share/kilo/kilo.db`

#### Development

- `@types/node`
- `@types/vscode`
- `esbuild`
- `eslint`
- `npm-run-all`
- `typescript`
- `typescript-eslint`

### Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| test | `npm test` | Runs the regression check for local-time day bucketing in `src/db.ts` |
| compile | `npm run compile` | Type-checks, lints, bundles the extension and webview, then copies the SQL.js WASM asset |
| watch | `npm run watch` | Runs the watch tasks for esbuild and both TypeScript projects in parallel |
| watch:esbuild | `npm run watch:esbuild` | Rebuilds the extension and webview bundles on change |
| watch:tsc | `npm run watch:tsc` | Watches the extension TypeScript project with `--noEmit` |
| watch:webview:tsc | `npm run watch:webview:tsc` | Watches the webview TypeScript project with `--noEmit` |
| copy-wasm | `npm run copy-wasm` | Copies `sql-wasm.wasm` into `dist/` |
| package | `npm run package` | Creates the production extension/webview bundles used for packaging |
| vscode:prepublish | `npm run vscode:prepublish` | Runs the packaging build before publishing a VS Code extension |
| check-types | `npm run check-types` | Type-checks both the extension and webview projects |
| lint | `npm run lint` | Lints `src` and `webview-ui/src` |

### Environment Variables

- None. The extension does not read configuration from `process.env` or `Bun.env`; the z.ai API key is stored in VS Code `SecretStorage`.

### Validation

- `npm test` runs the regression check for local-time day bucketing in `src/db.ts`.

---

## Key Implementation Details

- **API Key Storage:** Uses VS Code's `SecretStorage` API (encrypted, OS-level keychain integration)
- **DB Queries:** Uses Drizzle ORM with the `sql.js` driver (pure WASM SQLite, no native modules) to query the local SQLite database. `src/db.ts` defines typed table metadata for the external Kilo tables it reads (`part`, `message`, `session`, `project`), loads the database into memory from disk, and executes the reporting queries synchronously against that in-memory copy. The six queries are still project totals, day totals, project-day totals, model costs (per project/provider/model), project models (step/token/cost breakdown), and day models. The project, project-day, and model cost queries additionally join the `project` table. Model cost/project-model/day-model queries still extract `providerID` and `modelID` from the `message.data` JSON field through SQLite `json_extract(...)` expressions. All queries filter on `step-finish` type entries. Day grouping applies the runtime local UTC offset directly from `dayjs().utcOffset()` rather than UTC, so daily totals align with the user's actual calendar day.
- **No External CLI Dependencies:** The extension does not require the `sqlite3` CLI or any other external command-line tool to be installed.
- **Webview:** The sidebar uses a webview with scripts enabled, `localResourceRoots` locked to `dist/`, a CSP meta tag, a nonce for the client bundle, and a flex-based layout so the active tab can fill the sidebar reliably.
- **Quota Recovery:** The extension stores the last successful quota snapshot in VS Code `globalState`, restores it for startup recovery when available, clears it on setup/auth errors, and uses timeout-based retry backoff for transient z.ai failures.
- **Daily Virtual List:** The daily tab uses measured-height virtualization with top and bottom spacers. Rendered row heights are cached and recalculated after expand/collapse so scroll positioning stays accurate for long datasets.
- **Runtime Dependencies:** `vscode` remains external to the bundle. `dayjs` is used at runtime for local-day grouping, model-data cache timing, and date-based summaries. `drizzle-orm` is bundled into `dist/extension.js` as the typed query layer. `sql.js` still provides the runtime SQLite engine, so the packaged extension must include `node_modules/sql.js`; its `sql-wasm.wasm` asset is also copied into `dist/` for `locateFile` to resolve. The webview loads `dist/webview-client.js`, which now boots from a JSON payload script rather than `window.__TOKEN_LENS_DATA__`.
- **Model Cost Estimation:** `model-data.ts` fetches model pricing from the OpenRouter API (`/api/v1/models`) and caches it in memory for 1 hour. Provider IDs from the local DB are mapped to OpenRouter format via `PROVIDER_ID_MAP`. Project-level cost comparisons in `src/webview/data.ts` and `src/webview/sections.ts` apply the allowed-provider list (openai, deepseek, moonshotai, anthropic, z-ai, qwen, minimax) and a 90-day recency window before computing costs from input, output, reasoning, and cache-read token totals. The global Cost tab starts from the fetched pricing list and applies provider/sort/age filters in the webview UI.

---

## File Reference

| File | Purpose |
|------|---------|
| `package.json` | Extension manifest, contributions, scripts |
| `esbuild.js` | Build script — bundles `src/extension.ts` into `dist/extension.js` and `webview-ui/src/main.ts` into `dist/webview-client.js` |
| `tsconfig.json` | TypeScript config (strict, ES2022, Node16, `skipLibCheck` enabled for dependency compatibility) |
| `eslint.config.mjs` | ESLint flat config with typescript-eslint |
| `.vscodeignore` | Files excluded from the packaged `.vsix`, with `.kilo/**` excluded and `node_modules/sql.js` explicitly re-included for runtime loading |
| `test/db-timezone.test.mjs` | Node regression test that verifies local day bucketing keeps the correct timezone offset sign |
| `src/webview-contract.ts` | Shared extension/webview payload and persisted-state types |
| `src/webview-model-cost.ts` | Shared model-cost calculator used on both sides of the webview boundary |
| `src/webview/data.ts` | Server-side webview payload builder |
| `src/webview/document.ts` | Webview HTML document builder with JSON payload + CSP |
| `src/webview/sections.ts` | Server-side HTML section renderers for the sidebar |
| `webview-ui/tsconfig.json` | TypeScript config for browser-side code and shared cross-boundary files |
| `webview-ui/src/bootstrap.ts` | Webview payload parsing and VS Code state persistence |
| `webview-ui/src/charting.ts` | Browser-side chart and tooltip rendering |
| `webview-ui/src/cost-panel.ts` | Browser-side cost filter/model pin interactions |
| `webview-ui/src/daily-list.ts` | Browser-side daily virtual list controller |
| `icons/token-stack-lens.svg` | Current activity bar icon for the sidebar: stacked tokens with a magnifying lens |
| `icons/zai.svg` | Legacy activity bar icon asset |
| `icons/logo.png` | Extension marketplace icon (used in `package.json` `"icon"`) |
| `CHANGELOG.md` | Release notes (currently unreleased) |
