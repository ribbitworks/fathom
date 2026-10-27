---
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*"]
dependencies: ["docs/standards/markdown-style-guidelines.md"]
last_updated: "2026-10-27"
---

# Testing Standards

This document defines how changes are tested. Every change that adds or changes behavior includes its tests in the same change, and tests run as part of the [Workflow](../../AGENTS.md#workflow). Test tools are chosen in the project's architecture decision records.

## Principles

- **Behavior, not implementation:** Tests describe what the code does for its users and callers, so they survive refactoring.
- **Deterministic:** A test gives the same result on every run and every machine. Time and randomness are injected or controlled by the test, and tests do not depend on test order or on network access outside the test environment.
- **Isolated:** Each test sets up and cleans up its own data, and does not depend on another test.
- **Fictional data:** Test data is invented, and never copied or derived from real data, including anonymized copies, as the [Data](../../AGENTS.md#data) rules require.
- **Fast feedback:** Most tests are unit tests that run in seconds; slower tests are kept to what needs them.

## Test Types

| Type | What it covers | Runs |
| --- | --- | --- |
| Unit | Domain rules, calculations, validation, and other logic without I/O | Every change |
| Integration | The API and data access working together against a real database of the same kind as production | Every change |
| Access control | Every role's access to every protected operation and every level of protected data, allowed and denied | Every change |
| Security | Input handling, sessions, request forgery protection, rate limiting, audit records, and log contents | Every change |
| Container | Behavior that needs the built containers, such as network isolation | Every change that affects the containers, and before a stage is complete |
| UI | Key user journeys in a real browser | Not required for each change and not run in the workflow's test step; run when the user asks, and passing before a stage is complete |

## What Every Change Must Test

- **New behavior:** Unit tests for its rules, and integration tests for each new or changed API operation.
- **Bug fixes:** A test that fails without the fix, written before the fix.
- **Edge cases and errors:** Boundaries, empty and missing values, invalid input, and each error response, not only the successful path.
- **Validation:** Every input schema is tested with valid input and with each kind of invalid input it rejects.
- **Configuration:** Invalid or missing configuration stops start-up with a clear error, and a test proves it.

## Access Control Tests

Access control is tested as thoroughly as the features it protects:

- **Every role, allowed and denied:** For each protected operation, a test for every role that should be allowed and every role that should be denied. Denials matter as much as allowed access.
- **Signed out:** Every protected operation rejects requests without a valid session.
- **Data, not just screens:** Responses are checked to contain no fields above the caller's access, rather than relying on the user interface to hide them.
- **Every path to the data:** Lists, single records, search, exports, and every other way the project reads data are each tested.
- **Changes to access:** Role changes and account deactivation take effect on the next request.
- **No self-escalation:** No user can grant themselves more access, including administrators changing their own roles.

## Security Tests

- **Injection:** Inputs that try SQL injection or script injection are rejected or made harmless.
- **Sessions:** Cookies have the required security attributes, sessions expire, and signing out ends the session.
- **Request forgery:** Requests that change data from another origin are rejected.
- **Rate limiting:** Repeated sign-in attempts are slowed or blocked.
- **Audit records:** Viewing or changing sensitive data creates the expected audit record, without the sensitive values, and no role can edit or delete audit records.
- **Logs:** Tests put known marker values in personal fields and check that they never appear in captured logs or audit records.
- **Network isolation:** Where the project requires it, a container test confirms from inside each container that it cannot reach the internet.

## Test Data

- **Factories:** Tests build data with factories that produce realistic, fictional records with sensible defaults, overriding only what each test needs.
- **Seed data:** Development and demonstration data comes from a generator that produces fictional data from a fixed seed, so it is the same every time.
- **Schema from migrations:** Integration tests build the database schema by applying the project's migration files to an empty database, never by creating the schema another way.
- **Clean state:** Each integration test starts from a known database state, for example by running inside a transaction that is rolled back, or by using a fresh schema.

## Coverage

- **Required:** Branch coverage of domain logic, validation, service workflows, and the data access layer is 100%. The coverage tool is configured so the test command fails below that threshold for that code.
- **Everything else:** Coverage is measured and reported, and any significant untested code is explained in the code review.

Coverage numbers support review; they do not replace judgment about whether the right behavior is tested.

## Writing Tests

- **Names describe behavior:** For example, "rejects an expired session" rather than "test session 3".
- **One behavior per test:** Arrange the data, act once, and assert the outcome.
- **No sleeping:** Tests wait for conditions, never for fixed amounts of time.
- **Flaky tests:** A test that fails intermittently is fixed, or reported to the user. Tests are never removed, skipped, or weakened without the user's approval.

## Running Tests

One command runs linting, type checking, and the unit, integration, access control, and security tests, along with the build-time security scans. Container tests and UI tests have their own commands. If any category cannot run, for example because no container runtime is available, stop and tell the user; never report the tests as passing.
