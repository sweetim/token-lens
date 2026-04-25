import type { ProjectTokens, DayTokens, ProjectDayTokens, QuotaSummary } from "./types.js";
import { formatTokens, escapeHtml, formatDay, formatDurationMs } from "./format.js";
import { stackedBarHtml, SEG_COLORS } from "./bars.js";

type DailyChartValueKey =
  | "totalTokens"
  | "inputTokens"
  | "outputTokens"
  | "reasoningTokens"
  | "cacheRead"
  | "cacheWrite"
  | "sessions"
  | "steps";

type DailyChartSeries = {
  key: DailyChartValueKey;
  label: string;
  color: string;
};

type DailyChartConfig = {
  id: string;
  title: string;
  valueFormat: "tokens" | "number";
  fillArea?: boolean;
  hideTitle?: boolean;
  series: DailyChartSeries[];
};

function buildDailyChartSection(chart: DailyChartConfig): string {
  const legend = chart.series
    .map(
      (seriesItem) => `<button class="daily-chart-legend-item${chart.series.length === 1 ? " is-static" : ""}" type="button" data-chart-id="${chart.id}" data-series-key="${seriesItem.key}" aria-pressed="true"${chart.series.length === 1 ? ' disabled aria-disabled="true"' : ""}><span class="daily-chart-legend-swatch" style="background:${seriesItem.color}"></span><span class="daily-chart-legend-label">${escapeHtml(seriesItem.label)}</span></button>`,
    )
    .join("");

  return `
    <section class="daily-chart-section" data-chart-id="${chart.id}">
      <div class="daily-chart-header">
        ${chart.hideTitle ? "" : `<div class="daily-chart-title">${escapeHtml(chart.title)}</div>`}
        <div class="daily-chart-legend">${legend}</div>
      </div>
      <div class="daily-chart-wrap">
        <svg class="daily-chart" data-chart-svg viewBox="0 0 720 240" role="img" aria-label="${escapeHtml(chart.title)} chart"></svg>
        <div class="daily-chart-tooltip" data-chart-tooltip hidden></div>
      </div>
    </section>`;
}

function getDailyChartConfigs(): DailyChartConfig[] {
  return [
    {
      id: "daily-total-chart",
      title: "Total Tokens",
      valueFormat: "tokens",
      fillArea: true,
      series: [{ key: "totalTokens", label: "total tokens", color: "var(--accent)" }],
    },
    {
      id: "daily-token-breakdown-chart",
      title: "Token Breakdown",
      valueFormat: "tokens",
      series: [
        { key: "inputTokens", label: "input", color: SEG_COLORS.input },
        { key: "outputTokens", label: "output", color: SEG_COLORS.output },
        { key: "reasoningTokens", label: "reason", color: SEG_COLORS.reasoning },
        { key: "cacheRead", label: "cache r", color: SEG_COLORS.cacheRead },
        { key: "cacheWrite", label: "cache w", color: SEG_COLORS.cacheWrite },
      ],
    },
    {
      id: "daily-activity-chart",
      title: "Sessions And Steps",
      valueFormat: "number",
      series: [
        { key: "sessions", label: "sessions", color: "var(--green)" },
        { key: "steps", label: "steps", color: "var(--orange)" },
      ],
    },
  ];
}

function mapChartDayData(row: DayTokens | ProjectDayTokens) {
  return {
    day: row.day,
    dayLabel: formatDay(row.day),
    totalTokens: row.totalTokens,
    totalTokensLabel: formatTokens(row.totalTokens),
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    reasoningTokens: row.reasoningTokens,
    cacheRead: row.cacheRead,
    cacheWrite: row.cacheWrite,
    totalCost: row.totalCost,
    sessions: row.sessions,
    steps: row.steps,
    duration: formatDurationMs(row.duration),
  };
}

