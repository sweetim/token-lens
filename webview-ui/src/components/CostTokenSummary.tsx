import type { TokenBreakdown } from "../../../src/webview-contract.js";
import { formatTokensCompact } from "../view-helpers.js";

function CostTokenSummary({ grandTokens }: { grandTokens: TokenBreakdown }) {
  const totalTokens = grandTokens.inputTokens + grandTokens.outputTokens + grandTokens.reasoningTokens + grandTokens.cacheRead;

  return (
    <div class="grid grid-cols-5 gap-1.5 bg-[var(--card-bg)] border border-[var(--border)] rounded-md px-3 py-2.5">
      <div class="flex flex-col gap-0.5 text-center"><span class="text-[13px] font-bold tabular-nums text-[var(--accent)]">{formatTokensCompact(totalTokens)}</span><span class="text-[9px] uppercase tracking-[.5px] text-[var(--muted)]">Total</span></div>
      <div class="flex flex-col gap-0.5 text-center"><span class="text-[13px] font-bold tabular-nums text-[var(--accent)]">{formatTokensCompact(grandTokens.inputTokens)}</span><span class="text-[9px] uppercase tracking-[.5px] text-[var(--muted)]">Input</span></div>
      <div class="flex flex-col gap-0.5 text-center"><span class="text-[13px] font-bold tabular-nums text-[var(--accent)]">{formatTokensCompact(grandTokens.outputTokens)}</span><span class="text-[9px] uppercase tracking-[.5px] text-[var(--muted)]">Output</span></div>
      <div class="flex flex-col gap-0.5 text-center"><span class="text-[13px] font-bold tabular-nums text-[var(--accent)]">{formatTokensCompact(grandTokens.reasoningTokens)}</span><span class="text-[9px] uppercase tracking-[.5px] text-[var(--muted)]">Reasoning</span></div>
      <div class="flex flex-col gap-0.5 text-center"><span class="text-[13px] font-bold tabular-nums text-[var(--accent)]">{formatTokensCompact(grandTokens.cacheRead)}</span><span class="text-[9px] uppercase tracking-[.5px] text-[var(--muted)]">Cache R</span></div>
    </div>
  );
}

export { CostTokenSummary };
