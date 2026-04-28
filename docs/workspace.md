# TokenLens — Workspace Documentation

## Overview

**TokenLens** (package name `token-lens`) is a VS Code extension that displays LLM token usage and cost analytics directly in the VS Code status bar and a sidebar panel. It polls the [z.ai](https://z.ai) cloud API for quota limits, queries the local Kilo SQLite database for per-project and per-day usage data, and fetches OpenRouter pricing data for model cost estimation.

- **Version:** 1.5.3
- **Engine:** VS Code ^1.116.0
- **Language:** TypeScript (strict mode, ES2022, Node16 modules)
- **Build:** esbuild → `dist/extension.js` (CJS, Node), `dist/webview-client.js` (IIFE, browser), and `dist/webview-client.css` (Tailwind-processed webview CSS)

---

## Architecture

```
src/
├── extension.ts      # Extension entry point — status bar item, commands, quota polling, persisted snapshot recovery, and retry scheduling
├── tokenSidebar.ts   # WebviewViewProvider for the sidebar panel; uses HTML injection on first load, then postMessage for incremental updates
├── html.ts           # Thin wrapper that delegates to webview/data.ts and webview/document.ts to build the sidebar HTML
├── db.ts             # Queries the local Kilo SQLite database via Drizzle ORM on top of the `sql.js` SQLite driver
├── types.ts          # ProjectTokens, DayTokens, ProjectDayTokens, ModelUsage, ModelCost, QuotaSummary, QuotaState, and QuotaStateStatus type definitions
├── bars.ts           # Stacked bar chart HTML helpers and segment colors
├── format.ts         # Number/token formatting, HTML escaping, date formatting
├── model-data.ts     # Fetches and caches OpenRouter model pricing data; maps provider/model IDs to OpenRouter format for later project-level filtering and cost comparisons
├── webview-contract.ts # Shared extension/webview types for chart data, persisted UI state, settings, message payloads, and payload structure
├── webview-model-cost.ts # Shared model-cost calculation used by both the extension and the webview bundle
├── webview/
│   ├── data.ts       # Builds the serialized webview payload and render metadata from DB/query results
│   └── document.ts   # Builds the final HTML document, JSON payload script, CSP, nonce, and client bundle tag
└── sql.js.d.ts       # Custom type declarations for the sql.js WASM module
webview-ui/
└── src/
    ├── bootstrap.ts  # Reads the JSON payload, persists UI state via VS Code webview state, and listens for postMessage data updates
    ├── main.tsx      # Browser entrypoint that hydrates the Preact app, imports Tailwind, applies VS Code theme variables, handles incremental payload updates and settings state
    ├── App.tsx       # Top-level tab switcher that wires shared payload data into the UI sections; conditionally renders SettingsPanel
    ├── constants.ts  # Shared browser-side visual constants
    ├── view-helpers.ts # Shared browser-side HTML/token formatting helpers
    ├── tailwind.css  # Minimal Tailwind utilities entry processed by the esbuild Tailwind plugin
    ├── components/
    │   ├── QuotaSection.tsx      # Quota usage hero with reset timing and progress state rendering
    │   ├── HeroSection.tsx       # High-level token/cost summary hero for the sidebar landing area
    │   ├── TabsBar.tsx           # Shared tab strip for switching between Projects, Time, and Cost views
    │   ├── ProjectCard.tsx       # Project-level expandable card with stats, chart, model usage, and model-cost comparison
    │   ├── TimeTab.tsx           # Daily/weekly/monthly aggregation controller for the Time tab
    │   ├── DailyToolbar.tsx      # Time-tab period and cards/graph view toggles
    │   ├── DailyCardsView.tsx    # Intersection-observer lazy-loaded day list renderer for the Time tab cards view
    │   ├── DayCard.tsx           # Expandable per-day card with token bars, model usage, and model-cost comparison
    │   ├── DailyGraphView.tsx    # Time-tab graph panel with summary stats, line charts, and model pie chart
    │   ├── Chart.tsx             # Shared line and pie chart rendering for project and daily analytics
    │   ├── CostTab.tsx           # Cost-tab container that manages provider, sort, and age filter state
    │   ├── CostFiltersPanel.tsx  # Cost-tab filter controls and collapse state UI
    │   ├── CostTokenSummary.tsx  # Cost-tab token summary strip
    │   ├── ModelCostComparisonList.tsx # Shared model-cost list used by project, day, and cost views
    │   ├── AnchoredTooltip.tsx   # Shared anchored tooltip behavior for model-cost info affordances
    │   └── SettingsPanel.tsx     # Settings panel for API key, database path display, and refresh interval configuration
    └── hooks/
        └── useIntersectionLazyLoad.ts # Shared intersection-observer hook for lazy-loading list items in batches of 20
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
   - Auto-refreshes on a configurable interval (default 5 minutes, adjustable via Settings panel)
   - Distinguishes loading, missing-key/auth failures, and transient API failures instead of treating every failure as "no API key"
   - Keeps the last successful quota snapshot during transient failures or rate limits, marks it stale, and retries with backoff before returning to the normal 5-minute poll

2. **Sidebar Panel** (`tokenSidebar.ts` + `html.ts` + `src/webview/*` + `webview-ui/src/*`)
    - Activity bar icon (`icons/token-stack-lens.svg`; legacy variant: `icons/zai.svg`)
    - Webview with three tabs: **Projects**, **Time**, and **Cost**
      - **Quota section:** Progress bar showing current quota usage percentage and time until reset (fed by the serialized `QuotaStateData.summary` subset of `QuotaSummary`), plus explicit loading/stale/unavailable/auth states when quota refreshes fail.
      - **Hero section:** Summary stats — today's tokens, total tokens, total cost, and total steps across all projects.
      - **Projects tab:** Expandable cards showing the project name with a total-token badge, per-project token breakdown (input, output, reasoning, cache read/write), cost, step count, session count, and duration. Includes stacked color bar visualization. Expanded view includes per-project SVG line chart, LLM usage breakdown, and model cost estimates from OpenRouter pricing data with inline loading/unavailable states while pricing refreshes.
      - **Time tab:** Includes a Daily/Weekly/Monthly period switcher and two sub-views toggled via a Cards/Graph pill switcher:
        - **Cards view:** Intersection-observer-based lazy-loaded list of day-by-day usage with horizontal bar charts. Each day's bars are scaled relative to that day's highest token type value (not across all days), so the dominant token type always fills 100%. Rows support expand/collapse.
        - **Graph view:** SVG line charts for Total Tokens (area fill), Token Breakdown (multi-series), Sessions And Steps, and LLM Usage (pie chart). Summary stat labels and chart data update with the active daily/weekly/monthly aggregation, and series can be toggled via legend buttons.
      - **Cost tab:** Estimated per-model cost list with provider/sort/age filters. The tab displays the current OpenRouter pricing status, disables filters while pricing is unavailable or still loading, and shows skeleton rows instead of silently hiding pricing results during refresh. Clicking a model in this list pins it in webview state so the saved models are included alongside project/period-specific models in cost comparisons across the Projects and Time tabs.
     - **Data injection:** On first load, `src/webview/document.ts` serializes the payload into a `<script type="application/json">` tag and `webview-ui/src/bootstrap.ts` parses it. After the Preact root attaches its message listener, it sends a `{ type: "ready" }` handshake so the extension can safely replay the latest payload. The sidebar provider only applies the latest completed refresh, so slower stale refreshes cannot overwrite a newer quota snapshot. Subsequent updates are sent via `postMessage` with a `{ type: "fullUpdate", data: WebviewData }` message, received by the `Root` wrapper in `webview-ui/src/main.tsx` which updates Preact state incrementally — preserving scroll position, active tab, expanded cards, and filter state.
     - **Webview persistence:** cost filters and pinned models are stored with VS Code webview state (`acquireVsCodeApi().getState()/setState()`) instead of `localStorage`.

### Commands

| Command | ID | Description |
|---------|----|-------------|
| TokenLens: Refresh | `token-lens.refresh` | Manually refreshes both status bar and sidebar |
| TokenLens: Set API Key | `token-lens.setApiKey` | Prompts for API key, stores via VS Code SecretStorage |
| TokenLens: Settings | `token-lens.openSettings` | Shows the in-webview settings panel for API key, database path, and refresh interval when the sidebar view is already available |

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

- Bun
- VS Code ^1.116.0

### Dependencies

#### Runtime

- `dayjs` - local day bucketing, cache timing, and date-based summary calculations
- `drizzle-orm` - typed query layer over the local Kilo SQLite database
- `preact` - lightweight React-compatible library for the webview sidebar UI
- `sql.js` - WASM SQLite runtime used to read `~/.local/share/kilo/kilo.db`

#### Development

- `@types/node`
- `@types/vscode`
- `esbuild`
- `esbuild-plugin-tailwindcss`
- `eslint`
- `tailwindcss`
- `typescript`
- `typescript-eslint`

### Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| test | `bun test` | Runs the regression check for local-timezone day bucketing in `src/db.ts` |
| compile | `bun run compile` | Type-checks, lints, bundles the extension plus webview JS/CSS, then copies the SQL.js WASM asset |
| watch | `bun run watch` | Runs the esbuild watcher and both TypeScript project watchers in parallel |
| watch:esbuild | `bun run watch:esbuild` | Rebuilds the extension bundle and webview JS/CSS bundles on change |
| watch:tsc | `bun run watch:tsc` | Watches the extension TypeScript project with `--noEmit` |
| watch:webview:tsc | `bun run watch:webview:tsc` | Watches the webview TypeScript project with `--noEmit` |
| copy-wasm | `bun run copy-wasm` | Copies `sql-wasm.wasm` into `dist/` |
| package | `bun run package` | Creates the production extension/webview bundles used for packaging |
| vscode:prepublish | `bun run vscode:prepublish` | Runs the packaging build before publishing a VS Code extension |
| check-types | `bun run check-types` | Type-checks both the extension and webview projects |
| lint | `bun run lint` | Lints `src` and `webview-ui/src` |

### VS Code Debug Tasks

- `F5` uses the default `.vscode/tasks.json` `watch` task. That task first runs `bun esbuild.js` once so `dist/webview-client.css` exists before the extension host launches, then starts the extension TypeScript and esbuild watchers for subsequent debug edits.

### Environment Variables

- None. The extension does not read configuration from `process.env` or `Bun.env`; the z.ai API key is stored in VS Code `SecretStorage`.

### Validation

- `bun test` runs the regression check for local-time day bucketing in `src/db.ts`.

---

## Key Implementation Details

- **API Key Storage:** Uses VS Code's `SecretStorage` API (encrypted, OS-level keychain integration)
- **DB Queries:** Uses Drizzle ORM with the `sql.js` driver (pure WASM SQLite, no native modules) to query the local SQLite database. `src/db.ts` defines typed table metadata for the external Kilo tables it reads (`part`, `message`, `session`, `project`), loads the database into memory from disk, and executes the reporting queries synchronously against that in-memory copy. The six queries are still project totals, day totals, project-day totals, model costs (per project/provider/model), project models (step/token/cost breakdown), and day models. The project, project-day, and model cost queries additionally join the `project` table. Model cost/project-model/day-model queries still extract `providerID` and `modelID` from the `message.data` JSON field through SQLite `json_extract(...)` expressions. All queries filter on `step-finish` type entries. Day grouping applies the runtime local UTC offset directly from `dayjs().utcOffset()` rather than UTC, so daily totals align with the user's actual calendar day.
- **No External CLI Dependencies:** The extension does not require the `sqlite3` CLI or any other external command-line tool to be installed.
- **Webview:** The sidebar uses a webview with scripts enabled, `localResourceRoots` locked to `dist/`, a CSP meta tag, a nonce for the client bundle, and a flex-based layout so the active tab can fill the sidebar reliably. On first load the full HTML document is injected with all data; subsequent data updates are pushed via `postMessage` to avoid destroying Preact component state (scroll position, tab selection, expanded cards, filters).
- **Quota Recovery:** The extension stores the last successful quota snapshot in VS Code `globalState`, restores it for startup recovery when available, clears it on setup/auth errors, and uses timeout-based retry backoff for transient z.ai failures.
- **Daily Virtual List:** The daily tab, projects list, and model cost comparison lists use intersection observer-based lazy loading via a shared `useIntersectionLazyLoad` hook. Items are rendered in batches of 20 as the user scrolls — a sentinel element at the bottom of the visible items triggers the next batch via `IntersectionObserver`.
- **Runtime Dependencies:** `vscode` remains external to the bundle. `dayjs` is used at runtime for local-day grouping, model-data cache timing, and date-based summaries. `drizzle-orm` is bundled into `dist/extension.js` as the typed query layer. `sql.js` still provides the runtime SQLite engine, so the packaged extension must include `node_modules/sql.js`; its `sql-wasm.wasm` asset is also copied into `dist/` for `locateFile` to resolve. The webview loads `dist/webview-client.js` and inlines the esbuild-generated `dist/webview-client.css`, booting from a JSON payload script rather than `window.__TOKEN_LENS_DATA__`.
- **Model Cost Estimation:** `model-data.ts` fetches model pricing from the OpenRouter API (`/api/v1/models`) and caches it in memory for 1 hour. The serialized `WebviewData.pricingState` reports `loading`, `ready`, `cached`, or `unavailable` so the webview can keep token usage visible while showing inline pricing status, skeleton rows, cached-price notices, or unavailable messaging. Provider IDs from the local DB are mapped to OpenRouter format via `PROVIDER_ID_MAP`. Project-derived cost comparison model IDs in `src/webview/data.ts` apply the allowed-provider list (openai, deepseek, moonshotai, anthropic, z-ai, qwen, minimax) and a 90-day recency window before costs are computed from input, output, reasoning, and cache-read token totals. Models pinned from the global Cost tab are appended client-side to project and period comparisons without reapplying those provider/age filters. The global Cost tab starts from the fetched pricing list and applies provider/sort/age filters in the webview UI. Browser-side model-cost comparison rows expose a hover/focus popover that shows each token type's per-million-token price and the estimated-cost formula breakdown.
- **Settings Panel:** The extension exposes an in-webview settings panel (`webview-ui/src/components/SettingsPanel.tsx`) triggered by the `token-lens.openSettings` command when the sidebar webview already exists. The command asks the sidebar provider to send a `showSettings` inbound message to the webview, which requests current settings via `requestSettings`. The extension responds with `settingsData` containing `hasApiKey`, `refreshIntervalMinutes`, and `databasePath`. The webview can save a new API key (`saveApiKey`) or refresh interval (`saveRefreshInterval`) back to the extension, which persists them via SecretStorage and globalState respectively.

---

## File Reference

| File | Purpose |
|------|---------|
| `package.json` | Extension manifest, contributions, scripts |
| `esbuild.js` | Build script — bundles `src/extension.ts` into `dist/extension.js`, `webview-ui/src/main.tsx` into `dist/webview-client.js`, and Tailwind-processed CSS into `dist/webview-client.css` |
| `tsconfig.json` | TypeScript config (strict, ES2022, Node16, `skipLibCheck` enabled for dependency compatibility) |
| `eslint.config.mjs` | ESLint flat config with typescript-eslint |
| `.vscodeignore` | Files excluded from the packaged `.vsix`, with `.kilo/**` excluded and `node_modules/sql.js` explicitly re-included for runtime loading |
| `test/db-timezone.test.mjs` | Node regression test that verifies local day bucketing keeps the correct timezone offset sign |
| `src/webview-contract.ts` | Shared extension/webview payload, pricing state, message (`WebviewInboundMessage`/`WebviewOutboundMessage`), settings (`SettingsData`), and persisted-state types |
| `src/webview-model-cost.ts` | Shared model-cost calculator used on both sides of the webview boundary |
| `src/webview/data.ts` | Server-side webview payload builder |
| `src/webview/document.ts` | Webview HTML document builder with JSON payload + CSP |
| `webview-ui/tsconfig.json` | TypeScript config for browser-side code and shared cross-boundary files |
| `webview-ui/src/bootstrap.ts` | Webview payload parsing and VS Code state persistence |
| `webview-ui/src/main.tsx` | Webview root that hydrates the Preact app, imports the local Tailwind entrypoint, applies VS Code theme variables, and handles incremental payload updates |
| `webview-ui/src/App.tsx` | Top-level tab switcher that wires shared payload data into the UI sections; conditionally renders SettingsPanel |
| `webview-ui/src/tailwind.css` | Minimal Tailwind utilities entry processed by the esbuild Tailwind plugin |
| `webview-ui/src/constants.ts` | Shared browser-side presentation constants such as model colors |
| `webview-ui/src/view-helpers.ts` | Small browser-side format helpers used across the webview components |
| `webview-ui/src/components/QuotaSection.tsx` | Quota usage hero with reset timing and progress state rendering |
| `webview-ui/src/components/HeroSection.tsx` | High-level token/cost summary hero for the sidebar landing area |
| `webview-ui/src/components/TabsBar.tsx` | Shared tab strip for switching between Projects, Time, and Cost views |
| `webview-ui/src/components/ProjectCard.tsx` | Project-level expandable card with stats, chart, model usage, and model-cost comparison |
| `webview-ui/src/components/TimeTab.tsx` | Daily/weekly/monthly aggregation controller for the Time tab |
| `webview-ui/src/components/DailyToolbar.tsx` | Time-tab period and cards/graph view toggles |
| `webview-ui/src/components/DailyCardsView.tsx` | Intersection-observer lazy-loaded day list renderer for the Time tab cards view |
| `webview-ui/src/components/DayCard.tsx` | Expandable per-day card with token bars, model usage, and model-cost comparison |
| `webview-ui/src/components/DailyGraphView.tsx` | Time-tab graph panel with summary stats, line charts, and model pie chart |
| `webview-ui/src/components/Chart.tsx` | Shared line and pie chart rendering for project and daily analytics |
| `webview-ui/src/components/CostTab.tsx` | Cost-tab container that manages provider, sort, and age filter state |
| `webview-ui/src/components/CostFiltersPanel.tsx` | Cost-tab filter controls and collapse state UI |
| `webview-ui/src/components/CostTokenSummary.tsx` | Cost-tab token summary strip |
| `webview-ui/src/components/ModelCostComparisonList.tsx` | Shared model-cost list used by project, day, and cost views |
| `webview-ui/src/components/AnchoredTooltip.tsx` | Shared anchored tooltip behavior for model-cost info affordances |
| `webview-ui/src/components/SettingsPanel.tsx` | In-webview settings panel for API key, database path display, and refresh interval configuration |
| `webview-ui/src/hooks/useIntersectionLazyLoad.ts` | Shared intersection-observer hook for lazy-loading list items in batches of 20 |
| `icons/token-stack-lens.svg` | Current activity bar icon for the sidebar: stacked tokens with a magnifying lens |
| `icons/zai.svg` | Legacy activity bar icon asset |
| `icons/logo.png` | Extension marketplace icon (used in `package.json` `"icon"`) |
| `CHANGELOG.md` | Release notes (currently unreleased) |
