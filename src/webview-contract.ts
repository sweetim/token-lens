type DayModelUsage = {
  model: string;
  totalTokens: number;
};

type TokenBar = {
  label: string;
  color: string;
  pct: string;
  value: string;
};

type DayDataItem = {
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
  models: DayModelUsage[];
  summaryBars: TokenBar[];
  detailBars: TokenBar[];
};

type ChartValueKey =
  | "totalTokens"
  | "inputTokens"
  | "outputTokens"
  | "reasoningTokens"
  | "cacheRead"
  | "cacheWrite"
  | "sessions"
  | "steps";

type ChartSeries = {
  key: ChartValueKey;
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
  models: DayModelUsage[];
};

type TokenBreakdown = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheRead: number;
};

type ModelPricingEntry = {
  prompt: number;
  completion: number;
  cacheRead: number;
};

type ModelPricing = Record<string, ModelPricingEntry>;

type WebviewData = {
  dayData: DayDataItem[];
  dailyCharts: ChartConfig[];
  projectCharts: ChartConfig[];
  dailyChartIds: string[];
  dailyChartData: ChartDayItem[];
  projectChartDataSets: Record<string, ChartDayItem[]>;
  defaultTab: "projects" | "daily";
  modelPricing: ModelPricing;
  projectTokenBreakdowns: Record<string, TokenBreakdown>;
  projectModelIds: Record<string, string[]>;
};

type CostFilterState = {
  providers: string[];
  sort: "asc" | "desc";
  ageFilter: boolean;
  collapsed: boolean;
};

type WebviewPersistedState = {
  costFilters: CostFilterState;
  savedModels: string[];
};

const DEFAULT_COST_FILTER_STATE: CostFilterState = {
  providers: [],
  sort: "asc",
  ageFilter: false,
  collapsed: false,
};

const WEBVIEW_DATA_ELEMENT_ID = "token-lens-data";

export {
  DEFAULT_COST_FILTER_STATE,
  WEBVIEW_DATA_ELEMENT_ID,
};
export type {
  ChartConfig,
  ChartDayItem,
  ChartSeries,
  ChartValueKey,
  CostFilterState,
  DayDataItem,
  DayModelUsage,
  ModelPricing,
  ModelPricingEntry,
  TokenBar,
  TokenBreakdown,
  WebviewData,
  WebviewPersistedState,
};