function buildDailyLineChart(days: DayTokens[], chartConfigs: DailyChartConfig[]): string {
  if (days.length === 0) {
    return '<p class="empty">No daily token usage data found.</p>';
  }

  const chartDays = [...days].reverse();
  const latestDay = chartDays[chartDays.length - 1];
  const peakDay = chartDays.reduce((bestDay, day) => (day.totalTokens > bestDay.totalTokens ? day : bestDay), chartDays[0]);
  const averageTokens = Math.round(chartDays.reduce((sum, day) => sum + day.totalTokens, 0) / chartDays.length);

  const chartSections = chartConfigs.map((chart) => buildDailyChartSection(chart)).join("");

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
      ${chartSections}
    </div>`;
}

const Z_AI_LOGO_SVG = `
  <svg class="quota-brand-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="3" fill="currentColor"></rect>
    <path d="M12.5 5.5L11.4 7.1c-.15.22-.41.36-.7.36H5.5V5.5h7z" fill="#fff"></path>
    <path d="M18.5 5.5L9.7 18.5H5.5L14.3 5.5h4.2z" fill="#fff"></path>
    <path d="M11.5 18.5l1.1-1.6c.15-.22.41-.36.7-.36h5.2v1.96h-7z" fill="#fff"></path>
  </svg>`;

function getRemainingBarColor(remainingPercentage: number): string {
  if (remainingPercentage <= 20) {
    return "var(--vscode-charts-red, #f14c4c)";
  }
  if (remainingPercentage <= 50) {
    return "var(--orange)";
  }
  return "var(--green)";
}

function buildQuotaSection(quotaSummary: QuotaSummary | undefined): string {
  const resetDurationLabel = quotaSummary ? quotaSummary.resetDurationLabel : "Unavailable";
  const remainingPercentage = quotaSummary ? Math.max(0, Math.min(100, quotaSummary.remainingPercentage)) : 0;
  const usedPercentage = 100 - remainingPercentage;

  return `
    <div class="quota-hero">
      <div class="quota-header">
        <div class="quota-brand">
          ${Z_AI_LOGO_SVG}
          <span class="quota-title">Quota Usage</span>
        </div>
        <span class="quota-reset-badge">reset <span class="quota-reset-duration">${escapeHtml(resetDurationLabel)}</span></span>
      </div>
      <div class="quota-progress-section">
        <div class="quota-progress-header">
          <span class="quota-progress-label">Usage</span>
          <span class="quota-progress-value">${usedPercentage.toFixed(1)}% used</span>
        </div>
        <div class="quota-progress-track">
          <div class="quota-progress-fill" style="width:${usedPercentage.toFixed(1)}%;background:${getRemainingBarColor(remainingPercentage)}"></div>
        </div>
      </div>
    </div>`;
}

function getHtml(projects: ProjectTokens[], days: DayTokens[], projectDays: ProjectDayTokens[], quotaSummary?: QuotaSummary): string {
  const grandTotal = projects.reduce((s, r) => s + r.totalTokens, 0);
  const grandCost = projects.reduce((s, r) => s + r.totalCost, 0);
  const grandSteps = projects.reduce((s, r) => s + r.steps, 0);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayTotalTokens = days.find((day) => day.day === todayKey)?.totalTokens ?? 0;
  const projectDaysByProject = projectDays.reduce((result, row) => {
    const rows = result.get(row.project);
    if (rows) {
      rows.push(row);
    } else {
      result.set(row.project, [row]);
    }
    return result;
  }, new Map<string, ProjectDayTokens[]>());
  const projectChartConfigs = projects.map((project, index) => ({
    id: `project-total-chart-${index}`,
    title: "",
    valueFormat: "tokens" as const,
    fillArea: true,
    hideTitle: true,
    series: [{ key: "totalTokens" as const, label: "total tokens", color: "var(--accent)" }],
  }));

  const projectCards = projects
    .map((r, index) => {
      const bar = stackedBarHtml(r.totalTokens, [
        { value: r.inputTokens, color: SEG_COLORS.input },
        { value: r.outputTokens, color: SEG_COLORS.output },
        { value: r.reasoningTokens, color: SEG_COLORS.reasoning },
        { value: r.cacheRead, color: SEG_COLORS.cacheRead },
        { value: r.cacheWrite, color: SEG_COLORS.cacheWrite },
      ]);
      const projectDayRows = projectDaysByProject.get(r.project) ?? [];
      const projectChart = projectChartConfigs[index];
      return `
      <div class="card" data-project-card>
        <div class="card-header">
          <div class="card-title-group">
            <span class="card-name">${escapeHtml(r.project)}</span>
            <span class="card-total-badge">${formatTokens(r.totalTokens)} tokens</span>
          </div>
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
          <div class="project-card-section">
            ${projectDayRows.length > 0 ? buildDailyChartSection(projectChart) : '<p class="empty">No daily token usage data found for this project.</p>'}
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
      ...mapChartDayData(r),
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
  const dailyChartConfigs = getDailyChartConfigs();
  const dailyChartDataJson = JSON.stringify(dailyChartConfigs);
  const projectChartDataJson = JSON.stringify(projectChartConfigs);
  const dailyChartIdsJson = JSON.stringify(dailyChartConfigs.map((chart) => chart.id));
  const sharedDailyChartDayDataJson = JSON.stringify(days.map((day) => mapChartDayData(day)));
  const projectChartDataSetsJson = JSON.stringify(
    Object.fromEntries(projects.map((project, index) => [
      projectChartConfigs[index].id,
      (projectDaysByProject.get(project.project) ?? []).map((day) => mapChartDayData(day)),
    ])),
  );
  const dailyGraphHtml = buildDailyLineChart(days, dailyChartConfigs);

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
</style>
</head>
<body>
  ${buildQuotaSection(quotaSummary)}
  <div class="hero">
    <div class="hero-title">Kilo Total Token Usage</div>
    <div class="hero-grid">
      <div class="hero-stat">
        <span class="val today">${formatTokens(todayTotalTokens)}</span>
        <span class="lbl">Today</span>
      </div>
      <div class="hero-stat">
        <span class="val tokens">${formatTokens(grandTotal)}</span>
        <span class="lbl">Total</span>
      </div>
      <div class="hero-stat">
        <span class="val cost">$${grandCost.toFixed(2)}</span>
        <span class="lbl">Costs</span>
      </div>
      <div class="hero-stat">
        <span class="val steps">${grandSteps}</span>
        <span class="lbl">Steps</span>
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
    const DAILY_CHARTS = ${dailyChartDataJson};
    const PROJECT_CHARTS = ${projectChartDataJson};
    const ALL_CHARTS = DAILY_CHARTS.concat(PROJECT_CHARTS);
    const DAILY_CHART_IDS = new Set(${dailyChartIdsJson});
    const DAILY_CHART_DATA = ${sharedDailyChartDayDataJson};
    const PROJECT_CHART_DATASETS = ${projectChartDataSetsJson};
    const DAY_HEIGHT_ESTIMATE = 112;
    const DAY_GROUP_GAP = 8;
    const BUFFER = 4;
    const CHART_WIDTH = 720;
    const CHART_HEIGHT = 240;
    const CHART_PADDING_TOP = 16;
    const CHART_PADDING_RIGHT = 12;
    const CHART_PADDING_BOTTOM = 34;
    const CHART_PADDING_LEFT = 44;
    const CHART_DRAWABLE_WIDTH = CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
    const CHART_DRAWABLE_HEIGHT = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;
    const CHART_BASELINE_Y = CHART_PADDING_TOP + CHART_DRAWABLE_HEIGHT;

    const scroll = document.getElementById('daily-scroll');
    const viewport = document.getElementById('daily-viewport');
    const spacerTop = document.getElementById('daily-spacer-top');
    const spacerBottom = document.getElementById('daily-spacer-bottom');
    const dailyGraphView = document.getElementById('daily-view-graph');
    const dailyViewButtons = document.querySelectorAll('[data-daily-view]');
    const dailyViews = document.querySelectorAll('.daily-view');
    const projectsTab = document.getElementById('tab-projects');
    const chartHiddenSeries = new Map(ALL_CHARTS.map((chart) => [chart.id, new Set()]));
    const expandedStates = DAY_DATA.map(() => false);
    const itemHeights = DAY_DATA.map(() => DAY_HEIGHT_ESTIMATE + DAY_GROUP_GAP);
    const offsets = new Array(DAY_DATA.length + 1).fill(0);
    let totalHeight = 0;
    let renderPending = false;
    let activeDailyView = 'cards';

    function escapeHtmlText(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function formatTokensCompact(value) {
      if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
      }
      if (value >= 1000) {
        return (value / 1000).toFixed(1) + 'K';
      }
      return String(value);
    }

    function formatChartValue(valueFormat, value) {
      return valueFormat === 'tokens' ? formatTokensCompact(value) : String(value);
    }

    function getChartConfig(chartId) {
      return ALL_CHARTS.find((chart) => chart.id === chartId) || null;
    }

    function getChartDays(chartId) {
      const chartDays = DAILY_CHART_IDS.has(chartId)
        ? DAILY_CHART_DATA
        : (PROJECT_CHART_DATASETS[chartId] || []);
      return chartDays.slice().reverse();
    }

    function getChartAxisPoints(chartDays) {
      return chartDays.map((day, index) => ({
        dayLabel: day.dayLabel,
        x: chartDays.length === 1
          ? CHART_PADDING_LEFT + CHART_DRAWABLE_WIDTH / 2
          : CHART_PADDING_LEFT + (index / (chartDays.length - 1)) * CHART_DRAWABLE_WIDTH,
      }));
    }

    function getChartLabelIndexes(chartDays) {
      return chartDays.length <= 6
        ? chartDays.map((_, index) => index)
        : Array.from(new Set([
          0,
          Math.round((chartDays.length - 1) * 0.25),
          Math.round((chartDays.length - 1) * 0.5),
          Math.round((chartDays.length - 1) * 0.75),
          chartDays.length - 1,
        ])).sort((left, right) => left - right);
    }

    function buildChartGuideLines(maxValue, valueFormat) {
      return Array.from(new Set([maxValue, Math.round((maxValue * 2) / 3), Math.round(maxValue / 3), 0]))
        .sort((left, right) => right - left)
        .map((value) => {
          const y = CHART_PADDING_TOP + CHART_DRAWABLE_HEIGHT - (value / maxValue) * CHART_DRAWABLE_HEIGHT;
          return '<line class="daily-chart-guide" x1="' + CHART_PADDING_LEFT + '" y1="' + y.toFixed(2) + '" x2="' + (CHART_WIDTH - CHART_PADDING_RIGHT).toFixed(2) + '" y2="' + y.toFixed(2) + '"></line>' +
            '<text class="daily-chart-guide-label" x="' + (CHART_PADDING_LEFT - 8) + '" y="' + (y + 3).toFixed(2) + '" text-anchor="end">' + escapeHtmlText(formatChartValue(valueFormat, value)) + '</text>';
        })
        .join('');
    }

    function buildChartXAxisLabels(chartAxisPoints, chartLabelIndexes) {
      return chartLabelIndexes
        .map((index) => {
          const point = chartAxisPoints[index];
          return '<text class="daily-chart-axis-label" x="' + point.x.toFixed(2) + '" y="' + (CHART_HEIGHT - 10) + '" text-anchor="middle">' + escapeHtmlText(point.dayLabel) + '</text>';
        })
        .join('');
    }

    function buildChartTooltipRows(chartConfig, dayItem, hiddenSeries) {
      if (chartConfig.id === 'daily-total-chart') {
        return [
          ['total', formatTokensCompact(dayItem.totalTokens)],
          ['input', formatTokensCompact(dayItem.inputTokens)],
          ['output', formatTokensCompact(dayItem.outputTokens)],
          ['reason', formatTokensCompact(dayItem.reasoningTokens)],
          ['cache r', formatTokensCompact(dayItem.cacheRead)],
          ['cache w', formatTokensCompact(dayItem.cacheWrite)],
        ];
      }

      return chartConfig.series
        .filter((seriesItem) => !hiddenSeries.has(seriesItem.key))
        .map((seriesItem) => [
          seriesItem.label,
          formatChartValue(chartConfig.valueFormat, Number(dayItem[seriesItem.key]) || 0),
        ]);
    }

    function buildChartTooltip(chartConfig, dayItem, hiddenSeries) {
      const rows = buildChartTooltipRows(chartConfig, dayItem, hiddenSeries);

      return '<div class="daily-chart-tooltip-day">' + escapeHtmlText(dayItem.dayLabel) + '</div>' +
        '<div class="daily-chart-tooltip-grid">' + rows.map((row) =>
          '<div class="daily-chart-tooltip-label">' + escapeHtmlText(row[0]) + '</div>' +
          '<div class="daily-chart-tooltip-value">' + escapeHtmlText(row[1]) + '</div>'
        ).join('') + '</div>';
    }

    function hideChartTooltip(chartSection) {
      if (!(chartSection instanceof Element)) return;
      const tooltip = chartSection.querySelector('[data-chart-tooltip]');
      if (tooltip instanceof HTMLElement) {
        tooltip.hidden = true;
      }
    }

    function hideAllChartTooltips() {
      document.querySelectorAll('[data-chart-tooltip]').forEach((tooltip) => {
        if (tooltip instanceof HTMLElement) {
          tooltip.hidden = true;
        }
      });
    }

    function positionChartTooltip(tooltip, wrap, clientX, clientY) {
      const wrapRect = wrap.getBoundingClientRect();
      const minOffset = 8;
      const maxLeft = Math.max(minOffset, wrap.clientWidth - tooltip.offsetWidth - minOffset);
      const maxTop = Math.max(minOffset, wrap.clientHeight - tooltip.offsetHeight - minOffset);
      const left = Math.min(maxLeft, Math.max(minOffset, clientX - wrapRect.left + 12));
      const top = Math.min(maxTop, Math.max(minOffset, clientY - wrapRect.top - tooltip.offsetHeight - 12));
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    }

    function showChartTooltip(point, clientX, clientY) {
      const chartSection = point.closest('.daily-chart-section');
      if (!(chartSection instanceof Element)) return;

      const wrap = chartSection.querySelector('.daily-chart-wrap');
      const tooltip = chartSection.querySelector('[data-chart-tooltip]');
      const chartId = chartSection.getAttribute('data-chart-id') || '';
      const chartConfig = getChartConfig(chartId);
      const chartDays = getChartDays(chartId);
      const hiddenSeries = chartHiddenSeries.get(chartId) || new Set();
      const dayIndex = Number(point.getAttribute('data-day-index'));
      const dayItem = chartDays[dayIndex];
      if (!(wrap instanceof HTMLElement) || !(tooltip instanceof HTMLElement) || Number.isNaN(dayIndex) || !dayItem || !chartConfig) {
        return;
      }

      tooltip.innerHTML = buildChartTooltip(chartConfig, dayItem, hiddenSeries);
      tooltip.hidden = false;
      positionChartTooltip(tooltip, wrap, clientX, clientY);
    }

    function updateChartLegendState(chartSection, hiddenSeries, visibleSeriesCount) {
      chartSection.querySelectorAll('.daily-chart-legend-item[data-series-key]').forEach((button) => {
        if (!(button instanceof HTMLElement)) return;
        const seriesKey = button.getAttribute('data-series-key') || '';
        const isHidden = hiddenSeries.has(seriesKey);
        button.classList.toggle('is-hidden', isHidden);
        button.setAttribute('aria-pressed', String(!isHidden));
        button.setAttribute('aria-disabled', String(!isHidden && visibleSeriesCount === 1));
      });
    }

    function renderChart(chartConfig) {
      const chartSection = document.querySelector('.daily-chart-section[data-chart-id="' + chartConfig.id + '"]');
      if (!(chartSection instanceof Element)) return;

      const svg = chartSection.querySelector('[data-chart-svg]');
      if (!(svg instanceof SVGElement)) return;

      const chartDays = getChartDays(chartConfig.id);
      if (chartDays.length === 0) {
        hideChartTooltip(chartSection);
        svg.innerHTML = '';
        return;
      }

      const chartAxisPoints = getChartAxisPoints(chartDays);
      const chartLabelIndexes = getChartLabelIndexes(chartDays);

      const hiddenSeries = chartHiddenSeries.get(chartConfig.id) || new Set();
      const visibleSeries = chartConfig.series.filter((seriesItem) => !hiddenSeries.has(seriesItem.key));
      const maxValue = visibleSeries.length === 0
        ? 1
        : chartDays.reduce((currentMaxValue, dayItem) => {
          const dayMaxValue = visibleSeries.reduce(
            (seriesMaxValue, seriesItem) => Math.max(seriesMaxValue, Number(dayItem[seriesItem.key]) || 0),
            0,
          );
          return Math.max(currentMaxValue, dayMaxValue);
        }, 0) || 1;

      const defs = chartConfig.fillArea && visibleSeries.length > 0
        ? '<defs><linearGradient id="' + chartConfig.id + '-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style="stop-color:' + visibleSeries[0].color + '; stop-opacity: 0.24;"></stop><stop offset="100%" style="stop-color:' + visibleSeries[0].color + '; stop-opacity: 0;"></stop></linearGradient></defs>'
        : '';
      const guideLines = buildChartGuideLines(maxValue, chartConfig.valueFormat);
      const xLabels = buildChartXAxisLabels(chartAxisPoints, chartLabelIndexes);
      const seriesMarkup = visibleSeries
        .map((seriesItem, seriesIndex) => {
          const points = chartDays.map((dayItem, dayIndex) => {
            const value = Number(dayItem[seriesItem.key]) || 0;
            return {
              dayIndex,
              value,
              x: chartAxisPoints[dayIndex].x,
              y: CHART_PADDING_TOP + CHART_DRAWABLE_HEIGHT - (value / maxValue) * CHART_DRAWABLE_HEIGHT,
            };
          });

          const linePath = points
            .map((point, index) => (index === 0 ? 'M' : 'L') + ' ' + point.x.toFixed(2) + ' ' + point.y.toFixed(2))
            .join(' ');
          const areaPath = chartConfig.fillArea && seriesIndex === 0 && points.length > 1
            ? linePath + ' L ' + points[points.length - 1].x.toFixed(2) + ' ' + CHART_BASELINE_Y.toFixed(2) + ' L ' + points[0].x.toFixed(2) + ' ' + CHART_BASELINE_Y.toFixed(2) + ' Z'
            : '';
          const pointMarkers = points
            .map((point) =>
              '<circle class="daily-chart-point" data-chart-id="' + escapeHtmlText(chartConfig.id) + '" data-day-index="' + point.dayIndex + '" data-series-key="' + escapeHtmlText(seriesItem.key) + '" cx="' + point.x.toFixed(2) + '" cy="' + point.y.toFixed(2) + '" r="4" style="stroke:' + seriesItem.color + '"></circle>'
            )
            .join('');

          return (areaPath ? '<path class="daily-chart-area" style="fill:url(#' + chartConfig.id + '-fill)" d="' + areaPath + '"></path>' : '') +
            '<path class="daily-chart-line" style="stroke:' + seriesItem.color + '" d="' + linePath + '"></path>' +
            pointMarkers;
        })
        .join('');

      hideChartTooltip(chartSection);
      svg.innerHTML = defs + guideLines + seriesMarkup + xLabels;
      updateChartLegendState(chartSection, hiddenSeries, visibleSeries.length);
    }

    function renderCharts(chartConfigs) {
      chartConfigs.forEach((chartConfig) => {
        renderChart(chartConfig);
      });
    }

    function renderAllCharts() {
      renderCharts(ALL_CHARTS);
    }

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
      } else {
        renderCharts(DAILY_CHARTS);
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
        '<div class="day-meta"><span class="day-badge">' + item.sessions + ' session' + (item.sessions !== 1 ? 's' : '') + '</span><span class="day-badge">' + item.steps + ' steps</span><span class="day-badge">' + item.duration + '</span><span class="day-badge">' + item.totalTokensLabel + ' tokens</span></div>' +
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

    renderAllCharts();
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

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const legendButton = target.closest('.daily-chart-legend-item[data-series-key]');
      if (!(legendButton instanceof HTMLButtonElement) || legendButton.disabled) return;

      const chartId = legendButton.getAttribute('data-chart-id');
      const seriesKey = legendButton.getAttribute('data-series-key');
      const chartConfig = chartId ? getChartConfig(chartId) : null;
      if (!chartId || !seriesKey || !chartConfig) return;

      const hiddenSeries = chartHiddenSeries.get(chartId);
      if (!hiddenSeries) return;

      const isHidden = hiddenSeries.has(seriesKey);
      const visibleSeriesCount = chartConfig.series.length - hiddenSeries.size;
      if (!isHidden && visibleSeriesCount === 1) {
        return;
      }

      if (isHidden) {
        hiddenSeries.delete(seriesKey);
      } else {
        hiddenSeries.add(seriesKey);
      }

      renderChart(chartConfig);
    });

    const handleChartPointer = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const point = target.closest('.daily-chart-point');
      if (!(point instanceof Element)) {
        hideAllChartTooltips();
        return;
      }

      showChartTooltip(point, event.clientX, event.clientY);
    };

    document.addEventListener('pointerover', handleChartPointer);
    document.addEventListener('pointermove', handleChartPointer);

    if (projectsTab) {
      projectsTab.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const card = target.closest('.card[data-project-card]');
        if (!(card instanceof HTMLElement)) return;
        if (!target.closest('.card-header') && !target.closest('.card-summary') && !target.closest('.card-bar-track')) {
          return;
        }

        card.classList.toggle('expanded');
        hideAllChartTooltips();
      });
    }

    if (dailyGraphView) {
      dailyGraphView.addEventListener('pointerleave', hideAllChartTooltips);
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
      } else {
        hideAllChartTooltips();
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
