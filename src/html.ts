import type { ProjectTokens, DayTokens } from "./types.js";
import { formatTokens, escapeHtml, formatDay, formatDurationMs } from "./format.js";
import { stackedBarHtml, SEG_COLORS } from "./bars.js";

type DailyChartSeries = {
  label: string;
  color: string;
  getValue: (day: DayTokens) => number;
};

function buildDailyChartSection(
  chartId: string,
  title: string,
  days: DayTokens[],
  series: DailyChartSeries[],
  valueFormatter: (value: number) => string,
  fillArea = false,
): string {
  const chartDays = [...days].reverse();
  const width = 720;
  const height = 240;
  const paddingTop = 16;
  const paddingRight = 12;
  const paddingBottom = 34;
  const paddingLeft = 44;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const baselineY = paddingTop + chartHeight;
  const maxValue = chartDays.reduce(
    (currentMaxValue, day) => Math.max(currentMaxValue, ...series.map((seriesItem) => seriesItem.getValue(day))),
    0,
  ) || 1;

  const axisPoints = chartDays.map((day, index) => ({
    dayLabel: formatDay(day.day),
    x: chartDays.length === 1
      ? paddingLeft + chartWidth / 2
      : paddingLeft + (index / (chartDays.length - 1)) * chartWidth,
  }));

  const guideValues = Array.from(new Set([maxValue, Math.round((maxValue * 2) / 3), Math.round(maxValue / 3), 0]))
    .sort((left, right) => right - left);
  const guideLines = guideValues
    .map((value) => {
      const y = paddingTop + chartHeight - (value / maxValue) * chartHeight;
      return `<line class="daily-chart-guide" x1="${paddingLeft}" y1="${y.toFixed(2)}" x2="${(width - paddingRight).toFixed(2)}" y2="${y.toFixed(2)}"></line>
        <text class="daily-chart-guide-label" x="${paddingLeft - 8}" y="${(y + 3).toFixed(2)}" text-anchor="end">${escapeHtml(valueFormatter(value))}</text>`;
    })
    .join("");

  const xLabelIndexes = chartDays.length <= 6
    ? chartDays.map((_, index) => index)
    : Array.from(new Set([
      0,
      Math.round((chartDays.length - 1) * 0.25),
      Math.round((chartDays.length - 1) * 0.5),
      Math.round((chartDays.length - 1) * 0.75),
      chartDays.length - 1,
    ])).sort((left, right) => left - right);

  const xLabels = xLabelIndexes
    .map((index) => {
      const point = axisPoints[index];
      return `<text class="daily-chart-axis-label" x="${point.x.toFixed(2)}" y="${height - 10}" text-anchor="middle">${escapeHtml(point.dayLabel)}</text>`;
    })
    .join("");

  const seriesMarkup = series
    .map((seriesItem, seriesIndex) => {
      const points = chartDays.map((day, index) => {
        const value = seriesItem.getValue(day);
        return {
          dayLabel: axisPoints[index].dayLabel,
          value,
          x: axisPoints[index].x,
          y: paddingTop + chartHeight - (value / maxValue) * chartHeight,
        };
      });

      const linePath = points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(" ");
      const areaPath = fillArea && seriesIndex === 0 && points.length > 1
        ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${baselineY.toFixed(2)} L ${points[0].x.toFixed(2)} ${baselineY.toFixed(2)} Z`
        : "";
      const pointMarkers = points
        .map(
          (point) => `<circle class="daily-chart-point" style="stroke:${seriesItem.color}" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3.5"><title>${escapeHtml(seriesItem.label)} · ${escapeHtml(point.dayLabel)}: ${escapeHtml(valueFormatter(point.value))}</title></circle>`,
        )
        .join("");

      return `${areaPath ? `<path class="daily-chart-area" style="fill:url(#${chartId}-fill)" d="${areaPath}"></path>` : ""}
        <path class="daily-chart-line" style="stroke:${seriesItem.color}" d="${linePath}"></path>
        ${pointMarkers}`;
    })
    .join("");

  const legend = series
    .map(
      (seriesItem) => `<span class="daily-chart-legend-item"><span class="daily-chart-legend-swatch" style="background:${seriesItem.color}"></span>${escapeHtml(seriesItem.label)}</span>`,
    )
    .join("");

  return `
    <section class="daily-chart-section">
      <div class="daily-chart-header">
        <div class="daily-chart-title">${escapeHtml(title)}</div>
        <div class="daily-chart-legend">${legend}</div>
      </div>
      <div class="daily-chart-wrap">
        <svg class="daily-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)} daily chart">
          <defs>
            <linearGradient id="${chartId}-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style="stop-color:${series[0].color}; stop-opacity: 0.24;"></stop>
              <stop offset="100%" style="stop-color:${series[0].color}; stop-opacity: 0;"></stop>
            </linearGradient>
          </defs>
          ${guideLines}
          ${seriesMarkup}
          ${xLabels}
        </svg>
      </div>
    </section>`;
}

