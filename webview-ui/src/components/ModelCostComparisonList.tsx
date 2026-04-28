import type { ModelCostEstimate } from "../../../src/webview-model-cost.js";
import type { PricingStateData } from "../../../src/webview-contract.js";
import { formatTokensCompact } from "../view-helpers.js";
import { AnchoredTooltip, useAnchoredTooltip } from "./AnchoredTooltip.js";
import { useIntersectionLazyLoad } from "../hooks/useIntersectionLazyLoad.js";

const MODEL_ID_CLASS = "mr-3 min-w-0 flex-auto overflow-hidden text-ellipsis whitespace-nowrap font-mono";
const COST_DETAILS_TOOLTIP_WIDTH = 390;
const COST_DETAILS_TOOLTIP_HEIGHT = 250;
const SKELETON_ROWS = [0, 1, 2, 3];

type DataAttributes = Partial<Record<`data-${string}`, string | number>>;

type ModelCostComparisonEntry = {
  modelId: string;
  cost: number;
  provider?: string;
  created?: number;
  pricing?: ModelCostEstimate["pricing"];
  breakdown?: ModelCostEstimate["breakdown"];
};

type ModelCostComparisonEntryWithDetails = ModelCostComparisonEntry & {
  pricing: ModelCostEstimate["pricing"];
  breakdown: ModelCostEstimate["breakdown"];
};

type ModelCostComparisonListProps = {
  title: string;
  entries: ModelCostComparisonEntry[];
  pricingState?: PricingStateData;
  tooltipText?: string;
  listId?: string;
  listDataAttributes?: DataAttributes;
  highlightModelIds?: Set<string>;
  isSaved?: (modelId: string) => boolean;
  onEntryClick?: (modelId: string) => void;
  getRowDataAttributes?: (entry: ModelCostComparisonEntry) => DataAttributes;
};

function formatCostAmount(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return "$" + cost.toFixed(6);
  if (cost < 1) return "$" + cost.toFixed(4);
  return "$" + cost.toFixed(2);
}

function formatPricePerMillionTokens(pricePerToken: number): string {
  const pricePerMillionTokens = pricePerToken * 1_000_000;
  if (pricePerMillionTokens === 0) return "$0.00";
  if (pricePerMillionTokens < 0.01) return "$" + pricePerMillionTokens.toFixed(4);
  if (pricePerMillionTokens < 1) return "$" + pricePerMillionTokens.toFixed(3);
  return "$" + pricePerMillionTokens.toFixed(2);
}

function hasCostDetails(entry: ModelCostComparisonEntry): entry is ModelCostComparisonEntryWithDetails {
  return entry.pricing !== undefined && entry.breakdown !== undefined;
}

function ModelCostLoadingRows() {
  return (
    <div class="flex flex-col gap-1" aria-hidden="true">
      {SKELETON_ROWS.map((row) => (
        <div key={row} class="flex items-center justify-between py-0.5">
          <div class="h-3 w-[62%] animate-pulse rounded-sm bg-[color-mix(in_srgb,var(--fg)_12%,transparent)]" />
          <div class="h-3 w-12 animate-pulse rounded-sm bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]" />
        </div>
      ))}
    </div>
  );
}

function ModelCostStateMessage({ pricingState }: { pricingState: PricingStateData }) {
  return (
    <div class="rounded-md border border-(--border) bg-[color-mix(in_srgb,var(--fg)_4%,transparent)] px-2 py-1.5 text-[10px] leading-[1.4] text-(--muted)">
      {pricingState.message}
    </div>
  );
}

