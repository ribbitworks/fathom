---
title: "UI Conventions: Dates, Timelines and Boards"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["apps/web/**", "docs/testing/**"]
dependencies: ["docs/standards/ui-conventions.md", "docs/design/visual-design.md"]
last_updated: "2026-11-20"
---

# Dates, Timelines and Boards

Part of [UI Conventions](../ui-conventions.md): how days and months are shown and typed, the shared timeline, and boards of cards. Examples come from the [fictional data](../../design/development-setup.md#fictional-data).

## Dates

- **Days:** A day shows a short month and its year in the reader's language, such as 31 Dec 2026 or Dec 31, 2026. Every date shown includes its year. The two exceptions are the About box's full date and Settings' day and time in a time zone ([Visual Design](../../design/visual-design.md#layout)).
  - **Drawn by:** `formatDay` in `apps/web/src/day-formats.ts`, which date cells use through `cellKinds` in `apps/web/src/cell-kinds.tsx`. `dayOf` in `apps/web/src/today.ts` first turns a moment into its day in Fathom's time zone, such as when an account was made in Accounts' Created column. `formatMomentDay` in `apps/web/src/day-formats.ts` shows a moment outside a date cell, such as a scope history's.
  - **Example:** each release's heading on Features grouped by Release, such as Platform: Harbor 2 and the day it ships.
- **Months:** A month shows as a short month and its year, such as Mar 2027.
  - **Drawn by:** `formatMonth` in `apps/web/src/day-formats.ts`.
  - **Example:** Offline Sync's Needed by.
- **Typing a day or month:** Days and months are typed as digits, laid out as typed, such as 2026-10-31 and 2027-03, whatever the reader's language.
  - **Drawn by:** `DayInput` in `apps/web/src/day-input.tsx` for a day's box, and its `digitsAsTyped` for a table's day and month cells, through `cellKinds` in `apps/web/src/cell-kinds.tsx`.
  - **Example:** a milestone's Date.
- **A time:** History entries show the day, its year and the time in the reader's language.
  - **Drawn by:** `EntryRow` in `apps/web/src/history-entries.tsx`.
  - **Example:** any entry on the Change history page.

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
| Red line | Today, only ever as a thin line, such as a timeline's line, the strip's underline, the underline of a month grid's current month and the line along the top of the Features Board's current heading. Never red words, a red fill or a red box, which mean a problem, such as Late. |

- **The language:** Each mark in the table means one thing on every timeline. Drafts use the [draft marks](drafts-and-values.md#drafts), and a dashed edge never means a draft.
  - **Drawn by:** `Tracks` in `apps/web/src/timeline-view.tsx` draws today's line in the theme's `--fathom-today`. `ReleaseBar` and `useReleaseLayer` in `apps/web/src/release-layer.tsx` draw the release diamonds, a schedule's end, and the drafts of schedules and releases.
  - **Example:** today's red line on the Releases timeline.
- **The shared timeline:** One component draws every view with time across it. It draws the axis, which stays in view while the rows scroll; the zoom, kept in the browser for each view; today's line; the scrolling; the strip; and schedules' cycles and releases, as a layer a view may show, first. Each view gives it its rows and their days, and the timeline covers the whole months holding them and the layer's cycles. Zoom, axis and scrolling work the same on every timeline:
  - **Zoom:** All, Year, 6 months, Quarter, Month, Week and Days show the whole timeline, three years, two years, a year, six months, six weeks or two weeks across the view, never narrower than the view. − and + show half as much again, or a third less, from two weeks to the whole timeline. The zoom starts at Year and is kept for next time.
  - **Axis:** Two rows of dates, each period named above the next smaller one: years over half years, half years over quarters, quarters over months, months over weeks (each named by its Monday), or months over days. A name too long for its period is shortened, such as to Jan or Q1, or left out.
  - **Scrolling:** The timeline opens with today a sixth of the way across, and Today goes back there. Changing the zoom or the window's width keeps today there. Once the reader has scrolled, it keeps the day in the middle of the view instead.
  - **Drawn by:** `TimelineView` in `apps/web/src/timeline-view.tsx`, with positions from `apps/web/src/timeline.ts`.
  - **Example:** the timeline on the Releases page.
- **The release layer:** A Releases picker shows every schedule's releases (the default), one schedule's, or none.
  - Each release has a diamond drawn under its bar, so it never sits on the next release. The diamond is at the bar's end. When the Ships on day was moved from the last cycle's end, it is at that day, joined to the bar's end by a dashed line.
  - A release's bar names the release only, with no counts or warnings about its features. Its label is its draft's dot, its colour's square and its name, with no box, over a strip of its colour ([A coloured name](drafts-and-values.md#values)). Where the name doesn't fit, the label is nothing at all.
  - Drafts follow the page's Draft view. A release's draft is its dot before its name. A schedule's draft is on its row's label, with its Retired box while a draft retires it. Beside live, a release a draft removes stays, struck through. A release a draft moves keeps a dimmed copy as it is live, after a green dot, in a Live lane under the schedule's releases ([A move](drafts-and-values.md#drafts)).
  - A view may draw the layer in one of three forms, as the tabs of [Releases](../../design/pages/releases.md) do: releases as spans over faint cycles; cycles as named blocks with each release's diamond; or cycles alone with each schedule's end.
  - Where the view asks, each release span, cycle block, diamond and schedule name is a button that opens its record. Tab reaches it, and it is named as its tip reads.
  - **Drawn by:** `useReleaseLayer` in `apps/web/src/release-layer.tsx` shows every schedule's releases, each drawn by `ReleaseBar` in the form its `ReleaseLayerForm` names. It opens a mark's record through its optional `onOpen`.
  - **Example:** Platform's releases on the Releases timeline.
- **The strip:** One strip sits above every timeline, the Features Board and the month grids. It shows the whole range as quarters, or as cycles on the board, each as wide as its share. Periods in view are tinted, the chosen one is filled with the accent colour, and the current one is underlined in today's red. ‹ comes before the strip; › and Today come after it.
  - On the board, it steps by cycle. On a timeline, a click, ‹ or › scrolls a quarter's start a sixth of the way across, where Today puts today, so the end of the quarter before stays in sight. On a month grid, they scroll the quarter's first month to just after the frozen columns, and Today scrolls to the current month.
  - Scrolling moves the tint. On a month grid, a month counts as in view once half its column is.
  - The periods are one Tab stop, landing on the one last focused while focus stays in the strip, or else the first in view. The arrow keys, Home and End move between them, and Enter or Space chooses one.
  - The chosen one, or the one stepped to by ‹ or ›, stays filled until the view moves elsewhere, even when the timeline's end leaves the view where it was.
  - For assistive technology, periods in view are named as in view, and the chosen one as selected.
  - **Drawn by:** `TimelineStrip` in `apps/web/src/timeline-strip.tsx`. A timeline's quarters come from `QuarterStrip` in `apps/web/src/timeline-view.tsx`, the board's cycles from `FeatureBoard` in `apps/web/src/feature-board-view.tsx`, and a month grid's quarters from `MonthStrip` in `apps/web/src/month-grid.tsx`, with the quarters and months in view from `apps/web/src/month-strip.ts`.
  - **Example:** the strip above the Releases timeline, or above Feature assignments.
- **Month grids:** A grid of months that is edited, such as Feature assignments and the allocations grid on Capacity's People, stays an editable grid. It has the timeline's month names, today's mark, and cycle and release lines. It holds whole quarters under the [strip](#timelines), with a thin line between its columns. Today's mark is the current month's heading, underlined in today's red. A month's cell marks each part a draft adds, takes away or changes (a team's label or a feature's line), with no dot or words for an empty value of its own.
  - **Drawn by:** `MonthGrid` in `apps/web/src/month-grid.tsx`, through `RecordGrid`'s `columnBorders` and each month column's `current` in `apps/web/src/record-table.ts`, with each month's cell in `apps/web/src/team-months.tsx` and `apps/web/src/allocation-months.tsx`, whose month columns set `marksParts` in `apps/web/src/record-table.ts`.
  - **Example:** Feature assignments.

## Boards

- **A board:** A board shows a table's records as cards. Its columns are periods, such as one schedule's cycles, as many as fit, then Later. Its rows come from the Group by menu's first grouping, starting with none.
  - It sits under the table's bar, so the search, Draft menu, Metrics, Group by and Views work on it as on the table. The exception: Group by offers no Then by on a board, and a Then by chosen on the table is kept but not shown.
  - Each column's heading names its period, a release in its [coloured box](drafts-and-values.md#values), and the period's days. The current period's heading has a red line along its top, like today's line. Every line between headings, rows and cells is one thin line.
  - While a side panel, such as a record's details or Metrics, is open beside it, the board keeps its columns and their widths and scrolls sideways under the panel. It fits the space again once the panel has gone.
  - **Drawn by:** `FeatureBoard` in `apps/web/src/feature-board-view.tsx`, drawn in place of the table by `RecordGrid`'s `body` in `apps/web/src/record-grid.tsx`. Its columns and card order come from `apps/web/src/feature-board.ts`, and the current heading's line from the theme's `--fathom-today-overline` in `apps/web/src/theme.ts`.
  - **Example:** the Board on Features.
- **A card:** A card shows its record's name, then the values the Card menu chooses, one to a line, starting with its key, under its name, small and dimmed. Its height follows what it shows.
  - Its draft is marked as a row's is: a dot before each value a draft changes; the record's own dot before its name for a draft of what the card doesn't show, with Moved for a move; and a tint beside live. A card a draft moves keeps a dimmed copy in its old place, after Live's green dot.
  - A warning, such as Not staffed, is red words on a line of their own, the size of Needed by, with no box.
  - The card whose details are open is marked as a [selected row](drafts-and-values.md#drafts) is.
  - Its menu, titled with its name, offers Show details and Copy link. It opens from a ⋯ at the card's top right, shown while the card is pointed at or has focus (the name leaves room for it); from a right-click on the card; and from Shift+F10 or the menu key.
  - **Drawn by:** `FeatureCard` and `LiveCard` in `apps/web/src/feature-board-view.tsx`, with the menu from `CardMenu` in `apps/web/src/card-menu.tsx`.
  - **Example:** Scheduler API's card on the Features Board, with Not staffed.
- **From the keyboard:** A board's cards are one Tab stop. The arrow keys move down and up a column, through its rows, and across to the nearest card in the next column of the same row. Enter or Space opens the card's details, and closing them returns focus to the card. Shift+F10 or the menu key opens the card's menu.
  - **Drawn by:** `FeatureBoard` in `apps/web/src/feature-board-view.tsx`.
  - **Example:** on the Features Board, select Offline Sync, close its details, and press the Down arrow.
- **Menus above a board:** A choice of what the board shows that the table has no use for, such as its schedule or what its cards show, is a menu from an outlined button at the start of the strip's row, so the board adds only one row under the bar. Like Group by's button, the button names the choice in use, such as Schedule: Platform, and the menu ticks it. A menu of parts to show, such as the Card menu, ticks each one shown and stays open while they're chosen. Each choice is kept in the address and in a saved view.
  - **Drawn by:** `AppMenu`, `MenuChoices` and `MenuToggle` in `apps/web/src/app-menu.tsx`, placed by `FeatureBoard` in `TimelineStrip`'s `before`.
  - **Example:** Schedule: Platform and Card on the Features Board.
