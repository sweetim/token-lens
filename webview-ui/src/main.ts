import { getCostFilterState, getSavedModels, readWebviewData, setCostFilterState, setSavedModels } from "./bootstrap.js";
import { createChartController } from "./charting.js";
import { createCostPanelController } from "./cost-panel.js";
import { createDailyListController } from "./daily-list.js";
import { formatTokensCompact } from "./view-helpers.js";
import type { ChartDayItem, DayDataItem, DayModelUsage } from "../../src/webview-contract.js";

type Period = "daily" | "weekly" | "monthly";

const TOKEN_TYPES = [
  { key: "inputTokens" as const, color: "#3794ff", label: "input" },
  { key: "outputTokens" as const, color: "#89d185", label: "output" },
  { key: "reasoningTokens" as const, color: "#b180d7", label: "reason" },
  { key: "cacheRead" as const, color: "#d18616", label: "cache r" },
  { key: "cacheWrite" as const, color: "#4ec9b0", label: "cache w" },
];

const SUMMARY_KEYS = new Set(["inputTokens", "outputTokens"]);

function formatDurationFromMs(ms: number): string {
  if (ms <= 0) {
    return "0m";
  }
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? days + "d " + remainingHours + "h" : days + "d";
  }
  return hours > 0 ? hours + "h " + minutes + "m" : minutes + "m";
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getPeriodKey(day: string, period: Period): string {
  if (period === "daily") {
    return day;
  }
  if (period === "monthly") {
    return day.slice(0, 7);
  }
  const d = new Date(day + "T00:00:00");
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function formatPeriodLabel(key: string, period: Period): string {
  if (period === "monthly") {
    const parts = key.split("-");
    return MONTH_NAMES[parseInt(parts[1], 10) - 1] + " " + parts[0];
  }
  const d = new Date(key + "T00:00:00");
  return MONTH_NAMES[d.getMonth()] + " " + d.getDate();
}

type NumericFields = {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheRead: number;
  cacheWrite: number;
  totalCost: number;
  sessions: number;
  steps: number;
  durationMs: number;
};

function sumNumericFields(items: NumericFields[]): NumericFields {
  return {
    totalTokens: items.reduce((s, i) => s + i.totalTokens, 0),
    inputTokens: items.reduce((s, i) => s + i.inputTokens, 0),
    outputTokens: items.reduce((s, i) => s + i.outputTokens, 0),
    reasoningTokens: items.reduce((s, i) => s + i.reasoningTokens, 0),
    cacheRead: items.reduce((s, i) => s + i.cacheRead, 0),
    cacheWrite: items.reduce((s, i) => s + i.cacheWrite, 0),
    totalCost: items.reduce((s, i) => s + i.totalCost, 0),
    sessions: items.reduce((s, i) => s + i.sessions, 0),
    steps: items.reduce((s, i) => s + i.steps, 0),
    durationMs: items.reduce((s, i) => s + i.durationMs, 0),
  };
}

function mergeModels(items: { models: DayModelUsage[] }[]): DayModelUsage[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    for (const model of item.models) {
      totals.set(model.model, (totals.get(model.model) ?? 0) + model.totalTokens);
    }
  }
  return [...totals.entries()]
    .map(([model, totalTokens]) => ({ model, totalTokens }))
    .sort((a, b) => b.totalTokens - a.totalTokens);
}

function computeBars(items: DayDataItem[]): void {
  const maxPerType: Record<string, number> = {};
  for (const tt of TOKEN_TYPES) {
    maxPerType[tt.key] = items.reduce((max, item) => Math.max(max, item[tt.key]), 0) || 1;
  }
  for (const item of items) {
    item.summaryBars = TOKEN_TYPES.filter((tt) => SUMMARY_KEYS.has(tt.key)).map((tt) => ({
      label: tt.label,
      color: tt.color,
      pct: ((item[tt.key] / maxPerType[tt.key]) * 100).toFixed(1),
      value: formatTokensCompact(item[tt.key]),
    }));
    item.detailBars = TOKEN_TYPES.filter((tt) => !SUMMARY_KEYS.has(tt.key)).map((tt) => ({
      label: tt.label,
      color: tt.color,
      pct: ((item[tt.key] / maxPerType[tt.key]) * 100).toFixed(1),
      value: formatTokensCompact(item[tt.key]),
    }));
  }
}

