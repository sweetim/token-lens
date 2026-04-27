import { useState, useCallback, useMemo } from "preact/hooks";
import { computeModelCostEstimates } from "../../../src/webview-model-cost.js";
import type {
  ChartConfig,
  ChartDayItem,
  ModelPricing,
  ProjectCardData,
  TokenBreakdown,
} from "../../../src/webview-contract.js";
import { formatTokensCompact } from "../view-helpers.js";
import { LineChart } from "./Chart.js";
import { ModelCostComparisonList } from "./ModelCostComparisonList.js";

const SEGMENT_COLORS = {
  input: "#3794ff",
  output: "#89d185",
  reasoning: "#b180d7",
  cacheRead: "#d18616",
  cacheWrite: "#4ec9b0",
};

type ProjectCardProps = {
  project: ProjectCardData;
  chartConfig: ChartConfig | null;
  chartData: ChartDayItem[];
  modelPricing: ModelPricing;
  getSavedModels: () => string[];
  allProjectModelIds: string[];
  projectTokenBreakdown: TokenBreakdown;
};

type ProjectStat = {
  value: string | number;
  label: string;
};

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

function ProjectCardHeader({
  projectName,
  totalTokens,
  totalCost,
  onToggle,
}: {
  projectName: string;
  totalTokens: number;
  totalCost: number;
  onToggle: () => void;
}) {
  return (
    <div class="card-header" onClick={onToggle}>
      <div class="card-title-group">
        <span class="card-name">{projectName}</span>
        <span class="card-total-badge">{formatTokensCompact(totalTokens)}</span>
      </div>
      <span class="card-cost">${totalCost.toFixed(2)}</span>
    </div>
  );
}

function ProjectTokenBar({ project, onToggle }: { project: ProjectCardData; onToggle: () => void }) {
  const segments = [
    { value: project.inputTokens, color: SEGMENT_COLORS.input },
    { value: project.outputTokens, color: SEGMENT_COLORS.output },
    { value: project.reasoningTokens, color: SEGMENT_COLORS.reasoning },
    { value: project.cacheRead, color: SEGMENT_COLORS.cacheRead },
    { value: project.cacheWrite, color: SEGMENT_COLORS.cacheWrite },
  ].filter((segment) => segment.value > 0);

  return (
    <div class="card-bar-track" onClick={onToggle}>
      {segments.map((segment, index) => (
        <div key={index} class="card-bar-seg" style={{ width: ((segment.value / project.totalTokens) * 100).toFixed(1) + "%", background: segment.color }} />
      ))}
    </div>
  );
}

function ProjectStatsGrid({
  stats,
  className,
  onToggle,
}: {
  stats: ProjectStat[];
  className: string;
  onToggle?: () => void;
}) {
  return (
    <div class={className} onClick={onToggle}>
      {stats.map((stat) => (
        <div key={stat.label} class="stat"><span class="stat-value">{stat.value}</span><span class="stat-label">{stat.label}</span></div>
      ))}
    </div>
  );
}

function ProjectModelUsage({ models, totalTokens }: { models: ProjectCardData["models"]; totalTokens: number }) {
  if (models.length === 0 || totalTokens <= 0) {
    return null;
  }

  return (
    <div class="llm-usage-list">
      <div class="llm-usage-header">LLM Usage</div>
      {models.map((model) => {
        const percentage = ((model.totalTokens / totalTokens) * 100).toFixed(1);
        return (
          <div key={model.model} class="llm-usage-row">
            <span class="llm-usage-id">{model.model}</span>
            <span class="llm-usage-value">{percentage}%</span>
          </div>
        );
      })}
    </div>
  );
}

function ProjectCard({
  project,
  chartConfig,
  chartData,
  modelPricing,
  getSavedModels,
  allProjectModelIds,
  projectTokenBreakdown,
}: ProjectCardProps) {
  const [expanded, setExpanded] = useState(false);
  const sortedModels = useMemo(() => [...project.models].sort((left, right) => right.totalTokens - left.totalTokens), [project.models]);
  const usedModelIds = useMemo(() => new Set(project.models.map((model) => model.openRouterModelId.replace(/^[^/]+\//, ""))), [project.models]);
  const savedModels = getSavedModels();
  const modelCostIds = savedModels.length > 0 ? savedModels : allProjectModelIds;
  const modelCosts = computeModelCostEstimates(modelCostIds, modelPricing, projectTokenBreakdown);
  const handleToggle = useCallback(() => setExpanded((previous) => !previous), []);

  const summaryStats: ProjectStat[] = [
    { value: formatTokensCompact(project.inputTokens), label: "input" },
    { value: formatTokensCompact(project.outputTokens), label: "output" },
    { value: project.sessions, label: "sessions" },
    { value: formatTokensCompact(project.steps), label: "steps" },
  ];

  const detailStats: ProjectStat[] = [
    { value: formatTokensCompact(project.reasoningTokens), label: "reason" },
    { value: formatTokensCompact(project.cacheRead), label: "cache r" },
    { value: formatTokensCompact(project.cacheWrite), label: "cache w" },
    { value: formatDurationMs(project.duration), label: "duration" },
  ];

  return (
    <div class={`card${expanded ? " expanded" : ""}`} data-project-card>
      <ProjectCardHeader projectName={project.project} totalTokens={project.totalTokens} totalCost={project.totalCost} onToggle={handleToggle} />
      <ProjectTokenBar project={project} onToggle={handleToggle} />
      {!expanded ? (
        <ProjectStatsGrid stats={summaryStats} className="card-summary" onToggle={handleToggle} />
      ) : (
        <div class="card-details">
          <ProjectStatsGrid stats={summaryStats} className="card-stats card-stats-four" />
          <ProjectStatsGrid stats={detailStats} className="card-stats card-stats-four" />
          <div class="project-card-section">
            {chartData.length > 0 && chartConfig ? (
              <LineChart config={chartConfig} days={chartData} />
            ) : <p class="empty">No daily token usage data found for this project.</p>}
          </div>
          <ProjectModelUsage models={sortedModels} totalTokens={project.totalTokens} />
          <ModelCostComparisonList
            title="Model Cost Comparison"
            entries={modelCosts}
            highlightModelIds={usedModelIds}
            tooltipText="This comparison uses models selected in the Cost tab. If none are selected, it compares only models used in this project"
            listDataAttributes={{ "data-project": project.project }}
          />
        </div>
      )}
    </div>
  );
}

export { ProjectCard };
