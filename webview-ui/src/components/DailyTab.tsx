import { useState, useMemo, useCallback, useRef, useEffect } from "preact/hooks";
import { computeModelCostEstimates } from "../../../src/webview-model-cost.js";
import { MODEL_COLORS } from "../constants.js";
import { formatTokensCompact } from "../view-helpers.js";
import { LineChart, PieChart } from "./Chart.js";
import type { ChartConfig, ChartDayItem, DayDataItem, ModelPricing, TokenBreakdown } from "../../../src/webview-contract.js";

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

function mergeModels(items: { models: { model: string; totalTokens: number }[] }[]): { model: string; totalTokens: number }[] {
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

const DAY_HEIGHT_ESTIMATE = 96;
const DAY_GROUP_GAP = 8;
const BUFFER = 4;

type DailyTabProps = {
  dayData: DayDataItem[];
  chartData: ChartDayItem[];
  charts: ChartConfig[];
  modelPricing: ModelPricing;
  getSavedModels: () => string[];
  isDefaultTab: boolean;
};

function DayCard({
  item,
  index,
  expanded,
  onToggle,
  modelPricing,
  getSavedModels,
}: {
  item: DayDataItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  modelPricing: ModelPricing;
  getSavedModels: () => string[];
}) {
  const savedModels = getSavedModels();
  const modelCostIds = savedModels.length > 0
    ? savedModels
    : (() => {
        const ids = new Set<string>();
        for (const m of item.models) {
          const id = m.model.replace(/:.*$/, "");
          if (modelPricing[id]) ids.add(id);
        }
        return [...ids];
      })();

  const modelCosts = computeModelCostEstimates(modelCostIds, modelPricing, {
    inputTokens: item.inputTokens,
    outputTokens: item.outputTokens,
    reasoningTokens: item.reasoningTokens,
    cacheRead: item.cacheRead,
  });

  let modelBar: preact.JSX.Element | null = null;
  if (item.models.length > 0) {
    const modelTotal = item.models.reduce((sum: number, m: { totalTokens: number }) => sum + m.totalTokens, 0);
    if (modelTotal > 0) {
      const sorted = item.models.slice().sort((a: { totalTokens: number }, b: { totalTokens: number }) => b.totalTokens - a.totalTokens);
      const segments = sorted.map((model: { model: string; totalTokens: number }, ci: number) => {
        const pct = ((model.totalTokens / modelTotal) * 100).toFixed(1);
        return <div key={model.model} class="model-bar-seg" style={{ width: pct + "%", background: MODEL_COLORS[ci % MODEL_COLORS.length] }} title={`${model.model}: ${pct}%`} />;
      });
      modelBar = (
        <div class="hbar-row">
          <div class="hbar-type-label" style={{ color: "var(--accent2)" }}>models</div>
          <div class="model-bar-track">{segments}</div>
          <div class="hbar-value"><span class="hbar-tokens">{sorted.length}</span></div>
        </div>
      );
    }
  }

  const modelCostHtml = modelCosts.length > 0 ? (
    <div class="model-cost-list">
      <div class="model-cost-header">Model Cost Comparison</div>
      {modelCosts.map(({ modelId, cost }) => (
        <div key={modelId} class="model-cost-row">
          <span class="model-cost-id">{modelId}</span>
          <span class="model-cost-value">${cost.toFixed(2)}</span>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div class={`day-group${expanded ? " expanded" : ""}`} data-index={index} onClick={onToggle}>
      <div class="day-header"><span class="day-label">{item.dayLabel}</span></div>
      <div class="day-meta">
        <span class="day-badge">{item.totalTokensLabel} tokens</span>
        <span class="day-badge">{item.models.length} model{item.models.length !== 1 ? "s" : ""}</span>
        <span class="day-badge">{item.duration}</span>
      </div>
      {item.summaryBars.map((bar) => (
        <div key={bar.label} class="hbar-row">
          <div class="hbar-type-label" style={{ color: bar.color }}>{bar.label}</div>
          <div class="hbar-track-wrap"><div class="hbar-fill" style={{ width: bar.pct + "%", background: bar.color }} /></div>
          <div class="hbar-value"><span class="hbar-tokens">{bar.value}</span></div>
        </div>
      ))}
      <div class="day-details">
        {item.detailBars.map((bar) => (
          <div key={bar.label} class="hbar-row">
            <div class="hbar-type-label" style={{ color: bar.color }}>{bar.label}</div>
            <div class="hbar-track-wrap"><div class="hbar-fill" style={{ width: bar.pct + "%", background: bar.color }} /></div>
            <div class="hbar-value"><span class="hbar-tokens">{bar.value}</span></div>
          </div>
        ))}
        {modelBar}
        {modelCostHtml}
      </div>
    </div>
  );
}

function DailyCardsView({
  dayData,
  modelPricing,
  getSavedModels,
}: {
  dayData: DayDataItem[];
  modelPricing: ModelPricing;
  getSavedModels: () => string[];
}) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemHeights = useRef<number[]>(dayData.map(() => DAY_HEIGHT_ESTIMATE + DAY_GROUP_GAP));
  const renderPending = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const offsets = useMemo(() => {
    const o = new Array(dayData.length + 1).fill(0) as number[];
    for (let i = 0; i < dayData.length; i++) {
      o[i + 1] = o[i] + itemHeights.current[i];
    }
    return o;
  }, [dayData.length, scrollTop]);

  const totalHeight = offsets[dayData.length] || 0;
  const viewHeight = scrollRef.current?.clientHeight ?? 0;

  let start = 0;
  while (start < dayData.length && offsets[start + 1] <= scrollTop) start++;
  start = Math.max(0, start - BUFFER);

  let end = 0;
  while (end < dayData.length && offsets[end] < scrollTop + viewHeight) end++;
  end = Math.min(dayData.length, end + BUFFER);

  const scheduleMeasure = useCallback(() => {
    if (renderPending.current) return;
    renderPending.current = true;
    requestAnimationFrame(() => {
      renderPending.current = false;
      const viewport = viewportRef.current;
      if (!viewport) return;
      let changed = false;
      viewport.querySelectorAll(".day-group").forEach((el) => {
        const idx = Number((el as HTMLElement).dataset.index);
        const h = Math.ceil(el.getBoundingClientRect().height) + DAY_GROUP_GAP;
        if (!Number.isNaN(idx) && h > 0 && itemHeights.current[idx] !== h) {
          itemHeights.current[idx] = h;
          changed = true;
        }
      });
      if (changed) setScrollTop((v) => v);
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      setScrollTop(el.scrollTop);
      scheduleMeasure();
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [scheduleMeasure]);

  useEffect(() => {
    scheduleMeasure();
  }, [scheduleMeasure]);

  const toggleDay = useCallback((index: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    setTimeout(scheduleMeasure, 0);
  }, [scheduleMeasure]);

  return (
    <div class="vlist-scroll" ref={scrollRef}>
      <div class="vlist-spacer" style={{ height: offsets[start] + "px" }} />
      <div ref={viewportRef}>
        {dayData.slice(start, end).map((item: DayDataItem, i: number) => {
          const idx = start + i;
          return (
            <DayCard
              key={item.day}
              item={item}
              index={idx}
              expanded={expandedDays.has(idx)}
              onToggle={() => toggleDay(idx)}
              modelPricing={modelPricing}
              getSavedModels={getSavedModels}
            />
          );
        })}
      </div>
      <div class="vlist-spacer" style={{ height: Math.max(0, totalHeight - offsets[end]) + "px" }} />
    </div>
  );
}

function DailyGraphView({
  chartData,
  charts,
  period,
}: {
  chartData: ChartDayItem[];
  charts: ChartConfig[];
  period: Period;
}) {
  const periodUnit = getPeriodUnit(period);
  const reversed = useMemo(() => chartData.slice().reverse(), [chartData]);
  const latest = reversed[reversed.length - 1];
  const peak = reversed.reduce((best: ChartDayItem, d: ChartDayItem) => d.totalTokens > best.totalTokens ? d : best, reversed[0]);
  const average = Math.round(reversed.reduce((s: number, d: ChartDayItem) => s + d.totalTokens, 0) / reversed.length);

  return (
    <div class="daily-graph-panel">
      <div class="daily-graph-stats">
        <div class="daily-graph-stat">
          <span class="daily-graph-stat-value">{formatTokensCompact(latest?.totalTokens ?? 0)}</span>
          <span class="daily-graph-stat-label">Latest {periodUnit}</span>
        </div>
        <div class="daily-graph-stat">
          <span class="daily-graph-stat-value">{formatTokensCompact(average)}</span>
          <span class="daily-graph-stat-label">Average / {periodUnit}</span>
        </div>
        <div class="daily-graph-stat">
          <span class="daily-graph-stat-value">{formatTokensCompact(peak?.totalTokens ?? 0)}</span>
          <span class="daily-graph-stat-label">Peak ({peak?.dayLabel ?? ""})</span>
        </div>
      </div>
      {charts.map((chart: ChartConfig) => (
        <LineChart key={chart.id} config={chart} days={chartData} />
      ))}
      <PieChart days={chartData} periodUnit={periodUnit} />
    </div>
  );
}

function DailyTab({ dayData, chartData, charts, modelPricing, getSavedModels, isDefaultTab }: DailyTabProps) {
  const [period, setPeriod] = useState<Period>("daily");
  const [activeView, setActiveView] = useState<"cards" | "graph">("cards");

  const aggregatedDayData = useMemo(() => aggregateDayData(dayData, period), [dayData, period]);
  const aggregatedChartData = useMemo(() => aggregateChartData(chartData, period), [chartData, period]);

  return (
    <div class="daily-layout">
      <div class="daily-toolbar">
        <div class="period-toggle" role="tablist" aria-label="Time period">
          {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
            <button
              key={p}
              class={`period-toggle-button${period === p ? " active" : ""}`}
              type="button"
              onClick={() => setPeriod(p)}
            >{p.charAt(0).toUpperCase() + p.slice(1)}</button>
          ))}
        </div>
        <div class="view-toggle" role="tablist" aria-label="Daily view mode">
          <button
            class={`view-toggle-button${activeView === "cards" ? " active" : ""}`}
            type="button"
            aria-label="Cards"
            onClick={() => setActiveView("cards")}
          >
            <svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" /><rect x="9.5" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" /><rect x="1" y="9.5" width="5.5" height="5.5" rx="1" fill="currentColor" /><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" fill="currentColor" /></svg>
          </button>
          <button
            class={`view-toggle-button${activeView === "graph" ? " active" : ""}`}
            type="button"
            aria-label="Graph"
            onClick={() => setActiveView("graph")}
          >
            <svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 14L5.5 8L8.5 10.5L14 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        </div>
      </div>
      {activeView === "cards" ? (
        <div class="daily-view active" id="daily-view-cards">
          <DailyCardsView dayData={aggregatedDayData} modelPricing={modelPricing} getSavedModels={getSavedModels} />
        </div>
      ) : (
        <div class="daily-view daily-graph-view active" id="daily-view-graph">
          <DailyGraphView chartData={aggregatedChartData} charts={charts} period={period} />
        </div>
      )}
    </div>
  );
}

export { DailyTab };
