import { useState, useCallback, useMemo, useEffect } from "preact/hooks";
import { computeModelCostEstimates } from "../../src/webview-model-cost.js";
import { MODEL_COLORS } from "./constants.js";
import { formatTokensCompact } from "./view-helpers.js";
import { DailyTab } from "./components/DailyTab.js";
import { CostTab } from "./components/CostTab.js";
import { LineChart } from "./components/Chart.js";
import type {
  ChartConfig,
  ChartDayItem,
  CostFilterState,
  DayModelUsage,
  ProjectCardData,
  QuotaStateData,
  HeroStatsData,
  TokenBreakdown,
  ModelPricing,
  WebviewData,
} from "../../src/webview-contract.js";
import { getCostFilterState, getSavedModels, setCostFilterState, setSavedModels } from "./bootstrap.js";

const Z_AI_LOGO_SVG = (
  <svg class="quota-brand-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="3" fill="currentColor" />
    <path d="M12.5 5.5L11.4 7.1c-.15.22-.41.36-.7.36H5.5V5.5h7z" fill="#fff" />
    <path d="M18.5 5.5L9.7 18.5H5.5L14.3 5.5h4.2z" fill="#fff" />
    <path d="M11.5 18.5l1.1-1.6c.15-.22.41-.36.7-.36h5.2v1.96h-7z" fill="#fff" />
  </svg>
);

function QuotaSection({ quotaState }: { quotaState: QuotaStateData }) {
  const summary = quotaState.summary;
  const usedPercentage = summary ? Math.max(0, Math.min(100, summary.usedPercentage)) : 0;
  const remainingPercentage = summary ? Math.max(0, Math.min(100, summary.remainingPercentage)) : 0;

  const resetDurationLabel = summary
    ? formatDurationUntil(summary.nextResetTime)
    : quotaState.status === "loading"
      ? "Loading"
      : quotaState.status === "rateLimited"
        ? "Retrying"
        : "Unavailable";

  const usageValueLabel = summary
    ? `${usedPercentage.toFixed(1)}% used`
    : quotaState.status === "loading"
      ? "Loading quota..."
      : "Usage unavailable";

  const fillColor = summary
    ? getRemainingBarColor(remainingPercentage)
    : "var(--border)";

  const progressStyle = summary
    ? `width:${usedPercentage.toFixed(1)}%;background:${fillColor}`
    : "width:0%;background:var(--border)";

  const statusHtml = quotaState.message
    ? <div class="quota-status-message">{quotaState.message}</div>
    : null;

  return (
    <div class="quota-hero">
      <div class="quota-header">
        <div class="quota-brand">
          {Z_AI_LOGO_SVG}
          <span class="quota-title">Quota Usage</span>
        </div>
        <span class="quota-reset-badge">reset <span class="quota-reset-duration">{resetDurationLabel}</span></span>
      </div>
      <div class="quota-progress-section">
        <div class="quota-progress-header">
          <span class="quota-progress-label">Usage</span>
          <span class="quota-progress-value">{usageValueLabel}</span>
        </div>
        <div class="quota-progress-track">
          <div class="quota-progress-fill" style={progressStyle} />
        </div>
        {statusHtml}
      </div>
    </div>
  );
}

