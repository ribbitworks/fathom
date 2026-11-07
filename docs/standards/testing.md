---
title: "Testing Standards (Fathom)"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*"]
dependencies: ["docs/standards/shared/testing.md", "docs/standards/shared/typescript/typescript.md"]
last_updated: "2026-11-07"
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
| Manual | What a person sees and does in a feature, by hand in a real browser, as [Manual Tests](#manual-tests) describes | Before a stage that changes the feature is complete, and when the owner asks |

Every new or changed API operation has integration tests, as well as unit tests for its rules.

Until Fathom is first deployed with real data, migrations have no upgrade tests, since no migration converts existing data and databases are reset instead, as the [Decisions Log](../product/decisions.md#platform-and-operations) records.

## Access Control Tests

Access control is tested as thoroughly as the features it protects:

- **Every role, allowed and denied:** For each protected operation, a test for every role that should be allowed and every role that should be denied. Denials matter as much as allowed access.
- **Signed out:** Every protected operation rejects requests without a valid session.
- **Data, not just screens:** Responses are checked to contain no fields above the caller's access, rather than relying on the user interface to hide them.
- **Every path to the data:** Lists, single records, search, exports, and every other way the project reads data are each tested.
- **Changes to access:** Role changes and account deactivation take effect on the next request.
- **No self-escalation:** No user can grant themselves more access, except Administrators managing their own account as [Roles](../product/roles.md#safeguards-for-administrators) decides. Tests cover both guards (the last active Administrator keeps the role and stays active, and nobody resets their own password from Accounts) and that every change Administrators make to their own account is recorded in the access history.

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

Whole files that only start a program or serve the tests, such as the server's `main.ts`, are left out in the coverage settings, with a comment saying why. Other code may be left untested only with a `/* v8 ignore */` comment that says why, and only in two cases:

- **Command-line entry points:** In any package, the lines that start a command when it runs as its own process, where the tests call the command's function instead.
- **Screen layout:** In the web app, a branch that only arranges the screen or animates it, with no logic, as the shared standard's "Does not count" allows.

Logic, validation, access checks and data handling are never excluded. The code review judges each exclusion.

## Running Tests

`pnpm check` runs ESLint, the Prettier formatting check, type checking, Markdown, shell, PowerShell and licence linting, the unit, integration, access control and security tests, and the build-time security scans. Container tests run with `pnpm test:containers`, and UI tests have their own command once they are added. If any category cannot run, for example because no container runtime is available, stop and tell the user; never report the tests as passing.

While working, and for each fix that follows a review, UI feedback or owner feedback, run `pnpm test`, `pnpm lint`, `pnpm format:check`, and `pnpm lint:md` or `pnpm lint:shell` for the files changed. The workflow's test step runs the full `pnpm check` once before the code review, and once more after each round of feedback is fixed, not after each fix within it. A change that affects the containers runs `pnpm test:containers` with that step, and again only if a later fix changes the containers. A change to documentation only may skip the test step, as [agent-workflow.md](shared/agent-workflow.md#autonomous-mode) allows.

## Manual Tests

A manual test is a test specification a test engineer, including one new to Fathom, runs by hand in a browser. Each is kept in `docs/testing/`, named `<feature>-manual-test.md`, such as [Drafts](../testing/drafts-manual-test.md), and has these sections:

- **Scope:** one or two sentences on what the test verifies.
- **Test Environment:** what must be running and set up, with links to the documents that say how.
- **Test Accounts:** each account the test uses, named by its role in Fathom, with its email address, its name as Fathom shows it, what it can do, which procedure creates it, and where its password comes from.
- **Common Procedures:** numbered procedures the test cases refer to: starting Fathom, each way of restoring or resetting the data, with the exact commands, which terminal runs them, how to confirm they worked, and what each deletes, and signing in and out.
- **Terms:** where on screen any menu or control the steps name is found, when its label alone does not say.
- **Test Cases:** each with an ID, such as `DRAFT-01`, a title saying what it verifies, its preconditions (the account's email address, the page and view, and any procedure to run first), its steps, and any procedure to run afterwards. Each step is an unticked checkbox with the step's number and one action, followed by an **Expected:** line and an empty **Notes:** line for the tester. Steps are never laid out as tables.

Rules:

- **Must** give every action and expected result precisely enough for a junior test engineer to run and judge without knowing Fathom: what to select, where, and the exact text shown, in bold. Every fact a step relies on, such as a URL or a supported browser, comes from the document that owns it, never from assumption.
- **Must** keep each test case to one behavior, and make its preconditions enough to start it.
- **Must** say exactly where to act and what to look for: which row when a record shows a draft row and a live row, which heading a button sits beside, what to type in a search box to find an entry on a long page, and each column of a table to check, in order.
- **Must** describe what is on screen as the tester sees it, such as "a yellow dot and **Draft**", not by the names the code or design documents use.
- **Must** say only what to do and what to see: no explanations of why, design rationale, or history of fixes.
- **Must Not** repeat facts other documents own, such as the contents of the seed data; link to them.
- **Must** be updated in the same change as the behavior or the seed data it tests, together with [Visual Design](../design/visual-design.md) where that changes too. When a step fails because the behavior is wrong, the behavior is fixed, not the step.
- **Must Not** depend on data a tester adds by hand, other than through the steps themselves, or on real data.
- **Must Not** re-check what automated tests prove: each validation message, each refusal of a rule, API responses, permissions by typing addresses, each access-history sentence, or each combination of settings. One case for a rule is enough to confirm the screen shows it.
- **Must** cover what only a person can judge: how screens look and read in light and dark mode, journeys across pages, accounts and browsers, keyboard and focus, and what tests stub out, such as the clipboard.
- **Must** keep a feature's manual test short enough to run in about 30 minutes.
