# Change Log

All notable changes to the "Token Lens" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [1.6.0]

- Migrated webview styling to Tailwind CSS for maintainability.
- Added a settings panel and lazy loading for webview components.
- Enhanced pricing UX with improved model cost comparison and identification.
- Optimized data loading performance in the webview.
- Simplified token labels in summary and project cards.

## [1.5.3]

- Updated marketplace badge image format.

## [1.5.2]

- Added VS Code Marketplace badge to the README.
- Updated tagline and streamlined the feature list.
- Updated landing image format to JPG.

## [1.5.1]

- Updated changelog and landing image for version 1.5.0.

## [1.5.0]

- Rewrote the webview UI using Preact for a lighter runtime.
- Added a handshake protocol and race condition protection for webview messaging.
- Implemented incremental data updates and cost tooltips in the analytics view.
- Added model usage highlighting in cost comparison lists.
- Modularized webview components and enhanced time/cost views.
- Migrated the development runtime from npm to Bun.

## [1.4.0]

- Migrated the database layer to Drizzle ORM and enhanced webview capabilities.
- Added timezone regression tests and improved cost estimation accuracy.
- Implemented robust quota recovery and enhanced status reporting.
- Improved daily chart styling and workspace documentation.

## [1.3.0]

- Refactored the webview into a more modular, contract-based client architecture.

## [1.2.0]

- Added collapsible cost filters in the analytics UI.
- Improved data flow between the extension host and webview.

## [1.1.0]

- Added model usage and cost analytics to the UI.
- Improved cost estimation to account for reasoning and cached tokens.

## [1.0.0]

- Promoted Token Lens to its first stable `1.0` release.

## [0.1.4]

- Updated packaging to include the `tokenlens` module.
- Refreshed workspace documentation around runtime dependencies and packaging.

## [0.1.3]

- Adjusted icon dimensions.
- Updated the packaged `sql.js` file location.

## [0.1.2]

- Updated the build pipeline and packaged assets.

## [0.1.1]

- Initial public release of Token Lens for visualizing LLM token usage.
- Added quota summaries, daily project usage queries, and SQL.js-backed local storage.
- Improved the sidebar and status bar UI, and finalized the project rename and package metadata updates.
