import { DEFAULT_COST_FILTER_STATE, WEBVIEW_DATA_ELEMENT_ID } from "../../src/webview-contract.js";
import type { CostFilterState, WebviewData, WebviewPersistedState } from "../../src/webview-contract.js";

type VsCodeApi<State> = {
  getState(): State | undefined;
  postMessage(message: unknown): void;
  setState(newState: State): State;
};

declare function acquireVsCodeApi<State>(): VsCodeApi<State>;

const vscodeApi = typeof acquireVsCodeApi === "function"
  ? acquireVsCodeApi<WebviewPersistedState>()
  : undefined;

function normalizeCostFilterState(costFilterState: Partial<CostFilterState> | undefined): CostFilterState {
  return {
    providers: Array.isArray(costFilterState?.providers) ? [...costFilterState.providers] : [...DEFAULT_COST_FILTER_STATE.providers],
    sort: costFilterState?.sort === "desc" ? "desc" : DEFAULT_COST_FILTER_STATE.sort,
    ageFilter: !!costFilterState?.ageFilter,
    collapsed: !!costFilterState?.collapsed,
  };
}

function normalizePersistedState(state: Partial<WebviewPersistedState> | undefined): WebviewPersistedState {
  return {
    costFilters: normalizeCostFilterState(state?.costFilters),
    savedModels: Array.isArray(state?.savedModels) ? [...state.savedModels] : [],
  };
}

let persistedState = normalizePersistedState(vscodeApi?.getState());

function savePersistedState(nextState: WebviewPersistedState): void {
  persistedState = normalizePersistedState(nextState);
  vscodeApi?.setState(persistedState);
}

function readWebviewData(): WebviewData {
  const dataElement = document.getElementById(WEBVIEW_DATA_ELEMENT_ID);
  if (!(dataElement instanceof HTMLScriptElement)) {
    throw new Error("Missing webview data payload.");
  }

  return JSON.parse(dataElement.textContent ?? "{}") as WebviewData;
}

function getCostFilterState(): CostFilterState {
  return normalizeCostFilterState(persistedState.costFilters);
}

function setCostFilterState(costFilters: CostFilterState): void {
  savePersistedState({
    ...persistedState,
    costFilters: normalizeCostFilterState(costFilters),
  });
}

function getSavedModels(): string[] {
  return [...persistedState.savedModels];
}

function setSavedModels(savedModels: string[]): void {
  savePersistedState({
    ...persistedState,
    savedModels: [...savedModels],
  });
}

export {
  getCostFilterState,
  getSavedModels,
  readWebviewData,
  setCostFilterState,
  setSavedModels,
};
