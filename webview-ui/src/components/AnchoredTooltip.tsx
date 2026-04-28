import type { ComponentChildren } from "preact";
import { useState, useCallback, useEffect } from "preact/hooks";

type AnchoredTooltipState = {
  content: ComponentChildren;
  left: number;
  top: number;
  width: number;
};

type AnchoredTooltipOptions = {
  width?: number;
  estimatedHeight?: number;
};

function useAnchoredTooltip() {
  const [tooltip, setTooltip] = useState<AnchoredTooltipState | null>(null);

  const hideTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  const showTooltip = useCallback((trigger: HTMLElement, content: ComponentChildren, options: AnchoredTooltipOptions = {}) => {
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = Math.min(document.documentElement.clientWidth, window.innerWidth);
    const viewportHeight = document.documentElement.clientHeight;
    const margin = Math.ceil(viewportWidth * 0.05);
    const tooltipWidth = Math.min(options.width ?? 220, viewportWidth - (margin * 2));
    const tooltipHeight = options.estimatedHeight ?? 60;
    const gap = 8;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    let top = rect.bottom + gap;

    left = Math.max(margin, Math.min(left, viewportWidth - tooltipWidth - margin));
    if (top + tooltipHeight > viewportHeight - margin) {
      top = Math.max(margin, rect.top - tooltipHeight - gap);
    }

    setTooltip({ content, left: Math.round(left), top: Math.round(top), width: tooltipWidth });
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
    <div
      class="pointer-events-none fixed z-[1000] rounded-lg border px-2.5 py-2 text-[11px] font-normal normal-case leading-[1.4] tracking-normal text-(--fg) opacity-100 [overflow-wrap:anywhere]"
      style={{
        left: tooltip.left + "px",
        top: tooltip.top + "px",
        boxSizing: "border-box",
        width: tooltip.width + "px",
        maxWidth: "90vw",
        background: "var(--vscode-dropdown-background, color-mix(in srgb, var(--card-bg) 90%, #000 10%))",
        borderColor: "color-mix(in srgb, var(--accent) 70%, var(--border))",
        boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent), 0 18px 48px rgba(0,0,0,.55)",
      }}
    >
      {tooltip.content}
    </div>
  );
}

export { AnchoredTooltip, useAnchoredTooltip };
export type { AnchoredTooltipState };
