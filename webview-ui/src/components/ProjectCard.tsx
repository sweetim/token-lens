import { useState, useCallback, useMemo } from "preact/hooks";
import { computeModelCostEstimates } from "@shared/webview-model-cost";
import type {
  ChartConfig,
  ChartDayItem,
  ModelPricing,
  PricingStateData,
  ProjectCardData,
  TokenBreakdown,
} from "@shared/webview-contract";
import { formatTokensCompact, formatDurationMs, normalizeModelNameForMatch } from "@/view-helpers";
import { LineChart } from "@/components/Chart";
import { ModelCostComparisonList } from "@/components/ModelCostComparisonList";

const SEGMENT_COLORS = {
  input: "#3794ff",
  output: "#89d185",
  reasoning: "#b180d7",
  cacheRead: "#d18616",
  cacheWrite: "#4ec9b0",
};

const CARD_CLASS = "relative rounded-md border border-(--border) bg-(--card-bg) px-3 py-2.5 transition-colors hover:border-(--accent)";
const CARD_STATS_CLASS = "grid grid-cols-4 gap-1 text-center";
const STAT_CLASS = "flex flex-col gap-px";
const STAT_VALUE_CLASS = "text-xs font-semibold tabular-nums";
const STAT_LABEL_CLASS = "text-[9px] uppercase tracking-[.5px] text-(--muted)";
const EMPTY_CLASS = "px-4 py-10 text-center text-xs leading-[1.6] text-(--muted)";

type ProjectCardProps = {
  project: ProjectCardData;
  chartConfig: ChartConfig | null;
  chartData: ChartDayItem[];
  modelPricing: ModelPricing;
  getSavedModels: () => string[];
  allProjectModelIds: string[];
  projectTokenBreakdown: TokenBreakdown;
  pricingState: PricingStateData;
};

type ProjectStat = {
  value: string | number;
  label: string;
};

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
    <div class="mb-1.5 flex cursor-pointer items-center justify-between gap-2" onClick={onToggle}>
      <div class="flex min-w-0 flex-auto items-center gap-1.5">
        <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold">{projectName}</span>
        <span class="shrink-0 whitespace-nowrap rounded-full bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] px-[7px] py-0.5 text-[10px] font-bold tracking-[.3px] text-(--accent) tabular-nums">{formatTokensCompact(totalTokens)}</span>
      </div>
      <span class="text-[13px] font-semibold text-(--green) tabular-nums">${totalCost.toFixed(2)}</span>
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
    <div class="mb-2 flex h-1 cursor-pointer overflow-hidden rounded-sm bg-(--border)" onClick={onToggle}>
      {segments.map((segment, index) => (
        <div key={index} class="h-full min-w-px" style={{ width: ((segment.value / project.totalTokens) * 100).toFixed(1) + "%", background: segment.color }} />
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
        <div key={stat.label} class={STAT_CLASS}><span class={STAT_VALUE_CLASS}>{stat.value}</span><span class={STAT_LABEL_CLASS}>{stat.label}</span></div>
      ))}
    </div>
  );
}

function ProjectModelUsage({ models, totalTokens }: { models: ProjectCardData["models"]; totalTokens: number }) {
  if (models.length === 0 || totalTokens <= 0) {
    return null;
  }

  return (
    <div class="flex flex-col gap-1 border-t border-(--border) pt-2.5">
      <div class="mb-0.5 text-[9px] uppercase tracking-[.5px] text-(--muted)">LLM Usage</div>
      {models.map((model) => {
        const percentage = ((model.totalTokens / totalTokens) * 100).toFixed(1);
        return (
          <div key={model.model} class="flex items-center justify-between py-0.5 text-[11px]">
            <span class="mr-3 min-w-0 flex-auto overflow-hidden text-ellipsis whitespace-nowrap font-mono text-(--fg)">{model.model}</span>
            <span class="shrink-0 font-mono font-semibold text-(--accent2)">{percentage}%</span>
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
  pricingState,
}: ProjectCardProps) {
  const [expanded, setExpanded] = useState(false);
  const sortedModels = useMemo(() => [...project.models].sort((left, right) => right.totalTokens - left.totalTokens), [project.models]);
  const usedModelIds = useMemo(() => new Set(project.models.map((model) => normalizeModelNameForMatch(model.openRouterModelId))), [project.models]);
  const savedModels = getSavedModels();
  const modelCostIds = [...new Set([...allProjectModelIds, ...savedModels])];
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
    <div class={CARD_CLASS} data-project-card>
      <ProjectCardHeader projectName={project.project} totalTokens={project.totalTokens} totalCost={project.totalCost} onToggle={handleToggle} />
      <ProjectTokenBar project={project} onToggle={handleToggle} />
      {!expanded ? (
        <ProjectStatsGrid stats={summaryStats} className={`${CARD_STATS_CLASS} cursor-pointer`} onToggle={handleToggle} />
      ) : (
        <div class="flex flex-col gap-1.5">
          <ProjectStatsGrid stats={summaryStats} className={CARD_STATS_CLASS} />
          <ProjectStatsGrid stats={detailStats} className={CARD_STATS_CLASS} />
          <div class="flex flex-col gap-2 border-t border-(--border) pt-3.5">
            {chartData.length > 0 && chartConfig ? (
              <LineChart config={chartConfig} days={chartData} />
            ) : <p class={EMPTY_CLASS}>No daily token usage data found for this project.</p>}
          </div>
          <ProjectModelUsage models={sortedModels} totalTokens={project.totalTokens} />
          <ModelCostComparisonList
            title="Model Cost Comparison"
            entries={modelCosts}
            pricingState={pricingState}
            highlightModelIds={usedModelIds}
            tooltipText="Compares models used in this project. Also includes models selected in the Cost tab"
            listDataAttributes={{ "data-project": project.project }}
          />
        </div>
      )}
    </div>
  );
}

export { ProjectCard };
