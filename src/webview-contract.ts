type DayModelUsage = {
  model: string;
  openRouterModelId: string;
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
  durationMs: number;
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
  durationMs: number;
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

type QuotaSummaryData = {
  usedPercentage: number;
  remainingPercentage: number;
  nextResetTime: number;
};

type QuotaStateData = {
  status: string;
  message: string;
  summary: QuotaSummaryData | null;
};

type PricingStatus = "loading" | "ready" | "cached" | "unavailable";

type PricingStateData = {
  status: PricingStatus;
  message: string;
};

type HeroStatsData = {
  todayTokens: number;
  totalTokens: number;
  totalCost: number;
  totalSessions: number;
};

type ProjectCardData = {
  project: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheRead: number;
  cacheWrite: number;
  totalCost: number;
  sessions: number;
  steps: number;
  duration: number;
  models: DayModelUsage[];
};

type CostEntryData = {
  modelId: string;
  cost: number;
  provider: string;
  created: number;
};

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
  quotaState: QuotaStateData;
  pricingState: PricingStateData;
  hero: HeroStatsData;
  projects: ProjectCardData[];
  grandTokens: TokenBreakdown;
  costEntries: CostEntryData[];
  providers: string[];
  threeMonthsAgo: number;
  hasData: boolean;
  hasDays: boolean;
  hasProjects: boolean;
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

type SettingsData = {
  hasApiKey: boolean;
  refreshIntervalMinutes: number;
  databasePath: string;
};

type WebviewInboundMessage = {
  type: "fullUpdate";
  data: WebviewData;
} | {
  type: "showSettings";
} | {
  type: "settingsData";
  data: SettingsData;
};

type WebviewOutboundMessage = {
  type: "ready";
} | {
  type: "requestSettings";
} | {
  type: "saveApiKey";
  apiKey: string;
} | {
  type: "saveRefreshInterval";
  minutes: number;
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
  CostEntryData,
  CostFilterState,
  DayDataItem,
  DayModelUsage,
  HeroStatsData,
  ModelPricing,
  ModelPricingEntry,
  PricingStateData,
  PricingStatus,
  ProjectCardData,
  QuotaStateData,
  QuotaSummaryData,
  SettingsData,
  TokenBar,
  TokenBreakdown,
  WebviewData,
  WebviewInboundMessage,
  WebviewOutboundMessage,
  WebviewPersistedState,
};
