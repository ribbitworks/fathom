---
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*"]
dependencies: ["docs/standards/markdown-style-guidelines.md"]
last_updated: "2026-10-26"
---

# Code Review Standards

This document defines how changes to a repository are reviewed. Follow it before and during every code review.

## Review Process

1. Identify every changed file in the diff, including new and deleted files.
1. Apply the checklist for each file type below.
1. Report findings grouped by file, with the rule broken, the location, and a suggested fix.
1. Treat any checklist violation as a finding that must be fixed or explicitly waived before merging.

## Markdown Files

All changed `.md` files must comply with the [Markdown Style Guidelines](markdown-style-guidelines.md).

### Markdown Checklist

- **Lists (MD032, MD030, MD029)**: Lists are surrounded by blank lines, use `-` markers with exactly one space, and use consistent ordered numbering.
- **Code blocks (MD031)**: Fenced code blocks are surrounded by blank lines and declare a language after the opening fence.
- **Headings (MD022, MD024, MD026)**: Headings are surrounded by blank lines, unique within the document, and have no trailing punctuation.
- **Heading structure**: Heading levels nest without skipping, and headings contain no numbers or letters as prefixes.
- **Whitespace**: No trailing whitespace, no hard tabs, no multiple consecutive blank lines, and the file ends with exactly one newline.
- **Links**: URLs are written as `[text](url)`, never as bare URLs.
- **Nested lists**: Nested items use consistent indentation, typically two spaces.

### Documentation Content

- **No duplication**: Facts are not repeated across documents. Each fact lives in the document that owns it, as listed in `AGENTS.md`, and other documents link to it. Standalone summaries for outside readers, listed as exceptions in `AGENTS.md`, may repeat facts but must stay consistent with their owners.

### Markdown Linting

When `markdownlint` is available, run it against changed markdown files and include any errors in the review. Line length (MD013) is not enforced.

```bash
npx markdownlint-cli2 "**/*.md" "#node_modules"
```

## Source Code

Add language- and framework-specific review criteria here as each is adopted.
