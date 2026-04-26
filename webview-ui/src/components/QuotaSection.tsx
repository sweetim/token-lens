import type { QuotaStateData } from "../../../src/webview-contract.js";

const Z_AI_LOGO_SVG = (
  <svg class="quota-brand-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="3" fill="currentColor" />
    <path d="M12.5 5.5L11.4 7.1c-.15.22-.41.36-.7.36H5.5V5.5h7z" fill="#fff" />
    <path d="M18.5 5.5L9.7 18.5H5.5L14.3 5.5h4.2z" fill="#fff" />
    <path d="M11.5 18.5l1.1-1.6c.15-.22.41-.36.7-.36h5.2v1.96h-7z" fill="#fff" />
  </svg>
);

function formatDurationUntil(timestamp: number): string {
  const diff = timestamp - Date.now();
  if (diff <= 0) return "now";
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

  const resetDurationLabel = summary
    ? formatDurationUntil(summary.nextResetTime)
    : quotaState.status === "loading"
      ? "Loading"
      : quotaState.status === "rateLimited"
        ? "Retrying"
        : "Unavailable";

  const usageValueLabel = summary
    ? `${usedPercentage.toFixed(1)}% used`
    : quotaState.status === "loading"
      ? "Loading quota..."
      : "Usage unavailable";

  const fillColor = summary
    ? getRemainingBarColor(remainingPercentage)
    : "var(--border)";

  const progressStyle = summary
    ? `width:${usedPercentage.toFixed(1)}%;background:${fillColor}`
    : "width:0%;background:var(--border)";

  return (
    <div class="quota-hero">
      <div class="quota-header">
        <div class="quota-brand">
          {Z_AI_LOGO_SVG}
          <span class="quota-title">Quota Usage</span>
        </div>
        <span class="quota-reset-badge">reset <span class="quota-reset-duration">{resetDurationLabel}</span></span>
      </div>
      <div class="quota-progress-section">
        <div class="quota-progress-header">
          <span class="quota-progress-label">Usage</span>
          <span class="quota-progress-value">{usageValueLabel}</span>
        </div>
        <div class="quota-progress-track">
          <div class="quota-progress-fill" style={progressStyle} />
        </div>
        {quotaState.message ? <div class="quota-status-message">{quotaState.message}</div> : null}
      </div>
    </div>
  );
}

export { QuotaSection };