function buildDailyLineChart(days: DayTokens[]): string {
  if (days.length === 0) {
    return '<p class="empty">No daily token usage data found.</p>';
  }

  const chartDays = [...days].reverse();
  const latestDay = chartDays[chartDays.length - 1];
  const peakDay = chartDays.reduce((bestDay, day) => (day.totalTokens > bestDay.totalTokens ? day : bestDay), chartDays[0]);
  const averageTokens = Math.round(chartDays.reduce((sum, day) => sum + day.totalTokens, 0) / chartDays.length);

  const totalChart = buildDailyChartSection(
    "daily-total-chart",
    "Total Tokens",
    days,
    [{ label: "total tokens", color: "var(--accent)", getValue: (day) => day.totalTokens }],
    formatTokens,
    true,
  );
  const tokenBreakdownChart = buildDailyChartSection(
    "daily-token-breakdown-chart",
    "Token Breakdown",
    days,
    [
      { label: "input", color: SEG_COLORS.input, getValue: (day) => day.inputTokens },
      { label: "output", color: SEG_COLORS.output, getValue: (day) => day.outputTokens },
      { label: "reason", color: SEG_COLORS.reasoning, getValue: (day) => day.reasoningTokens },
      { label: "cache r", color: SEG_COLORS.cacheRead, getValue: (day) => day.cacheRead },
      { label: "cache w", color: SEG_COLORS.cacheWrite, getValue: (day) => day.cacheWrite },
    ],
    formatTokens,
  );
  const activityChart = buildDailyChartSection(
    "daily-activity-chart",
    "Sessions And Steps",
    days,
    [
      { label: "sessions", color: "var(--green)", getValue: (day) => day.sessions },
      { label: "steps", color: "var(--orange)", getValue: (day) => day.steps },
    ],
    (value) => String(value),
  );

  return `
    <div class="daily-graph-panel">
      <div class="daily-graph-stats">
        <div class="daily-graph-stat">
          <span class="daily-graph-stat-value">${formatTokens(latestDay.totalTokens)}</span>
          <span class="daily-graph-stat-label">Latest Day</span>
        </div>
        <div class="daily-graph-stat">
          <span class="daily-graph-stat-value">${formatTokens(averageTokens)}</span>
          <span class="daily-graph-stat-label">Average / Day</span>
        </div>
        <div class="daily-graph-stat">
          <span class="daily-graph-stat-value">${formatTokens(peakDay.totalTokens)}</span>
          <span class="daily-graph-stat-label">Peak (${escapeHtml(formatDay(peakDay.day))})</span>
        </div>
      </div>
      ${totalChart}
      ${tokenBreakdownChart}
      ${activityChart}
    </div>`;
}

