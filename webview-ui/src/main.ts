type DayDataItem = {
  dayLabel: string;
  totalTokens: number;
  totalTokensLabel: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheRead: number;
  cacheWrite: number;
  totalCost: number;
  sessions: number;
  steps: string;
  duration: string;
  models: { model: string; totalTokens: number }[];
  summaryBars: { label: string; color: string; pct: string; value: string }[];
  detailBars: { label: string; color: string; pct: string; value: string }[];
};

type ChartSeries = {
  key: string;
  label: string;
  color: string;
};

type ChartConfig = {
  id: string;
  title: string;
  valueFormat: "tokens" | "number";
  fillArea?: boolean;
  hideTitle?: boolean;
  series: ChartSeries[];
};

type ChartDayItem = {
  day: string;
  dayLabel: string;
  totalTokens: number;
  totalTokensLabel: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheRead: number;
  cacheWrite: number;
  totalCost: number;
  sessions: number;
  steps: number;
  duration: string;
  models: { model: string; totalTokens: number }[];
};

type WebviewData = {
  dayData: DayDataItem[];
  dailyCharts: ChartConfig[];
  projectCharts: ChartConfig[];
  dailyChartIds: string[];
  dailyChartData: ChartDayItem[];
  projectChartDataSets: Record<string, ChartDayItem[]>;
  defaultTabIsDaily: boolean;
};

declare const __TOKEN_LENS_DATA__: WebviewData;

const DATA = __TOKEN_LENS_DATA__;
const DAY_DATA = DATA.dayData;
const DAILY_CHARTS = DATA.dailyCharts;
const PROJECT_CHARTS = DATA.projectCharts;
const ALL_CHARTS = DAILY_CHARTS.concat(PROJECT_CHARTS);
const DAILY_CHART_IDS = new Set(DATA.dailyChartIds);
const DAILY_CHART_DATA = DATA.dailyChartData;
const PROJECT_CHART_DATASETS = DATA.projectChartDataSets;

const MODEL_COLORS = [
  "#3794ff", "#89d185", "#b180d7", "#d18616", "#4ec9b0",
  "#f14c4c", "#e9d74a", "#6c71c4", "#2aa198", "#d33682",
  "#859900", "#cb4b16", "#268bd2", "#d01b24", "#738dfe",
];
const DAY_HEIGHT_ESTIMATE = 96;
const DAY_GROUP_GAP = 8;
const BUFFER = 4;
const CHART_WIDTH = 720;
const CHART_HEIGHT = 240;
const CHART_PADDING_TOP = 16;
const CHART_PADDING_RIGHT = 12;
const CHART_PADDING_BOTTOM = 34;
const CHART_PADDING_LEFT = 44;
const CHART_DRAWABLE_WIDTH = CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
const CHART_DRAWABLE_HEIGHT = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;
const CHART_BASELINE_Y = CHART_PADDING_TOP + CHART_DRAWABLE_HEIGHT;

const scroll = document.getElementById("daily-scroll");
const viewport = document.getElementById("daily-viewport");
const spacerTop = document.getElementById("daily-spacer-top");
const spacerBottom = document.getElementById("daily-spacer-bottom");
const dailyGraphView = document.getElementById("daily-view-graph");
const dailyViewButtons = document.querySelectorAll("[data-daily-view]");
const dailyViews = document.querySelectorAll(".daily-view");
const projectsTab = document.getElementById("tab-projects");
const chartHiddenSeries = new Map(ALL_CHARTS.map((chart) => [chart.id, new Set<string>()]));
const expandedStates = DAY_DATA.map(() => false);
const itemHeights = DAY_DATA.map(() => DAY_HEIGHT_ESTIMATE + DAY_GROUP_GAP);
const offsets = new Array(DAY_DATA.length + 1).fill(0);
let totalHeight = 0;
let renderPending = false;
let activeDailyView = "cards";

function escapeHtmlText(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTokensCompact(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "K";
  }
  return String(value);
}

