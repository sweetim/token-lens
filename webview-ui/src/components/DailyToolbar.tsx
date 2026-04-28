type Period = "daily" | "weekly" | "monthly";
type DailyViewMode = "cards" | "graph";

type DailyToolbarProps = {
  period: Period;
  activeView: DailyViewMode;
  onPeriodChange: (period: Period) => void;
  onViewChange: (view: DailyViewMode) => void;
};

const PERIODS = ["daily", "weekly", "monthly"] as const;
const PERIOD_BUTTON_CLASS = "cursor-pointer rounded-full border-0 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.3px]";
const TOGGLE_BUTTON_CLASS = "flex cursor-pointer items-center justify-center rounded-full border-0 px-[7px] py-[5px]";
const ACTIVE_TOGGLE_CLASS = "bg-(--border) text-(--accent)";
const INACTIVE_TOGGLE_CLASS = "bg-transparent text-(--muted)";

function DailyToolbar({ period, activeView, onPeriodChange, onViewChange }: DailyToolbarProps) {
  return (
    <div class="flex items-center justify-between px-2.5 pt-2.5">
      <div class="inline-flex gap-0.5 rounded-full border border-(--border) bg-(--card-bg) p-[3px]" role="tablist" aria-label="Time period">
        {PERIODS.map((periodValue) => (
          <button
            key={periodValue}
            class={`${PERIOD_BUTTON_CLASS} ${period === periodValue ? ACTIVE_TOGGLE_CLASS : INACTIVE_TOGGLE_CLASS}`}
            type="button"
            onClick={() => onPeriodChange(periodValue)}
          >{periodValue.charAt(0).toUpperCase() + periodValue.slice(1)}</button>
        ))}
      </div>
      <div class="inline-flex gap-1 rounded-full border border-(--border) bg-(--card-bg) p-[3px]" role="tablist" aria-label="Daily view mode">
        <button
          class={`${TOGGLE_BUTTON_CLASS} ${activeView === "cards" ? ACTIVE_TOGGLE_CLASS : INACTIVE_TOGGLE_CLASS}`}
          type="button"
          aria-label="Cards"
          onClick={() => onViewChange("cards")}
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" /><rect x="9.5" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" /><rect x="1" y="9.5" width="5.5" height="5.5" rx="1" fill="currentColor" /><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" fill="currentColor" /></svg>
        </button>
        <button
          class={`${TOGGLE_BUTTON_CLASS} ${activeView === "graph" ? ACTIVE_TOGGLE_CLASS : INACTIVE_TOGGLE_CLASS}`}
          type="button"
          aria-label="Graph"
          onClick={() => onViewChange("graph")}
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 14L5.5 8L8.5 10.5L14 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </div>
    </div>
  );
}

export { DailyToolbar };
