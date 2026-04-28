import dayjs from "dayjs";
import { SEG_COLORS } from "../bars.js";
import { formatDay, formatDurationMs, formatTokens } from "../format.js";
import { ALLOWED_PROVIDERS, THREE_MONTHS_MS, fetchModelDataWithStatus, toOpenRouterModelId } from "../model-data.js";
import type { ModelData } from "../model-data.js";
import type { DayTokens, ModelCost, ProjectDayTokens, ProjectTokens, QuotaState } from "../types.js";
import type { ChartConfig, ChartDayItem, CostEntryData, PricingStateData, PricingStatus, ProjectCardData, QuotaStateData, TokenBreakdown, WebviewData } from "../webview-contract.js";

function getDailyChartConfigs(): ChartConfig[] {
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

function mapChartDayData(row: DayTokens | ProjectDayTokens): ChartDayItem {
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
    durationMs: row.duration,
    models: "models" in row ? row.models.map((model) => ({ model: model.model, openRouterModelId: toOpenRouterModelId(model.provider, model.model), totalTokens: model.totalTokens })) : [],
  };
}

function buildProjectChartConfigs(projects: ProjectTokens[]): ChartConfig[] {
  return projects.map((_project, index) => ({
    id: `project-total-chart-${index}`,
    title: "",
    valueFormat: "tokens",
    fillArea: true,
    hideTitle: true,
    series: [{ key: "totalTokens", label: "total tokens", color: "var(--accent)" }],
  }));
}

function buildProjectDaysByProject(projectDays: ProjectDayTokens[]): Map<string, ProjectDayTokens[]> {
  return projectDays.reduce((result, row) => {
    const rows = result.get(row.project);
    if (rows) {
      rows.push(row);
    } else {
      result.set(row.project, [row]);
    }
    return result;
  }, new Map<string, ProjectDayTokens[]>());
}

