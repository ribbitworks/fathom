---
title: "UI Conventions: Pages and Panels"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["apps/web/**", "docs/testing/**"]
dependencies: ["docs/standards/ui-conventions.md", "docs/design/visual-design.md"]
last_updated: "2026-11-19"
---

# Pages and Panels

Part of [UI Conventions](../ui-conventions.md): the top bar, the page heading, links to records, history, details panels, focus, and Help pages. Each entry gives the rule, the shared piece that draws it, and an example from the [fictional data](../../design/development-setup.md#fictional-data).

## The Top Bar

- **Where the user is:** The top bar names the sidebar's section and page. On an address below a sidebar item, such as a Help page, the item's name is a link back to its page, followed by what the address shows, such as the Help page's title.
  - **Drawn by:** the sidebar's items in `apps/web/src/layout.tsx`, where an item's `detailOf` names what an address below it shows.
  - **Example:** select Help pages, then Lists: the top bar reads Help / Help pages / Lists.

## The Page Heading

- **The row under the heading stays put:** Every page's heading is one line: its title, then, where the page shows its records more than one way, the switch between them, centred on the title's line, and the page's actions at the right. Nothing adds a row between the heading and the search row, so the search row starts at the same place on every page, and moving between pages doesn't shift it. The heading is one height on every page, as tall as a button, and the gap under it is the same on every page, the theme's medium spacing. A page's tabs, such as Projects', sit there too, after the title.
  - **Drawn by:** `PageHeader` in `apps/web/src/page-header.tsx`, with the switch, `ModeSwitch` in the same file, or a page's tabs, `HeadingTabs`, with each tab's content in `HeadingTabPanel`, both in the same file, in its `beside`, and its height from the theme's `--fathom-heading-height` in `apps/web/src/theme.ts`; each page puts the gap after it.
  - **Example:** Table and Board beside the Features heading.
- **Actions on ticked rows:** A page whose table has ticks puts what can be done with the ticked rows among its actions at the right of its heading, only while rows are ticked, each naming how many it acts on, such as Approve 3 drafts… or Publish 2 changes, so nothing is added between the heading and the table.
  - **Drawn by:** the page's `PageHeader` `action`, as `apps/web/src/drafts-page.tsx` gives it, with the ticks from `apps/web/src/row-ticks.tsx`.
  - **Example:** on the Drafts page's To decide tab, as the Engineering Director, tick any row: Reject… and Approve 1 draft… show at the right of the heading.

## Links to Records

- **A record with an ID:** Wherever a project or proposal is named, in a cell, a link, a picker or a filter, its ID comes first, dimmed in cells and links, then its name, so records with similar names are told apart. The title of its details panel does the same; notifications name it alone.
  - **Drawn by:** `RecordName` in `apps/web/src/project-grids.tsx`.
  - **Example:** P-2001 Crane Control.
- **A record's key:** A record's key, such as #FEATURE-123, shows small and dimmed under the title of its details and under a card's name. The key under a title is a button whose menu offers Copy link and Copy key; a row's, a card's, an Org chart card's right-click and an added column's menus offer Copy link. Copying changes nothing in view, so a notification says it was done. A record not yet saved shows no key and offers neither. Which records have keys is as [Record key](../../design/domain-model.md#change-and-history-entities) sets out.
  - **Drawn by:** `RecordKey` and `CopyLinkItem` in `apps/web/src/record-key.tsx`, with a panel's key in `RecordPanel`'s `subtitle` in `apps/web/src/record-details.tsx`, and a table's `keyOf` in `apps/web/src/record-grid.tsx` for its row menus, Key column and search by key.
  - **On the Drafts page:** a draft's row and details carry its record's key, and the drafts named under Approved with it, Waiting on it and Linked to each come after their record's key, small and dimmed, as a project's ID comes before its name. A draft of the planning settings has none.
    - **Drawn by:** the table's `keyOf` from `placeKey` in `apps/web/src/draft-places.ts`, and `KeyedName` in `apps/web/src/record-key.tsx`.
  - **Example:** the key under Offline Sync's title in its details beside Features.
- **Following a link:** A record named in a details panel is a link that opens that record's details, on its own page or tab, and the browser's back button goes back. A link from one page to a record on another, such as Show in People on the Org chart, opens that page with the record's details open, not only a search for it. A project or proposal named in a feature's details on Features opens on Projects in the same way, and Back returns to Features as it was. On Releases, a release's details link its schedule and its cycles, a cycle's its release and schedule, and a schedule's its current cycle and next release, each opening on its own tab, and a schedule's details offer Show its releases and Show its cycles, opening those tabs filtered to it. A draft's details on the Drafts page link to its record with Show on and the record's page, such as Show on People, opening the record with its details open where that page has details, only for a role that opens that page; under Linked to, each change links to its own details beside the table. The drafts deciding it takes along, under Approved with it or Waiting on it, are named in words, each after its record's key, not as links, as a decision's dialog names them: a recorded exception.
  - **Drawn by:** `RecordLink` in `apps/web/src/record-details.tsx`; the server's lookup by `goRoutes` in `apps/server/src/routes/go.ts`; Show on by the Drafts route's `recordLink` in `apps/web/src/router.tsx`.
  - **Example:** a customer in Offline Sync's details opens Projects' Customers tab with that customer's details.
- **Opening from a table:** A table's row opens its own record's details from the details button over its Name cell, or Show details in its menu, on every table, as [A row's controls](tables.md#tables) sets out; another record named in a cell, such as a project's features, is a link that opens that record's details on its own page, as Following a link sets out.
  - **Drawn by:** `RowControls` in `apps/web/src/row-controls.tsx`, through the table's `showDetails` in `apps/web/src/record-grid.tsx`.
  - **Example:** point at any row on People.
- **Several records in a cell:** A cell naming several records lists them in one line, cut short where they don't fit, with every name in its tooltip, one to a line; a details panel lists them one to a line, each a link to its record. A list of features in a panel, such as a release's, cycle's or schedule's Features, folds past its first five as [A long list](#details-panels) sets out, with Show on Features and Show on the Board under it, opening Features or its Board filtered to the record.
  - **Drawn by:** the cell's kind in `apps/web/src/cell-kinds.tsx`, as `recordsColumn` in `apps/web/src/project-grids.tsx` makes the column, with the tip from `TableTips` in `apps/web/src/table-tips.tsx`, and `RecordLinkList` in `apps/web/src/record-details.tsx` in a panel, with `FeatureList` in `apps/web/src/release-features.tsx` for a record's features.
  - **Example:** Crane Control's Features cell.

## History

- **An entry:** Each entry names who did what in a sentence, with details dimmed after a colon, newest first, with its day, year and time. An entry that deserves a second look ends in a grey Worth checking box, as a fact does, since a dot always means a draft.
  - **Drawn by:** `EntryList`, `EntryRow`, `EntryDetails` and `WorthChecking` in `apps/web/src/history-entries.tsx`.
  - **Example:** the seeded rejections on the Change history page.
- **A change in words:** Wherever a change is described, in a record's menu, in a draft's details on the Drafts page or in the change history, the field is in semibold and each value is set apart on a light ground, as a value is in code. In a table's cell, such as the Drafts table's What changes, it takes a lighter form, the field in medium weight and each value on a fainter ground, so a column of changes doesn't outweigh the rows' names.
  - **Drawn by:** `PhraseText` and `PhraseList` in `apps/web/src/phrase.tsx`, with `PhraseList`'s `light` for the lighter form.
  - **Example:** the seeded draft of the Level column, Name from Level to Grade, in the Drafts table's What changes and in its details.
- **A record's own history:** A history inside a record's details has a row for each change, newest first, a draft's first, after the draft's dot, each dated the day it was drafted, a date it keeps once approved. A row is never removed or struck through, since history is not undone.
  - **Drawn by:** `ScopeHistory` in `apps/web/src/scope-history.tsx`.
  - **Example:** Fleet Tracking Bid's scope history, where Report Builder was removed with a reason.

## Details Panels

- **One frame:** Every details panel is drawn in the one side panel frame, its sections spaced the same way by one shared piece, so no panel spaces its own.
  - **Drawn by:** `SidePanelFrame` in `apps/web/src/side-panel.tsx`, through `RecordPanel` in `apps/web/src/record-details.tsx`, whose `subtitle` holds a record's key under its name, with `DetailSections` there spacing the sections.
  - **Example:** any seeded person's details beside People.
- **Follow the Person panel:** Every record's details follow Person details: the record's name and draft mark at the top; headed sections of rows, each label beside its value while the panel is wide and over it once narrow, the labels in a column as wide as the section's longest, up to half the panel, so none wraps; the columns an organization added under Columns. Each value that can be changed has a pencil at its right, named Change and the label, shown while its row is pointed at or has focus, or always on a screen that can't be pointed at; a click anywhere on the row, its label included, does the same, and the row is marked in the hover grey while pointed at. A panel never mixes in another layout, such as labels over form fields.
  - **Drawn by:** `RecordSection`, `Row`, `changeButton` and `RecordLink` in `apps/web/src/record-details.tsx`, with `useRecordEditing` in `apps/web/src/record-editing.tsx` for the pencils, and `ValueField` there for a value typed in place, which a scope history's reason for a removal uses too.
  - **Example:** any seeded person's details beside People.
- **A draft's details:** A draft's details, beside the Drafts table, follow Person details: the draft's record after its dot, with any fact boxes, and its record's key under it; under Details, the table's columns, What changes in its full form; under Approved with it, or Waiting on it once rejected, the other drafts deciding it takes along, each after its record's key; on Not published, under Linked to, the user's own changes it's published and discarded with, each after its record's key; then Approve… and Reject… while the role may decide it now, or a dimmed line saying why not, such as Back with its maker to change and resubmit; and a link to its record on its own page.
  - **Drawn by:** `DraftPanel` in `apps/web/src/drafts-panel.tsx`, on `RecordSection`, `Row` and `RecordLinkList` in `apps/web/src/record-details.tsx`, with the reasons' words from `apps/web/src/draft-details.tsx`, which the row's menu shares.
  - **Example:** on the Drafts page's To decide tab, the details of Silje Holm-Schrøder's draft, approved with the new list, column and choice it uses.
- **A long note:** A note in a record's details folds to about its first dozen lines, ending in a short fade, with Show more under it opening the note in its own panel, as it reads, read only for those who may not change it. A note that fits shows in full. The note's row has the button for opening beside, a box with its right side marked, shown as a pencil is, in place of a pencil. A panel with no note panel to open, such as a person's details shown for another day, unfolds the note in place with Show more, and folds it again with Show less.
  - **Drawn by:** `FoldedNote` in `apps/web/src/folded-note.tsx`, on Mantine's `Spoiler`, with its fade's height from the theme's `--fathom-note-fade` in `apps/web/src/theme.ts`; the button by `OpenBesideButton` in `apps/web/src/row-controls.tsx`, which tables' details buttons share.
  - **Example:** Jarrod Mante's Onboarding note on People.
- **A long list:** A list in a record's details, such as a schedule's cycles, folds as a long note does: from where it starts, such as the current cycle, it shows its first few, with Show all (n) under them, which then reads Show less; items before the start fold above it, behind Earlier cycles (n), which then reads Hide earlier cycles, and while they do, the control under the list reads Later cycles (n), then Hide later cycles. Each control keeps its place and focus, so nothing moves under it. Every fold's control, a long note's Show more included, is a plain link in one small style.
  - **Drawn by:** `FoldedList` in `apps/web/src/folded-list.tsx`, with the controls' style `foldControl` from `apps/web/src/folded-note.tsx`.
  - **Example:** a schedule's Cycles in its details on Releases.
- **Columns follow the panel's order:** A table's default column order follows its details panel's sections and rows, and the other way round, defined once and used by both.
  - **Drawn by:** `featureColumnGroups` in `apps/web/src/project-grids.tsx`.
  - **Example:** Features, whose columns start Name, Status, Description, Notes, as its details' Details section does.
- **Actions on a list in a panel:** Actions on a list inside a details panel sit under the list, at its left, as outlined buttons without an icon, the main one first, so they sit where the next item would go and the list's heading stays a plain heading, as every other section's does. A picker that adds to the list, such as a feature team's Add member, is such an action: an outlined button under the list that opens the picker.
  - **Drawn by:** each panel draws its own.
  - **Example:** Add member under a feature team's members, in its panel on the Org chart's Feature teams.

## Panels and Focus

- **Opening and closing:** Choosing a record opens its details in a side panel, at its own address. Esc, the close button, or a click on the page outside the panel, the rows and the controls closes it. On a narrow screen, the panel covers the screen and keeps focus until it is closed. A panel listing records, such as the Org chart's Teams, is a side panel at its own address too, never a drawer.
  - **Drawn by:** `WithSidePanel` and `SidePanelFrame` in `apps/web/src/side-panel.tsx`.
  - **Example:** Offline Sync's details on Features.
- **Focus goes where expected:** Opening a panel or dialog puts focus on its first thing to read or change, such as the record's name. Closing it puts focus back where it was opened from, such as the record's Name cell. Choosing the × in a field keeps focus in the field. A value opened for changing in a details panel opens with its text selected, so typing replaces it.
  - **Drawn by:** `focusSoon` and `selectSoon` in `apps/web/src/focus.ts`, with `SidePanelFrame` in `apps/web/src/side-panel.tsx`.
  - **Example:** close Offline Sync's details: focus is back on its Name cell.

## Help

- **A Help page:** A Help page is drawn as [Visual Design](../../design/visual-design.md#layout) sets out, through the one rendering every note uses, never a renderer of its own. A link to a Help page, in a Help page or in any note, stays in Fathom, and a link whose text only repeats its address reads the page's title. Help is reached from the sidebar's Help section alone, with no button on each page.
  - **Drawn by:** `HelpPageView` in `apps/web/src/help-page.tsx`, through `NoteView` in `apps/web/src/note-editor.tsx` with `anchors`, its links by `NoteLink` there, and the pages from `apps/web/src/help-pages.ts`.
  - **Example:** select Help pages, then Pages, then the link to Lists.
