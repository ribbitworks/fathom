---
title: "UI Conventions: Drafts, Values and Access"
category: "Standards"
audience: "Contributors"
applies_to: ["apps/web/**", "docs/testing/**"]
dependencies: ["docs/standards/ui-conventions.md", "docs/design/visual-design.md"]
last_updated: "2026-11-23"
---

# Drafts, Values and Access

Part of [UI Conventions](../ui-conventions.md): how drafts, values and data classes are marked, and what a role without access sees. Examples come from the [fictional data](../../design/development-setup.md#fictional-data).

## Drafts

- **A draft's dot:** A draft is marked by its dot alone, always before the record, value or part it marks. No words such as Draft or Draft: added sit beside it.
  - **Its states:** The dot is yellow while waiting for approval, hollow while it holds the user's own unpublished changes, and red in a ring once rejected, so shape tells it apart as well as colour.
  - **Its tip:** Its tip, also read aloud, says what the draft does, such as Draft: added. Where known, it also says what a value was, when the draft takes effect and who made it. A rejection's reason comes last, such as Rejected, added: and the reason.
  - **In a record's menu:** Only in a record's menu do the draft's words follow its dot, as the heading of the draft's details.
  - **Drawn by:** `DraftedItem` in `apps/web/src/status-mark.tsx`, with the words from `draftWords` and `draftTip` in `apps/web/src/draft-marks.ts`, and the menu's heading from `apps/web/src/draft-details.tsx`.
  - **Example:** Vianney Rousseau, drafted to be added, and Ophélie Roussel, whose addition was rejected, on People.
- **What a dot can't say:** On a draft still waiting, Moved, Reordered, Retired and Restored are a small yellow box after the item. A dot always means a draft's state, never a fact.
  - **Facts:** A fact about an item is also a box after it: grey for Built in, for Planned, expected and its month, and for a schedule's Ended; red for a warning, such as Left. A warning with no value before it, such as No team, is red words with no box, as [Warnings on a value](#values) sets out.
  - **Their order:** Facts come before the draft's box: a fact says what the item is, the draft's box what is about to happen to it.
  - **Drawn by:** `DraftedItem`, `FactBox` and `MarkedItem` in `apps/web/src/status-mark.tsx`; a schedule's Ended by `EndedBox` there too.
  - **Example:** Languages on the Lists page, then its Retired box; Viktoria Holmberg's Left on People.
- **The lock:** A record someone else has unpublished changes to has a grey lock before it, its tip Being changed by and their name. It is read only until they publish or discard them. Its menu says the same, and that it can be changed once they do.
  - **Drawn by:** `DraftedItem`'s `heldBy` in `apps/web/src/status-mark.tsx`, with the menu's words from `apps/web/src/draft-details.tsx`.
  - **Example:** Viktoria Holmberg on People, held by the second Engineering Operations Manager.
- **A summary row:** A table of records with few columns, such as the Lists page's lists, draws each record's row, its Live row under it beside live, and a cell naming its parts, such as a list's choices, the same way.
  - **Drawn by:** `SummaryRow`, `PartsCell` and `LivePartsCell` in `apps/web/src/summary-row.tsx`. On the shared table, `Parts` and `LiveParts`, also there, draw such a cell and mark each part itself; no shared table has one at present.
  - **Example:** Sites on the Lists page.
- **A row's slot:** Each row of a table, the Lists page, a list's panel, Releases and the Drafts page starts with a slot of two places, kept even when empty.
  - **The record's own mark:** It comes first. It shows only where its draft changes something the row doesn't show, such as adding, removing, retiring or moving it.
  - **The first value's dot:** Next, where a draft changes the row's first value, that value's dot hangs back into the slot, so every first value starts at the same place and a changed name never looks set in under the row above.
  - **An empty slot:** A draft that changes only values the row shows leaves the slot empty, since those values have their own dots; two dots never sit side by side.
  - **A class's symbol:** A class's symbol, where a record has one, follows the slot and comes before the first value, as [A class's mark](#access) sets out.
  - **Drawn by:** `RowMarks` and `DraftedItem`'s `slot` in `apps/web/src/status-mark.tsx`, with `recordMark` in `apps/web/src/draft-marks.ts`; the sizes are the theme's `--fathom-dot-size`, `--fathom-mark-gap` and `--fathom-ring-room` in `apps/web/src/theme.ts`.
  - **Example:** On Projects' Milestones tab, Second crane live, drafted to be added, beside Final handover, drafted to be renamed.
- **A changed value:** Each value a draft changes has the draft's dot before it, and is semibold while drafts show beside live.
  - **Emptied or filled:** Where a draft empties a value, or fills an empty one, the empty side shows its words for none in grey italics, such as No start, in tables and panels alike.
  - **Another record's draft:** A value another record's draft changes, such as a cycle's Release that its release's draft renames, has that draft's dot, in that draft's state, whatever its row's draft is.
  - **Drawn by:** `DraftedValue` and `EmptiedValue` in `apps/web/src/status-mark.tsx`, with `changedValue` in `apps/web/src/draft-marks.ts`; the table's rows in `apps/web/src/grid-row.tsx` in a table, with a row's `cellDrafts` in `apps/web/src/record-table.ts` for values another record's draft changes, and `Row` in `apps/web/src/record-details.tsx` in a panel.
  - **Example:** 西尾 亮's End and Grade on People.
- **A removal:** A record a draft removes is struck through after its dot. It can't be changed until the draft is discarded or decided.
  - **Drawn by:** `draftRowClass` in `apps/web/src/list-drafts.tsx`, with the row of the table or panel that holds it.
  - **Example:** Salvador Quiñones Méndez on People.
- **A part a draft adds or removes:** A part of a record, such as a feature team's member, a manager's direct report or a team in a month's cell, has the draft's dot before it, and is struck through when the draft takes it away.
  - **Read aloud:** Screen readers read added, removed or changed after it, since the dot and line are only seen.
  - **A record's parts:** A record whose parts have drafts, such as a list and its choices, has one dot before its parts. That dot is waiting while any part's draft waits, and rejected only once every one was.
  - **As it is live:** As it is live, in a Live row or live only, a part a draft takes away or changes has Live's green dot before it, its tip, live only, naming the change waiting, such as Live. Its removal is waiting for approval.
  - **Drawn by:** `DraftedPartItem` in `apps/web/src/status-mark.tsx` and `partsMark` in `apps/web/src/draft-marks.ts`, used by `TeamLabels` in `apps/web/src/team-labels.tsx`, `AllocationLines` in `apps/web/src/allocation-months.tsx`, `PartsCell` in `apps/web/src/summary-row.tsx`, `NamersCell` in `apps/web/src/plan-table.tsx` for a feature's Projects and Proposals, and the Person and feature team panels.
  - **Example:** Mobile apps on the Org chart's feature teams: Atmananda Ganaka added, Priscille Adam taken away.
- **A move:** A moved item has its dot and the Moved box, and a dimmed copy stays in its old place after a green dot. On the org chart, a person drafted to another manager is drawn under that manager, with a Live copy under the manager they report to now.
  - **Drawn by:** `ChoiceCells` in `apps/web/src/choice-row.tsx` and `LiveChoiceRow` in `apps/web/src/live-choice-row.tsx` for a list's choices, and `chartPeople` in `apps/web/src/org-chart.ts`.
  - **Example:** Co-op in the panel of Levels on the Lists page; Simone Jean on the Org chart.
- **Retiring:** A list, choice or schedule drafted to be retired or restored stays where it is until approved, with its dot and a Retired or Restored box. Retired records show only when asked for. Drafting a retirement or restore shows no notification, since the change is seen in place; Cmd+Z or Ctrl+Z undoes it.
  - **Drawn by:** `DraftedItem`, with `retiring` set on the draft.
  - **Example:** Patches on the Releases page.
- **Live:** Beside live, a record or value as it is now is drawn under its draft, after a green dot whose tip is Live. It is a light green Live row under a table's row, a Live line under a panel's value or a column's name, and a Live card on the org chart.
  - **A Live row:** A Live row is read only and skipped when moving between cells. It marks each live value under a changed one, rejected drafts' included.
  - **Drawn by:** `LiveRowMarks`, `LiveValue` and `LiveLine` in `apps/web/src/status-mark.tsx`, and the table's rows in `apps/web/src/grid-row.tsx`.
  - **Example:** The Live row under 西尾 亮 on People.
- **A column's draft:** A column a draft adds, removes or changes has its dot before its name. A draft that changes only its heading, such as its name, keeps one column, with the live name on a Live line under the drafted one. A draft that changes what its cells show puts the live column beside it.
  - **Drawn by:** `columnHeaders` in `apps/web/src/column-header.tsx`, with the live column beside it from `useGridModel` in `apps/web/src/grid-model.tsx`.
  - **Example:** Grade on People, with Level under it.
- **Tints:** Only beside live, a row, column or org chart card with a draft is faint yellow, or faint red once rejected, and a Live row is light green. Each is darker in the dark scheme, so its text stays readable.
  - **Drawn by:** `draftRowClass` in `apps/web/src/list-drafts.tsx`, `RecordGrid`, and the org chart's cards, with the colours from `apps/web/src/theme.ts`.
  - **Example:** Vianney Rousseau's row on People.
- **A table of drafts:** On the Drafts page, where every row is a draft, the dot in a row's slot is the row's only mark: no tints, semibold, strike-through or Live rows. The row isn't read aloud as a draft, since every row is one. This is a recorded exception to Tints and A removal.
  - **Drawn by:** A table's `slotMarksOnly` in `apps/web/src/record-table.ts`.
  - **Example:** Salvador Quiñones Méndez's removal on the Drafts page's All drafts tab, its name not struck through.
- **The three Draft views:** The Draft menu's choice decides every mark on the page, in one place. Locks and warnings show in every view. Each mark is given its item's own draft, whatever the view.
  - **Drafts & Live:** Shows everything above.
  - **Drafts applied:** Shows the dots and strike-throughs, with no tints, semibold or Live rows. It leaves out rejected drafts, showing them taken back.
  - **Live only:** Shows no draft dots or tints. Instead, each record, value or part a waiting draft would change has a green dot, its tip naming the change, such as "Live. A change is waiting for approval." A rejected draft gets none.
  - **Drawn by:** `DraftView`, `DraftedItem` and `viewedDraft` in `apps/web/src/status-mark.tsx`, with `liveWaitingWords` in `apps/web/src/draft-marks.ts`; each page sets its view once.
  - **Example:** On People, choose Live only in the Draft menu: the Level column's name has a green dot.
- **A selected row:** A selected row, such as the list whose panel is open, has the hover grey with a thin accent bar at its left edge. It never has the accent's fill, since a row's fill says its draft's state.
  - **Drawn by:** `selectedRow` in `apps/web/src/pages.module.css`.
  - **Example:** Select Sites on the Lists page.
- **Centring:** Every mark (dot, lock or box), and a colour's swatch beside text, is centred on the centreline of its text's capitals. A line holding them lines them up on its text's baseline, and the marks' own spacing is the only spacing. A swatch alone, such as a menu item's icon, is centred in its place instead.
  - **Drawn by:** `dotPlace`, `kind` and `swatchPlace` in `apps/web/src/status-mark.module.css`, `MarkRow` in `apps/web/src/status-mark.tsx`, and `Swatch` in `apps/web/src/colour-swatch.tsx`.
  - **Example:** Any dot before a name on People.
- **A draft from another day:** Where a draft takes effect from a day other than the one shown, the item is followed in grey by from and the day, such as from Dec 1, 2026.
  - **On an org chart card:** An org chart card has too little room, so its From and the day sit on their own line under the name, a recorded exception.
  - **Drawn by:** The `from` of `DraftedItem`, and the card in `apps/web/src/org-chart-page.tsx`.
  - **Example:** On the Org chart, move to next month and add someone to a feature team.
- **Approving several:** Approving several drafts at once, all those waiting from the Draft menu or those ticked on the Drafts page, approves those the user may approve and leaves the rest waiting: drafts the user changed and may not approve, drafts of an area the role doesn't approve, and drafts that use either.
  - **The dialog:** The dialog asking first names the drafts it approves, up to five, then how many others, such as and 2 others, and names those left under This needs another approver and stays waiting, or These need another approver and stay waiting.
  - **The notification:** The notification after it adds how many, such as Approved 4 drafts. 2 need another approver.
  - **Every draft left:** Only when every draft is left does the dialog approve none, titled Another approver needed, naming them.
  - **A single draft:** A single draft, from its menu or details, has no others to approve, so the dialog names why it can't be approved.
  - **Drawn by:** `decisionFor` in `apps/web/src/draft-decisions.ts`, which leaves out the drafts `othersToApprove` finds, from the flag the server sets with `draftsChangedBy` in `packages/shared/src/drafts.ts`, the same rule that refuses an approval; the dialog is `DecisionModal` in `apps/web/src/decision-dialog.tsx`.
  - **Example:** On Features, as the Project Manager, rename a feature, publish it, then choose Approve n drafts… in the Draft menu.

## Values

- **Live values:** Live means approved. Beside its draft, a live value is dimmed, after a green dot, and opens nothing, as [Drafts](#drafts) sets out.
  - **Drawn by:** `LiveLine` and `LiveValue` in `apps/web/src/status-mark.tsx`.
  - **Example:** The light green Live row under a seeded person's drafted change on People.
- **Read-only values:** A value that follows from another is read only, shows no pencil, and ignores what is pasted into it. Those who may not change a record see its values with no pencils and no empty row.
  - **Drawn by:** A column's `readOnly` in `apps/web/src/record-table.ts`, and `Row` without `editing` in `apps/web/src/record-details.tsx`.
  - **Example:** Release on Features, which follows from Target cycle.
- **Empty values:** An empty cell is blank, unless a warning stands in its place, as [Warnings on a value](#values) sets out. A side a draft empties or fills shows as [A changed value](#drafts) sets out.
  - **In a details panel:** An empty value or list, such as a project with no milestones, reads None, dimmed, or the column's own word for empty.
  - **Drawn by:** `Row` in `apps/web/src/record-details.tsx`, with the column's `emptyLabel`.
  - **Example:** Voice Notes' Target cycle reads Later in its details.
- **Values Fathom fills in:** An empty cell Fathom fills in from other values shows that text in grey italics, and editing it starts empty.
  - **Drawn by:** The table's rows in `apps/web/src/grid-row.tsx`, with the org chart and the Teams panel drawing their own.
  - **Example:** A seeded planned hire with no name, named by its position and ID on People.
- **Warnings on a value:** A warning about a value is a red box after it, in words, such as Left, read aloud with why.
  - **No value before it:** A warning with no value before it, in an empty cell or on a line of its own, is its words in red in the value's place, with no box, read aloud the same way. Examples are No team in a Feature team cell and Not staffed on a card.
  - **The red:** Box and words use a red dark enough to read on a draft's tinted row.
  - **A status isn't a warning:** A status a value is in, such as Over and Under on Capacity's Allocations, isn't a warning, and isn't read aloud with why.
    - **How it shows:** In words, in red with no box, with how far it is from what is expected beside it, such as Over +25%, and its figures, such as Total 125%, in a tooltip.
  - **Drawn by:** `MarkedItem` with the `warning` tone, in `apps/web/src/status-mark.tsx`, with `empty` for a warning in an empty value's place.
  - **Example:** No team, in Scheduler API's Feature team cell.
- **Values in units:** An amount shows its unit's code in a table, such as 2.5 PD, and spells the unit out in a panel, such as 2.5 person-days (20 hours). Totals of one unit, such as the capacity totals on Capacity's Allocations, name it once, by its code, in their heading, such as Total, PM.
  - **Drawn by:** `EffortCell` in `apps/web/src/effort-cell.tsx`, and `inUnitsWords` in `apps/web/src/record-details.tsx`; the capacity totals by `CapacityTotal` in `apps/web/src/allocation-months.tsx`, with the units' words from `unitWords` in `apps/web/src/effort.ts`.
  - **Example:** Audit Export's Effort.
- **A size:** A feature's [Size](../../design/domain-model.md#built-in-lists) is the word Size and a block for each S it weighs. It is never a bar on a track, which reads as progress, nor green to red, which borrows red's meaning of a problem.
  - **The blocks:** The blocks are blue-grey, from faint to strong against the page by position: light to dark on a light page, dark to light on a dark one. Four blocks fill the space given, such as a card's width or a row's label.
  - **Where it shows:** The same mark shows on cards, in the panel, in a timeline's row labels and in group headings.
  - **Its value:** Its value, such as M, 2 × S, shows on hover, is read aloud, and shows in the panel.
  - **Drawn by:** `SizeMark` in `apps/web/src/planning-marks.tsx`, with its blue-greys from the theme's `--fathom-size-1` to `--fathom-size-4` in `apps/web/src/theme.ts`.
  - **Example:** Offline Sync's card on the Features Board.
- **A risk:** A feature's [Risk](../../design/domain-model.md#built-in-lists) is the word Risk and a segment for each step of its list, green to red by the list's order. The segments fill the space given, lined up under the Size mark. Its value shows on hover, is read aloud, and shows in the panel.
  - **Drawn by:** `RiskMark` in `apps/web/src/planning-marks.tsx`.
  - **Example:** Offline Sync's card on the Features Board.
- **A coloured name:** A team or release named with its colour is the draft's dot, if any, then its colour's square, then its name, wherever it is shown: in tables, details panels, the Features Board's headings, the month grids, menus, pills and timeline labels. No name is ever shown in a box tinted with its colour.
  - **What stays:** Colour as drawing stays: a timeline's spans and diamonds, and a card's top edge. A fact's grey and red boxes, such as Not staffed, aren't coloured names, and stay.
  - **Empty values:** An empty value shows no square.
  - **Drawn by:** `ColouredName` in `apps/web/src/colour-swatch.tsx`; in a table, a column's `colour` in `apps/web/src/record-table.ts`, and in a panel, `Row`'s `colour`, with `liveColour` for its live value, in `apps/web/src/record-details.tsx`.
  - **Example:** Mobile apps in the Org chart's list of feature teams, or a manager's Team name on People.

## Access

- **A page without its data:** A page or view whose data a role can't see or read is never shown cut down, blurred, rounded or replaced.
  - **A page:** One that would show nothing isn't in the menu, and its address says there's no such page.
  - **A tab:** One the role can't see isn't among the page's tabs.
  - **A view or grouping:** One the role can't see is left out with nothing said, as a column is.
  - **Following the classes:** What a page needs follows its data's classes, so moving a detail's class opens or closes pages with no code change. The Roles page keeps its lines saying what each view needs.
  - **Drawn by:** Each page's needs in `pageNeeds`, and Capacity's tabs' in `capacityModeNeeds`, with `opensWith` and `reaches`, in `packages/shared/src/page-access.ts`. The sidebar's items in `apps/web/src/layout.tsx`, the routes in `apps/web/src/router.tsx`, `apps/web/src/signed-in-route.tsx` and `apps/web/src/plan-routes.tsx`, and `capacityModes` in `apps/web/src/capacity.ts` all read it. The Roles page's lines come from `viewsOfRole` in `packages/shared/src/data-classes.ts`.
  - **Example:** The Team Member, whose menu has no Capacity, and the Product Manager, who sees Capacity's Settings alone.
- **Columns a role can't see:** A column a role can't see isn't shown, and nothing says it's missing.
  - **Drawn by:** A column's `dataClass` in `apps/web/src/table-view.ts`, read by `useGridModel` in `apps/web/src/grid-model.tsx`.
  - **Example:** The Feature Lead's People has no Start or End.
- **A class's mark:** A column or list whose values belong to a class beyond General has its class's symbol in grey before its name, after a draft's dot if there is one. A General item has no symbol.
  - **The symbols:** Personal is an eye with a line through it. Confidential is a lock with a keyhole, unlike the plain lock of a record someone else is changing.
  - **Its tip:** Its tip is the class's name, read aloud after the item's name.
  - **A class named in words:** Where a class is named in words, such as in the Data classes page's Class column or a line of a role's summary, the symbol comes before the name, and General's is an open eye. Only class names Fathom writes are marked, never words someone typed, such as a role's description.
  - **Drawn by:** `ClassMark` and `ClassName` in `apps/web/src/status-mark.tsx`, placed by `DraftedItem`'s `dataClass`, with the symbols from `apps/web/src/icons.tsx`.
  - **Example:** Start, End and Work pattern on People, with Compensation band and Performance rating marked Confidential; Work patterns and Compensation bands on the Lists page.
- **Changing a class:** Wherever it starts, Change class… opens one dialog, as [Data Classes](../../design/pages/administration.md#data-classes) sets out.
  - **Takes effect at once:** Never as a draft, and is changed back rather than undone. A move is recorded in the access history and marked worth checking. A list's or column's move is recorded in the change history too.
  - **A list or column only drafted to be added:** The same dialog changes its draft instead, which can be undone. Drafts and the change history name a class beyond General with the addition, such as Class Confidential. Once approved, it is recorded as a move, naming the Approver.
  - **Turned off:** The dialog turns off each class the data can't go to, and says why. The button itself is turned off, with why, for a role that can't see the data's current class, or while someone else has unpublished changes to the record.
  - **Drawn by:** `MoveClassModal`, `ClassChoice` and `showMoved` in `apps/web/src/move-class-dialog.tsx`.
  - **Example:** Change class… in the panel of Sites on the Lists page, as the Engineering Director.
