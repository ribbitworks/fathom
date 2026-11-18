# Fathom: Capacity Page

**Last updated:** 2026-11-17

Capacity shows who is allocated to what, month by month, and holds the planning settings, as the [Capacity page](../../product/decisions.md#planning) decision sets out. It sits in the sidebar's People section, after Feature assignments.

[Capacity help](../../help/capacity.md) describes it for the people who use it. [Visual Design](../visual-design.md) covers what every page shares.

## Modes and Access

- **Switch:** People and Settings, kept in the address; a role that sees one mode gets no switch.
- **People:** needs View Allocations, plus View Feature teams, View People and Personal details.
- **Settings:** needs View Configuration.

## People

- **Read only:** the allocations grid, on the shared table, with the months and strip of [Feature assignments](feature-assignments.md#layout).
- **Rows:** each person and planned hire; planned hires sit under No feature team.
  - Rows under several groups are blank in months they don't hold, as [Capacity views](../../product/decisions.md#planning) sets out.
- **A month's cell:** each feature with its percentage, then a Total line.
  - From the current month on, it reads Over or Under instead, so an empty month reads Under.
  - These are a status, not a [warning](../../standards/ui-conventions.md#values).
- **Grouping:** one list at first; Group by offers None, Manager and Feature team, as on [Feature assignments](feature-assignments.md#layout).
- **Drafts:** as on [Feature assignments](feature-assignments.md#drafts).
- **Totals:** a Total, PM row per group and an Organization, PM row fixed at the foot, such as 7.5 of 9.

## Settings

- **Sections:** Working time, Forecasts and Ramp-up for new starters, laid out as a details panel.
- **Ramp-up:** a row per month, up to 12, then a fixed From month N row at 100%.
- **Drafts:** the settings are one draft, approved whole, so each changed row's menu lists every change.

## Planned

- **More modes:** Work and Demand, between People and Settings.
- **Work:** the [Plan](../../product/decisions.md#planning) on the [shared timeline](../../standards/ui-conventions.md#timelines): when each piece of work happens, whether it is staffed, and whether it makes its date.
  - The organization's capacity row, on all staffed work, comes first, then the groups.
  - Group by offers Feature team, the first, Project, Priority, Status, Risk and Release.
  - By feature team, each team ends with its capacity row, and each project's activities and general work sit under a Project work heading.
  - Filters: Committed only, Staffed only, and Late or not staffed.
  - Features in Later are listed under the timeline.
- **Work and People together:** they share the search, filters, Group by, Views and capacity total rows.
  - A bar in Work opens its feature's people in People, and an allocation in People links to its feature in Work.
- **Demand:** the demand forecast.
- **People's grid:** gains the planned picker, lines and allocating that [Feature assignments](feature-assignments.md#planned) sets out.
- **Over and Under in words alone** ([issue #256](https://github.com/jlarue26/fathom/issues/256)).
