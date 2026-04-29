import { expect, test } from "bun:test";
import { buildPricingStateData, buildCostEntries, buildProjectModelIds } from "@/webview/data";
import type { ModelData } from "@/model-data";
import type { ProjectTokens, ModelCost } from "@/types";
import type { TokenBreakdown, PricingStatus } from "@/webview-contract";

const pricingStateCases: Array<[PricingStatus, string]> = [
	["loading", "Loading OpenRouter model prices..."],
	["cached", "Using cached OpenRouter model prices."],
	["unavailable", "OpenRouter prices could not be loaded. Token usage is still available."],
	["ready", "OpenRouter model prices updated."],
];

test.each(pricingStateCases)("buildPricingStateData(%p) => message %p", (status, expectedMessage) => {
	expect(buildPricingStateData(status)).toEqual({ status, message: expectedMessage });
});

test("buildCostEntries computes cost from grand tokens and pricing", () => {
	const grandTokens: TokenBreakdown = { inputTokens: 1000, outputTokens: 500, reasoningTokens: 200, cacheRead: 100 };
	const modelData: ModelData = {
		createdDates: { "openai/gpt-4o": 1700000000 },
		pricing: { "openai/gpt-4o": { prompt: 0.000005, completion: 0.000015, cacheRead: 0.0000025 } },
	};
	const entries = buildCostEntries(grandTokens, modelData);
	expect(entries).toHaveLength(1);
	expect(entries[0].modelId).toBe("openai/gpt-4o");
	expect(entries[0].provider).toBe("openai");
	const expectedCost = 1000 * 0.000005 + 500 * 0.000015 + 200 * 0.000015 + 100 * 0.0000025;
	expect(entries[0].cost).toBeCloseTo(expectedCost, 6);
});

test("buildCostEntries filters out zero-cost entries", () => {
	const grandTokens: TokenBreakdown = { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheRead: 0 };
	const modelData: ModelData = {
		createdDates: {},
		pricing: { "free/model": { prompt: 0, completion: 0, cacheRead: 0 } },
	};
	const entries = buildCostEntries(grandTokens, modelData);
	expect(entries).toHaveLength(0);
});

test("buildCostEntries sorts by cost ascending", () => {
	const grandTokens: TokenBreakdown = { inputTokens: 1000, outputTokens: 0, reasoningTokens: 0, cacheRead: 0 };
	const modelData: ModelData = {
		createdDates: {},
		pricing: {
			"cheap/model": { prompt: 0.000001, completion: 0, cacheRead: 0 },
			"expensive/model": { prompt: 0.00001, completion: 0, cacheRead: 0 },
		},
	};
	const entries = buildCostEntries(grandTokens, modelData);
	expect(entries).toHaveLength(2);
	expect(entries[0].cost).toBeLessThan(entries[1].cost);
});

const makeProject = (project: string): ProjectTokens => ({
	project,
	totalTokens: 100,
	inputTokens: 50,
	outputTokens: 50,
	reasoningTokens: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalCost: 0,
	steps: 1,
	sessions: 1,
	duration: 0,
	models: [],
});

const makeModelCost = (project: string, provider: string, model: string): ModelCost => ({
	project,
	provider,
	model,
	inputTokens: 50,
	outputTokens: 50,
	reasoningTokens: 0,
	cacheRead: 0,
});

test("buildProjectModelIds filters by allowed providers", () => {
	const projects = [makeProject("p1")];
	const modelCosts = [
		makeModelCost("p1", "openai", "gpt-4o"),
		makeModelCost("p1", "unknown", "mystery"),
	];
	const modelData: ModelData = {
		createdDates: { "openai/gpt-4o": Date.now() / 1000 - 1000 },
		pricing: {},
	};
	const result = buildProjectModelIds(projects, modelCosts, modelData);
	expect(result["p1"]).toEqual(["openai/gpt-4o"]);
});

test("buildProjectModelIds filters out models older than 3 months", () => {
	const now = Date.now();
	const projects = [makeProject("p1")];
	const modelCosts = [
		makeModelCost("p1", "openai", "old-model"),
		makeModelCost("p1", "openai", "new-model"),
	];
	const modelData: ModelData = {
		createdDates: {
			"openai/old-model": (now - 91 * 24 * 60 * 60 * 1000) / 1000,
			"openai/new-model": (now - 1000) / 1000,
		},
		pricing: {},
	};
	const result = buildProjectModelIds(projects, modelCosts, modelData);
	expect(result["p1"]).toEqual(["openai/new-model"]);
});

test("buildProjectModelIds filters out models without createdDate", () => {
	const projects = [makeProject("p1")];
	const modelCosts = [makeModelCost("p1", "openai", "missing-date")];
	const modelData: ModelData = { createdDates: {}, pricing: {} };
	const result = buildProjectModelIds(projects, modelCosts, modelData);
	expect(result["p1"]).toEqual([]);
});
