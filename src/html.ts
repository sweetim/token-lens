import type { ProjectTokens, DayTokens, ProjectDayTokens, ModelCost, ModelUsage, QuotaSummary } from "./types.js";
import { formatTokens, escapeHtml, formatDay, formatDurationMs } from "./format.js";
import { stackedBarHtml, SEG_COLORS } from "./bars.js";
import { THREE_MONTHS_MS, ALLOWED_PROVIDERS, toOpenRouterModelId, fetchModelData } from "./model-data.js";
import type { ModelData } from "./model-data.js";
import { STYLES } from "./styles.js";
import * as vscode from "vscode";
import { getDataScript } from "./client-script.js";

async function buildModelCostHtml(modelCosts: ModelCost[], project: string): Promise<string> {
  const now = Date.now();
  const projectCosts = modelCosts.filter((m) => m.project === project);
  if (projectCosts.length === 0) {
    return "";
  }

  const modelData = await fetchModelData();

  const aggregated = new Map<string, { inputTokens: number; outputTokens: number }>();
  for (const m of projectCosts) {
    const openRouterId = toOpenRouterModelId(m.provider, m.model);
    const slashProvider = openRouterId.split("/")[0];
    if (!ALLOWED_PROVIDERS.has(slashProvider)) {
      continue;
    }
    const createdDate = modelData.createdDates[openRouterId];
    if (!createdDate || (now - createdDate * 1000) > THREE_MONTHS_MS) {
      continue;
    }
    const existing = aggregated.get(openRouterId);
    if (existing) {
      existing.inputTokens += m.inputTokens;
      existing.outputTokens += m.outputTokens;
    } else {
      aggregated.set(openRouterId, { inputTokens: m.inputTokens, outputTokens: m.outputTokens });
    }
  }

  const computed = [...aggregated.entries()]
    .map(([modelId, tokens]) => {
      const pricing = modelData.pricing[modelId];
      if (!pricing) {
        return null;
      }
      const cost = (tokens.inputTokens * pricing.prompt) + (tokens.outputTokens * pricing.completion);
      return { modelId, cost };
    })
    .filter((r): r is { modelId: string; cost: number } => r !== null && r.cost > 0)
    .sort((a, b) => b.cost - a.cost);

  if (computed.length === 0) {
    return "";
  }

  const rows = computed
    .map(({ modelId, cost }) => `<div class="model-cost-row"><span class="model-cost-id">${escapeHtml(modelId)}</span><span class="model-cost-value">$${cost.toFixed(2)}</span></div>`)
    .join("");

  return `<div class="model-cost-list"><div class="model-cost-header">Model Costs</div>${rows}</div>`;
}

function buildModelUsageHtml(models: ModelUsage[], projectTotalTokens: number): string {
  if (models.length === 0 || projectTotalTokens === 0) {
    return "";
  }
  const sorted = [...models].sort((a, b) => b.totalTokens - a.totalTokens);
  const rows = sorted
    .map((m) => {
      const pct = ((m.totalTokens / projectTotalTokens) * 100).toFixed(1);
      return `<div class="llm-usage-row"><span class="llm-usage-id">${escapeHtml(m.model)}</span><span class="llm-usage-value">${pct}%</span></div>`;
    })
    .join("");
  return `<div class="llm-usage-list"><div class="llm-usage-header">LLM Usage</div>${rows}</div>`;
}

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
    models: "models" in row ? row.models : [],
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

  const pieChartSection = `
    <section class="daily-chart-section" data-chart-id="daily-model-pie">
      <div class="daily-chart-header">
        <div class="daily-chart-title">LLM Usage</div>
      </div>
      <div class="pie-chart-wrap">
        <svg class="pie-chart" viewBox="0 0 200 200" role="img" aria-label="LLM usage distribution"></svg>
        <div class="pie-legend" id="pie-legend"></div>
      </div>
    </section>`;

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
      ${pieChartSection}
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

async function getHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  projects: ProjectTokens[],
  days: DayTokens[],
  projectDays: ProjectDayTokens[],
  modelCosts: ModelCost[],
  quotaSummary?: QuotaSummary,
): string {
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
          ${buildModelUsageHtml(r.models, r.totalTokens)}
          ${buildModelCostHtml(modelCosts, r.project)}
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

  const clientScript = getDataScript({
    dayDataJson,
    dailyChartDataJson,
    projectChartDataJson,
    dailyChartIdsJson,
    sharedDailyChartDayDataJson,
    projectChartDataSetsJson,
    defaultTabIsDaily: defaultTab === "daily",
  });

  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "webview-client.js"));

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${STYLES}
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
          <button class="view-toggle-button active" data-daily-view="cards" type="button" aria-label="Cards"><svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1" y="1" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="9.5" y="1" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="1" y="9.5" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" fill="currentColor"/></svg></button>
          <button class="view-toggle-button" data-daily-view="graph" type="button" aria-label="Graph"><svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 14L5.5 8L8.5 10.5L14 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
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
  <script>${clientScript}
  </script>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}

export { getHtml };
