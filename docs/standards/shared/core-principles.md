---
title: "Core Development Principles"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*"]
dependencies: ["agent-workflow.md", "code-review.md", "documentation.md"]
last_updated: "2026-11-01"
---

# Core Development Principles

Rules that hold in every project, whatever its stack. The project's own
standards define its architecture, layers and domain rules on top of these.

## Workflow

- **Working mode:** before making any change in a session, ask the owner which
  mode to use and follow [agent-workflow.md](agent-workflow.md).
- **Incremental changes:** prefer small, verifiable steps.
- **Verify architecture:** every change respects the project's layers and
  dependency direction.
- **Documentation:** follow [documentation.md](documentation.md) and
  [markdown-style-guidelines.md](markdown-style-guidelines.md) for every
  Markdown change.

## SOLID

SOLID is review-gated: [code-review.md](code-review.md) rates each principle
separately. Violations are architectural defects, not style preferences.

- **Single Responsibility:** each type has one reason to change. UI renders and
  sends intent; state holders evolve state; domain helpers each own one product
  rule. When a UI or state type starts encoding product rules, move the rule
  into the domain and call it.
- **Open/Closed:** extend behavior by adding a type, case or conformance, not by
  editing a cascade of unrelated branches. Prefer exhaustive matching on domain
  enums, so the compiler flags every extension point, over scattered `if`
  ladders. Table-driven dispatchers stay generic: edge cases become named cases
  or a resolver, never one-off early exits in the generic entry point.
- **Liskov Substitution:** conformances honor their contract: stable identity,
  round-trip encoding, value equality. Any variant is substitutable wherever its
  base is expected, with no "works for one kind, silently wrong for another".
- **Interface Segregation:** keep protocols and dependency clients small; a
  client exposes only what its callers use. Components take the minimal state
  they render, not the whole feature state.
- **Dependency Inversion:** features depend on abstractions, never on concrete
  I/O. External systems and ambient services (the clock, calendar, random IDs,
  preferences storage) are reached through injected dependencies, so behavior
  is deterministic and testable. Pure domain types stay dependency-free.

## Implementation Rules

- **Centralize shared logic:** design constants and reusable logic live in one
  place. Never duplicate interactive or visual logic.
- **Domain facts before presentation:** shared product rules live in neutral
  domain helpers. Presentation and execution code consume those answers; they
  do not re-derive them.
- **Pass structure, not interpreted context:** pass the structural facts (the
  parent, the siblings, the record) rather than booleans that pre-compute
  domain meaning at the call site. Let the code that needs the rule derive it.
- **No magic values:** numbers and strings with meaning are named constants,
  except `0`, `1` and `-1` in calculations.
- **No abbreviations** in names.
- **No forced unwraps or non-null assertions** outside tests, or after an
  explicit check.
- **Design system:** colors, typography and spacing come from the project's
  design tokens, never literals in features.

## Comments

Default to **none**. A well-named type, function or property already says
*what* it does; a comment that repeats that is noise, and it drifts out of sync
the moment the code changes.

Add a comment only when it captures a **why** the code cannot express: a hidden
constraint, a subtle invariant, a workaround for a platform quirk, behavior that
would surprise the next reader. Ask "would deleting this leave someone confused
about intent?" If not, delete it.

Delete these on sight:

- Restating the identifier: `/// Display title`, `/// Whether the chip is on`.
- Restating the return value: `/// Returns true when …` on `isSelected`.
- Product-UI tourism: `/// for the chip row`, `/// Stage-1 single-select`.
- Ticket, use-case or caller pointers: `UC-4.10`, `fixes #123`,
  `Settings reads this`.
- Migration or changelog history, which git records.
- Restatements of structure, field lists or what the next line shows.

Keep **one short line** when there is a real why, such as
`/// Legacy .drink folds into .count`. If the why takes a paragraph, put it in
the architecture or design document instead.

File headers and boundary comments that a project requires are not narration;
copy the pattern from sibling files.

## Neutral Defaults

Never assume one country's conventions. Currency, locale, date and number
formats, units and examples come from the user's settings or the owning data,
never a hard-coded national default or the first case of an enum.
