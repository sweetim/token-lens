const STYLES = `
  :root {
    --fg: var(--vscode-foreground);
    --bg: var(--vscode-sideBar-background);
    --muted: var(--vscode-descriptionForeground);
    --accent: var(--vscode-charts-blue, #3794ff);
    --accent2: var(--vscode-charts-purple, #b180d7);
    --green: var(--vscode-charts-green, #89d185);
    --orange: var(--vscode-charts-orange, #d18616);
    --card-bg: var(--vscode-editor-background);
    --border: var(--vscode-widget-border, rgba(128,128,128,.25));
  }
  html, body { height: 100%; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family, -apple-system, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    color: var(--fg);
    background: var(--bg);
    padding: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .hero {
    background: var(--card-bg);
    border-bottom: 1px solid var(--border);
    padding: 16px 14px 14px;
  }
  .quota-hero {
    background: var(--card-bg);
    border-bottom: 1px solid var(--border);
    padding: 16px 14px 14px;
  }
  .hero-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--muted);
    margin-bottom: 10px;
  }
  .quota-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .quota-brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .quota-brand-icon {
    width: 12px;
    height: 12px;
    color: var(--fg);
    flex: 0 0 auto;
  }
  .quota-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .7px;
    color: var(--fg);
  }
  .quota-reset-badge {
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--border);
    white-space: nowrap;
    flex: 0 0 auto;
  }
  .quota-reset-duration {
    font-weight: 700;
    color: #fff;
  }
  .hero-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }
  .hero-stat { display: flex; flex-direction: column; gap: 2px; }
  .hero-stat .val {
    font-size: 18px; font-weight: 700;
    font-variant-numeric: tabular-nums; line-height: 1.1;
  }
  .hero-stat .val.today { color: var(--accent2); }
  .hero-stat .val.tokens { color: var(--accent); }
  .hero-stat .val.cost { color: var(--green); }
  .hero-stat .val.steps { color: var(--orange); }
  .hero-stat .lbl {
    font-size: 10px; color: var(--muted);
    text-transform: uppercase; letter-spacing: .5px;
  }
  .quota-progress-section {
    margin-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .quota-progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .quota-progress-label,
  .quota-progress-value {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .5px;
  }
  .quota-progress-track {
    height: 8px;
    background: var(--border);
    border-radius: 999px;
    overflow: hidden;
  }
  .quota-progress-fill {
    height: 100%;
    border-radius: 999px;
  }
  .quota-status-message {
    font-size: 11px;
    line-height: 1.4;
    color: var(--muted);
  }

  .tabs {
    display: flex;
    background: var(--card-bg);
    border-bottom: 1px solid var(--border);
  }
  .tab {
    flex: 1;
    padding: 8px 0;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .5px;
    color: var(--muted);
    background: none;
    border: none;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: color .15s, border-color .15s;
  }
  .tab:hover { color: var(--fg); }
  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab-content {
    display: none;
    flex: 1;
    min-height: 0;
  }
  .tab-content.active { display: block; }
  #tab-projects { overflow-y: auto; }
  #tab-daily { overflow: hidden; }
  #tab-cost { overflow-y: auto; }

  .cost-tab-inner {
    padding: 10px 10px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .cost-token-summary {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
    gap: 6px;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 12px;
  }
  .cost-token-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: center;
  }
  .cost-token-value {
    font-size: 13px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--accent);
  }
  .cost-token-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: .5px;
    color: var(--muted);
  }
  .cost-provider-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .cost-filter-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .5px;
    color: var(--muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color .15s;
  }
  .cost-filter-toggle:hover { color: var(--fg); }
  .cost-filter-chevron {
    width: 12px;
    height: 12px;
    transition: transform .15s;
  }
  .cost-filter-toggle.collapsed .cost-filter-chevron {
    transform: rotate(-90deg);
  }
  .cost-toolbar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: hidden;
    transition: max-height .2s ease-out, opacity .15s;
    max-height: 500px;
    opacity: 1;
  }
  .cost-toolbar.hidden {
    margin-top: -12px;
    max-height: 0;
    opacity: 0;
    pointer-events: none;
  }
  .cost-toolbar-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cost-sort {
    display: flex;
    gap: 4px;
  }
  .cost-sort-button {
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: none;
    color: var(--muted);
    cursor: pointer;
    transition: color .15s, background .15s, border-color .15s;
  }
  .cost-sort-button:hover {
    color: var(--fg);
    border-color: var(--accent);
  }
  .cost-sort-button.active {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    border-color: var(--accent);
  }
  .cost-age-filter {
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: none;
    color: var(--muted);
    cursor: pointer;
    margin-left: auto;
    transition: color .15s, background .15s, border-color .15s;
  }
  .cost-age-filter:hover {
    color: var(--fg);
    border-color: var(--accent);
  }
  .cost-age-filter.active {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    border-color: var(--accent);
  }
  .cost-provider-filter {
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: none;
    color: var(--muted);
    cursor: pointer;
    transition: color .15s, background .15s, border-color .15s;
  }
  .cost-provider-filter:hover {
    color: var(--fg);
    border-color: var(--accent);
  }
  .cost-provider-filter.active {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    border-color: var(--accent);
  }
  #cost-model-list {
    padding-top: 0;
    border-top: none;
  }
  #cost-model-list .model-cost-row {
    cursor: pointer;
    transition: opacity .15s;
  }
  #cost-model-list .model-cost-row:hover {
    opacity: 0.8;
  }
  #cost-model-list .model-cost-row.saved .model-cost-id {
    color: var(--accent);
  }

  .cards {
    padding: 10px 10px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 12px;
    transition: border-color .15s;
    position: relative;
  }
  .card:hover { border-color: var(--accent); }
  .card-header,
  .card-summary,
  .card-bar-track {
    cursor: pointer;
  }
  .card-summary {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 4px; text-align: center;
  }
  .card-summary .stat { display: flex; flex-direction: column; gap: 1px; }
  .card-summary .stat-value {
    font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums;
  }
  .card-summary .stat-label {
    font-size: 9px; text-transform: uppercase;
    letter-spacing: .5px; color: var(--muted);
  }
  .card-details { display: none; }
  .card.expanded .card-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .card.expanded .card-summary { display: none; }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    gap: 8px;
  }
  .card-title-group {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1 1 auto;
  }
  .card-name {
    font-weight: 600; font-size: 12px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
  }
  .card-total-badge {
    flex: 0 0 auto;
    padding: 2px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    color: var(--accent);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .3px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .card-cost {
    font-weight: 600; font-size: 13px;
    color: var(--green); font-variant-numeric: tabular-nums;
  }

  .card-bar-track {
    height: 4px; background: var(--border);
    border-radius: 2px; overflow: hidden; margin-bottom: 8px;
    display: flex;
  }
  .card-bar-seg {
    height: 100%; min-width: 1px;
  }

  .card-stats {
    display: grid;
    gap: 4px; text-align: center;
  }
  .card-stats-four { grid-template-columns: 1fr 1fr 1fr 1fr; }
  .card-stats .stat { display: flex; flex-direction: column; gap: 1px; }
  .card-stats .stat-value {
    font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums;
  }
  .card-stats .stat-label {
    font-size: 9px; text-transform: uppercase;
    letter-spacing: .5px; color: var(--muted);
  }
  .project-card-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }
  .model-cost-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }
  .model-cost-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: .5px;
    color: var(--muted);
    margin-bottom: 2px;
  }
  .model-cost-info {
    display: inline-flex;
    align-items: center;
  }
  .model-cost-info-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    padding: 0;
    color: var(--muted);
    background: none;
    border: none;
    border-radius: 999px;
    cursor: help;
    transition: color .15s;
  }
  .model-cost-info-button:hover,
  .model-cost-info-button:focus-visible {
    color: var(--fg);
    outline: none;
  }
  .model-cost-info-icon {
    width: 14px;
    height: 14px;
  }
  .model-cost-info-tooltip-overlay {
    position: fixed;
    z-index: 1000;
    width: min(220px, calc(100vw - 24px));
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--card-bg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, .2);
    color: var(--fg);
    font-size: 11px;
    font-weight: 400;
    letter-spacing: normal;
    line-height: 1.4;
    text-transform: none;
    overflow-wrap: anywhere;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-4px);
    transition: opacity .15s, transform .15s;
  }
  .model-cost-info-tooltip-overlay.visible {
    opacity: 1;
    transform: translateY(0);
  }
  .model-cost-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    padding: 2px 0;
  }
  .model-cost-id {
    color: var(--fg);
    font-family: var(--font-mono);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1 1 auto;
    margin-right: 12px;
  }
  .model-cost-value {
    color: var(--accent);
    font-weight: 600;
    font-family: var(--font-mono);
    flex: 0 0 auto;
  }

  .llm-usage-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }
  .llm-usage-header {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: .5px;
    color: var(--muted);
    margin-bottom: 2px;
  }
  .llm-usage-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    padding: 2px 0;
  }
  .llm-usage-id {
    color: var(--fg);
    font-family: var(--font-mono);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1 1 auto;
    margin-right: 12px;
  }
  .llm-usage-value {
    color: var(--accent2);
    font-weight: 600;
    font-family: var(--font-mono);
    flex: 0 0 auto;
  }

  .model-bar-track {
    display: flex;
    height: 10px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
  }
  .model-bar-seg {
    height: 100%;
    min-width: 1px;
  }

  .pie-chart-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .pie-chart {
    width: 180px;
    height: 180px;
  }
  .pie-slice {
    stroke: var(--card-bg);
    stroke-width: 1;
    transition: opacity .15s;
  }
  .pie-slice:hover {
    opacity: 0.8;
  }
  .pie-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    justify-content: center;
  }
  .pie-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
  }
  .pie-legend-swatch {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    flex: 0 0 auto;
  }
  .pie-legend-label {
    color: var(--fg);
  }
  .pie-legend-value {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .vlist-scroll {
    height: 100%;
    overflow-y: auto;
    padding: 10px 10px 20px;
  }
  .daily-layout {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .daily-toolbar {
    padding: 10px 10px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .period-toggle {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 999px;
  }
  .period-toggle-button {
    border: none;
    background: none;
    color: var(--muted);
    padding: 4px 10px;
    border-radius: 999px;
    cursor: pointer;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .3px;
  }
  .period-toggle-button.active {
    color: var(--accent);
    background: var(--border);
  }
  .view-toggle {
    display: inline-flex;
    gap: 4px;
    padding: 3px;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 999px;
  }
  .view-toggle-button {
    border: none;
    background: none;
    color: var(--muted);
    padding: 5px 7px;
    border-radius: 999px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .toggle-icon {
    width: 16px;
    height: 16px;
  }
  .view-toggle-button.active {
    color: var(--accent);
    background: var(--border);
  }
  .daily-view {
    display: none;
    flex: 1;
    min-height: 0;
  }
  .daily-view.active { display: block; }
  .daily-graph-view.active {
    overflow-y: auto;
    padding: 10px 10px 20px;
  }
  .vlist-spacer { width: 100%; }
  .day-group {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: border-color .15s;
    cursor: pointer;
    position: relative;
    margin-bottom: 8px;
  }
  .day-group:hover { border-color: var(--accent); }
  .day-details { display: none; }
  .day-group.expanded .day-details { display: contents; }
  .day-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2px;
  }
  .day-label {
    font-size: 12px; font-weight: 700;
  }
  .day-cost {
    font-size: 11px; font-weight: 600;
    color: var(--green); font-variant-numeric: tabular-nums;
  }
  .day-meta {
    display: flex; gap: 4px;
  }
  .day-badge {
    font-size: 10px; font-weight: 600;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--border);
    color: var(--muted);
    white-space: nowrap;
  }
  .model-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 4px;
  }
  .model-badge {
    font-size: 9px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent2) 20%, transparent);
    color: var(--accent2);
    white-space: nowrap;
  }
  .hbar-row {
    display: grid;
    grid-template-columns: 56px 1fr 60px;
    gap: 6px;
    align-items: center;
  }
  .hbar-type-label {
    font-size: 10px; font-weight: 600;
    text-transform: uppercase; letter-spacing: .3px;
  }
  .hbar-track-wrap {
    height: 10px; background: var(--border);
    border-radius: 2px; overflow: hidden;
  }
  .hbar-fill {
    height: 100%; border-radius: 2px;
  }
  .hbar-value {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .hbar-tokens { font-size: 10px; font-weight: 600; }

  .daily-graph-panel {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px;
  }
  .daily-graph-stats {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
  }
  .daily-chart-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .daily-chart-section + .daily-chart-section {
    margin-top: 22px;
    padding-top: 22px;
    border-top: 1px solid var(--border);
  }
  .daily-chart-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }
  .daily-chart-title {
    font-size: 10px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .5px;
  }
  .daily-chart-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px 10px;
  }
  .daily-chart-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border: 1px solid transparent;
    border-radius: 999px;
    background: none;
    font: inherit;
    color: var(--muted);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .3px;
    cursor: pointer;
    transition: color .15s, opacity .15s, border-color .15s, background .15s;
  }
  .daily-chart-legend-item:hover {
    color: var(--fg);
    border-color: var(--border);
  }
  .daily-chart-legend-item.is-hidden {
    opacity: 0.5;
  }
  .daily-chart-legend-item.is-hidden .daily-chart-legend-label {
    text-decoration: line-through;
  }
  .daily-chart-legend-item.is-static,
  .daily-chart-legend-item:disabled {
    cursor: default;
  }
  .daily-chart-legend-item.is-static:hover,
  .daily-chart-legend-item:disabled:hover {
    color: var(--muted);
    border-color: transparent;
    background: none;
  }
  .daily-chart-legend-swatch {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    flex: 0 0 auto;
  }
  .daily-graph-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .daily-graph-stat-value {
    font-size: 14px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .daily-graph-stat-label {
    font-size: 9px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .5px;
  }
  .daily-chart-wrap {
    width: 100%;
    position: relative;
  }
  .daily-chart {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
  }
  .daily-chart-guide {
    stroke: var(--border);
    stroke-width: 1;
  }
  .daily-chart-guide-label,
  .daily-chart-axis-label {
    fill: var(--muted);
    font-size: 10px;
    font-family: var(--vscode-font-family, -apple-system, sans-serif);
  }
  .daily-chart-line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .daily-chart-area {
    fill: url(#daily-chart-fill);
  }
  .daily-chart-point {
    fill: var(--card-bg);
    stroke: var(--accent);
    stroke-width: 2;
    cursor: crosshair;
    transition: transform .15s, fill .15s;
    transform-origin: center;
  }
  .daily-chart-point:hover {
    fill: var(--fg);
  }
  .daily-chart-tooltip {
    position: absolute;
    left: 0;
    top: 0;
    min-width: 180px;
    max-width: min(280px, calc(100% - 12px));
    padding: 9px 10px;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.2);
    pointer-events: none;
    z-index: 2;
  }
  .daily-chart-tooltip[hidden] {
    display: none;
  }
  .daily-chart-tooltip-day {
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 7px;
  }
  .daily-chart-tooltip-grid {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 12px;
  }
  .daily-chart-tooltip-label {
    color: var(--muted);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .3px;
  }
  .daily-chart-tooltip-value {
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .empty {
    color: var(--muted); padding: 40px 16px;
    text-align: center; font-size: 12px; line-height: 1.6;
  }
`;

export { STYLES };