function formatChartValue(valueFormat: string, value: number): string {
  return valueFormat === "tokens" ? formatTokensCompact(value) : String(value);
}

function getChartConfig(chartId: string): ChartConfig | null {
  return ALL_CHARTS.find((chart) => chart.id === chartId) ?? null;
}

function getChartDays(chartId: string): ChartDayItem[] {
  const chartDays = DAILY_CHART_IDS.has(chartId)
    ? DAILY_CHART_DATA
    : (PROJECT_CHART_DATASETS[chartId] ?? []);
  return chartDays.slice().reverse();
}

function getChartAxisPoints(chartDays: ChartDayItem[]): { dayLabel: string; x: number }[] {
  return chartDays.map((day, index) => ({
    dayLabel: day.dayLabel,
    x: chartDays.length === 1
      ? CHART_PADDING_LEFT + CHART_DRAWABLE_WIDTH / 2
      : CHART_PADDING_LEFT + (index / (chartDays.length - 1)) * CHART_DRAWABLE_WIDTH,
  }));
}

function getChartLabelIndexes(length: number): number[] {
  return length <= 6
    ? Array.from({ length }, (_, i) => i)
    : Array.from(new Set([
        0,
        Math.round((length - 1) * 0.25),
        Math.round((length - 1) * 0.5),
        Math.round((length - 1) * 0.75),
        length - 1,
      ])).sort((a, b) => a - b);
}

function buildChartGuideLines(maxValue: number, valueFormat: string): string {
  return Array.from(new Set([maxValue, Math.round((maxValue * 2) / 3), Math.round(maxValue / 3), 0]))
    .sort((a, b) => b - a)
    .map((value) => {
      const y = CHART_PADDING_TOP + CHART_DRAWABLE_HEIGHT - (value / maxValue) * CHART_DRAWABLE_HEIGHT;
      return '<line class="daily-chart-guide" x1="' + CHART_PADDING_LEFT + '" y1="' + y.toFixed(2) + '" x2="' + (CHART_WIDTH - CHART_PADDING_RIGHT).toFixed(2) + '" y2="' + y.toFixed(2) + '"></line>' +
        '<text class="daily-chart-guide-label" x="' + (CHART_PADDING_LEFT - 8) + '" y="' + (y + 3).toFixed(2) + '" text-anchor="end">' + escapeHtmlText(formatChartValue(valueFormat, value)) + "</text>";
    })
    .join("");
}

function buildChartXAxisLabels(chartAxisPoints: { dayLabel: string; x: number }[], chartLabelIndexes: number[]): string {
  return chartLabelIndexes
    .map((index) => {
      const point = chartAxisPoints[index];
      return '<text class="daily-chart-axis-label" x="' + point.x.toFixed(2) + '" y="' + (CHART_HEIGHT - 10) + '" text-anchor="middle">' + escapeHtmlText(point.dayLabel) + "</text>";
    })
    .join("");
}

function buildChartTooltipRows(chartConfig: ChartConfig, dayItem: ChartDayItem, hiddenSeries: Set<string>): [string, string][] {
  if (chartConfig.id === "daily-total-chart") {
    return [
      ["total", formatTokensCompact(dayItem.totalTokens)],
      ["input", formatTokensCompact(dayItem.inputTokens)],
      ["output", formatTokensCompact(dayItem.outputTokens)],
      ["reason", formatTokensCompact(dayItem.reasoningTokens)],
      ["cache r", formatTokensCompact(dayItem.cacheRead)],
      ["cache w", formatTokensCompact(dayItem.cacheWrite)],
    ];
  }

  return chartConfig.series
    .filter((s) => !hiddenSeries.has(s.key))
    .map((s) => [
      s.label,
      formatChartValue(chartConfig.valueFormat, Number((dayItem as Record<string, unknown>)[s.key]) || 0),
    ]);
}

