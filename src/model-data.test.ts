import { expect, test } from "bun:test";
import { toOpenRouterModelId } from "@/model-data";

const cases = [
	["any", "openai/gpt-4o", "openai/gpt-4o"],
	["any", "openai/gpt-4o:latest", "openai/gpt-4o"],
	["openai", "gpt-4o", "openai/gpt-4o"],
	["anthropic", "claude-sonnet-4", "anthropic/claude-sonnet-4"],
	["deepseek", "deepseek-r1", "deepseek/deepseek-r1"],
	["zai", "model-x", "z-ai/model-x"],
	["unknown-provider", "some-model", "unknown-provider/some-model"],
] as const;

test.each(cases)("toOpenRouterModelId(%p, %p) => %p", (provider, model, expected) => {
	expect(toOpenRouterModelId(provider, model)).toBe(expected);
});
