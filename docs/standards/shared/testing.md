---
title: "Testing Standards"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*"]
dependencies: ["agent-workflow.md", "code-review.md"]
last_updated: "2026-11-01"
---

# Testing Standards

How changes are tested. Every change that adds or changes behavior includes its
tests in the same change, and tests run as part of
[agent-workflow.md](agent-workflow.md). Frameworks, tags, test plans and file
layout are set by each language folder and the project's own standards.

## Principles

- **Behavior, not implementation:** tests describe what the code does for its
  users and callers, so they survive refactoring.
- **Deterministic:** a test gives the same result on every run and every
  machine. Time, randomness and IDs are injected or controlled by the test, and
  tests do not depend on test order or on the network.
- **Isolated:** each test sets up and cleans up its own data, with no shared
  mutable state between tests.
- **Fictional data:** test data is invented, never copied or derived from real
  data, including anonymized copies.
- **Minimal:** use the fewest tests that cover the required behavior and its
  edge cases. Do not test the same path in several suites.
- **Fast feedback:** most tests are unit tests that run in seconds; slower tests
  are kept to what needs them.

## What Every Change Must Test

- **New behavior:** unit tests for its rules, and integration tests for each
  new or changed operation that crosses a boundary (persistence, an API, a
  device or service).
- **Bug fixes:** a test that fails without the fix, written before the fix.
  Mark it as a regression test where the project has a tag for that.
- **Edge cases and errors:** boundaries, empty and missing values, invalid
  input, and each error path, not only the successful path.
- **Validation:** every validator is tested with valid input and with each kind
  of invalid input it rejects.
- **Configuration:** invalid or missing configuration stops start-up with a
  clear error, and a test proves it.

## Coverage

- **Required:** 100% branch coverage of domain logic, validation, service
  workflows and the data access layer.
- **Everything else:** measured and reported; significant untested code is
  explained in the code review.
- **Does not count:** UI layout and animation, previews, fixtures, generated
  code, and passthrough wrappers with no logic.

Coverage numbers support review; they do not replace judgment about whether the
right behavior is tested.

## What Not to Test

- UI layout in unit tests; use UI tests when a journey needs it.
- Framework or third-party library internals.
- Constants files and one-line getters that encode no rule.

## Writing Tests

- **Names describe behavior:** for example, "rejects an expired session" or
  `pausingBlockDoesNotPauseSessionClock`, never "test session 3". Be consistent
  within a file.
- **One behavior per test:** arrange the data, act once, assert the outcome.
  Mark the phases with `Given`, `When` and `Then` comments in non-trivial
  tests.
- **Drive through the public surface:** set up and mutate state through the
  same APIs callers use, not by poking storage directly.
- **No sleeping:** tests wait for conditions or advance a controlled clock,
  never wait for fixed amounts of time.
- **Flaky tests:** a test that fails intermittently is fixed, or reported to the
  owner. Tests are never removed, skipped or weakened without the owner's
  approval.

## Test Data

- **Factories:** tests build data with factories that produce realistic,
  fictional records with sensible defaults, overriding only what each test
  needs.
- **Seed data:** development and demonstration data comes from a generator with
  a fixed seed, so it is the same every time.
- **Schema from migrations:** integration tests build any database schema by
  applying the project's migrations, never another way.
- **Clean state:** each integration test starts from a known state, such as an
  in-memory store, a rolled-back transaction or a fresh schema.

## Smoke Suites

Where a project has a fast smoke suite for pre-push or CI, it delegates to
existing tests instead of duplicating them, and stays small: the critical path
only, not a second copy of the full suite. Each addition is justified.

## UI Tests

UI tests are not required on every change. A new user flow lists a short UI
test roadmap (happy path first, then the main variations) in the pull request
or feature document, and interactive elements carry accessibility identifiers.

## Running Tests

Run tests only through the project's test command. If any category cannot run,
for example because a simulator or container runtime is missing, stop and tell
the owner; never report the tests as passing.

## Checklist

- [ ] New behavior, bug fixes and error paths are covered.
- [ ] Tests are deterministic: no real time, randomness, network or test order.
- [ ] Test data is fictional.
- [ ] Required coverage holds.
- [ ] Names describe the behavior under test.
- [ ] Smoke suite additions delegate and are essential.
- [ ] New UI flows list their UI test roadmap.