function buildChartTooltip(chartConfig: ChartConfig, dayItem: ChartDayItem, hiddenSeries: Set<string>): string {
  const rows = buildChartTooltipRows(chartConfig, dayItem, hiddenSeries);
  return '<div class="daily-chart-tooltip-day">' + escapeHtmlText(dayItem.dayLabel) + "</div>" +
    '<div class="daily-chart-tooltip-grid">' + rows.map((row) =>
      '<div class="daily-chart-tooltip-label">' + escapeHtmlText(row[0]) + "</div>" +
      '<div class="daily-chart-tooltip-value">' + escapeHtmlText(row[1]) + "</div>"
    ).join("") + "</div>";
}

function hideChartTooltip(chartSection: Element): void {
  const tooltip = chartSection.querySelector("[data-chart-tooltip]");
  if (tooltip instanceof HTMLElement) {
    tooltip.hidden = true;
  }
}

function hideAllChartTooltips(): void {
  document.querySelectorAll("[data-chart-tooltip]").forEach((tooltip) => {
    if (tooltip instanceof HTMLElement) {
      tooltip.hidden = true;
    }
  });
}

function positionChartTooltip(tooltip: HTMLElement, wrap: HTMLElement, clientX: number, clientY: number): void {
  const wrapRect = wrap.getBoundingClientRect();
  const minOffset = 8;
  const maxLeft = Math.max(minOffset, wrap.clientWidth - tooltip.offsetWidth - minOffset);
  const maxTop = Math.max(minOffset, wrap.clientHeight - tooltip.offsetHeight - minOffset);
  const left = Math.min(maxLeft, Math.max(minOffset, clientX - wrapRect.left + 12));
  const top = Math.min(maxTop, Math.max(minOffset, clientY - wrapRect.top - tooltip.offsetHeight - 12));
  tooltip.style.left = left + "px";
  tooltip.style.top = top + "px";
}

function showChartTooltip(point: Element, clientX: number, clientY: number): void {
  const chartSection = point.closest(".daily-chart-section");
  if (!(chartSection instanceof Element)) return;

  const wrap = chartSection.querySelector(".daily-chart-wrap");
  const tooltip = chartSection.querySelector("[data-chart-tooltip]");
  const chartId = chartSection.getAttribute("data-chart-id") ?? "";
  const chartConfig = getChartConfig(chartId);
  const chartDays = getChartDays(chartId);
  const hiddenSeries = chartHiddenSeries.get(chartId) ?? new Set<string>();
  const dayIndex = Number(point.getAttribute("data-day-index"));
  const dayItem = chartDays[dayIndex];
  if (!(wrap instanceof HTMLElement) || !(tooltip instanceof HTMLElement) || Number.isNaN(dayIndex) || !dayItem || !chartConfig) {
    return;
  }

  tooltip.innerHTML = buildChartTooltip(chartConfig, dayItem, hiddenSeries);
  tooltip.hidden = false;
  positionChartTooltip(tooltip, wrap, clientX, clientY);
}

function updateChartLegendState(chartSection: Element, hiddenSeries: Set<string>, visibleSeriesCount: number): void {
  chartSection.querySelectorAll(".daily-chart-legend-item[data-series-key]").forEach((button) => {
    if (!(button instanceof HTMLElement)) return;
    const seriesKey = button.getAttribute("data-series-key") ?? "";
    const isHidden = hiddenSeries.has(seriesKey);
    button.classList.toggle("is-hidden", isHidden);
    button.setAttribute("aria-pressed", String(!isHidden));
    button.setAttribute("aria-disabled", String(!isHidden && visibleSeriesCount === 1));
  });
}

