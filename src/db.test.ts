import { expect, test } from "bun:test";
import { buildLocalTimezoneModifier } from "@/db";

test("buildLocalTimezoneModifier preserves positive offsets", () => {
  expect(buildLocalTimezoneModifier(540)).toBe("'unixepoch', '+9 hours'");
  expect(buildLocalTimezoneModifier(345)).toBe("'unixepoch', '+5 hours', '+45 minutes'");
});

test("buildLocalTimezoneModifier preserves negative offsets", () => {
  expect(buildLocalTimezoneModifier(-210)).toBe("'unixepoch', '-3 hours', '-30 minutes'");
});
