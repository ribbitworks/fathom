# UI Tests in a Real Browser

- **ADR:** 0013
- **Status:** Accepted
- **Date:** 2026-11-24

## Context

A change to a form's behaviour, such as its refusals, where focus goes or what it saves, needs a UI test in a real browser that fails before the change and passes after it, as [Testing Standards § UI Tests](../standards/testing.md#ui-tests) requires.

The unit tests run in jsdom, which doesn't lay out a page, move focus as a browser does, or talk to the server. [ADR 0002](0002-libraries.md) chose Playwright for UI tests but hadn't adopted it.

## Options

- **Playwright,** in its own command, against the copy's development server.
- **Vitest's browser mode,** which runs component tests in a real browser, but without the server, the database or signing in.
- **Playwright in every check,** starting the server and database itself.
- **A database of its own,** as [issue #232](https://github.com/ribbitworks/fathom/issues/232) suggests, such as a clone number kept for the UI tests, or the production-like stack.

## Decision

Playwright, Apache-2.0, runs the UI tests with `pnpm test:ui`, against the copy's running development server, after reseeding its fictional data.

- **The tests** live in `apps/web/e2e/`, named `*.test.ts`, with helpers named `test-*.ts`.
- **The browser** is Chromium, which the command installs the first time.
- **Not a database of its own:** a second server and database would add minutes to each run, and the tests would no longer see the code as `pnpm dev` serves it while it's being changed.
- **Each test makes its own records,** with names of its own, and compares before and after, since the data is reseeded once a run, not before each test.
- **Not in the checks:** `pnpm check` and `pnpm check:push` stay fast, and the Check workflow doesn't run them yet. Running them on GitHub needs the database, the server and a browser on each runner, a few minutes per run; it's worth adding once there are enough UI tests to earn it.

## Consequences

- **Through the real stack:** a test signs in, uses the real server and database, and sees what a person sees.
- **It reseeds the development database,** as `pnpm db:reseed` does: the fictional data starts afresh and what was added by hand is kept. The development accounts are deactivated and seeded again, which signs out anyone using that copy.
- **Run by hand:** the author of a form change runs them before its pull request, and its review runs them again, as [Code Review Standards](../standards/code-review.md#user-experience-and-accessibility) sets out.
- **One at a time:** the tests share one database, so they run in turn.
