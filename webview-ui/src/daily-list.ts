import { MODEL_COLORS } from "./constants.js";
import { escapeHtmlText } from "./view-helpers.js";
import type { DayDataItem } from "../../src/webview-contract.js";

type DailyListController = {
  handleViewportClick(event: MouseEvent): void;
  scheduleRender(): void;
};

type DailyListControllerParams = {
  dayData: DayDataItem[];
  scroll: HTMLElement | null;
  spacerBottom: HTMLElement | null;
  spacerTop: HTMLElement | null;
  viewport: HTMLElement | null;
};

const DAY_HEIGHT_ESTIMATE = 96;
const DAY_GROUP_GAP = 8;
const BUFFER = 4;

function createDailyListController({
  dayData,
  scroll,
  spacerBottom,
  spacerTop,
  viewport,
}: DailyListControllerParams): DailyListController {
  const expandedStates = dayData.map(() => false);
  const itemHeights = dayData.map(() => DAY_HEIGHT_ESTIMATE + DAY_GROUP_GAP);
  const offsets = new Array(dayData.length + 1).fill(0);
  let totalHeight = 0;
  let renderPending = false;

  function recomputeOffsets(): void {
    offsets[0] = 0;
    for (let index = 0; index < dayData.length; index += 1) {
      offsets[index + 1] = offsets[index] + itemHeights[index];
    }
    totalHeight = offsets[dayData.length];
  }

  function findStartIndex(scrollTop: number): number {
    let index = 0;
    while (index < dayData.length && offsets[index + 1] <= scrollTop) {
      index += 1;
    }
    return Math.max(0, index - BUFFER);
  }

  function findEndIndex(bottom: number): number {
    let index = 0;
    while (index < dayData.length && offsets[index] < bottom) {
      index += 1;
    }
    return Math.min(dayData.length, index + BUFFER);
  }

  function renderDayGroup(item: DayDataItem, index: number): string {
    const summaryBars = item.summaryBars.map((bar) =>
      '<div class="hbar-row">'
        + '<div class="hbar-type-label" style="color:' + bar.color + '">' + bar.label + "</div>"
        + '<div class="hbar-track-wrap"><div class="hbar-fill" style="width:' + bar.pct + '%;background:' + bar.color + '"></div></div>'
        + '<div class="hbar-value"><span class="hbar-tokens">' + bar.value + "</span></div>"
      + "</div>",
    ).join("");
    const detailBars = item.detailBars.map((bar) =>
      '<div class="hbar-row">'
        + '<div class="hbar-type-label" style="color:' + bar.color + '">' + bar.label + "</div>"
        + '<div class="hbar-track-wrap"><div class="hbar-fill" style="width:' + bar.pct + '%;background:' + bar.color + '"></div></div>'
        + '<div class="hbar-value"><span class="hbar-tokens">' + bar.value + "</span></div>"
      + "</div>",
    ).join("");
    const modelCount = item.models.length;
    let modelBarHtml = "";

    if (item.models.length > 0) {
      const modelTotal = item.models.reduce((sum, model) => sum + model.totalTokens, 0);
      if (modelTotal > 0) {
        const sortedModels = item.models.slice().sort((left, right) => right.totalTokens - left.totalTokens);
        const segments = sortedModels.map((model, colorIndex) => {
          const percentage = ((model.totalTokens / modelTotal) * 100).toFixed(1);
          return '<div class="model-bar-seg" style="width:' + percentage + '%;background:' + MODEL_COLORS[colorIndex % MODEL_COLORS.length] + '" title="' + escapeHtmlText(model.model) + ': ' + percentage + '%"></div>';
        }).join("");
        modelBarHtml = '<div class="hbar-row">'
          + '<div class="hbar-type-label" style="color:var(--accent2)">models</div>'
          + '<div class="model-bar-track">' + segments + "</div>"
          + '<div class="hbar-value"><span class="hbar-tokens">' + sortedModels.length + "</span></div>"
        + "</div>";
      }
    }

    return '<div class="day-group' + (expandedStates[index] ? ' expanded' : '') + '" data-index="' + index + '">'
      + '<div class="day-header"><span class="day-label">' + item.dayLabel + "</span></div>"
      + '<div class="day-meta"><span class="day-badge">' + item.totalTokensLabel + ' tokens</span><span class="day-badge">' + modelCount + ' model' + (modelCount !== 1 ? 's' : '') + '</span><span class="day-badge">' + item.duration + "</span></div>"
      + summaryBars
      + '<div class="day-details">' + detailBars + modelBarHtml + "</div>"
    + "</div>";
  }

  function measureRenderedHeights(): boolean {
    if (!viewport) {
      return false;
    }

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
    if (!scroll || !viewport || !spacerTop || !spacerBottom || dayData.length === 0) {
      return;
    }

    const viewHeight = scroll.clientHeight;
    if (viewHeight === 0) {
      return;
    }

    const scrollTop = scroll.scrollTop;
    const start = findStartIndex(scrollTop);
    const end = findEndIndex(scrollTop + viewHeight);

    spacerTop.style.height = offsets[start] + "px";
    spacerBottom.style.height = Math.max(0, totalHeight - offsets[end]) + "px";

    let html = "";
    for (let index = start; index < end; index += 1) {
      html += renderDayGroup(dayData[index], index);
    }
    viewport.innerHTML = html;

    if (measureRenderedHeights()) {
      scheduleRender();
    }
  }

  function scheduleRender(): void {
    if (renderPending) {
      return;
    }

    renderPending = true;
    requestAnimationFrame(() => {
      renderPending = false;
      renderVirtualList();
    });
  }

  function handleViewportClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const group = target.closest(".day-group");
    if (!(group instanceof HTMLElement)) {
      return;
    }

    const index = Number(group.getAttribute("data-index"));
    if (Number.isNaN(index)) {
      return;
    }

    expandedStates[index] = !expandedStates[index];
    group.classList.toggle("expanded", expandedStates[index]);

    const nextHeight = Math.ceil(group.getBoundingClientRect().height) + DAY_GROUP_GAP;
    if (nextHeight > 0 && itemHeights[index] !== nextHeight) {
      itemHeights[index] = nextHeight;
      recomputeOffsets();
    }

    scheduleRender();
  }

  recomputeOffsets();

  return {
    handleViewportClick,
    scheduleRender,
  };
}

export { createDailyListController };
export type { DailyListController };
