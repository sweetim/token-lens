import { computeModelCostEstimates } from "../../../src/webview-model-cost.js";
import type { DayDataItem, ModelPricing, PricingStateData } from "../../../src/webview-contract.js";
import { MODEL_COLORS } from "../constants.js";
import { ModelCostComparisonList } from "./ModelCostComparisonList.js";

type DayCardProps = {
  item: DayDataItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  modelPricing: ModelPricing;
  pricingState: PricingStateData;
  getSavedModels: () => string[];
};

type TokenBarData = {
  label: string;
  color: string;
  pct: string;
  value: string;
};

const HORIZONTAL_BAR_ROW_CLASS = "grid grid-cols-[56px_1fr_60px] items-center gap-1.5";

function TokenBarRow({ bar }: { bar: TokenBarData }) {
  return (
    <div class={HORIZONTAL_BAR_ROW_CLASS}>
      <div class="text-[10px] font-semibold uppercase tracking-[.3px]" style={{ color: bar.color }}>{bar.label}</div>
      <div class="h-2.5 overflow-hidden rounded-sm bg-(--border)"><div class="h-full rounded-sm" style={{ width: bar.pct + "%", background: bar.color }} /></div>
      <div class="text-right"><span class="text-[10px] font-semibold tabular-nums">{bar.value}</span></div>
    </div>
  );
}

function DayCardHeader({ item }: { item: DayDataItem }) {
  return (
    <>
      <div class="mb-0.5 flex items-center justify-between"><span class="text-xs font-bold">{item.dayLabel}</span></div>
      <div class="flex gap-1">
        <span class="whitespace-nowrap rounded-full bg-(--border) px-1.5 py-px text-[10px] font-semibold text-(--muted)">{item.totalTokensLabel} tokens</span>
        <span class="whitespace-nowrap rounded-full bg-(--border) px-1.5 py-px text-[10px] font-semibold text-(--muted)">{item.models.length} model{item.models.length !== 1 ? "s" : ""}</span>
        <span class="whitespace-nowrap rounded-full bg-(--border) px-1.5 py-px text-[10px] font-semibold text-(--muted)">{item.duration}</span>
      </div>
    </>
  );
}

function DayModelUsage({ models }: { models: DayDataItem["models"] }) {
  if (models.length === 0) {
    return null;
  }

  const totalTokens = models.reduce((sum, model) => sum + model.totalTokens, 0);
  if (totalTokens <= 0) {
    return null;
  }

  const sortedModels = models.slice().sort((left, right) => right.totalTokens - left.totalTokens);

  return (
    <>
      <div class={HORIZONTAL_BAR_ROW_CLASS}>
        <div class="text-[10px] font-semibold uppercase tracking-[.3px]" style={{ color: "var(--accent2)" }}>models</div>
        <div class="flex h-2.5 overflow-hidden rounded-sm bg-(--border)">
          {sortedModels.map((model, colorIndex) => {
            const percentage = ((model.totalTokens / totalTokens) * 100).toFixed(1);
            return <div key={model.model} class="h-full min-w-px" style={{ width: percentage + "%", background: MODEL_COLORS[colorIndex % MODEL_COLORS.length] }} title={`${model.model}: ${percentage}%`} />;
          })}
        </div>
        <div class="text-right"><span class="text-[10px] font-semibold tabular-nums">{sortedModels.length}</span></div>
      </div>
    </>
  );
}

function DayCard({ item, index, expanded, onToggle, modelPricing, pricingState, getSavedModels }: DayCardProps) {
  const savedModels = getSavedModels();
  const usedModelIdsWithPricing = (() => {
    const ids = new Set<string>();
    for (const model of item.models) {
      if (modelPricing[model.openRouterModelId]) {
        ids.add(model.openRouterModelId);
      }
    }
    return [...ids];
  })();
  const modelCostIds = [...new Set([...usedModelIdsWithPricing, ...savedModels])];

  const usedModelIds = new Set(item.models.map((model) => model.openRouterModelId.replace(/^[^/]+\//, "")));
  const modelCosts = computeModelCostEstimates(modelCostIds, modelPricing, {
    inputTokens: item.inputTokens,
    outputTokens: item.outputTokens,
    reasoningTokens: item.reasoningTokens,
    cacheRead: item.cacheRead,
  });

  return (
    <div class="relative mb-2 flex cursor-pointer flex-col gap-1 rounded-md border border-(--border) bg-(--card-bg) px-2.5 py-2 transition-colors hover:border-(--accent)" data-index={index} onClick={onToggle}>
      <DayCardHeader item={item} />
      {item.summaryBars.map((bar) => (
        <TokenBarRow key={bar.label} bar={bar} />
      ))}
      {expanded ? <div class="contents">
        {item.detailBars.map((bar) => (
          <TokenBarRow key={bar.label} bar={bar} />
        ))}
        <DayModelUsage models={item.models} />
        <ModelCostComparisonList title="Model Cost Comparison" entries={modelCosts} pricingState={pricingState} highlightModelIds={usedModelIds} tooltipText="Compares models used in this period. Also includes models selected in the Cost tab" />
      </div> : null}
    </div>
  );
}

export { DayCard };
