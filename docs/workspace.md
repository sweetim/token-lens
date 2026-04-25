# TokenLens — Workspace Documentation

## Overview

**TokenLens** (package name `token-lens`) is a VS Code extension that displays LLM token usage from the [z.ai](https://z.ai) provider directly in the VS Code status bar and a sidebar panel. It queries both the z.ai cloud API for quota limits and a local SQLite database for per-project and per-day token breakdowns.

- **Version:** 0.0.1
- **Engine:** VS Code ^1.116.0
- **Language:** TypeScript (strict mode, ES2022, Node16 modules)
- **Build:** esbuild → single bundled CJS file at `dist/extension.js`

---

## Architecture

```
src/
├── extension.ts      # Extension entry point — status bar item, commands, timer; defines QuotaResponse/Limit/UsageDetail inline types
├── tokenSidebar.ts   # WebviewViewProvider for the sidebar panel
├── html.ts           # Generates the full sidebar HTML (hero stats, project cards, daily virtual list, SVG line charts)
├── db.ts             # Queries the local Kilo SQLite database via `sqlite3` CLI
├── types.ts          # ProjectTokens, DayTokens, ProjectDayTokens, and QuotaSummary type definitions
├── bars.ts           # Stacked bar chart HTML helpers and segment colors
└── format.ts         # Number/token formatting, HTML escaping, date formatting
```

### Data Sources

| Source | Location | Purpose |
|--------|----------|---------|
| z.ai API | `https://api.z.ai/api/monitor/usage/quota/limit` | Quota percentage, reset time (status bar) |
| Local DB | `~/.local/share/kilo/kilo.db` | Per-project and per-day token breakdowns (sidebar) |

### UI Components

1. **Status Bar Item** (`extension.ts`)
   - Shows current token usage percentage (e.g. `$(zap) 42%`)
   - Color-coded background: normal → warning (≥50%) → error (≥80%)
   - Rich Markdown tooltip with gradient usage bar, percentage, and time until reset
   - Auto-refreshes every 5 minutes
   - Falls back to "TokenLens ?" with prompt to set API key if none is stored

2. **Sidebar Panel** (`tokenSidebar.ts` + `html.ts`)
   - Activity bar icon (uses `icons/zai.svg`)
   - Webview with two tabs: **Projects** and **Daily**
    - **Quota section:** Progress bar showing current quota usage percentage and time until reset (fed by `QuotaSummary` from the z.ai API).
    - **Hero section:** Summary stats — today's tokens, total tokens, total cost, and total steps across all projects.
    - **Projects tab:** Expandable cards showing per-project token breakdown (input, output, reasoning, cache read/write), cost, step count, session count, and duration. Includes stacked color bar visualization.
    - **Daily tab:** Two sub-views toggled via a Cards/Graph pill switcher:
      - **Cards view:** Virtualized scrollable list of day-by-day usage with horizontal bar charts. Rows support expand/collapse, and the virtual list measures rendered row heights so long lists remain performant even when rows expand.
      - **Graph view:** SVG line charts for Total Tokens (area fill), Token Breakdown (multi-series), and Sessions And Steps. Shows Latest Day, Average/Day, and Peak summary stats.

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
- `sqlite3` CLI (required at runtime for local DB queries)

---

## Key Implementation Details

- **API Key Storage:** Uses VS Code's `SecretStorage` API (encrypted, OS-level keychain integration)
- **DB Queries:** Invokes the `sqlite3` CLI via `child_process.execFile` with `-json` flag, parsing the JSON output. Queries join `part`, `message`, `session` tables; the project and project-day queries additionally join the `project` table. All queries filter on `step-finish` type entries. Day grouping uses the local timezone offset (computed from `new Date().getTimezoneOffset()`) rather than UTC, so daily totals align with the user's actual calendar day.
- **Webview:** The sidebar uses a webview with scripts enabled and a flex-based layout so the active tab can fill the sidebar reliably.
- **Daily Virtual List:** The daily tab uses measured-height virtualization with top and bottom spacers. Rendered row heights are cached and recalculated after expand/collapse so scroll positioning stays accurate for long datasets.
- **No External Runtime Dependencies:** The extension bundle has zero runtime npm dependencies — only `vscode` is externalized.

---

## File Reference

| File | Purpose |
|------|---------|
| `package.json` | Extension manifest, contributions, scripts |
| `esbuild.js` | Build script — bundles `src/extension.ts` into `dist/extension.js` |
| `tsconfig.json` | TypeScript config (strict, ES2022, Node16) |
| `eslint.config.mjs` | ESLint flat config with typescript-eslint |
| `.vscodeignore` | Files excluded from the packaged `.vsix` |
| `icons/zai.svg` | Activity bar icon for the sidebar |
| `CHANGELOG.md` | Release notes (currently unreleased) |
