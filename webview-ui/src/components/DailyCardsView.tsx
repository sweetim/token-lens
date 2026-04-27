import { useState, useCallback } from "preact/hooks";
import type { DayDataItem, ModelPricing } from "../../../src/webview-contract.js";
import { useIntersectionLazyLoad } from "../hooks/useIntersectionLazyLoad.js";
import { DayCard } from "./DayCard.js";

type DailyCardsViewProps = {
  dayData: DayDataItem[];
  modelPricing: ModelPricing;
  getSavedModels: () => string[];
};

function DailyCardsView({ dayData, modelPricing, getSavedModels }: DailyCardsViewProps) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  const { visibleCount, sentinelRef } = useIntersectionLazyLoad(dayData.length);

  const toggleDay = useCallback((index: number) => {
    setExpandedDays((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  return (
    <div class="vlist-scroll">
      {dayData.slice(0, visibleCount).map((item, index) => (
        <DayCard
          key={item.day}
          item={item}
          index={index}
          expanded={expandedDays.has(index)}
          onToggle={() => toggleDay(index)}
          modelPricing={modelPricing}
          getSavedModels={getSavedModels}
        />
      ))}
      {visibleCount < dayData.length && (
        <div ref={sentinelRef} class="vlist-sentinel" />
      )}
    </div>
  );
}

export { DailyCardsView };
