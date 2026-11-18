---
title: "Documentation Standards"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*"]
dependencies: ["markdown-style-guidelines.md", "help-pages.md", "testing.md"]
last_updated: "2026-11-17"
---

# Documentation Standards

How Fathom's documents are written and kept current. Documents are read by people and by AI coding assistants, so they must be clear, unambiguous and correct. Formatting rules live in [Markdown Style Guidelines](markdown-style-guidelines.md). Help pages also follow [Help Page Standards](help-pages.md), and manual tests [Testing Standards § Manual Tests](testing.md#manual-tests).

## One Fact, One Place

- Record each fact in one document only, and link to it from others instead of repeating it. Each document owns what [Which Document Owns What](#which-document-owns-what) lists; keep that list current when documents are added, split or removed.
- Standalone summaries for outside readers may repeat facts, but are listed as exceptions and stay consistent with the documents that own those facts.
- Keep each open question in the document that will own its answer.

## Which Document Owns What

- Contributing (`CONTRIBUTING.md`): who may contribute, and how issues and questions come in
- Security policy (`SECURITY.md`): how to report a vulnerability, and which versions are supported
- Code of conduct (`CODE_OF_CONDUCT.md`): the Contributor Covenant, with where reports go
- Product brief (`docs/product/brief.md`): what Fathom is, its users, goals, scope, and constraints, with one-line key decisions that link to the decisions log or an ADR
- Domain concepts (`docs/product/domain.md`): definitions of terms
- Decisions log (`docs/product/decisions.md`): product decisions and their details
- Use cases (`docs/product/use-cases.md`): scenarios
- Roles (`docs/product/roles.md`): role definitions and what each role can do
- Roadmap (`docs/product/roadmap.md`): the order in which Fathom's goals are delivered
- Domain model (`docs/design/domain-model.md`): entities, relationships, and modeling proposals
- Architecture (`docs/design/architecture.md`): a high-level view of Fathom's parts and how they connect, kept at the level of containers and networks
- Development setup (`docs/design/development-setup.md`): repository layout, local development, the fictional data and development accounts, and releases
- Visual design (`docs/design/visual-design.md`): how Fathom's screens look and behave
- UI conventions (`docs/standards/ui-conventions.md`): the principles and conventions every screen shares, each with the shared piece that draws it and an example
- Architecture decision records (`docs/adr/`): technical decisions
- Issues ([GitHub Issues](https://github.com/ribbitworks/fathom/issues), as `docs/standards/issues.md` sets out): known problems and deferred work
- Security plan (`docs/security/security-plan.md`): threats and their mitigations, vulnerability scanning, and source code assurance
- Manual tests (`docs/testing/`, with each role's acceptance test in `docs/testing/acceptance/`): lasting step-by-step tests of a feature by hand in a real browser, following [Testing Standards § Manual Tests](testing.md#manual-tests)
- Manual test basics (`docs/testing/manual-test-basics.md`): what every manual test shares, its environment, where its accounts come from, the common procedures, named, and the common terms
- Help pages (`docs/help/`): how to use each page of Fathom, and the workflows each role does most, for the people who use it, listed in `docs/help/index.md`; a guide that repeats facts the documents above own, kept consistent with them, and updated by every change to the page it covers
- Securing your environment (`docs/operations/securing-your-environment.md`): what whoever runs Fathom must secure, since Fathom can't
- Supported platforms (`docs/operations/supported-platforms.md`): the platforms Fathom is tested and supported on, and their setup needs
- How Fathom is built (`docs/how-fathom-is-built.md`): for outside readers, how Fathom is made and how its quality is checked; a summary that repeats facts the standards, the Security Plan, the data protection summary and the manual tests own, kept consistent with them; and the one home of the AI tool and models used, updated when either changes
- Data protection summary (`docs/privacy/data-protection.md`): a short list of what safeguards Fathom's data, linking to the documents above that own the facts; update it whenever those facts change

## Kept Current

- Documents are updated in the same change as the code, not later.
- A change updates every document it makes untrue, incomplete or out of date, not only the documents it edits: the README's quick start and links, setup steps and commands, the repository layout, architecture, decisions, use cases, Help pages, roadmap and issues.
- Deferred or partial features stay marked as such; never document unshipped behaviour as done.
- Known problems, deferred work and accepted review findings are filed as GitHub issues through the issue forms, only with the owner's explicit approval and with the labels [Issues](issues.md) sets out, rather than in a document, and any document that needs one links to it. A pull request that fixes one says `Fixes #n` in its description, never in commit messages or code comments.

## Product Language and Implementation Detail

- Use cases, the product brief and Help pages describe **what** Fathom does for the user: flows, rules and visible outcomes. They never name types, functions, clients, storage or framework APIs.
- Architecture and design documents describe **how**: models, boundaries, dependencies and patterns. They may name types and test suites.
- Help pages follow [Help Page Standards](help-pages.md) for their tone.

## Frontmatter

Standards, architecture, domain and design documents start with YAML frontmatter:

```yaml
---
title: "Service Layer Architecture"
category: "Architecture"
audience: "AI Coding Assistant"
applies_to: ["src/domain/**"]
dependencies: ["docs/design/architecture.md"]
last_updated: "2026-11-01"
---
```

- `title`: the document's name.
- `category`: one of `Standards`, `Architecture`, `Domain`, `Guide`, `How-To`, `Design`, `Index`.
- `audience`: `"AI Coding Assistant"`.
- `applies_to`: the files or modules the document governs.
- `dependencies`: related documents to read with it; omit or leave empty when there are none.
- `last_updated`: `YYYY-MM-DD`.

README files, Help pages and documents meant for outside readers may omit frontmatter.

## File Names and Organization

- Use kebab-case for multi-word file names, such as `markdown-style-guidelines.md`. Avoid abbreviations except widely understood ones such as `README.md`.
- Name how-to guides after their task.
- Create a new document for a distinct concept, pattern or feature; otherwise extend the document that owns the topic.
- Split documents that pass about 500 lines into focused documents that link to each other.

## Document Structure

### Pattern and Architecture Documents

- **Context:** why the pattern exists and what problem it solves.
- **Mandatory rules:** bulleted **Must** and **Must Not** requirements.
- **Golden path example:** a short code block showing the correct implementation.
- **Common pitfalls:** known edge cases and frequent mistakes, each with its fix.

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
- **Imperative in rules:** standards use **Must**, **Must Not** and **Required**, not "should probably" or "consider".
- **Generic examples:** use generic names such as `TargetEntity` or `ExampleService` in pattern examples, so they are not copied as real code.
- **Plain punctuation:** no emoji, and no em dashes or en dashes; use a comma, colon, semicolon, parentheses or a new sentence instead, and write ranges with "to".
- **Canadian English:** documents and on-screen text use Canadian English, such as colour, harbour, centre, and licence as a noun.
- **Full paths:** refer to files by their full path from the repository root, such as `docs/design/domain-model.md`, not a bare file name.
- **Descriptive links:** link text says what the target is, such as `[Architecture](docs/design/architecture.md) for layer rules`, never "this" or "here".
- **Diagrams as code:** use Mermaid for flows and relationships, and tables for comparisons. Prefer them to images.
- **No unrequested documents:** do not add Markdown files nobody asked for unless the change needs them.
