---
title: "Capacity Page"
category: "Design"
audience: "Contributors"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/design/visual-design.md", "docs/standards/ui-conventions.md", "docs/help/capacity.md"]
last_updated: "2026-11-27"
---

# Fathom: Capacity Page

Capacity shows who is on which feature team and who is allocated to what, month by month. It sits in the sidebar's People section, after Org chart.

[Capacity help](../../help/capacity.md) describes it for the people who use it. [Visual Design](../visual-design.md) covers what every page shares.

## Tabs and Access

- **Tabs:** Feature teams and Allocations, kept in the address, in the page's heading. A role sees the tabs it may; a role that sees one sees it alone, with no tabs, and a role that sees none has no page.
- **Feature teams:** needs View Feature teams and Personal details, since it shows the months people join and leave teams.
- **Allocations:** needs View Allocations, plus View Feature teams, View People and Personal details.
- **Planning settings:** a plain link at the right of the heading opens [Planning settings](administration.md#planning-settings), for a role that opens it. A tab shows something in place, so the link isn't among the tabs.
- **The last view:** the page opens on the tab and view it last showed, as [The last view](../../standards/ui-conventions/tables.md#tables) sets out. Each tab has its own saved views.
- **Old addresses:** the Feature assignments page's old address opens the Feature teams tab, with the same view, and its old Allocations mode opens Allocations, as does Capacity's old People mode. The old Settings tab's address, `/capacity?mode=settings`, redirects to Planning settings.

## The Grid Tabs

Feature teams and Allocations are one month grid, on the shared table, with the same rows, months, strip and Group by; only what a cell says differs, but for Allocations' Allocated to, which also changes the total rows and leaves out the load marks.

- **Shared table:** grouped one level deep, since each row is made for its group.
- **Rows:** one per person and planned hire, frozen on the left, in one list at first; Group by offers None, Manager and Feature team, and Allocated to on Allocations.
  - Planned hires are named by their position and ID in grey when they have no name, and their months before the one they're expected in are shaded. Allocations is read only for everyone.
  - Planned hires sit under their manager by Manager. By Feature team, a hire sits under each team it is on in the months shown, as a person does, and its cells on Feature teams name its teams from the month it joins. Allocations also puts it under No feature team for the months it's on none, as it does a person.
  - A group's heading counts each kind it holds, as People's count does, such as 2 people, 1 planned hire.
  - A role that doesn't see People has no planned hires' rows.
- **Months:** whole quarters, from the quarter holding the month a year back to the quarter holding the month eleven months ahead; months outside employment are shaded.
  - A thin line between columns, and the current month's heading underlined in today's red, as [Month grids](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines) sets out.
- **Strip:** the [strip](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines) of the grid's quarters, under the bar, following the grid as it scrolls.
- **Where the grid lands:** opening a tab, Today, a quarter chosen in the strip and **‹** and **›** put the month gone to second, with the month before it wholly in view after the frozen column; the grid's first month has none before it. The current quarter is filled from the first drawing, as after choosing it.
- **The count:** one count on both tabs, after the bar's buttons, month first, such as "Apr 2027: 137 people, 10 planned hires", for one month: the month gone to, the second wholly in view, or the first when it is the grid's first month.
  - It counts the people employed that month and the planned hires expected by then, so it changes as the grid scrolls.
  - **While the rows are narrowed:** a filter, a search or a month's own filter makes it how many of the month's people and planned hires are shown, such as "Apr 2027: 6 of 137 people", and "Apr 2027: 4 of 137 people, 1 of 10 planned hires" only when both kinds are shown. The rows stay put as the month changes, since the filter reads every month, so someone who has left by the month counted stays in the rows but not in the count.
  - **Grouped:** someone under two groups is counted once.
  - That month's heading is filled in the accent colour, as the strip's chosen quarter is.
  - **‹** and **›** step a quarter from that month.
- **Drafts:** marks as [Month grids](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines) sets out, carried by each team's or feature's line.
- **Filter across the grid:** a button after the search box, Feature teams on Feature teams and Allocations on Allocations, opens a filter of the choices its months' filters offer: every feature team, or everything someone is allocated to, as [Filtering across a table](../../standards/ui-conventions/tables.md#tables) sets out.
  - It keeps the rows with a chosen one in any month of the grid, or, with No feature team or Not allocated, those with none in any month. On Allocations, a row under a group counts only that group's months, as its cells do.
  - It reads every month of the grid, not only those in view, so scrolling never changes the rows.
  - The cells still show every team, feature or activity of their month, since a filter chooses rows, not what a cell holds.
  - The view and the address keep it as the filter `any-month`, with a pill such as Feature team: Payments core, or Allocated to: Offline Sync. Allocations offers an activity by its name and its project or release, such as General (Crane Control).

## Feature Teams

- **A month's cell:** that month's feature teams, one to a line, each after its colour's square. A month reads as of its first day, and the current month as of today.
- **Grouping by manager:** needs Confidential data too, since later months' managers are future reorganizations. Without it, Group by offers only Feature team and None.
- **Editing:** those who edit feature teams, from the current month on; those who change Personal details, earlier months too.
  - A change drafts the teams from that month's first day, or today in the current month.
  - A planned hire's cells change as a person's do, from the month it's expected.
  - Shaded months are read only, a person's outside their employment and a planned hire's before the month it's expected, since the server refuses a team change there. In light mode they are hatched, since Mantine's grey can't be told from white. Pointed at or given focus, such a month says why in its tip: Not employed this month, or Can't join before May 2027.
  - A change the team's draft can't hold, such as a second dated change to the same person, is refused.
- **No row menu:** drafts are decided on the team.

## Allocations

- **Read only:** allocating from the grid is planned, below.
- **Rows:** someone under several managers or feature teams in the months shown has a row under each, holding only that group's months and blank in the rest. Under No feature team, a row holds the months they were employed on none.
- **Allocated to:** Group by offers it on Allocations alone, beside Manager and Feature team, to roles with Configuration View: a heading per feature or activity, by name, an activity's naming its project or release, then Not allocated.
  - Someone has a row under each feature or activity they're allocated to, in any month, holding every month but showing its line alone. Features, or activities, the reader can't read are one heading of their kind, with no Effort, Allocated or Remaining.
  - **Effort:** the work's estimate, as the Draft menu shows it. Work with no estimate shows Allocated alone.
  - **Allocated:** the hours its allocations give it, after the settings' focus, the same in every month, each from its first month to the earlier of its own end and the work's last month, so it doesn't change with the grid's reach. The last month is a feature's target cycle's last month, else its Needed by; an activity's Needed by, else its project's last milestone, for a role that reads projects, or its release's last cycle; through the current month for work with none. Each is read as the Draft menu shows the work, and the drafts of what it's read from. Its tip says so.
  - **Remaining:** the estimate with the settings' buffer, less Allocated; below zero in red with a minus sign, such as −6 h. It reads None for done or cancelled work. While the Default buffer is above 0%, its tip names it as approved, such as Includes a 10% buffer.
  - **Only with Configuration View:** the server sends each allocation the hours a whole month of its person's time gives, each feature and activity its estimate and the hours it needs, and the Default buffer, only to roles with Configuration View, since the focus and buffer can be worked out from them.
  - **Load:** a row for one feature or activity holds part of someone's month, so its cells mark no Over, Under or Not allocated; the Over and Under choices keep someone's rows by their whole row's marks.
  - **Totals:** an Allocated row per feature or activity, its hours each month, and an Allocated, all work row at the foot, in place of the person-month rows.
- **A month's cell:** each feature or activity, after its feature team's colour square, with its percentage at the right. An activity's tooltip names its project or release, such as General (Crane Control), since activities of different projects and releases can share a name.
  - **A renamed feature or activity:** named as the Draft view shows its rename, and marked as a table marks a changed name: beside live, the rename's dot, a red ring once rejected; with drafts applied, a rejected rename taken back; live only, the live name, with Live's dot while the rename waits. Semibold beside live, as a changed cell is. A Live row names it as it is live. A rename alone gives a person's row no tint or Live row, since a row's draft is the person's allocations. The filter's choices follow the same names.
  - From the current month on, a month off a whole month has a last line, in red and bold, over a faint rule: Over or Under, with how far off at the right, such as +25% or −90%, and the month's total in its tooltip, such as Total 125%. A month with nothing allocated shows Not allocated alone instead.
  - A whole month, and every past month, has no last line. The totals still count each row that could be allocated in a past month, a planned hire from the month it was expected included, since the plan allowed allocating it then, so a past cell with nothing allocated is blank and counts as 0 of 1, as a person's does.
  - These are a status, not a [warning](../../standards/ui-conventions/drafts-and-values.md#values).
- **Over:** more than 100%, counting every feature and activity but Possible ones. Done and Cancelled ones count, since allocations are time spent, so future allocations to a cancelled feature or activity show Over until cleared.
- **Under:** less than 100% in a month the person or planned hire can be allocated in.
- **Over and Under choices:** Over and Under at the top of the Views menu keep only the rows Over, or Under or Not allocated, in the current month or any later month in the grid, and either while both are on.
  - Each shows how many rows it keeps, and is offered while a row matches it or while it is on.
  - They don't depend on the months in view, so scrolling never changes the rows.
  - The view and the address keep them, as `over` and `under`.
- **Capacity:** as the [Domain Model](../domain-model.md#allocation) sets out.
- **Totals:** a Total, person-months row per group and an Organization, person-months row fixed at the foot, such as 7.5 of 9.
  - They count the rows shown, so a filter changes them.
  - The Organization row counts each person once; a person on two feature teams counts in both.
  - Drafts count only under Drafts applied.

## Planned

- **Choosing a month by its heading:** clicking a month's heading moves the grid to it.
- **More tabs:** Work and Demand, after Allocations.
- **Work:** the [Plan](../../product/domain.md#planning-terms) on the [shared timeline](../../standards/ui-conventions/dates-timelines-and-boards.md#timelines): when each piece of work happens, whether it is staffed, and whether it makes its date.
  - The organization's capacity row, on all staffed work, comes first, then the groups.
  - Group by offers Feature team, the first, Project, Priority, Status, Risk and Release.
  - By feature team, each team ends with its capacity row, and each project's activities and general work sit under a Project work heading.
  - Filters: Committed only, Staffed only, and Late or not staffed.
  - Features in Later are listed under the timeline.
- **Work and Allocations together:** they share the search, filters, Group by, Views and capacity total rows.
  - A bar in Work opens its feature's people in Allocations, and an allocation in Allocations links to its feature in Work.
- **Demand:** the demand forecast ([issue #209](https://github.com/ribbitworks/fathom/issues/209)).
- **Schedule picker on the grid tabs:** after the search, kept in the address and saved views; the first schedule by default, with no lines while there are none.
  - Each cycle's end is a thin upright line labelled with its name.
  - Each release is a line on its Ships on day.
- **Allocating:** from a cell or a row's menu, by picking a feature or an activity, a percentage, a from month and an optional to month ([issue #206](https://github.com/ribbitworks/fathom/issues/206)).
- **Allocation warnings:** an allocation left outside someone's employment by a date change shows its warning.
  - A Warnings filter shows only the rows that have any.
