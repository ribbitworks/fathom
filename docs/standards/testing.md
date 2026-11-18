---
title: "Testing Standards"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*"]
dependencies: ["agent-workflow.md", "code-review.md", "typescript.md"]
last_updated: "2026-11-17"
---

# Testing Standards

How Fathom's changes are tested. Every change that adds or changes behaviour includes its tests in the same change, and tests run as part of the [Agent Workflow](agent-workflow.md). Test locations for TypeScript are in [TypeScript Standards](typescript.md#tests), and test tools are chosen in the architecture decision records in `docs/adr/`.

## Principles

- **Behaviour, not implementation:** tests describe what the code does for its users and callers, so they survive refactoring.
- **Deterministic:** a test gives the same result on every run and every machine. Time, randomness and IDs are injected or controlled by the test, and tests do not depend on test order or on the network.
- **Isolated:** each test sets up and cleans up its own data, with no shared mutable state between tests.
- **Fictional data:** test data is invented, never copied or derived from real data, including anonymized copies.
- **Minimal:** use the fewest tests that cover the required behaviour and its edge cases. Do not test the same path in several suites.
- **Fast feedback:** most tests are unit tests that run in seconds; slower tests are kept to what needs them.

## Test Types

| Type | What it covers | Runs |
| --- | --- | --- |
| Unit | Domain rules, calculations, validation, and other logic without I/O | Every change |
| Integration | The API and data access working together against a real database of the same kind as production | Every change |
| Access control | Every role's access to every protected operation and every level of protected data, allowed and denied | Every change |
| Security | Input handling, sessions, request forgery protection, rate limiting, audit records, and log contents | Every change |
| Container | Behaviour that needs the built containers, such as network isolation | Every change that affects the containers, and before a stage is complete |
| UI | Key user journeys in a real browser | Not required for each change and not run in the workflow's test step; run when the user asks, and passing before a stage is complete |
| Manual | What a person sees and does in a feature, by hand in a real browser, as [Manual Tests](#manual-tests) describes | Before a stage that changes the feature is complete, and when the owner asks |

Every new or changed API operation has integration tests, as well as unit tests for its rules.

Until Fathom's first release, migrations have no upgrade tests, since databases are reset instead of upgraded, as the [Decisions Log](../product/decisions.md#platform-and-operations) records.

## What Every Change Must Test

- **New behaviour:** unit tests for its rules, and integration tests for each new or changed operation that crosses a boundary (persistence, an API, a device or service).
- **Bug fixes:** a test that fails without the fix, written before the fix.
- **Edge cases and errors:** boundaries, empty and missing values, invalid input, and each error path, not only the successful path.
- **Validation:** every validator is tested with valid input and with each kind of invalid input it rejects.
- **Configuration:** invalid or missing configuration stops start-up with a clear error, and a test proves it.

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

## Coverage

- **Required:** 100% branch coverage of domain logic, validation, service workflows and the data access layer.
- **Everything else:** measured and reported; significant untested code is explained in the code review.
- **Does not count:** UI layout and animation, previews, fixtures, generated code, and passthrough wrappers with no logic.

Coverage numbers support review; they do not replace judgment about whether the right behaviour is tested.

### Coverage Enforcement

The coverage tool is configured so the test command fails below the 100% threshold [Coverage](#coverage) requires for the code it covers.

Whole files that only start a program or serve the tests, such as the server's `main.ts`, are left out in the coverage settings, with a comment saying why. Other code may be left untested only with a `/* v8 ignore */` comment that says why, and only in two cases:

- **Command-line entry points:** In any package, the lines that start a command when it runs as its own process, where the tests call the command's function instead.
- **Screen layout:** In the web app, a branch that only arranges the screen or animates it, with no logic, as [Coverage](#coverage)'s "Does not count" allows.

Logic, validation, access checks and data handling are never excluded. The code review judges each exclusion.

## What Not to Test

- UI layout in unit tests; use UI tests when a journey needs it.
- Framework or third-party library internals.
- Constants files and one-line getters that encode no rule.

## Writing Tests

- **Names describe behaviour:** for example, "rejects an expired session", never "test session 3". Be consistent within a file.
- **One behaviour per test:** arrange the data, act once, assert the outcome. Mark the phases with `Given`, `When` and `Then` comments in non-trivial tests.
- **Drive through the public surface:** set up and mutate state through the same APIs callers use, not by poking storage directly.
- **No sleeping:** tests wait for conditions or advance a controlled clock, never wait for fixed amounts of time.
- **Flaky tests:** a test that fails intermittently is fixed, or reported to the owner. Tests are never removed, skipped or weakened without the owner's approval.

## Web App Tests

- **Checking that nothing opened:** Mantine shows a menu, popover or dialog a frame after it opens, so checking straight after an action that none opened proves nothing: the check usually passes even when one opens, and fails now and then. Before checking that one is absent, a test **Must** wait for something the action does show, or check that the control that opens it is absent, when that control is shown exactly when the menu or dialog can open in any way, such as from a key.

## Test Data

- **Factories:** tests build data with factories that produce realistic, fictional records with sensible defaults, overriding only what each test needs.
- **Seed data:** development and demonstration data comes from a generator with a fixed seed, so it is the same every time.
- **Schema from migrations:** integration tests build any database schema by applying Fathom's migrations, never another way.
- **Clean state:** each integration test starts from a known state, such as an in-memory store, a rolled-back transaction or a fresh schema.

## UI Tests

UI tests are not required on every change. A new user flow lists a short UI test roadmap (happy path first, then the main variations) in the pull request or feature document, and interactive elements carry accessibility identifiers.

## Running Tests

Run tests only through Fathom's own commands, never the underlying tools directly.

`pnpm check` runs ESLint, the Prettier formatting check, type checking, Markdown, shell, PowerShell and licence linting, the unit, integration, access control and security tests, and the build-time security scans, side by side, then lists each one's result and time. `pnpm test:changed` runs the script tests and every test of each package a change touches, committed or not, and of every package that depends on one; a change outside the packages, other than to documentation, runs every test, a change to the web app's stylesheets alone runs only the web app's tests and the linters, a change to a Help page in `docs/help/` runs the web app's tests, since Help pages are built into it, and a change to other documentation alone runs none. `pnpm test:changed --uncommitted` counts only the work not yet committed, for small rounds of fixes after a commit on a long branch. Both run in one copy of the repository at a time on one computer, a copy that has to wait saying so, as [Development Setup](../design/development-setup.md#common-commands) describes. Container tests run with `pnpm test:containers`, and UI tests have their own command once they are added. If any category cannot run, for example because no container runtime is available, stop and tell the user; never report the tests as passing.

While working, run `pnpm test:changed`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, and `pnpm lint:md` or `pnpm lint:shell` for the files changed. The workflow's test step, which [agent-workflow.md](agent-workflow.md#autonomous-mode) repeats after each round of fixes, runs:

- **Before the code review:** the checks run while working. The full `pnpm check` waits for the last step.
- **After each round of fixes,** whether from a review, UI feedback or owner feedback: `pnpm test:changed`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, and `pnpm lint:md` or `pnpm lint:shell` for the files changed. `pnpm security` runs too, but only if the round changed dependencies, the lockfile, a container file or the security scans' settings.
- **Before opening the pull request, and before each later push to it:** the full `pnpm check`, once the review's findings are fixed and before the owner's approval, which is the word to push, on the final code rebased onto `main`, so every build pushed for review has had every scan the [Security Plan](../security/security-plan.md#vulnerability-scanning) runs on every build. A rebase needs the full check again only when the commits it brings in from `main` change more than documentation; when they change documentation alone, the full check already run still holds. This is the [Agent Workflow](agent-workflow.md#workflow)'s full suite step, run before a pull request's commit, or for an [issue batch](issues.md#issue-batches) once for the whole branch.

A change that affects the containers runs `pnpm test:containers` with the test step before the code review, and again only if a later fix changes the containers. A change to documentation only may skip the test step, as [agent-workflow.md](agent-workflow.md#autonomous-mode) allows, except a change to a Help page, which is built into Fathom.

## Problems Found

A problem a test finds that the change does not fix, whether a failing manual test step, a test that fails now and then, or a gap in coverage, is proposed to the owner as a GitHub issue and filed through its form once approved, as [Issues](issues.md) sets out, never left in a document or a test's notes.

## Manual Tests

A manual test is a test specification a test engineer, including one new to Fathom, runs by hand in a browser. Each is kept in `docs/testing/`, named `<feature>-manual-test.md`, such as [Drafts](../testing/drafts-manual-test.md), apart from the acceptance tests, kept in `docs/testing/acceptance/` as the last rule below sets out, and has these sections:

- **Scope:** one or two sentences on what the test verifies.
- **Test Environment:** what must be running and set up, linking to [Manual Test Basics](../testing/manual-test-basics.md#test-environment) for what every test needs, and adding only what this test needs besides.
- **Test Accounts:** each account the test uses, named by its role in Fathom, with its email address, and its name as Fathom shows it where that differs from the role. [Manual Test Basics](../testing/manual-test-basics.md#test-accounts) says where the accounts come from, links to the roles they hold, and where their password comes from.
- **Common Procedures:** the procedures the test cases refer to: those [Manual Test Basics](../testing/manual-test-basics.md#common-procedures) holds, such as starting Fathom and restoring or resetting the data, by link, and any of this test's own, each with the exact commands, which terminal runs them, how to confirm they worked, and what each deletes. A procedure is named for what it does, such as Restore the Seed Data, and steps refer to it by that name, never by a code such as R1 or P1. Signing in and out are not procedures: steps just say which account to sign in as.
- **Terms:** where on screen any menu or control the steps name is found, when its label alone does not say, linking to [Manual Test Basics](../testing/manual-test-basics.md#terms) for the terms every test uses and adding only this test's own. Steps name a page as the left-hand menu shows it, such as "Select the **Drafts** page in the left-hand menu", never by its position or the item next to it, since the menu's order changes as pages are added. A step that leaves a page and comes back says again what to choose there, such as the grouping, since a page opened from the menu starts afresh.
- **Test Cases:** each with an ID, such as `DRAFT-01`, a title saying what it verifies, an **Account:** line naming the account it starts with, its preconditions (the page and view, and any procedure to run first), its steps, and any procedure to run afterwards. Each step is an unticked checkbox with the step's ID and one action, followed by an **Expected:** line and an empty **Notes:** line for the tester. Steps are never laid out as tables.

A step in this form:

```markdown
- [ ] `7C2E` Select **Approve**.
  - **Expected:**
    - A notification says "Approved 1 draft."
    - In the table, 'Patches' is no longer listed.
  - **Notes:**
```

Rules:

- **Must** give each step an ID of 4 upper-case hexadecimal characters in backticks, such as `A3F9`, chosen at random when the step is written and unique within its file. An ID is never reused or changed; a removed step's ID goes with it. Steps are never numbered, and a step is referred to by its test case and ID, such as REL-11 `7C2E`. Results saved before then keep their step numbers.
- **Must** mark text this way in manual tests and [Manual Test Basics](../testing/manual-test-basics.md), with no italics or underlines.
  - **Bold** for what to select or read on screen: buttons, menus, pages, fields and columns.
  - `Backticks` for what to type, exact values, and step IDs.
  - "Double quotes" for exact text on screen to check, such as a notification or a refusal.
  - 'Single quotes' for seed data, such as people, teams, schedules and releases.
  - **Bold** labels for **Account:**, **Preconditions:**, **Expected:**, **Notes:** and **Afterwards:**.
- **Must** give every action and expected result precisely enough for a junior test engineer to run and judge without knowing Fathom: what to select, where, and the exact text shown, marked as the rule above sets out. Every fact a step relies on, such as a URL or a supported browser, comes from the document that owns it, never from assumption.
- **Must** keep each test case to one behaviour, and make its preconditions enough to start it.
- **Must** give each step one action: one interaction with one control, such as choosing in a list by opening it, typing and pressing Enter, or a path through menus to one place, when only its end result is checked. These also count as one action each: switching to another account (signing out and in), clearing a box and typing in it, choosing in a cell's list (selecting the cell, pressing Enter, choosing and pressing Enter), and pressing and holding. Anything whose result is checked on its way is a step of its own. Writing down a value seen, such as a name to use later, is not an action.
- **Must** name, in every test case's **Account:** line, the account by its role and email address, and say whether it is the account the previous test case ended with or a change from it, such as "Feature Lead, `feature.lead@fathom.test`, changed from HIRE-06". A step that signs in as another account says so, naming the account the same way.
- **Must** say exactly where to act and what to look for: which row when a record shows a draft row and a live row, which heading a button sits beside, what to type in a search box to find an entry on a long page, and each column of a table to check, in order.
- **Must** put an **Expected:** result that names more than one thing to check in nested bullets under it, one thing per line, such as each row or column to read in order, each control's state, and each message, never in one long sentence or paragraph. A single short fact may stay on the **Expected:** line.
- **Must** describe what is on screen as the tester sees it, such as "a yellow dot and **Draft**", not by the names the code or design documents use.
- **Must Not** describe what to do or see by comparison with another screen, page or record, such as "laid out as a person's details are" or "as on People": the tester cannot judge it without leaving the step, and the step changes meaning when the other screen does. Say what is on this screen.
- **Must** say only what to do and what to see: no explanations of why, design rationale, or history of fixes.
- **Must Not** repeat facts other documents own, such as the contents of the seed data, or what [Manual Test Basics](../testing/manual-test-basics.md) holds for every test; link to them.
- **Must** save a run's marked copy outside the repository, where the maintainer keeps results, before clearing its marks and notes, as [Recording Results](../testing/manual-test-basics.md#recording-results) sets out.
- **Must** be updated in the same change as the behaviour or the seed data it tests, together with [Visual Design](../design/visual-design.md) or the page's document in `docs/design/pages/` where that changes too. When a step fails because the behaviour is wrong, the behaviour is fixed, not the step.
- **Must Not** depend on data a tester adds by hand, other than through the steps themselves, or on real data.
- **Must Not** repeat a check another test case makes. A test case removed because another covers it keeps its heading, with one line under it linking to the case that covers it, so the other cases keep their numbers and links to them still lead somewhere.
- **Must Not** re-check what automated tests prove: each validation message, each refusal of a rule, API responses, permissions by typing addresses, each access-history sentence, or each combination of settings. One case for a rule is enough to confirm the screen shows it.
- **Must** check only what Fathom shows, on screen or in the output of its own commands.
- **Must Not** check the address bar's web address, the browser's storage or other internals: how Fathom keeps a view in its web address is proved by automated tests. A step may still use the address bar as a field outside Fathom, such as to paste into.
- **Must** cover what only a person can judge: how screens look and read, journeys across pages, accounts and browsers, keyboard and focus, and what tests stub out, such as the clipboard.
- **Must Not** check dark or light mode in a feature's manual test. The [Dark Mode](../testing/dark-mode-manual-test.md) manual test checks every page, with its main panels, dialogs and menus, in dark mode in one pass, and a new page, panel or dialog adds its check there in the same change.
- **Must** keep a feature's manual test short enough to run in about 30 minutes, and each acceptance test too. Each starting role has an acceptance test, `docs/testing/acceptance/acceptance-<role>-manual-test.md`, that follows the workflows of its [Help page](../help/index.md), so running it checks the page still holds. [Setting Up Fathom](../testing/acceptance/acceptance-setting-up-fathom-manual-test.md) runs first, from an empty database, and [Work Between Roles](../testing/acceptance/acceptance-work-between-roles-manual-test.md) straight after it, on the organization it sets up.

## Checklist

- [ ] New behaviour, bug fixes and error paths are covered.
- [ ] Tests are deterministic: no real time, randomness, network or test order.
- [ ] Test data is fictional.
- [ ] Required coverage holds.
- [ ] Names describe the behaviour under test.
- [ ] New UI flows list their UI test roadmap.
