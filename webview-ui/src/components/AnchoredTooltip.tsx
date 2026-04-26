import { useState, useCallback, useEffect } from "preact/hooks";

type AnchoredTooltipState = {
  text: string;
  left: number;
  top: number;
};

function useAnchoredTooltip() {
  const [tooltip, setTooltip] = useState<AnchoredTooltipState | null>(null);

  const hideTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  const showTooltip = useCallback((trigger: HTMLElement, text: string) => {
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const tooltipWidth = 220;
    const tooltipHeight = 60;
    const margin = 12;
    const gap = 8;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    let top = rect.bottom + gap;

    left = Math.max(margin, Math.min(left, viewportWidth - tooltipWidth - margin));
    if (top + tooltipHeight > viewportHeight - margin) {
      top = Math.max(margin, rect.top - tooltipHeight - gap);
    }

    setTooltip({ text, left: Math.round(left), top: Math.round(top) });
  }, []);

  useEffect(() => {
    document.addEventListener("scroll", hideTooltip, true);
    window.addEventListener("resize", hideTooltip);

    return () => {
      document.removeEventListener("scroll", hideTooltip, true);
      window.removeEventListener("resize", hideTooltip);
    };
  }, [hideTooltip]);

  return { tooltip, showTooltip, hideTooltip };
}

function AnchoredTooltip({ tooltip }: { tooltip: AnchoredTooltipState | null }) {
  if (!tooltip) {
    return null;
  }

  return (
    <div class="model-cost-info-tooltip-overlay visible" style={{ left: tooltip.left + "px", top: tooltip.top + "px" }}>
      {tooltip.text}
    </div>
  );
}

export { AnchoredTooltip, useAnchoredTooltip };
export type { AnchoredTooltipState };
