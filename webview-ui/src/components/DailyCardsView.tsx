import { useState, useCallback } from "preact/hooks";
import type { DayDataItem, ModelPricing, PricingStateData } from "@shared/webview-contract";
import { useIntersectionLazyLoad } from "@/hooks/useIntersectionLazyLoad";
import { DayCard } from "@/components/DayCard";

type DailyCardsViewProps = {
  dayData: DayDataItem[];
  modelPricing: ModelPricing;
  pricingState: PricingStateData;
  getSavedModels: () => string[];
};

function DailyCardsView({ dayData, modelPricing, pricingState, getSavedModels }: DailyCardsViewProps) {
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
    <div class="h-full overflow-y-auto px-2.5 pt-2.5 pb-5">
      {dayData.slice(0, visibleCount).map((item, index) => (
        <DayCard
          key={item.day}
          item={item}
          index={index}
          expanded={expandedDays.has(index)}
          onToggle={() => toggleDay(index)}
          modelPricing={modelPricing}
          pricingState={pricingState}
          getSavedModels={getSavedModels}
        />
      ))}
      {visibleCount < dayData.length && (
        <div ref={sentinelRef} class="h-px w-full" />
      )}
    </div>
  );
}

export { DailyCardsView };
