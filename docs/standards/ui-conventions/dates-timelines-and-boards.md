---
title: "UI Conventions: Dates, Timelines and Boards"
category: "Standards"
audience: "Contributors"
applies_to: ["apps/web/**", "docs/testing/**"]
dependencies: ["docs/standards/ui-conventions.md", "docs/design/visual-design.md"]
last_updated: "2026-11-24"
---

# Dates, Timelines and Boards

Part of [UI Conventions](../ui-conventions.md): how days and months are shown and typed, the shared timeline, and boards of cards. Examples come from the [fictional data](../../design/development-setup.md#fictional-data).

## Dates

- **Days:** A day shows a short month and its year in the reader's language, such as 31 Dec 2026 or Dec 31, 2026. Every date shown includes its year. The two exceptions are the About box's full date and Settings' day and time in a time zone ([Visual Design](../../design/visual-design.md#layout)).
  - **Drawn by:** `formatDay` in `apps/web/src/day-formats.ts`, which date cells use through `cellKinds` in `apps/web/src/cell-kinds.tsx`. `dayOf` in `apps/web/src/today.ts` first turns a moment into its day in Fathom's time zone, such as when an account was made in Accounts' Created column. `formatMomentDay` in `apps/web/src/day-formats.ts` shows a moment outside a date cell, such as a scope history's.
  - **Example:** Each release's heading on Features grouped by Release, such as Platform: Harbor 2 and the day it ships.
- **Ranges of days:** Two days show as one range, such as Jan 1 to Mar 31, 2027, naming the year once when both days share it, the one exception to every date showing its year. "to" joins them, never a dash.
  - **Drawn by:** `formatDayRange` in `apps/web/src/day-formats.ts`.
  - **Example:** A cycle's choice in New release on Releases, such as 27.1 (Jan 1 to Mar 31, 2027).
- **Months:** A month shows as a short month and its year, such as Mar 2027.
  - **Drawn by:** `formatMonth` in `apps/web/src/day-formats.ts`.
  - **Example:** Offline Sync's Needed by.
- **Typing a day or month:** Days and months are typed as digits, laid out as typed, such as 2026-10-31 and 2027-03, whatever the reader's language.
  - **Correcting a digit:** A key in the middle, such as deleting a digit, leaves the other digits and dashes where they were, with the cursor in the gap, so another digit can be typed there: deleting the 6 of 2026-11-08 leaves 202-11-08. Typing or pasting at the end lays the digits out again.
  - **In the middle:** A paste in the middle stays where it goes, as pasted, as a key there does. A digit typed or pasted in the middle of a day or month that already holds all its digits is ignored, and the cursor stays where it was.
  - **Saving:** A cell or a details panel's field lays out on saving text left as typed, such as 202611-08, saved as 2026-11-08. A day's box takes only a whole day, such as 2026-11-08, as it is typed.
  - **Drawn by:** `typedInPlace` in `packages/shared/src/days.ts`, used by `DayInput` in `apps/web/src/day-input.tsx` for a day's box, and by `cellKinds` in `apps/web/src/cell-kinds.tsx` for a table's day and month cells, each put in its box by `typeIn` in `apps/web/src/type-in.ts`.
  - **Example:** A milestone's Date.
- **A time:** History entries show the day, its year and the time in the reader's language.
  - **Drawn by:** `EntryRow` in `apps/web/src/history-entries.tsx`.
  - **Example:** Any entry on the Change history page.

## Timelines

Every view with time across it (the Releases timeline, the Plan and the project timeline) draws time in one design language.

| Mark | Means |
| --- | --- |
| Solid bar | Staffed months |
| Dashed outline | A target cycle only, not staffed |
| Diamond | A day: a milestone, or a release's Ships on day |
| Triangle under the bar, the size of a diamond, named such as Needed by May | Needed by, at the end of its month |
| Red Late or Not staffed pill at the end of a bar | [Late](../../product/domain.md#planning-terms), or [Not staffed](../../design/pages/features.md#columns). Never a faint red outline. |
| Short upright grey line at a cycle lane's end | A schedule's last day, where it ends |
| Red line | Today, only ever as a thin line, such as a timeline's line, the strip's underline, the underline of a month grid's current month and the underline of the Features Board's current heading. Never red words, a red fill or a red box, which mean a problem, such as Late. |

- **The language:** Each mark in the table means one thing on every timeline. Drafts use the [draft marks](drafts-and-values.md#drafts), and a dashed edge never means a draft.
  - **Drawn by:** `Tracks` in `apps/web/src/timeline-view.tsx` draws today's line in the theme's `--fathom-today`. `ReleaseBar` and `useReleaseLayer` in `apps/web/src/release-layer.tsx` draw the release diamonds, a schedule's end, and the drafts of schedules and releases.
  - **Example:** Today's red line on the Releases timeline.
- **The shared timeline:** One component draws every view with time across it. Zoom, axis and scrolling work the same on every timeline.
  - **What it draws:** The axis, which stays in view while the rows scroll; the zoom, kept in the browser for each view; today's line; the scrolling; the strip; and schedules' cycles and releases, as a layer a view may show, first.
  - **What each view gives it:** Each view gives it its rows and their days, and the timeline covers the whole months holding them and the layer's cycles.
  - **Row labels:** Each row's label, including a name that opens its record, is drawn at the size of the table's text, set once in the shared timeline's styles.
  - **Zoom:** All, Year, 6 months, Quarter, Month, Week and Days show the whole timeline, three years, two years, a year, six months, six weeks or two weeks across the view, never narrower than the view. The zoom starts at Year and is kept for next time.
    - **− and +:** − and + show half as much again, or a third less, from two weeks to the whole timeline.
  - **Axis:** Two rows of dates, each period named above the next smaller one: years over half years, half years over quarters, quarters over months, months over weeks (each named by its Monday), or months over days. A name too long for its period is shortened, such as to Jan or Q1, or left out.
  - **Scrolling:** The timeline opens with today a sixth of the way across, and Today goes back there. Changing the zoom or the window's width keeps today there. Once the reader has scrolled, it keeps the day in the middle of the view instead.
  - **Drawn by:** `TimelineView` in `apps/web/src/timeline-view.tsx`, with positions from `apps/web/src/timeline.ts`.
  - **Example:** The timeline on the Releases page.
- **The release layer:** A Releases picker shows every schedule's releases (the default), one schedule's, or none.
  - Each release has a diamond drawn under its bar, so it never sits on the next release. The diamond is at the bar's end. When the Ships on day was moved from the last cycle's end, it is at that day, joined to the bar's end by a dashed line.
  - A release's bar names the release only, with no counts or warnings about its features. Its label is its draft's dot, its colour's square and its name, with no box, over a strip of its colour ([A coloured name](drafts-and-values.md#values)). Where the name doesn't fit, the label is nothing at all.
  - Drafts follow the page's Draft view. A release's draft is its dot before its name. A schedule's draft is on its row's label, with its Retired box while a draft retires it.
  - Beside live, a release a draft removes stays, struck through. A release a draft moves keeps a dimmed copy as it is live, after a green dot, in a Live lane under the schedule's releases ([A move](drafts-and-values.md#drafts)).
  - A view may draw the layer in one of three forms, as the tabs of [Releases](../../design/pages/releases.md) do: releases as spans over faint cycles; cycles as named blocks with each release's diamond; or cycles alone with each schedule's end.
  - Where the view asks, each release span, cycle block, diamond and schedule name is a button that opens its record. Tab reaches it, and it is named as its tip reads.
  - **Drawn by:** `useReleaseLayer` in `apps/web/src/release-layer.tsx` shows every schedule's releases, each drawn by `ReleaseBar` in the form its `ReleaseLayerForm` names. It opens a mark's record through its optional `onOpen`.
  - **Example:** Platform's releases on the Releases timeline.
- **The strip:** One strip sits above every timeline, the Features Board and the month grids. It shows the whole range as quarters, or as cycles on the board when it shows a schedule's, each as wide as its share. ‹ comes before the strip; › and Today come after it.
  - Periods in view are tinted, the chosen one is filled with the accent colour, and the current one is underlined in today's red.
  - **A rail when narrow:** A period is never narrower than its name. When the names don't all fit, the strip scrolls sideways, with the [shared scroll bar](tables.md#tables), keeping the tinted periods in view: as near centred as a whole name at its start allows when all of them fit, or else starting from the first. At rest it always starts with a whole name, with just enough room after the last period for its end to as well. Focus moving along it scrolls it to the period focused.
  - On the board by months, the strip names quarters, as a month grid's does, each as wide as its months on the board, the first and last cut short. Choosing a quarter goes to its first month, and ‹ and › step a quarter, named Previous quarter and Next quarter.
  - On the board by a schedule's cycles, the strip names each cycle, and ‹ and › step a cycle.
  - On a timeline, a click, ‹ or › scrolls a quarter's start a sixth of the way across, where Today puts today, so the end of the quarter before stays in sight.
  - On a month grid, a click, ‹ or › scrolls the quarter's first month to just after the frozen columns, and Today scrolls to the current month.
  - Scrolling moves the tint. On a month grid, a month counts as in view once half its column is.
  - The periods are one Tab stop, landing on the one last focused while focus stays in the strip, or else the first in view. The arrow keys, Home and End move between them, and Enter or Space chooses one.
  - The chosen one, or the one stepped to by ‹ or ›, stays filled until the view moves elsewhere, even when the timeline's end leaves the view where it was. On the board, the period holding the month or cycle gone to is filled, including on opening and after Today.
  - For assistive technology, periods in view are named as in view, and the chosen one as selected.
  - **Drawn by:** `TimelineStrip` in `apps/web/src/timeline-strip.tsx`. A timeline's quarters come from `QuarterStrip` in `apps/web/src/timeline-view.tsx`, the board's months or cycles from `FeatureBoard` in `apps/web/src/feature-board-view.tsx`, and a month grid's quarters from `MonthStrip` in `apps/web/src/month-grid.tsx`, with the quarters and months in view from `apps/web/src/month-strip.ts`.
  - **Example:** The strip above the Releases timeline, or above Capacity's Feature teams.
- **Month grids:** A grid of months, such as Capacity's Feature teams, Allocations and Coverage, stays a grid, edited or read only. It has the timeline's month names, today's mark, and cycle and release lines. It holds whole quarters under the [strip](#timelines), with a thin line between its columns.
  - Today's mark is the current month's heading, underlined in today's red.
  - A month's cell marks each part a draft adds, takes away or changes (a team's line or a feature's line), with no dot or words for an empty value of its own.
  - Opening it, Today, a quarter chosen and ‹ or › put the month gone to second, with the month before it wholly in view after the frozen columns, and the current quarter is filled from the first drawing.
  - On a grid of people, its count, after the bar's buttons, is for that month and names it, such as 137 people and 10 planned hires in Apr 2027, even where the grid's end keeps that month from showing second. A grid whose rows don't change with the month, such as Coverage's work, counts its rows as any table does, such as 22 features and 5 projects. Its heading is filled in the accent colour, as the strip's chosen period is.
  - Scrolling by hand moves both the count and the filled heading to the first month wholly in view, or the one after it where it starts at the frozen columns' edge.
  - **Drawn by:** `MonthGrid` in `apps/web/src/month-grid.tsx`, through `RecordGrid`'s `columnBorders` and each month column's `current` in `apps/web/src/record-table.ts`. Each month's cell is in `apps/web/src/team-months.tsx` and `apps/web/src/allocation-months.tsx`, whose month columns set `marksParts` in `apps/web/src/record-table.ts`. The count by month is chosen by the grid's `MonthCounting`, such as `peopleCounting`, and the count and the filled heading are drawn by `MonthStrip` and `CountInView` in `apps/web/src/month-grid.tsx`, with the month from `countedColumn` in `apps/web/src/month-strip.ts`.
  - **Example:** Capacity's Feature teams.

## Boards

- **A board:** A board shows a table's records as cards. Its columns are periods, such as months or one schedule's cycles, as many as fit, then a column for none, such as No date or Later. Its rows come from the Group by menu's first grouping, starting with none.
  - It sits under the table's bar, so the search, Draft menu, Metrics, Group by and Views work on it as on the table. The exception: Group by offers no Then by on a board, and a Then by chosen on the table is kept but not shown.
  - Each column's heading names its period, and, for a cycle, its release in its [coloured box](drafts-and-values.md#values) and the cycle's days. The current period's heading is underlined in today's red along its bottom, as a month grid's current month is.
  - Every line between headings, rows and cells is one thin line, so the columns' widths are whole pixels, and the headers draw their own line under them, which stays as rows scroll under the sticky headers.
  - Months run from 12 months back to the latest month any feature is needed by, a year ahead at the least. A card sits in the month it is needed by, including a month that has passed. A feature needed before the first month isn't on the board, as one targeting a cycle outside the board's columns isn't.
  - The month or cycle gone to, by opening the board, Today, choosing in the strip, or ‹ or ›, is shown second, so the one before it stays in view, as on a month grid. It is shown first only where just one column fits, and the board moves back where needed so as many as fit are shown.
  - While a side panel, such as a record's details or Metrics, is open beside it, the board keeps its columns and their widths and scrolls sideways under the panel. It fits the space again once the panel has gone.
  - **Drawn by:** `FeatureBoard` in `apps/web/src/feature-board-view.tsx`, drawn in place of the table by `RecordGrid`'s `body` in `apps/web/src/record-grid.tsx`. Its columns and card order come from `apps/web/src/feature-board.ts`, the strip's periods from `quarterStrip` and `cycleStrip` there, the whole-pixel widths from `wholeColumnWidth`, and the current heading's underline from the theme's `--fathom-today-underline` in `apps/web/src/theme.ts`.
  - **Example:** The Board on Features.
- **A card:** A card shows its record's name, then the values the Card menu chooses, one to a line, starting with its key, under its name, small and dimmed. Its height follows what it shows.
  - Its draft is marked as a row's is: a dot before each value a draft changes; the record's own dot before its name for a draft of what the card doesn't show, with Moved for a move; and a tint beside live. A card a draft moves keeps a dimmed copy in its old place, after Live's green dot.
  - A warning, such as Not staffed, is red words on a line of their own, the size of Needed by, with no box.
  - The card whose details are open is marked as a [selected row](drafts-and-values.md#drafts) is.
  - Its menu, titled with its name, offers Show details and Copy link. It opens from a ⋯ at the card's top right, shown while the card is pointed at or has focus (the name leaves room for it); from a right-click on the card; and from Shift+F10 or the menu key.
  - **Drawn by:** `FeatureCard` and `LiveCard` in `apps/web/src/feature-card.tsx`, with the menu from `CardMenu` in `apps/web/src/card-menu.tsx`.
  - **Example:** Scheduler API's card on the Features Board, with Not staffed.
- **From the keyboard:** A board's cards are one Tab stop. The arrow keys move down and up a column, through its rows, and across to the nearest card in the next column of the same row.
  - Enter or Space opens the card's details, and closing them returns focus to the card. Shift+F10 or the menu key opens the card's menu.
  - **Drawn by:** `FeatureBoard` in `apps/web/src/feature-board-view.tsx`.
  - **Example:** On the Features Board, select Offline Sync, close its details, and press the Down arrow.
- **Menus above a board:** A choice of what the board shows that the table has no use for, such as its columns or what its cards show, is a menu from an outlined button at the start of the strip's row, so the board adds only one row under the bar.
  - Like Group by's button, the button names the choice in use, such as Columns: Months, and the menu ticks it.
  - A menu of parts to show, such as the Card menu, ticks each one shown and stays open while they're chosen.
  - Each choice is kept in the address and in a saved view.
  - The Views menu above a board leaves out what only changes the table (its sort, units, and hidden, frozen, moved and widened columns), since the board orders its own cards and lays out no columns; they stay in the shared view and show again on the table.
  - **Drawn by:** `AppMenu`, `MenuChoices` and `MenuToggle` in `apps/web/src/app-menu.tsx`, placed by `FeatureBoard` in `TimelineStrip`'s `before`, with the Views menu's `laysOutColumns` in `apps/web/src/table-controls.tsx` false on the board.
  - **Example:** Columns: Months and Card on the Features Board.