function aggregateDayData(items: DayDataItem[], period: Period): DayDataItem[] {
  if (period === "daily") {
    return items;
  }
  const groups = new Map<string, DayDataItem[]>();
  for (const item of items) {
    const key = getPeriodKey(item.day, period);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  const result: DayDataItem[] = [];
  for (const [key, group] of groups) {
    const summed = sumNumericFields(group);
    result.push({
      day: key,
      dayLabel: formatPeriodLabel(key, period),
      ...summed,
      totalTokensLabel: formatTokensCompact(summed.totalTokens),
      duration: formatDurationFromMs(summed.durationMs),
      models: mergeModels(group),
      summaryBars: [],
      detailBars: [],
    });
  }
  result.sort((a, b) => b.day.localeCompare(a.day));
  computeBars(result);
  return result;
}

function aggregateChartData(items: ChartDayItem[], period: Period): ChartDayItem[] {
  if (period === "daily") {
    return items;
  }
  const groups = new Map<string, ChartDayItem[]>();
  for (const item of items) {
    const key = getPeriodKey(item.day, period);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  const result: ChartDayItem[] = [];
  for (const [key, group] of groups) {
    const summed = sumNumericFields(group);
    result.push({
      day: key,
      dayLabel: formatPeriodLabel(key, period),
      ...summed,
      totalTokensLabel: formatTokensCompact(summed.totalTokens),
      duration: formatDurationFromMs(summed.durationMs),
      models: mergeModels(group),
    });
  }
  result.sort((a, b) => b.day.localeCompare(a.day));
  return result;
}

const data = readWebviewData();
const originalDayData = data.dayData.slice();
const originalDailyChartData = data.dailyChartData.slice();
const scroll = document.getElementById("daily-scroll");
const viewport = document.getElementById("daily-viewport");
const spacerTop = document.getElementById("daily-spacer-top");
const spacerBottom = document.getElementById("daily-spacer-bottom");
const dailyGraphView = document.getElementById("daily-view-graph");
const dailyViewButtons = document.querySelectorAll("[data-daily-view]");
const dailyViews = document.querySelectorAll(".daily-view");
const projectsTab = document.getElementById("tab-projects");
const periodButtons = document.querySelectorAll("[data-period]");

const chartController = createChartController(data);
let dailyListController = createDailyListController({
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
let activePeriod: Period = "daily";

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

function updateGraphStats(chartDays: ChartDayItem[], period: Period): void {
  if (chartDays.length === 0) {return;}
  const reversed = chartDays.slice().reverse();
  const latest = reversed[reversed.length - 1];
  const peak = reversed.reduce((best, d) => d.totalTokens > best.totalTokens ? d : best, reversed[0]);
  const average = Math.round(reversed.reduce((s, d) => s + d.totalTokens, 0) / reversed.length);

  const periodUnit = period === "daily" ? "Day" : period === "weekly" ? "Week" : "Month";
  const latestLabel = document.querySelector("[data-stat=\"latest-label\"]");
  const averageLabel = document.querySelector("[data-stat=\"average-label\"]");
  const peakLabel = document.querySelector("[data-stat=\"peak-label\"]");
  const latestValue = document.querySelector("[data-stat=\"latest-value\"]");
  const averageValue = document.querySelector("[data-stat=\"average-value\"]");
  const peakValue = document.querySelector("[data-stat=\"peak-value\"]");

  if (latestLabel) {latestLabel.textContent = "Latest " + periodUnit;}
  if (averageLabel) {averageLabel.textContent = "Average / " + periodUnit;}
  if (peakLabel) {peakLabel.textContent = "Peak (" + peak.dayLabel + ")";}
  if (latestValue) {latestValue.textContent = formatTokensCompact(latest.totalTokens);}
  if (averageValue) {averageValue.textContent = formatTokensCompact(average);}
  if (peakValue) {peakValue.textContent = formatTokensCompact(peak.totalTokens);}
}

function applyPeriod(period: Period): void {
  if (period === activePeriod) {return;}
  activePeriod = period;

  const aggregatedDayData = aggregateDayData(originalDayData, period);
  const aggregatedChartData = aggregateChartData(originalDailyChartData, period);

  data.dayData = aggregatedDayData;
  data.dailyChartData = aggregatedChartData;

  dailyListController = createDailyListController({
    dayData: aggregatedDayData,
    scroll: scroll instanceof HTMLElement ? scroll : null,
    spacerBottom: spacerBottom instanceof HTMLElement ? spacerBottom : null,
    spacerTop: spacerTop instanceof HTMLElement ? spacerTop : null,
    viewport: viewport instanceof HTMLElement ? viewport : null,
  });

  updateGraphStats(aggregatedChartData, period);

  periodButtons.forEach((button) => {
    if (!(button instanceof HTMLElement)) {return;}
    button.classList.toggle("active", button.dataset.period === period);
  });

  if (activeDailyView === "cards") {
    dailyListController.scheduleRender();
  } else {
    chartController.renderDailyCharts();
  }
  chartController.renderPieChart();
}

chartController.renderAllCharts();
chartController.renderPieChart();

if (scroll instanceof HTMLElement) {
  scroll.addEventListener("scroll", () => dailyListController.scheduleRender());
}

if (viewport instanceof HTMLElement) {
  viewport.addEventListener("click", (event) => dailyListController.handleViewportClick(event));
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {return;}

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
    if (!(target instanceof Element)) {return;}

    const card = target.closest(".card[data-project-card]");
    if (!(card instanceof HTMLElement)) {return;}
    if (!target.closest(".card-header") && !target.closest(".card-summary") && !target.closest(".card-bar-track")) {return;}

    card.classList.toggle("expanded");
    chartController.hideAllChartTooltips();
  });
}

if (dailyGraphView instanceof HTMLElement) {
  dailyGraphView.addEventListener("pointerleave", chartController.hideAllChartTooltips);
}

dailyViewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!(button instanceof HTMLElement)) {return;}
    setDailyView(button.dataset.dailyView ?? "cards");
  });
});

periodButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!(button instanceof HTMLElement)) {return;}
    const period = button.dataset.period;
    if (period === "daily" || period === "weekly" || period === "monthly") {
      applyPeriod(period);
    }
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
