import type { ChartConfig, ChartDayItem } from "../../../src/webview-contract.js";
import { formatTokensCompact } from "../view-helpers.js";
import { LineChart, PieChart } from "./Chart.js";

type DailyGraphViewProps = {
  chartData: ChartDayItem[];
  charts: ChartConfig[];
  periodUnit: string;
};

function DailyGraphStats({ chartData, periodUnit }: { chartData: ChartDayItem[]; periodUnit: string }) {
  const latest = chartData[0] ?? null;
  const peak = chartData.reduce<ChartDayItem | null>((best, day) => {
    if (!best || day.totalTokens > best.totalTokens) {
      return day;
    }
    return best;
  }, null);
  const average = chartData.length > 0 ? Math.round(chartData.reduce((sum, day) => sum + day.totalTokens, 0) / chartData.length) : 0;

  return (
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
  );
}

function DailyGraphView({ chartData, charts, periodUnit }: DailyGraphViewProps) {
  return (
    <div class="daily-graph-panel">
      <DailyGraphStats chartData={chartData} periodUnit={periodUnit} />
      {charts.map((chart) => (
        <LineChart key={chart.id} config={chart} days={chartData} />
      ))}
      <PieChart days={chartData} periodUnit={periodUnit} />
    </div>
  );
}

export { DailyGraphView };
