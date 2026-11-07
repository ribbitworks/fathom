---
title: "Code Review Standards (Fathom)"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*"]
dependencies: ["docs/standards/shared/code-review.md", "docs/standards/testing.md"]
last_updated: "2026-11-07"
---

# Code Review Standards

Fathom's additions to the shared [Code Review Standards](shared/code-review.md), which define the review process, ratings, approval, priorities, output and the common focus areas. Review every change against both documents, and against [TypeScript Standards](shared/typescript/typescript.md) and [Shell Script Standards](shared/shell/shell.md) for the languages it touches.

## Review Process

Identify every changed file in the diff, including new and deleted files, before reviewing.

A separate agent running a faster model, such as Sonnet, may review a change that touches only documentation, scripts, wording on screens, or tests other than access control and security tests. Anything the [Security](#security) section or the shared Security and Data focus area covers, such as sign-in, sessions, access control, the data access layer, migrations, secrets, the containers, and checks on user input, including web addresses, is reviewed with the full model, and so is any change where the choice is in doubt.

## Security

Every change is reviewed against the project's [Security Plan](../security/security-plan.md), in addition to the shared Security and Data focus area:

- **Threat model kept current:** A change that adds data, a way in, a role, a dependency, or infrastructure updates the threat model in the same change.
- **Mitigations verified:** Each mitigation the change touches still has its check, such as a test or scan.
- **Access-controlled data layer:** All access to protected data goes through the project's access-controlled data layer, never around it.
- **Secrets:** Container images count as build artifacts under the shared Secrets rule.

## Test Coverage

Each `/* v8 ignore */` comment a change adds is checked against [Testing Standards § Coverage Enforcement](testing.md#coverage-enforcement): it must say why, and be one of the cases listed there. Anything else is a finding.

## Architecture and Design

The change follows the project's architecture decision records in `docs/adr/` and its design documents.

## Migrations

Until Fathom is first deployed with real data, the shared rule that applied migrations are never edited is relaxed: a merged migration may be edited in place, and every development database is then reset, as the [Decisions Log](../product/decisions.md#platform-and-operations) records. A change that edits one says so, and names the reset, in its pull request.

## File Headers

Every source code file, in any language, starts with a header, after any line that must come first, such as a shebang. The header is the `SPDX-License-Identifier` line for the project's licence, as [ADR 0002](../adr/0002-libraries.md) decides, then a blank line, then a comment describing the file, then a blank line before the code. Following the [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html#file-header), the description says what the file is for and, where it helps, how it is used and what a reader needs to know first; for tests, what they cover. Headers name no authors, dates, or history, which git records.

Files that cannot hold comments, or that tools generate and that are never edited by hand, are listed in `REUSE.toml` instead. Database migrations are source code: a new migration gets its header after it is generated, and only migrations applied before this rule, which must never change, are listed in `REUSE.toml`. Third-party files keep their own copyright and licence, stated in the file or in a `REUSE.toml` entry after the project-wide one, with the licence text added to `LICENSES/`. `pnpm check` checks every header.

## User Experience

When the change affects the user interface, it follows the principles and rules in [Visual Design](../design/visual-design.md). Read aloud every sentence the change adds or rewords that people see, the server's refusals and the manual tests' expected text included, and flag any that a person would not say, as [Visual Design § Principles](../design/visual-design.md#principles) sets out under "Words people say".

## Manual Tests

When the change affects what a manual test in `docs/testing/` covers, or the seed data it relies on, the test is updated in the same change and still follows [Testing Standards § Manual Tests](testing.md#manual-tests): its test cases still test the feature's behavior, not this change, and every count, name and label they expect still matches the seed and the screens. A change that adds a feature a person must check by hand, before a stage is complete, adds or extends a manual test. The review also checks that a manual test re-checks nothing that automated tests prove, covers what only a person can judge, and stays short enough to run in about 30 minutes.

## Documentation Kept Current

The reviewer goes through each document `AGENTS.md` lists, and every other Markdown file git tracks, and reports any statement the change has made untrue, incomplete, or out of date. In particular:

- **README:** The getting-started steps still work as written, and the repository layout matches the top-level folders.
- **Development Setup:** Every command, setting, and folder the change adds, renames, or removes is listed.
- **Implementation Plan and Roadmap:** Slice progress is recorded, and notes about work that is now done no longer read as future work.
- **Open questions and proposals:** Any the change answers or decides are resolved in the document that owns them, and any it raises are added there.
- **Issues:** Deferred work and accepted findings are recorded in the [issues document](../issues.md), and items the change resolves are removed.
- **Summaries for IT and HR:** Kept consistent with every fact they summarize that the change affects.
- **Architecture, ADRs, and Domain Model:** Updated for new parts, decisions, and entities, with the revision noted where an ADR is revised. The Security Plan is covered under [Security](#security).
- **Product and operations documents:** New terms, decisions, roles, use cases, platforms, and deployment needs are recorded in the documents that own them.

## Markdown Linting

Run the project's Markdown linter and include any errors in the review:

```bash
pnpm lint:md
```
