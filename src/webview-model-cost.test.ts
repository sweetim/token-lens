import { expect, test } from "bun:test";
import { computeModelCostEstimates } from "@/webview-model-cost";
import type { ModelPricing, TokenBreakdown } from "@/webview-contract";

const tokens: TokenBreakdown = {
	inputTokens: 1000,
	outputTokens: 500,
	reasoningTokens: 200,
	cacheRead: 100,
};

const modelPricing: ModelPricing = {
	"openai/gpt-4o": { prompt: 0.000005, completion: 0.000015, cacheRead: 0.0000025 },
	"anthropic/claude-sonnet": { prompt: 0.000003, completion: 0.000015, cacheRead: 0.0000003 },
};

test("computes cost breakdown for each model", () => {
	const results = computeModelCostEstimates(["openai/gpt-4o"], modelPricing, tokens);
	expect(results).toHaveLength(1);
	const estimate = results[0];
	expect(estimate.modelId).toBe("openai/gpt-4o");
	expect(estimate.breakdown).toHaveLength(4);
	expect(estimate.breakdown[0].label).toBe("Input");
	expect(estimate.breakdown[0].tokens).toBe(1000);
	expect(estimate.breakdown[0].cost).toBeCloseTo(0.005, 6);
	expect(estimate.breakdown[1].label).toBe("Output");
	expect(estimate.breakdown[1].cost).toBeCloseTo(0.0075, 6);
});

test("sums total cost from breakdown", () => {
	const results = computeModelCostEstimates(["openai/gpt-4o"], modelPricing, tokens);
	const expectedCost = 1000 * 0.000005 + 500 * 0.000015 + 200 * 0.000015 + 100 * 0.0000025;
	expect(results[0].cost).toBeCloseTo(expectedCost, 6);
});

const resultLengthCases: Array<[string, ModelPricing, TokenBreakdown, number]> = [
	[JSON.stringify(["unknown/model", "openai/gpt-4o"]), modelPricing, tokens, 1],
	[JSON.stringify([]), modelPricing, tokens, 0],
];

test.each(resultLengthCases)("computeModelCostEstimates filters correctly - ids=%p => %p results", (idsJson, pricing, toks, expectedLen) => {
	const ids = JSON.parse(idsJson) as string[];
	const results = computeModelCostEstimates(ids, pricing, toks);
	expect(results).toHaveLength(expectedLen);
});

test("filters out zero-cost estimates", () => {
	const zeroPricing: ModelPricing = {
		"free/model": { prompt: 0, completion: 0, cacheRead: 0 },
	};
	const results = computeModelCostEstimates(["free/model"], zeroPricing, tokens);
	expect(results).toHaveLength(0);
});

test("sorts results by cost descending", () => {
	const results = computeModelCostEstimates(
		["anthropic/claude-sonnet", "openai/gpt-4o"],
		modelPricing,
		tokens,
	);
	expect(results).toHaveLength(2);
	expect(results[0].cost).toBeGreaterThan(results[1].cost);
});
