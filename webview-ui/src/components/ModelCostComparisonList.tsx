import { AnchoredTooltip, useAnchoredTooltip } from "./AnchoredTooltip.js";
import { useIntersectionLazyLoad } from "../hooks/useIntersectionLazyLoad.js";

type DataAttributes = Partial<Record<`data-${string}`, string | number>>;

type ModelCostComparisonEntry = {
  modelId: string;
  cost: number;
  provider?: string;
  created?: number;
};

type ModelCostComparisonListProps = {
  title: string;
  entries: ModelCostComparisonEntry[];
  tooltipText?: string;
  listId?: string;
  listDataAttributes?: DataAttributes;
  highlightModelIds?: Set<string>;
  isSaved?: (modelId: string) => boolean;
  onEntryClick?: (modelId: string) => void;
  getRowDataAttributes?: (entry: ModelCostComparisonEntry) => DataAttributes;
};

function ModelCostComparisonList({
  title,
  entries,
  tooltipText,
  listId,
  listDataAttributes,
  highlightModelIds,
  isSaved,
  onEntryClick,
  getRowDataAttributes,
}: ModelCostComparisonListProps) {
  const { tooltip, showTooltip, hideTooltip } = useAnchoredTooltip();
  const { visibleCount, sentinelRef } = useIntersectionLazyLoad(entries.length);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div class="model-cost-list" id={listId} {...(listDataAttributes ?? {})}>
      <div class="model-cost-header">
        <span>{title}</span>
        {tooltipText ? (
          <span class="model-cost-info">
            <button
              class="model-cost-info-button"
              type="button"
              aria-label={tooltipText}
              onMouseEnter={(event) => showTooltip(event.currentTarget, tooltipText)}
              onFocus={(event) => showTooltip(event.currentTarget, tooltipText)}
              onMouseLeave={hideTooltip}
              onBlur={hideTooltip}
            >
              <svg class="model-cost-info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5" /><path d="M8 7.1V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /><circle cx="8" cy="4.75" r="1" fill="currentColor" /></svg>
            </button>
          </span>
        ) : null}
      </div>
      {entries.slice(0, visibleCount).map((entry) => (
        <div
          key={entry.modelId}
          class={`model-cost-row${highlightModelIds?.has(entry.modelId.replace(/^[^/]+\//, "")) ? " active" : ""}${isSaved?.(entry.modelId) ? " saved" : ""}`}
          onClick={onEntryClick ? () => onEntryClick(entry.modelId) : undefined}
          {...(getRowDataAttributes?.(entry) ?? {})}
        >
          <span class="model-cost-id">{entry.modelId}</span>
          <span class="model-cost-value">${entry.cost.toFixed(2)}</span>
        </div>
      ))}
      {visibleCount < entries.length && (
        <div ref={sentinelRef} class="vlist-sentinel" />
      )}
      <AnchoredTooltip tooltip={tooltip} />
    </div>
  );
}

export { ModelCostComparisonList };
