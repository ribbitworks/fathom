---
title: "UI Conventions: Dates, Timelines and Boards"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["apps/web/**", "docs/testing/**"]
dependencies: ["docs/standards/ui-conventions.md", "docs/design/visual-design.md"]
last_updated: "2026-11-19"
---

# Dates, Timelines and Boards

Part of [UI Conventions](../ui-conventions.md): how days and months are shown and typed, the shared timeline, and boards of cards. Each entry gives the rule, the shared piece that draws it, and an example from the [fictional data](../../design/development-setup.md#fictional-data).

## Dates

- **Days:** A day shows in the reader's language with a short month and its year, such as 31 Dec 2026 or Dec 31, 2026. Every date shown includes its year. The About box's full date and Settings' day and time in a time zone are the two exceptions, as [Visual Design](../../design/visual-design.md#layout) sets out.
  - **Drawn by:** `formatDay` in `apps/web/src/table-view.ts`, which date cells use through `cellKinds` in `apps/web/src/cell-kinds.tsx`, with `dayOf` in `apps/web/src/today.ts` turning a moment into its day in Fathom's time zone first, such as when an account was made in Accounts' Created column, and `formatMomentDay` in `apps/web/src/table-view.ts` for a moment shown outside a date cell, such as a scope history's.
  - **Example:** each release's heading on Features grouped by Release, such as Platform: Harbor 2 and the day it ships.
- **Months:** A month shows as a short month and its year, such as Mar 2027.
  - **Drawn by:** `formatMonth` in `apps/web/src/table-view.ts`.
  - **Example:** Offline Sync's Needed by.
- **Typing a day or month:** Days and months are typed as their digits, laid out as typed, such as 2026-10-31 and 2027-03, whatever the reader's language.
  - **Drawn by:** `DayInput` in `apps/web/src/day-input.tsx` for a day's box, and its `digitsAsTyped` for a table's day and month cells, through `cellKinds` in `apps/web/src/cell-kinds.tsx`.
  - **Example:** a milestone's Date.
- **A time:** History entries give the day, its year and the time, in the reader's language.
  - **Drawn by:** `EntryRow` in `apps/web/src/history-entries.tsx`.
  - **Example:** any entry on the Change history page.

## Timelines

Every view with time across it, the Releases timeline, the Plan and the project timeline, draws time in one design language.

| Mark | Means |
| --- | --- |
| Solid bar | Staffed months |
| Dashed outline | A target cycle only, not staffed |
| Diamond | A day: a milestone, or a release's Ships on day |
| Triangle under the bar, the size of a diamond, named such as Needed by May | Needed by, at the end of its month |
| Red Late or Not staffed pill at the end of a bar | [Late](../../product/domain.md#planning-terms), or [Not staffed](../../design/pages/features.md#columns). Never a faint red outline. |
| Short upright grey line at a cycle lane's end | A schedule's last day, where it ends |
| Red line | Today, and only ever a thin line, such as a timeline's line, the strip's underline, the underline of a month grid's current month and the line along the top of the Features Board's current heading, never red words, a red fill or a red box, which mean a problem, such as Late |

- **The language:** Each mark in the table above means one thing on every timeline. Drafts are drawn with the draft marks, as [Drafts](drafts-and-values.md#drafts) sets out, and a dashed edge never means a draft. Today is red, as a thin line only, so it never reads as a problem.
  - **Drawn by:** `Tracks` in `apps/web/src/timeline-view.tsx`, for today's line, in the theme's `--fathom-today`, and `ReleaseBar` and `useReleaseLayer` in `apps/web/src/release-layer.tsx`, for the release diamonds, a schedule's end and the drafts of schedules and releases.
  - **Example:** today's red line on the Releases timeline.
- **The shared timeline:** One component draws every view with time across it: its axis of two rows of dates, which stays in view while its rows scroll, its zoom, kept in the browser for each view, today's line, scrolling that keeps today a sixth of the way across, the strip, and schedules' cycles and releases as a layer a view may show, first. Each view gives it its rows and the days they cover, and the timeline covers the whole months holding them and the layer's cycles. Its zoom, axis and scrolling are the same on every timeline:
  - **Zoom:** All, Year, 6 months, Quarter, Month, Week and Days show the whole timeline, three years, two years, a year, six months, six weeks or two weeks across the view, never narrower than the view. − and + show half as much again, or a third less, from two weeks to the whole timeline. The zoom is kept for next time, starting at Year.
  - **Axis:** Two rows of dates, each period named above the next smaller one: years over half years, half years over quarters, quarters over months, months over weeks (each named by its Monday), or months over days. A name too long for its period is shortened, such as to Jan or Q1, or left out.
  - **Scrolling:** The timeline opens with today a sixth of the way across, and Today goes back there. Changing the zoom or the window's width keeps today there, or, once the reader has scrolled, the day in the middle of the view.
  - **Drawn by:** `TimelineView` in `apps/web/src/timeline-view.tsx`, with where everything falls from `apps/web/src/timeline.ts`.
  - **Example:** the timeline on the Releases page.
- **The release layer:** Shows every schedule's releases by default, or one schedule's, or none, chosen in a Releases picker. Every release has its diamond, drawn under its bar so it never sits on the next release: at the bar's end, or, when its Ships on day was moved from its last cycle's end, at that day, joined to the bar's end by a dashed line. A release's bar names the release only, with no counts or warnings about its features. Its label is its draft's dot, its colour's square and its name, with no box, over a strip of its colour, or nothing at all where the name doesn't fit, as [A coloured name](drafts-and-values.md#values) sets out. Drafts follow the page's Draft view: a release's draft is its dot before its name, and a schedule's is on its row's label, with its Retired box while a draft retires it; beside live, a release a draft removes stays, struck through, and a release a draft moves keeps a dimmed copy as it is live, after a green dot, in a Live lane under the schedule's releases, as [A move](drafts-and-values.md#drafts) sets out. A view may draw it in one of three forms, as the Releases page's tabs do: releases as spans over faint cycles, cycles as named blocks with each release's diamond, or cycles alone with each schedule's end, as [Releases](../../design/pages/releases.md) sets out. Where the view asks, each release span, cycle block, diamond and schedule name is a button, reached by Tab and named as its tip reads, that opens its record.
  - **Drawn by:** `useReleaseLayer` in `apps/web/src/release-layer.tsx`, which shows every schedule's releases, each drawn by `ReleaseBar`, in the form its `ReleaseLayerForm` names, opening a mark's record through its optional `onOpen`.
  - **Example:** Platform's releases on the Releases timeline.
- **The strip:** Above every timeline, the Features Board and the month grids, one strip shows the quarters, on a timeline or a month grid, or the cycles, on the board, across the whole range, each as wide as its share: those in view tinted, the one chosen filled with the accent colour, the current one underlined in today's red, with ‹ before the strip, and › and Today after it. On the board it steps by cycle; on a timeline a click, or ‹ or ›, scrolls a quarter's start a sixth of the way across, where Today puts today, so the end of the quarter before stays in sight; on a month grid they scroll the quarter's first month to just after the frozen columns, and Today the current month. Scrolling moves the tint, and on a month grid a month counts as in view once half of its column is. The periods are one stop for Tab, at the one last focused while focus stays in the strip, or else the first in view; the arrow keys, Home and End move between them, and Enter or Space chooses one. The one chosen, or stepped to by ‹ or ›, stays filled until the view moves elsewhere, even when the timeline's end leaves the view where it was. Those in view are named as in view, and the one chosen as selected, for assistive technology.
  - **Drawn by:** `TimelineStrip` in `apps/web/src/timeline-strip.tsx`, with a timeline's quarters from `QuarterStrip` in `apps/web/src/timeline-view.tsx`, the board's cycles from `FeatureBoard` in `apps/web/src/feature-board-view.tsx`, and a month grid's quarters from `MonthStrip` in `apps/web/src/month-grid.tsx`, with the quarters and the months in view from `apps/web/src/month-strip.ts`.
  - **Example:** the strip above the Releases timeline, or above Feature assignments.
- **Month grids:** A grid of months that is edited, such as Feature assignments and the allocations grid on Capacity's People, stays an editable grid, with the timeline's month names, today's mark, and cycle and release lines. It holds whole quarters, under the [strip](#timelines), with a thin line between its columns, and today's mark is the current month's heading underlined in today's red. A month's cell marks each part a draft adds, takes away or changes, a team's label or a feature's line, with no dot or words for an empty value of its own.
  - **Drawn by:** `MonthGrid` in `apps/web/src/month-grid.tsx`, through `RecordGrid`'s `columnBorders` and each month column's `current` in `apps/web/src/record-grid.tsx`, with each month's cell in `apps/web/src/team-months.tsx` and `apps/web/src/allocation-months.tsx`, whose month columns set `marksParts` in `apps/web/src/record-grid.tsx`.
  - **Example:** Feature assignments.

## Boards

- **A board:** A board shows a table's records another way, as cards: its columns are periods, such as one schedule's cycles, as many as fit, then Later, and its rows come from the Group by menu's first grouping, starting with none. It sits under the same bar as the table, so the search, Draft menu, Metrics, Group by and Views work on it as on the table, except that Group by offers no Then by on a board, and a Then by chosen on the table is kept for it but not shown. Each column's heading names its period, a release in its [coloured box](drafts-and-values.md#values), and the period's days; the current period's heading has a red line along its top, as today's line is red. Every line between headings, rows and cells is one thin line. While a side panel is open beside it, such as a record's details or Metrics, it keeps its columns and their widths, scrolling sideways under the panel, and fits the space again once the panel has gone.
  - **Drawn by:** `FeatureBoard` in `apps/web/src/feature-board-view.tsx`, drawn in place of the table by `RecordGrid`'s `body` in `apps/web/src/record-grid.tsx`, with its columns and card order from `apps/web/src/feature-board.ts`, and the current heading's line from the theme's `--fathom-today-overline` in `apps/web/src/theme.ts`.
  - **Example:** the Board on Features.
- **A card:** A card shows its record's name, then the values the Card menu chooses, one to a line, its height following what it shows, starting with its key, under its name, small and dimmed. Its draft is marked as a row's is: a dot before each value a draft changes, the record's own dot before its name for a draft of what the card doesn't show, with Moved for a move, and a tint beside live; a card a draft moves keeps a dimmed copy, after Live's green dot, in its old place. A warning, such as Not staffed, is red words on a line of its own, the size of Needed by, with no box. The card whose details are open is marked as a [selected row](drafts-and-values.md#drafts) is. A card has a menu, titled with its name, offering Show details and Copy link: from a ⋯ at its top right, shown while the card is pointed at or has focus, which its name leaves room for; from a right-click on the card; and from Shift+F10 or the menu key.
  - **Drawn by:** `FeatureCard` and `LiveCard` in `apps/web/src/feature-board-view.tsx`, with the menu from `CardMenu` in `apps/web/src/card-menu.tsx`.
  - **Example:** Scheduler API's card on the Features Board, with Not staffed.
- **From the keyboard:** A board's cards are one stop for Tab: the arrow keys move down and up a column, through its rows, and across to the nearest card in the next column of the same row; Enter or Space opens the card's details, and closing them puts focus back on the card; Shift+F10 or the menu key opens the card's menu.
  - **Drawn by:** `FeatureBoard` in `apps/web/src/feature-board-view.tsx`.
  - **Example:** on the Features Board, select Offline Sync, close its details, and press the Down arrow.
- **Menus above a board:** A choice of what the board shows that the table has no use for, such as its schedule or what its cards show, is a menu from an outlined button at the start of the strip's row, so the board adds only one row under the bar. As on Group by's button, the button names the choice in use, such as Schedule: Platform, and the menu ticks it; a menu of parts to show, such as the Card menu, ticks each one shown and stays open while they're chosen. Each is kept in the address and in a saved view.
  - **Drawn by:** `AppMenu`, `MenuChoices` and `MenuToggle` in `apps/web/src/app-menu.tsx`, placed by `FeatureBoard` in `TimelineStrip`'s `before`.
  - **Example:** Schedule: Platform and Card on the Features Board.
