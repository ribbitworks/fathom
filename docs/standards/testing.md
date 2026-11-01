---
title: "Testing Standards (Fathom)"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*"]
dependencies: ["docs/standards/shared/testing.md", "docs/standards/shared/typescript/typescript.md"]
last_updated: "2026-11-01"
---

# Testing Standards

Fathom's additions to the shared [Testing Standards](shared/testing.md), which define the principles, what every change must test, coverage, test data and how tests are written. Test locations for TypeScript are in [TypeScript Standards](shared/typescript/typescript.md#tests). Test tools are chosen in the project's architecture decision records.

## Test Types

| Type | What it covers | Runs |
| --- | --- | --- |
| Unit | Domain rules, calculations, validation, and other logic without I/O | Every change |
| Integration | The API and data access working together against a real database of the same kind as production | Every change |
| Access control | Every role's access to every protected operation and every level of protected data, allowed and denied | Every change |
| Security | Input handling, sessions, request forgery protection, rate limiting, audit records, and log contents | Every change |
| Container | Behavior that needs the built containers, such as network isolation | Every change that affects the containers, and before a stage is complete |
| UI | Key user journeys in a real browser | Not required for each change and not run in the workflow's test step; run when the user asks, and passing before a stage is complete |

Every new or changed API operation has integration tests, as well as unit tests for its rules.

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

## Coverage Enforcement

The coverage tool is configured so the test command fails below the shared 100% threshold for the code it covers.

## Running Tests

`pnpm check` runs ESLint, the Prettier formatting check, type checking, Markdown, shell, PowerShell and licence linting, the unit, integration, access control and security tests, and the build-time security scans. Container tests run with `pnpm test:containers`, and UI tests have their own command once they are added. If any category cannot run, for example because no container runtime is available, stop and tell the user; never report the tests as passing.
