type Period = "daily" | "weekly" | "monthly";
type DailyViewMode = "cards" | "graph";

type DailyToolbarProps = {
  period: Period;
  activeView: DailyViewMode;
  onPeriodChange: (period: Period) => void;
  onViewChange: (view: DailyViewMode) => void;
};

const PERIODS = ["daily", "weekly", "monthly"] as const;

function DailyToolbar({ period, activeView, onPeriodChange, onViewChange }: DailyToolbarProps) {
  return (
    <div class="daily-toolbar">
      <div class="period-toggle" role="tablist" aria-label="Time period">
        {PERIODS.map((periodValue) => (
          <button
            key={periodValue}
            class={`period-toggle-button${period === periodValue ? " active" : ""}`}
            type="button"
            onClick={() => onPeriodChange(periodValue)}
          >{periodValue.charAt(0).toUpperCase() + periodValue.slice(1)}</button>
        ))}
      </div>
      <div class="view-toggle" role="tablist" aria-label="Daily view mode">
        <button
          class={`view-toggle-button${activeView === "cards" ? " active" : ""}`}
          type="button"
          aria-label="Cards"
          onClick={() => onViewChange("cards")}
        >
          <svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" /><rect x="9.5" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" /><rect x="1" y="9.5" width="5.5" height="5.5" rx="1" fill="currentColor" /><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" fill="currentColor" /></svg>
        </button>
        <button
          class={`view-toggle-button${activeView === "graph" ? " active" : ""}`}
          type="button"
          aria-label="Graph"
          onClick={() => onViewChange("graph")}
        >
          <svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 14L5.5 8L8.5 10.5L14 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </div>
    </div>
  );
}

export { DailyToolbar };