function renderChart(chartConfig: ChartConfig): void {
  const chartSection = document.querySelector('.daily-chart-section[data-chart-id="' + chartConfig.id + '"]');
  if (!(chartSection instanceof Element)) return;

  const svg = chartSection.querySelector("[data-chart-svg]");
  if (!(svg instanceof SVGElement)) return;

  const chartDays = getChartDays(chartConfig.id);
  if (chartDays.length === 0) {
    hideChartTooltip(chartSection);
    svg.innerHTML = "";
    return;
  }

  const chartAxisPoints = getChartAxisPoints(chartDays);
  const chartLabelIndexes = getChartLabelIndexes(chartDays.length);

  const hiddenSeries = chartHiddenSeries.get(chartConfig.id) ?? new Set<string>();
  const visibleSeries = chartConfig.series.filter((s) => !hiddenSeries.has(s.key));
  const maxValue = visibleSeries.length === 0
    ? 1
    : chartDays.reduce((currentMax, dayItem) => {
        const dayMax = visibleSeries.reduce(
          (seriesMax, s) => Math.max(seriesMax, Number((dayItem as Record<string, unknown>)[s.key]) || 0),
          0,
        );
        return Math.max(currentMax, dayMax);
      }, 0) || 1;

  const defs = chartConfig.fillArea && visibleSeries.length > 0
    ? '<defs><linearGradient id="' + chartConfig.id + '-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style="stop-color:' + visibleSeries[0].color + '; stop-opacity: 0.24;"></stop><stop offset="100%" style="stop-color:' + visibleSeries[0].color + '; stop-opacity: 0;"></stop></linearGradient></defs>'
    : "";
  const guideLines = buildChartGuideLines(maxValue, chartConfig.valueFormat);
  const xLabels = buildChartXAxisLabels(chartAxisPoints, chartLabelIndexes);
  const seriesMarkup = visibleSeries
    .map((seriesItem, seriesIndex) => {
      const points = chartDays.map((dayItem, dayIndex) => {
        const value = Number((dayItem as Record<string, unknown>)[seriesItem.key]) || 0;
        return {
          dayIndex,
          value,
          x: chartAxisPoints[dayIndex].x,
          y: CHART_PADDING_TOP + CHART_DRAWABLE_HEIGHT - (value / maxValue) * CHART_DRAWABLE_HEIGHT,
        };
      });

      const linePath = points
        .map((p, i) => (i === 0 ? "M" : "L") + " " + p.x.toFixed(2) + " " + p.y.toFixed(2))
        .join(" ");
      const areaPath = chartConfig.fillArea && seriesIndex === 0 && points.length > 1
        ? linePath + " L " + points[points.length - 1].x.toFixed(2) + " " + CHART_BASELINE_Y.toFixed(2) + " L " + points[0].x.toFixed(2) + " " + CHART_BASELINE_Y.toFixed(2) + " Z"
        : "";
      const pointMarkers = points
        .map((p) =>
          '<circle class="daily-chart-point" data-chart-id="' + escapeHtmlText(chartConfig.id) + '" data-day-index="' + p.dayIndex + '" data-series-key="' + escapeHtmlText(seriesItem.key) + '" cx="' + p.x.toFixed(2) + '" cy="' + p.y.toFixed(2) + '" r="4" style="stroke:' + seriesItem.color + '"></circle>'
        )
        .join("");

      return (areaPath ? '<path class="daily-chart-area" style="fill:url(#' + chartConfig.id + '-fill)" d="' + areaPath + '"></path>' : "") +
        '<path class="daily-chart-line" style="stroke:' + seriesItem.color + '" d="' + linePath + '"></path>' +
        pointMarkers;
    })
    .join("");

  hideChartTooltip(chartSection);
  svg.innerHTML = defs + guideLines + seriesMarkup + xLabels;
  updateChartLegendState(chartSection, hiddenSeries, visibleSeries.length);
}

function renderCharts(chartConfigs: ChartConfig[]): void {
  chartConfigs.forEach((config) => renderChart(config));
}

function renderAllCharts(): void {
  renderCharts(ALL_CHARTS);
}