function buildProjectModelIds(
  projects: ProjectTokens[],
  modelCosts: ModelCost[],
  modelData: ModelData,
): Record<string, string[]> {
  const now = Date.now();

  return Object.fromEntries(projects.map((project) => {
    const projectCosts = modelCosts.filter((modelCost) => modelCost.project === project.project);
    const modelIds = new Set<string>();

    for (const modelCost of projectCosts) {
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

    return [project.project, [...modelIds]];
  }));
}

function buildQuotaStateData(quotaState: QuotaState): QuotaStateData {
  return {
    status: quotaState.status,
    message: quotaState.message,
    summary: quotaState.summary
      ? {
          usedPercentage: quotaState.summary.usedPercentage,
          remainingPercentage: quotaState.summary.remainingPercentage,
          nextResetTime: quotaState.summary.nextResetTime,
        }
      : null,
  };
}

function buildPricingStateData(status: PricingStatus): PricingStateData {
  if (status === "loading") {
    return { status, message: "Loading OpenRouter model prices..." };
  }
  if (status === "cached") {
    return { status, message: "Using cached OpenRouter model prices." };
  }
  if (status === "unavailable") {
    return { status, message: "OpenRouter prices could not be loaded. Token usage is still available." };
  }
  return { status, message: "OpenRouter model prices updated." };
}

function buildProjectCardsData(projects: ProjectTokens[]): ProjectCardData[] {
  return projects.map((project) => ({
    project: project.project,
    totalTokens: project.totalTokens,
    inputTokens: project.inputTokens,
    outputTokens: project.outputTokens,
    reasoningTokens: project.reasoningTokens,
    cacheRead: project.cacheRead,
    cacheWrite: project.cacheWrite,
    totalCost: project.totalCost,
    sessions: project.sessions,
    steps: project.steps,
    duration: project.duration,
    models: project.models.map((m) => ({ model: m.model, openRouterModelId: toOpenRouterModelId(m.provider, m.model), totalTokens: m.totalTokens })),
  }));
}

function buildCostEntries(grandTokens: TokenBreakdown, modelData: ModelData): CostEntryData[] {
  return Object.entries(modelData.pricing)
    .map(([modelId, pricing]) => ({
      modelId,
      cost: (grandTokens.inputTokens * pricing.prompt)
        + (grandTokens.outputTokens * pricing.completion)
        + (grandTokens.reasoningTokens * pricing.completion)
        + (grandTokens.cacheRead * pricing.cacheRead),
      provider: modelId.split("/")[0],
      created: modelData.createdDates[modelId] ?? 0,
    }))
    .filter((entry) => entry.cost > 0)
    .sort((left, right) => left.cost - right.cost);
}

async function buildWebviewData(
  projects: ProjectTokens[],
  days: DayTokens[],
  projectDays: ProjectDayTokens[],
  modelCosts: ModelCost[],
  quotaState: QuotaState,
  modelDataOverride?: ModelData,
  pricingStatusOverride?: PricingStatus,
): Promise<WebviewData> {
  const grandTotal = projects.reduce((sum, row) => sum + row.totalTokens, 0);
  const grandCost = projects.reduce((sum, row) => sum + row.totalCost, 0);
  const grandSteps = projects.reduce((sum, row) => sum + row.steps, 0);
  const grandTokens: TokenBreakdown = {
    inputTokens: projects.reduce((sum, row) => sum + row.inputTokens, 0),
    outputTokens: projects.reduce((sum, row) => sum + row.outputTokens, 0),
    reasoningTokens: projects.reduce((sum, row) => sum + row.reasoningTokens, 0),
    cacheRead: projects.reduce((sum, row) => sum + row.cacheRead, 0),
  };
  const todayKey = dayjs().format("YYYY-MM-DD");
  const todayTotalTokens = days.find((day) => day.day === todayKey)?.totalTokens ?? 0;
  const projectDaysByProject = buildProjectDaysByProject(projectDays);
  const dailyChartConfigs = getDailyChartConfigs();
  const projectChartConfigs = buildProjectChartConfigs(projects);
  const modelDataResult = modelDataOverride
    ? { data: modelDataOverride, status: pricingStatusOverride ?? "ready" }
    : await fetchModelDataWithStatus();
  const modelData = modelDataResult.data;
  const pricingState = buildPricingStateData(pricingStatusOverride ?? modelDataResult.status);
  const now = Date.now();

  const tokenTypes = [
    { key: "inputTokens", color: SEG_COLORS.input, label: "input" },
    { key: "outputTokens", color: SEG_COLORS.output, label: "output" },
    { key: "reasoningTokens", color: SEG_COLORS.reasoning, label: "reason" },
    { key: "cacheRead", color: SEG_COLORS.cacheRead, label: "cache r" },
    { key: "cacheWrite", color: SEG_COLORS.cacheWrite, label: "cache w" },
  ] as const;

  const summaryKeys = new Set(["inputTokens", "outputTokens"]);
  const costEntries = buildCostEntries(grandTokens, modelData);
  const providers = [...new Set(costEntries.map((entry) => entry.provider))].sort();

  return {
    dayData: days.map((day) => {
      const dayMax = tokenTypes.reduce((max, tt) => Math.max(max, day[tt.key]), 0) || 1;
      return {
        ...mapChartDayData(day),
        durationMs: day.duration,
        summaryBars: tokenTypes.filter((tokenType) => summaryKeys.has(tokenType.key)).map((tokenType) => ({
          label: tokenType.label,
          color: tokenType.color,
          pct: ((day[tokenType.key] / dayMax) * 100).toFixed(1),
          value: formatTokens(day[tokenType.key]),
        })),
        detailBars: tokenTypes.filter((tokenType) => !summaryKeys.has(tokenType.key)).map((tokenType) => ({
          label: tokenType.label,
          color: tokenType.color,
          pct: ((day[tokenType.key] / dayMax) * 100).toFixed(1),
          value: formatTokens(day[tokenType.key]),
        })),
      };
    }),
    dailyCharts: dailyChartConfigs,
    projectCharts: projectChartConfigs,
    dailyChartIds: dailyChartConfigs.map((chart) => chart.id),
    dailyChartData: days.map((day) => mapChartDayData(day)),
    projectChartDataSets: Object.fromEntries(projects.map((project, index) => [
      projectChartConfigs[index].id,
      (projectDaysByProject.get(project.project) ?? []).map((day) => mapChartDayData(day)),
    ])),
    defaultTab: projects.length > 0 ? "projects" : "daily",
    modelPricing: modelData.pricing,
    projectTokenBreakdowns: Object.fromEntries(projects.map((project) => [
      project.project,
      {
        inputTokens: project.inputTokens,
        outputTokens: project.outputTokens,
        reasoningTokens: project.reasoningTokens,
        cacheRead: project.cacheRead,
      },
    ])),
    projectModelIds: buildProjectModelIds(projects, modelCosts, modelData),
    quotaState: buildQuotaStateData(quotaState),
    pricingState,
    hero: {
      todayTokens: todayTotalTokens,
      totalTokens: grandTotal,
      totalCost: grandCost,
      totalSteps: grandSteps,
    },
    projects: buildProjectCardsData(projects),
    grandTokens,
    costEntries,
    providers,
    threeMonthsAgo: (now - THREE_MONTHS_MS) / 1000,
    hasData: projects.length > 0 || days.length > 0,
    hasDays: days.length > 0,
    hasProjects: projects.length > 0,
  };
}

export { buildWebviewData, buildPricingStateData };
