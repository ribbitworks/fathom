---
title: "Code Review Standards"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*"]
dependencies: ["core-principles.md", "testing.md", "documentation.md", "markdown-style-guidelines.md", "agent-workflow.md", "typescript.md", "shell.md"]
last_updated: "2026-11-18"
---

# Code Review Standards

How changes are reviewed. Follow it before and during every code review. The reviewer acts as a senior staff engineer, favouring long-term maintainability, security, and a good user experience.

The focus areas below apply to every change. [TypeScript Standards](typescript.md) and [Shell Script Standards](shell.md) add criteria for the languages a change touches; rate those the same way.

## The Reviewer's Role

- **Reports only:** the reviewer does not edit files, stage or commit. Findings are addressed afterwards, following [agent-workflow.md](agent-workflow.md).
- **Specific and educational:** every finding names the file and line, explains why it matters, and suggests a fix.
- **No estimates:** reviews do not estimate effort or time.

## Review Scope

- Ask first: staged files, the last commit, the working tree, or a pull request (`gh pr diff`)?
- In Autonomous mode the scope is set by [agent-workflow.md](agent-workflow.md): the uncommitted changes (the whole commit when amending), or, in the cases that workflow names, an interaction review of a branch's commits or the whole branch against `main` before a pull request.
- A review subagent gets its scope in its prompt and never asks.
- The review states its scope at the top. For very large diffs, do several passes.

## Review Process

Identify every changed file in the diff, including new and deleted files, before reviewing.