function setDailyView(nextView: string): void {
  activeDailyView = nextView === "graph" ? "graph" : "cards";

  dailyViewButtons.forEach((button) => {
    if (!(button instanceof HTMLElement)) return;
    button.classList.toggle("active", button.dataset.dailyView === activeDailyView);
  });

  dailyViews.forEach((view) => {
    if (!(view instanceof HTMLElement)) return;
    view.classList.toggle("active", view.id === "daily-view-" + activeDailyView);
  });

  if (activeDailyView === "cards") {
    scheduleRender();
  } else {
    renderCharts(DAILY_CHARTS);
  }
}

function recomputeOffsets(): void {
  offsets[0] = 0;
  for (let i = 0; i < DAY_DATA.length; i += 1) {
    offsets[i + 1] = offsets[i] + itemHeights[i];
  }
  totalHeight = offsets[DAY_DATA.length];
}

function findStartIndex(scrollTop: number): number {
  let i = 0;
  while (i < DAY_DATA.length && offsets[i + 1] <= scrollTop) {
    i += 1;
  }
  return Math.max(0, i - BUFFER);
}

function findEndIndex(bottom: number): number {
  let i = 0;
  while (i < DAY_DATA.length && offsets[i] < bottom) {
    i += 1;
  }
  return Math.min(DAY_DATA.length, i + BUFFER);
}

function renderDayGroup(item: DayDataItem, index: number): string {
  const summaryBars = item.summaryBars.map((bar) =>
    '<div class="hbar-row">' +
      '<div class="hbar-type-label" style="color:' + bar.color + '">' + bar.label + "</div>" +
      '<div class="hbar-track-wrap"><div class="hbar-fill" style="width:' + bar.pct + "%;background:" + bar.color + '"></div></div>' +
      '<div class="hbar-value"><span class="hbar-tokens">' + bar.value + "</span></div>" +
    "</div>"
  ).join("");
  const detailBars = item.detailBars.map((bar) =>
    '<div class="hbar-row">' +
      '<div class="hbar-type-label" style="color:' + bar.color + '">' + bar.label + "</div>" +
      '<div class="hbar-track-wrap"><div class="hbar-fill" style="width:' + bar.pct + "%;background:" + bar.color + '"></div></div>' +
      '<div class="hbar-value"><span class="hbar-tokens">' + bar.value + "</span></div>" +
    "</div>"
  ).join("");
  const modelCount = item.models ? item.models.length : 0;
  let modelBarHtml = "";
  if (item.models && item.models.length > 0) {
    const modelTotal = item.models.reduce((sum, m) => sum + m.totalTokens, 0);
    if (modelTotal > 0) {
      const sorted = item.models.slice().sort((a, b) => b.totalTokens - a.totalTokens);
      const segs = sorted.map((m, i) => {
        const pct = (m.totalTokens / modelTotal * 100).toFixed(1);
        return '<div class="model-bar-seg" style="width:' + pct + "%;background:" + MODEL_COLORS[i % MODEL_COLORS.length] + '" title="' + escapeHtmlText(m.model) + ": " + pct + '%"></div>';
      }).join("");
      modelBarHtml = '<div class="hbar-row">' +
        '<div class="hbar-type-label" style="color:var(--accent2)">models</div>' +
        '<div class="model-bar-track">' + segs + "</div>" +
        '<div class="hbar-value"><span class="hbar-tokens">' + sorted.length + "</span></div>" +
      "</div>";
    }
  }
  return '<div class="day-group' + (expandedStates[index] ? " expanded" : "") + '" data-index="' + index + '">' +
    '<div class="day-header"><span class="day-label">' + item.dayLabel + "</span></div>" +
    '<div class="day-meta"><span class="day-badge">' + item.totalTokensLabel + " tokens</span><span class=\"day-badge\">" + modelCount + " model" + (modelCount !== 1 ? "s" : "") + '</span><span class="day-badge">' + item.duration + "</span></div>" +
    summaryBars +
    '<div class="day-details">' + detailBars + modelBarHtml + "</div>" +
  "</div>";
}

