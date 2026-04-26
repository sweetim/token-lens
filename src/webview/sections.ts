import { SEG_COLORS, stackedBarHtml } from "../bars.js";
import { escapeHtml, formatDay, formatDurationMs, formatTokens } from "../format.js";
import { ALLOWED_PROVIDERS, THREE_MONTHS_MS, toOpenRouterModelId } from "../model-data.js";
import type { ModelData } from "../model-data.js";
import type { DayTokens, ModelCost, ModelUsage, ProjectDayTokens, ProjectTokens, QuotaSummary } from "../types.js";
import { computeModelCostEstimates } from "../webview-model-cost.js";
import type { ChartConfig, TokenBreakdown } from "../webview-contract.js";

function buildModelUsageHtml(models: ModelUsage[], projectTotalTokens: number): string {
  if (models.length === 0 || projectTotalTokens === 0) {
    return "";
  }

  const sortedModels = [...models].sort((left, right) => right.totalTokens - left.totalTokens);
  const rows = sortedModels
    .map((model) => {
      const percentage = ((model.totalTokens / projectTotalTokens) * 100).toFixed(1);
      return `<div class="llm-usage-row"><span class="llm-usage-id">${escapeHtml(model.model)}</span><span class="llm-usage-value">${percentage}%</span></div>`;
    })
    .join("");

  return `<div class="llm-usage-list"><div class="llm-usage-header">LLM Usage</div>${rows}</div>`;
}

function buildProjectModelCostHtml(
  project: string,
  modelCosts: ModelCost[],
  modelData: ModelData,
  projectTokens: TokenBreakdown,
): string {
  const now = Date.now();
  const modelIds = new Set<string>();

  for (const modelCost of modelCosts) {
    if (modelCost.project !== project) {
      continue;
    }

    const openRouterModelId = toOpenRouterModelId(modelCost.provider, modelCost.model);
    const providerId = openRouterModelId.split("/")[0];
    if (!ALLOWED_PROVIDERS.has(providerId)) {
      continue;
    }

    const createdDate = modelData.createdDates[openRouterModelId];
    if (!createdDate || (now - createdDate * 1000) > THREE_MONTHS_MS) {
      continue;
    }

    modelIds.add(openRouterModelId);
  }

  const computed = computeModelCostEstimates([...modelIds], modelData.pricing, projectTokens);
  if (computed.length === 0) {
    return "";
  }

  const rows = computed
    .map(({ modelId, cost }) => `<div class="model-cost-row"><span class="model-cost-id">${escapeHtml(modelId)}</span><span class="model-cost-value">$${cost.toFixed(2)}</span></div>`)
    .join("");

  return `<div class="model-cost-list" data-project="${escapeHtml(project)}"><div class="model-cost-header">Model Cost Comparison</div>${rows}</div>`;
}

