---
title: "TypeScript Standards"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*.ts", "**/*.tsx"]
dependencies: ["docs/standards/core-principles.md", "docs/standards/code-review.md", "docs/standards/testing.md", "docs/standards/agent-workflow.md"]
last_updated: "2026-11-19"
---

# TypeScript Standards

Rules for Fathom's TypeScript code, on top of
[Core Development Principles](core-principles.md). Its architecture is in the
design documents, its commands in `AGENTS.md`, and its decisions in `docs/adr/`.

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

- `pnpm check` runs linting, type checking and the test suites. It is the full suite, which the
  Check workflow runs on every pull request but one of documentation alone, as the
  [Agent Workflow](agent-workflow.md#workflow) and
  [Testing Standards](testing.md#running-tests) set out. Before the review, run
  `pnpm check:push`.
- Markdown is linted with `pnpm lint:md`.

## Code Review Criteria

Add these to the focus areas in [code-review.md](code-review.md):

- `any`, non-null assertions outside tests, or a non-exhaustive union.
- Unvalidated external input, or types asserted with `as` instead of parsed.
- Tests outside the naming and location rules above.