function formatDurationUntil(timestamp: number): string {
  const diff = timestamp - Date.now();
  if (diff <= 0) return "now";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getRemainingBarColor(remainingPercentage: number): string {
  if (remainingPercentage <= 20) return "var(--vscode-charts-red, #f14c4c)";
  if (remainingPercentage <= 50) return "var(--orange)";
  return "var(--green)";
}

function HeroSection({ hero }: { hero: HeroStatsData }) {
  return (
    <div class="hero">
      <div class="hero-title">Kilo Total Token Usage</div>
      <div class="hero-grid">
        <div class="hero-stat"><span class="val today">{formatTokensCompact(hero.todayTokens)}</span><span class="lbl">Today</span></div>
        <div class="hero-stat"><span class="val tokens">{formatTokensCompact(hero.totalTokens)}</span><span class="lbl">Total</span></div>
        <div class="hero-stat"><span class="val cost">${hero.totalCost.toFixed(2)}</span><span class="lbl">Costs</span></div>
        <div class="hero-stat"><span class="val steps">{hero.totalSteps}</span><span class="lbl">Steps</span></div>
      </div>
    </div>
  );
}

const SEG_COLORS = {
  input: "#3794ff",
  output: "#89d185",
  reasoning: "#b180d7",
  cacheRead: "#d18616",
  cacheWrite: "#4ec9b0",
};

function ProjectCard({
  project,
  chartConfig,
  chartData,
  modelPricing,
  getSavedModels,
  allProjectModelIds,
  projectTokenBreakdown,
}: {
  project: ProjectCardData;
  chartConfig: ChartConfig | null;
  chartData: ChartDayItem[];
  modelPricing: ModelPricing;
  getSavedModels: () => string[];
  allProjectModelIds: string[];
  projectTokenBreakdown: TokenBreakdown;
}) {
  const [expanded, setExpanded] = useState(false);

  const segments = [
    { value: project.inputTokens, color: SEG_COLORS.input },
    { value: project.outputTokens, color: SEG_COLORS.output },
    { value: project.reasoningTokens, color: SEG_COLORS.reasoning },
    { value: project.cacheRead, color: SEG_COLORS.cacheRead },
    { value: project.cacheWrite, color: SEG_COLORS.cacheWrite },
  ].filter((s) => s.value > 0);

  const barHtml = project.totalTokens > 0 ? (
    <div class="card-bar-track">
      {segments.map((s, i) => (
        <div key={i} class="card-bar-seg" style={{ width: ((s.value / project.totalTokens) * 100).toFixed(1) + "%", background: s.color }} />
      ))}
    </div>
  ) : <div class="card-bar-track" />;

  const sortedModels = useMemo(() =>
    [...project.models].sort((a, b) => b.totalTokens - a.totalTokens),
    [project.models],
  );

  const modelUsageHtml = sortedModels.length > 0 && project.totalTokens > 0 ? (
    <div class="llm-usage-list">
      <div class="llm-usage-header">LLM Usage</div>
      {sortedModels.map((model) => {
        const pct = ((model.totalTokens / project.totalTokens) * 100).toFixed(1);
        return (
          <div key={model.model} class="llm-usage-row">
            <span class="llm-usage-id">{model.model}</span>
            <span class="llm-usage-value">{pct}%</span>
          </div>
        );
      })}
    </div>
  ) : null;

  const [infoTooltip, setInfoTooltip] = useState<{ text: string; left: number; top: number } | null>(null);

  const showInfoTooltip = useCallback((trigger: HTMLElement, text: string) => {
    const rect = trigger.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const tw = 220;
    const th = 60;
    const margin = 12;
    const gap = 8;
    let left = rect.left + rect.width / 2 - tw / 2;
    let top = rect.bottom + gap;
    left = Math.max(margin, Math.min(left, vw - tw - margin));
    if (top + th > vh - margin) top = Math.max(margin, rect.top - th - gap);
    setInfoTooltip({ text, left: Math.round(left), top: Math.round(top) });
  }, []);

  useEffect(() => {
    const hide = () => setInfoTooltip(null);
    document.addEventListener("scroll", hide, true);
    return () => document.removeEventListener("scroll", hide, true);
  }, []);

  const savedModels = getSavedModels();
  const modelCostIds = savedModels.length > 0 ? savedModels : allProjectModelIds;
  const modelCosts = computeModelCostEstimates(modelCostIds, modelPricing, projectTokenBreakdown);

  const tooltipText = "This comparison uses models selected in the Cost tab. If none are selected, it compares only models used in this project";

  const modelCostHtml = modelCosts.length > 0 ? (
    <div class="model-cost-list" data-project={project.project}>
      <div class="model-cost-header">
        <span>Model Cost Comparison</span>
        <span class="model-cost-info">
          <button
            class="model-cost-info-button"
            type="button"
            aria-label={tooltipText}
            onMouseEnter={(e) => showInfoTooltip(e.currentTarget, tooltipText)}
            onFocus={(e) => showInfoTooltip(e.currentTarget, tooltipText)}
            onMouseLeave={() => setInfoTooltip(null)}
            onBlur={() => setInfoTooltip(null)}
          >
            <svg class="model-cost-info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5" /><path d="M8 7.1V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /><circle cx="8" cy="4.75" r="1" fill="currentColor" /></svg>
          </button>
        </span>
      </div>
      {modelCosts.map(({ modelId, cost }) => (
        <div key={modelId} class="model-cost-row">
          <span class="model-cost-id">{modelId}</span>
          <span class="model-cost-value">${cost.toFixed(2)}</span>
        </div>
      ))}
    </div>
  ) : null;

  const infoTooltipHtml = infoTooltip ? (
    <div class="model-cost-info-tooltip-overlay visible" style={{ left: infoTooltip.left + "px", top: infoTooltip.top + "px" }}>
      {infoTooltip.text}
    </div>
  ) : null;

  const handleToggle = useCallback(() => setExpanded((e) => !e), []);

  return (
    <div class={`card${expanded ? " expanded" : ""}`} data-project-card>
      <div class="card-header" onClick={handleToggle}>
        <div class="card-title-group">
          <span class="card-name">{project.project}</span>
          <span class="card-total-badge">{formatTokensCompact(project.totalTokens)} tokens</span>
        </div>
        <span class="card-cost">${project.totalCost.toFixed(2)}</span>
      </div>
      <div class="card-bar-track" onClick={handleToggle}>
        {segments.map((s, i) => (
          <div key={i} class="card-bar-seg" style={{ width: ((s.value / project.totalTokens) * 100).toFixed(1) + "%", background: s.color }} />
        ))}
      </div>
      {!expanded ? (
        <div class="card-summary" onClick={handleToggle}>
          <div class="stat"><span class="stat-value">{formatTokensCompact(project.inputTokens)}</span><span class="stat-label">input</span></div>
          <div class="stat"><span class="stat-value">{formatTokensCompact(project.outputTokens)}</span><span class="stat-label">output</span></div>
          <div class="stat"><span class="stat-value">{project.sessions}</span><span class="stat-label">sessions</span></div>
          <div class="stat"><span class="stat-value">{formatTokensCompact(project.steps)}</span><span class="stat-label">steps</span></div>
        </div>
      ) : (
        <div class="card-details">
          <div class="card-stats card-stats-four">
            <div class="stat"><span class="stat-value">{formatTokensCompact(project.inputTokens)}</span><span class="stat-label">input</span></div>
            <div class="stat"><span class="stat-value">{formatTokensCompact(project.outputTokens)}</span><span class="stat-label">output</span></div>
            <div class="stat"><span class="stat-value">{project.sessions}</span><span class="stat-label">sessions</span></div>
            <div class="stat"><span class="stat-value">{formatTokensCompact(project.steps)}</span><span class="stat-label">steps</span></div>
          </div>
          <div class="card-stats card-stats-four">
            <div class="stat"><span class="stat-value">{formatTokensCompact(project.reasoningTokens)}</span><span class="stat-label">reason</span></div>
            <div class="stat"><span class="stat-value">{formatTokensCompact(project.cacheRead)}</span><span class="stat-label">cache r</span></div>
            <div class="stat"><span class="stat-value">{formatTokensCompact(project.cacheWrite)}</span><span class="stat-label">cache w</span></div>
            <div class="stat"><span class="stat-value">{formatDurationMs(project.duration)}</span><span class="stat-label">duration</span></div>
          </div>
          <div class="project-card-section">
            {chartData.length > 0 && chartConfig ? (
              <LineChart config={chartConfig} days={chartData} />
            ) : <p class="empty">No daily token usage data found for this project.</p>}
          </div>
          {modelUsageHtml}
          {modelCostHtml}
          {infoTooltipHtml}
        </div>
      )}
    </div>
  );
}

function formatDurationMs(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? days + "d " + remainingHours + "h" : days + "d";
  }
  return hours > 0 ? hours + "h " + minutes + "m" : minutes + "m";
}

