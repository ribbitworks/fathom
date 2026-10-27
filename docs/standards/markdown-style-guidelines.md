---
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*.md"]
last_updated: "2026-10-26"
---

# Markdown Style Guidelines

This document defines the formatting rules for all markdown files in a repository to ensure readability and successful linting.

## List Formatting

### List Spacing (MD032)

- **Rule**: All lists must be surrounded by blank lines.
- **Format**:

  ````markdown
  **Header:**
  
  - Item 1
  - Item 2
  
  **Next section:**
  ````

- **Apply to**: Both bulleted and numbered lists.

### List Marker Spacing (MD030)

- **Rule**: There must be exactly one space after list markers (`-` or numbers).
- **Bad**: `-Item` or `-  Item` (no space or multiple spaces)
- **Good**: `- Item` (single space)

### Ordered List Consistency (MD029)

- **Rule**: Numbered lists must use consistent numbering style (all `1.` or sequential `1.`, `2.`, `3.`).
- **Bad**: Mixing `1.` and `2.` with `1.` and `1.` in the same list
- **Good**: Use all `1.` for auto-numbering, or use sequential numbers consistently

## Code Block Formatting (MD031)

- **Rule**: All fenced code blocks must be surrounded by blank lines.
- **Rule**: The name of the language must be specified immediately after the introductory code fence.
- **Format**:

  ````markdown
  **Description:**
  
  ```bash
  echo "code here"
  ```
  
  **Next section:**
  ````

- **Apply to**: All code blocks in every language (bash, text, JSON, etc.).

## Heading Formatting

### Heading Uniqueness (MD024)

- **Rule**: No duplicate headings within the same document.
- **Solution**: Use descriptive, unique headings for each section.
- **Example**: Use "Account Detail View" and "Account Edit View" instead of just "View" twice.

### Heading Spacing (MD022)

- **Rule**: Headings must be surrounded by blank lines (both before and after).
- **Format**:

  ````markdown
  Previous paragraph.
  
  ## Heading
  
  Next paragraph.
  ````

### Trailing Punctuation (MD026)

- **Rule**: Headings must not end with punctuation marks (periods, colons, semicolons, etc.).
- **Bad**: `## Section:`
- **Good**: `## Section`

## General Requirements

- **No Trailing Whitespace**: Lines must not end with invisible spaces.
- **No Hard Tabs**: Use spaces for indentation, never tabs.
- **Single Blank Lines**: Use exactly one blank line between sections; avoid multiple consecutive empty lines.
- **File Ending**: Files must end with exactly one newline character.
- **Heading Hierarchy**: Use logical nesting (#, ##, ###). Do not skip levels.
- **No Numbered or Lettered Headers**: Headers must not include numbers (e.g., "1. Section") or letters (e.g., "A. Subsection"). Use descriptive text only.
- **Bullet Lists**: Use `-`, not `*`.
- **List Indentation**: Use consistent indentation (typically 2 spaces) for nested list items.
- **Link Formatting**: URLs must be formatted as markdown links, not bare URLs. Use `[text](url)` format.
