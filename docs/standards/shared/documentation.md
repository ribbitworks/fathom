---
title: "Documentation Standards"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*.md"]
dependencies: ["markdown-style-guidelines.md"]
last_updated: "2026-11-01"
---

# Documentation Standards

How project documents are written and kept current. Documents are read by
people and by AI coding assistants, so they must be clear, unambiguous and
correct. Formatting rules live in
[markdown-style-guidelines.md](markdown-style-guidelines.md).

## One Fact, One Place

- Record each fact in one document only, and link to it from others instead of
  repeating it.
- The project lists which document owns which facts, typically in `AGENTS.md`
  or the docs index. Keep that list current when documents are added, split or
  removed.
- Standalone summaries for outside readers may repeat facts, but are listed as
  exceptions and stay consistent with the documents that own those facts.
- Keep each open question in the document that will own its answer.

## Kept Current

- Documents are updated in the same change as the code, not later.
- A change updates every document it makes untrue, incomplete or out of date,
  not only the documents it edits: the README's getting-started steps and
  layout, setup commands, architecture, decisions, use cases, user guides,
  roadmap and issues.
- Deferred or partial features stay marked as such; never document unshipped
  behavior as done.
- Deferred work and accepted review findings are recorded in the project's
  issues document; items a change resolves are removed.

## Product Language and Implementation Detail

- Use cases, product briefs and user guides describe **what** the product does
  for the user: flows, rules and visible outcomes. They never name types,
  functions, clients, storage or framework APIs.
- Architecture and design documents describe **how**: models, boundaries,
  dependencies and patterns. They may name types and test suites.
- User guides follow the project's own tone guide where it has one.

## Frontmatter

Standards, architecture, domain and design documents start with YAML
frontmatter:

```yaml
---
title: "Service Layer Architecture"
category: "Architecture"
audience: "AI Coding Assistant"
applies_to: ["Sources/Domain/**/*Service.swift"]
dependencies: ["docs/design/architecture.md"]
last_updated: "2026-11-01"
---
```

- `title`: the document's name.
- `category`: one of `Standards`, `Architecture`, `Domain`, `Guide`, `How-To`,
  `Design`, `Index`.
- `audience`: `"AI Coding Assistant"`.
- `applies_to`: the files or modules the document governs.
- `dependencies`: related documents to read with it; omit or leave empty when
  there are none.
- `last_updated`: `YYYY-MM-DD`.

README files, user guides and documents meant for outside readers may omit
frontmatter.

## File Names and Organization

- Use kebab-case for multi-word file names, such as
  `markdown-style-guidelines.md`. Avoid abbreviations except widely understood
  ones such as `README.md`.
- Name how-to guides after their task.
- Create a new document for a distinct concept, pattern or feature; otherwise
  extend the document that owns the topic.
- Split documents that pass about 500 lines into focused documents that link to
  each other.

## Document Structure

### Pattern and Architecture Documents

- **Context:** why the pattern exists and what problem it solves.
- **Mandatory rules:** bulleted **Must** and **Must Not** requirements.
- **Golden path example:** a short code block showing the correct
  implementation.
- **Common pitfalls:** known edge cases and frequent mistakes, each with its
  fix.

### Domain Documents

- **Entity definitions:** the business concept and its purpose.
- **Invariants:** rules that must always hold.
- **Relationships:** how entities link, and the constraints on those links.

### Guides and How-To Documents

- **Prerequisites:** the required state, dependencies or setup.
- **Steps:** the sequence to follow.
- **Verification:** how to confirm the task worked.

## Style and Tone

- **Succinct:** prefer short sentences and bullet points over long paragraphs.
- **Imperative in rules:** standards use **Must**, **Must Not** and
  **Required**, not "should probably" or "consider".
- **Generic examples:** use generic names such as `TargetEntity` or
  `ExampleService` in pattern examples, so they are not copied as real code.
- **Plain punctuation:** no emoji, and no em dashes; use a comma, colon,
  semicolon, parentheses or a new sentence instead.
- **Full paths:** refer to files by their full path from the repository root,
  such as `Sources/Domain/Accounts/AccountService.swift`, not a bare file
  name.
- **Descriptive links:** link text says what the target is, such as
  `[Architecture](docs/design/architecture.md) for layer rules`, never "this"
  or "here".
- **Diagrams as code:** use Mermaid for flows and relationships, and tables for
  comparisons. Prefer them to images.
- **No unrequested documents:** do not add Markdown files nobody asked for
  unless the change needs them.
