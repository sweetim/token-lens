import { useState } from "preact/hooks";
import type { WebviewData } from "../../src/webview-contract.js";
import { getCostFilterState, getSavedModels, setCostFilterState, setSavedModels } from "./bootstrap.js";
import { CostTab } from "./components/CostTab.js";
import { HeroSection } from "./components/HeroSection.js";
import { ProjectCard } from "./components/ProjectCard.js";
import { QuotaSection } from "./components/QuotaSection.js";
import { TabsBar } from "./components/TabsBar.js";
import { TimeTab } from "./components/TimeTab.js";
import type { AppTab } from "./components/TabsBar.js";

function App({ data }: { data: WebviewData }) {
  const [activeTab, setActiveTab] = useState<AppTab>(data.defaultTab);

  if (!data.hasData) {
    return (
      <>
        <QuotaSection quotaState={data.quotaState} />
        <HeroSection hero={data.hero} />
        <p class="empty">No token usage data found.<br />Make sure Kilo is installed and ~/.local/share/kilo/kilo.db exists.</p>
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
              {data.projects.map((project, index) => {
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
