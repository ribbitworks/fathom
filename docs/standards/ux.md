---
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["apps/web/**/*"]
dependencies: ["docs/standards/code-review.md", "docs/design/visual-design.md"]
last_updated: "2026-10-30"
---

# UX Standards

This document defines how Fathom's screens are designed and how built screens are reviewed. Both are done by a separate agent acting as a senior UX designer with long experience designing modern, clean web applications, including project planning and resource management tools. In the [Workflow](../../AGENTS.md#workflow), the designer designs a screen before any code is written, and reviews the built screen alongside the code review.

## The Designer's Role

- **Designs and reviews only:** The designer does not write code, edit files other than their own design or review file, or create commits, as in the [Code Review Standards](code-review.md).
- **Specific:** Every design decision and finding names the screen and explains why it matters to the people using Fathom.

## Designing a Screen

Before a screen is built or changed, the designer proposes its design:

- **Starting points:** The [Use Cases](../product/use-cases.md), [Decisions Log](../product/decisions.md), [Roles](../product/roles.md), [Visual Design](../design/visual-design.md), and the screens Fathom already has.
- **Contents:** The screen's purpose and main task; its layout, as a simple text wireframe; how it behaves with realistic amounts of data; what each role sees; its loading, empty, error, saving, and refused states; its dialogs and flows; and its labels and messages.
- **Agreement:** The design is shown to the user, who agrees it, or asks for changes, before any code is written.
- **Where it is kept:** The agreed design is written to `.tmp/ux/ux-design_YYYY-MM-DD_HH-MM_{branch}.md`, replacing any `/` in the branch name with `-`. It is kept until the change is committed and given to both the code review and the UX review. The designer proposes any rule that applies beyond one screen, and once the user agrees, the agent building the change adds it to Visual Design, which owns how all screens look and behave and is tracked with the code.

## Reviewing a Built Screen

The review covers every screen the change adds or alters, viewed with the roles that see it differently:

1. Read the agreed design, the components, and their tests, and any screenshots the requester provides.
1. Check the built screen against the agreed design.
1. Rate each focus area below, and record findings with a priority, screen, file, and suggested fix.
1. Write the review, and summarize it for whoever requested it.

## Focus Areas

Designs follow these areas, and reviews rate each from 1 to 5, or marked not applicable, using the scale in the [Code Review Standards](code-review.md#ratings-and-approval):

- **Purpose and flow:** The screen makes its main task obvious and quick, with the fewest steps, and fits the way planners work across Fathom.
- **Scale:** The design still works with realistic amounts of data, such as hundreds of choices, a whole organization's people, or many months, through search, filtering, sorting, paging, or virtual scrolling as fits.
- **Layout and hierarchy:** Clear structure, alignment, and spacing; type sizes and weights that show what matters most; no oddly sized or competing elements.
- **Density:** Information-dense, as a daily work tool should be, without becoming cluttered.
- **Consistency:** Follows [Visual Design](../design/visual-design.md) and matches patterns already used in Fathom, or proposes changing Visual Design for all screens rather than diverging on one.
- **States:** Loading, empty, error, and saving states, and what happens when the server refuses a change, are designed, not left to defaults, and empty states help users start.
- **Accessibility:** Keyboard use, focus order, labels, contrast, and nothing shown by colour alone, as Visual Design requires.
- **Words:** Plain, short, consistent labels and messages that use the terms in [Domain Concepts](../product/domain.md).

## Ratings and Approval

A screen is approved when every applicable area is rated 4 or above and no BLOCKING or HIGH finding is open, using the priorities in the [Code Review Standards](code-review.md#priorities). A design that would not scale to realistic data, or that blocks keyboard or screen reader users, is at least HIGH.

## Review Output

1. **Scope:** The screens and roles reviewed.
1. **Highlights:** What the design does well.
1. **Detailed review:** One section per focus area, with its rating and reasoning.
1. **Findings:** Ordered BLOCKING, HIGH, MEDIUM, LOW, each with the screen, file, and suggested fix.
1. **Proposed design:** For screens rated below 4 in any area, how the designer would redesign them.

The review is written to `.tmp/ux/ux-review_YYYY-MM-DD_HH-MM_{branch}.md`, replacing any `/` in the branch name with `-`, and summarized for whoever requested it. When findings are addressed, an "Updates Made After Review" section is added, as for code reviews.
