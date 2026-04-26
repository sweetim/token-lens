import { useState, useMemo, useCallback, useEffect, useRef } from "preact/hooks";
import { computeModelCostEstimates } from "../../../src/webview-model-cost.js";
import type { CostEntryData, CostFilterState, ModelPricing, TokenBreakdown } from "../../../src/webview-contract.js";
import { formatTokensCompact } from "../view-helpers.js";

type CostTabProps = {
  grandTokens: TokenBreakdown;
  modelPricing: ModelPricing;
  costEntries: CostEntryData[];
  providers: string[];
  threeMonthsAgo: number;
  getCostFilterState: () => CostFilterState;
  setCostFilterState: (state: CostFilterState) => void;
  getSavedModels: () => string[];
  setSavedModels: (models: string[]) => void;
  projectTokenBreakdowns: Record<string, TokenBreakdown>;
  projectModelIds: Record<string, string[]>;
  projects: Array<{ project: string }>;
};

function CostTab({
  grandTokens,
  modelPricing,
  costEntries,
  providers,
  threeMonthsAgo,
  getCostFilterState,
  setCostFilterState,
  getSavedModels,
  setSavedModels,
}: CostTabProps) {
  const initial = getCostFilterState();
  const [activeProviders, setActiveProviders] = useState<Set<string>>(new Set(initial.providers));
  const [ageFilter, setAgeFilter] = useState(initial.ageFilter);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initial.sort);
  const [collapsed, setCollapsed] = useState(initial.collapsed);
  const [savedModelsList, setSavedModelsList] = useState<string[]>(getSavedModels());
  const [infoTooltip, setInfoTooltip] = useState<{ text: string; left: number; top: number } | null>(null);

  const saveState = useCallback((overrides: Partial<CostFilterState> = {}) => {
    setCostFilterState({
      providers: [...activeProviders],
      sort: sortOrder,
      ageFilter,
      collapsed,
      ...overrides,
    });
  }, [activeProviders, sortOrder, ageFilter, collapsed, setCostFilterState]);

  const toggleProvider = useCallback((provider: string) => {
    setActiveProviders((prev) => {
      const next = new Set(prev);
      if (provider === "all") {
        next.clear();
      } else if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  }, []);

  const sortedEntries = useMemo(() => {
    return [...costEntries].sort((a, b) => sortOrder === "asc" ? a.cost - b.cost : b.cost - a.cost);
  }, [costEntries, sortOrder]);

  const filteredEntries = useMemo(() => {
    const showAll = activeProviders.size === 0;
    return sortedEntries.filter((entry) => {
      if (!showAll && !activeProviders.has(entry.provider)) return false;
      if (ageFilter && entry.created < threeMonthsAgo) return false;
      return true;
    });
  }, [sortedEntries, activeProviders, ageFilter, threeMonthsAgo]);

  const savedModelsSet = useMemo(() => new Set(savedModelsList), [savedModelsList]);

  const toggleSavedModel = useCallback((modelId: string) => {
    setSavedModelsList((prev) => {
      const next = [...prev];
      const idx = next.indexOf(modelId);
      if (idx >= 0) next.splice(idx, 1);
      else next.push(modelId);
      setSavedModels(next);
      return next;
    });
  }, [setSavedModels]);

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
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);

  const totalTokens = grandTokens.inputTokens + grandTokens.outputTokens + grandTokens.reasoningTokens + grandTokens.cacheRead;

  const handleProviderClick = useCallback((provider: string) => {
    const next = new Set(activeProviders);
    if (provider === "all") {
      next.clear();
    } else if (next.has(provider)) {
      next.delete(provider);
    } else {
      next.add(provider);
    }
    setActiveProviders(next);
    saveState({ providers: [...next] });
  }, [activeProviders, saveState]);

  return (
    <div class="cost-tab-inner">
      <div class="cost-token-summary">
        <div class="cost-token-stat"><span class="cost-token-value">{formatTokensCompact(totalTokens)}</span><span class="cost-token-label">Total Tokens</span></div>
        <div class="cost-token-stat"><span class="cost-token-value">{formatTokensCompact(grandTokens.inputTokens)}</span><span class="cost-token-label">Input</span></div>
        <div class="cost-token-stat"><span class="cost-token-value">{formatTokensCompact(grandTokens.outputTokens)}</span><span class="cost-token-label">Output</span></div>
        <div class="cost-token-stat"><span class="cost-token-value">{formatTokensCompact(grandTokens.reasoningTokens)}</span><span class="cost-token-label">Reasoning</span></div>
        <div class="cost-token-stat"><span class="cost-token-value">{formatTokensCompact(grandTokens.cacheRead)}</span><span class="cost-token-label">Cache Read</span></div>
      </div>
      <button
        class={`cost-filter-toggle${collapsed ? " collapsed" : ""}`}
        type="button"
        aria-expanded={!collapsed}
        onClick={() => { setCollapsed(!collapsed); saveState({ collapsed: !collapsed }); }}
      >
        <svg class="cost-filter-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        Filters
      </button>
      <div class={`cost-toolbar${collapsed ? " hidden" : ""}`}>
        <div class="cost-provider-filters">
          <button
            class={`cost-provider-filter${activeProviders.size === 0 ? " active" : ""}`}
            type="button"
            onClick={() => handleProviderClick("all")}
          >All</button>
          {providers.map((p) => (
            <button
              key={p}
              class={`cost-provider-filter${activeProviders.has(p) ? " active" : ""}`}
              type="button"
              onClick={() => handleProviderClick(p)}
            >{p}</button>
          ))}
        </div>
        <div class="cost-toolbar-row">
          <div class="cost-sort">
            <button
              class={`cost-sort-button${sortOrder === "asc" ? " active" : ""}`}
              type="button"
              onClick={() => { setSortOrder("asc"); saveState({ sort: "asc" }); }}
            >Low → High</button>
            <button
              class={`cost-sort-button${sortOrder === "desc" ? " active" : ""}`}
              type="button"
              onClick={() => { setSortOrder("desc"); saveState({ sort: "desc" }); }}
            >High → Low</button>
          </div>
          <button
            class={`cost-age-filter${ageFilter ? " active" : ""}`}
            type="button"
            onClick={() => { setAgeFilter(!ageFilter); saveState({ ageFilter: !ageFilter }); }}
          >≤ 3 months</button>
        </div>
      </div>
      <div class="model-cost-list" id="cost-model-list" data-three-months-ago={threeMonthsAgo}>
        <div class="model-cost-header">
          <span>Estimated Cost Per Model</span>
          <span class="model-cost-info">
            <button
              class="model-cost-info-button"
              type="button"
              aria-label="Click a model to save it for cost comparison in the Projects tab"
              onMouseEnter={(e) => showInfoTooltip(e.currentTarget, "Click a model to save it for cost comparison in the Projects tab")}
              onFocus={(e) => showInfoTooltip(e.currentTarget, "Click a model to save it for cost comparison in the Projects tab")}
              onMouseLeave={() => setInfoTooltip(null)}
              onBlur={() => setInfoTooltip(null)}
            >
              <svg class="model-cost-info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5" /><path d="M8 7.1V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /><circle cx="8" cy="4.75" r="1" fill="currentColor" /></svg>
            </button>
          </span>
        </div>
        {filteredEntries.map((entry) => (
          <div
            key={entry.modelId}
            class={`model-cost-row${savedModelsSet.has(entry.modelId) ? " saved" : ""}`}
            data-provider={entry.provider}
            data-cost={entry.cost}
            data-created={entry.created}
            data-model-id={entry.modelId}
            onClick={() => toggleSavedModel(entry.modelId)}
          >
            <span class="model-cost-id">{entry.modelId}</span>
            <span class="model-cost-value">${entry.cost.toFixed(2)}</span>
          </div>
        ))}
      </div>
      {infoTooltip ? (
        <div class="model-cost-info-tooltip-overlay visible" style={{ left: infoTooltip.left + "px", top: infoTooltip.top + "px" }}>
          {infoTooltip.text}
        </div>
      ) : null}
    </div>
  );
}

export { CostTab };
