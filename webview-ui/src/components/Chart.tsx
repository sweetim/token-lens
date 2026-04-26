import { useState, useCallback, useMemo, useRef } from "preact/hooks";
import { Fragment } from "preact";
import type { ChartConfig, ChartDayItem, ChartSeries } from "../../../src/webview-contract.js";
import { formatTokensCompact } from "../view-helpers.js";

const CHART_WIDTH = 720;
const CHART_HEIGHT = 240;
const CHART_PADDING_TOP = 16;
const CHART_PADDING_RIGHT = 12;
const CHART_PADDING_BOTTOM = 34;
const CHART_PADDING_LEFT = 44;
const CHART_DRAWABLE_WIDTH = CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
const CHART_DRAWABLE_HEIGHT = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

function formatChartValue(valueFormat: string, value: number): string {
  return valueFormat === "tokens" ? formatTokensCompact(value) : String(value);
}

function getLabelIndexes(length: number): number[] {
  if (length <= 6) {
    return Array.from({ length }, (_, i) => i);
  }
  return Array.from(new Set([
    0,
    Math.round((length - 1) * 0.25),
    Math.round((length - 1) * 0.5),
    Math.round((length - 1) * 0.75),
    length - 1,
  ])).sort((a, b) => a - b);
}

type TooltipState = {
  clientX: number;
  clientY: number;
  dayIndex: number;
};