function getHtml(projects: ProjectTokens[], days: DayTokens[]): string {
  const grandTotal = projects.reduce((s, r) => s + r.totalTokens, 0);
  const grandCost = projects.reduce((s, r) => s + r.totalCost, 0);
  const grandSteps = projects.reduce((s, r) => s + r.steps, 0);

  const projectCards = projects
    .map((r) => {
      const bar = stackedBarHtml(r.totalTokens, [
        { value: r.inputTokens, color: SEG_COLORS.input },
        { value: r.outputTokens, color: SEG_COLORS.output },
        { value: r.reasoningTokens, color: SEG_COLORS.reasoning },
        { value: r.cacheRead, color: SEG_COLORS.cacheRead },
        { value: r.cacheWrite, color: SEG_COLORS.cacheWrite },
      ]);
      return `
      <div class="card" onclick="this.classList.toggle('expanded')">
        <div class="card-header">
          <span class="card-name">${escapeHtml(r.project)}</span>
          <span class="card-cost">$${r.totalCost.toFixed(2)}</span>
        </div>
        ${bar}
        <div class="card-summary">
          <div class="stat">
            <span class="stat-value">${formatTokens(r.inputTokens)}</span>
            <span class="stat-label">input</span>
          </div>
          <div class="stat">
            <span class="stat-value">${formatTokens(r.outputTokens)}</span>
            <span class="stat-label">output</span>
          </div>
          <div class="stat">
            <span class="stat-value">${r.sessions}</span>
            <span class="stat-label">sessions</span>
          </div>
          <div class="stat">
            <span class="stat-value">${formatTokens(r.steps)}</span>
            <span class="stat-label">steps</span>
          </div>
        </div>
        <div class="card-details">
          <div class="card-stats card-stats-four">
            <div class="stat">
              <span class="stat-value">${formatTokens(r.inputTokens)}</span>
              <span class="stat-label">input</span>
            </div>
            <div class="stat">
              <span class="stat-value">${formatTokens(r.outputTokens)}</span>
              <span class="stat-label">output</span>
            </div>
            <div class="stat">
              <span class="stat-value">${r.sessions}</span>
              <span class="stat-label">sessions</span>
            </div>
            <div class="stat">
              <span class="stat-value">${formatTokens(r.steps)}</span>
              <span class="stat-label">steps</span>
            </div>
          </div>
          <div class="card-stats card-stats-four">
            <div class="stat">
              <span class="stat-value">${formatTokens(r.reasoningTokens)}</span>
              <span class="stat-label">reason</span>
            </div>
            <div class="stat">
              <span class="stat-value">${formatTokens(r.cacheRead)}</span>
              <span class="stat-label">cache r</span>
            </div>
            <div class="stat">
              <span class="stat-value">${formatTokens(r.cacheWrite)}</span>
              <span class="stat-label">cache w</span>
            </div>
            <div class="stat">
              <span class="stat-value">${formatDurationMs(r.duration)}</span>
              <span class="stat-label">duration</span>
            </div>
          </div>
        </div>
      </div>`;
    })
    .join("");

  const tokenTypes = [
    { key: "inputTokens", color: SEG_COLORS.input, label: "input" },
    { key: "outputTokens", color: SEG_COLORS.output, label: "output" },
    { key: "reasoningTokens", color: SEG_COLORS.reasoning, label: "reason" },
    { key: "cacheRead", color: SEG_COLORS.cacheRead, label: "cache r" },
    { key: "cacheWrite", color: SEG_COLORS.cacheWrite, label: "cache w" },
  ] as const;

  const maxPerType: Record<string, number> = {};
  for (const t of tokenTypes) {
    maxPerType[t.key] = days.reduce((m, r) => Math.max(m, r[t.key]), 0) || 1;
  }

  const summaryKeys = new Set(["inputTokens", "outputTokens"]);
  const dayDataJson = JSON.stringify(
    days.map((r) => ({
      day: r.day,
      dayLabel: formatDay(r.day),
      totalTokens: r.totalTokens,
      totalCost: r.totalCost,
      sessions: r.sessions,
      steps: r.steps,
      summaryBars: tokenTypes.filter((t) => summaryKeys.has(t.key)).map((t) => ({
        label: t.label,
        color: t.color,
        pct: ((r[t.key] / maxPerType[t.key]) * 100).toFixed(1),
        value: formatTokens(r[t.key]),
      })),
      detailBars: tokenTypes.filter((t) => !summaryKeys.has(t.key)).map((t) => ({
        label: t.label,
        color: t.color,
        pct: ((r[t.key] / maxPerType[t.key]) * 100).toFixed(1),
        value: formatTokens(r[t.key]),
      })),
    })),
  );
  const dailyGraphHtml = buildDailyLineChart(days);

  const hasProjects = projects.length > 0;
  const hasDays = days.length > 0;
  const hasData = hasProjects || hasDays;
  const defaultTab = hasProjects ? "projects" : "daily";

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
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
  .hero-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--muted);
    margin-bottom: 10px;
  }
  .hero-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }
  .hero-stat { display: flex; flex-direction: column; gap: 2px; }
  .hero-stat .val {
    font-size: 18px; font-weight: 700;
    font-variant-numeric: tabular-nums; line-height: 1.1;
  }
  .hero-stat .val.tokens { color: var(--accent); }
  .hero-stat .val.cost { color: var(--green); }
  .hero-stat .val.steps { color: var(--orange); }
  .hero-stat .lbl {
    font-size: 10px; color: var(--muted);
    text-transform: uppercase; letter-spacing: .5px;
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
    cursor: pointer;
    position: relative;
  }
  .card:hover { border-color: var(--accent); }
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
  }
  .card-name {
    font-weight: 600; font-size: 12px;
    max-width: 160px; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
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
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .4px;
    cursor: pointer;
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
    font-size: 10px; color: var(--muted);
    display: flex; gap: 4px;
  }
  .day-meta-sep { opacity: 0.4; }
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
    gap: 8px;
  }
  .daily-chart-section + .daily-chart-section {
    margin-top: 14px;
    padding-top: 14px;
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
    color: var(--muted);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .3px;
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
  .daily-chart-wrap { width: 100%; }
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
  }

  .empty {
    color: var(--muted); padding: 40px 16px;
    text-align: center; font-size: 12px; line-height: 1.6;
  }
