# Token Usage Info

Visualize your LLM provider token usage directly in the VS Code status bar.

## Supported Providers

- [z.ai](https://z.ai)

## Features

- Displays current token usage percentage in the status bar
- Color-coded status: normal, warning (≥50%), and error (≥80%)
- Rich tooltip with a one-line z.ai usage bar plus percentage, and time until reset
- Sidebar with daily and per-project token usage breakdown
- Auto-refreshes every 5 minutes
- API key stored securely using VS Code's SecretStorage
- Day grouping uses local timezone (not UTC)

## Commands

| Command | Description |
|---|---|
| `Token Usage: Set API Key` | Enter your provider API key (stored securely) |
| `Token Usage: Refresh Token Usage` | Manually refresh token usage data |

## Getting Started

1. Install the extension
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run **Token Usage: Set API Key** and enter your API key
4. Token usage appears in the status bar on the right side