function LineChart({ config, days }: { config: ChartConfig; days: ChartDayItem[] }) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const reversed = useMemo(() => days.slice().reverse(), [days]);

  const visibleSeries = useMemo(
    () => config.series.filter((s: ChartSeries) => !hiddenSeries.has(s.key)),
    [config.series, hiddenSeries],
  );

  const maxValue = useMemo(() => {
    if (visibleSeries.length === 0 || reversed.length === 0) return 1;
    return reversed.reduce((currentMax: number, day: ChartDayItem) => {
      const dayMax = visibleSeries.reduce(
        (sMax: number, s: ChartSeries) => Math.max(sMax, day[s.key]),
        0,
      );
      return Math.max(currentMax, dayMax);
    }, 0) || 1;
  }, [reversed, visibleSeries]);

  const axisPoints = useMemo(() =>
    reversed.map((_: ChartDayItem, i: number) => ({
      x: reversed.length === 1
        ? CHART_PADDING_LEFT + CHART_DRAWABLE_WIDTH / 2
        : CHART_PADDING_LEFT + (i / (reversed.length - 1)) * CHART_DRAWABLE_WIDTH,
    })),
    [reversed],
  );

  const guideValues = useMemo(() =>
    Array.from(new Set([maxValue, Math.round((maxValue * 2) / 3), Math.round(maxValue / 3), 0]))
      .sort((a: number, b: number) => b - a),
    [maxValue],
  );

  const labelIndexes = useMemo(() => getLabelIndexes(reversed.length), [reversed]);

  const tooltipDay = tooltip !== null ? reversed[tooltip.dayIndex] : null;

  const toggleSeries = useCallback((key: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (prev.size < config.series.length - 1) {
        next.add(key);
      }
      return next;
    });
  }, [config.series.length]);

  if (reversed.length === 0) {
    return (
      <section class="daily-chart-section" data-chart-id={config.id}>
        <div class="daily-chart-header">
          {config.hideTitle ? null : <div class="daily-chart-title">{config.title}</div>}
          <div class="daily-chart-legend">
            {config.series.map((s: ChartSeries) => (
              <button
                key={s.key}
                class={`daily-chart-legend-item${config.series.length === 1 ? " is-static" : ""}`}
                type="button"
                aria-pressed={true}
                disabled={config.series.length === 1}
              >
                <span class="daily-chart-legend-swatch" style={{ background: s.color }} />
                <span class="daily-chart-legend-label">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div class="daily-chart-wrap">
          <svg class="daily-chart" data-chart-svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} />
        </div>
      </section>
    );
  }

  const defs = config.fillArea && visibleSeries.length > 0
    ? <defs><linearGradient id={`${config.id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={`stop-color:${visibleSeries[0].color}; stop-opacity: 0.24;`} /><stop offset="100%" style={`stop-color:${visibleSeries[0].color}; stop-opacity: 0;`} /></linearGradient></defs>
    : null;

  const tooltipRows = config.id === "daily-total-chart"
    ? [
        ["total", formatTokensCompact(tooltipDay?.totalTokens ?? 0)],
        ["input", formatTokensCompact(tooltipDay?.inputTokens ?? 0)],
        ["output", formatTokensCompact(tooltipDay?.outputTokens ?? 0)],
        ["reason", formatTokensCompact(tooltipDay?.reasoningTokens ?? 0)],
        ["cache r", formatTokensCompact(tooltipDay?.cacheRead ?? 0)],
        ["cache w", formatTokensCompact(tooltipDay?.cacheWrite ?? 0)],
      ]
    : visibleSeries.map((s: ChartSeries) => [
        s.label,
        formatChartValue(config.valueFormat, tooltipDay?.[s.key] as number ?? 0),
      ]);

  function positionTooltip(t: TooltipState): { left: number; top: number } {
    const wrap = wrapRef.current;
    if (!wrap) return { left: 8, top: 8 };
    const wrapRect = wrap.getBoundingClientRect();
    const tw = 180;
    const th = 120;
    const minOffset = 8;
    const left = Math.min(Math.max(minOffset, t.clientX - wrapRect.left + 12), wrap.clientWidth - tw - minOffset);
    const top = Math.min(Math.max(minOffset, t.clientY - wrapRect.top - th - 12), wrap.clientHeight - th - minOffset);
    return { left, top };
  }

  const tooltipPos = tooltip ? positionTooltip(tooltip) : { left: 0, top: 0 };

  return (
    <section class="daily-chart-section" data-chart-id={config.id}>
      <div class="daily-chart-header">
        {config.hideTitle ? null : <div class="daily-chart-title">{config.title}</div>}
        <div class="daily-chart-legend">
          {config.series.map((s: ChartSeries) => {
            const isHidden = hiddenSeries.has(s.key);
            return (
              <button
                key={s.key}
                class={`daily-chart-legend-item${isHidden ? " is-hidden" : ""}${config.series.length === 1 ? " is-static" : ""}`}
                type="button"
                aria-pressed={!isHidden}
                disabled={config.series.length === 1}
                onClick={() => toggleSeries(s.key)}
              >
                <span class="daily-chart-legend-swatch" style={{ background: s.color }} />
                <span class="daily-chart-legend-label">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div class="daily-chart-wrap" ref={wrapRef}>
        <svg class="daily-chart" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label={`${config.title} chart`}>
          {defs}
          {guideValues.map((value: number) => {
            const y = CHART_PADDING_TOP + CHART_DRAWABLE_HEIGHT - (value / maxValue) * CHART_DRAWABLE_HEIGHT;
            return (
              <g key={value}>
                <line class="daily-chart-guide" x1={CHART_PADDING_LEFT} y1={y} x2={CHART_WIDTH - CHART_PADDING_RIGHT} y2={y} />
                <text class="daily-chart-guide-label" x={CHART_PADDING_LEFT - 8} y={y + 3} text-anchor="end">{formatChartValue(config.valueFormat, value)}</text>
              </g>
            );
          })}
          {visibleSeries.map((series: ChartSeries, seriesIndex: number) => {
            const points = reversed.map((day: ChartDayItem, dayIndex: number) => ({
              dayIndex,
              value: day[series.key],
              x: axisPoints[dayIndex].x,
              y: CHART_PADDING_TOP + CHART_DRAWABLE_HEIGHT - (day[series.key] / maxValue) * CHART_DRAWABLE_HEIGHT,
            }));

            const linePath = points
              .map((p, i) => (i === 0 ? "M" : "L") + ` ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
              .join(" ");

            const areaPath = config.fillArea && seriesIndex === 0 && points.length > 1
              ? linePath + ` L ${points[points.length - 1].x.toFixed(2)} ${CHART_PADDING_TOP + CHART_DRAWABLE_HEIGHT} L ${points[0].x.toFixed(2)} ${CHART_PADDING_TOP + CHART_DRAWABLE_HEIGHT} Z`
              : null;

            return (
              <g key={series.key}>
                {areaPath ? <path class="daily-chart-area" style={{ fill: `url(#${config.id}-fill)` }} d={areaPath} /> : null}
                <path class="daily-chart-line" style={{ stroke: series.color }} d={linePath} />
                {points.map((p) => (
                  <circle
                    key={p.dayIndex}
                    class="daily-chart-point"
                    data-day-index={p.dayIndex}
                    cx={p.x.toFixed(2)}
                    cy={p.y.toFixed(2)}
                    r="6"
                    style={{ stroke: series.color }}
                    onPointerEnter={(e) => setTooltip({ clientX: e.clientX, clientY: e.clientY, dayIndex: p.dayIndex })}
                    onPointerMove={(e) => setTooltip((prev) => prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : null)}
                    onPointerLeave={() => setTooltip(null)}
                  />
                ))}
              </g>
            );
          })}
          {labelIndexes.map((i: number) => {
            const day = reversed[i];
            return (
              <text key={i} class="daily-chart-axis-label" x={axisPoints[i].x.toFixed(2)} y={CHART_HEIGHT - 10} text-anchor="middle">{day.dayLabel}</text>
            );
          })}
        </svg>
        {tooltip && tooltipDay ? (
          <div class="daily-chart-tooltip" style={{ left: tooltipPos.left, top: tooltipPos.top }}>
            <div class="daily-chart-tooltip-day">{tooltipDay.dayLabel}</div>
            <div class="daily-chart-tooltip-grid">
              {tooltipRows.map((row: string[]) => (
                <Fragment key={row[0]}>
                  <div class="daily-chart-tooltip-label">{row[0]}</div>
                  <div class="daily-chart-tooltip-value">{row[1]}</div>
                </Fragment>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

const MODEL_COLORS = [
  "#3794ff", "#89d185", "#b180d7", "#d18616", "#4ec9b0",
  "#f14c4c", "#e9d74a", "#6c71c4", "#2aa198", "#d33682",
  "#859900", "#cb4b16", "#268bd2", "#d01b24", "#738dfe",
];

function PieChart({ days, periodUnit }: { days: ChartDayItem[]; periodUnit: string }) {
  const latest = days.reduce<ChartDayItem | null>((best: ChartDayItem | null, d: ChartDayItem) => (!best || d.day > best.day) ? d : best, null);
  if (!latest) return null;

  const pieData = latest.models
    .slice()
    .sort((a: { model: string; totalTokens: number }, b: { model: string; totalTokens: number }) => b.totalTokens - a.totalTokens);

  const total = pieData.reduce((sum: number, e: { totalTokens: number }) => sum + e.totalTokens, 0);
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
          {pieData.map((entry: { model: string; totalTokens: number }, index: number) => {
            const percentage = entry.totalTokens / total;
            const angle = percentage * 2 * Math.PI;
            const endAngle = startAngle + angle;
            if (angle < 0.001) {
              startAngle = endAngle;
              return null;
            }

            const x1 = centerX + radius * Math.cos(startAngle);
            const y1 = centerY + radius * Math.sin(startAngle);
            const x2 = centerX + radius * Math.cos(endAngle);
            const y2 = centerY + radius * Math.sin(endAngle);
            const largeArc = angle > Math.PI ? 1 : 0;
            const color = MODEL_COLORS[index % MODEL_COLORS.length];
            const d = `M ${centerX} ${centerY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
            startAngle = endAngle;

            return <path key={entry.model} class="pie-slice" d={d} fill={color} />;
          })}
        </svg>
        <div class="pie-legend">
          {pieData.map((entry: { model: string; totalTokens: number }, index: number) => {
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
      </div>
    </section>
  );
}

export { LineChart, PieChart };