</style>
</head>
<body>
  <div class="hero">
    <div class="hero-title">Kilo Token Usage</div>
    <div class="hero-grid">
      <div class="hero-stat">
        <span class="val tokens">${formatTokens(grandTotal)}</span>
        <span class="lbl">Total Tokens</span>
      </div>
      <div class="hero-stat">
        <span class="val cost">$${grandCost.toFixed(2)}</span>
        <span class="lbl">Total Cost</span>
      </div>
      <div class="hero-stat">
        <span class="val steps">${grandSteps}</span>
        <span class="lbl">Total Steps</span>
      </div>
    </div>
  </div>
  ${hasData ? `
  <div class="tabs">
    <button class="tab ${defaultTab === "projects" ? "active" : ""}" data-tab="projects">Projects</button>
    <button class="tab ${defaultTab === "daily" ? "active" : ""}" data-tab="daily">Daily</button>
  </div>
  <div class="tab-content ${defaultTab === "projects" ? "active" : ""}" id="tab-projects">
    ${hasProjects ? `<div class="cards">${projectCards}</div>` : '<p class="empty">No project token usage data found.</p>'}
  </div>
  <div class="tab-content ${defaultTab === "daily" ? "active" : ""}" id="tab-daily">
    ${hasDays ? `
    <div class="daily-layout">
      <div class="daily-toolbar">
        <div class="view-toggle" role="tablist" aria-label="Daily view mode">
          <button class="view-toggle-button active" data-daily-view="cards" type="button">Cards</button>
          <button class="view-toggle-button" data-daily-view="graph" type="button">Graph</button>
        </div>
      </div>
      <div class="daily-view active" id="daily-view-cards">
        <div class="vlist-scroll" id="daily-scroll">
          <div class="vlist-spacer" id="daily-spacer-top"></div>
          <div id="daily-viewport"></div>
          <div class="vlist-spacer" id="daily-spacer-bottom"></div>
        </div>
      </div>
      <div class="daily-view daily-graph-view" id="daily-view-graph">
        ${dailyGraphHtml}
      </div>
    </div>` : '<p class="empty">No daily token usage data found.</p>'}
  </div>` : '<p class="empty">No token usage data found.<br>Make sure Kilo is installed and ~/.local/share/kilo/kilo.db exists.</p>'}
  <script>
    const DAY_DATA = ${dayDataJson};
    const DAY_HEIGHT_ESTIMATE = 112;
    const DAY_GROUP_GAP = 8;
    const BUFFER = 4;

    const scroll = document.getElementById('daily-scroll');
    const viewport = document.getElementById('daily-viewport');
    const spacerTop = document.getElementById('daily-spacer-top');
    const spacerBottom = document.getElementById('daily-spacer-bottom');
    const dailyViewButtons = document.querySelectorAll('[data-daily-view]');
    const dailyViews = document.querySelectorAll('.daily-view');
    const expandedStates = DAY_DATA.map(() => false);
    const itemHeights = DAY_DATA.map(() => DAY_HEIGHT_ESTIMATE + DAY_GROUP_GAP);
    const offsets = new Array(DAY_DATA.length + 1).fill(0);
    let totalHeight = 0;
    let renderPending = false;
    let activeDailyView = 'cards';

    function setDailyView(nextView) {
      activeDailyView = nextView === 'graph' ? 'graph' : 'cards';

      dailyViewButtons.forEach((button) => {
        if (!(button instanceof HTMLElement)) return;
        button.classList.toggle('active', button.dataset.dailyView === activeDailyView);
      });

      dailyViews.forEach((view) => {
        if (!(view instanceof HTMLElement)) return;
        view.classList.toggle('active', view.id === 'daily-view-' + activeDailyView);
      });

      if (activeDailyView === 'cards') {
        scheduleRender();
      }
    }

    function recomputeOffsets() {
      offsets[0] = 0;
      for (let index = 0; index < DAY_DATA.length; index += 1) {
        offsets[index + 1] = offsets[index] + itemHeights[index];
      }
      totalHeight = offsets[DAY_DATA.length];
    }

    function findStartIndex(scrollTop) {
      let index = 0;
      while (index < DAY_DATA.length && offsets[index + 1] <= scrollTop) {
        index += 1;
      }
      return Math.max(0, index - BUFFER);
    }

    function findEndIndex(bottom) {
      let index = 0;
      while (index < DAY_DATA.length && offsets[index] < bottom) {
        index += 1;
      }
      return Math.min(DAY_DATA.length, index + BUFFER);
    }

    function renderDayGroup(item, index) {
      const summaryBars = item.summaryBars.map((bar) =>
        '<div class="hbar-row">' +
          '<div class="hbar-type-label" style="color:' + bar.color + '">' + bar.label + '</div>' +
          '<div class="hbar-track-wrap"><div class="hbar-fill" style="width:' + bar.pct + '%;background:' + bar.color + '"></div></div>' +
          '<div class="hbar-value"><span class="hbar-tokens">' + bar.value + '</span></div>' +
        '</div>'
      ).join('');
      const detailBars = item.detailBars.map((bar) =>
        '<div class="hbar-row">' +
          '<div class="hbar-type-label" style="color:' + bar.color + '">' + bar.label + '</div>' +
          '<div class="hbar-track-wrap"><div class="hbar-fill" style="width:' + bar.pct + '%;background:' + bar.color + '"></div></div>' +
          '<div class="hbar-value"><span class="hbar-tokens">' + bar.value + '</span></div>' +
        '</div>'
      ).join('');
      return '<div class="day-group' + (expandedStates[index] ? ' expanded' : '') + '" data-index="' + index + '">' +
        '<div class="day-header"><span class="day-label">' + item.dayLabel + '</span><span class="day-cost">$' + item.totalCost.toFixed(2) + '</span></div>' +
        '<div class="day-meta"><span class="day-meta-stat">' + item.sessions + ' session' + (item.sessions !== 1 ? 's' : '') + '</span><span class="day-meta-sep">·</span><span class="day-meta-stat">' + item.steps + ' steps</span></div>' +
        summaryBars +
        '<div class="day-details">' + detailBars + '</div>' +
      '</div>';
    }

    function measureRenderedHeights() {
      if (!viewport) return false;
      let changed = false;
      viewport.querySelectorAll('.day-group').forEach((element) => {
        const index = Number(element.getAttribute('data-index'));
        const nextHeight = Math.ceil(element.getBoundingClientRect().height) + DAY_GROUP_GAP;
        if (!Number.isNaN(index) && nextHeight > 0 && itemHeights[index] !== nextHeight) {
          itemHeights[index] = nextHeight;
          changed = true;
        }
      });
      if (changed) {
        recomputeOffsets();
      }
      return changed;
    }

    function renderVirtualList() {
      if (!scroll || !viewport || !spacerTop || !spacerBottom || DAY_DATA.length === 0) return;
      const viewHeight = scroll.clientHeight;
      if (viewHeight === 0) return;

      const scrollTop = scroll.scrollTop;
      const start = findStartIndex(scrollTop);
      const end = findEndIndex(scrollTop + viewHeight);

      spacerTop.style.height = offsets[start] + 'px';
      spacerBottom.style.height = Math.max(0, totalHeight - offsets[end]) + 'px';

      let html = '';
      for (let index = start; index < end; index += 1) {
        html += renderDayGroup(DAY_DATA[index], index);
      }
      viewport.innerHTML = html;

      if (measureRenderedHeights()) {
        scheduleRender();
      }
    }

    function scheduleRender() {
      if (renderPending) return;
      renderPending = true;
      requestAnimationFrame(() => {
        renderPending = false;
        renderVirtualList();
      });
    }

    recomputeOffsets();

    if (scroll) {
      scroll.addEventListener('scroll', scheduleRender);
    }

    if (viewport) {
      viewport.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const group = target.closest('.day-group');
        if (!group) return;

        const index = Number(group.getAttribute('data-index'));
        if (Number.isNaN(index)) return;

        expandedStates[index] = !expandedStates[index];
        group.classList.toggle('expanded', expandedStates[index]);

        const nextHeight = Math.ceil(group.getBoundingClientRect().height) + DAY_GROUP_GAP;
        if (nextHeight > 0 && itemHeights[index] !== nextHeight) {
          itemHeights[index] = nextHeight;
          recomputeOffsets();
        }

        scheduleRender();
      });
    }

    dailyViewButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (!(button instanceof HTMLElement)) return;
        setDailyView(button.dataset.dailyView || 'cards');
      });
    });

    window.addEventListener('resize', () => {
      if (activeDailyView === 'cards') {
        scheduleRender();
      }
    });
    if (${defaultTab === "daily"}) scheduleRender();

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById('tab-' + tab.dataset.tab);
        if (target) target.classList.add('active');
        if (tab.dataset.tab === 'daily' && activeDailyView === 'cards') scheduleRender();
      });
    });
  </script>
</body>
</html>`;
}

export { getHtml };
