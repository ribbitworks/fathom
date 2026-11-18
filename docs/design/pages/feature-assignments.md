# Fathom: Feature Assignments Page

**Last updated:** 2026-11-17

Feature assignments shows each person's feature teams, month by month. It sits in the sidebar's People section, after Org chart, only for roles that see Personal details.

[Feature assignments help](../../help/feature-assignments.md) describes it for the people who use it. [Visual Design](../visual-design.md) covers what every page shares.

## Layout

- **Shared table:** with its own saved views, grouped one level deep, since each row is made for its group.
- **Rows:** one per person, frozen on the left, grouped by manager at first.
- **Months:** 24 columns from 12 months back, opening at the current month; months outside employment are shaded.
- **A month's cell:** that month's feature teams as labels in their colours.

## Access

- **Grouping by manager:** needs Confidential data too, since later months' managers are future reorganizations.
  - Without it, Group by offers only Feature team and None.
- **No allocations:** they are [Capacity](capacity.md)'s People mode; an old Allocations address opens it.

## Drafts

- **Marks:** as [Month grids](../../standards/ui-conventions.md#timelines) sets out, carried by the labels.

## Editing

- **Who:** those who edit feature teams, from the current month on; those who change Personal details, earlier months too.
- **A change:** drafts the teams from that month's first day, or today in the current month.
- **No row menu:** drafts are decided on the team.

## Planned

These apply to the monthly resource grid, which [Capacity](capacity.md)'s People mode shares.

- **Schedule picker:** after the search, kept in the address and saved views.
  - Each cycle's end is a thin upright line labelled with its name.
  - Each release is a line on its Ships on day.
- **Allocating:** from a cell or a row's menu, by picking a feature, a percentage, a from month and an optional to month.
- **Allocation warnings:** an allocation left outside someone's employment by a date change shows its warning.
  - A Warnings filter shows only the rows that have any.
