import type { TokenBreakdown } from "../../../src/webview-contract.js";
import { formatTokensCompact } from "../view-helpers.js";

function CostTokenSummary({ grandTokens }: { grandTokens: TokenBreakdown }) {
  const totalTokens = grandTokens.inputTokens + grandTokens.outputTokens + grandTokens.reasoningTokens + grandTokens.cacheRead;

  return (
    <div class="cost-token-summary">
      <div class="cost-token-stat"><span class="cost-token-value">{formatTokensCompact(totalTokens)}</span><span class="cost-token-label">Total Tokens</span></div>
      <div class="cost-token-stat"><span class="cost-token-value">{formatTokensCompact(grandTokens.inputTokens)}</span><span class="cost-token-label">Input</span></div>
      <div class="cost-token-stat"><span class="cost-token-value">{formatTokensCompact(grandTokens.outputTokens)}</span><span class="cost-token-label">Output</span></div>
      <div class="cost-token-stat"><span class="cost-token-value">{formatTokensCompact(grandTokens.reasoningTokens)}</span><span class="cost-token-label">Reasoning</span></div>
      <div class="cost-token-stat"><span class="cost-token-value">{formatTokensCompact(grandTokens.cacheRead)}</span><span class="cost-token-label">Cache Read</span></div>
    </div>
  );
}

export { CostTokenSummary };
