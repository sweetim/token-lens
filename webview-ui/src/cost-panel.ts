import { computeModelCostEstimates } from "../../src/webview-model-cost.js";
import type { CostFilterState, TokenBreakdown, WebviewData } from "../../src/webview-contract.js";
import { escapeHtmlText } from "./view-helpers.js";

type CostPanelController = {
  initialize(): void;
};

type CostPanelControllerParams = {
  data: WebviewData;
  getCostFilterState(): CostFilterState;
  getSavedModels(): string[];
  setCostFilterState(costFilterState: CostFilterState): void;
  setSavedModels(savedModels: string[]): void;
};

function createCostPanelController({
  data,
  getCostFilterState,
  getSavedModels,
  setCostFilterState,
  setSavedModels,
}: CostPanelControllerParams): CostPanelController {
  const initialCostFilterState = getCostFilterState();
  const activeProviders = new Set<string>(initialCostFilterState.providers);
  let ageFilterActive = initialCostFilterState.ageFilter;
  let currentSortOrder: "asc" | "desc" = initialCostFilterState.sort;
  let filtersCollapsed = initialCostFilterState.collapsed;
  let activeInfoTooltipTrigger: HTMLElement | null = null;
  let infoTooltipElement: HTMLDivElement | null = null;

  function getInfoTooltipElement(): HTMLDivElement {
    if (infoTooltipElement) {
      return infoTooltipElement;
    }

    infoTooltipElement = document.createElement("div");
    infoTooltipElement.className = "model-cost-info-tooltip-overlay";
    document.body.appendChild(infoTooltipElement);
    return infoTooltipElement;
  }

  function hideInfoTooltip(): void {
    activeInfoTooltipTrigger = null;
    if (!infoTooltipElement) {
      return;
    }

    infoTooltipElement.classList.remove("visible");
    infoTooltipElement.textContent = "";
  }

  function showInfoTooltip(trigger: HTMLElement): void {
    const tooltipText = trigger.dataset.infoTooltipText?.trim();
    if (!tooltipText) {
      hideInfoTooltip();
      return;
    }

    const tooltipElement = getInfoTooltipElement();
    activeInfoTooltipTrigger = trigger;
    tooltipElement.textContent = tooltipText;
    tooltipElement.classList.remove("visible");
    tooltipElement.style.left = "12px";
    tooltipElement.style.top = "12px";

    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const viewportMargin = 12;
    const tooltipGap = 8;
    let left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
    let top = triggerRect.bottom + tooltipGap;

    left = Math.max(viewportMargin, Math.min(left, viewportWidth - tooltipRect.width - viewportMargin));

    if (top + tooltipRect.height > viewportHeight - viewportMargin) {
      top = Math.max(viewportMargin, triggerRect.top - tooltipRect.height - tooltipGap);
    }

    tooltipElement.style.left = `${Math.round(left)}px`;
    tooltipElement.style.top = `${Math.round(top)}px`;
    tooltipElement.classList.add("visible");
  }

  function saveCurrentCostFilterState(): void {
    setCostFilterState({
      providers: [...activeProviders],
      sort: currentSortOrder,
      ageFilter: ageFilterActive,
      collapsed: filtersCollapsed,
    });
  }

  function setCostFilterCollapsed(collapsed: boolean): void {
    filtersCollapsed = collapsed;
    const toggle = document.querySelector<HTMLElement>("[data-cost-filter-toggle]");
    const body = document.querySelector<HTMLElement>("[data-cost-filter-body]");
    if (toggle) {
      toggle.classList.toggle("collapsed", collapsed);
      toggle.setAttribute("aria-expanded", String(!collapsed));
    }
    if (body) {
      body.classList.toggle("hidden", collapsed);
    }
  }

  function applyCostFilters(): void {
    const showAllProviders = activeProviders.size === 0;
    const list = document.getElementById("cost-model-list");
    const threeMonthsAgo = list ? Number(list.dataset.threeMonthsAgo) || 0 : 0;

    document.querySelectorAll<HTMLElement>("#cost-model-list .model-cost-row").forEach((row) => {
      const providerMatches = showAllProviders || activeProviders.has(row.dataset.provider ?? "");
      const ageMatches = !ageFilterActive || (Number(row.dataset.created) || 0) >= threeMonthsAgo;
      row.style.display = providerMatches && ageMatches ? "" : "none";
    });
  }

  function applyCostSort(order: "asc" | "desc"): void {
    currentSortOrder = order;

    document.querySelectorAll(".cost-sort-button").forEach((button) => button.classList.remove("active"));
    document.querySelector(`.cost-sort-button[data-cost-sort="${order}"]`)?.classList.add("active");

    const list = document.getElementById("cost-model-list");
    if (!list) {
      return;
    }

    const header = list.querySelector(".model-cost-header");
    const rows = Array.from(list.querySelectorAll<HTMLElement>(".model-cost-row"));
    rows.sort((left, right) => {
      const leftCost = Number(left.dataset.cost) || 0;
      const rightCost = Number(right.dataset.cost) || 0;
      return order === "asc" ? leftCost - rightCost : rightCost - leftCost;
    });

    for (const row of rows) {
      list.appendChild(row);
    }
    if (header) {
      list.insertBefore(header, list.firstChild);
    }
  }

  function restoreCostFilterState(): void {
    document.querySelectorAll<HTMLElement>(".cost-provider-filter").forEach((button) => {
      const provider = button.dataset.costProvider ?? "all";
      const isActive = provider === "all"
        ? activeProviders.size === 0
        : activeProviders.has(provider);
      button.classList.toggle("active", isActive);
    });

    const ageToggle = document.querySelector<HTMLElement>("[data-cost-age-toggle]");
    if (ageToggle) {
      ageToggle.classList.toggle("active", ageFilterActive);
    }

    setCostFilterCollapsed(filtersCollapsed);
    applyCostSort(currentSortOrder);
    applyCostFilters();
  }

  function computeModelCostRows(modelIds: string[], tokens: TokenBreakdown): string {
    const computed = computeModelCostEstimates(modelIds, data.modelPricing, tokens);
    return computed.map(({ modelId, cost }) =>
      '<div class="model-cost-row"><span class="model-cost-id">' + escapeHtmlText(modelId) + '</span><span class="model-cost-value">$' + cost.toFixed(2) + "</span></div>",
    ).join("");
  }

  function renderProjectModelCosts(): void {
    const savedModels = getSavedModels();

    document.querySelectorAll<HTMLElement>(".model-cost-list[data-project]").forEach((list) => {
      const project = list.dataset.project;
      if (!project) {
        return;
      }

      const tokens = data.projectTokenBreakdowns[project];
      if (!tokens) {
        return;
      }

      const modelIds = savedModels.length > 0 ? savedModels : (data.projectModelIds[project] ?? []);
      const rowsHtml = computeModelCostRows(modelIds, tokens);
      list.querySelectorAll(".model-cost-row").forEach((row) => row.remove());
      const header = list.querySelector(".model-cost-header");
      if (header) {
        header.insertAdjacentHTML("afterend", rowsHtml);
      }
    });
  }

  function applySavedModelState(): void {
    const savedModels = new Set(getSavedModels());
    document.querySelectorAll<HTMLElement>("#cost-model-list .model-cost-row").forEach((row) => {
      const modelId = row.dataset.modelId ?? "";
      row.classList.toggle("saved", savedModels.has(modelId));
    });
  }

  function initialize(): void {
    document.querySelectorAll<HTMLElement>("[data-info-tooltip-text]").forEach((trigger) => {
      trigger.addEventListener("mouseenter", () => {
        showInfoTooltip(trigger);
      });
      trigger.addEventListener("focus", () => {
        showInfoTooltip(trigger);
      });
      trigger.addEventListener("mouseleave", hideInfoTooltip);
      trigger.addEventListener("blur", hideInfoTooltip);
    });

    document.addEventListener("scroll", () => {
      if (activeInfoTooltipTrigger) {
        hideInfoTooltip();
      }
    }, true);
    window.addEventListener("resize", () => {
      if (activeInfoTooltipTrigger) {
        hideInfoTooltip();
      }
    });

    const costFilterToggle = document.querySelector<HTMLElement>("[data-cost-filter-toggle]");
    if (costFilterToggle) {
      costFilterToggle.addEventListener("click", () => {
        setCostFilterCollapsed(!filtersCollapsed);
        saveCurrentCostFilterState();
      });
    }

    document.querySelectorAll<HTMLElement>(".cost-provider-filter").forEach((button) => {
      button.addEventListener("click", () => {
        const provider = button.dataset.costProvider ?? "all";

        if (provider === "all") {
          activeProviders.clear();
          document.querySelectorAll(".cost-provider-filter").forEach((currentButton) => currentButton.classList.remove("active"));
          button.classList.add("active");
        } else {
          document.querySelector('.cost-provider-filter[data-cost-provider="all"]')?.classList.remove("active");
          if (activeProviders.has(provider)) {
            activeProviders.delete(provider);
            button.classList.remove("active");
          } else {
            activeProviders.add(provider);
            button.classList.add("active");
          }
          if (activeProviders.size === 0) {
            document.querySelector('.cost-provider-filter[data-cost-provider="all"]')?.classList.add("active");
          }
        }

        applyCostFilters();
        saveCurrentCostFilterState();
      });
    });

    const ageToggle = document.querySelector<HTMLElement>("[data-cost-age-toggle]");
    if (ageToggle) {
      ageToggle.addEventListener("click", () => {
        ageFilterActive = !ageFilterActive;
        ageToggle.classList.toggle("active", ageFilterActive);
        applyCostFilters();
        saveCurrentCostFilterState();
      });
    }

    document.querySelectorAll<HTMLElement>(".cost-sort-button").forEach((button) => {
      button.addEventListener("click", () => {
        const order = button.dataset.costSort === "desc" ? "desc" : "asc";
        applyCostSort(order);
        applyCostFilters();
        saveCurrentCostFilterState();
      });
    });

    const costModelList = document.getElementById("cost-model-list");
    if (costModelList) {
      costModelList.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        const row = target.closest("#cost-model-list .model-cost-row");
        if (!(row instanceof HTMLElement)) {
          return;
        }

        const modelId = row.dataset.modelId;
        if (!modelId) {
          return;
        }

        const savedModels = getSavedModels();
        const savedIndex = savedModels.indexOf(modelId);
        if (savedIndex >= 0) {
          savedModels.splice(savedIndex, 1);
        } else {
          savedModels.push(modelId);
        }

        setSavedModels(savedModels);
        applySavedModelState();
        renderProjectModelCosts();
      });
    }

    restoreCostFilterState();
    applySavedModelState();
    renderProjectModelCosts();
  }

  return { initialize };
}

export { createCostPanelController };
export type { CostPanelController };
