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
- **A part a draft adds or removes:** A part of a record, such as a team in a month's cell, has a draft's dot before it when added, and is struck through when removed. Screen readers read "added", "removed" or "changed" after it, since the dot and the line are only seen.
  - **Drawn by:** `DraftDot` and `DraftedWords` in `apps/web/src/status-mark.tsx`, as `TeamLabels` in `apps/web/src/team-labels.tsx` and `AllocationLines` in `apps/web/src/allocation-months.tsx` use them.
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
  - **Drawn by:** `formatDay` in `apps/web/src/table-view.ts`, which date cells use through `cellKinds` in `apps/web/src/cell-kinds.tsx`.
  - **Example:** each release's heading on Features grouped by Release, such as Platform: Harbor 2 and the day it ships.
- **Months:** A month shows as a short month and its year, such as Mar 2027.
  - **Drawn by:** `formatMonth` in `apps/web/src/table-view.ts`.
  - **Example:** Offline Sync's Needed by.
- **Only the month:** Where a reader may not see an exact Personal day, only its month shows.
  - **Drawn by:** `formatDayOrMonth` in `apps/web/src/table-view.ts`.
  - **Example:** the line under the Org chart's date row, for those who don't see Personal details.
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
- **Following a link:** A record named in a details panel is a link that opens that record's details, on its own page or tab, and the browser's back button goes back.
  - **Drawn by:** `RecordLink` in `apps/web/src/record-details.tsx`.
  - **Example:** a customer in Offline Sync's details opens Projects' Customers tab with that customer's details.
- **Several records in a cell:** A cell naming several records lists them in one line, cut short where they don't fit, with every name in its tooltip, one to a line; a details panel lists them one to a line.
  - **Drawn by:** the cell's kind in `apps/web/src/cell-kinds.tsx`, with the tip from `TableTips` in `apps/web/src/table-tips.tsx`.
  - **Example:** Crane Control's Features cell.

## History

- **An entry:** Each entry names who did what in a sentence, with details dimmed after a colon, newest first, with its day, year and time. An entry that deserves a second look has a yellow dot before it, read aloud as Worth checking.
  - **Drawn by:** `EntryList`, `EntryRow`, `EntryDetails` and `WorthChecking` in `apps/web/src/history-entries.tsx`.
  - **Example:** the seeded rejections on the Change history page.
- **A change in words:** Wherever a change is described, in a record's menu, on the Drafts page or in the change history, the field is in semibold and each value is set apart on a light ground, as a value is in code.
  - **Drawn by:** `PhraseText` and `PhraseList` in `apps/web/src/phrase.tsx`.
  - **Example:** the seeded draft of the Level column, Name from Level to Grade, on the Drafts page.
- **A record's own history:** A history inside a record's details has a row for each change, a draft's first, marked as a draft and undated until approved, then each as approved, newest first. A row is never removed.
  - **Drawn by:** `ScopeHistory` in `apps/web/src/scope-history.tsx`, which the scope history change adds.
  - **Example:** a project's scope history, once that change is merged.

## Details Panels

- **Follow the Person panel:** Every record's details follow Person details: the record's name and draft mark at the top; headed sections of rows, each label beside its value while the panel is wide and over it once narrow; the columns an organization added under Columns. Each value that can be changed has a pencil at its right, named Change and the label, and a click on the value does the same.
  - **Drawn by:** `RecordSection`, `Row` and `RecordLink` in `apps/web/src/record-details.tsx`, with `useRecordEditing` in `apps/web/src/record-editing.tsx` for the pencils.
  - **Example:** any seeded person's details beside People.
- **Columns follow the panel's order:** A table's default column order follows its details panel's sections and rows, and the other way round, defined once and used by both.
  - **Drawn by:** `featureColumnGroups` in `apps/web/src/project-grids.tsx`, which the Feature details change adds.
  - **Example:** Features, once that change is merged.
- **Actions on a list in a panel:** Actions on a list inside a details panel sit under the list, at its left, as outlined buttons without an icon, the main one first, so they sit where the next item would go and the list's heading stays a plain heading, as every other section's does. Decided by the owner on 2026-11-11.
  - **Drawn by:** no shared piece yet.
  - **Example:** today a project's details have Show milestones beside the Milestones heading, with no outline, and Add milestone under the list with a + before it; both move under the list, Add milestone first.

## Fields

- **An × to empty a field:** Every field typed into shows an × at its right to empty it while it holds any text, except those for passwords and on the Sign in page. Choosing the × keeps focus in the field. Decided by the owner on 2026-11-07. The fields that still have none are listed in [Issues](../issues.md#development).
  - **Drawn by:** `ClearableInput` in `apps/web/src/clearable-input.tsx`.
  - **Example:** Name in Offline Sync's details, once its pencil opens it.

## Choices

- **A choice with a description:** In a picker, a choice's description shows dimmed under its name, and typing finds a choice by its description too.
  - **Drawn by:** `ChoicePicker` in `apps/web/src/choice-picker.tsx`, which the feature team change gives descriptions.
  - **Example:** a cell's choices on People, once that change is merged and a choice has a description.
- **The keyboard's option in a drop-down list:** The option the keyboard is on, which Enter would pick, is light grey in light mode and a dark grey in dark mode, the same as an option pointed at; never the accent colour, which looks like a choice already made. Decided by the owner on 2026-11-11.
  - **Drawn by:** the theme, through `Combobox.extend` in `apps/web/src/theme.ts` and `apps/web/src/combobox.module.css`, which the feature team change adds, so every drop-down list and table cell's choices follow it.
  - **Example:** on Features, once that change is merged, open a Status cell's choices and press the Down arrow.
- **The chosen one ticked:** A group of choices in a menu ticks the one chosen.
  - **Drawn by:** `MenuChoices` in `apps/web/src/app-menu.tsx`.
  - **Example:** Hours ticked under Show in, in Effort's column menu.

## Access

- **A page without its data:** A page a role reaches, but whose data the role can't see, stays in the menu and opens to a short line saying why. The data classes change adds it.
  - **Drawn by:** no shared piece yet.
  - **Example:** none until that change; the greyed-out Allocations switch on Feature assignments already says why in the same way, "This role doesn't see allocations".
- **Columns a role can't see:** A column a role can't see isn't shown, and nothing says it's missing. A column whose values belong to a class of data shows a lock with the class's name. The data classes change adds the lock.
  - **Drawn by:** no shared piece yet.
  - **Example:** none until that change.

## Words

- **The principles:** Every word on screen follows Visual Design's [Principles](visual-design.md#principles): words people say, never the second person, and no instructional text. On top of those, use the plain verb: added, removed, changed, retired, restored, never "comes off" or "taking off".
  - **Drawn by:** the words themselves, with `draftWords` and `DraftedWords` in `apps/web/src/status-mark.tsx` for drafts.
  - **Example:** Draft: removed.