function ModelCostDetailsTooltip({ entry }: { entry: ModelCostComparisonEntryWithDetails }) {
  return (
    <div class="flex flex-col gap-2.5">
      <div class="rounded-md border border-(--border) bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-2 py-1.5">
        <div class="text-[9px] font-semibold uppercase tracking-[.5px] text-(--muted)">Estimated model cost</div>
        <div class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] font-bold text-(--accent)">{entry.modelId}</div>
      </div>
      <table class="w-full table-fixed border-separate border-spacing-y-1 text-[10px]">
        <colgroup>
          <col style={{ width: "25%" }} />
          <col style={{ width: "25%" }} />
          <col style={{ width: "28%" }} />
          <col style={{ width: "22%" }} />
        </colgroup>
        <thead>
          <tr class="text-[9px] font-semibold uppercase tracking-[.4px] text-(--muted)">
            <th class="px-1.5 pb-1 text-left font-semibold">Type</th>
            <th class="px-1.5 pb-1 text-right font-semibold">Tokens</th>
            <th class="px-1.5 pb-1 text-right font-semibold">Price / 1M</th>
            <th class="px-1.5 pb-1 text-right font-semibold">Cost</th>
          </tr>
        </thead>
        <tbody>
          {entry.breakdown.map((item) => (
            <tr key={item.label} class="bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]">
              <td class="rounded-l px-1.5 py-1 font-medium text-(--muted)">{item.label}</td>
              <td class="px-1.5 py-1 text-right font-mono text-(--fg)">{formatTokensCompact(item.tokens)}</td>
              <td class="px-1.5 py-1 text-right font-mono text-(--fg)">{formatPricePerMillionTokens(item.pricePerToken)}</td>
              <td class="rounded-r px-1.5 py-1 text-right font-mono font-semibold text-(--accent2)">{formatCostAmount(item.cost)}</td>
            </tr>
          ))}
          <tr class="bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[11px] font-bold">
            <td class="rounded-l border-y border-l border-(--border) px-2 py-1.5" colSpan={3}>Estimated total</td>
            <td class="rounded-r border-y border-r border-(--border) px-2 py-1.5 text-right font-mono text-(--accent)">{formatCostAmount(entry.cost)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ModelCostComparisonList({
  title,
  entries,
  pricingState,
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

  const listClass = listId === "cost-model-list"
    ? "flex flex-col gap-1 pt-0"
    : "flex flex-col gap-1 border-t border-(--border) pt-2.5";
  const showPricingLoadingState = entries.length === 0 && pricingState?.status === "loading";
  const showPricingUnavailableState = entries.length === 0 && pricingState?.status === "unavailable";

  if (entries.length === 0 && !showPricingLoadingState && !showPricingUnavailableState) {
    return null;
  }

  return (
    <div class={listClass} id={listId} {...(listDataAttributes ?? {})}>
      <div class="mb-0.5 flex items-center gap-1.5 text-[9px] uppercase tracking-[.5px] text-(--muted)">
        <span>{title}</span>
        {tooltipText ? (
          <span class="inline-flex items-center">
            <button
              class="flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border-0 bg-transparent p-0 text-(--muted) transition-colors hover:text-(--fg) focus-visible:text-(--fg) focus-visible:outline-none"
              type="button"
              aria-label={tooltipText}
              onMouseEnter={(event) => showTooltip(event.currentTarget, tooltipText)}
              onFocus={(event) => showTooltip(event.currentTarget, tooltipText)}
              onMouseLeave={hideTooltip}
              onBlur={hideTooltip}
            >
              <svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5" /><path d="M8 7.1V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /><circle cx="8" cy="4.75" r="1" fill="currentColor" /></svg>
            </button>
          </span>
        ) : null}
      </div>
      {showPricingLoadingState && pricingState ? <ModelCostStateMessage pricingState={pricingState} /> : null}
      {showPricingLoadingState ? <ModelCostLoadingRows /> : null}
      {showPricingUnavailableState && pricingState ? <ModelCostStateMessage pricingState={pricingState} /> : null}
      {entries.slice(0, visibleCount).map((entry) => {
        const costDetails = hasCostDetails(entry) ? <ModelCostDetailsTooltip entry={entry} /> : null;
        return (
          <div
            key={entry.modelId}
            class={`flex items-center justify-between py-0.5 text-[11px]${onEntryClick ? " cursor-pointer transition-opacity hover:opacity-80" : ""}`}
            onClick={onEntryClick ? () => onEntryClick(entry.modelId) : undefined}
            onMouseEnter={costDetails ? (event) => showTooltip(event.currentTarget, costDetails, { width: COST_DETAILS_TOOLTIP_WIDTH, estimatedHeight: COST_DETAILS_TOOLTIP_HEIGHT }) : undefined}
            onFocus={costDetails ? (event) => showTooltip(event.currentTarget, costDetails, { width: COST_DETAILS_TOOLTIP_WIDTH, estimatedHeight: COST_DETAILS_TOOLTIP_HEIGHT }) : undefined}
            onMouseLeave={costDetails ? hideTooltip : undefined}
            onBlur={costDetails ? hideTooltip : undefined}
            tabIndex={costDetails ? 0 : undefined}
            {...(getRowDataAttributes?.(entry) ?? {})}
          >
            <span class={`${MODEL_ID_CLASS}${highlightModelIds?.has(entry.modelId.replace(/^[^/]+\//, "")) || isSaved?.(entry.modelId) ? " text-(--accent)" : " text-(--fg)"}`}>{entry.modelId}</span>
            <span class="shrink-0 font-mono font-semibold text-(--accent)">${entry.cost.toFixed(2)}</span>
          </div>
        );
      })}
      {visibleCount < entries.length && (
        <div ref={sentinelRef} class="h-px w-full" />
      )}
      <AnchoredTooltip tooltip={tooltip} />
    </div>
  );
}

export { ModelCostComparisonList };
