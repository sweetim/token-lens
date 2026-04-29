import type { ModelPricing, TokenBreakdown } from "@shared/webview-contract";

type ModelCostEstimate = {
  modelId: string;
  cost: number;
  pricing: ModelCostEstimatePricing;
  breakdown: ModelCostEstimateBreakdownItem[];
};

type ModelCostEstimatePricing = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheRead: number;
};

type ModelCostEstimateBreakdownItem = {
  label: string;
  tokens: number;
  pricePerToken: number;
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

      const estimatePricing: ModelCostEstimatePricing = {
        inputTokens: pricing.prompt,
        outputTokens: pricing.completion,
        reasoningTokens: pricing.completion,
        cacheRead: pricing.cacheRead,
      };
      const breakdown: ModelCostEstimateBreakdownItem[] = [
        { label: "Input", tokens: tokens.inputTokens, pricePerToken: estimatePricing.inputTokens, cost: tokens.inputTokens * estimatePricing.inputTokens },
        { label: "Output", tokens: tokens.outputTokens, pricePerToken: estimatePricing.outputTokens, cost: tokens.outputTokens * estimatePricing.outputTokens },
        { label: "Reasoning", tokens: tokens.reasoningTokens, pricePerToken: estimatePricing.reasoningTokens, cost: tokens.reasoningTokens * estimatePricing.reasoningTokens },
        { label: "Cache read", tokens: tokens.cacheRead, pricePerToken: estimatePricing.cacheRead, cost: tokens.cacheRead * estimatePricing.cacheRead },
      ];
      const cost = breakdown.reduce((sum, item) => sum + item.cost, 0);

      return { modelId, cost, pricing: estimatePricing, breakdown };
    })
    .filter((result): result is ModelCostEstimate => result !== null && result.cost > 0)
    .sort((left, right) => right.cost - left.cost);
}

export { computeModelCostEstimates };
export type { ModelCostEstimate, ModelCostEstimateBreakdownItem, ModelCostEstimatePricing };