function measureRenderedHeights(): boolean {
  if (!viewport) return false;
  let changed = false;
  viewport.querySelectorAll(".day-group").forEach((element) => {
    const index = Number(element.getAttribute("data-index"));
    const nextHeight = Math.ceil(element.getBoundingClientRect().height) + DAY_GROUP_GAP;
    if (!Number.isNaN(index) && nextHeight > 0 && itemHeights[index] !== nextHeight) {
      itemHeights[index] = nextHeight;
      changed = true;
    }
  });
  if (changed) {
    recomputeOffsets();
  }
  return changed;
}

function renderVirtualList(): void {
  if (!scroll || !viewport || !spacerTop || !spacerBottom || DAY_DATA.length === 0) return;
  const viewHeight = scroll.clientHeight;
  if (viewHeight === 0) return;

  const scrollTop = scroll.scrollTop;
  const start = findStartIndex(scrollTop);
  const end = findEndIndex(scrollTop + viewHeight);

  spacerTop.style.height = offsets[start] + "px";
  spacerBottom.style.height = Math.max(0, totalHeight - offsets[end]) + "px";

  let html = "";
  for (let i = start; i < end; i += 1) {
    html += renderDayGroup(DAY_DATA[i], i);
  }
  viewport.innerHTML = html;

  if (measureRenderedHeights()) {
    scheduleRender();
  }
}

function scheduleRender(): void {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    renderVirtualList();
  });
}

function computeModelPieData(): { name: string; totalTokens: number }[] {
  const totals: Record<string, number> = {};
  for (let i = 0; i < DAY_DATA.length; i++) {
    const models = DAY_DATA[i].models;
    if (!models) continue;
    for (let j = 0; j < models.length; j++) {
      const name = models[j].model;
      totals[name] = (totals[name] || 0) + models[j].totalTokens;
    }
  }
  return Object.keys(totals)
    .map((name) => ({ name, totalTokens: totals[name] }))
    .sort((a, b) => b.totalTokens - a.totalTokens);
}

function renderPieChart(): void {
  const svg = document.querySelector(".pie-chart");
  if (!svg) return;
  const data = computeModelPieData();
  const total = data.reduce((sum, d) => sum + d.totalTokens, 0);
  if (total === 0) {
    svg.innerHTML = "";
    return;
  }
  const cx = 100, cy = 100, r = 80;
  let startAngle = -Math.PI / 2;
  let paths = "";
  let legendHtml = "";
  for (let i = 0; i < data.length; i++) {
    const pct = data[i].totalTokens / total;
    const angle = pct * 2 * Math.PI;
    const endAngle = startAngle + angle;
    if (angle < 0.001) { startAngle = endAngle; continue; }
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    paths += '<path class="pie-slice" d="M ' + cx + " " + cy + " L " + x1.toFixed(2) + " " + y1.toFixed(2) + " A " + r + " " + r + " 0 " + largeArc + " 1 " + x2.toFixed(2) + " " + y2.toFixed(2) + ' Z" fill="' + MODEL_COLORS[i % MODEL_COLORS.length] + '"></path>';
    legendHtml += '<div class="pie-legend-item"><span class="pie-legend-swatch" style="background:' + MODEL_COLORS[i % MODEL_COLORS.length] + '"></span><span class="pie-legend-label">' + escapeHtmlText(data[i].name) + '</span><span class="pie-legend-value">' + (pct * 100).toFixed(1) + "%</span></div>";
    startAngle = endAngle;
  }
  svg.innerHTML = paths;
  const legend = document.getElementById("pie-legend");
  if (legend) legend.innerHTML = legendHtml;
}

renderAllCharts();
recomputeOffsets();
renderPieChart();

if (scroll) {
  scroll.addEventListener("scroll", scheduleRender);
}

