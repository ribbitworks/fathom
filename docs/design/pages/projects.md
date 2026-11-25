---
title: "Projects Page"
category: "Design"
audience: "Contributors"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/design/visual-design.md", "docs/standards/ui-conventions.md", "docs/help/projects.md"]
last_updated: "2026-11-23"
---

# Fathom: Projects Page

Projects holds the plan's projects, proposals, customers and milestones, each on its own tab. It sits in the sidebar's Plan section, after Overview; those who only see the plan see it read only.

[Projects help](../../help/projects.md) describes it for the people who use it. [Visual Design](../visual-design.md) covers what every page shares.

## Layout

- **Tabs:** Projects, Proposals, Customers and Milestones, on the heading's line and kept in the address. Each tab keeps saved views of its own.
- **Each tab:** a table edited like People's, as [People](people.md) sets out.
- **Names:** projects and proposals follow [Links to Records](../../standards/ui-conventions/pages-and-panels.md#links-to-records).
- **Show features:** a project's or proposal's row menu opens [Features](features.md) filtered to its features.
- **Customers' columns:** Name, Description, then Projects, Proposals and Features, then Notes last.
  - Projects, Proposals and Features are read only, worked out from the links the other way: the projects and proposals naming the customer, and every feature it gets or asks for, naming it directly, needed by one of its projects or proposed by one of its proposals.
  - Each lists records as [Several records in a cell](../../standards/ui-conventions/pages-and-panels.md#links-to-records) sets out, and is searched, sorted, filtered, broken down by Metrics and exported as any such column, drafts included as the Draft menu shows them.
  - Features shows only to those who see features.
- **Show all features:** a customer's row menu opens [Features](features.md) with its `customer` filter, for those who see features.
- **Remove customer:** turned off while a project, proposal or feature names the customer, with a line naming the first, such as "P-2001 Crane Control names this customer.", as [Controls turned off](../../standards/ui-conventions/entering-and-saving.md#refusals) sets out. One drafted to be removed no longer counts. The server still refuses a removal another draft makes untrue meanwhile.
- **Show milestones:** a project's row menu opens the Milestones tab filtered to it.
- **New:** a form in the side panel; Project starts as the one the table is filtered to.

## Record Details

- **Milestones:** have no panel of their own; a project's panel lists them, with Add milestone.
- **A project's dates:** come from its milestones, so they have no pencil.
- **Linked records:** customers and proposals open in their own tab's panel; features open on [Features](features.md).
- **A customer:** Name, Description and Notes under Details, as a feature's Notes is; its projects, proposals and features show in the table alone.

### Scope History

- **Where:** at the end of a project's and a proposal's panel, as [History](../../standards/ui-conventions/pages-and-panels.md#history) sets out.
- **A row:** the feature, Added or Removed with the day drafted, and a proposal removal's reason.
- **Never undone:** a row is never struck through or removed.
- **Reason:** nothing asks for one on removal; a drafted removal has a pencil to add it in place.

## Planned

- **Customers:** the projects, proposals and features naming each customer in its details, before Notes, with each project's next delivery ([#54](https://github.com/ribbitworks/fathom/issues/54)).
- **Projects timeline:** each project on the [shared timeline](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines), from first to last milestone.
  - Milestones are diamonds, hollow while to come; the last is red when its work ends later or isn't staffed.
  - Its features and [activities](https://github.com/ribbitworks/fathom/issues/207) show under it, as in Capacity's Work.
