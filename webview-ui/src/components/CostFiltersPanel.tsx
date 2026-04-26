type CostFiltersPanelProps = {
  collapsed: boolean;
  activeProviders: Set<string>;
  providers: string[];
  sortOrder: "asc" | "desc";
  ageFilter: boolean;
  onToggleCollapsed: () => void;
  onProviderClick: (provider: string) => void;
  onSortChange: (sortOrder: "asc" | "desc") => void;
  onAgeFilterToggle: () => void;
};

function CostFiltersPanel({
  collapsed,
  activeProviders,
  providers,
  sortOrder,
  ageFilter,
  onToggleCollapsed,
  onProviderClick,
  onSortChange,
  onAgeFilterToggle,
}: CostFiltersPanelProps) {
  return (
    <>
      <button
        class={`cost-filter-toggle${collapsed ? " collapsed" : ""}`}
        type="button"
        aria-expanded={!collapsed}
        onClick={onToggleCollapsed}
      >
        <svg class="cost-filter-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        Filters
      </button>
      <div class={`cost-toolbar${collapsed ? " hidden" : ""}`}>
        <div class="cost-provider-filters">
          <button
            class={`cost-provider-filter${activeProviders.size === 0 ? " active" : ""}`}
            type="button"
            onClick={() => onProviderClick("all")}
          >All</button>
          {providers.map((provider) => (
            <button
              key={provider}
              class={`cost-provider-filter${activeProviders.has(provider) ? " active" : ""}`}
              type="button"
              onClick={() => onProviderClick(provider)}
            >{provider}</button>
          ))}
        </div>
        <div class="cost-toolbar-row">
          <div class="cost-sort">
            <button
              class={`cost-sort-button${sortOrder === "asc" ? " active" : ""}`}
              type="button"
              onClick={() => onSortChange("asc")}
            >Low → High</button>
            <button
              class={`cost-sort-button${sortOrder === "desc" ? " active" : ""}`}
              type="button"
              onClick={() => onSortChange("desc")}
            >High → Low</button>
          </div>
          <button
            class={`cost-age-filter${ageFilter ? " active" : ""}`}
            type="button"
            onClick={onAgeFilterToggle}
          >≤ 3 months</button>
        </div>
      </div>
    </>
  );
}

export { CostFiltersPanel };
