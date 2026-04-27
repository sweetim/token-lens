import { useState, useCallback, useMemo, useRef } from "preact/hooks";
import { Fragment } from "preact";
import type { ChartConfig, ChartDayItem, ChartSeries } from "../../../src/webview-contract.js";
import { MODEL_COLORS } from "../constants.js";
import { formatTokensCompact } from "../view-helpers.js";

const CHART_WIDTH = 720;
const CHART_HEIGHT = 240;
const CHART_PADDING_TOP = 16;
const CHART_PADDING_RIGHT = 12;
const CHART_PADDING_BOTTOM = 34;
const CHART_PADDING_LEFT = 44;
const CHART_DRAWABLE_WIDTH = CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
const CHART_DRAWABLE_HEIGHT = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

type TooltipState = {
  clientX: number;
  clientY: number;
  dayIndex: number;
};

type TooltipSetter = (tooltip: TooltipState | null | ((previous: TooltipState | null) => TooltipState | null)) => void;

function formatChartValue(valueFormat: string, value: number): string {
  return valueFormat === "tokens" ? formatTokensCompact(value) : String(value);
}

function getLabelIndexes(length: number): number[] {
  if (length <= 6) {
    return Array.from({ length }, (_, index) => index);
  }

  return Array.from(new Set([
    0,
    Math.round((length - 1) * 0.25),
    Math.round((length - 1) * 0.5),
    Math.round((length - 1) * 0.75),
    length - 1,
  ])).sort((left, right) => left - right);
}

