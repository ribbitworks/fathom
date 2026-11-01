---
title: "Markdown Style Guidelines"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*.md"]
dependencies: ["documentation.md"]
last_updated: "2026-11-01"
---

# Markdown Style Guidelines

Formatting rules for every Markdown file in a repository, for readability and
clean linting. Apply them whenever creating or editing Markdown. Content rules
live in [documentation.md](documentation.md).

## List Formatting

### List Spacing (MD032)

- **Rule:** all lists are surrounded by blank lines.
- **Format:**

  ````markdown
  **Header:**

  - Item 1
  - Item 2

  **Next section:**
  ````

- **Applies to:** both bulleted and numbered lists.

### List Marker Spacing (MD030)

- **Rule:** exactly one space after list markers (`-` or numbers).
- **Bad:** `-Item` or `-  Item`.
- **Good:** `- Item`.

### Ordered List Consistency (MD029)

- **Rule:** numbered lists use one numbering style: all `1.`, or sequential
  `1.`, `2.`, `3.`.
- **Bad:** mixing both styles in the same list.

## Code Block Formatting (MD031)

- **Rule:** fenced code blocks are surrounded by blank lines.
- **Rule:** the language is named immediately after the opening fence, using
  `text` when no other language fits.
- **Format:**

  ````markdown
  **Description:**

  ```bash
  echo "code here"
  ```

  **Next section:**
  ````

## Heading Formatting

### Heading Uniqueness (MD024)

- **Rule:** no duplicate headings within a document.
- **Example:** use "Account Detail View" and "Account Edit View", not "View"
  twice.

### Heading Spacing (MD022)

- **Rule:** headings are surrounded by blank lines, before and after.

### Trailing Punctuation (MD026)

- **Rule:** headings do not end with punctuation.
- **Bad:** `## Section:`.
- **Good:** `## Section`.

### Heading Structure

- **Hierarchy:** levels nest without skipping (`#`, `##`, `###`).
- **No numbered or lettered headings:** not "1. Section" or "A. Subsection";
  use descriptive text only.

## Line Length (MD013)

Line length is not enforced. Projects that want a limit set it in their
Markdown linter configuration and their own standards.

## General Requirements

- **No trailing whitespace.**
- **No hard tabs:** indent with spaces.
- **Single blank lines:** exactly one blank line between sections.
- **File ending:** files end with exactly one newline.
- **Bullet lists:** use `-`, not `*`.
- **List indentation:** nested items use consistent indentation, typically two
  spaces.
- **Links:** URLs are written as `[text](url)`, never bare.
