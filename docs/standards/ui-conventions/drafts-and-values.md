---
title: "UI Conventions: Drafts, Values and Access"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["apps/web/**", "docs/testing/**"]
dependencies: ["docs/standards/ui-conventions.md", "docs/design/visual-design.md"]
last_updated: "2026-11-19"
---

# Drafts, Values and Access

Part of [UI Conventions](../ui-conventions.md): how drafts, values and data classes are marked, and what a role without access sees. Each entry gives the rule, the shared piece that draws it, and an example from the [fictional data](../../design/development-setup.md#fictional-data).

## Drafts

- **A draft's dot:** A draft is marked by its dot alone, always before the record, value or part it marks: yellow while it waits for approval, hollow while it holds the user's own unpublished changes, and red in a ring once rejected, so it's told apart by its shape as well as its colour. No words such as Draft or Draft: added sit beside it. Its tip, also read aloud, says what the draft does, such as Draft: added, what a value was, when it takes effect and who made it, where those are known, and a rejection's reason last, such as Rejected, added: and the reason. A record's menu is the one place the draft's words follow its dot, as the heading of the draft's details.
  - **Drawn by:** `DraftedItem` in `apps/web/src/status-mark.tsx`, with the words from `draftWords` and `draftTip`, and the menu's heading from `apps/web/src/draft-details.tsx`.
  - **Example:** Vianney Rousseau, drafted to be added, and Ophélie Roussel, whose addition was rejected, on People.
- **What a dot can't say:** Moved, Reordered, Retired and Restored are a small yellow box after the item, on a draft still waiting. A fact about an item is a box after it too: grey for Built in, for Planned, expected and its month, and for a schedule's Ended, and red for a warning, such as Left. A warning with no value before it, such as No team, is red words with no box, as [Warnings on a value](#values) sets out. Facts come before the draft's box, since a fact says what the item is and the draft's box what is about to happen to it. A dot always means a draft's state, never a fact.
  - **Drawn by:** `DraftedItem`, `FactBox` and `MarkedItem` in `apps/web/src/status-mark.tsx`; a schedule's Ended by `EndedBox` there too.
  - **Example:** Languages on the Lists page, then its Retired box; Viktoria Holmberg's Left on People.
- **The lock:** A record someone else has unpublished changes to has a grey lock before it, its tip Being changed by and their name, and is read only until they publish or discard them. Its menu says the same, and that it can be changed once they do.
  - **Drawn by:** `DraftedItem`'s `heldBy` in `apps/web/src/status-mark.tsx`, with the menu's words from `apps/web/src/draft-details.tsx`.
  - **Example:** Viktoria Holmberg on People, held by the second Engineering Operations Manager.
- **A summary row:** A table of records with few columns, such as the Lists page's lists, draws each record's row, its Live row under it beside live, and a cell naming its parts, such as a list's choices, the same way.
  - **Drawn by:** `SummaryRow`, `PartsCell` and `LivePartsCell` in `apps/web/src/summary-row.tsx`. On the shared table, a cell naming a record's parts draws them with `Parts` and `LiveParts` there, marking each part itself, though no shared table names a record's parts at present.
  - **Example:** Sites on the Lists page.
- **A row's slot:** Each row of a table, of the Lists page, of a list's panel, of Releases and of the Drafts page starts with a slot of two places, kept even when empty: the record's own mark first, then the dot of its first value where a draft changes that, which hangs back into the slot, so every row's first value starts at the same place and a changed name never looks set in under the row above. A class's symbol, where a record has one, follows the slot and comes before the first value, as [A class's mark](#access) sets out. The record's own mark shows only where its draft changes something the row doesn't show, such as adding, removing, retiring or moving it; a draft that changes only values the row shows leaves the slot empty, since each of those values has its own dot, so two dots never sit side by side.
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
- **Retiring:** A list, choice or schedule drafted to be retired or restored stays where it is until approved, with its dot and a Retired or Restored box. Retired records show only when asked for. Drafting a retirement or a restore is a change seen in place, so it shows no notification, and Cmd+Z or Ctrl+Z undoes it.
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
- **A table of drafts:** On the Drafts page, whose every row is a draft, the dot in a row's slot is the row's only mark: no tints, semibold, strike-through or Live rows, and the row isn't read aloud as a draft, since every row is one. A recorded exception to Tints and A removal.
  - **Drawn by:** a table's `slotMarksOnly` in `apps/web/src/record-grid.tsx`.
  - **Example:** Salvador Quiñones Méndez's removal on the Drafts page's All drafts tab, its name not struck through.
- **The three Draft views:** The Draft menu's choice decides every mark on the page, in one place. Drafts & Live shows everything above. Drafts applied shows the dots and strike-throughs, leaving out rejected drafts, which it shows taken back, with no tints, semibold or Live rows. Live only shows no draft dots or tints, but a green dot on each record, value or part a waiting draft would change, its tip naming the change, such as "Live. A change is waiting for approval." A rejected draft gets none. Locks and warnings show in every view. Each mark is given its item's own draft, whatever the view.
  - **Drawn by:** `DraftView` and `DraftedItem` in `apps/web/src/status-mark.tsx`, with `viewedDraft` and `liveWaitingWords`; each page sets its view once.
  - **Example:** on People, choose Live only in the Draft menu: the Level column's name has a green dot.
- **A selected row:** A selected row, such as the list whose panel is open, has the hover grey with a thin accent bar at its left edge, never the accent's fill, since a row's fill says its draft's state.
  - **Drawn by:** `selectedRow` in `apps/web/src/pages.module.css`.
  - **Example:** select Sites on the Lists page.
- **Centring:** Every mark, dot, lock or box, and a colour's swatch beside text, is centred on the centreline of its text's capitals, and a line holding them lines them up on its text's baseline, with the marks' own spacing the only spacing. A swatch alone, such as a menu item's icon, is centred in its place instead.
  - **Drawn by:** `dotPlace`, `kind` and `swatchPlace` in `apps/web/src/status-mark.module.css`, `MarkRow` in `apps/web/src/status-mark.tsx`, and `Swatch` in `apps/web/src/colour-swatch.tsx`.
  - **Example:** any dot before a name on People.
- **A draft from another day:** Where a draft takes effect from a day other than the one shown, the item is followed in grey by from and the day, such as from Dec 1, 2026. An org chart card has too little room, so its From and the day sit on a line of their own under the name, a recorded exception.
  - **Drawn by:** the `from` of `DraftedItem`, and the card in `apps/web/src/org-chart-page.tsx`.
  - **Example:** on the Org chart, move to next month and add someone to a feature team.

## Values

- **Live values:** Live means approved. A live value shown beside its draft is dimmed, after a green dot, and opens nothing, as [Drafts](#drafts) sets out.
  - **Drawn by:** `LiveLine` and `LiveValue` in `apps/web/src/status-mark.tsx`.
  - **Example:** the light green Live row under a seeded person's drafted change on People.
- **Read-only values:** A value that follows from another is read only, shows no pencil, and ignores what is pasted into it. Those who may not change a record see its values with no pencils and no empty row.
  - **Drawn by:** a column's `readOnly` in `apps/web/src/record-grid.tsx`, and `Row` without `editing` in `apps/web/src/record-details.tsx`.
  - **Example:** Release on Features, which follows from Target cycle.
- **Empty values:** An empty cell is blank, unless a warning stands in its place, as [Warnings on a value](#values) sets out. In a details panel, an empty value reads None, dimmed, or the column's own word for empty, and so does an empty list in a panel, such as a project with no milestones. Where a draft empties a value, or fills an empty one, the empty side reads its words for none in grey italics, such as No start, in tables and panels alike.
  - **Drawn by:** `Row` in `apps/web/src/record-details.tsx`, with the column's `emptyLabel`.
  - **Example:** Voice Notes' Target cycle reads Later in its details.
- **Values Fathom fills in:** An empty cell Fathom fills in from other values shows that text in grey italics, and editing it starts empty.
  - **Drawn by:** `apps/web/src/record-grid.tsx`, with the org chart and the Teams panel drawing their own.
  - **Example:** a seeded planned hire with no name, named by its position and ID on People.
- **Warnings on a value:** A warning about a value is a red box after it, in words, such as Left, read aloud with why. It shows in every Draft view. A warning with no value before it, in an empty cell or on a line of its own, such as No team in a Feature team cell or Not staffed on a card, is its words in red in the value's place, with no box, read aloud the same way. Box and words take a red dark enough to read on a draft's tinted row. A status a value is in, such as Over and Under on Capacity, isn't a warning: it shows in words, with its figures in a tooltip, and isn't read aloud with why.
  - **Drawn by:** `MarkedItem` with the `warning` tone, in `apps/web/src/status-mark.tsx`, with `empty` for a warning in an empty value's place.
  - **Example:** No team, in Scheduler API's Feature team cell.
- **Values in units:** An amount shows its unit's code in a table, such as 2.5 PD, and spells the unit out in a panel, such as 2.5 person-days (20 hours). Totals of one unit, such as the capacity totals on Capacity's People, name it once, by its code, in their heading, such as Total, PM.
  - **Drawn by:** `EffortCell` in `apps/web/src/effort-cell.tsx`, and `inUnitsWords` in `apps/web/src/record-details.tsx`; the capacity totals by `CapacityTotal` in `apps/web/src/allocation-months.tsx`, with the units' words from `unitWords` in `apps/web/src/effort.ts`.
  - **Example:** Audit Export's Effort.
- **A size:** A feature's [Size](../../design/domain-model.md#built-in-lists) is the word Size and a block for each S it weighs, blue-grey, from faint to strong against the page by position, so light to dark on a light page and dark to light on a dark one, four blocks filling the space given, such as a card's width or a row's label. It is never a bar on a track, which reads as progress, and never green to red, which would borrow red's meaning of a problem. The same mark shows on cards, in the panel, in a timeline's row labels and in group headings. Its value, such as M, 2 × S, shows on hover, is read aloud, and shows in the panel.
  - **Drawn by:** `SizeMark` in `apps/web/src/planning-marks.tsx`, with its blue-greys from the theme's `--fathom-size-1` to `--fathom-size-4` in `apps/web/src/theme.ts`.
  - **Example:** Offline Sync's card on the Features Board.
- **A risk:** A feature's [Risk](../../design/domain-model.md#built-in-lists) is the word Risk and a segment for each step of its list, green to red by the list's order, filling the space given, lined up under the Size mark. Its value shows on hover, is read aloud, and shows in the panel.
  - **Drawn by:** `RiskMark` in `apps/web/src/planning-marks.tsx`.
  - **Example:** Offline Sync's card on the Features Board.
- **A coloured name:** A team or release named with its colour is the draft's dot, if it has one, then its colour's square, then its name, wherever the name is shown: in tables, details panels, the Features Board's headings, the month grids, menus, pills and timeline labels. No name is shown in a box tinted with its colour, anywhere. Colour as drawing stays: a timeline's spans and diamonds, and a card's top edge. The grey and red boxes of a fact, such as Not staffed, aren't coloured names, and stay. An empty value shows no square.
  - **Drawn by:** `ColouredName` in `apps/web/src/colour-swatch.tsx`; in a table, a column's `colour` in `apps/web/src/record-grid.tsx`, and in a panel, `Row`'s `colour`, with `liveColour` for its live value, in `apps/web/src/record-details.tsx`.
  - **Example:** Mobile apps in the Org chart's list of feature teams, or a manager's Team name on People.

## Access

- **A page without its data:** A page or view whose data a role can't see or read is never shown cut down. Nothing is shown blurred, rounded or replaced instead.
  - **A page:** one that would show nothing isn't in the menu, and its address says there's no such page.
  - **A mode:** one the role can't see isn't in the page's switch.
  - **A view or grouping:** one the role can't see is left out with nothing said, as a column is.
  - **Following the classes:** what a page needs follows its data's classes, so moving a detail's class opens or closes pages with no code change. The Roles page keeps its lines saying what each view needs.
  - **Drawn by:** each page's needs in `pageNeeds`, and Capacity's modes' in `capacityModeNeeds`, with `opensWith` and `reaches`, in `packages/shared/src/page-access.ts`, which the sidebar's items in `apps/web/src/layout.tsx`, the routes in `apps/web/src/router.tsx`, `apps/web/src/signed-in-route.tsx` and `apps/web/src/plan-routes.tsx`, and `capacityModes` in `apps/web/src/capacity.ts` all read; the Roles page's lines from `viewsOfRole` in `packages/shared/src/data-classes.ts`.
  - **Example:** the Team Member, whose menu has neither Feature assignments nor Capacity, and the Product Manager, who sees Capacity's Settings alone.
- **Columns a role can't see:** A column a role can't see isn't shown, and nothing says it's missing.
  - **Drawn by:** a column's `dataClass` in `apps/web/src/table-view.ts`, read by `RecordGrid` in `apps/web/src/record-grid.tsx`.
  - **Example:** the Feature Lead's People has no Start or End.
- **A class's mark:** A column or list whose values belong to a class beyond General has its class's symbol, in grey, before its name, after a draft's dot if there is one: an eye with a line through it for Personal, and a lock with a keyhole for Confidential, unlike the plain lock of a record someone else is changing. Its tip is the class's name, which is read aloud after the item's name. A General item has none. Where a class is named in words, such as in the Data classes page's Class column or a line of a role's summary, the symbol comes before the name, General's an open eye. Only class names Fathom writes are marked, never words someone typed, such as a role's description.
  - **Drawn by:** `ClassMark` and `ClassName` in `apps/web/src/status-mark.tsx`, placed by `DraftedItem`'s `dataClass`, with the symbols from `apps/web/src/icons.tsx`.
  - **Example:** Start, End and Work pattern on People, with Compensation band and Performance rating marked Confidential; Work patterns and Compensation bands on the Lists page.
- **Changing a class:** Wherever it starts, Change class… opens one dialog, as [Data Classes](../../design/pages/administration.md#data-classes) sets out.
  - **Takes effect at once:** never as a draft, and is changed back rather than undone. A move is recorded in the access history, marked worth checking, and a list's or column's in the change history too.
  - **A list or column only drafted to be added:** the same dialog changes its draft instead, which can be undone. Drafts and the change history name a class beyond General with the addition, such as Class Confidential, and it is recorded as a move once approved, naming the Approver.
  - **Turned off:** the dialog turns off each class the data can't go to and says why. The button itself is turned off, with why, for a role that can't see the class the data is in now, or while someone else has unpublished changes to the record.
  - **Drawn by:** `MoveClassModal`, `ClassChoice` and `showMoved` in `apps/web/src/move-class-dialog.tsx`.
  - **Example:** Change class… in the panel of Sites on the Lists page, as the Engineering Director.