function ChartLegend({
  series,
  hiddenSeries,
  onToggleSeries,
  interactive = true,
}: {
  series: ChartSeries[];
  hiddenSeries: Set<string>;
  onToggleSeries: (key: string) => void;
  interactive?: boolean;
}) {
  return (
    <div class="daily-chart-legend">
      {series.map((seriesItem) => {
        const isHidden = interactive && hiddenSeries.has(seriesItem.key);
        return (
          <button
            key={seriesItem.key}
            class={`daily-chart-legend-item${isHidden ? " is-hidden" : ""}${series.length === 1 ? " is-static" : ""}`}
            type="button"
            aria-pressed={!isHidden}
            disabled={series.length === 1}
            onClick={interactive ? () => onToggleSeries(seriesItem.key) : undefined}
          >
            <span class="daily-chart-legend-swatch" style={{ background: seriesItem.color }} />
            <span class="daily-chart-legend-label">{seriesItem.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ChartHeader({
  title,
  hideTitle,
  series,
  hiddenSeries,
  onToggleSeries,
  interactive,
}: {
  title: string;
  hideTitle?: boolean;
  series: ChartSeries[];
  hiddenSeries: Set<string>;
  onToggleSeries: (key: string) => void;
  interactive?: boolean;
}) {
  return (
    <div class="daily-chart-header">
      {hideTitle ? null : <div class="daily-chart-title">{title}</div>}
      <ChartLegend series={series} hiddenSeries={hiddenSeries} onToggleSeries={onToggleSeries} interactive={interactive} />
    </div>
  );
}

function ChartTooltip({
  tooltip,
  tooltipDay,
  tooltipRows,
}: {
  tooltip: { left: number; top: number } | null;
  tooltipDay: ChartDayItem | null;
  tooltipRows: string[][];
}) {
  if (!tooltip || !tooltipDay) {
    return null;
  }

  return (
    <div class="daily-chart-tooltip" style={{ left: tooltip.left, top: tooltip.top }}>
      <div class="daily-chart-tooltip-day">{tooltipDay.dayLabel}</div>
      <div class="daily-chart-tooltip-grid">
        {tooltipRows.map((row) => (
          <Fragment key={row[0]}>
            <div class="daily-chart-tooltip-label">{row[0]}</div>
            <div class="daily-chart-tooltip-value">{row[1]}</div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function LineChartPlot({
  config,
  reversed,
  visibleSeries,
  axisPoints,
  maxValue,
  guideValues,
  labelIndexes,
  setTooltip,
}: {
  config: ChartConfig;
  reversed: ChartDayItem[];
  visibleSeries: ChartSeries[];
  axisPoints: { x: number }[];
  maxValue: number;
  guideValues: number[];
  labelIndexes: number[];
  setTooltip: TooltipSetter;
}) {
  const defs = config.fillArea && visibleSeries.length > 0
    ? <defs><linearGradient id={`${config.id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={`stop-color:${visibleSeries[0].color}; stop-opacity: 0.24;`} /><stop offset="100%" style={`stop-color:${visibleSeries[0].color}; stop-opacity: 0;`} /></linearGradient></defs>
    : null;

  return (
    <svg class="daily-chart" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label={`${config.title} chart`}>
      {defs}
      {guideValues.map((value) => {
        const y = CHART_PADDING_TOP + CHART_DRAWABLE_HEIGHT - (value / maxValue) * CHART_DRAWABLE_HEIGHT;
        return (
          <g key={value}>
            <line class="daily-chart-guide" x1={CHART_PADDING_LEFT} y1={y} x2={CHART_WIDTH - CHART_PADDING_RIGHT} y2={y} />
            <text class="daily-chart-guide-label" x={CHART_PADDING_LEFT - 8} y={y + 3} text-anchor="end">{formatChartValue(config.valueFormat, value)}</text>
          </g>
        );
      })}
      {visibleSeries.map((series, seriesIndex) => {
        const points = reversed.map((day, dayIndex) => ({
          dayIndex,
          x: axisPoints[dayIndex].x,
          y: CHART_PADDING_TOP + CHART_DRAWABLE_HEIGHT - (day[series.key] / maxValue) * CHART_DRAWABLE_HEIGHT,
        }));

        const linePath = points
          .map((point, index) => (index === 0 ? "M" : "L") + ` ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
          .join(" ");

        const areaPath = config.fillArea && seriesIndex === 0 && points.length > 1
          ? linePath + ` L ${points[points.length - 1].x.toFixed(2)} ${CHART_PADDING_TOP + CHART_DRAWABLE_HEIGHT} L ${points[0].x.toFixed(2)} ${CHART_PADDING_TOP + CHART_DRAWABLE_HEIGHT} Z`
          : null;

        return (
          <g key={series.key}>
            {areaPath ? <path class="daily-chart-area" style={{ fill: `url(#${config.id}-fill)` }} d={areaPath} /> : null}
            <path class="daily-chart-line" style={{ stroke: series.color }} d={linePath} />
            {points.map((point) => (
              <circle
                key={point.dayIndex}
                class="daily-chart-point"
                data-day-index={point.dayIndex}
                cx={point.x.toFixed(2)}
                cy={point.y.toFixed(2)}
                r="6"
                style={{ stroke: series.color }}
                onPointerEnter={(event) => setTooltip({ clientX: event.clientX, clientY: event.clientY, dayIndex: point.dayIndex })}
                onPointerMove={(event) => setTooltip((previous) => previous ? { ...previous, clientX: event.clientX, clientY: event.clientY } : null)}
                onPointerLeave={() => setTooltip(null)}
              />
            ))}
          </g>
        );
      })}
      {labelIndexes.map((index) => {
        const day = reversed[index];
        return <text key={index} class="daily-chart-axis-label" x={axisPoints[index].x.toFixed(2)} y={CHART_HEIGHT - 10} text-anchor="middle">{day.dayLabel}</text>;
      })}
    </svg>
  );
}

function PieLegend({ entries, total }: { entries: ChartDayItem["models"]; total: number }) {
  return (
    <div class="pie-legend">
      {entries.map((entry, index) => {
        const percentage = (entry.totalTokens / total) * 100;
        const color = MODEL_COLORS[index % MODEL_COLORS.length];
        return (
          <div key={entry.model} class="pie-legend-item">
            <span class="pie-legend-swatch" style={{ background: color }} />
            <span class="pie-legend-label">{entry.model}</span>
            <span class="pie-legend-value">{percentage.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ config, days }: { config: ChartConfig; days: ChartDayItem[] }) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const reversed = useMemo(() => days.slice().reverse(), [days]);
  const visibleSeries = useMemo(() => config.series.filter((series) => !hiddenSeries.has(series.key)), [config.series, hiddenSeries]);
  const maxValue = useMemo(() => {
    if (visibleSeries.length === 0 || reversed.length === 0) return 1;
    return reversed.reduce((currentMax, day) => {
      const dayMax = visibleSeries.reduce((seriesMax, series) => Math.max(seriesMax, day[series.key]), 0);
      return Math.max(currentMax, dayMax);
    }, 0) || 1;
  }, [reversed, visibleSeries]);

  const axisPoints = useMemo(() => reversed.map((_, index) => ({
    x: reversed.length === 1
      ? CHART_PADDING_LEFT + CHART_DRAWABLE_WIDTH / 2
      : CHART_PADDING_LEFT + (index / (reversed.length - 1)) * CHART_DRAWABLE_WIDTH,
  })), [reversed]);

  const guideValues = useMemo(() => Array.from(new Set([maxValue, Math.round((maxValue * 2) / 3), Math.round(maxValue / 3), 0])).sort((left, right) => right - left), [maxValue]);
  const labelIndexes = useMemo(() => getLabelIndexes(reversed.length), [reversed]);
  const tooltipDay = tooltip !== null ? reversed[tooltip.dayIndex] : null;

  const toggleSeries = useCallback((key: string) => {
    setHiddenSeries((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else if (previous.size < config.series.length - 1) {
        next.add(key);
      }
      return next;
    });
  }, [config.series.length]);

  if (reversed.length === 0) {
    return (
      <section class="daily-chart-section" data-chart-id={config.id}>
        <ChartHeader title={config.title} hideTitle={config.hideTitle} series={config.series} hiddenSeries={new Set()} onToggleSeries={() => undefined} interactive={false} />
        <div class="daily-chart-wrap">
          <svg class="daily-chart" data-chart-svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} />
        </div>
      </section>
    );
  }

  const tooltipRows = config.id === "daily-total-chart"
    ? [
        ["total", formatTokensCompact(tooltipDay?.totalTokens ?? 0)],
        ["input", formatTokensCompact(tooltipDay?.inputTokens ?? 0)],
        ["output", formatTokensCompact(tooltipDay?.outputTokens ?? 0)],
        ["reason", formatTokensCompact(tooltipDay?.reasoningTokens ?? 0)],
        ["cache r", formatTokensCompact(tooltipDay?.cacheRead ?? 0)],
        ["cache w", formatTokensCompact(tooltipDay?.cacheWrite ?? 0)],
      ]
    : visibleSeries.map((series) => [
        series.label,
        formatChartValue(config.valueFormat, (tooltipDay?.[series.key] as number | undefined) ?? 0),
      ]);

  function positionTooltip(tooltipState: TooltipState): { left: number; top: number } {
    const wrap = wrapRef.current;
    if (!wrap) return { left: 8, top: 8 };
    const wrapRect = wrap.getBoundingClientRect();
    const tooltipWidth = 180;
    const tooltipHeight = 120;
    const minOffset = 8;
    const left = Math.min(Math.max(minOffset, tooltipState.clientX - wrapRect.left + 12), wrap.clientWidth - tooltipWidth - minOffset);
    const top = Math.min(Math.max(minOffset, tooltipState.clientY - wrapRect.top - tooltipHeight - 12), wrap.clientHeight - tooltipHeight - minOffset);
    return { left, top };
  }

  const tooltipPosition = tooltip ? positionTooltip(tooltip) : null;

  return (
    <section class="daily-chart-section" data-chart-id={config.id}>
      <ChartHeader title={config.title} hideTitle={config.hideTitle} series={config.series} hiddenSeries={hiddenSeries} onToggleSeries={toggleSeries} />
      <div class="daily-chart-wrap" ref={wrapRef}>
        <LineChartPlot
          config={config}
          reversed={reversed}
          visibleSeries={visibleSeries}
          axisPoints={axisPoints}
          maxValue={maxValue}
          guideValues={guideValues}
          labelIndexes={labelIndexes}
          setTooltip={setTooltip}
        />
        <ChartTooltip tooltip={tooltipPosition} tooltipDay={tooltipDay} tooltipRows={tooltipRows} />
      </div>
    </section>
  );
}

function PieChart({ days, periodUnit }: { days: ChartDayItem[]; periodUnit: string }) {
  const latest = days.reduce<ChartDayItem | null>((best, day) => (!best || day.day > best.day) ? day : best, null);
  if (!latest) return null;

  const pieData = latest.models.slice().sort((left, right) => right.totalTokens - left.totalTokens);
  const total = pieData.reduce((sum, entry) => sum + entry.totalTokens, 0);
  if (total === 0) return null;

  const centerX = 100;
  const centerY = 100;
  const radius = 80;
  let startAngle = -Math.PI / 2;

  return (
    <section class="daily-chart-section" data-chart-id="daily-model-pie">
      <div class="daily-chart-header">
        <div class="daily-chart-title">{`LLM Usage (Latest ${periodUnit})`}</div>
      </div>
      <div class="pie-chart-wrap">
        <svg class="pie-chart" viewBox="0 0 200 200" role="img" aria-label={`LLM usage distribution for latest ${periodUnit.toLowerCase()}`}>
          {pieData.map((entry, index) => {
            const percentage = entry.totalTokens / total;
            const angle = percentage * 2 * Math.PI;
            const endAngle = startAngle + angle;
            if (angle < 0.001) {
              startAngle = endAngle;
              return null;
            }

            const color = MODEL_COLORS[index % MODEL_COLORS.length];

            if (angle >= 2 * Math.PI - 0.001) {
              const midAngle = startAngle + Math.PI;
              const mx = centerX + radius * Math.cos(midAngle);
              const my = centerY + radius * Math.sin(midAngle);
              const x1 = centerX + radius * Math.cos(startAngle);
              const y1 = centerY + radius * Math.sin(startAngle);
              const pathData = `M ${centerX} ${centerY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 1 1 ${mx.toFixed(2)} ${my.toFixed(2)} A ${radius} ${radius} 0 1 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
              startAngle = endAngle;
              return <path key={entry.model} class="pie-slice" d={pathData} fill={color} />;
            }

            const x1 = centerX + radius * Math.cos(startAngle);
            const y1 = centerY + radius * Math.sin(startAngle);
            const x2 = centerX + radius * Math.cos(endAngle);
            const y2 = centerY + radius * Math.sin(endAngle);
            const largeArc = angle > Math.PI ? 1 : 0;
            const pathData = `M ${centerX} ${centerY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
            startAngle = endAngle;

            return <path key={entry.model} class="pie-slice" d={pathData} fill={color} />;
          })}
        </svg>
        <PieLegend entries={pieData} total={total} />
      </div>
    </section>
  );
}

export { LineChart, PieChart };
