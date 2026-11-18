# Fathom: Features Page

**Last updated:** 2026-11-17

Features lists the plan's features in one table, with a board as a second way of showing them. It sits in the sidebar's Plan section, after Projects.

[Features help](../../help/features.md) describes it for the people who use it. [Visual Design](../visual-design.md) covers what every page shares.

## Layout

- **Heading:** New feature, then New column for those who change planning configuration, then Table | Board, kept in the address.
- **The table:** edited like People's, as [People](people.md) sets out.
- **Details:** grouped under Details, Customers and commitments, Planning, and Columns.

## Columns

- **Order:** Name, Status, Description, Notes, Customers, Projects, Proposals, Priority, Needed by, Effort, Size, Risk, Release, Target cycle, Feature team, Staffed, then added columns.
- **Release:** read only, following from the target cycle; Later is its empty value.
- **Feature team:** a Planned or In progress feature with none shows No team, as a [warning on a value](../../standards/ui-conventions.md#values).
- **Staffed:** read only; for Planned or In progress features, Yes when any allocation gives them a month.
- **Projects and Proposals:** changed only by those who change the plan; New feature doesn't offer them.
  - A change drafts the project or proposal, so the feature's row isn't marked.
- **Added columns:** General lists only, with no planned hires or visibility; a drafted one can't be filled until approved.
  - Remove column shows only to those who may also change features.

## Grouping

- **Default:** one list, with no grouping.
- **Group by:** None, Cycle, Release, Needed by and every list column, with Then by as [Tables](../../standards/ui-conventions.md#tables) sets out.
- **By Cycle:** each schedule's cycles in order, then Later for features with no cycle.
- **By Release:** each schedule's releases by date, then its cycles in no release, such as Platform: Not released yet, then Later.

## Features Board

- **What it is:** the [Roadmap](../../product/decisions.md#planning), drawn as [Boards](../../standards/ui-conventions.md#boards) sets out.
- **Read only:** nothing on the board can be changed.
- **One view:** table and board share the page's controls and view; a saved view doesn't keep which shows.
- **Columns:** one schedule's cycles, chosen in a Schedule menu, as many as fit, then Later with every uncycled feature.
  - A header shows its release in the release's colour, then the cycle; the current cycle has a red top line.
  - Columns show no size totals.
- **Strip:** the Schedule and Card buttons start the [timeline strip](../../standards/ui-conventions.md#timelines), stepping by cycle.
- **Cards:** name, key, status and priority, [Size and Risk marks](../../standards/ui-conventions.md#values), Needed by, and Not staffed, but no customers.
  - The Card menu chooses which show.
- **Rows:** Group by offers the table's choices except Cycle, starting at None, with no Then by.
- **Card order:** priority, month needed by, status, customer count, then name, with empty values last.

## Planned

- **Moving cards:** dragging or Alt and arrows drafts a new cycle or row value; Live only stays read only.
  - Refused for multi-value or derived columns, and for features with allocations, Done or Cancelled.
- **Months as columns:** the Board's default, as the [Decisions Log](../../product/decisions.md#planning) sets out.
- **On track or Late:** on staffed cards, with forecasting.
