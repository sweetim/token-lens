import { expect, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { buildLocalTimezoneModifier, getDatabasePath, setDatabasePath, toProjectDisplayName } from "@/db";

test("buildLocalTimezoneModifier preserves positive offsets", () => {
  expect(buildLocalTimezoneModifier(540)).toBe("'unixepoch', '+9 hours'");
  expect(buildLocalTimezoneModifier(345)).toBe("'unixepoch', '+5 hours', '+45 minutes'");
});

test("buildLocalTimezoneModifier preserves negative offsets", () => {
  expect(buildLocalTimezoneModifier(-210)).toBe("'unixepoch', '-3 hours', '-30 minutes'");
});

test("toProjectDisplayName strips the home directory prefix", () => {
  expect(toProjectDisplayName(join(homedir(), "projects", "token-lens"))).toBe(join("projects", "token-lens"));
});

test("toProjectDisplayName keeps paths outside the home directory unchanged", () => {
  expect(toProjectDisplayName("/srv/repos/api")).toBe("/srv/repos/api");
});

test("setDatabasePath overrides the default and blank restores it", () => {
  const defaultPath = getDatabasePath();
  setDatabasePath("/tmp/custom/kilo.db");
  expect(getDatabasePath()).toBe("/tmp/custom/kilo.db");
  setDatabasePath("   ");
  expect(getDatabasePath()).toBe(defaultPath);
});
