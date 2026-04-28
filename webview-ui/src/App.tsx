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

const EMPTY_CLASS = "px-4 py-10 text-center text-xs leading-[1.6] text-(--muted)";

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
        <p class={EMPTY_CLASS}>
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
        <div class="min-h-0 flex-1 overflow-y-auto" id="tab-projects">
          {data.hasProjects ? (
            <div class="flex flex-col gap-2 px-2.5 pt-2.5 pb-5">
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
                      pricingState={data.pricingState}
                    />
                );
              })}
              {visibleProjects < data.projects.length && (
                <div ref={projectsSentinelRef} class="h-px w-full" />
              )}
            </div>
          ) : <p class={EMPTY_CLASS}>No project token usage data found.</p>}
        </div>
      )}
      {activeTab === "daily" && (
        <div class="min-h-0 flex-1 overflow-hidden" id="tab-daily">
          {data.hasDays ? (
              <TimeTab
              dayData={data.dayData}
              chartData={data.dailyChartData}
              charts={data.dailyCharts}
                modelPricing={data.modelPricing}
                pricingState={data.pricingState}
                getSavedModels={getSavedModels}
              />
          ) : <p class={EMPTY_CLASS}>No daily token usage data found.</p>}
        </div>
      )}
      {activeTab === "cost" && (
        <div class="min-h-0 flex-1 overflow-y-auto" id="tab-cost">
          <CostTab
            grandTokens={data.grandTokens}
            modelPricing={data.modelPricing}
            pricingState={data.pricingState}
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
