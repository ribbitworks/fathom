# Fathom: UI Conventions

**Status:** Proposal for the owner's review
**Last updated:** 2026-11-11

A short lookup of the conventions every screen follows, for those who build screens. Each entry gives the rule, the shared piece that draws it, so a new screen reuses it rather than drawing its own, and an example from the [fictional seed data](development-setup.md#fictional-seed-data), or the steps that make one. The principles behind them, and how each page is laid out, are in [Visual Design](visual-design.md).

## Drafts

- **A record's draft:** A record with a draft is tinted light blue and marked after a dot: Draft, Draft: added, Draft: removed, Draft: retired, Draft: restored, Draft: moved, or Draft: reordered, with a yellow dot, or Rejected, with a red one, its reason read aloud and shown in the record's menu. Each tint has a darker version in the dark scheme, so text on it stays readable.
  - **Drawn by:** `DraftMark` and `StatusMark` in `apps/web/src/status-mark.tsx`, with the words from `draftWords`.
  - **Example:** the seeded newcomers on People, marked Draft: added, and the seeded rejected drafts, marked Rejected.
- **Unpublished and held:** The user's own unpublished draft has a hollow yellow dot, read aloud as unpublished; where no other mark says so, as for a rejected draft, it's marked Unpublished after a hollow dot. A record someone else has unpublished changes to is marked Being changed after a grey dot, and read only. Its menu names who, as Being changed by and their name, and says it can be changed once they publish or discard their changes; the mark itself names them only to screen readers.
  - **Drawn by:** `DraftMark` and `HoldMarks` in `apps/web/src/status-mark.tsx`, with the menu's words from `apps/web/src/draft-details.tsx`.
  - **Example:** the seeded person whose site the Engineering Operations Manager changed without publishing, marked Being changed for everyone else.
- **A removal:** A record a draft removes is struck through, marked Draft: removed, and can't be changed until the draft is discarded or decided.
  - **Drawn by:** `DraftMark`, with the struck-through row from the table or panel that holds it.
  - **Example:** the seeded person drafted to be removed, on People.
- **A part a draft adds or removes:** A part of a record, such as a team in a month's cell or a member of a feature team, has the draft's dot before it whenever a draft adds, changes or removes it, in the draft's tone, so it says whether the draft is unpublished, waiting or rejected; a part being removed is also struck through. Screen readers read "added", "removed" or "changed" after it, since the dot and the line are only seen. Decided by the owner on 2026-11-11, replacing a removed part struck through without a dot.
  - **Drawn by:** `DraftDot` and `DraftedWords` in `apps/web/src/status-mark.tsx`, as `TeamLabels` in `apps/web/src/team-labels.tsx`, `AllocationLines` in `apps/web/src/allocation-months.tsx` and a feature team's Members row in `apps/web/src/feature-team-panel.tsx` use them.
  - **Example:** on Feature assignments, choose a team in a person's month: its label gets a yellow dot.
- **A change to a value:** A value a draft changes shows the drafted value, with the live value on a line under it, small, dimmed and marked Live after a green dot.
  - **Drawn by:** `LiveLine` in `apps/web/src/status-mark.tsx`; `Row` in `apps/web/src/record-details.tsx` draws the same with `StatusMark` in a details panel.
  - **Example:** the seeded choice Northmere, drafted to be Northmere Labs, on the Lists page.
- **A draft in a table edited like a spreadsheet:** Each cell a draft changes is yellow, or soft red once rejected. Under the draft row is the record's live row, light green, dimmed and marked Live: read only, skipped when moving between cells, and with each changed cell's live value read aloud. Tables that aren't edited like a spreadsheet, such as the Lists page, tint the row, never a single cell.
  - **Drawn by:** `RecordGrid` in `apps/web/src/record-grid.tsx`.
  - **Example:** the seeded people with drafts on People.
- **A record made of parts:** A record whose parts have drafts, such as a list and its choices, is marked Draft while anything in it waits, Draft: reordered when only its order does, and Rejected only once everything drafted in it was rejected. A part drafted to be removed is struck through and not counted. In the record's panel, each part with a draft is tinted and marked, with its live row under it.
  - **Drawn by:** `DraftItems` in `apps/web/src/list-drafts.tsx` and the list's panel in `apps/web/src/list-panel.tsx`.
  - **Example:** the seeded list Sites, whose choice Northmere is drafted to be Northmere Labs.
- **A move:** A moved item is marked Draft: moved, with a dimmed copy in its old place marked Live.
  - **Drawn by:** the list's panel in `apps/web/src/list-panel.tsx`.
  - **Example:** on the Lists page, move a choice of Sites to another place.
- **Retiring:** A list, choice or stream drafted to be retired or restored stays where it is until approved, marked Draft: retired or Draft: restored. Retired records show only when asked for.
  - **Drawn by:** `DraftMark`, with `retiring` set on the draft.
  - **Example:** on the Releases page, select Patches, then Retire.
- **A draft from another day:** Where a draft takes effect from a day other than the one shown, its mark says so in the same words everywhere, such as Draft, from Dec 1, 2026. Where there's little room, such as on an org chart card, the words may sit on a line of their own. The org chart card still reads From Oct 1, 2026, as [Issues](../issues.md#people) records. Decided by the owner on 2026-11-11.
  - **Drawn by:** the `from` of `DraftMark`.
  - **Example:** on the Org chart, move to next month and add someone to a feature team.

## Values

- **Live values:** Live means approved. A live value shown beside its draft is dimmed, marked Live, and opens nothing.
  - **Drawn by:** `LiveLine`, and `StatusMark` with the `live` tone, in `apps/web/src/status-mark.tsx`.
  - **Example:** the light green Live row under a seeded person's drafted change on People.
- **Read-only values:** A value that follows from another is read only, shows no pencil, and ignores what is pasted into it. Those who may not change a record see its values with no pencils and no empty row.
  - **Drawn by:** a column's `readOnly` in `apps/web/src/record-grid.tsx`, and `Row` without `editing` in `apps/web/src/record-details.tsx`.
  - **Example:** Release on Features, which follows from Target cycle.
- **Empty values:** An empty cell is blank. In a details panel, an empty value reads None, dimmed, or the column's own word for empty.
  - **Drawn by:** `Row` in `apps/web/src/record-details.tsx`, with the column's `emptyLabel`.
  - **Example:** Voice Notes' Target cycle reads Later in its details.
- **Values Fathom fills in:** An empty cell Fathom fills in from other values shows that text in grey italics, and editing it starts empty.
  - **Drawn by:** `apps/web/src/record-grid.tsx`, with the org chart and the Teams panel drawing their own; no shared piece yet.
  - **Example:** a seeded planned hire with no name, named by its position and ID on People.
- **Warnings on a value:** A warning about a value is marked after a red dot in its cell, in words, and read aloud with why.
  - **Drawn by:** `StatusMark` with the `warning` tone.
  - **Example:** No team, in Scheduler API's Feature team cell.
- **Values in units:** An amount shows its unit's code in a table, such as 2.5 PD, and spells the unit out in a panel, such as 2.5 person-days (20 hours).
  - **Drawn by:** `EffortCell` in `apps/web/src/effort-cell.tsx`, and `inUnitsWords` in `apps/web/src/record-details.tsx`.
  - **Example:** Audit Export's Effort.

## Dates

- **Days:** A day shows in the reader's language with a short month and its year, such as 31 Dec 2026 or Dec 31, 2026. Every date shown includes its year. The About box's full date and Settings' day and time in a time zone are the two exceptions, as [Visual Design](visual-design.md#layout) sets out.
  - **Drawn by:** `formatDay` in `apps/web/src/table-view.ts`, which date cells use through `cellKinds` in `apps/web/src/cell-kinds.tsx`, and `formatMomentDay` there for the day of a moment, such as when an account was made.
  - **Example:** each release's heading on Features grouped by Release, such as Platform: Harbor 2 and the day it ships.
- **Months:** A month shows as a short month and its year, such as Mar 2027.
  - **Drawn by:** `formatMonth` in `apps/web/src/table-view.ts`.
  - **Example:** Offline Sync's Needed by.
- **Typing a day or month:** Days and months are typed as their digits, laid out as typed, such as 2026-10-31 and 2027-03, whatever the reader's language.
  - **Drawn by:** `DayInput` in `apps/web/src/day-input.tsx`. People's date cells and Person details still have their own fields, as [Issues](../issues.md#development) records.
  - **Example:** a milestone's Date.
- **A time:** History entries give the day, its year and the time, in the reader's language.
  - **Drawn by:** `EntryRow` in `apps/web/src/history-entries.tsx`.
  - **Example:** any entry on the Change history page.

## Links to Records

- **A record with an ID:** Wherever a project or proposal is named, in a cell, a link, a picker or a filter, its ID comes first, dimmed in cells and links, then its name, so records with similar names are told apart.
  - **Drawn by:** `RecordName` in `apps/web/src/project-grids.tsx`.
  - **Example:** P-2001 Crane Control.
- **Following a link:** A record named in a details panel is a link that opens that record's details, on its own page or tab, and the browser's back button goes back. A link from one page to a record on another, such as Show in People on the Org chart, opens that page with the record's details open, not only a search for it. Decided by the owner on 2026-11-11.
  - **Drawn by:** `RecordLink` in `apps/web/src/record-details.tsx`.
  - **Example:** a customer in Offline Sync's details opens Projects' Customers tab with that customer's details.
- **Several records in a cell:** A cell naming several records lists them in one line, cut short where they don't fit, with every name in its tooltip, one to a line; a details panel lists them one to a line.
  - **Drawn by:** the cell's kind in `apps/web/src/cell-kinds.tsx`, with the tip from `TableTips` in `apps/web/src/table-tips.tsx`, and `RecordLinkList` in `apps/web/src/record-details.tsx` in a panel.
  - **Example:** Crane Control's Features cell.

## History

- **An entry:** Each entry names who did what in a sentence, with details dimmed after a colon, newest first, with its day, year and time. An entry that deserves a second look has a yellow dot before it, read aloud as Worth checking.
  - **Drawn by:** `EntryList`, `EntryRow`, `EntryDetails` and `WorthChecking` in `apps/web/src/history-entries.tsx`.
  - **Example:** the seeded rejections on the Change history page.
- **A change in words:** Wherever a change is described, in a record's menu, on the Drafts page or in the change history, the field is in semibold and each value is set apart on a light ground, as a value is in code.
  - **Drawn by:** `PhraseText` and `PhraseList` in `apps/web/src/phrase.tsx`.
  - **Example:** the seeded draft of the Level column, Name from Level to Grade, on the Drafts page.
- **A record's own history:** A history inside a record's details has a row for each change, newest first, a draft's first, marked Draft, each dated the day it was drafted, a date it keeps once approved. A row is never removed or struck through, since history is not undone.
  - **Drawn by:** `ScopeHistory` in `apps/web/src/scope-history.tsx`.
  - **Example:** Fleet Tracking Bid's scope history, where Report Builder was removed with a reason.

## Details Panels

- **Follow the Person panel:** Every record's details follow Person details: the record's name and draft mark at the top; headed sections of rows, each label beside its value while the panel is wide and over it once narrow; the columns an organization added under Columns. Each value that can be changed has a pencil at its right, named Change and the label, and a click on the value does the same. A panel never mixes in another layout, such as labels over form fields. Decided by the owner on 2026-11-11.
  - **Drawn by:** `RecordSection`, `Row` and `RecordLink` in `apps/web/src/record-details.tsx`, with `useRecordEditing` in `apps/web/src/record-editing.tsx` for the pencils.
  - **Example:** any seeded person's details beside People.
- **Columns follow the panel's order:** A table's default column order follows its details panel's sections and rows, and the other way round, defined once and used by both.
  - **Drawn by:** `featureColumnGroups` in `apps/web/src/project-grids.tsx`.
  - **Example:** Features, whose columns start Name, Status, Description, Notes, as its details' Details section does.
- **Actions on a list in a panel:** Actions on a list inside a details panel sit under the list, at its left, as outlined buttons without an icon, the main one first, so they sit where the next item would go and the list's heading stays a plain heading, as every other section's does. Decided by the owner on 2026-11-11.
  - **Drawn by:** no shared piece yet.
  - **Example:** today a project's details have Show milestones beside the Milestones heading, with no outline, and Add milestone under the list with a + before it; both move under the list, Add milestone first.

## Fields

- **An × to empty a field:** Every field typed into shows an × at its right to empty it while it holds any text, except those for passwords and on the Sign in page. Choosing the × keeps focus in the field. Decided by the owner on 2026-11-07. A table's cells aren't fields: Delete or Backspace empties one, so they show no ×. Decided by the owner on 2026-11-11. The fields that still have none are listed in [Issues](../issues.md#development).
  - **Drawn by:** `ClearableInput` in `apps/web/src/clearable-input.tsx`.
  - **Example:** Name in Offline Sync's details, once its pencil opens it.

## Choices

- **A choice with a description:** In a picker, a choice's description shows dimmed under its name, and typing finds a choice by its description too.
  - **Drawn by:** `ChoicePicker` in `apps/web/src/choice-picker.tsx`, which the feature team change gives descriptions.
  - **Example:** a cell's choices on People, once that change is merged and a choice has a description.
- **Choosing none:** A picker for a value that takes one choice and need not have one offers the column's word for an empty value, such as None, No manager or Later, as its first option, with a line under it, until something is typed. Nothing is highlighted until a key is pressed or an option pointed at, and once something is typed the first match is highlighted, so none is always in sight but Enter never picks it unasked. Choosing it empties the value. Decided by the owner on 2026-11-11.
  - **Drawn by:** `ChoicePicker` in `apps/web/src/choice-picker.tsx`, given the word through `cellKinds` in `apps/web/src/cell-kinds.tsx` from the column's `emptyLabel`, which the feature team change adds.
  - **Example:** on People, open a person's Manager cell: No manager is first.
- **The keyboard's option in a drop-down list:** The option the keyboard is on, which Enter would pick, is light grey in light mode and a dark grey in dark mode, the same as an option pointed at; never the accent colour, which looks like a choice already made. Decided by the owner on 2026-11-11.
  - **Drawn by:** the theme, through `Combobox.extend` and `Select.extend` in `apps/web/src/theme.ts`, both giving their options the class in `apps/web/src/combobox.module.css`, which the feature team change adds, so every drop-down list, Select and table cell's choices follow it. A new kind of drop-down list from Mantine, such as `MultiSelect`, needs the same class in the theme.
  - **Example:** on Features, once that change is merged, open a Status cell's choices and press the Down arrow.
- **The chosen one ticked:** A group of choices in a menu ticks the one chosen.
  - **Drawn by:** `MenuChoices` in `apps/web/src/app-menu.tsx`.
  - **Example:** Hours ticked under Show in, in Effort's column menu.

## Access

- **A page without its data:** A page or view a role reaches, but whose classes of data the role can't see, is never shown cut down: the page stays in the menu and opens to a short line saying why, and a view, such as another date, gives way to one where it would be.
  - **Drawn by:** `WhyMissing` in `apps/web/src/why-missing.tsx`, with the words from `whyMissing` in `packages/shared/src/data-classes.ts`, which the server's refusals use too.
  - **Example:** Feature assignments for the Team Member, which reads Feature assignments needs Personal access., and the Org chart for the Resource Planner, where Other dates need Personal access. stands in place of the date row.
- **Columns a role can't see:** A column a role can't see isn't shown, and nothing says it's missing. A column whose values belong to a class of data shows a lock with the class's name. The data classes change adds the lock.
  - **Drawn by:** no shared piece yet.
  - **Example:** none until that change.

## Words

- **The principles:** Every word on screen follows Visual Design's [Principles](visual-design.md#principles): words people say, never the second person, and no instructional text. The rule against instructions is for text always on screen: a refusal may say what to do next, such as Choose a manager, or leave Manager assigned empty. Decided by the owner on 2026-11-11. On top of those, use the plain verb: added, removed, changed, retired, restored, never "comes off" or "taking off".
  - **Drawn by:** the words themselves, with `draftWords` and `DraftedWords` in `apps/web/src/status-mark.tsx` for drafts.
  - **Example:** Draft: removed.

## Entering Data

- **From the keyboard:** Wherever items are added or changed, everything works from the keyboard. Tab moves between fields, Enter saves and starts the next item, Esc cancels, and arrow keys move between items. Leaving an item by clicking or tabbing elsewhere saves it too, and pasting several lines adds one item for each.
  - **Drawn by:** `RecordGrid` in `apps/web/src/record-grid.tsx` for tables, and `apps/web/src/list-panel.tsx` for a list's choices.
  - **Example:** on the Lists page, select Sites and type a new choice in its empty row.
- **Like a spreadsheet:** Tables where many records are entered work like a spreadsheet. Arrow keys, Home, End and Tab move between cells, and Ctrl+Home and Ctrl+End go to the first and last. Enter, F2 or typing edits a cell; Enter saves and moves down, Tab saves and moves across, Esc cancels, and Delete clears. Pasting rows copied from a spreadsheet into an empty row adds one record for each.
  - **Drawn by:** `RecordGrid` in `apps/web/src/record-grid.tsx`.
  - **Example:** People, Features, and each table on Projects.
- **The empty row:** Empty rows at the end take new records, their cells blank until something is typed in one, so they aren't taken for records. A row being filled in is tinted as the draft it will be and marked New, not saved yet, after an open dot, naming in red what is wrong so far, or in grey any required column still empty. Its menu, also opened with Shift+F10, offers Clear row, which takes the row and what it holds away.
  - **Drawn by:** `RecordGrid` in `apps/web/src/record-grid.tsx`.
  - **Example:** type a name in the empty row at the end of Features.
- **Moving items:** Where people set an order, items have a grip for dragging on wide screens, shown on hover or focus, and Alt with the arrow keys moves the selected one. Its menu offers the same moves and shows each one's keys.
  - **Drawn by:** `apps/web/src/list-panel.tsx` for a list's choices, and the column menu in `apps/web/src/table-controls.tsx` for moving a column.
  - **Example:** the choices of Sites on the Lists page.

## Saving and Undo

- **Saved at once:** Changes save at once, without asking. The latest can be undone with Cmd+Z or Ctrl+Z, except in a field with something typed in it, the note editor included, where the keys undo the typing alone. Changes seen in place show no notification. A change that takes something out of view, such as retiring or removing it, shows a notification at the top right offering Undo, which closes after a few seconds or when a newer change is made. Sharing a view, or taking it back, shows one too, since nothing changes in view and it affects others. Decided by the owner on 2026-11-11.
  - **Drawn by:** `useSaving` and `isUndo` in `apps/web/src/saving.ts`, and `notifyUndoable` in `apps/web/src/notices.tsx`.
  - **Example:** on the Lists page, retire a choice of Sites.
- **Asking first:** Only approving and rejecting drafts ask first, since they can't be undone.
  - **Drawn by:** `DecisionModal` in `apps/web/src/decision-dialog.tsx`.
  - **Example:** Approve… in a seeded person's draft menu on People.
- **Failures:** A change that fails says so in plain words, saying what to do next, never as a raw error, and its notification stays until closed. The record goes back to how it was.
  - **Drawn by:** `notifyFailure` in `apps/web/src/notices.tsx`, with the words from `describeProblem` in `apps/web/src/api.ts`.
  - **Example:** none in the seed data; a lost connection while saving shows one.

## Leaving Unsaved Work

- **Asking before discarding:** Leaving a form or a note with anything changed in it, by Cancel, the close button, another tab or another record, asks first, such as Discard the new customer? with Keep adding and Discard, or Discard changes to the note? with Keep writing and Discard. The question always starts with Discard and names what is lost, such as Discard the fill of TBD-3? Decided by the owner on 2026-11-11. A form can't be left while its record is being added, and a dialog can't be closed while a change is being saved.
  - **Drawn by:** `useDiscardQuestion` and `newRecordQuestion` in `apps/web/src/discard-question.tsx`.
  - **Example:** on Projects' Customers tab, select New customer, type a name, then Cancel.

## Refusals

- **A value refused:** A value refused when saved, by the page or by the server, keeps its editor open with what was typed, outlined in red, with the reason in red under it, so nothing is lost, in tables and panels alike; in a table, the reason is under the row, in its first cell. Esc leaves the value as it was. Decided by the owner on 2026-11-11.
  - **Drawn by:** `useRecordEditing` in `apps/web/src/record-editing.tsx` for a panel, and `RecordGrid` in `apps/web/src/record-grid.tsx` for a table.
  - **Example:** type 203013 in a Needed by cell on Features: Needed by: use a month such as 2027-03.
- **Controls turned off:** A control for a change the server would refuse is turned off, with a line saying why wherever the reason isn't plain to see. A control the reader might expect, such as Fill on a planned hire or New under Live only, is turned off with its reason rather than hidden; a control is hidden only when the role can never use it. Decided by the owner on 2026-11-11.
  - **Drawn by:** each page; no shared piece yet.
  - **Example:** in a list with meanings, such as Feature statuses, Retire and Remove are greyed out on the only choice that means Possible, with a line saying why.

## Staying Put

- **Nothing moves while it's being changed:** A row keeps its place and its group while it is edited, until the view next changes, so a sorted or filtered table doesn't jump. No column's width follows what is typed, and a line that comes and goes keeps its space while empty.
  - **Drawn by:** `RecordGrid` in `apps/web/src/record-grid.tsx`, and `apps/web/src/org-chart-date.tsx` for the line under the date row.
  - **Example:** on Features, change Report Builder's Target cycle: it stays under its heading until the page is reloaded.

## The Address

- **Kept in the address:** Everything a page shows is kept in its address: the tab, the mode, the view (its search, filters, sort, grouping, metrics, frozen columns, column order, widths and units), the record shown in a panel, an open form, such as New or Fill, a note's panel, and the date shown. So reloading shows the same, a link shared shows it to others who may see it, and the browser's Back goes back through what was shown. A dialog isn't kept. A page opened from the menu starts afresh. Decided by the owner on 2026-11-11 for forms, notes and dialogs.
  - **Drawn by:** each page's search parameters in `apps/web/src/router.tsx`, with a table's view in `apps/web/src/table-view.ts`.
  - **Example:** on Projects, select the Customers tab and reload.
- **Back to another page:** The browser's Back is the way back. A Back to button is offered only where Fathom itself jumps to another page.
  - **Drawn by:** no shared piece yet.
  - **Example:** none yet.
- **Kept in this browser:** A person's own settings for how Fathom looks are kept in the browser, not the address: Light or Dark, the collapsed sidebar, side panel widths and shares, the timeline's zoom, and, remembered by the server for each browser, the role last acted as.
  - **Drawn by:** the piece that owns each, such as `apps/web/src/side-panel.tsx` for panel widths.
  - **Example:** on the Releases page, choose Quarter on the timeline and reload.

## Panels and Focus

- **Opening and closing:** Choosing a record opens its details in a side panel, at its own address. Esc, the close button, or a click on the page outside the panel, the rows and the controls closes it. On a narrow screen, the panel covers the screen and keeps focus until it is closed.
  - **Drawn by:** `WithSidePanel` and `SidePanelFrame` in `apps/web/src/side-panel.tsx`.
  - **Example:** Offline Sync's details on Features.
- **Focus goes where expected:** Opening a panel or dialog puts focus on its first thing to read or change, such as the record's name. Closing it puts focus back where it was opened from, such as the record's Name cell. Choosing the × in a field keeps focus in the field.
  - **Drawn by:** `focusSoon` in `apps/web/src/focus.ts`, with `SidePanelFrame` in `apps/web/src/side-panel.tsx`.
  - **Example:** close Offline Sync's details: focus is back on its Name cell.

## Publishing

- **Private until published:** A person's changes are theirs alone until they publish them. While they have any, the top bar shows Publish with how many, such as Publish 3 changes, which publishes them all, beside a menu listing them, with Discard all…, which asks first. A record someone else is changing is held, as [Drafts](#drafts) sets out.
  - **Drawn by:** `UnpublishedControl` in `apps/web/src/unpublished.tsx`.
  - **Example:** change any value on Features: Publish 1 change shows in the top bar.

## Search

- **Finding rows:** A search field above a table finds rows with every word typed anywhere in them, ignoring letter case and accents. Cmd+F on a Mac, or Ctrl+F elsewhere, goes to it from anywhere but a dialog, and Esc clears it, then leaves it, going back to the table where it can. When nothing matches, the table says so.
  - **Drawn by:** `TableSearch` in `apps/web/src/table-controls.tsx`.
  - **Example:** type offline in the search field on Features.