if (viewport) {
  viewport.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const group = target.closest(".day-group");
    if (!group) return;

    const index = Number(group.getAttribute("data-index"));
    if (Number.isNaN(index)) return;

    expandedStates[index] = !expandedStates[index];
    group.classList.toggle("expanded", expandedStates[index]);

    const nextHeight = Math.ceil(group.getBoundingClientRect().height) + DAY_GROUP_GAP;
    if (nextHeight > 0 && itemHeights[index] !== nextHeight) {
      itemHeights[index] = nextHeight;
      recomputeOffsets();
    }

    scheduleRender();
  });
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const legendButton = target.closest('.daily-chart-legend-item[data-series-key]');
  if (!(legendButton instanceof HTMLButtonElement) || legendButton.disabled) return;

  const chartId = legendButton.getAttribute("data-chart-id");
  const seriesKey = legendButton.getAttribute("data-series-key");
  const chartConfig = chartId ? getChartConfig(chartId) : null;
  if (!chartId || !seriesKey || !chartConfig) return;

  const hiddenSeries = chartHiddenSeries.get(chartId);
  if (!hiddenSeries) return;

  const isHidden = hiddenSeries.has(seriesKey);
  const visibleSeriesCount = chartConfig.series.length - hiddenSeries.size;
  if (!isHidden && visibleSeriesCount === 1) {
    return;
  }

  if (isHidden) {
    hiddenSeries.delete(seriesKey);
  } else {
    hiddenSeries.add(seriesKey);
  }

  renderChart(chartConfig);
});

const handleChartPointer = (event: PointerEvent): void => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const point = target.closest(".daily-chart-point");
  if (!(point instanceof Element)) {
    hideAllChartTooltips();
    return;
  }

  showChartTooltip(point, event.clientX, event.clientY);
};

document.addEventListener("pointerover", handleChartPointer);
document.addEventListener("pointermove", handleChartPointer);

if (projectsTab) {
  projectsTab.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const card = target.closest(".card[data-project-card]");
    if (!(card instanceof HTMLElement)) return;
    if (!target.closest(".card-header") && !target.closest(".card-summary") && !target.closest(".card-bar-track")) {
      return;
    }

    card.classList.toggle("expanded");
    hideAllChartTooltips();
  });
}

if (dailyGraphView) {
  dailyGraphView.addEventListener("pointerleave", hideAllChartTooltips);
}

dailyViewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!(button instanceof HTMLElement)) return;
    setDailyView(button.dataset.dailyView ?? "cards");
  });
});

window.addEventListener("resize", () => {
  if (activeDailyView === "cards") {
    scheduleRender();
  } else {
    hideAllChartTooltips();
  }
});

if (DATA.defaultTabIsDaily) scheduleRender();

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    tab.classList.add("active");
    const tabTarget = document.getElementById("tab-" + (tab as HTMLElement).dataset.tab);
    if (tabTarget) tabTarget.classList.add("active");
    if ((tab as HTMLElement).dataset.tab === "daily" && activeDailyView === "cards") scheduleRender();
  });
});

const COST_STORAGE_KEY = "token-lens-cost-filters";

type CostFilterState = {
  providers: string[];
  sort: "asc" | "desc";
  ageFilter: boolean;
};

function loadCostFilterState(): CostFilterState {
  try {
    const raw = localStorage.getItem(COST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CostFilterState>;
      return {
        providers: Array.isArray(parsed.providers) ? parsed.providers : [],
        sort: parsed.sort === "desc" ? "desc" : "asc",
        ageFilter: !!parsed.ageFilter,
      };
    }
  } catch { /* ignore */ }
  return { providers: [], sort: "asc", ageFilter: false };
}

