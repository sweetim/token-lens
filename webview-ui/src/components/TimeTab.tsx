import { useState, useMemo } from "preact/hooks";
import { formatTokensCompact } from "@/view-helpers";
import type { ChartConfig, ChartDayItem, DayDataItem, ModelPricing, PricingStateData } from "@shared/webview-contract";
import { DailyCardsView } from "@/components/DailyCardsView";
import { DailyGraphView } from "@/components/DailyGraphView";
import { DailyToolbar } from "@/components/DailyToolbar";

type Period = "daily" | "weekly" | "monthly";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

type MergeableModel = { model: string; openRouterModelId: string; totalTokens: number };

function mergeModels(items: { models: MergeableModel[] }[]): MergeableModel[] {
  const totals = new Map<string, { model: string; openRouterModelId: string; totalTokens: number }>();
  for (const item of items) {
    for (const model of item.models) {
      const existing = totals.get(model.openRouterModelId);
      if (existing) existing.totalTokens += model.totalTokens;
      else totals.set(model.openRouterModelId, { model: model.model, openRouterModelId: model.openRouterModelId, totalTokens: model.totalTokens });
    }
  }
  return [...totals.values()].sort((a, b) => b.totalTokens - a.totalTokens);
}

function getPeriodKey(day: string, period: Period): string {
  if (period === "daily") return day;
  if (period === "monthly") return day.slice(0, 7);
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

function getPeriodUnit(period: Period): string {
  return period === "daily" ? "Day" : period === "weekly" ? "Week" : "Month";
}

const TOKEN_TYPES = [
  { key: "inputTokens" as const, color: "#3794ff", label: "input" },
  { key: "outputTokens" as const, color: "#89d185", label: "output" },
  { key: "reasoningTokens" as const, color: "#b180d7", label: "reason" },
  { key: "cacheRead" as const, color: "#d18616", label: "cache r" },
  { key: "cacheWrite" as const, color: "#4ec9b0", label: "cache w" },
];

const SUMMARY_KEYS = new Set(["inputTokens", "outputTokens"]);

function computeBars(item: { inputTokens: number; outputTokens: number; reasoningTokens: number; cacheRead: number; cacheWrite: number }) {
  const dayMax = TOKEN_TYPES.reduce((max, tt) => Math.max(max, item[tt.key]), 0) || 1;
  return {
    summaryBars: TOKEN_TYPES.filter((tt) => SUMMARY_KEYS.has(tt.key)).map((tt) => ({
      label: tt.label,
      color: tt.color,
      pct: ((item[tt.key] / dayMax) * 100).toFixed(1),
      value: formatTokensCompact(item[tt.key]),
    })),
    detailBars: TOKEN_TYPES.filter((tt) => !SUMMARY_KEYS.has(tt.key)).map((tt) => ({
      label: tt.label,
      color: tt.color,
      pct: ((item[tt.key] / dayMax) * 100).toFixed(1),
      value: formatTokensCompact(item[tt.key]),
    })),
  };
}

function aggregateDayData(items: DayDataItem[], period: Period): DayDataItem[] {
  if (period === "daily") return items;
  const groups = new Map<string, DayDataItem[]>();
  for (const item of items) {
    const key = getPeriodKey(item.day, period);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  const result: DayDataItem[] = [];
  for (const [key, group] of groups) {
    const summed = sumNumericFields(group);
    const bars = computeBars(summed);
    result.push({
      day: key,
      dayLabel: formatPeriodLabel(key, period),
      ...summed,
      totalTokensLabel: formatTokensCompact(summed.totalTokens),
      duration: formatDurationFromMs(summed.durationMs),
      models: mergeModels(group),
      summaryBars: bars.summaryBars,
      detailBars: bars.detailBars,
    });
  }
  result.sort((a, b) => b.day.localeCompare(a.day));
  return result;
}

function aggregateChartData(items: ChartDayItem[], period: Period): ChartDayItem[] {
  if (period === "daily") return items;
  const groups = new Map<string, ChartDayItem[]>();
  for (const item of items) {
    const key = getPeriodKey(item.day, period);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
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

function formatDurationFromMs(ms: number): string {
  if (ms <= 0) return "0m";
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

type TimeTabProps = {
  dayData: DayDataItem[];
  chartData: ChartDayItem[];
  charts: ChartConfig[];
  modelPricing: ModelPricing;
  pricingState: PricingStateData;
  getSavedModels: () => string[];
};

function TimeTab({ dayData, chartData, charts, modelPricing, pricingState, getSavedModels }: TimeTabProps) {
  const [period, setPeriod] = useState<Period>("daily");
  const [activeView, setActiveView] = useState<"cards" | "graph">("cards");

  const aggregatedDayData = useMemo(() => aggregateDayData(dayData, period), [dayData, period]);
  const aggregatedChartData = useMemo(() => aggregateChartData(chartData, period), [chartData, period]);
  const periodUnit = getPeriodUnit(period);

  return (
    <div class="flex h-full min-h-0 flex-col">
      <DailyToolbar period={period} activeView={activeView} onPeriodChange={setPeriod} onViewChange={setActiveView} />
      {activeView === "cards" ? (
        <div class="min-h-0 flex-1" id="daily-view-cards">
          <DailyCardsView dayData={aggregatedDayData} modelPricing={modelPricing} pricingState={pricingState} getSavedModels={getSavedModels} />
        </div>
      ) : (
        <div class="min-h-0 flex-1 overflow-y-auto px-2.5 pt-2.5 pb-5" id="daily-view-graph">
          <DailyGraphView chartData={aggregatedChartData} charts={charts} periodUnit={periodUnit} />
        </div>
      )}
    </div>
  );
}

export { TimeTab };
