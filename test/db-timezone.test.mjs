import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { build } from "esbuild";

let bundledModule;
let tempDirectory;

before(async () => {
  tempDirectory = await import("node:fs/promises").then(({ mkdtemp }) => mkdtemp(join(tmpdir(), "token-lens-db-test-")));
  const outfile = join(tempDirectory, "db-test-module.mjs");

  await build({
    stdin: {
      contents: 'export { buildLocalTimezoneModifier } from "./src/db.ts";',
      loader: "ts",
      resolveDir: process.cwd(),
      sourcefile: "db-test-entry.ts",
    },
    bundle: true,
    external: ["vscode"],
    format: "esm",
    logLevel: "silent",
    outfile,
    platform: "node",
  });

  bundledModule = await import(pathToFileURL(outfile).href);
});

after(async () => {
  if (tempDirectory) {
    await rm(tempDirectory, { force: true, recursive: true });
  }
});

test("buildLocalTimezoneModifier preserves positive offsets", () => {
  assert.equal(bundledModule.buildLocalTimezoneModifier(540), "'unixepoch', '+9 hours'");
  assert.equal(bundledModule.buildLocalTimezoneModifier(345), "'unixepoch', '+5 hours', '+45 minutes'");
});

test("buildLocalTimezoneModifier preserves negative offsets", () => {
  assert.equal(bundledModule.buildLocalTimezoneModifier(-210), "'unixepoch', '-3 hours', '-30 minutes'");
});
