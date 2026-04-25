import { getCostFilterState, getSavedModels, readWebviewData, setCostFilterState, setSavedModels } from "./bootstrap.js";
import { createChartController } from "./charting.js";
import { createCostPanelController } from "./cost-panel.js";
import { createDailyListController } from "./daily-list.js";

const data = readWebviewData();
const scroll = document.getElementById("daily-scroll");
const viewport = document.getElementById("daily-viewport");
const spacerTop = document.getElementById("daily-spacer-top");
const spacerBottom = document.getElementById("daily-spacer-bottom");
const dailyGraphView = document.getElementById("daily-view-graph");
const dailyViewButtons = document.querySelectorAll("[data-daily-view]");
const dailyViews = document.querySelectorAll(".daily-view");
const projectsTab = document.getElementById("tab-projects");

const chartController = createChartController(data);
const dailyListController = createDailyListController({
  dayData: data.dayData,
  scroll: scroll instanceof HTMLElement ? scroll : null,
  spacerBottom: spacerBottom instanceof HTMLElement ? spacerBottom : null,
  spacerTop: spacerTop instanceof HTMLElement ? spacerTop : null,
  viewport: viewport instanceof HTMLElement ? viewport : null,
});
const costPanelController = createCostPanelController({
  data,
  getCostFilterState,
  getSavedModels,
  setCostFilterState,
  setSavedModels,
});

let activeDailyView = "cards";

function setDailyView(nextView: string): void {
  activeDailyView = nextView === "graph" ? "graph" : "cards";

  dailyViewButtons.forEach((button) => {
    if (!(button instanceof HTMLElement)) {
      return;
    }
    button.classList.toggle("active", button.dataset.dailyView === activeDailyView);
  });

  dailyViews.forEach((view) => {
    if (!(view instanceof HTMLElement)) {
      return;
    }
    view.classList.toggle("active", view.id === "daily-view-" + activeDailyView);
  });

  if (activeDailyView === "cards") {
    dailyListController.scheduleRender();
  } else {
    chartController.renderDailyCharts();
  }
}

chartController.renderAllCharts();
chartController.renderPieChart();

if (scroll instanceof HTMLElement) {
  scroll.addEventListener("scroll", dailyListController.scheduleRender);
}

if (viewport instanceof HTMLElement) {
  viewport.addEventListener("click", dailyListController.handleViewportClick);
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const legendButton = target.closest('.daily-chart-legend-item[data-series-key]');
  if (legendButton instanceof HTMLButtonElement && !legendButton.disabled) {
    const chartId = legendButton.getAttribute("data-chart-id") ?? "";
    const seriesKey = legendButton.getAttribute("data-series-key") ?? "";
    chartController.toggleLegendSeries(chartId, seriesKey);
  }
});

document.addEventListener("pointerover", chartController.handlePointerEvent);
document.addEventListener("pointermove", chartController.handlePointerEvent);

if (projectsTab instanceof HTMLElement) {
  projectsTab.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const card = target.closest(".card[data-project-card]");
    if (!(card instanceof HTMLElement)) {
      return;
    }
    if (!target.closest(".card-header") && !target.closest(".card-summary") && !target.closest(".card-bar-track")) {
      return;
    }

    card.classList.toggle("expanded");
    chartController.hideAllChartTooltips();
  });
}

if (dailyGraphView instanceof HTMLElement) {
  dailyGraphView.addEventListener("pointerleave", chartController.hideAllChartTooltips);
}

dailyViewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!(button instanceof HTMLElement)) {
      return;
    }
    setDailyView(button.dataset.dailyView ?? "cards");
  });
});

window.addEventListener("resize", () => {
  if (activeDailyView === "cards") {
    dailyListController.scheduleRender();
  } else {
    chartController.hideAllChartTooltips();
  }
});

if (data.defaultTab === "daily") {
  dailyListController.scheduleRender();
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((currentTab) => currentTab.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((tabContent) => tabContent.classList.remove("active"));
    tab.classList.add("active");

    const tabTarget = document.getElementById("tab-" + (tab as HTMLElement).dataset.tab);
    if (tabTarget) {
      tabTarget.classList.add("active");
    }
    if ((tab as HTMLElement).dataset.tab === "daily" && activeDailyView === "cards") {
      dailyListController.scheduleRender();
    }
  });
});

costPanelController.initialize();
