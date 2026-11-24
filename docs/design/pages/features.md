---
title: "Features Page"
category: "Design"
audience: "Contributors"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/design/visual-design.md", "docs/standards/ui-conventions.md", "docs/help/features.md"]
last_updated: "2026-11-24"
---

# Fathom: Features Page

Features lists the plan's features in one table, with a board as a second way of showing them. It sits in the sidebar's Plan section, after Projects.

[Features help](../../help/features.md) describes it for the people who use it. [Visual Design](../visual-design.md) covers what every page shares.

## Layout

- **Heading:** Table | Board beside the title, kept in the address; at the right, New column for those who edit features and see people, then New feature.
- **The table:** edited like People's, as [People](people.md) sets out.
- **Details:** grouped under Details (Name to Notes), Customers and commitments (Customers, Projects, Proposals), Planning (Priority to Staffed), then Columns, the added ones.
  - The table starts its columns in the details' order, so the two read alike.
  - Customers are the feature's own; its projects' and proposals' customers are reached through their links, not repeated.

## Columns

- **Order:** Name, Status, Description, Notes, Customers, Projects, Proposals, Priority, Needed by, Effort, Size, Risk, Release, Target cycle, Feature team, Staffed, then added columns.
- **Release:** read only, following from the target cycle; Later is its empty value. In the details, it links to the release's schedule on [Releases](releases.md).
- **Feature team:** a Planned or In progress feature with none shows No team, as a [warning on a value](../../standards/ui-conventions/drafts-and-values.md#values).
- **Staffed:** read only; for Planned or In progress features, Yes when any allocation gives them a month, a planned hire's included. It is empty for other statuses, so Not staffed is a plain filter.
- **Customers:** changed only by those who change the plan, who alone see it in New feature; the server refuses others' changes and their discarding of such a change.
- **Projects and Proposals:** changed only by those who change the plan; New feature doesn't offer them.
  - A change drafts the project or proposal, so the feature's row isn't marked.
  - In the cell and in the feature's details, a project or proposal a draft adds has the draft's dot, and one it takes away has the dot and is struck through, as [A part a draft adds or removes](../../standards/ui-conventions/drafts-and-values.md#drafts) sets out.
  - Those drafts are decided on Projects, where they are drafts of the project or proposal, or with the Draft menu's Approve; the cell has no menu of its own, as no table's cell does.
- **Added columns:** General lists only, with no planned hires or other class; a drafted one can't be filled until approved.
  - Remove column shows only to those who may also change features.

## Grouping

- **Default:** one list, with no grouping.
- **Group by:** None, Cycle, Release, Needed by and every column holding choices, Customers, Projects and Proposals included, with Then by as [Tables](../../standards/ui-conventions/tables.md#tables) sets out.
- **By Cycle:** every schedule together, in their order, each cycle headed with its schedule and name, then Later for features with no cycle.
- **By Release:** each schedule's releases by date, headed with the schedule, release and Ships on, then its cycles in no release, such as Platform: Not released yet, then Later.
  - A heading counts its features, not their effort. A release no feature targets has no heading.
  - A feature whose draft moves its target cycle is grouped by the draft.
- **By Needed by:** earliest first, then No date.
- **Order:** each grouping's headings can run the other way, latest first, Z to A or in reverse list order, with Later or the heading for none first, on the table and the Board alike, as [The groups' order](../../standards/ui-conventions/tables.md#tables) sets out.

## Features Board

- **What it is:** the [Roadmap](../../product/domain.md#planning-terms), drawn as [Boards](../../standards/ui-conventions/dates-timelines-and-boards.md#boards) sets out.
- **Read only:** nothing on the board can be changed.
- **One view:** table and board share the page's controls and view. A saved view keeps the Board's columns and card choices, but not which shows or the month or cycle the Board starts from.
- **Columns:** chosen in a Columns menu: Months, the default, then each schedule's cycles.
  - **Months:** one column a month, as many as fit, then No date. The months run from 12 months back to the latest month any feature is needed by, a year ahead at the least.
    - **Placing features:** a feature sits in the month it is needed by, including a month that has passed; one needed before the first month is not on the board.
    - **Headers:** a header names the month; this month's is underlined in red.
  - **A schedule's cycles:** as many as fit, then Later with every uncycled feature. A header shows its release in the release's colour, then the cycle and its days; the current cycle's header is underlined in red.
  - Columns show no size totals.
- **Strip:** the Columns and Card buttons start the [timeline strip](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines). By months it names quarters, such as Q1 2027, and ‹ and › step a quarter; by a schedule's cycles it names each cycle, and ‹ and › step a cycle.
  - **Where it opens:** the month or cycle gone to, by opening the board, Today, choosing in the strip, or ‹ or ›, is the second column, so the one before it stays in view; it is the first only where one column fits. The strip's period holding it is filled with the accent colour.
  - **Views menu:** the board's Views menu leaves out the sort, units, and hidden, frozen, moved and widened columns, since the board orders its own cards and lays out no columns; they stay in the shared view.
- **Cards:** name, key, status and priority, [Size and Risk marks](../../standards/ui-conventions/drafts-and-values.md#values), Needed by, and Not staffed, but no customers.
  - The Card menu chooses which show.
- **Rows:** Group by offers the table's choices except Cycle, starting at None, with no Then by.
- **Card order:** priority, month needed by, status, customer count, then name, with empty values last.

## Planned

- **Moving cards:** dragging or Alt and arrows drafts a new cycle or row value; Live only stays read only.
  - Refused for multi-value or derived columns, and for features with allocations, Done or Cancelled.
- **Moving a card to another month:** changes its Needed by.
- **On track or Late:** on staffed cards, with forecasting.