function saveCostFilterState(): void {
  const state: CostFilterState = {
    providers: [...activeProviders],
    sort: currentSortOrder,
    ageFilter: ageFilterActive,
  };
  try {
    localStorage.setItem(COST_STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

const activeProviders = new Set<string>();
let ageFilterActive = false;
let currentSortOrder: "asc" | "desc" = "asc";

function applyCostFilters(): void {
  const showAllProviders = activeProviders.size === 0;
  const list = document.getElementById("cost-model-list");
  const threeMonthsAgo = list ? Number(list.dataset.threeMonthsAgo) || 0 : 0;

  document.querySelectorAll<HTMLElement>("#cost-model-list .model-cost-row").forEach((row) => {
    const providerOk = showAllProviders || activeProviders.has(row.dataset.provider ?? "");
    const ageOk = !ageFilterActive || (Number(row.dataset.created) || 0) >= threeMonthsAgo;
    row.style.display = providerOk && ageOk ? "" : "none";
  });
}

function applyCostSort(order: "asc" | "desc"): void {
  currentSortOrder = order;

  document.querySelectorAll(".cost-sort-button").forEach((b) => b.classList.remove("active"));
  const btn = document.querySelector(`.cost-sort-button[data-cost-sort="${order}"]`);
  if (btn) btn.classList.add("active");

  const list = document.getElementById("cost-model-list");
  if (!list) return;
  const header = list.querySelector(".model-cost-header");
  const rows = Array.from(list.querySelectorAll<HTMLElement>(".model-cost-row"));
  rows.sort((a, b) => {
    const costA = Number(a.dataset.cost) || 0;
    const costB = Number(b.dataset.cost) || 0;
    return order === "asc" ? costA - costB : costB - costA;
  });
  for (const row of rows) {
    list.appendChild(row);
  }
  if (header) {
    list.insertBefore(header, list.firstChild);
  }
}

function restoreCostFilterState(): void {
  const saved = loadCostFilterState();

  activeProviders.clear();
  for (const p of saved.providers) {
    activeProviders.add(p);
  }

  if (activeProviders.size > 0) {
    document.querySelector(".cost-provider-filter[data-cost-provider=\"all\"]")?.classList.remove("active");
    document.querySelectorAll<HTMLElement>(".cost-provider-filter").forEach((button) => {
      if (button.dataset.costProvider !== "all") {
        button.classList.toggle("active", activeProviders.has(button.dataset.costProvider ?? ""));
      }
    });
  }

  ageFilterActive = saved.ageFilter;
  const ageToggle = document.querySelector("[data-cost-age-toggle]");
  if (ageToggle) {
    ageToggle.classList.toggle("active", ageFilterActive);
  }

  applyCostSort(saved.sort);
  applyCostFilters();
}

document.querySelectorAll(".cost-provider-filter").forEach((button) => {
  button.addEventListener("click", () => {
    if (!(button instanceof HTMLElement)) return;
    const provider = button.dataset.costProvider ?? "all";

    if (provider === "all") {
      activeProviders.clear();
      document.querySelectorAll(".cost-provider-filter").forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
    } else {
      document.querySelector(".cost-provider-filter[data-cost-provider=\"all\"]")?.classList.remove("active");
      if (activeProviders.has(provider)) {
        activeProviders.delete(provider);
        button.classList.remove("active");
      } else {
        activeProviders.add(provider);
        button.classList.add("active");
      }
      if (activeProviders.size === 0) {
        document.querySelector(".cost-provider-filter[data-cost-provider=\"all\"]")?.classList.add("active");
      }
    }

    applyCostFilters();
    saveCostFilterState();
  });
});

const ageToggle = document.querySelector("[data-cost-age-toggle]");
if (ageToggle) {
  ageToggle.addEventListener("click", () => {
    ageFilterActive = !ageFilterActive;
    ageToggle.classList.toggle("active", ageFilterActive);
    applyCostFilters();
    saveCostFilterState();
  });
}

document.querySelectorAll(".cost-sort-button").forEach((button) => {
  button.addEventListener("click", () => {
    if (!(button instanceof HTMLElement)) return;
    const order = button.dataset.costSort === "desc" ? "desc" : "asc";
    applyCostSort(order);
    applyCostFilters();
    saveCostFilterState();
  });
});

restoreCostFilterState();
