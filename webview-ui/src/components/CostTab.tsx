import { useState, useMemo, useCallback } from "preact/hooks";
import type { CostEntryData, CostFilterState, TokenBreakdown } from "../../../src/webview-contract.js";
import { CostFiltersPanel } from "./CostFiltersPanel.js";
import { CostTokenSummary } from "./CostTokenSummary.js";
import { ModelCostComparisonList } from "./ModelCostComparisonList.js";

type CostTabProps = {
  grandTokens: TokenBreakdown;
  costEntries: CostEntryData[];
  providers: string[];
  threeMonthsAgo: number;
  getCostFilterState: () => CostFilterState;
  setCostFilterState: (state: CostFilterState) => void;
  getSavedModels: () => string[];
  setSavedModels: (models: string[]) => void;
};

function CostTab({
  grandTokens,
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

  const saveState = useCallback((overrides: Partial<CostFilterState> = {}) => {
    setCostFilterState({
      providers: [...activeProviders],
      sort: sortOrder,
      ageFilter,
      collapsed,
      ...overrides,
    });
  }, [activeProviders, sortOrder, ageFilter, collapsed, setCostFilterState]);

  const sortedEntries = useMemo(() => [...costEntries].sort((left, right) => sortOrder === "asc" ? left.cost - right.cost : right.cost - left.cost), [costEntries, sortOrder]);
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
    setSavedModelsList((previous) => {
      const next = [...previous];
      const index = next.indexOf(modelId);
      if (index >= 0) next.splice(index, 1);
      else next.push(modelId);
      setSavedModels(next);
      return next;
    });
  }, [setSavedModels]);

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

  const handleCollapsedToggle = useCallback(() => {
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    saveState({ collapsed: nextCollapsed });
  }, [collapsed, saveState]);

  const handleSortChange = useCallback((nextSortOrder: "asc" | "desc") => {
    setSortOrder(nextSortOrder);
    saveState({ sort: nextSortOrder });
  }, [saveState]);

  const handleAgeFilterToggle = useCallback(() => {
    const nextAgeFilter = !ageFilter;
    setAgeFilter(nextAgeFilter);
    saveState({ ageFilter: nextAgeFilter });
  }, [ageFilter, saveState]);

  return (
    <div class="cost-tab-inner">
      <CostTokenSummary grandTokens={grandTokens} />
      <CostFiltersPanel
        collapsed={collapsed}
        activeProviders={activeProviders}
        providers={providers}
        sortOrder={sortOrder}
        ageFilter={ageFilter}
        onToggleCollapsed={handleCollapsedToggle}
        onProviderClick={handleProviderClick}
        onSortChange={handleSortChange}
        onAgeFilterToggle={handleAgeFilterToggle}
      />
      <ModelCostComparisonList
        title="Estimated Cost Per Model"
        entries={filteredEntries}
        tooltipText="Click a model to save it for cost comparison in the Projects tab"
        listId="cost-model-list"
        listDataAttributes={{ "data-three-months-ago": threeMonthsAgo }}
        isSaved={(modelId) => savedModelsSet.has(modelId)}
        onEntryClick={toggleSavedModel}
        getRowDataAttributes={(entry) => ({
          "data-provider": entry.provider,
          "data-cost": entry.cost,
          "data-created": entry.created,
          "data-model-id": entry.modelId,
        })}
      />
    </div>
  );
}

export { CostTab };
