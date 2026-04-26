type AppTab = "projects" | "daily" | "cost";

type TabsBarProps = {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
};

function TabsBar({ activeTab, onTabChange }: TabsBarProps) {
  return (
    <div class="tabs">
      <button class={`tab${activeTab === "projects" ? " active" : ""}`} data-tab="projects" onClick={() => onTabChange("projects")}>Projects</button>
      <button class={`tab${activeTab === "daily" ? " active" : ""}`} data-tab="daily" onClick={() => onTabChange("daily")}>Time</button>
      <button class={`tab${activeTab === "cost" ? " active" : ""}`} data-tab="cost" onClick={() => onTabChange("cost")}>Cost</button>
    </div>
  );
}

export { TabsBar };
export type { AppTab };
