import { expect, test } from "bun:test";
import dayjs from "dayjs";
import { formatTokens, formatDurationMs, formatDay } from "@/format";

const formatTokensCases = [
	[0, "0"],
	[42, "42"],
	[999, "999"],
	[1000, "1.0K"],
	[1500, "1.5K"],
	[999999, "1000.0K"],
	[1_000_000, "1.0M"],
	[2_500_000, "2.5M"],
	[123_456_789, "123.5M"],
] as const;

test.each(formatTokensCases)("formatTokens(%p) => %p", (input, expected) => {
	expect(formatTokens(input)).toBe(expected);
});

const formatDurationCases = [
	[-100, "0m"],
	[0, "0m"],
	[30000, "0m"],
	[60000, "1m"],
	[1800000, "30m"],
	[3600000, "1h 0m"],
	[5400000, "1h 30m"],
	[86400000, "1d"],
	[90000000, "1d 1h"],
	[104400000, "1d 5h"],
	[172800000, "2d"],
] as const;

test.each(formatDurationCases)("formatDurationMs(%p) => %p", (input, expected) => {
	expect(formatDurationMs(input)).toBe(expected);
});

test("formatDay returns Today for today", () => {
	expect(formatDay(dayjs().format("YYYY-MM-DD"))).toBe("Today");
});

test("formatDay returns Yesterday for yesterday", () => {
	expect(formatDay(dayjs().subtract(1, "day").format("YYYY-MM-DD"))).toBe("Yesterday");
});

const formatDayCases = [
	["2025-01-15", "Jan 15"],
	["2024-12-25", "Dec 25"],
] as const;

test.each(formatDayCases)("formatDay(%p) => %p", (input, expected) => {
	expect(formatDay(input)).toBe(expected);
});