function buildGlobalCostTab(grandTokens: TokenBreakdown, modelData: ModelData): string {
  const now = Date.now();
  const threeMonthsAgo = (now - THREE_MONTHS_MS) / 1000;
  const costModelInfoText = "Click a model to save it for cost comparison in the Projects tab";
  const entries = Object.entries(modelData.pricing)
    .map(([modelId, pricing]) => ({
      modelId,
      cost: (grandTokens.inputTokens * pricing.prompt)
        + (grandTokens.outputTokens * pricing.completion)
        + (grandTokens.reasoningTokens * pricing.completion)
        + (grandTokens.cacheRead * pricing.cacheRead),
      created: modelData.createdDates[modelId] ?? 0,
    }))
    .filter((entry) => entry.cost > 0)
    .sort((left, right) => left.cost - right.cost);

  if (entries.length === 0) {
    return '<p class="empty">No model pricing data available.</p>';
  }

  const providers = [...new Set(entries.map((entry) => entry.modelId.split("/")[0]))].sort();
  const filterButtons = [
    '<button class="cost-provider-filter active" data-cost-provider="all" type="button">All</button>',
    ...providers.map((provider) => `<button class="cost-provider-filter" data-cost-provider="${escapeHtml(provider)}" type="button">${escapeHtml(provider)}</button>`),
  ].join("");
  const rows = entries
    .map(({ modelId, cost, created }) => `<div class="model-cost-row" data-provider="${escapeHtml(modelId.split("/")[0])}" data-cost="${cost}" data-created="${created}" data-model-id="${escapeHtml(modelId)}"><span class="model-cost-id">${escapeHtml(modelId)}</span><span class="model-cost-value">$${cost.toFixed(2)}</span></div>`)
    .join("");
  const totalTokens = grandTokens.inputTokens + grandTokens.outputTokens + grandTokens.reasoningTokens + grandTokens.cacheRead;

  return `<div class="cost-tab-inner">
    <div class="cost-token-summary">
      <div class="cost-token-stat"><span class="cost-token-value">${formatTokens(totalTokens)}</span><span class="cost-token-label">Total Tokens</span></div>
      <div class="cost-token-stat"><span class="cost-token-value">${formatTokens(grandTokens.inputTokens)}</span><span class="cost-token-label">Input</span></div>
      <div class="cost-token-stat"><span class="cost-token-value">${formatTokens(grandTokens.outputTokens)}</span><span class="cost-token-label">Output</span></div>
      <div class="cost-token-stat"><span class="cost-token-value">${formatTokens(grandTokens.reasoningTokens)}</span><span class="cost-token-label">Reasoning</span></div>
      <div class="cost-token-stat"><span class="cost-token-value">${formatTokens(grandTokens.cacheRead)}</span><span class="cost-token-label">Cache Read</span></div>
    </div>
    <button class="cost-filter-toggle" data-cost-filter-toggle type="button" aria-expanded="true">
      <svg class="cost-filter-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Filters
    </button>
    <div class="cost-toolbar" data-cost-filter-body>
      <div class="cost-provider-filters">${filterButtons}</div>
      <div class="cost-toolbar-row">
        <div class="cost-sort">
          <button class="cost-sort-button active" data-cost-sort="asc" type="button">Low → High</button>
          <button class="cost-sort-button" data-cost-sort="desc" type="button">High → Low</button>
        </div>
        <button class="cost-age-filter" data-cost-age-toggle type="button">≤ 3 months</button>
      </div>
    </div>
    <div class="model-cost-list" id="cost-model-list" data-three-months-ago="${threeMonthsAgo}"><div class="model-cost-header"><span>Estimated Cost Per Model</span><span class="model-cost-info"><button class="model-cost-info-button" type="button" aria-label="${escapeHtml(costModelInfoText)}" data-info-tooltip-text="${escapeHtml(costModelInfoText)}"><svg class="model-cost-info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5"/><path d="M8 7.1V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="4.75" r="1" fill="currentColor"/></svg></button></span></div>${rows}</div>
  </div>`;
}

