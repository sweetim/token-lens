import { useState, useMemo, useCallback, useRef, useEffect } from "preact/hooks";
import type { DayDataItem, ModelPricing } from "../../../src/webview-contract.js";
import { DayCard } from "./DayCard.js";

const DAY_HEIGHT_ESTIMATE = 96;
const DAY_GROUP_GAP = 8;
const BUFFER = 4;

type DailyCardsViewProps = {
  dayData: DayDataItem[];
  modelPricing: ModelPricing;
  getSavedModels: () => string[];
};

function DailyCardsView({ dayData, modelPricing, getSavedModels }: DailyCardsViewProps) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemHeights = useRef<number[]>(dayData.map(() => DAY_HEIGHT_ESTIMATE + DAY_GROUP_GAP));
  const renderPending = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const offsets = useMemo(() => {
    const offsetValues = new Array(dayData.length + 1).fill(0) as number[];
    for (let index = 0; index < dayData.length; index++) {
      offsetValues[index + 1] = offsetValues[index] + (itemHeights.current[index] ?? (DAY_HEIGHT_ESTIMATE + DAY_GROUP_GAP));
    }
    return offsetValues;
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
      viewport.querySelectorAll(".day-group").forEach((element) => {
        const index = Number((element as HTMLElement).dataset.index);
        const height = Math.ceil(element.getBoundingClientRect().height) + DAY_GROUP_GAP;
        if (!Number.isNaN(index) && height > 0 && itemHeights.current[index] !== height) {
          itemHeights.current[index] = height;
          changed = true;
        }
      });
      if (changed) setScrollTop((value) => value);
    });
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const handler = () => {
      setScrollTop(element.scrollTop);
      scheduleMeasure();
    };
    element.addEventListener("scroll", handler, { passive: true });
    return () => element.removeEventListener("scroll", handler);
  }, [scheduleMeasure]);

  useEffect(() => {
    scheduleMeasure();
  }, [scheduleMeasure, dayData]);

  const toggleDay = useCallback((index: number) => {
    setExpandedDays((previous) => {
      const next = new Set(previous);
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
        {dayData.slice(start, end).map((item, offsetIndex) => {
          const index = start + offsetIndex;
          return (
            <DayCard
              key={item.day}
              item={item}
              index={index}
              expanded={expandedDays.has(index)}
              onToggle={() => toggleDay(index)}
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

export { DailyCardsView };
