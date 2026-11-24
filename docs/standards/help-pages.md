---
title: "Help Page Standards"
category: "Standards"
audience: "Contributors"
applies_to: ["docs/help/**"]
dependencies: ["docs/standards/documentation.md", "docs/design/visual-design.md"]
last_updated: "2026-11-24"
---

# Help Page Standards

How Fathom's Help pages in `docs/help/` are written, so they read the way a colleague would explain Fathom out loud. They add to [Documentation](documentation.md), which covers every document. [Setting Up Fathom](../help/setting-up-fathom.md) is the model page.

## Rules

- **Must** use short sentences, each with a subject and a verb, that a person would say out loud, and say "you" to the reader.
- **Must** say what to do in each step, and add why only where the reader would otherwise wonder.
- **Must** explain a term, such as a table, a list, a class, a draft or a schedule, in one plain sentence before a step relies on it. A page that leans on several gathers them under a short "What to Know First".
- **Must** give one link where the reader would want more, as a closing "See [Lists](../help/lists.md)" for its section, not "as [Lists](../help/lists.md) sets out" on every step.
- **Must** give each step one action: a step that needs several sentences is two steps.
- **Must** say the real sequence: where Fathom needs one change approved before the next is possible, the steps say so, in rounds.
- **Must** end a guide by saying how the reader knows they're done.
- **Must** check each fact against Fathom before writing it.
- **Must** describe only what Fathom does now, never what is planned: no "for now", "later" or "to follow", since Help is shown in Fathom.
- **Must** bring an existing Help page to these rules when it is next changed.

## Required Pages

Besides a page for each page of Fathom, listed in `docs/help/index.md`, Help holds:

- **Pages:** `docs/help/pages.md`, linked first from the index, lists every page of Fathom: what it's for, where it is in the sidebar, and which permission shows it, with the starting roles that hold it.
  - It exists because a page a role can't see is left out of its sidebar with nothing said.
  - Every change to a page's place in the sidebar, or to the permission that shows it, updates it.
- **Role tutorials:** a page for each starting role, such as `docs/help/working-as-a-product-manager.md`, with the three to five workflows the role does most, each a few steps that link to the Help pages for the details rather than repeat them.
  - They are led by `docs/help/setting-up-fathom.md`, for the Workforce Administrator from an empty database, and `docs/help/how-work-moves-between-roles.md`, from a Product Manager's draft to the Engineering Director's approval and an Engineering Manager's staffing.

## Before and After

| Before | After |
| --- | --- |
| Check **Hiring states**, whose choices start with one for each meaning, and rename or add to them. | Open **Hiring states**. It starts with **Request to hire**, **Approved to hire**, **Hired** and **Left**. Rename those to the words your organization uses, if they differ. |
| Add a column for each list made, and any web link, note or number columns, as [People](../help/people.md#add-a-column) sets out. | Add a column for each list you made. You can also add a column that holds a web link, a note or a number. |
| Give a column holding private details the **Personal** or **Confidential** class, as [Data classes](../help/data-classes.md) explains. | Each list and column has a class, which decides who sees it. If a list's values are private, choose **Personal** or **Confidential** as its class when you make it. |

## Exceptions

Help pages differ from other documents in these ways:

- **"You":** [UI Conventions](ui-conventions.md#principles)'s rule against the second person is for on-screen labels and messages, not Help pages.
- **One line, then a link:** a role tutorial's step may give one line of a detail another Help page holds before linking to it.
- **No guide headings:** [Documentation](documentation.md)'s Prerequisites, Steps and Verification headings aren't needed; "What to Know First" and the closing line saying how the reader knows they're done cover them.
- **Links by file name:** links between Help pages use the file name, such as `lists.md`, not the full path from the repository root, since the pages are shown in Fathom.
- **Length:** a longer page is fine when plain speech needs it; plain beats short.
