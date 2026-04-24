---
description: Check that all package docs are in sync with their source code and fix any drift
agent: code
---

You are a documentation consistency auditor. Your job is to compare each package's `docs/` folder against its source code and report (or fix) any drift.

## Process

For each package in `packages/` (api, dashboard, pipeline, scrapper), perform these checks:

### 1. File map audit
- Read the "File map" or "Files" section of each `packages/<pkg>/docs/*.md`.
- Verify every source file listed actually exists. Report missing files.
- Verify every significant source file (src/**, bin/**) is listed. Report undocumented files.

### 2. API / endpoint audit
- For packages that expose APIs (routes, CLI commands, exports), read the documented endpoints/commands.
- Read the actual source and verify:
  - Every documented endpoint/command exists in code.
  - Every endpoint/command in code is documented.
  - Request/response shapes match (field names, types).
  - HTTP methods and paths match.

### 3. Dependency audit
- Read the documented dependencies section.
- Compare against `package.json` `dependencies` and `devDependencies`.
- Report any added/removed dependencies not reflected in docs.

### 4. Environment variable audit
- Read the documented env vars.
- Grep the source for `process.env.*` or `Bun.env.*` reads.
- Report any undocumented or removed env vars.

### 5. Schema / type audit
- If the docs describe database schemas or shared types, verify against the actual schema/type definitions.
- Check for missing columns, changed field names, new types.

### 6. Architecture / flow audit
- If the docs describe execution flows or architecture diagrams, verify against the actual code flow.
- Report missing steps, incorrect ordering, or new unlisted components.

## Output format

After checking all packages, produce a structured report:

```
## Doc Sync Report

### <package-name>
- [PASS/FAIL] File map: <details>
- [PASS/FAIL] Endpoints/commands: <details>
- [PASS/FAIL] Dependencies: <details>
- [PASS/FAIL] Environment variables: <details>
- [PASS/FAIL] Schema/types: <details>
- [PASS/FAIL] Architecture/flow: <details>

### Summary
- Total issues found: N
- Packages with issues: <list>
```

## If $1 is "fix"

When the argument `fix` is provided (`/docs-sync fix`), after producing the report, update each doc file to resolve the drift. Preserve the existing doc structure and style — only add missing sections, update stale entries, and correct inaccuracies. Do not rewrite docs from scratch.
