# Fathom: Capacity Page

**Last updated:** 2026-11-18

Capacity shows who is allocated to what, month by month, and holds the planning settings, which don't justify a page of their own. It sits in the sidebar's People section, after Feature assignments.

[Capacity help](../../help/capacity.md) describes it for the people who use it. [Visual Design](../visual-design.md) covers what every page shares.

## Modes and Access

- **Switch:** People and Settings, kept in the address; a role that sees one mode gets no switch, and a role that sees neither has no page.
- **People:** needs View Allocations, plus View Feature teams, View People and Personal details.
- **Settings:** needs View Configuration.

## People

- **Read only:** the allocations grid, on the shared table, with the months and strip of [Feature assignments](feature-assignments.md#layout).
- **Rows:** each person and planned hire.
  - Someone under several managers or feature teams in the months shown has a row under each, holding only that group's months and blank in the rest. Under No feature team, a row holds the months they were employed on none.
  - Planned hires sit under their manager by Manager, and under No feature team by Feature team.
- **A month's cell:** each feature with its percentage, then a Total line.
  - From the current month on, it reads Over or Under instead, so an empty month reads Under 0%. Past months show their figures unmarked.
  - These are a status, not a [warning](../../standards/ui-conventions.md#values).
- **Over:** more than 100%, counting every feature but Possible ones. Done and Cancelled features count, since allocations are time spent, so future allocations to a cancelled feature show Over until cleared.
- **Under:** less than 100% in a month the person or planned hire can be allocated in.
- **Capacity:** as the [Domain Model](../domain-model.md#allocation) sets out.
- **Grouping:** one list at first; Group by offers None, Manager and Feature team, as on [Feature assignments](feature-assignments.md#layout).
- **Drafts:** as on [Feature assignments](feature-assignments.md#drafts).
- **Totals:** a Total, PM row per group and an Organization, PM row fixed at the foot, such as 7.5 of 9.
  - They count the rows shown, so a filter changes them.
  - The Organization row counts each person once; a person on two feature teams counts in both.
  - Drafts count only under Drafts applied.

## Settings

- **Sections:** Working time, Forecasts and Ramp-up for new starters, laid out as a details panel.
- **Ramp-up:** a row per month, up to 12, then a fixed From month N row at 100%.
- **Drafts:** the settings are one draft, approved whole with Approve Configuration, so each changed row's menu lists every change.
  - Approval is needed since a change alters every estimate's units. Effort uses the settings as approved, so a draft changes no estimate until then.
- **Forecasts and Ramp-up:** kept for demand forecasting; nothing uses them yet.

## Planned

- **More modes:** Work and Demand, between People and Settings.
- **Work:** the [Plan](../../product/domain.md#planning-terms) on the [shared timeline](../../standards/ui-conventions.md#timelines): when each piece of work happens, whether it is staffed, and whether it makes its date.
  - The organization's capacity row, on all staffed work, comes first, then the groups.
  - Group by offers Feature team, the first, Project, Priority, Status, Risk and Release.
  - By feature team, each team ends with its capacity row, and each project's activities and general work sit under a Project work heading.
  - Filters: Committed only, Staffed only, and Late or not staffed.
  - Features in Later are listed under the timeline.
- **Work and People together:** they share the search, filters, Group by, Views and capacity total rows.
  - A bar in Work opens its feature's people in People, and an allocation in People links to its feature in Work.
- **Demand:** the demand forecast ([issue #209](https://github.com/ribbitworks/fathom/issues/209)).
- **People's grid:** gains the planned picker, lines and allocating that [Feature assignments](feature-assignments.md#planned) sets out.
- **Over and Under in words alone** ([issue #27](https://github.com/ribbitworks/fathom/issues/27)).
