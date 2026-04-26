import { MODEL_COLORS } from "./constants.js";
import { escapeHtmlText, formatTokensCompact } from "./view-helpers.js";
import type { ChartConfig, ChartDayItem, ChartValueKey, DayDataItem, WebviewData } from "../../src/webview-contract.js";

type ChartController = {
  handlePointerEvent(event: PointerEvent): void;
  hideAllChartTooltips(): void;
  renderAllCharts(): void;
  renderDailyCharts(): void;
  renderPieChart(): void;
  toggleLegendSeries(chartId: string, seriesKey: string): void;
};

const CHART_WIDTH = 720;
const CHART_HEIGHT = 240;
const CHART_PADDING_TOP = 16;
const CHART_PADDING_RIGHT = 12;
const CHART_PADDING_BOTTOM = 34;
const CHART_PADDING_LEFT = 44;
const CHART_DRAWABLE_WIDTH = CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
const CHART_DRAWABLE_HEIGHT = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;
const CHART_BASELINE_Y = CHART_PADDING_TOP + CHART_DRAWABLE_HEIGHT;

function createChartController(data: WebviewData): ChartController {
  const allCharts = data.dailyCharts.concat(data.projectCharts);
  const dailyChartIds = new Set(data.dailyChartIds);
  const chartHiddenSeries = new Map(allCharts.map((chart) => [chart.id, new Set<string>()]));

  function formatChartValue(valueFormat: string, value: number): string {
    return valueFormat === "tokens" ? formatTokensCompact(value) : String(value);
  }

  function getChartConfig(chartId: string): ChartConfig | null {
    return allCharts.find((chart) => chart.id === chartId) ?? null;
  }

  function getChartDays(chartId: string): ChartDayItem[] {
    const chartDays = dailyChartIds.has(chartId)
      ? data.dailyChartData
      : (data.projectChartDataSets[chartId] ?? []);
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
      ? Array.from({ length }, (_, index) => index)
      : Array.from(new Set([
          0,
          Math.round((length - 1) * 0.25),
          Math.round((length - 1) * 0.5),
          Math.round((length - 1) * 0.75),
          length - 1,
        ])).sort((left, right) => left - right);
  }

  function buildChartGuideLines(maxValue: number, valueFormat: string): string {
    return Array.from(new Set([maxValue, Math.round((maxValue * 2) / 3), Math.round(maxValue / 3), 0]))
      .sort((left, right) => right - left)
      .map((value) => {
        const y = CHART_PADDING_TOP + CHART_DRAWABLE_HEIGHT - (value / maxValue) * CHART_DRAWABLE_HEIGHT;
        return '<line class="daily-chart-guide" x1="' + CHART_PADDING_LEFT + '" y1="' + y.toFixed(2) + '" x2="' + (CHART_WIDTH - CHART_PADDING_RIGHT).toFixed(2) + '" y2="' + y.toFixed(2) + '"></line>'
          + '<text class="daily-chart-guide-label" x="' + (CHART_PADDING_LEFT - 8) + '" y="' + (y + 3).toFixed(2) + '" text-anchor="end">' + escapeHtmlText(formatChartValue(valueFormat, value)) + "</text>";
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
      .filter((seriesItem) => !hiddenSeries.has(seriesItem.key))
      .map((seriesItem) => [
        seriesItem.label,
        formatChartValue(chartConfig.valueFormat, dayItem[seriesItem.key as ChartValueKey]),
      ]);
  }

  function buildChartTooltip(chartConfig: ChartConfig, dayItem: ChartDayItem, hiddenSeries: Set<string>): string {
    const rows = buildChartTooltipRows(chartConfig, dayItem, hiddenSeries);
    return '<div class="daily-chart-tooltip-day">' + escapeHtmlText(dayItem.dayLabel) + "</div>"
      + '<div class="daily-chart-tooltip-grid">' + rows.map((row) =>
        '<div class="daily-chart-tooltip-label">' + escapeHtmlText(row[0]) + "</div>"
        + '<div class="daily-chart-tooltip-value">' + escapeHtmlText(row[1]) + "</div>",
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
    if (!(chartSection instanceof Element)) {
      return;
    }

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
      if (!(button instanceof HTMLElement)) {
        return;
      }

      const seriesKey = button.getAttribute("data-series-key") ?? "";
      const isHidden = hiddenSeries.has(seriesKey);
      button.classList.toggle("is-hidden", isHidden);
      button.setAttribute("aria-pressed", String(!isHidden));
      button.setAttribute("aria-disabled", String(!isHidden && visibleSeriesCount === 1));
    });
  }

  function renderChart(chartConfig: ChartConfig): void {
    const chartSection = document.querySelector('.daily-chart-section[data-chart-id="' + chartConfig.id + '"]');
    if (!(chartSection instanceof Element)) {
      return;
    }

    const svg = chartSection.querySelector("[data-chart-svg]");
    if (!(svg instanceof SVGElement)) {
      return;
    }

    const chartDays = getChartDays(chartConfig.id);
    if (chartDays.length === 0) {
      hideChartTooltip(chartSection);
      svg.innerHTML = "";
      return;
    }

    const chartAxisPoints = getChartAxisPoints(chartDays);
    const chartLabelIndexes = getChartLabelIndexes(chartDays.length);
    const hiddenSeries = chartHiddenSeries.get(chartConfig.id) ?? new Set<string>();
    const visibleSeries = chartConfig.series.filter((seriesItem) => !hiddenSeries.has(seriesItem.key));
    const maxValue = visibleSeries.length === 0
      ? 1
      : chartDays.reduce((currentMax, dayItem) => {
          const dayMax = visibleSeries.reduce(
            (seriesMax, seriesItem) => Math.max(seriesMax, dayItem[seriesItem.key]),
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
        const points = chartDays.map((dayItem, dayIndex) => ({
          dayIndex,
          value: dayItem[seriesItem.key],
          x: chartAxisPoints[dayIndex].x,
          y: CHART_PADDING_TOP + CHART_DRAWABLE_HEIGHT - (dayItem[seriesItem.key] / maxValue) * CHART_DRAWABLE_HEIGHT,
        }));
        const linePath = points
          .map((point, index) => (index === 0 ? "M" : "L") + ' ' + point.x.toFixed(2) + ' ' + point.y.toFixed(2))
          .join(" ");
        const areaPath = chartConfig.fillArea && seriesIndex === 0 && points.length > 1
          ? linePath + ' L ' + points[points.length - 1].x.toFixed(2) + ' ' + CHART_BASELINE_Y.toFixed(2) + ' L ' + points[0].x.toFixed(2) + ' ' + CHART_BASELINE_Y.toFixed(2) + ' Z'
          : "";
        const pointMarkers = points
          .map((point) =>
            '<circle class="daily-chart-point" data-chart-id="' + escapeHtmlText(chartConfig.id) + '" data-day-index="' + point.dayIndex + '" data-series-key="' + escapeHtmlText(seriesItem.key) + '" cx="' + point.x.toFixed(2) + '" cy="' + point.y.toFixed(2) + '" r="8" style="stroke:' + seriesItem.color + '"></circle>',
          )
          .join("");

        return (areaPath ? '<path class="daily-chart-area" style="fill:url(#' + chartConfig.id + '-fill)" d="' + areaPath + '"></path>' : "")
          + '<path class="daily-chart-line" style="stroke:' + seriesItem.color + '" d="' + linePath + '"></path>'
          + pointMarkers;
      })
      .join("");

    hideChartTooltip(chartSection);
    svg.innerHTML = defs + guideLines + seriesMarkup + xLabels;
    updateChartLegendState(chartSection, hiddenSeries, visibleSeries.length);
  }

  function renderCharts(chartConfigs: ChartConfig[]): void {
    chartConfigs.forEach((chartConfig) => renderChart(chartConfig));
  }

  function renderAllCharts(): void {
    renderCharts(allCharts);
  }

  function renderDailyCharts(): void {
    renderCharts(data.dailyCharts);
  }

  function computeModelPieData(dayData: DayDataItem[]): { name: string; totalTokens: number }[] {
    const totals: Record<string, number> = {};
    for (const dayItem of dayData) {
      for (const model of dayItem.models) {
        totals[model.model] = (totals[model.model] || 0) + model.totalTokens;
      }
    }

    return Object.keys(totals)
      .map((name) => ({ name, totalTokens: totals[name] }))
      .sort((left, right) => right.totalTokens - left.totalTokens);
  }

  function renderPieChart(): void {
    const svg = document.querySelector(".pie-chart");
    if (!(svg instanceof SVGElement)) {
      return;
    }

    const pieData = computeModelPieData(data.dayData);
    const total = pieData.reduce((sum, entry) => sum + entry.totalTokens, 0);
    if (total === 0) {
      svg.innerHTML = "";
      return;
    }

    const centerX = 100;
    const centerY = 100;
    const radius = 80;
    let startAngle = -Math.PI / 2;
    let paths = "";
    let legendHtml = "";

    for (let index = 0; index < pieData.length; index += 1) {
      const percentage = pieData[index].totalTokens / total;
      const angle = percentage * 2 * Math.PI;
      const endAngle = startAngle + angle;
      if (angle < 0.001) {
        startAngle = endAngle;
        continue;
      }

      const x1 = centerX + radius * Math.cos(startAngle);
      const y1 = centerY + radius * Math.sin(startAngle);
      const x2 = centerX + radius * Math.cos(endAngle);
      const y2 = centerY + radius * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;

      paths += '<path class="pie-slice" d="M ' + centerX + ' ' + centerY + ' L ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' A ' + radius + ' ' + radius + ' 0 ' + largeArc + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' Z" fill="' + MODEL_COLORS[index % MODEL_COLORS.length] + '"></path>';
      legendHtml += '<div class="pie-legend-item"><span class="pie-legend-swatch" style="background:' + MODEL_COLORS[index % MODEL_COLORS.length] + '"></span><span class="pie-legend-label">' + escapeHtmlText(pieData[index].name) + '</span><span class="pie-legend-value">' + (percentage * 100).toFixed(1) + '%</span></div>';
      startAngle = endAngle;
    }

    svg.innerHTML = paths;
    const legend = document.getElementById("pie-legend");
    if (legend instanceof HTMLElement) {
      legend.innerHTML = legendHtml;
    }
  }

  function toggleLegendSeries(chartId: string, seriesKey: string): void {
    const chartConfig = getChartConfig(chartId);
    const hiddenSeries = chartHiddenSeries.get(chartId);
    if (!chartConfig || !hiddenSeries) {
      return;
    }

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
  }

  function handlePointerEvent(event: PointerEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const point = target.closest(".daily-chart-point");
    if (!(point instanceof Element)) {
      hideAllChartTooltips();
      return;
    }

    showChartTooltip(point, event.clientX, event.clientY);
  }

  return {
    handlePointerEvent,
    hideAllChartTooltips,
    renderAllCharts,
    renderDailyCharts,
    renderPieChart,
    toggleLegendSeries,
  };
}

export { createChartController };
export type { ChartController };
