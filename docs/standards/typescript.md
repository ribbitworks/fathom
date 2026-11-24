---
title: "TypeScript Standards"
category: "Standards"
audience: "Contributors"
applies_to: ["**/*.ts", "**/*.tsx"]
dependencies: ["docs/standards/core-principles.md", "docs/standards/code-review.md", "docs/standards/testing.md"]
last_updated: "2026-11-24"
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
  - Prefer a `Record<Union, ...>` table where a choice only picks a value.
  - A `switch` handles each case and has a declared return type or assigns
    every path, with `@typescript-eslint/switch-exhaustiveness-check` on.
  - No unreachable `default` branch only to hold a `never` check, as coverage
    cannot reach it.
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
  artifacts. A helper only the tests use that sits beside the code, such as
  `apps/server/src/test-app.ts`, is named `test-*.ts` or `test-*.tsx`, so the
  application image leaves it out, and is left out of its package's coverage.

## Tooling

- `pnpm check` runs linting, type checking and the test suites. It is the full suite, which the
  Check workflow runs on every pull request but one of documentation alone, as
  [Checks and CI](../design/checks-and-ci.md#the-check-on-github) sets out. Before the review, run
  `pnpm check:push`.
- Markdown is linted with `pnpm lint:md`.

## Code Review Criteria

Add these to the focus areas in [code-review.md](code-review.md):

- `any`, non-null assertions outside tests, or a non-exhaustive union.
- Unvalidated external input, or types asserted with `as` instead of parsed.
- Tests outside the naming and location rules above.
