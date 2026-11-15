---
title: "TypeScript Standards"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*.ts", "**/*.tsx"]
dependencies: ["../core-principles.md", "../code-review.md", "../testing.md", "../agent-workflow.md"]
last_updated: "2026-11-14"
---

# TypeScript Standards

Rules for TypeScript projects. They add to the stack-neutral standards one
folder up. Each project's own standards define its architecture, its package
manager commands and its decision records.

## Language

- **Strict mode** is on in every `tsconfig`.
- **No `any`:** use precise types, generics or `unknown` with narrowing.
- **No non-null assertions** (`!`) outside tests.
- **Exhaustive unions:** a new case of a union must fail to compile or lint.
  Prefer a `Record<Union, ...>` table where a choice only picks a value. A
  `switch` handles each case and has a declared return type or assigns every
  path, with `@typescript-eslint/switch-exhaustiveness-check` on. No unreachable
  `default` branch only to hold a `never` check, as coverage cannot reach it.
- **Validated boundaries:** data from outside the program (requests,
  environment, files, storage) is parsed against a schema before use, and the
  type comes from that schema.

## Tests

- Unit and integration tests sit next to the code they test, named after it
  with `.test` before the extension, such as `people-service.test.ts` beside
  `people-service.ts`.
- UI tests live in their own folder within the application they test, such as
  `e2e/`.
- Shared test helpers and factories live in a shared package, not copied
  between tests.
- Test files are excluded from builds, so they never reach production
  artifacts.

## Tooling

- One project command runs linting, type checking and the test suites, such as
  `pnpm check`. It is the full suite, which the
  [Agent Workflow](../agent-workflow.md#workflow) runs after the code review.
  Before the review, run the project's targeted tests and linters.
- Markdown is linted by the project's Markdown linter, such as `pnpm lint:md`.

## Code Review Criteria

Add these to the focus areas in [code-review.md](../code-review.md):

- `any`, non-null assertions outside tests, or a non-exhaustive union.
- Unvalidated external input, or types asserted with `as` instead of parsed.
- Tests outside the naming and location rules above.
