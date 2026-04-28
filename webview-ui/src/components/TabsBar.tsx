type AppTab = "projects" | "daily" | "cost";

type TabsBarProps = {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
};

const TAB_BASE_CLASS = "flex-1 cursor-pointer border-0 border-b-2 border-solid bg-transparent py-2 text-center text-[11px] font-semibold uppercase tracking-[.5px] transition-colors hover:text-(--fg)";
const TAB_ACTIVE_CLASS = "border-b-(--accent) text-(--accent)";
const TAB_INACTIVE_CLASS = "border-b-transparent text-(--muted)";

function TabsBar({ activeTab, onTabChange }: TabsBarProps) {
  return (
    <div class="flex border-b border-(--border) bg-(--card-bg)">
      <button class={`${TAB_BASE_CLASS} ${activeTab === "projects" ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS}`} data-tab="projects" onClick={() => onTabChange("projects")}>Projects</button>
      <button class={`${TAB_BASE_CLASS} ${activeTab === "daily" ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS}`} data-tab="daily" onClick={() => onTabChange("daily")}>Time</button>
      <button class={`${TAB_BASE_CLASS} ${activeTab === "cost" ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS}`} data-tab="cost" onClick={() => onTabChange("cost")}>Cost</button>
    </div>
  );
}

export { TabsBar };
export type { AppTab };