type Tab = "projects" | "daily" | "cost";

function App({ data }: { data: WebviewData }) {
  const [activeTab, setActiveTab] = useState<Tab>(data.defaultTab);

  if (!data.hasData) {
    return (
      <>
        <QuotaSection quotaState={data.quotaState} />
        <HeroSection hero={data.hero} />
        <p class="empty">No token usage data found.<br />Make sure Kilo is installed and ~/.local/share/kilo/kilo.db exists.</p>
      </>
    );
  }

  return (
    <>
      <QuotaSection quotaState={data.quotaState} />
      <HeroSection hero={data.hero} />
      <div class="tabs">
        <button class={`tab${activeTab === "projects" ? " active" : ""}`} data-tab="projects" onClick={() => setActiveTab("projects")}>Projects</button>
        <button class={`tab${activeTab === "daily" ? " active" : ""}`} data-tab="daily" onClick={() => setActiveTab("daily")}>Time</button>
        <button class={`tab${activeTab === "cost" ? " active" : ""}`} data-tab="cost" onClick={() => setActiveTab("cost")}>Cost</button>
      </div>
      {activeTab === "projects" && (
        <div class={`tab-content${activeTab === "projects" ? " active" : ""}`} id="tab-projects">
          {data.hasProjects ? (
            <div class="cards">
              {data.projects.map((project, index) => {
                const chartConfig = data.projectCharts[index] ?? null;
                const chartData = chartConfig ? (data.projectChartDataSets[chartConfig.id] ?? []) : [];
                const tokenBreakdown = data.projectTokenBreakdowns[project.project];
                const modelIds = data.projectModelIds[project.project] ?? [];
                return (
                  <ProjectCard
                    key={project.project}
                    project={project}
                    chartConfig={chartConfig}
                    chartData={chartData}
                    modelPricing={data.modelPricing}
                    getSavedModels={getSavedModels}
                    allProjectModelIds={modelIds}
                    projectTokenBreakdown={tokenBreakdown}
                  />
                );
              })}
            </div>
          ) : <p class="empty">No project token usage data found.</p>}
        </div>
      )}
      {activeTab === "daily" && (
        <div class={`tab-content${activeTab === "daily" ? " active" : ""}`} id="tab-daily">
          {data.hasDays ? (
            <DailyTab
              dayData={data.dayData}
              chartData={data.dailyChartData}
              charts={data.dailyCharts}
              modelPricing={data.modelPricing}
              getSavedModels={getSavedModels}
              isDefaultTab={data.defaultTab === "daily"}
            />
          ) : <p class="empty">No daily token usage data found.</p>}
        </div>
      )}
      {activeTab === "cost" && (
        <div class={`tab-content${activeTab === "cost" ? " active" : ""}`} id="tab-cost">
          <CostTab
            grandTokens={data.grandTokens}
            modelPricing={data.modelPricing}
            costEntries={data.costEntries}
            providers={data.providers}
            threeMonthsAgo={data.threeMonthsAgo}
            getCostFilterState={getCostFilterState}
            setCostFilterState={setCostFilterState}
            getSavedModels={getSavedModels}
            setSavedModels={setSavedModels}
            projectTokenBreakdowns={data.projectTokenBreakdowns}
            projectModelIds={data.projectModelIds}
            projects={data.projects}
          />
        </div>
      )}
    </>
  );
}

export { App };