function buildDailyChartSection(chart: ChartConfig): string {
  const legend = chart.series
    .map((seriesItem) => `<button class="daily-chart-legend-item${chart.series.length === 1 ? " is-static" : ""}" type="button" data-chart-id="${chart.id}" data-series-key="${seriesItem.key}" aria-pressed="true"${chart.series.length === 1 ? ' disabled aria-disabled="true"' : ""}><span class="daily-chart-legend-swatch" style="background:${seriesItem.color}"></span><span class="daily-chart-legend-label">${escapeHtml(seriesItem.label)}</span></button>`)
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

function buildDailyLineChart(days: DayTokens[], chartConfigs: ChartConfig[]): string {
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
          <span class="daily-graph-stat-value" data-stat="latest-value">${formatTokens(latestDay.totalTokens)}</span>
          <span class="daily-graph-stat-label" data-stat="latest-label">Latest Day</span>
        </div>
        <div class="daily-graph-stat">
          <span class="daily-graph-stat-value" data-stat="average-value">${formatTokens(averageTokens)}</span>
          <span class="daily-graph-stat-label" data-stat="average-label">Average / Day</span>
        </div>
        <div class="daily-graph-stat">
          <span class="daily-graph-stat-value" data-stat="peak-value">${formatTokens(peakDay.totalTokens)}</span>
          <span class="daily-graph-stat-label" data-stat="peak-label">Peak (${escapeHtml(formatDay(peakDay.day))})</span>
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

type ProjectCardsParams = {
  modelCosts: ModelCost[];
  modelData: ModelData;
  projectChartConfigs: ChartConfig[];
  projectDaysByProject: Map<string, ProjectDayTokens[]>;
  projects: ProjectTokens[];
};

function buildProjectCards({
  modelCosts,
  modelData,
  projectChartConfigs,
  projectDaysByProject,
  projects,
}: ProjectCardsParams): string {
  return projects
    .map((project, index) => {
      const projectChart = projectChartConfigs[index];
      const projectDayRows = projectDaysByProject.get(project.project) ?? [];
      const bar = stackedBarHtml(project.totalTokens, [
        { value: project.inputTokens, color: SEG_COLORS.input },
        { value: project.outputTokens, color: SEG_COLORS.output },
        { value: project.reasoningTokens, color: SEG_COLORS.reasoning },
        { value: project.cacheRead, color: SEG_COLORS.cacheRead },
        { value: project.cacheWrite, color: SEG_COLORS.cacheWrite },
      ]);

      return `
      <div class="card" data-project-card>
        <div class="card-header">
          <div class="card-title-group">
            <span class="card-name">${escapeHtml(project.project)}</span>
            <span class="card-total-badge">${formatTokens(project.totalTokens)} tokens</span>
          </div>
          <span class="card-cost">$${project.totalCost.toFixed(2)}</span>
        </div>
        ${bar}
        <div class="card-summary">
          <div class="stat">
            <span class="stat-value">${formatTokens(project.inputTokens)}</span>
            <span class="stat-label">input</span>
          </div>
          <div class="stat">
            <span class="stat-value">${formatTokens(project.outputTokens)}</span>
            <span class="stat-label">output</span>
          </div>
          <div class="stat">
            <span class="stat-value">${project.sessions}</span>
            <span class="stat-label">sessions</span>
          </div>
          <div class="stat">
            <span class="stat-value">${formatTokens(project.steps)}</span>
            <span class="stat-label">steps</span>
          </div>
        </div>
        <div class="card-details">
          <div class="card-stats card-stats-four">
            <div class="stat">
              <span class="stat-value">${formatTokens(project.inputTokens)}</span>
              <span class="stat-label">input</span>
            </div>
            <div class="stat">
              <span class="stat-value">${formatTokens(project.outputTokens)}</span>
              <span class="stat-label">output</span>
            </div>
            <div class="stat">
              <span class="stat-value">${project.sessions}</span>
              <span class="stat-label">sessions</span>
            </div>
            <div class="stat">
              <span class="stat-value">${formatTokens(project.steps)}</span>
              <span class="stat-label">steps</span>
            </div>
          </div>
          <div class="card-stats card-stats-four">
            <div class="stat">
              <span class="stat-value">${formatTokens(project.reasoningTokens)}</span>
              <span class="stat-label">reason</span>
            </div>
            <div class="stat">
              <span class="stat-value">${formatTokens(project.cacheRead)}</span>
              <span class="stat-label">cache r</span>
            </div>
            <div class="stat">
              <span class="stat-value">${formatTokens(project.cacheWrite)}</span>
              <span class="stat-label">cache w</span>
            </div>
            <div class="stat">
              <span class="stat-value">${formatDurationMs(project.duration)}</span>
              <span class="stat-label">duration</span>
            </div>
          </div>
          <div class="project-card-section">
            ${projectDayRows.length > 0 && projectChart ? buildDailyChartSection(projectChart) : '<p class="empty">No daily token usage data found for this project.</p>'}
          </div>
          ${buildModelUsageHtml(project.models, project.totalTokens)}
          ${buildProjectModelCostHtml(project.project, modelCosts, modelData, {
            inputTokens: project.inputTokens,
            outputTokens: project.outputTokens,
            reasoningTokens: project.reasoningTokens,
            cacheRead: project.cacheRead,
          })}
        </div>
      </div>`;
    })
    .join("");
}

export {
  buildDailyChartSection,
  buildDailyLineChart,
  buildGlobalCostTab,
  buildProjectCards,
  buildQuotaSection,
};
