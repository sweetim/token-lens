import { useState } from "preact/hooks";
import type { WebviewData, SettingsData } from "../../src/webview-contract.js";
import { getCostFilterState, getSavedModels, setCostFilterState, setSavedModels } from "./bootstrap.js";
import { CostTab } from "./components/CostTab.js";
import { HeroSection } from "./components/HeroSection.js";
import { ProjectCard } from "./components/ProjectCard.js";
import { QuotaSection } from "./components/QuotaSection.js";
import { SettingsPanel } from "./components/SettingsPanel.js";
import { TabsBar } from "./components/TabsBar.js";
import { TimeTab } from "./components/TimeTab.js";
import type { AppTab } from "./components/TabsBar.js";
import { useIntersectionLazyLoad } from "./hooks/useIntersectionLazyLoad.js";

type AppProps = {
  data: WebviewData;
  settings?: SettingsData;
  showSettings?: boolean;
  onCloseSettings?: () => void;
};

function App({ data, settings, showSettings, onCloseSettings }: AppProps) {
  const [activeTab, setActiveTab] = useState<AppTab>(data.defaultTab);
  const { visibleCount: visibleProjects, sentinelRef: projectsSentinelRef } = useIntersectionLazyLoad(data.projects.length);

  if (showSettings && settings && onCloseSettings) {
    return <SettingsPanel settings={settings} onClose={onCloseSettings} />;
  }

  if (!data.hasData) {
    const isLoading = data.quotaState.status === "loading";
    return (
      <>
        <QuotaSection quotaState={data.quotaState} />
        <HeroSection hero={data.hero} />
        <p class="empty">
          {isLoading
            ? "Loading token usage\u2026"
            : <>No token usage data found.<br />Make sure Kilo is installed and ~/.local/share/kilo/kilo.db exists.</>}
        </p>
      </>
    );
  }

  return (
    <>
      <QuotaSection quotaState={data.quotaState} />
      <HeroSection hero={data.hero} />
      <TabsBar activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "projects" && (
        <div class={`tab-content${activeTab === "projects" ? " active" : ""}`} id="tab-projects">
          {data.hasProjects ? (
            <div class="cards">
              {data.projects.slice(0, visibleProjects).map((project, index) => {
                const chartConfig = data.projectCharts[index] ?? null;
                const chartData = chartConfig ? (data.projectChartDataSets[chartConfig.id] ?? []) : [];
                const tokenBreakdown = data.projectTokenBreakdowns[project.project];
                const modelIds = data.projectModelIds[project.project] ?? [];
                return (
                  <ProjectCard
                    key={project.project}
                    project={project}
                    chartConfig={chartConfig}
                    chartData={chartData}
                    modelPricing={data.modelPricing}
                    getSavedModels={getSavedModels}
                    allProjectModelIds={modelIds}
                    projectTokenBreakdown={tokenBreakdown}
                  />
                );
              })}
              {visibleProjects < data.projects.length && (
                <div ref={projectsSentinelRef} class="vlist-sentinel" />
              )}
            </div>
          ) : <p class="empty">No project token usage data found.</p>}
        </div>
      )}
      {activeTab === "daily" && (
        <div class={`tab-content${activeTab === "daily" ? " active" : ""}`} id="tab-daily">
          {data.hasDays ? (
            <TimeTab
              dayData={data.dayData}
              chartData={data.dailyChartData}
              charts={data.dailyCharts}
              modelPricing={data.modelPricing}
              getSavedModels={getSavedModels}
            />
          ) : <p class="empty">No daily token usage data found.</p>}
        </div>
      )}
      {activeTab === "cost" && (
        <div class={`tab-content${activeTab === "cost" ? " active" : ""}`} id="tab-cost">
          <CostTab
            grandTokens={data.grandTokens}
            costEntries={data.costEntries}
            providers={data.providers}
            threeMonthsAgo={data.threeMonthsAgo}
            getCostFilterState={getCostFilterState}
            setCostFilterState={setCostFilterState}
            getSavedModels={getSavedModels}
            setSavedModels={setSavedModels}
          />
        </div>
      )}
    </>
  );
}

export { App };
