# Fathom: UI Conventions

**Last updated:** 2026-11-15

A short lookup of the conventions every screen follows, for those who build screens. Each entry gives the rule, the shared piece that draws it, so a new screen reuses it rather than drawing its own, and an example from the [fictional seed data](development-setup.md#fictional-seed-data), or the steps that make one. The principles behind them, and how each page is laid out, are in [Visual Design](visual-design.md).

## Drafts

- **A draft's dot:** A draft is marked by its dot alone, always before the record, value or part it marks: yellow while it waits for approval, hollow while it holds the user's own unpublished changes, and red in a ring once rejected, so it's told apart by its shape as well as its colour. No words such as Draft or Draft: added sit beside it. Its tip, also read aloud, says what the draft does, such as Draft: added, what a value was, when it takes effect and who made it, where those are known, and a rejection's reason last, such as Rejected, added: and the reason. A record's menu is the one place the draft's words follow its dot, as the heading of the draft's details. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `DraftedItem` in `apps/web/src/status-mark.tsx`, with the words from `draftWords` and `draftTip`, and the menu's heading from `apps/web/src/draft-details.tsx`.
  - **Example:** Vianney Rousseau, drafted to be added, and Ophélie Roussel, whose addition was rejected, on People.
- **What a dot can't say:** Moved, Reordered, Retired and Restored are a small yellow box after the item, on a draft still waiting. A fact about an item is a box after it too: grey for Built in, for Planned, expected and its month, and for a stream's Ended, and red for a warning, such as Left. A warning with no value before it, such as No team, is red words with no box, as [Warnings on a value](#values) sets out. Facts come before the draft's box, since a fact says what the item is and the draft's box what is about to happen to it. A dot always means a draft's state, never a fact.
  - **Drawn by:** `DraftedItem`, `FactBox` and `MarkedItem` in `apps/web/src/status-mark.tsx`; a stream's Ended by `EndedBox` there too.
  - **Example:** Languages on the Lists page, then its Retired box; Viktoria Holmberg's Left on People.
- **The lock:** A record someone else has unpublished changes to has a grey lock before it, its tip Being changed by and their name, and is read only until they publish or discard them. Its menu says the same, and that it can be changed once they do.
  - **Drawn by:** `DraftedItem`'s `heldBy` in `apps/web/src/status-mark.tsx`, with the menu's words from `apps/web/src/draft-details.tsx`.
  - **Example:** Viktoria Holmberg on People, held by the second Engineering Operations Manager.
- **A summary row:** A table of records with few columns, such as the Lists page's lists, draws each record's row, its Live row under it beside live, and a cell naming its parts, such as a list's choices, the same way.
  - **Drawn by:** `SummaryRow`, `PartsCell` and `LivePartsCell` in `apps/web/src/summary-row.tsx`. On the shared table, a cell naming a record's parts draws them with `Parts` and `LiveParts` there, marking each part itself, as the Releases column on Releases does.
  - **Example:** Sites on the Lists page.
- **A row's slot:** Each row of a table, of the Lists page, of a list's panel, of Releases and of the Drafts page starts with a slot of two places, kept even when empty: the record's own mark first, then the dot of its first value where a draft changes that, which hangs back into the slot, so every row's first value starts at the same place and a changed name never looks set in under the row above. A class's symbol, where a record has one, follows the slot and comes before the first value, as [A class's mark](#access) sets out, decided by the maintainer on 2026-11-14. The record's own mark shows only where its draft changes something the row doesn't show, such as adding, removing, retiring or moving it; a draft that changes only values the row shows leaves the slot empty, since each of those values has its own dot, so two dots never sit side by side. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `RowMarks` and `DraftedItem`'s `slot` in `apps/web/src/status-mark.tsx`, with `recordMark`; the sizes are the theme's `--fathom-dot-size`, `--fathom-mark-gap` and `--fathom-ring-room` in `apps/web/src/theme.ts`.
  - **Example:** on Projects' Milestones tab, Second crane live, drafted to be added, beside Final handover, drafted to be renamed.
- **A changed value:** Each value a draft changes has the draft's dot before it, and is in semibold while drafts show beside live. Where a draft empties a value, or fills one that was empty, the empty side shows its words for none in grey italics, such as No start.
  - **Drawn by:** `DraftedValue`, `changedValue` and `EmptiedValue` in `apps/web/src/status-mark.tsx`; `RecordGrid` in `apps/web/src/record-grid.tsx` in a table, and `Row` in `apps/web/src/record-details.tsx` in a panel.
  - **Example:** 西尾 亮's End and Grade on People.
- **A removal:** A record a draft removes is struck through after its dot, and can't be changed until the draft is discarded or decided.
  - **Drawn by:** `draftRowClass` in `apps/web/src/list-drafts.tsx`, with the row of the table or panel that holds it.
  - **Example:** Salvador Quiñones Méndez on People.
- **A part a draft adds or removes:** A part of a record, such as a feature team's member, a manager's direct report or a team in a month's cell, has the draft's dot before it, struck through when the draft takes it away. Screen readers read added, removed or changed after it, since the dot and the line are only seen. A record whose parts have drafts, such as a list and its choices, has one dot before its parts, waiting while any part's draft waits, and rejected only once every one was. As it is live, in a Live row or live only, a part a draft takes away or changes has Live's green dot before it, its tip, live only, naming the change waiting, such as Live. Its removal is waiting for approval.
  - **Drawn by:** `DraftedPartItem` and `partsMark` in `apps/web/src/status-mark.tsx`, as `TeamLabels` in `apps/web/src/team-labels.tsx`, `AllocationLines` in `apps/web/src/allocation-months.tsx`, `PartsCell` in `apps/web/src/summary-row.tsx`, and the Person and feature team panels use them.
  - **Example:** Mobile apps on the Org chart's feature teams: Atmananda Ganaka added, Priscille Adam taken away.
- **A move:** A moved item has its dot and the Moved box, with a dimmed copy in its old place after a green dot. On the org chart, a person drafted to another manager is drawn under them, with a Live copy under the manager they report to now.
  - **Drawn by:** the list's panel in `apps/web/src/list-panel.tsx`, and `chartPeople` in `apps/web/src/org-chart.ts`.
  - **Example:** Co-op in the panel of Levels on the Lists page; Simone Jean on the Org chart.
- **Retiring:** A list, choice or stream drafted to be retired or restored stays where it is until approved, with its dot and a Retired or Restored box. Retired records show only when asked for. Drafting a retirement or a restore is a change seen in place, so it shows no notification, and Cmd+Z or Ctrl+Z undoes it. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `DraftedItem`, with `retiring` set on the draft.
  - **Example:** Patches on the Releases page.
- **Live:** Beside live, a record or value as it is now is drawn under its draft after a green dot, its tip Live: a light green Live row under a table's row, a Live line under a value in a panel or a column's name, and a Live card on the org chart. A Live row is read only, skipped when moving between cells, and marks each live value under a changed one, rejected drafts' included.
  - **Drawn by:** `LiveRowMarks`, `LiveValue` and `LiveLine` in `apps/web/src/status-mark.tsx`, and `RecordGrid` in `apps/web/src/record-grid.tsx`.
  - **Example:** the Live row under 西尾 亮 on People.
- **A column's draft:** A column a draft adds, removes or changes has its dot before its name. A draft that changes only its heading, such as its name, keeps one column, with the live name on a Live line under the drafted one; a draft that changes what its cells show has the live column beside it.
  - **Drawn by:** `RecordGrid` in `apps/web/src/record-grid.tsx`.
  - **Example:** Grade on People, with Level under it.
- **Tints:** Beside live only, a row, column or org chart card with a draft is faint yellow, or faint red once rejected, and a Live row is light green. Each has a darker version in the dark scheme, so text on it stays readable.
  - **Drawn by:** `draftRowClass` in `apps/web/src/list-drafts.tsx`, `RecordGrid`, and the org chart's cards, with the colours from `apps/web/src/theme.ts`.
  - **Example:** Vianney Rousseau's row on People.
- **The three Draft views:** The Draft menu's choice decides every mark on the page, in one place. Drafts & Live shows everything above, named so by the maintainer on 2026-11-14. Drafts applied shows the dots and strike-throughs, leaving out rejected drafts, which it shows taken back, with no tints, semibold or Live rows. Live only shows no draft dots or tints, but a green dot on each record, value or part a waiting draft would change, its tip naming the change, such as "Live. A change is waiting for approval." A rejected draft gets none. Locks and warnings show in every view. Each mark is given its item's own draft, whatever the view. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `DraftView` and `DraftedItem` in `apps/web/src/status-mark.tsx`, with `viewedDraft` and `liveWaitingWords`; each page sets its view once.
  - **Example:** on People, choose Live only in the Draft menu: the Level column's name has a green dot.
- **A selected row:** A selected row, such as the list whose panel is open, has the hover grey with a thin accent bar at its left edge, never the accent's fill, since a row's fill says its draft's state. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `selectedRow` in `apps/web/src/pages.module.css`.
  - **Example:** select Sites on the Lists page.
- **Centring:** Every mark, dot, lock or box, and a colour's swatch beside text, is centred on the centreline of its text's capitals, and a line holding them lines them up on its text's baseline, with the marks' own spacing the only spacing. A swatch alone, such as a menu item's icon, is centred in its place instead.
  - **Drawn by:** `dotPlace`, `kind` and `swatchPlace` in `apps/web/src/status-mark.module.css`, `MarkRow` in `apps/web/src/status-mark.tsx`, and `Swatch` in `apps/web/src/colour-swatch.tsx`.
  - **Example:** any dot before a name on People.
- **A draft from another day:** Where a draft takes effect from a day other than the one shown, the item is followed in grey by from and the day, such as from Dec 1, 2026. An org chart card has too little room, so its From and the day sit on a line of their own under the name, a recorded exception. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** the `from` of `DraftedItem`, and the card in `apps/web/src/org-chart-page.tsx`.
  - **Example:** on the Org chart, move to next month and add someone to a feature team.

## Values

- **Live values:** Live means approved. A live value shown beside its draft is dimmed, after a green dot, and opens nothing, as [Drafts](#drafts) sets out.
  - **Drawn by:** `LiveLine` and `LiveValue` in `apps/web/src/status-mark.tsx`.
  - **Example:** the light green Live row under a seeded person's drafted change on People.
- **Read-only values:** A value that follows from another is read only, shows no pencil, and ignores what is pasted into it. Those who may not change a record see its values with no pencils and no empty row.
  - **Drawn by:** a column's `readOnly` in `apps/web/src/record-grid.tsx`, and `Row` without `editing` in `apps/web/src/record-details.tsx`.
  - **Example:** Release on Features, which follows from Target cycle.
- **Empty values:** An empty cell is blank, unless a warning stands in its place, as [Warnings on a value](#values) sets out. In a details panel, an empty value reads None, dimmed, or the column's own word for empty, and so does an empty list in a panel, such as a project with no milestones. Decided by the maintainer on 2026-11-11. Where a draft empties a value, or fills an empty one, the empty side reads its words for none in grey italics, such as No start, in tables and panels alike.
  - **Drawn by:** `Row` in `apps/web/src/record-details.tsx`, with the column's `emptyLabel`.
  - **Example:** Voice Notes' Target cycle reads Later in its details.
- **Values Fathom fills in:** An empty cell Fathom fills in from other values shows that text in grey italics, and editing it starts empty.
  - **Drawn by:** `apps/web/src/record-grid.tsx`, with the org chart and the Teams panel drawing their own; no shared piece yet.
  - **Example:** a seeded planned hire with no name, named by its position and ID on People.
- **Warnings on a value:** A warning about a value is a red box after it, in words, such as Left, read aloud with why. It shows in every Draft view. Decided by the maintainer on 2026-11-11. A warning with no value before it, in an empty cell or on a line of its own, such as No team in a Feature team cell or Not staffed on a card, is its words in red in the value's place, with no box, read aloud the same way. Decided by the owner on 2026-11-14. Box and words take a red dark enough to read on a draft's tinted row. A status a value is in, such as Over and Under on Capacity, isn't a warning: it shows in words, with its figures in a tooltip, and isn't read aloud with why.
  - **Drawn by:** `MarkedItem` with the `warning` tone, in `apps/web/src/status-mark.tsx`, with `empty` for a warning in an empty value's place.
  - **Example:** No team, in Scheduler API's Feature team cell.
- **Values in units:** An amount shows its unit's code in a table, such as 2.5 PD, and spells the unit out in a panel, such as 2.5 person-days (20 hours). Totals of one unit, such as the capacity totals on Capacity's People, name it once, by its code, in their heading, such as Total, PM. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `EffortCell` in `apps/web/src/effort-cell.tsx`, and `inUnitsWords` in `apps/web/src/record-details.tsx`; the capacity totals by `CapacityTotal` in `apps/web/src/allocation-months.tsx`, with the units' words from `unitWords` in `apps/web/src/effort.ts`.
  - **Example:** Audit Export's Effort.
- **A size:** A feature's [Size](../product/decisions.md#planning) is the word Size and a block for each S it weighs, blue-grey, from faint to strong against the page by position, so light to dark on a light page and dark to light on a dark one, four blocks filling the space given, such as a card's width or a row's label. It is never a bar on a track, which reads as progress, and never green to red, which would borrow red's meaning of a problem. The same mark shows on cards, in the panel, in a timeline's row labels and in group headings. Its value, such as M, 2 × S, shows on hover, is read aloud, and shows in the panel. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `SizeMark` in `apps/web/src/planning-marks.tsx`, with its blue-greys from the theme's `--fathom-size-1` to `--fathom-size-4` in `apps/web/src/theme.ts`; on the Features Board's cards so far, and in the panel, timelines and group headings still to come.
  - **Example:** Offline Sync's card on the Features Board.
- **A risk:** A feature's [Risk](../product/decisions.md#planning) is the word Risk and a segment for each step of its list, green to red by the list's order, filling the space given, lined up under the Size mark. Its value shows on hover, is read aloud, and shows in the panel. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `RiskMark` in `apps/web/src/planning-marks.tsx`; on the Features Board's cards so far.
  - **Example:** Offline Sync's card on the Features Board.
- **A coloured name:** A team or release named with its colour is always its name in a box tinted with that colour, never after a coloured dot or square, which reads as a draft's dot. One shared piece draws every coloured name. The Org chart's square before a team's name, and the Releases side panel's square before a release's name, are to move to it. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `TeamLabels` in `apps/web/src/team-labels.tsx`, for feature teams; to be widened, or renamed, for any coloured name.
  - **Example:** Mobile apps in a month's cell on Feature assignments.

## Dates

- **Days:** A day shows in the reader's language with a short month and its year, such as 31 Dec 2026 or Dec 31, 2026. Every date shown includes its year. The About box's full date and Settings' day and time in a time zone are the two exceptions, as [Visual Design](visual-design.md#layout) sets out.
  - **Drawn by:** `formatDay` in `apps/web/src/table-view.ts`, which date cells use through `cellKinds` in `apps/web/src/cell-kinds.tsx`, and `formatMomentDay` there for the day of a moment, such as when an account was made.
  - **Example:** each release's heading on Features grouped by Release, such as Platform: Harbor 2 and the day it ships.
- **Months:** A month shows as a short month and its year, such as Mar 2027.
  - **Drawn by:** `formatMonth` in `apps/web/src/table-view.ts`.
  - **Example:** Offline Sync's Needed by.
- **Typing a day or month:** Days and months are typed as their digits, laid out as typed, such as 2026-10-31 and 2027-03, whatever the reader's language.
  - **Drawn by:** `DayInput` in `apps/web/src/day-input.tsx`. People's date cells and Person details still have their own fields, as [issue #464](https://github.com/jlarue26/fathom/issues/464) records.
  - **Example:** a milestone's Date.
- **A time:** History entries give the day, its year and the time, in the reader's language.
  - **Drawn by:** `EntryRow` in `apps/web/src/history-entries.tsx`.
  - **Example:** any entry on the Change history page.

## Timelines

Every view with time across it, the Releases timeline, the Plan and the project timeline, draws time in one design language, decided by the maintainer on 2026-11-11:

| Mark | Means |
| --- | --- |
| Solid bar | Staffed months |
| Dashed outline | A target cycle only, not staffed |
| Diamond | A day: a milestone, or a release's Ships on day |
| Triangle under the bar, the size of a diamond, named such as Needed by May | Needed by, at the end of its month |
| Red Late or Not staffed pill at the end of a bar | [Late](../product/decisions.md#planning) or [Not staffed](../product/decisions.md#planning). Never a faint red outline. |
| Short upright grey line at a cycle lane's end | A release stream's last day, where it ends |
| Red line | Today, and only ever a thin line, such as a timeline's line, the strip's underline and the line along the top of the Features Board's current heading, never red words, a red fill or a red box, which mean a problem, such as Late |

- **The language:** Each mark in the table above means one thing on every timeline. Drafts are drawn with the draft marks, as [Drafts](#drafts) sets out, and a dashed edge never means a draft. Today is red, as a thin line only, so it never reads as a problem, decided by the maintainer on 2026-11-13.
  - **Drawn by:** `Tracks` in `apps/web/src/timeline-view.tsx`, for today's line, in the theme's `--fathom-today`, and `ReleaseBar` and `useReleaseLayer` in `apps/web/src/release-layer.tsx`, for the release diamonds, a stream's end and the drafts of streams and releases; the rest is not built yet.
  - **Example:** today's red line on the Releases timeline.
- **The shared timeline:** One component draws every view with time across it: its axis of two rows of dates, which stays in view while its rows scroll, its zoom, kept in the browser for each view, today's line, scrolling that keeps today a sixth of the way across, the strip, and release streams' cycles and releases as a layer a view may show, first. Each view gives it its rows and the days they cover, and the timeline covers the whole months holding them and the layer's cycles. Its axis, zoom and scrolling work as the [Releases timeline](visual-design.md#components) sets out.
  - **Drawn by:** `TimelineView` in `apps/web/src/timeline-view.tsx`, with where everything falls from `apps/web/src/timeline.ts`.
  - **Example:** the timeline on the Releases page.
- **The release layer:** Shows every stream's releases by default, or one stream's, or none, chosen in a Releases picker. Every release has its diamond, drawn under its bar so it never sits on the next release: at the bar's end, or, when its Ships on day was moved from its last cycle's end, at that day, joined to the bar's end by a dashed line. A release's bar names the release only, with no counts or warnings about its features, which are listed in its panel. Drafts follow the page's Draft view: a release's draft is its dot before its name, and a stream's is on its row's label, with its Retired box while a draft retires it; beside live, a release a draft removes stays, struck through, and a release a draft moves keeps a dimmed copy as it is live, after a green dot, in a Live lane under the stream's releases, as [A move](#drafts) sets out. Recommended by agent 1 and accepted in advance by the maintainer on 2026-11-11, to be confirmed.
  - **Drawn by:** `useReleaseLayer` in `apps/web/src/release-layer.tsx`, which shows every stream's releases, each drawn by `ReleaseBar`; the picker is not built yet.
  - **Example:** on Releases, set a release's Ships on day after its last cycle's end.
- **Feature rows:** A feature's row label shows its ID and name on the bar's line, with the [Size mark](#values) under them, so the name stays in view when the bar is scrolled away. Every feature row keeps room under its bar for day marks, such as Needed by, and labels line up with their bars.
  - **Drawn by:** not built yet.
  - **Example:** none until the Plan is built.
- **The strip:** Above every timeline, and above the Features Board, one strip shows the quarters, on a timeline, or the cycles, on the board, across the whole range, each as wide as its share: those in view tinted, the one chosen filled with the accent colour, the current one underlined in today's red, with ‹ before it, and › and Today after it. On the board it steps by cycle; on a timeline a click, or ‹ or ›, scrolls a quarter's start a sixth of the way across, where Today puts today, so the end of the quarter before stays in sight, decided by the maintainer on 2026-11-11, and scrolling moves the tint. The periods are one stop for Tab, at the one last focused while focus stays in the strip, or else the first in view; the arrow keys, Home and End move between them, and Enter or Space chooses one. The one chosen, or stepped to by ‹ or ›, stays filled until the view moves elsewhere, even when the timeline's end leaves the view where it was, decided by the maintainer on 2026-11-13. Those in view are named as in view, and the one chosen as selected, for assistive technology. The date row on People and the Org chart is to become the same strip.
  - **Drawn by:** `TimelineStrip` in `apps/web/src/timeline-strip.tsx`, with a timeline's quarters from `QuarterStrip` in `apps/web/src/timeline-view.tsx`, and the board's cycles from `FeatureBoard` in `apps/web/src/feature-board-view.tsx`; not yet on People or the Org chart, whose date row is `apps/web/src/date-control.tsx`.
  - **Example:** the strip above the Releases timeline.
- **Month grids:** A grid of months that is edited, such as Feature assignments and the allocations grid on Capacity's People, stays an editable grid, with the timeline's month names, today's mark, and cycle and release lines. A month's cell marks each part a draft adds, takes away or changes, a team's label or a feature's line, with no dot or words for an empty value of its own.
  - **Drawn by:** `MonthGrid` in `apps/web/src/month-grid.tsx`, with each month's cell in `apps/web/src/team-months.tsx` and `apps/web/src/allocation-months.tsx`, whose month columns set `marksParts` in `apps/web/src/record-grid.tsx`; the timeline's month names, today's mark, and the lines are not shared with it yet.
  - **Example:** Feature assignments.

## The Page Heading

- **The row under the heading stays put:** Every page's heading is one line: its title, then, where the page shows its records more than one way, the switch between them, centred on the title's line, and the page's actions at the right. Nothing adds a row between the heading and the search row, so the search row starts at the same place on every page, and moving between pages doesn't shift it. The heading is one height on every page, as tall as a button, and the gap under it is the same on every page, the theme's medium spacing. Decided by the maintainer on 2026-11-13. A page's tabs, such as Projects', sit there too, after the title, decided by the maintainer on 2026-11-13.
  - **Drawn by:** `PageHeader` in `apps/web/src/page-header.tsx`, with the switch, `ModeSwitch` in the same file, or a page's tabs, in its `beside`, and its height from the theme's `--fathom-heading-height` in `apps/web/src/theme.ts`; each page puts the gap after it.
  - **Example:** Table and Board beside the Features heading.

## Boards

- **A board:** A board shows a table's records another way, as cards: its columns are periods, such as one release stream's cycles, as many as fit, then Later, and its rows come from the Group by menu, starting with none. It sits under the same bar as the table, so the search, Draft menu, Metrics, Group by and Views work on it as on the table. Each column's heading names its period, a release in its [coloured box](#values), and the period's days; the current period's heading has a red line along its top, as today's line is red. Every line between headings, rows and cells is one thin line. While a side panel is open beside it, such as a record's details or Metrics, it keeps its columns and their widths, scrolling sideways under the panel, and fits the space again once the panel has gone. Introduced with the Features Board on 2026-11-13, for the maintainer's screen check.
  - **Drawn by:** `FeatureBoard` in `apps/web/src/feature-board-view.tsx`, drawn in place of the table by `RecordGrid`'s `body` in `apps/web/src/record-grid.tsx`, with its columns and card order from `apps/web/src/feature-board.ts`.
  - **Example:** the Board on Features.
- **A card:** A card shows its record's name, then the values the Card menu chooses, one to a line, its height following what it shows. Its draft is marked as a row's is: a dot before each value a draft changes, the record's own dot before its name for a draft of what the card doesn't show, with Moved for a move, and a tint beside live; a card a draft moves keeps a dimmed copy, after Live's green dot, in its old place. A warning, such as Not staffed, is red words on a line of its own, the size of Needed by, with no box. The card whose details are open is marked as a [selected row](#drafts) is. Introduced with the Features Board on 2026-11-13, for the maintainer's screen check.
  - **Drawn by:** `FeatureCard` and `LiveCard` in `apps/web/src/feature-board-view.tsx`.
  - **Example:** Scheduler API's card on the Features Board, with Not staffed.
- **From the keyboard:** A board's cards are one stop for Tab: the arrow keys move down and up a column, through its rows, and across to the nearest card in the next column of the same row; Enter or Space opens the card's details, and closing them puts focus back on the card. Introduced with the Features Board on 2026-11-13, for the maintainer's screen check.
  - **Drawn by:** `FeatureBoard` in `apps/web/src/feature-board-view.tsx`.
  - **Example:** on the Features Board, select Offline Sync, close its details, and press the Down arrow.
- **Menus above a board:** A choice of what the board shows that the table has no use for, such as its release stream or what its cards show, is a menu from an outlined button at the start of the strip's row, so the board adds only one row under the bar. As on Group by's button, the button names the choice in use, such as Stream: Platform, and the menu ticks it; a menu of parts to show, such as the Card menu, ticks each one shown and stays open while they're chosen. Each is kept in the address and in a saved view. Introduced with the Features Board on 2026-11-13, for the maintainer's screen check.
  - **Drawn by:** `AppMenu`, `MenuChoices` and `MenuToggle` in `apps/web/src/app-menu.tsx`, placed by `FeatureBoard` in `TimelineStrip`'s `before`.
  - **Example:** Stream: Platform and Card on the Features Board.

## Links to Records

- **A record with an ID:** Wherever a project or proposal is named, in a cell, a link, a picker or a filter, its ID comes first, dimmed in cells and links, then its name, so records with similar names are told apart. The title of its details panel does the same; notifications name it alone. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `RecordName` in `apps/web/src/project-grids.tsx`.
  - **Example:** P-2001 Crane Control.
- **Following a link:** A record named in a details panel is a link that opens that record's details, on its own page or tab, and the browser's back button goes back. A link from one page to a record on another, such as Show in People on the Org chart, opens that page with the record's details open, not only a search for it. A project or proposal named in a feature's details on Features opens on Projects in the same way, and Back returns to Features as it was. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `RecordLink` in `apps/web/src/record-details.tsx`.
  - **Example:** a customer in Offline Sync's details opens Projects' Customers tab with that customer's details.
- **Opening from a table:** A table's row opens its own record's details from the details button over its Name cell, or Show details in its menu, on every table, as [A row's controls](#tables) sets out; another record named in a cell, such as a stream's releases or a project's features, is a link that opens that record's details on its own page, as Following a link sets out. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `RowControls` in `apps/web/src/row-controls.tsx`, through the table's `showDetails` in `apps/web/src/record-grid.tsx`. Links in cells are not built yet.
  - **Example:** point at any row on People.
- **Several records in a cell:** A cell naming several records lists them in one line, cut short where they don't fit, with every name in its tooltip, one to a line; a details panel lists them one to a line.
  - **Drawn by:** the cell's kind in `apps/web/src/cell-kinds.tsx`, with the tip from `TableTips` in `apps/web/src/table-tips.tsx`, and `RecordLinkList` in `apps/web/src/record-details.tsx` in a panel.
  - **Example:** Crane Control's Features cell.

## History

- **An entry:** Each entry names who did what in a sentence, with details dimmed after a colon, newest first, with its day, year and time. An entry that deserves a second look ends in a grey Worth checking box, as a fact does, since a dot always means a draft, decided by the maintainer on 2026-11-14.
  - **Drawn by:** `EntryList`, `EntryRow`, `EntryDetails` and `WorthChecking` in `apps/web/src/history-entries.tsx`.
  - **Example:** the seeded rejections on the Change history page.
- **A change in words:** Wherever a change is described, in a record's menu, on the Drafts page or in the change history, the field is in semibold and each value is set apart on a light ground, as a value is in code.
  - **Drawn by:** `PhraseText` and `PhraseList` in `apps/web/src/phrase.tsx`.
  - **Example:** the seeded draft of the Level column, Name from Level to Grade, on the Drafts page.
- **A record's own history:** A history inside a record's details has a row for each change, newest first, a draft's first, after the draft's dot, each dated the day it was drafted, a date it keeps once approved. A row is never removed or struck through, since history is not undone.
  - **Drawn by:** `ScopeHistory` in `apps/web/src/scope-history.tsx`.
  - **Example:** Fleet Tracking Bid's scope history, where Report Builder was removed with a reason.

## Details Panels

- **Follow the Person panel:** Every record's details follow Person details: the record's name and draft mark at the top; headed sections of rows, each label beside its value while the panel is wide and over it once narrow, the labels in a column as wide as the section's longest, up to half the panel, so none wraps (decided by the maintainer on 2026-11-14); the columns an organization added under Columns. Each value that can be changed has a pencil at its right, named Change and the label, shown while its row is pointed at or has focus, or always on a screen that can't be pointed at; a click anywhere on the row, its label included, does the same, and the row is marked in the hover grey while pointed at. A panel never mixes in another layout, such as labels over form fields. Decided by the maintainer on 2026-11-11; the pencil shown on hover or focus decided on 2026-11-13.
  - **Drawn by:** `RecordSection`, `Row`, `changeButton` and `RecordLink` in `apps/web/src/record-details.tsx`, with `useRecordEditing` in `apps/web/src/record-editing.tsx` for the pencils, and `ValueField` there for a value typed in place, which a scope history's reason for a removal uses too.
  - **Example:** any seeded person's details beside People.
- **A long note:** A note in a record's details folds to about its first dozen lines, ending in a short fade, with Show more under it opening the note in its own panel, as it reads, read only for those who may not change it. A note that fits shows in full. The note's row has the button for opening beside, a box with its right side marked, shown as a pencil is, in place of a pencil. A panel with no note panel to open, such as a person's details shown for another day, shows the note in full in place, with Show less. Decided by the maintainer on 2026-11-14.
  - **Drawn by:** `FoldedNote` in `apps/web/src/folded-note.tsx`, on Mantine's `Spoiler`, with its fade's height from the theme's `--fathom-note-fade` in `apps/web/src/theme.ts`; the button by `OpenBesideButton` in `apps/web/src/row-controls.tsx`, which tables' details buttons share.
  - **Example:** Jarrod Mante's Onboarding note on People.
- **Columns follow the panel's order:** A table's default column order follows its details panel's sections and rows, and the other way round, defined once and used by both.
  - **Drawn by:** `featureColumnGroups` in `apps/web/src/project-grids.tsx`.
  - **Example:** Features, whose columns start Name, Status, Description, Notes, as its details' Details section does.
- **Actions on a list in a panel:** Actions on a list inside a details panel sit under the list, at its left, as outlined buttons without an icon, the main one first, so they sit where the next item would go and the list's heading stays a plain heading, as every other section's does. A picker that adds to the list, such as a feature team's Add member, is such an action: an outlined button under the list that opens the picker. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** no shared piece yet.
  - **Example:** today a project's details have Show milestones beside the Milestones heading, with no outline, and Add milestone under the list with a + before it; both move under the list, Add milestone first.

## Fields

- **An × to empty a field:** Every field typed into shows an × at its right to empty it while it holds any text, except those for passwords and on the Sign in page. Choosing the × keeps focus in the field. Decided by the maintainer on 2026-11-07. A table's cells aren't fields: Delete or Backspace empties one, so they show no ×, and neither do the choices in a list's panel, where Delete removes a choice. Decided by the maintainer on 2026-11-11. The fields that still have none are listed in issues [#460](https://github.com/jlarue26/fathom/issues/460) and [#478](https://github.com/jlarue26/fathom/issues/478).
  - **Drawn by:** `ClearableInput` in `apps/web/src/clearable-input.tsx`.
  - **Example:** Name in Offline Sync's details, once its pencil opens it.

## Choices

- **A choice with a description:** In a picker, a choice's description shows dimmed under its name, and typing finds a choice by its description too, ignoring letter case and accents, as [Finding rows](#search) does.
  - **Drawn by:** `ChoicePicker` in `apps/web/src/choice-picker.tsx`, which the feature team change gives descriptions.
  - **Example:** a cell's choices on People, once that change is merged and a choice has a description.
- **Choosing none:** A picker for a value that takes one choice and need not have one offers the column's word for an empty value, such as None, No manager or Later, as its first option, with a line under it, until something is typed. Nothing is highlighted until a key is pressed or an option pointed at, and once something is typed the first match is highlighted, so none is always in sight but Enter never picks it unasked. Choosing it empties the value. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `ChoicePicker` in `apps/web/src/choice-picker.tsx`, given the word through `cellKinds` in `apps/web/src/cell-kinds.tsx` from the column's `emptyLabel`, which the feature team change adds.
  - **Example:** on People, open a person's Manager cell: No manager is first.
- **The keyboard's option in a drop-down list:** The option the keyboard is on, which Enter would pick, is light grey in light mode and a dark grey in dark mode, the same as an option pointed at; never the accent colour, which looks like a choice already made. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** the theme, through `Combobox.extend` and `Select.extend` in `apps/web/src/theme.ts`, both giving their options the class in `apps/web/src/combobox.module.css`, which the feature team change adds, so every drop-down list, Select and table cell's choices follow it. A new kind of drop-down list from Mantine, such as `MultiSelect`, needs the same class in the theme.
  - **Example:** on Features, once that change is merged, open a Status cell's choices and press the Down arrow.
- **A switch's chosen side:** A switch between a page's views, such as the Org chart's Reporting teams and Feature teams, fills its chosen side with the accent colour, as a choice made is, never white on grey, which reads as turned off. Decided by the maintainer on 2026-11-14.
  - **Drawn by:** the theme, through `SegmentedControl.extend` in `apps/web/src/theme.ts`, so every switch follows it, `ModeSwitch` in `apps/web/src/page-header.tsx` included.
  - **Example:** the Org chart's switch.
- **The chosen one ticked:** A group of choices in a menu ticks the one chosen, read aloud as chosen, as in the Views menu's applied view. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `MenuChoices` in `apps/web/src/app-menu.tsx`.
  - **Example:** Hours ticked under Show in, in Effort's column menu.

## Access

- **A page without its data:** A page or view a role reaches, but whose classes of data the role can't see, or whose other data it can't read, is never shown cut down. A page that would show nothing isn't in the menu, and its address says there's no such page; a mode the role can't see isn't in the page's switch; and a view or grouping it can't see is left out with nothing said, as a column is. The Roles page keeps its lines saying what each view needs. Decided by the maintainer on 2026-11-13.
  - **Drawn by:** each page's needs in `pageNeeds`, and Capacity's modes' in `capacityModeNeeds`, with `opensWith` and `reaches`, in `packages/shared/src/page-access.ts`, which the sidebar's items in `apps/web/src/layout.tsx`, the routes in `apps/web/src/router.tsx` and `capacityModes` in `apps/web/src/capacity.ts` all read; the Roles page's lines from `viewsOfRole` in `packages/shared/src/data-classes.ts`.
  - **Example:** the Team Member, whose menu has neither Feature assignments nor Capacity; the Engineering Manager, whose Group by on Capacity offers Feature team and None; and the Product Manager, who sees Capacity's Settings alone.
- **Columns a role can't see:** A column a role can't see isn't shown, and nothing says it's missing. Decided by the maintainer on 2026-11-10.
  - **Drawn by:** a column's `dataClass` in `apps/web/src/table-view.ts`, read by `RecordGrid` in `apps/web/src/record-grid.tsx`.
  - **Example:** the Feature Lead's People has no Start or End.
- **A class's mark:** A column or list whose values belong to a class beyond General has its class's symbol, in grey, before its name, after a draft's dot if there is one: an eye with a line through it for Personal, and a lock with a keyhole for Confidential, unlike the plain lock of a record someone else is changing. Its tip is the class's name, which is read aloud after the item's name. A General item has none. Where a class is named in words, such as in the Data classes page's Class column or a line of a role's summary, the symbol comes before the name, General's an open eye. Only class names Fathom writes are marked, never words someone typed, such as a role's description. Decided by the maintainer on 2026-11-14.
  - **Drawn by:** `ClassMark` and `ClassName` in `apps/web/src/status-mark.tsx`, placed by `DraftedItem`'s `dataClass`, with the symbols from `apps/web/src/icons.tsx`.
  - **Example:** Start, End and Work pattern on People; Work patterns on the Lists page.
- **Changing a class:** Wherever it starts, Change class… opens one dialog, whose Change takes effect at once, never as a draft, and is changed back rather than undone, as [Data classes](../product/decisions.md#people-and-privacy) decides. On a list or column only drafted to be added, the same dialog changes its draft instead, which can be undone, decided by the maintainer on 2026-11-14. It turns off each class the data can't go to and says why, and the button itself is turned off, with why, for a role that can't see the class the data is in now, or while someone else has unpublished changes to the record. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `MoveClassModal`, `ClassChoice` and `showMoved` in `apps/web/src/move-class-dialog.tsx`.
  - **Example:** Change class… in the panel of Sites on the Lists page, as the Engineering Director.

## Words

- **The principles:** Every word on screen follows Visual Design's [Principles](visual-design.md#principles): words people say, never the second person, and no instructional text. The rule against instructions is for text always on screen: a refusal may say what to do next, such as Choose a manager, or leave Manager assigned empty, and a menu or dialog may state, in one short line, a fact needed at that moment, such as Nobody else sees these changes until they're published, but never how to use the control. On top of those, use the plain verb: added, removed, changed, retired, restored, never "comes off" or "taking off". Records and their drafts are removed, never deleted; delete is for what isn't a record, such as a saved view. A naming pattern reads in words, such as named by year and number, like 27.1, never as the pattern typed, such as {YY}.{N}. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** the words themselves, with `draftWords` and `DraftedWords` in `apps/web/src/status-mark.tsx` for drafts.
  - **Example:** Draft: removed.
- **Tips:** A tip of one phrase has no period, such as Also under Search; a tip of several sentences ends each with one. Decided by the maintainer on 2026-11-15.
  - **Drawn by:** the words themselves, shown by `TableTips` or `Tipped` in `apps/web/src/table-tips.tsx` on tables.
  - **Example:** on People, choose Feature teams in Group by, and point at the +1 after Lorenza Thiel's name.

## Entering Data

- **From the keyboard:** Wherever items are added or changed, everything works from the keyboard. Tab moves between fields, Enter saves and starts the next item, Esc cancels, and arrow keys move between items. Leaving an item by clicking or tabbing elsewhere saves it too, and pasting several lines adds one item for each. A record's parts, such as a project's milestones, are added from the record's details, or from their own table's New form, which asks which record they belong to. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `RecordGrid` in `apps/web/src/record-grid.tsx` for tables, and `apps/web/src/list-panel.tsx` for a list's choices.
  - **Example:** on the Lists page, select Sites and type a new choice in its empty row.
- **Like a spreadsheet:** Tables where many records are entered work like a spreadsheet. Arrow keys, Home, End and Tab move between cells, and Ctrl+Home and Ctrl+End go to the first and last. Enter, F2 or typing edits a cell; Enter saves and moves down, Tab saves and moves across, Esc cancels, and Delete clears. Pasting rows copied from a spreadsheet into an empty row adds one record for each.
  - **Drawn by:** `RecordGrid` in `apps/web/src/record-grid.tsx`.
  - **Example:** People, Features, and each table on Projects.
- **The empty row:** Empty rows at the end take new records, their cells blank until something is typed in one, so they aren't taken for records. A row being filled in is tinted as the draft it will be and marked by a hollow dot in its slot, whose tip and spoken words say New, not saved yet, and what is wrong so far or which required columns are still empty; what is wrong also shows in red after its first value. Its menu, also opened with Shift+F10, offers Clear row, which takes the row and what it holds away.
  - **Drawn by:** `RecordGrid` in `apps/web/src/record-grid.tsx`.
  - **Example:** type a name in the empty row at the end of Features.
- **Moving items:** Where people set an order, items have a grip for dragging on wide screens, shown on hover or focus, and Alt with the arrow keys moves the selected one. Its menu offers the same moves and shows each one's keys.
  - **Drawn by:** `apps/web/src/list-panel.tsx` for a list's choices, and the column menu in `apps/web/src/table-controls.tsx` for moving a column.
  - **Example:** the choices of Sites on the Lists page.

## Saving and Undo

- **Saved at once:** Changes save at once, without asking. The latest can be undone with Cmd+Z or Ctrl+Z, except in a field with something typed in it, the note editor included, where the keys undo the typing alone. Undo covers every kind of record, the plan's included, checked by the same rules approving uses. Changes seen in place show no notification. A change that takes something out of view, such as discarding the draft of a record only drafted to be added, or deleting a saved view, shows a notification at the top right offering Undo, which closes after a few seconds or when a newer change is made. Sharing a view, or stopping sharing it, shows one too, since nothing changes in view and it affects others. So does a change that takes a part of a record out of view, such as a team label a draft removes while Drafts applied is shown. Settings, which change Fathom for everyone, keep a Save button; once saved, the change shows in place with no notification, Cmd+Z or Ctrl+Z undoes it, and leaving with a change unsaved asks first. The planning settings on Capacity are the exception: each saves at once from its pencil, as a details panel's values do, as a draft, decided by the maintainer on 2026-11-11 and 2026-11-13. The plan's records, sharing a view, parts leaving view and settings decided by the maintainer on 2026-11-11. An account's name and email address are to save at once from their pencils too, as a details panel's values do, with no notification, and Cmd+Z or Ctrl+Z undoing them, decided by the maintainer on 2026-11-13; not built yet, since accounts are edited in a dialog with Save, as [issue #590](https://github.com/jlarue26/fathom/issues/590) records.
  - **Drawn by:** `useSaving` and `isUndo` in `apps/web/src/saving.ts`, and `notifyUndoable` in `apps/web/src/notices.tsx`.
  - **Example:** on People, save a view, then delete it.
- **Asking first:** Of changes to data, only approving drafts, rejecting them, Discard all…, and deleting a saved view its maker can no longer use ask first, since they can't be undone, the last because its change history holds what the maker's role can't see, decided by the maintainer on 2026-11-14; leaving unsaved work asks too, as [Leaving Unsaved Work](#leaving-unsaved-work) sets out, and so does exporting Personal or Confidential data, as [Exporting](#exporting) sets out. Each confirms what was done in a notification without Undo, such as Approved 3 drafts, since it takes drafts out of view. Decided by the maintainer on 2026-11-11. Changes to who may sign in, and to what they may do, ask first too, and confirm what was done in a notification without Undo: saving a change to a role that alters what the accounts holding it may do, whose question lists what each account gains and loses; changing an account's roles; resetting a password; and deactivating or reactivating an account. Decided by the maintainer on 2026-11-13; changing an account's roles doesn't ask yet, as [issue #590](https://github.com/jlarue26/fathom/issues/590) records.
  - **Drawn by:** `DecisionModal` in `apps/web/src/decision-dialog.tsx`. The role's confirmation, in `apps/web/src/roles-page.tsx`, the account's, in `apps/web/src/accounts-page.tsx`, and deleting a saved view, in `apps/web/src/saved-views.tsx`, are drawn by their own dialogs for now.
  - **Example:** Approve… in a seeded person's draft menu on People.
- **Failures:** A change that fails says so in plain words, saying what to do next, never as a raw error, and its notification stays until closed. The record goes back to how it was.
  - **Drawn by:** `notifyFailure` in `apps/web/src/notices.tsx`, with the words from `describeProblem` in `apps/web/src/api.ts`.
  - **Example:** none in the seed data; a lost connection while saving shows one.
- **A page that can't load:** A page, or a part of one, whose data can't be loaded says so in plain words in its place, with Try again. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `LoadProblem` in `apps/web/src/load-problem.tsx`.
  - **Example:** none in the seed data; stopping the server while a page loads shows one.

## Leaving Unsaved Work

- **Asking before discarding:** Leaving a form, a note, or a Settings panel with anything changed in it, by Cancel, the close button, another tab or another record, asks first, such as Discard the new customer? with Keep adding and Discard, or Discard changes to the note? with Keep writing and Discard. The question always starts with Discard and names what is lost, such as Discard the fill of TBD-3? A dialog with anything typed in it is a form here. Decided by the maintainer on 2026-11-11. A form can't be left while its record is being added, and a dialog can't be closed while a change is being saved.
  - **Drawn by:** `useDiscardQuestion` and `newRecordQuestion` in `apps/web/src/discard-question.tsx`.
  - **Example:** on Projects' Customers tab, select New customer, type a name, then Cancel.

## Refusals

- **A value refused:** A value refused when saved, by the page or by the server, keeps its editor open with what was typed, outlined in red, with the reason in red under it, so nothing is lost, in tables, panels and dialogs alike; in a table, the reason is under the row, in its first cell, and in a dialog, under the field it's about, or at the foot when it's about no one field. Esc leaves the value as it was. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `useRecordEditing` in `apps/web/src/record-editing.tsx` for a panel, and `RecordGrid` in `apps/web/src/record-grid.tsx` for a table.
  - **Example:** type 203013 in a Needed by cell on Features: Needed by: use a month such as 2027-03.
- **Controls turned off:** A control for a change the server would refuse is turned off, with a line saying why wherever the reason isn't plain to see. A control the reader might expect, such as Fill on a planned hire or New under Live only, is turned off with its reason rather than hidden; a control is hidden only when the role can never use it. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** each page; no shared piece yet.
  - **Example:** in a list with meanings, such as Feature statuses, Retire and Remove are greyed out on the only choice that means Possible, with a line saying why.
- **Menu buttons:** A menu of actions on one thing opens from a ⋯, named "Actions for" the thing, such as Actions for Fictional Major. A ⋯ opening something else is named for what it opens, such as Unpublished changes.
  - **Drawn by:** `MoreButton`, named through `actionsFor`, in `apps/web/src/row-controls.tsx`.
  - **Example:** on Lists, the ⋯ beside each list.

## Tables

- **A row's controls:** While a table's row is pointed at, or its Name cell has focus, two buttons show at the right of the Name cell: the details button, a box with its right side marked, as the details open beside the table, on a table whose records have details; and a ⋯ that opens the row's menu, so it's in reach without scrolling to the row's end. The ⋯ at the row's end stays, always shown. A right-click anywhere on the row opens the same menu beside the pointer, except in a cell being typed in, which keeps the browser's own; Shift+F10 and the menu key open it from the keyboard. A record's menu offers Show details, where it has details. There is no row header at the left: the slot before the first value keeps the draft's dot. Decided by the maintainer on 2026-11-13, settling [issue #485](https://github.com/jlarue26/fathom/issues/485).
  - **Drawn by:** `RowControls` and `MoreButton` in `apps/web/src/row-controls.tsx`, placed by `RecordGrid` in `apps/web/src/record-grid.tsx` in the column its table names as `nameColumn`, with the record's details from the table's `showDetails`.
  - **Example:** on People, point at any row, or right-click its Start cell.
- **Moving columns:** Every table's columns can be moved, as [Column order](../product/decisions.md#configuration) sets out. A new table is drawn by the shared table, so its columns move too.
  - **Drawn by:** `RecordGrid` in `apps/web/src/record-grid.tsx`.
  - **Example:** on Features, select Move left in the Priority column's menu.
- **Hiding columns:** Every table's columns can be hidden, as [Hidden columns](../product/decisions.md#configuration) sets out, from Hide column in each column's menu, with Freeze up to this column and the width items, and shown again from the Views menu. A new table is drawn by the shared table, so its columns hide too. Decided by the maintainer on 2026-11-14.
  - **Drawn by:** `RecordGrid` in `apps/web/src/record-grid.tsx`, with the view's hidden columns kept by `withHidden` in `apps/web/src/table-view.ts` and listed by `ViewsMenu` in `apps/web/src/table-controls.tsx`.
  - **Example:** on People, select Hide column in the Site column's menu, then Site under Hidden in the Views menu.
- **Filtering a column:** Every column's filter that offers its empty values, such as Empty, No date or No number, offers every value that isn't empty under it, in the same style: Not empty, or Any date and Any number to match No date and No number, and on a choice column Not empty after Empty, under the choices in use. Ticking one unticks the other, since both would show every row. Every filter's pill names its column, a colon, then what it filters by, in the filter's own words for empty values, such as Onboarding: contains “plan” or Empty, and Start: from Mar 1, 2024 or No date. Not empty shows every row with a value, whatever else the filter holds, so its pill names it alone, such as Onboarding: Not empty. A checkbox column, never empty, offers none. Decided by the maintainer on 2026-11-14.
  - **Drawn by:** `FilterForm` and `describeFilter` in `apps/web/src/table-controls.tsx`, with the match in `apps/web/src/table-view.ts` and the filter's `notEmpty` in `packages/shared/src/views.ts`.
  - **Example:** on People, tick Not empty in the Onboarding column's filter.
- **What the Views menu holds:** Beside the sort, saved views and Clear view, the Views menu may hold a choice of which records the table shows, beyond its filters, such as Show retired: a ticked item, first in the menu, kept in the address and saved with the view. Its words say how many records it adds, such as Show retired (1). A page's modes and switches stay where they are. Decided by the maintainer on 2026-11-13.
  - **Drawn by:** each page's declared choices, a `ViewChoice` from `apps/web/src/table-controls.tsx` given as `RecordGrid`'s `viewChoices` in `apps/web/src/record-grid.tsx`, shown by `ViewsMenu` as a `MenuToggle` from `apps/web/src/app-menu.tsx`, and named in Save view's Includes by `viewParts`.
  - **Example:** Show retired (1) in the Views menu on Releases, once Patches' retirement is approved.
- **Saved views on every page:** Every page with saved views gets them from one hook, which reads the table's views, saves, renames, updates, shares and deletes them, and draws the Save view and Rename view dialogs, so no page has its own. A personal view the user's role can no longer use is dimmed under My views with what it's missing, offering Rename… and Delete… alone. Decided by the maintainer on 2026-11-14.
  - **Drawn by:** `useSavedViews` in `apps/web/src/saved-views.tsx`, given to `RecordGrid` as `saved`, with the views in `ViewsMenu` in `apps/web/src/table-controls.tsx` and the naming dialog `ViewDialog` in `apps/web/src/view-dialog.tsx`.
  - **Example:** on Releases, type Patches in the search box and choose Save view… in the Views menu.
- **Group by's own grouping:** A table's Group by menu starts with the table's own grouping, such as Cycle on Features, and choosing it again leaves nothing in the address. A table with no grouping of its own, such as People, and a view that shows the same records another way, such as a board, start with none instead, which the menu then lists first, and a board keeps a grouping chosen in its table where both offer it. Introduced with the Features Board on 2026-11-13, for the maintainer's screen check; People's decided by the maintainer on 2026-11-14. While nothing is grouped, the menu's button reads Group by alone, naming no grouping, rather than Group by: None. Once either level differs from the table's own grouping, Clear grouping, set apart at the end of the menu as Clear view is in the Views menu, puts both back. Both decided by the owner on 2026-11-15.
  - **Drawn by:** the `groupings` and `ungrouped` of a table in `apps/web/src/record-grid.tsx`, read by `activeGrouping` in `apps/web/src/table-view.ts` and the Group by menu in `apps/web/src/table-controls.tsx`.
  - **Example:** on Features, choose Feature team in Group by, then switch to Board: the rows are feature teams.
- **A record under several headings:** Grouped by a column holding several values, a record has a row under each of its values, each its own row for focus and the keyboard, and a dimmed +1, or +2 and on, after its name, its tip naming the other headings, such as Also under P-2014 Fleet Telemetry; grouped by two levels, it names each other place by the groups it differs in, both as the first, a colon and the second, such as Also under Priya Raman: Northmere. Closing a record's details puts focus on its cell in the row last used, or else its first. Decided by the owner on 2026-11-14.
  - **Drawn by:** `RecordGrid`, with `AlsoUnder` and `focusRecordCell`, in `apps/web/src/record-grid.tsx`; a grouping's `of` gives a record's groups, and `byChoice` in `apps/web/src/choice-grouping.ts` a group for each choice; the Features Board's cards use the same `AlsoUnder`, and `focusCard` in `apps/web/src/feature-board-view.tsx`.
  - **Example:** on Features, choose Projects in Group by: a feature two projects need shows under both, each row marked +1. On People, choose Feature teams: Lorenza Thiel shows under Payments core and Search.
- **Grouping under each heading:** Once rows are grouped, Then by, under its own label after Group by's choices in the same menu, groups them again under each heading, and the menu's button names both, such as Group by: Manager, then Site, so the second level takes no room of its own in the bar. Its headings sit under their first-level heading, set in, smaller and lighter, each counting its own rows, and a second-level group a heading has no rows in isn't shown. A page that draws its rows another way, such as a board, or whose rows are made for their grouping, such as the month grids, offers no Then by. Decided by the owner on 2026-11-14.
  - **Drawn by:** `GroupingMenu` in `apps/web/src/table-controls.tsx`, the view's `thenBy` read by `activeThenBy` in `apps/web/src/table-view.ts`, and the headings by `RecordGrid` in `apps/web/src/record-grid.tsx`, with a table's `oneLevel` for rows made for their grouping.
  - **Example:** on People, choose Manager in Group by, then open the menu again and choose Site under Then by.

## Staying Put

- **Nothing moves while it's being changed:** A row keeps its place and its group while it is edited, until the view next changes, so a sorted or filtered table doesn't jump. No column's width follows what is typed, and a line that comes and goes keeps its space while empty.
  - **Drawn by:** `RecordGrid` in `apps/web/src/record-grid.tsx`, and `apps/web/src/date-control.tsx` for the line under the date row.
  - **Example:** on Features, change Report Builder's Target cycle: it stays under its heading until the page is reloaded.

## The Address

- **Kept in the address:** Everything a page shows is kept in its address: the tab, the mode, the view (its search, filters, sort, groupings, metrics, frozen columns, column order, hidden columns, widths and units), the record shown in a panel, an open form, such as New or Fill, a note's panel, and the date shown. So reloading shows the same, a link shared shows it to others who may see it, and the browser's Back goes back through what was shown. A dialog isn't kept. A page opened from the menu starts afresh. Changing the date shown adds to Back's history, as moving to another page does, and so does any other choice of what to show, such as a switch or Show retired; typing in a search replaces it. A chart's zoom and pan aren't kept, and neither is a selection of rows, such as drafts chosen to approve. Forms, notes, dialogs, the date, zoom, switches and selections decided by the maintainer on 2026-11-11.
  - **Drawn by:** each page's search parameters in `apps/web/src/router.tsx`, with a table's view in `apps/web/src/table-view.ts`.
  - **Example:** on Projects, select the Customers tab and reload.
- **The Org chart's address:** The Org chart keeps feature teams as `teams=feature`, the levels shown as `levels`, a count from the top or `all`, and the team shown alone as `team`, by the manager's Fathom ID. Older addresses still open as they did: `view=feature-teams` opens Feature teams, and a team named by its manager's Employee ID opens that team. Decided by the owner on 2026-11-15.
  - **Drawn by:** the Org chart's search parameters in `apps/web/src/router.tsx`, with its view in `packages/shared/src/view-tables.ts`.
  - **Example:** on the Org chart, choose Feature teams and 3 levels, and reload.
- **Back to another page:** The browser's Back is the way back. A Back to button is offered only where Fathom itself jumps to another page.
  - **Drawn by:** no shared piece yet.
  - **Example:** none yet.
- **Kept in this browser:** A person's own settings for how Fathom looks are kept in the browser, not the address: Light or Dark, the collapsed sidebar, side panel widths and shares, the timeline's zoom, and, remembered by the server for each browser, the role last acted as.
  - **Drawn by:** the piece that owns each, such as `apps/web/src/side-panel.tsx` for panel widths.
  - **Example:** on the Releases page, choose Quarter on the timeline and reload.

## Panels and Focus

- **Opening and closing:** Choosing a record opens its details in a side panel, at its own address. Esc, the close button, or a click on the page outside the panel, the rows and the controls closes it. On a narrow screen, the panel covers the screen and keeps focus until it is closed. A panel listing records, such as the Org chart's Teams, is a side panel at its own address too, never a drawer. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `WithSidePanel` and `SidePanelFrame` in `apps/web/src/side-panel.tsx`.
  - **Example:** Offline Sync's details on Features.
- **Focus goes where expected:** Opening a panel or dialog puts focus on its first thing to read or change, such as the record's name. Closing it puts focus back where it was opened from, such as the record's Name cell. Choosing the × in a field keeps focus in the field. A value opened for changing in a details panel opens with its text selected, so typing replaces it.
  - **Drawn by:** `focusSoon` and `selectSoon` in `apps/web/src/focus.ts`, with `SidePanelFrame` in `apps/web/src/side-panel.tsx`.
  - **Example:** close Offline Sync's details: focus is back on its Name cell.

## Publishing

- **Private until published:** A person's changes are theirs alone until they publish them. While they have any, the top bar shows Publish with how many, such as Publish 3 changes, which publishes them all and confirms it in a notification without Undo, such as Published 3 changes., beside a menu listing them, with Discard all…, which asks first. Decided by the maintainer on 2026-11-11. A record someone else is changing is held, as [Drafts](#drafts) sets out.
  - **Drawn by:** `UnpublishedControl` in `apps/web/src/unpublished.tsx`.
  - **Example:** change any value on Features: Publish 1 change shows in the top bar.

## Exporting

- **Exporting what a table shows:** A page whose table can be exported has an Export icon in its heading, before its main action, opening CSV file and TSV file. The file holds what the view shows, drafts and their Live rows included, as the [Decisions Log](../product/decisions.md#platform-and-operations) sets out. An export holding Personal or Confidential data asks first, naming each class in its colour and its columns, and is recorded once confirmed. Decided by the maintainer on 2026-11-11.
  - **Drawn by:** `PageExportMenu` and `useOfferedExport` in `apps/web/src/page-export.tsx`, the table's `exported` in `apps/web/src/record-grid.tsx`, `ExportQuestion` in `apps/web/src/export-question.tsx`, and the file from `apps/web/src/exports.ts`.
  - **Example:** on People, as the Engineering Director, choose the Export icon, then CSV file.

## Search

- **Finding rows:** A search field above a table finds rows with every word typed anywhere in them, ignoring letter case and accents. Cmd+F on a Mac, or Ctrl+F elsewhere, goes to it from anywhere but a dialog, and Esc clears it, then leaves it, going back to the table where it can. When nothing matches, the table says so. The Org chart's finder follows the same keys: Cmd+F or Ctrl+F goes to it, and Esc clears it. Decided by the maintainer on 2026-11-11. Typing in any drop-down list, such as the Org chart's finder, finds options the same way, decided by the maintainer on 2026-11-14.
  - **Drawn by:** `TableSearch` in `apps/web/src/table-controls.tsx`; in a drop-down list, the `byWords` filter every `Select` takes from `apps/web/src/theme.ts`, which any other searchable Mantine list, such as `MultiSelect` or `Autocomplete`, needs too.
  - **Example:** type offline in the search field on Features.
