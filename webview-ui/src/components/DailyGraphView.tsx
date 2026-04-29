import type { ChartConfig, ChartDayItem } from "@shared/webview-contract";
import { formatTokensCompact } from "@/view-helpers";
import { LineChart, PieChart } from "@/components/Chart";

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
    <div class="mb-3 grid grid-cols-3 gap-2">
      <div class="flex flex-col gap-0.5">
        <span class="text-sm font-bold tabular-nums">{formatTokensCompact(latest?.totalTokens ?? 0)}</span>
        <span class="text-[9px] uppercase tracking-[.5px] text-(--muted)">Latest {periodUnit}</span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-sm font-bold tabular-nums">{formatTokensCompact(average)}</span>
        <span class="text-[9px] uppercase tracking-[.5px] text-(--muted)">Average / {periodUnit}</span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-sm font-bold tabular-nums">{formatTokensCompact(peak?.totalTokens ?? 0)}</span>
        <span class="text-[9px] uppercase tracking-[.5px] text-(--muted)">Peak ({peak?.dayLabel ?? ""})</span>
      </div>
    </div>
  );
}

function DailyGraphView({ chartData, charts, periodUnit }: DailyGraphViewProps) {
  return (
    <div class="rounded-md border border-(--border) bg-(--card-bg) p-3">
      <DailyGraphStats chartData={chartData} periodUnit={periodUnit} />
      {charts.map((chart, index) => (
        <LineChart key={chart.id} config={chart} days={chartData} separated={index > 0} />
      ))}
      <PieChart days={chartData} periodUnit={periodUnit} separated={charts.length > 0} />
    </div>
  );
}

export { DailyGraphView };
