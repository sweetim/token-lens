import type { ModelPricing, TokenBreakdown } from "./webview-contract.js";

type ModelCostEstimate = {
  modelId: string;
  cost: number;
};

function computeModelCostEstimates(
  modelIds: string[],
  modelPricing: ModelPricing,
  tokens: TokenBreakdown,
): ModelCostEstimate[] {
  return modelIds
    .map((modelId) => {
      const pricing = modelPricing[modelId];
      if (!pricing) {
        return null;
      }

      const cost = (tokens.inputTokens * pricing.prompt)
        + (tokens.outputTokens * pricing.completion)
        + (tokens.reasoningTokens * pricing.completion)
        + (tokens.cacheRead * pricing.cacheRead);

      return { modelId, cost };
    })
    .filter((result): result is ModelCostEstimate => result !== null && result.cost > 0)
    .sort((left, right) => right.cost - left.cost);
}

export { computeModelCostEstimates };
export type { ModelCostEstimate };
