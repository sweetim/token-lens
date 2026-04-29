import { expect, test } from "bun:test";
import { formatTokensCompact, formatDurationMs, normalizeModelNameForMatch } from "@/view-helpers";

const normalizeModelNameCases = [
  ["anthropic/claude-sonnet-4.6", "claude-sonnet-4.6"],
  ["openai/gpt-4o", "gpt-4o"],
  ["anthropic/claude-sonnet-4-6", "claude-sonnet-4.6"],
  ["openai/gpt-4-1", "gpt-4.1"],
  ["provider/model-3-5-turbo-1-2", "model-3.5-turbo-1.2"],
  ["claude-sonnet-4-6", "claude-sonnet-4.6"],
  ["deepseek/deepseek-r1", "deepseek-r1"],
] as const;

test.each(normalizeModelNameCases)("%p => %p", (input: string, expected: string) => {
  expect(normalizeModelNameForMatch(input)).toBe(expected);
});

const formatTokensCompactCases = [
  [0, "0"],
  [42, "42"],
  [999, "999"],
  [1000, "1.0K"],
  [1500, "1.5K"],
  [999999, "1000.0K"],
  [1_000_000, "1.0M"],
  [2_500_000, "2.5M"],
] as const;

test.each(formatTokensCompactCases)("formatTokensCompact(%p) => %p", (input, expected) => {
  expect(formatTokensCompact(input)).toBe(expected);
});

const formatDurationCases = [
  [-1, "0m"],
  [0, "0m"],
  [30_000, "0m"],
  [59_999, "0m"],
  [60_000, "1m"],
  [90_000, "1m"],
  [120_000, "2m"],
  [3_600_000, "1h 0m"],
  [3_660_000, "1h 1m"],
  [7_200_000, "2h 0m"],
  [86_400_000, "1d"],
  [86_400_000 + 3_600_000, "1d 1h"],
  [172_800_000, "2d"],
  [172_800_000 + 7_200_000, "2d 2h"],
  [259_200_000, "3d"],
] as const;

test.each(formatDurationCases)("formatDurationMs(%d) => %p", (input, expected) => {
  expect(formatDurationMs(input)).toBe(expected);
});
