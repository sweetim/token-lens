type CostFiltersPanelProps = {
  collapsed: boolean;
  disabled: boolean;
  disabledMessage?: string;
  activeProviders: Set<string>;
  providers: string[];
  sortOrder: "asc" | "desc";
  ageFilter: boolean;
  onToggleCollapsed: () => void;
  onProviderClick: (provider: string) => void;
  onSortChange: (sortOrder: "asc" | "desc") => void;
  onAgeFilterToggle: () => void;
};

const FILTER_BUTTON_CLASS = "cursor-pointer rounded-full border px-2 py-[3px] text-[10px] font-semibold transition-colors hover:border-(--accent) hover:text-(--fg)";
const ACTIVE_FILTER_BUTTON_CLASS = "border-(--accent) bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-(--accent)";
const INACTIVE_FILTER_BUTTON_CLASS = "border-(--border) bg-transparent text-(--muted)";

function CostFiltersPanel({
  collapsed,
  disabled,
  disabledMessage,
  activeProviders,
  providers,
  sortOrder,
  ageFilter,
  onToggleCollapsed,
  onProviderClick,
  onSortChange,
  onAgeFilterToggle,
}: CostFiltersPanelProps) {
  const buttonDisabledClass = disabled ? " cursor-not-allowed opacity-50 hover:border-(--border) hover:text-(--muted)" : "";

  return (
    <>
      <button
        class="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[10px] font-bold uppercase tracking-[.5px] text-(--muted) transition-colors hover:text-(--fg)"
        type="button"
        aria-expanded={!collapsed}
        onClick={onToggleCollapsed}
      >
        <svg class={`h-3 w-3 transition-transform${collapsed ? " -rotate-90" : ""}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        Filters
      </button>
      <div class={`flex flex-col gap-2 overflow-hidden transition-[max-height,opacity] duration-200 ease-out${collapsed ? " -mt-3 max-h-0 opacity-0 pointer-events-none" : " max-h-[500px] opacity-100"}`}>
        <div class="flex flex-wrap gap-1">
          <button
            class={`${FILTER_BUTTON_CLASS} ${activeProviders.size === 0 ? ACTIVE_FILTER_BUTTON_CLASS : INACTIVE_FILTER_BUTTON_CLASS}${buttonDisabledClass}`}
            disabled={disabled}
            type="button"
            onClick={() => onProviderClick("all")}
          >All</button>
          {providers.map((provider) => (
            <button
              key={provider}
                class={`${FILTER_BUTTON_CLASS} ${activeProviders.has(provider) ? ACTIVE_FILTER_BUTTON_CLASS : INACTIVE_FILTER_BUTTON_CLASS}${buttonDisabledClass}`}
                disabled={disabled}
                type="button"
              onClick={() => onProviderClick(provider)}
            >{provider}</button>
          ))}
        </div>
        <div class="flex items-center gap-2">
          <div class="flex gap-1">
            <button
              class={`${FILTER_BUTTON_CLASS} ${sortOrder === "asc" ? ACTIVE_FILTER_BUTTON_CLASS : INACTIVE_FILTER_BUTTON_CLASS}${buttonDisabledClass}`}
              disabled={disabled}
              type="button"
              onClick={() => onSortChange("asc")}
            >Low → High</button>
            <button
              class={`${FILTER_BUTTON_CLASS} ${sortOrder === "desc" ? ACTIVE_FILTER_BUTTON_CLASS : INACTIVE_FILTER_BUTTON_CLASS}${buttonDisabledClass}`}
              disabled={disabled}
              type="button"
              onClick={() => onSortChange("desc")}
            >High → Low</button>
          </div>
          <button
            class={`${FILTER_BUTTON_CLASS} ml-auto ${ageFilter ? ACTIVE_FILTER_BUTTON_CLASS : INACTIVE_FILTER_BUTTON_CLASS}${buttonDisabledClass}`}
            disabled={disabled}
            type="button"
            onClick={onAgeFilterToggle}
          >≤ 3 months</button>
        </div>
        {disabledMessage ? <div class="text-[10px] text-(--muted)">{disabledMessage}</div> : null}
      </div>
    </>
  );
}

export { CostFiltersPanel };
