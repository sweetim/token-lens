## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- Present your plan to the user and wait for their approval before writing any code.
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Keep Docs in Sync

**When you change code, update the corresponding docs.**

- If you add, remove, or rename a source file, update the file map in `docs/`.
- If you add, remove, or change a command, endpoint, or export, update the documented API surface.
- If you add or remove a dependency, update the documented dependency list.
- If you add or change an environment variable, update the documented env var list.
- If you add, remove, or modify a type or schema, update the documented type definitions.
- If you change an execution flow or architecture, update the documented flow description.

The rule: every implementation change must include a corresponding doc change. Don't leave docs stale.

## 6. Test & Verify

**Match verification to the type of change.**

- **Logic changes**: Write unit tests that exercise the new or changed behavior. Run them and confirm they pass before finishing.
- **UI changes**: Do not write automated tests. Instead, end your response with a brief list of specific things the user should manually check (e.g., "Verify the button is disabled when X", "Confirm the modal closes on save").

# Coding Rules

- Use `type` instead of `interface` when defining TypeScript types to ensure
  consistency and avoid unintended interface merging.
- Prefer [`ts-pattern@5`](https://github.com/gvergnaud/ts-pattern) for pattern
  matching and exhaustive type handling whenever possible.
- Don't use abbreviations, always use full names.