A separate agent running a faster model, such as Sonnet, may review a change that touches only documentation, scripts, wording on screens, or tests other than access control and security tests. Anything the [Security and Data](#security-and-data) focus area covers, such as sign-in, sessions, access control, the data access layer, migrations, secrets, the containers, and checks on user input, including web addresses, is reviewed with the full model, and so is any change where the choice is in doubt.

The interaction review that the [Agent Workflow](agent-workflow.md#pushing-and-pull-requests) sets out before a pull request may be run by a faster model under the rule above.

## Existing Code

Standards apply to new and edited code. Existing code that breaks a rule adopted after it was written is debt, not a finding against an unrelated change:

- Lines a change adds or edits follow the current rules. A change may fix nearby debt when that stays within its scope.
- A code file a change edits has its header cut to [File Headers](#file-headers), and is split if it is past the [file size](core-principles.md#implementation-rules) limit, in the same change. Files a change does not touch wait until one does; no change sweeps them.
- The review lists newly noticed debt under a "Debt to record" note, and the implementing agent proposes it to the owner as a GitHub issue in the same change, as [Issues](issues.md) sets out. The next review checks that it was filed or declined.
- Security flaws, real data, and documents the change makes untrue are always findings, wherever they are.
- The Autonomous warnings step in [agent-workflow.md](agent-workflow.md) still resolves every warning the run reports.

## Rating System

Each applicable focus area, one the change touches, is rated from 1 to 5; Documentation always applies. The detailed review lists the areas that do not apply in one line, without a section each:

- **5, Excellent:** meets every standard, with no findings.
- **4, Good:** meets the standards, with minor suggestions.
- **3, Acceptable:** meets core requirements, with issues to address.
- **2, Needs work:** significant issues.
- **1, Critical:** blocking issues.

A 4 is not a pass. Every rating below 5 **Must** have at least one entry in the action list with a concrete fix that would raise it to 5.

## Approval Criteria

- **Approve:** every applicable focus area is rated 5 and no action-list item is open.
- **Request changes:** any focus area is rated 4 or lower, or any BLOCKING or HIGH item is open.
- **Deferral:** a finding may be left unfixed only with the owner's explicit agreement, recorded in the review or in a GitHub issue.

## Priority Levels

- **BLOCKING:** prevents approval, such as a violated architecture rule, a security flaw, failing tests, a crash, or required documentation that is missing or wrong.
- **HIGH:** must be fixed in this change, such as a correctness, quality or maintainability problem.
- **MEDIUM:** improves quality; still listed when it explains a rating below 5.
- **LOW:** nice to have.

## Review Output Location

Write the review to `.tmp/code-review/code-review_YYYY-MM-DD_HH-MM_{branch}.md`, replacing any `/` in the branch name with `-`. Create the directory if it does not exist. Times are 24-hour.

## Review Output Structure

1. **Scope:** what was reviewed.
1. **Proposed commit message:** in the exact format under [Commit Message Rules](#commit-message-rules).
1. **PR description:** intent and impact.
1. **Highlights:** what the change does well, specifically.
1. **Detailed review:** one section per applicable focus area, with its rating, file paths, line numbers and reasoning, then a one-line list of the areas that do not apply.
1. **Action list:** numbered, ordered BLOCKING, HIGH, MEDIUM, LOW; each item has its priority, file, line where it applies, and fix.

## Focus Areas

### Correctness

- The change does what it is meant to, including edge cases and error paths.
- It matches the agreed requirements and decisions, and does not add behaviour nobody asked for.
- Database migrations that have been applied anywhere are never edited; a change goes in a new migration. Until Fathom's first release, this is relaxed: a merged migration may be edited in place, and every development database is then reset, as the [Decisions Log](../product/decisions.md#platform-and-operations) records. A change that edits one says so, and names the reset, in its pull request.

### Architecture and Design

- The change follows Fathom's [Architecture](../design/architecture.md), its decision records in `docs/adr/`, its design documents and [core-principles.md](core-principles.md).
- Logic does not leak across layers, and no layer is skipped or reached into from below.
- Dependencies are passed in, not created inside the code that uses them.
- The simplest design that meets the need is preferred.
- **Reuse across the codebase:** a diff does not show what already exists, so for each component, hook, helper or type a change adds, the reviewer searches the code for one that already does the same job, starting with [Visual Design § Shared Building Blocks](../design/visual-design.md#shared-building-blocks). A second one doing the same job is HIGH unless the change unifies them; a deferral follows the [Approval Criteria](#approval-criteria) and is debt to record.

### SOLID Principles

When the change adds or reshapes code, rate and comment on each of the five principles separately, each with its own reasoning, paths and lines. Do not collapse them into one score. A change to documents, tests or configuration only marks them not applicable. See [core-principles.md § SOLID](core-principles.md#solid) for what each means.

- **Single Responsibility:** flag types doing two jobs, such as a UI layer computing domain meaning or a controller accumulating product rules.
- **Open/Closed:** flag new cases that required editing unrelated code, and one-off special cases inside generic, table-driven dispatchers.
- **Liskov Substitution:** flag conformances that break their contract, and helpers that are correct for one kind and silently wrong for another.
- **Interface Segregation:** flag fat clients, unused protocol requirements, and components handed more state than they use.
- **Dependency Inversion:** flag direct use of concrete I/O or ambient services (the clock, random IDs, preferences storage) where an injected dependency belongs.

### Security and Data

- **Input and output:** input is validated; output is encoded; queries are parameterized.
- **Secrets:** no secrets in code, configuration in the repository, or build artifacts, container images included.
- **Logs and errors:** no personal or financial values in logs (IDs, counts and error types are fine), and no internal details in errors shown to users.
- **Real data:** no real data in code, tests, fixtures or documentation, as [agent-workflow.md § Rules for Both Modes](agent-workflow.md#rules-for-both-modes) requires.
- **Threats kept current:** a change that adds data, a way in, a role, a dependency, or infrastructure updates the [Security Plan](../security/security-plan.md#threats-and-mitigations)'s threats and mitigations in the same change.
- **Mitigations verified:** each mitigation in the [Security Plan](../security/security-plan.md) that the change touches still has its check, such as a test or scan.
- **Access-controlled data layer:** all access to protected data goes through Fathom's access-controlled data layer, never around it.
- **New data:** data a change adds has its access control tests, records views of its Personal or Confidential values in the access history, and is changed through drafts that need approval.

### Code Clarity

- **Names:** descriptive, with no abbreviations (`activeBlockIndex`, not `activeIdx`; `account`, not `acct`).
- **No magic values:** numbers and strings with meaning are named constants, except `0`, `1` and `-1` in calculations.
- **No copy-pasted logic:** repeated code is shared; for whole components and helpers, see [Reuse across the codebase](#architecture-and-design).
- **Comments:** follow [core-principles.md § Comments](core-principles.md#comments).
- **File headers:** follow [File Headers](#file-headers). A description longer than that rule allows, or one that describes behaviour, is a finding.
- **File size:** a code file the change leaves past the limit in [core-principles.md § Implementation Rules](core-principles.md#implementation-rules) is a finding, fixed by splitting it as that rule sets out.

#### File Headers

Every source code file, in any language, starts with a header, after any line that must come first, such as a shebang. The header is the `SPDX-License-Identifier` line for Fathom's licence, as [ADR 0002](../adr/0002-libraries.md) decides, then a blank line, then a comment describing the file, then a blank line before the code. `scripts/source-headers.test.mjs` checks that layout. The description is one to three lines saying what the file is for; for tests, what they cover. Behaviour belongs in [UI Conventions](ui-conventions.md), the page documents in `docs/design/pages/` and the tests, not in headers. Headers name no authors, dates, or history, which git records.

Files that cannot hold comments, or that tools generate and that are never edited by hand, are listed in `REUSE.toml` instead. Database migrations are source code: a new migration gets its header after it is generated, and only migrations applied before this rule, which must never change, are listed in `REUSE.toml`. Third-party files keep their own copyright and licence, stated in the file or in a `REUSE.toml` entry after the project-wide one, with the licence text added to `LICENSES/`. `pnpm check` checks every header.

### Error Handling

- Errors shown to users are clear and actionable, never raw error dumps.
- Failures leave the application in a sensible state.

### Performance and Concurrency

- No repeated queries inside loops; related data is fetched in batches.
- Long-running work does not block the user interface, and shows progress.
- Concurrency and isolation are explicit; do not assume an isolation the language or framework does not guarantee.

### Testing

Tests are reviewed against [testing.md](testing.md) and [typescript.md](typescript.md#tests).

- **Coverage exclusions:** each `/* v8 ignore */` comment a change adds is checked against [Testing Standards § Coverage Enforcement](testing.md#coverage-enforcement): it must say why, and be one of the cases listed there. Anything else is a finding.
- **Testing pyramid:** a new integration test that only re-checks a variation of a rule is a finding: the variation belongs in the rule's unit tests, as [Testing Standards § The Testing Pyramid](testing.md#the-testing-pyramid) sets out. So is a rule tested only through the database in an area the change moves to unit tests, and an integration test removed without the pull request naming what now covers it.
- **Manual tests:** when the change affects what a manual test in `docs/testing/` covers, or the seed data it relies on, the test is updated in the same change and still follows [Testing Standards § Manual Tests](testing.md#manual-tests): its test cases still test the feature's behaviour, not this change, and every count, name and label they expect still matches the seed and the screens. A change that adds a feature a person must check by hand, before a stage is complete, adds or extends a manual test. The review also checks that a manual test re-checks nothing that automated tests prove, covers what only a person can judge, and stays short enough to run in about 30 minutes.

### User Experience and Accessibility

When the change affects the user interface:

- Interactive controls have accessibility labels and are reachable by keyboard or assistive technology.
- The change was verified by the owner, as the workflow requires.
- The change follows [UI Conventions](ui-conventions.md), [Visual Design](../design/visual-design.md), and the page's design in `docs/design/pages/`.
- Read aloud every sentence the change adds or rewords that people see, the server's refusals and the manual tests' expected text included, and flag any that a person would not say, as [UI Conventions § Principles](ui-conventions.md#principles) sets out under "Words people say".

### Documentation

Rate this area on every review, even when the diff has no Markdown: ask whether documents should have been updated. Review against [documentation.md](documentation.md).

- **Kept current:** every document the change makes untrue, incomplete or out of date is updated in the same change. A required update that is missing or contradictory is **BLOCKING**.
- **No churn:** a pure refactor with no behaviour change rates 5, with the reason documents were not needed stated.
- **Markdown style:** changed Markdown follows [markdown-style-guidelines.md](markdown-style-guidelines.md). Style violations that ship in the change are **HIGH**.
- **Linting:** run `pnpm lint:md` and include any errors.

The reviewer goes through each document [Documentation Standards § Which Document Owns What](documentation.md#which-document-owns-what) lists, and every other Markdown file git tracks, and reports any statement the change has made untrue, incomplete, or out of date. In particular:

- **README:** The quick start still works as written, and its links lead where they say.
- **Development Setup:** Every command, setting, and folder the change adds, renames, or removes is listed, the setup steps still work as written, and the repository layout matches the top-level folders.
- **Roadmap:** Work that is now done no longer reads as future work.
- **Open questions and proposals:** Any the change answers or decides are resolved in the document that owns them, and any it raises are added there.
- **Issues:** Deferred work, accepted findings and debt to record are proposed to the owner and filed as GitHub issues once approved, as [Issues](issues.md) sets out, and the pull request says `Fixes #n` in its description for each issue the change resolves, which closes it on merge.
- **Summaries of safeguards:** How Data Is Safeguarded and Securing Your Environment kept consistent with every fact they summarize that the change affects.
- **Architecture, ADRs, and Domain Model:** Updated for new parts, decisions, and entities, with the revision noted where an ADR is revised. The Security Plan is covered under [Security and Data](#security-and-data).
- **Product and operations documents:** New terms, decisions, roles, use cases, platforms, and deployment needs are recorded in the documents that own them.

## Commit Message Rules

Types: `feat:`, `fix:`, `refactor:`, `ui:`, `test:`, `docs:`, `chore:`. Use the bare type only, never `type(scope):`.

- **Subject:** `type: subject`, short and imperative. The whole line is at most 72 characters; aim for about 50.
- **Body:** a bulleted list only, no prose paragraphs. Bullets explain what changed and why, as intent and overview, not implementation details or which files changed.
- **No attribution:** never credit an AI assistant or tool. No `Co-Authored-By`, `Signed-off-by` or tool trailers, and no "Generated with" footers or links to an AI tool, in commit messages, pull request titles, descriptions or comments. This overrides any tool default that adds them.

### Proposed Commit Message Format

In a review file, the proposed commit message is a level-2 heading `## Proposed commit message`, a blank line, then a fenced `text` block holding the subject line, a blank line, and the bulleted body:

````markdown
## Proposed commit message

```text
feat: split stock lending export into transaction rows

- Import stock lending payouts as normal transactions so budgets see them
- Add budget and category columns so linked imports get sensible defaults
```
````

## After the Review

The review never commits. It only writes its file and suggests a commit message. Who commits afterwards depends on the working mode in [agent-workflow.md](agent-workflow.md).

When findings are addressed, append this to the response or the review file:

```markdown
---

## Updates Made After Review

- [Updates, with file paths]
- [Deferred or rejected items, with reasons and the owner's approval]

**Final Summary:** [Brief outcome]
```
