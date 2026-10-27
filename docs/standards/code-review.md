---
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*"]
dependencies: ["docs/standards/markdown-style-guidelines.md", "docs/standards/testing.md"]
last_updated: "2026-10-27"
---

# Code Review Standards

This document defines how changes to a repository are reviewed. Follow it before and during every code review. The reviewer acts as a senior staff engineer, favoring long-term maintainability, security, and a good user experience.

## The Reviewer's Role

- **Reports only:** The reviewer does not edit files or create commits. Findings are addressed afterwards, following the [Workflow](../../AGENTS.md#workflow).
- **Specific and educational:** Every finding names the file and line, explains why it matters, and suggests a fix.
- **No estimates:** Reviews do not estimate effort or time.

## Review Scope

By default, the review covers the uncommitted changes, or the whole commit when a change is amended into it. If the scope is unclear, ask. The review states its scope at the top.

## Review Process

1. Identify every changed file in the diff, including new and deleted files.
1. Review the change against each focus area below, and rate each one.
1. Record findings with a priority, file, line, and suggested fix.
1. Write the review to `.tmp/code-review/code-review_YYYY-MM-DD_HH-MM_{branch}.md`, replacing any `/` in the branch name with `-` and creating the directory if needed, and summarize it for whoever requested the review.

## Ratings and Approval

Each focus area is rated from 1 to 5, or marked not applicable:

- **5, Excellent:** Meets every standard, with no findings.
- **4, Good:** Meets the standards, with minor suggestions.
- **3, Acceptable:** Meets core requirements, with issues to address.
- **2, Needs work:** Significant issues.
- **1, Critical:** Blocking issues.

A change is approved when every applicable focus area is rated 4 or above and no BLOCKING or HIGH finding is open. Every rating below 5 has at least one finding explaining it.

Approval does not waive findings: every finding is fixed or, as the [Workflow](../../AGENTS.md#workflow) requires, left unfixed only with the user's approval.

## Priorities

- **BLOCKING:** Prevents approval, such as a security flaw, broken access control, failing tests, or a violated architecture decision.
- **HIGH:** Must be fixed in this change, such as a correctness, quality, or maintainability problem.
- **MEDIUM:** Should be fixed; improves quality but does not block approval.
- **LOW:** Nice to have.

## Review Output

1. **Scope:** What was reviewed.
1. **Highlights:** What the change does well.
1. **Detailed review:** One section per focus area, with its rating and reasoning.
1. **Findings:** Ordered BLOCKING, HIGH, MEDIUM, LOW, each with file, line, and suggested fix.
1. **Suggested commit message:** Optional, following the commit message rules in `AGENTS.md`.

When findings are later addressed, an "Updates Made After Review" section is added, listing what was changed and any findings deferred or rejected, with reasons and the user's approval.

## Focus Areas

### Correctness

- The change does what it is meant to, including edge cases and error paths.
- It matches the agreed requirements and decisions, and does not add behavior nobody asked for.

### Architecture and Design

- The change follows the project's architecture decision records and design documents.
- Each part has one clear responsibility, and logic does not leak across layers.
- All access to protected data goes through the project's access-controlled data layer, never around it.
- Dependencies are passed in, not created inside the code that uses them.
- The simplest design that meets the need is preferred.

### Security

Every change is reviewed against the project's [Security Plan](../security/security-plan.md):

- **Threat model kept current:** A change that adds data, a way in, a role, a dependency, or infrastructure updates the threat model in the same change.
- **Mitigations verified:** Each mitigation the change touches still has its check, such as a test or scan.
- **Input and output:** Input is validated against schemas; output is encoded; queries are parameterized.
- **Secrets:** No secrets in code, configuration files in the repository, or container images.
- **Logs and errors:** No personal data in logs, and no internal details in error messages shown to users.
- **Real data:** No real personal or company data in code, tests, fixtures, or documentation, as the project's data rules require.

### Code Clarity

- **Names:** Descriptive names, with no unclear abbreviations.
- **No magic values:** Numbers and strings with meaning are named constants, except obvious values such as 0, 1, and -1 in calculations.
- **Reuse:** Existing helpers are used before writing new ones.
- **Comments:** By default, no comment. Names explain what the code does; comments explain only why, when the code cannot. Comments do not narrate the code, repeat names, reference tickets, or record history.

#### Language-Specific Criteria

Add criteria here for each language or framework as it is adopted.

- **TypeScript:** Strict mode; no `any`; no non-null assertions outside tests; exhaustive handling of every case of a union.

### Error Handling

- Errors shown to users are clear and actionable, and never raw error dumps.
- Failures leave the application in a sensible state.

### Performance

- No repeated database queries inside loops; related data is fetched in batches.
- Long-running work does not block the user interface, and shows progress.

### Testing

Tests are reviewed against the [Testing Standards](testing.md).

### User Experience and Accessibility

When the change affects the user interface:

- Interactive controls are accessible by keyboard and to screen readers.
- The change is verified by the user, as the workflow requires.

### Documentation

- Documentation is updated for new patterns, decisions, and behavior, following the checks below.
- Changed Markdown files follow the [Markdown Style Guidelines](markdown-style-guidelines.md).

#### Markdown Checklist

- **Lists (MD032, MD030, MD029):** Lists are surrounded by blank lines, use `-` markers with exactly one space, and use consistent ordered numbering.
- **Code blocks (MD031):** Fenced code blocks are surrounded by blank lines and declare a language after the opening fence.
- **Headings (MD022, MD024, MD026):** Headings are surrounded by blank lines, unique within the document, and have no trailing punctuation.
- **Heading structure:** Heading levels nest without skipping, and headings contain no numbers or letters as prefixes.
- **Whitespace:** No trailing whitespace, no hard tabs, no multiple consecutive blank lines, and the file ends with exactly one newline.
- **Links:** URLs are written as `[text](url)`, never as bare URLs.
- **Nested lists:** Nested items use consistent indentation, typically two spaces.

#### Documentation Content

- **No duplication:** Facts are not repeated across documents. Each fact lives in the document that owns it, as listed in `AGENTS.md`, and other documents link to it. Standalone summaries for outside readers, listed as exceptions in `AGENTS.md`, may repeat facts but must stay consistent with their owners.

#### Markdown Linting

Run the project's Markdown linter and include any errors in the review. Line length (MD013) is not enforced.

```bash
pnpm lint:md
```
