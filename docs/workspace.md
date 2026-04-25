# TokenLens — Workspace Documentation

## Overview

**TokenLens** (package name `token-lens`) is a VS Code extension that displays LLM token usage from the [z.ai](https://z.ai) provider directly in the VS Code status bar and a sidebar panel. It queries both the z.ai cloud API for quota limits and a local SQLite database for per-project and per-day token breakdowns.

- **Version:** 1.0.0
- **Engine:** VS Code ^1.116.0
- **Language:** TypeScript (strict mode, ES2022, Node16 modules)
- **Build:** esbuild → two bundled files: `dist/extension.js` (CJS, Node) and `dist/webview-client.js` (IIFE, browser)

---

## Architecture

```
src/
├── extension.ts      # Extension entry point — status bar item, commands, timer; defines QuotaResponse/Limit/UsageDetail inline types
├── tokenSidebar.ts   # WebviewViewProvider for the sidebar panel
├── html.ts           # Generates the full sidebar HTML (hero stats, project cards, daily virtual list, SVG line charts)
├── db.ts             # Queries the local Kilo SQLite database via `sql.js` npm package (pure WASM, no native modules)
├── types.ts          # ProjectTokens, DayTokens, ProjectDayTokens, ModelUsage, ModelCost, and QuotaSummary type definitions
├── bars.ts           # Stacked bar chart HTML helpers and segment colors
├── format.ts         # Number/token formatting, HTML escaping, date formatting
├── model-data.ts     # Fetches and caches OpenRouter model pricing data; maps provider/model IDs to OpenRouter format; filters by provider allow-list and 90-day recency
├── styles.ts         # All CSS styles for the webview sidebar
├── client-script.ts  # Generates the inline `<script>` that injects `window.__TOKEN_LENS_DATA__` into the webview
└── sql.js.d.ts       # Custom type declarations for the sql.js WASM module
webview-ui/
└── src/
    └── main.ts       # Client-side JS (bundled to dist/webview-client.js): SVG line chart rendering, pie chart, tooltip system, legend toggle, virtual list, tab/card interactions
```

### Data Sources

| Source | Location | Purpose |
|--------|----------|---------|
| z.ai API | `https://api.z.ai/api/monitor/usage/quota/limit` | Quota percentage, reset time (status bar) |
| OpenRouter API | `https://openrouter.ai/api/v1/models` | Model pricing data for cost estimation (cached 1 hour, filtered by provider allow-list and 90-day recency) |
| Local DB | `~/.local/share/kilo/kilo.db` | Per-project and per-day token breakdowns (sidebar) |

### UI Components

1. **Status Bar Item** (`extension.ts`)
   - Shows current token usage percentage (e.g. `$(zap) 42%`)
   - Color-coded background: normal → warning (≥50%) → error (≥80%)
   - Rich Markdown tooltip with `Token Lens - zai`, a single-row gradient z.ai usage bar plus percentage, and time until reset
   - Auto-refreshes every 5 minutes
   - Falls back to "TokenLens ?" with prompt to set API key if none is stored

2. **Sidebar Panel** (`tokenSidebar.ts` + `html.ts` + `styles.ts` + `client-script.ts` + `webview-ui/src/main.ts`)
   - Activity bar icon (`icons/token-stack-lens.svg`; legacy variant: `icons/zai.svg`)
   - Webview with two tabs: **Projects** and **Daily**
     - **Quota section:** Progress bar showing current quota usage percentage and time until reset (fed by `QuotaSummary` from the z.ai API).
     - **Hero section:** Summary stats — today's tokens, total tokens, total cost, and total steps across all projects.
     - **Projects tab:** Expandable cards showing the project name with a total-token badge, per-project token breakdown (input, output, reasoning, cache read/write), cost, step count, session count, and duration. Includes stacked color bar visualization. Expanded view includes per-project SVG line chart, LLM usage breakdown, and model cost estimates from OpenRouter pricing data.
     - **Daily tab:** Two sub-views toggled via a Cards/Graph pill switcher:
       - **Cards view:** Virtualized scrollable list of day-by-day usage with horizontal bar charts. Rows support expand/collapse, and the virtual list measures rendered row heights so long lists remain performant even when rows expand.
       - **Graph view:** SVG line charts for Total Tokens (area fill), Token Breakdown (multi-series), Sessions And Steps, and LLM Usage (pie chart). Shows Latest Day, Average/Day, and Peak summary stats. Series can be toggled via legend buttons.
    - **Data injection:** `client-script.ts` serializes chart data as `window.__TOKEN_LENS_DATA__` inline; `webview-ui/src/main.ts` (loaded as `dist/webview-client.js`) reads it and renders charts client-side.

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

---

## Key Implementation Details

- **API Key Storage:** Uses VS Code's `SecretStorage` API (encrypted, OS-level keychain integration)
- **DB Queries:** Uses the `sql.js` npm package (pure WASM SQLite, no native modules) to query the local SQLite database. The database is loaded into memory from disk and queries are executed synchronously against the in-memory copy. Six queries join `part`, `message`, `session` tables: project totals, day totals, project-day totals, model costs (per project/provider/model), project models (step/token/cost breakdown), and day models. The project, project-day, and model cost queries additionally join the `project` table. Model cost/project-model/day-model queries extract `providerID` and `modelID` from the `message.data` JSON field. All queries filter on `step-finish` type entries. Day grouping uses the local timezone offset (computed from `new Date().getTimezoneOffset()`) rather than UTC, so daily totals align with the user's actual calendar day.
- **No External CLI Dependencies:** The extension does not require the `sqlite3` CLI or any other external command-line tool to be installed.
- **Webview:** The sidebar uses a webview with scripts enabled and a flex-based layout so the active tab can fill the sidebar reliably.
- **Daily Virtual List:** The daily tab uses measured-height virtualization with top and bottom spacers. Rendered row heights are cached and recalculated after expand/collapse so scroll positioning stays accurate for long datasets.
- **Runtime Dependencies:** `vscode` remains external to the bundle. `sql.js` is loaded at runtime by `dist/extension.js`, so the packaged extension must include `node_modules/sql.js`; its `sql-wasm.wasm` asset is also copied into `dist/` for `locateFile` to resolve. The webview loads `dist/webview-client.js` (client-side charting/interaction code bundled from `webview-ui/src/main.ts`).
- **Model Cost Estimation:** `model-data.ts` fetches model pricing from the OpenRouter API (`/api/v1/models`), caches it in memory for 1 hour, and filters models by an allowed-provider list (openai, deepseek, moonshotai, anthropic, z-ai, qwen, minimax) and a 90-day recency window. Provider IDs from the local DB are mapped to OpenRouter format via `PROVIDER_ID_MAP`. Costs are computed per-project by multiplying token counts (input, output, reasoning, cache read) by the model's pricing rates.

---

## File Reference

| File | Purpose |
|------|---------|
| `package.json` | Extension manifest, contributions, scripts |
| `esbuild.js` | Build script — bundles `src/extension.ts` into `dist/extension.js` and `webview-ui/src/main.ts` into `dist/webview-client.js` |
| `tsconfig.json` | TypeScript config (strict, ES2022, Node16) |
| `eslint.config.mjs` | ESLint flat config with typescript-eslint |
| `.vscodeignore` | Files excluded from the packaged `.vsix`, with `.kilo/**` excluded and `node_modules/sql.js` explicitly re-included for runtime loading |
| `webview-ui/tsconfig.json` | TypeScript config for browser-side code (ES2022, DOM libs, bundler module resolution) |
| `icons/token-stack-lens.svg` | Current activity bar icon for the sidebar: stacked tokens with a magnifying lens |
| `icons/zai.svg` | Legacy activity bar icon asset |
| `icons/logo.png` | Extension marketplace icon (used in `package.json` `"icon"`) |
| `CHANGELOG.md` | Release notes (currently unreleased) |
