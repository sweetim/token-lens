import { computeModelCostEstimates } from "../../../src/webview-model-cost.js";
import type { DayDataItem, ModelPricing } from "../../../src/webview-contract.js";
import { MODEL_COLORS } from "../constants.js";
import { ModelCostComparisonList } from "./ModelCostComparisonList.js";

type DayCardProps = {
  item: DayDataItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  modelPricing: ModelPricing;
  getSavedModels: () => string[];
};

type TokenBarData = {
  label: string;
  color: string;
  pct: string;
  value: string;
};

function TokenBarRow({ bar }: { bar: TokenBarData }) {
  return (
    <div class="hbar-row">
      <div class="hbar-type-label" style={{ color: bar.color }}>{bar.label}</div>
      <div class="hbar-track-wrap"><div class="hbar-fill" style={{ width: bar.pct + "%", background: bar.color }} /></div>
      <div class="hbar-value"><span class="hbar-tokens">{bar.value}</span></div>
    </div>
  );
}

function DayCardHeader({ item }: { item: DayDataItem }) {
  return (
    <>
      <div class="day-header"><span class="day-label">{item.dayLabel}</span></div>
      <div class="day-meta">
        <span class="day-badge">{item.totalTokensLabel} tokens</span>
        <span class="day-badge">{item.models.length} model{item.models.length !== 1 ? "s" : ""}</span>
        <span class="day-badge">{item.duration}</span>
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
      <div class="hbar-row">
        <div class="hbar-type-label" style={{ color: "var(--accent2)" }}>models</div>
        <div class="model-bar-track">
          {sortedModels.map((model, colorIndex) => {
            const percentage = ((model.totalTokens / totalTokens) * 100).toFixed(1);
            return <div key={model.model} class="model-bar-seg" style={{ width: percentage + "%", background: MODEL_COLORS[colorIndex % MODEL_COLORS.length] }} title={`${model.model}: ${percentage}%`} />;
          })}
        </div>
        <div class="hbar-value"><span class="hbar-tokens">{sortedModels.length}</span></div>
      </div>
    </>
  );
}

function DayCard({ item, index, expanded, onToggle, modelPricing, getSavedModels }: DayCardProps) {
  const savedModels = getSavedModels();
  const modelCostIds = savedModels.length > 0
    ? savedModels
    : (() => {
        const ids = new Set<string>();
        for (const model of item.models) {
          if (modelPricing[model.openRouterModelId]) {
            ids.add(model.openRouterModelId);
          }
        }
        return [...ids];
      })();

  const usedModelIds = new Set(item.models.map((model) => model.model.replace(/:.*$/, "").replace(/^[^/]+\//, "")));
  const modelCosts = computeModelCostEstimates(modelCostIds, modelPricing, {
    inputTokens: item.inputTokens,
    outputTokens: item.outputTokens,
    reasoningTokens: item.reasoningTokens,
    cacheRead: item.cacheRead,
  });

  return (
    <div class={`day-group${expanded ? " expanded" : ""}`} data-index={index} onClick={onToggle}>
      <DayCardHeader item={item} />
      {item.summaryBars.map((bar) => (
        <TokenBarRow key={bar.label} bar={bar} />
      ))}
      <div class="day-details">
        {item.detailBars.map((bar) => (
          <TokenBarRow key={bar.label} bar={bar} />
        ))}
        <DayModelUsage models={item.models} />
        <ModelCostComparisonList title="Model Cost Comparison" entries={modelCosts} highlightModelIds={usedModelIds} tooltipText="This comparison uses models selected in the Cost tab. If none are selected, it compares only models used in this period" />
      </div>
    </div>
  );
}

export { DayCard };
