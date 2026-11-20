---
title: "Feature Assignments Page"
category: "Design"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/design/visual-design.md", "docs/standards/ui-conventions.md", "docs/help/feature-assignments.md"]
last_updated: "2026-11-19"
---

# Fathom: Feature Assignments Page

Feature assignments shows each person's feature teams, month by month. It sits in the sidebar's People section, after Org chart, only for roles that see Personal details.

[Feature assignments help](../../help/feature-assignments.md) describes it for the people who use it. [Visual Design](../visual-design.md) covers what every page shares.

## Layout

- **Shared table:** with its own saved views, grouped one level deep, since each row is made for its group.
- **Rows:** one per person, frozen on the left, in one list at first; Group by offers None, Manager and Feature team.
- **Months:** whole quarters, from the quarter holding the month a year back to the quarter holding the month eleven months ahead, opening with the current month just after the frozen column; months outside employment are shaded.
  - A thin line between columns, and the current month's heading underlined in today's red, as [Month grids](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines) sets out.
- **Strip:** the [strip](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines) of the grid's quarters, under the bar, following the grid as it scrolls.
- **A month's cell:** that month's feature teams as labels in their colours. A month reads as of its first day, and the current month as of today.

## Access

- **Grouping by manager:** needs Confidential data too, since later months' managers are future reorganizations.
  - Without it, Group by offers only Feature team and None.
- **No allocations:** they are [Capacity](capacity.md)'s People mode; an old Allocations address opens it.

## Drafts

- **Marks:** as [Month grids](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines) sets out, carried by the labels.

## Editing

- **Who:** those who edit feature teams, from the current month on; those who change Personal details, earlier months too.
- **A change:** drafts the teams from that month's first day, or today in the current month.
  - A change the team's draft can't hold, such as a second dated change to the same person, is refused.
- **No row menu:** drafts are decided on the team.

## Planned

These apply to the monthly resource grid, which [Capacity](capacity.md)'s People mode shares.

- **Schedule picker:** after the search, kept in the address and saved views; the first schedule by default, with no lines while there are none.
  - Each cycle's end is a thin upright line labelled with its name.
  - Each release is a line on its Ships on day.
- **Allocating:** from a cell or a row's menu, by picking a feature, a percentage, a from month and an optional to month.
- **Allocation warnings:** an allocation left outside someone's employment by a date change shows its warning.
  - A Warnings filter shows only the rows that have any.
