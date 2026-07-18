import type { QuotaStateData } from "@shared/webview-contract";
import zaiSvg from "@lobehub/icons-static-svg/icons/zai.svg";

function ZaiIcon({ size }: { size: number }) {
  return <span class="shrink-0" style={{ width: size, height: size, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: zaiSvg }} />;
}

const CLOCK_SVG = (
  <svg class="h-[11px] w-[11px] shrink-0 translate-y-[0.5px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8z" />
    <path d="M8 3.25a.75.75 0 01.75.75v3.69l2.28 2.28a.75.75 0 11-1.06 1.06l-2.5-2.5A.75.75 0 017.25 8V4A.75.75 0 018 3.25z" />
  </svg>
);

function formatDurationUntil(timestamp: number): string {
  const diff = timestamp - Date.now();
  if (diff <= 0) return "due";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getRemainingBarColor(remainingPercentage: number): string {
  if (remainingPercentage <= 20) return "var(--vscode-charts-red, #f14c4c)";
  if (remainingPercentage <= 50) return "var(--orange)";
  return "var(--green)";
}

function QuotaSection({ quotaState }: { quotaState: QuotaStateData }) {
  const summary = quotaState.summary;
  const usedPercentage = summary ? Math.max(0, Math.min(100, summary.usedPercentage)) : 0;
  const remainingPercentage = summary ? Math.max(0, Math.min(100, summary.remainingPercentage)) : 0;

  const isLoading = quotaState.status === "loading" && !summary;

  const resetDurationLabel = summary
    ? formatDurationUntil(summary.nextResetTime)
    : quotaState.status === "rateLimited"
      ? "Retrying"
      : "Unavailable";

  const usageValueLabel = summary
    ? `${usedPercentage.toFixed(1)}% used`
    : "Usage unavailable";

  const fillColor = summary
    ? getRemainingBarColor(remainingPercentage)
    : "var(--border)";

  const progressStyle = summary
    ? `width:${usedPercentage.toFixed(1)}%;background:${fillColor}`
    : "width:0%;background:var(--border)";

  const skelBg = "bg-[color-mix(in_srgb,var(--fg)_12%,transparent)]";

  if (isLoading) {
    return (
      <div class="border-b border-(--border) bg-(--card-bg) px-3.5 pt-4 pb-3.5">
        <div class="flex items-center justify-between gap-3">
          <div class="inline-flex min-w-0 items-center gap-2">
          <ZaiIcon size={12} />
          <span class="text-[11px] font-bold uppercase tracking-[.7px] text-(--fg)">Quota Usage</span>
        </div>
        <div class={`h-5 w-20 animate-pulse rounded-full ${skelBg}`} />
        </div>
        <div class="mt-3.5 flex flex-col gap-1.5">
          <div class="flex items-center justify-between gap-2">
            <div class={`h-3 w-10 animate-pulse rounded-sm ${skelBg}`} />
            <div class={`h-3 w-16 animate-pulse rounded-sm ${skelBg}`} />
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-(--border)">
            <div class={`h-full w-full animate-pulse rounded-full ${skelBg}`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="border-b border-(--border) bg-(--card-bg) px-3.5 pt-4 pb-3.5">
      <div class="flex items-center justify-between gap-3">
        <div class="inline-flex min-w-0 items-center gap-2">
          <ZaiIcon size={12} />
          <span class="text-[11px] font-bold uppercase tracking-[.7px] text-(--fg)">Quota Usage</span>
        </div>
        <span class="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-full bg-(--border) px-2 py-0.5 text-[11px] font-bold text-(--muted)">{CLOCK_SVG}<span class="font-bold text-white">{resetDurationLabel}</span></span>
      </div>
      <div class="mt-3.5 flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[10px] font-bold uppercase tracking-[.5px]">Usage</span>
          <span class="text-[10px] font-bold uppercase tracking-[.5px]">{usageValueLabel}</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-(--border)">
          <div class="h-full rounded-full" style={progressStyle} />
        </div>
        {quotaState.message ? <div class="text-[11px] leading-[1.4] text-(--muted)">{quotaState.message}</div> : null}
      </div>
    </div>
  );
}

export { QuotaSection };
