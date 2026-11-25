---
title: "Capacity Page"
category: "Design"
audience: "Contributors"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/design/visual-design.md", "docs/standards/ui-conventions.md", "docs/help/capacity.md"]
last_updated: "2026-11-25"
---

# Fathom: Capacity Page

Capacity shows who is on which feature team and who is allocated to what, month by month, and holds the planning settings, which don't justify a page of their own. It sits in the sidebar's People section, after Org chart.

[Capacity help](../../help/capacity.md) describes it for the people who use it. [Visual Design](../visual-design.md) covers what every page shares.

## Tabs and Access

- **Tabs:** Feature teams, Allocations, Coverage and Settings, kept in the address, in the page's heading. A role sees the tabs it may; a role that sees one sees it alone, with no tabs, and a role that sees none has no page.
- **Feature teams:** needs View Feature teams and Personal details, since it shows the months people join and leave teams.
- **Allocations:** needs View Allocations, plus View Feature teams, View People and Personal details.
- **Coverage:** needs what Allocations needs, plus View Features and View Configuration, since it reads the features and the planning settings.
- **Settings:** needs View Configuration.
- **The last view:** the page opens on the tab and view it last showed, as [The last view](../../standards/ui-conventions/tables.md#tables) sets out. Each grid tab has its own saved views; Settings keeps none, so the page opens on the last grid tab.
- **Old addresses:** the Feature assignments page's old address opens the Feature teams tab, with the same view, and its old Allocations mode opens Allocations, as does Capacity's old People mode.

## The Grid Tabs

Feature teams and Allocations are one month grid, on the shared table, with the same rows, months, strip and Group by; only what a cell says differs.

- **Shared table:** grouped one level deep, since each row is made for its group.
- **Rows:** one per person and planned hire, frozen on the left, in one list at first; Group by offers None, Manager and Feature team.
  - Planned hires are read only, named by their position and ID in grey when they have no name, and their months before the one they're expected in are shaded.
  - Planned hires sit under their manager by Manager, and under No feature team by Feature team. They have no feature teams yet ([issue #395](https://github.com/ribbitworks/fathom/issues/395)), so their cells on Feature teams are blank.
  - A role that doesn't see People has no planned hires' rows.
- **Months:** whole quarters, from the quarter holding the month a year back to the quarter holding the month eleven months ahead; months outside employment are shaded.
  - A thin line between columns, and the current month's heading underlined in today's red, as [Month grids](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines) sets out.
- **Strip:** the [strip](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines) of the grid's quarters, under the bar, following the grid as it scrolls.
- **Where the grid lands:** opening a tab, Today, a quarter chosen in the strip and **‹** and **›** put the month gone to second, with the month before it wholly in view after the frozen column; the grid's first month has none before it. The current quarter is filled from the first drawing, as after choosing it.
- **The count:** one count on both tabs, after the bar's buttons, such as 137 people and 10 planned hires in Apr 2027, for one month: the month gone to, the second wholly in view, or the first when it is the grid's first month.
  - It counts the people employed that month and the planned hires expected by then, so it changes as the grid scrolls.
  - That month's heading is filled in the accent colour, as the strip's chosen quarter is.
  - **‹** and **›** step a quarter from that month.
- **Drafts:** marks as [Month grids](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines) sets out, carried by each team's or feature's line.
- **Filter across the grid:** a button after the search box, Feature teams on Feature teams and Allocations on Allocations, opens a filter of the choices its months' filters offer: every feature team, or everything someone is allocated to, as [Filtering across a table](../../standards/ui-conventions/tables.md#tables) sets out.
  - It keeps the rows with a chosen one in any month of the grid, or, with No feature team or Not allocated, those with none in any month. On Allocations, a row under a group counts only that group's months, as its cells do.
  - It reads every month of the grid, not only those in view, so scrolling never changes the rows.
  - The cells still show every team or feature of their month, since a filter chooses rows, not what a cell holds.
  - The view and the address keep it as the filter `any-month`, with a pill such as Feature team: Payments core, or Allocated to: Offline Sync.

## Feature Teams

- **A month's cell:** that month's feature teams, one to a line, each after its colour's square. A month reads as of its first day, and the current month as of today.
- **Grouping by manager:** needs Confidential data too, since later months' managers are future reorganizations. Without it, Group by offers only Feature team and None.
- **Editing:** those who edit feature teams, from the current month on; those who change Personal details, earlier months too.
  - A change drafts the teams from that month's first day, or today in the current month.
  - A change the team's draft can't hold, such as a second dated change to the same person, is refused.
- **No row menu:** drafts are decided on the team.

## Allocations

- **Read only:** allocating from the grid is planned, below.
- **Rows:** someone under several managers or feature teams in the months shown has a row under each, holding only that group's months and blank in the rest. Under No feature team, a row holds the months they were employed on none.
- **A month's cell:** each feature, after its feature team's colour square, with its percentage at the right.
  - From the current month on, a month off a whole month has a last line, in red and bold, over a faint rule: Over or Under, with how far off at the right, such as +25% or −90%, and the month's total in its tooltip, such as Total 125%. A month with nothing allocated shows Not allocated alone instead.
  - A whole month, and every past month, has no last line.
  - These are a status, not a [warning](../../standards/ui-conventions/drafts-and-values.md#values).
- **Over:** more than 100%, counting every feature but Possible ones. Done and Cancelled features count, since allocations are time spent, so future allocations to a cancelled feature show Over until cleared.
- **Under:** less than 100% in a month the person or planned hire can be allocated in.
- **Over and Under choices:** Over and Under at the top of the Views menu keep only the rows Over, or Under or Not allocated, in the current month or any later month in the grid, and either while both are on.
  - Each shows how many rows it keeps, and is offered while a row matches it or while it is on.
  - They don't depend on the months in view, so scrolling never changes the rows.
  - The view and the address keep them, as `over` and `under`.
- **Capacity:** as the [Domain Model](../domain-model.md#allocation) sets out.
- **Totals:** a Total, PM row per group and an Organization, PM row fixed at the foot, such as 7.5 of 9.
  - They count the rows shown, so a filter changes them.
  - The Organization row counts each person once; a person on two feature teams counts in both.
  - Drafts count only under Drafts applied.

## Coverage

A month grid, as the grid tabs are: the same months, strip, current month and where the grid lands. Its rows are work, not people.

- **Read only.**
- **Rows:** one per feature still to be done, and one per project's general work that someone is allocated to, a project's named with its Project ID first, such as P-2001 Crane Control, as links to records are, for roles that see Projects; for others, by the project's name alone, as Allocations names it. Done and Cancelled features are left out, as `isForecast` in `packages/shared/src/forecast.ts` sets out.
- **Columns:** Work, Effort and Remaining, frozen on the left until the view says otherwise, as far as the frozen columns' share of the table allows, then Allocated, then the months.
  - **Widths:** Work starts wide enough for most names in full, and each figure column fits its heading and figures up to 99,999 h, so the three frozen columns fit at 1440 pixels with the navigation open. Allocated, which Effort and Remaining imply, has no room among them. On a narrow screen Work keeps its width, and Effort and Remaining give way first.
  - **Months:** each month's figures are centred under its centred heading.
- **Effort:** the estimate with the default buffer, as `effortNeeded` sets out; None without an estimate, as empty values read.
- **Allocated:** the hours the allocations deliver over the grid's months, as `deliveredHours` sets out: the share of the month's working hours, at the default focus, and at the ramp-up from the first month someone is employed in, when that falls in the grid after its first month; someone employed from the grid's first month is taken as past their ramp-up. Allocations outside employment count for nothing.
- **Remaining:** the effort less the hours allocated; past the effort, a minus figure in red, such as −6 h, in Allocations' Over red; None without an effort.
- **A month's cell:** one form for a row from the current month on: for work with an effort, the hours allocated of the hours needed, such as 64 of 24 h, or 64 of 0 h once the effort is covered; for work with none, the hours allocated alone, and blank where none are. A past month, which needs nothing more, shows the hours allocated alone, in grey.
- **Colours:** a feature's name follows its feature team's colour square, as on Allocations.
- **Hours needed:** `neededByMonth` spreads the effort left after past months' hours evenly over the work's window from the current month on: its target cycle's months, or from the current month to Needed by, widened to every month an allocation reaches. Work with none of these shows no months.
- **Drafts:** as Allocations' totals: the allocations, the features and the planning settings as drafted with Drafts applied, and as live otherwise.
- **The count:** the features and projects shown, such as 22 features and 5 projects.
- **Group by:** None and Feature team.
- **Details:** a feature's details button, and Show details in its menu, open it on Features, and a project's work opens its project on Projects, for roles that see Projects, since Coverage has no details panel of its own.

## Settings

- **Sections:** Working time, Forecasts and Ramp-up for new starters, laid out as a details panel.
- **Ramp-up:** a row per month, up to 12, then a fixed From month N row at 100%.
- **Drafts:** the settings are one draft, approved whole with Approve Configuration, so each changed row's menu lists every change.
  - Approval is needed since a change alters every estimate's units. Effort uses the settings as approved, so a draft changes no estimate until then.
- **Forecasts and Ramp-up:** Coverage's hours use them, and so will the demand forecast.

## Planned

- **Choosing a month by its heading:** clicking a month's heading moves the grid to it.
- **More tabs:** Work and Demand, between Coverage and Settings.
- **Work:** the [Plan](../../product/domain.md#planning-terms) on the [shared timeline](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines): when each piece of work happens, whether it is staffed, and whether it makes its date.
  - The organization's capacity row, on all staffed work, comes first, then the groups.
  - Group by offers Feature team, the first, Project, Priority, Status, Risk and Release.
  - By feature team, each team ends with its capacity row, and each project's activities and general work sit under a Project work heading.
  - Filters: Committed only, Staffed only, and Late or not staffed.
  - Features in Later are listed under the timeline.
- **Work and Allocations together:** they share the search, filters, Group by, Views and capacity total rows.
  - A bar in Work opens its feature's people in Allocations, and an allocation in Allocations links to its feature in Work.
- **Coverage's Later column:** for work with no window, all of its effort needed there, as Demand's Later.
- **Coverage's other groupings and activities:** Group by Release, and project activities' rows, once activities are built.
- **Demand:** the demand forecast ([issue #209](https://github.com/ribbitworks/fathom/issues/209)).
- **Schedule picker on the grid tabs:** after the search, kept in the address and saved views; the first schedule by default, with no lines while there are none.
  - Each cycle's end is a thin upright line labelled with its name.
  - Each release is a line on its Ships on day.
- **Allocating:** from a cell or a row's menu, by picking a feature, a percentage, a from month and an optional to month ([issue #206](https://github.com/ribbitworks/fathom/issues/206)).
- **Allocation warnings:** an allocation left outside someone's employment by a date change shows its warning.
  - A Warnings filter shows only the rows that have any.
