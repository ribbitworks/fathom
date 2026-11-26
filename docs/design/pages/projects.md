---
title: "Projects Page"
category: "Design"
audience: "Contributors"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/design/visual-design.md", "docs/standards/ui-conventions.md", "docs/help/projects.md"]
last_updated: "2026-11-25"
---

# Fathom: Projects Page

Projects holds the plan's projects, proposals, customers and milestones, each on its own tab. It sits in the sidebar's Plan section, after Overview; those who only see the plan see it read only.

[Projects help](../../help/projects.md) describes it for the people who use it. [Visual Design](../visual-design.md) covers what every page shares.

## Layout

- **Tabs:** Projects, Proposals, Customers and Milestones, on the heading's line and kept in the address. Each tab keeps saved views of its own.
- **Each tab:** a table edited like People's, as [People](people.md) sets out.
- **Names:** projects and proposals follow [Links to Records](../../standards/ui-conventions/pages-and-panels.md#links-to-records).
- **Show on Features:** a project's or proposal's row menu opens [Features](features.md) filtered to its features.
- **Customers' columns:** Name, Description, Notes, then Projects, Proposals and Features, in the order its details run.
  - Projects, Proposals and Features are read only, worked out from the links the other way: the projects and proposals naming the customer, and every feature it gets or asks for, naming it directly, needed by one of its projects or proposed by one of its proposals.
  - Each lists records as [Several records in a cell](../../standards/ui-conventions/pages-and-panels.md#links-to-records) sets out, and is searched, sorted, filtered, broken down by Metrics and exported as any such column, drafts included as the Draft menu shows them.
  - Features shows only to those who see features.
- **Show all features:** a customer's row menu opens [Features](features.md) with its `customer` filter, for those who see features.
- **Remove customer:** turned off while a project, proposal or feature names the customer, with a line naming the first and counting the others, such as "P-2001 Crane Control names this customer." or "P-2017 Depot Operations and 1 other name this customer.", as [Controls turned off](../../standards/ui-conventions/entering-and-saving.md#refusals) sets out. One drafted to be removed no longer counts. The server still refuses a removal another draft makes untrue meanwhile.
- **Show on Milestones:** a project's row menu opens the Milestones tab filtered to it.
- **Activities column:** for those who see features, names each project's activities on one line, cut short, every name in its tip; read only, since an activity moves on [Activities](activities.md).
- **New:** a form in the side panel; Project starts as the one the table is filtered to.

## Record Details

- **Milestones:** have no panel of their own; a project's panel lists them, with Add milestone.
- **A new milestone's project:** the Milestones table's empty row's Project picker offers New project, which fills the row with the project once added, as [Adding from a picker](../../standards/ui-conventions/entering-and-saving.md#choices) sets out. A saved milestone's project can't change.
- **A project's dates:** come from its milestones, so they have no pencil.
- **Linked records:** customers and proposals open in their own tab's panel; features open on [Features](features.md).
- **A customer:** Name, Description and Notes under Details, then Projects, Proposals and Features under Commitments, drawn as a feature's details draw its customers and commitments: links one to a line, ID first, None when empty. Features shows only to those who see features. The owner chose this on 2026-11-24 over a customer-only layout with each project's next delivery and features nested under it, which an earlier mockup showed.
- **Adding a customer from Customers:** a project's and a proposal's Customers picker offers New customer, in its panel and in its table's cell, as [Adding from a picker](../../standards/ui-conventions/entering-and-saving.md#choices) sets out. A feature's pickers on [Features](features.md) do the same.
- **Activities:** for those who see features, a project's Activities row lists them one to a line, folded past the first five, each opening on [Activities](activities.md), or None. An activity a draft adds to the project, or takes from it, carries that draft's mark, as the Draft view shows it, as a milestone does in Milestones.
  - **Show on Activities:** whenever the project has an activity, the row's name, Activities, is a link opening Activities filtered to the project, read as "Activities, show on Activities"; the project's ⋯ menu, on its row and in its details, offers Show on Activities too, whenever the link shows.
  - **Add activity:** under the list for those who edit features, opening New activity stacked under the project's details, on Projects, with the project set, as [Adding from a record's details](../../standards/ui-conventions/entering-and-saving.md#choices) sets out; once added, the details list it, and focus goes back to Add activity.
- **A proposal's Features:** in its details, Choose features and New feature sit under the list, in place of the row's pencil, as [Actions on a list in a panel](../../standards/ui-conventions/pages-and-panels.md#panels) sets out. Choose features opens the picker the pencil opened. New feature, shown only to a role that may add features, opens the New feature form stacked under the details; the feature is added as a draft and linked as a draft of the proposal that uses it, so the two are approved together. The proposal's Features cell offers New feature in its picker too.
  - **Show on Features:** whenever the proposal names a feature, the row's name, Features, is a link opening Features filtered to the proposal, read as "Features, show on Features", as the proposal's ⋯ menu's Show on Features does.

### Scope History

- **Where:** at the end of a project's and a proposal's panel, as [History](../../standards/ui-conventions/pages-and-panels.md#history) sets out.
- **Who sees it:** roles that see features, since it lists them; the server gives any other role none.
- **A row:** the feature, Added or Removed with the day drafted, and a proposal removal's reason.
- **Never undone:** a row is never struck through or removed.
- **Reason:** nothing asks for one on removal; a drafted removal has a pencil to add it in place.

## Planned

- **Projects timeline:** each project on the [shared timeline](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines), from first to last milestone.
  - Milestones are diamonds, hollow while to come; the last is red when its work ends later or isn't staffed.
  - Its features and [activities](https://github.com/ribbitworks/fathom/issues/207) show under it, as in Capacity's Work.
