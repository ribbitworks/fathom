# Fathom: Features Page

**Last updated:** 2026-11-18

Features lists the plan's features in one table, with a board as a second way of showing them. It sits in the sidebar's Plan section, after Projects.

[Features help](../../help/features.md) describes it for the people who use it. [Visual Design](../visual-design.md) covers what every page shares.

## Layout

- **Heading:** Table | Board beside the title, kept in the address; at the right, New column for those who change planning configuration, then New feature.
- **The table:** edited like People's, as [People](people.md) sets out.
- **Details:** grouped under Details (Name to Notes), Customers and commitments (Customers, Projects, Proposals), Planning (Priority to Staffed), then Columns, the added ones.
  - The table starts its columns in the details' order, so the two read alike.
  - Customers are the feature's own; its projects' and proposals' customers are reached through their links, not repeated.

## Columns

- **Order:** Name, Status, Description, Notes, Customers, Projects, Proposals, Priority, Needed by, Effort, Size, Risk, Release, Target cycle, Feature team, Staffed, then added columns.
- **Release:** read only, following from the target cycle; Later is its empty value. In the details, it links to the release's schedule on [Releases](releases.md).
- **Feature team:** a Planned or In progress feature with none shows No team, as a [warning on a value](../../standards/ui-conventions.md#values).
- **Staffed:** read only; for Planned or In progress features, Yes when any allocation gives them a month, a planned hire's included. It is empty for other statuses, so Not staffed is a plain filter.
- **Projects and Proposals:** changed only by those who change the plan; New feature doesn't offer them.
  - A change drafts the project or proposal, so the feature's row isn't marked.
- **Added columns:** General lists only, with no planned hires or visibility; a drafted one can't be filled until approved.
  - Remove column shows only to those who may also change features.

## Grouping

- **Default:** one list, with no grouping.
- **Group by:** None, Cycle, Release, Needed by and every column holding choices, Customers, Projects and Proposals included, with Then by as [Tables](../../standards/ui-conventions.md#tables) sets out.
- **By Cycle:** every schedule together, in their order, each cycle headed with its schedule and name, then Later for features with no cycle.
- **By Release:** each schedule's releases by date, headed with the schedule, release and Ships on, then its cycles in no release, such as Platform: Not released yet, then Later.
  - A heading counts its features, not their effort. A release no feature targets has no heading.
  - A feature whose draft moves its target cycle is grouped by the draft.
- **By Needed by:** earliest first, then No date.

## Features Board

- **What it is:** the [Roadmap](../../product/domain.md#planning-terms), drawn as [Boards](../../standards/ui-conventions.md#boards) sets out.
- **Read only:** nothing on the board can be changed.
- **One view:** table and board share the page's controls and view. A saved view keeps the Board's schedule and card choices, but not which shows or the cycle the Board starts from.
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
- **Months as columns:** the Board's default, so it is useful before any cycles are planned: the months features are needed by, from the current month, then No date.
  - A Columns menu chooses one schedule's cycles instead.
  - Moving a card to another month changes its Needed by.
- **On track or Late:** on staffed cards, with forecasting.
