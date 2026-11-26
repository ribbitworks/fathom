---
title: "UI Conventions: Pages and Panels"
category: "Standards"
audience: "Contributors"
applies_to: ["apps/web/**", "docs/testing/**"]
dependencies: ["docs/standards/ui-conventions.md", "docs/design/visual-design.md"]
last_updated: "2026-11-26"
---

# Pages and Panels

Part of [UI Conventions](../ui-conventions.md): the top bar, the page heading, links to records, history, details panels, focus, and Help pages. Each entry gives the rule, the shared piece that draws it, and an example from the [fictional data](../../design/development-setup.md#fictional-data).

## The Top Bar

- **Where the user is:** The top bar names the sidebar's section and page. On an address below a sidebar item, such as a Help page, the item's name links back to its page, then comes what the address shows, such as the Help page's title.
  - **Drawn by:** The sidebar's items in `apps/web/src/layout.tsx`, where an item's `detailOf` names what an address below it shows.
  - **Example:** Select Help pages, then Lists: the top bar reads Help / Help pages / Lists.

## The Page Heading

- **The row under the heading stays put:** Every page's heading is one line: the title; where the page shows its records more than one way, the switch between them, centred on the title's line; and the page's actions at the right. A page's tabs, such as Projects', also sit there, after the title.
  - **No added rows:** Nothing adds a row between the heading and the search row, so the search row never shifts between pages.
  - **Height and gap:** On every page the heading is a button's height, and the gap under it is the theme's medium spacing.
  - **Drawn by:** `PageHeader` in `apps/web/src/page-header.tsx`. Its `beside` holds the switch, `ModeSwitch`, or the tabs, `HeadingTabs` with each tab's content in `HeadingTabPanel`, all in that file.
    - **The theme's height:** The heading's height is the theme's `--fathom-heading-height` in `apps/web/src/theme.ts`. Each page puts the gap after it.
  - **Example:** Table and Board beside the Features heading.
- **Actions on ticked rows:** While a table's rows are ticked, the actions on them join the page's actions at the right of its heading. Each names how many it acts on, such as Approve 3 drafts… or Publish 2 changes. Nothing is added between the heading and the table.
  - **Drawn by:** The page's `PageHeader` `action`, as in `apps/web/src/drafts-page.tsx`, with the ticks from `apps/web/src/row-ticks.tsx`.
  - **Example:** On the Drafts page's To decide tab, as the Engineering Director, tick any row: Reject… and Approve 1 draft… show at the right of the heading.

## Links to Records

- **A record with an ID:** Wherever a project or proposal is named, in a cell, a link, a picker or a filter, its ID comes before its name, so similar names are told apart. The ID is dimmed in cells and links. Its details panel's title does the same; notifications name it alone.
  - **Drawn by:** `RecordName` in `apps/web/src/plan-table.tsx`.
  - **Example:** P-2001 Crane Control.
- **A record's key:** A record's key, such as #FEATURE-123, shows small and dimmed under its details' title and under a card's name. [Record key](../../design/domain-model.md#change-and-history-entities) sets out which records have keys.
  - **Copying:** The key under a title is a button whose menu offers Copy link and Copy key. The menus of a row, a card, an Org chart card's right-click and an added column offer Copy link. Copying changes nothing in view, so a notification says it was done.
  - **Not yet saved:** A record not yet saved shows no key and offers neither.
  - **Drawn by:** `RecordKey` and `CopyLinkItem` in `apps/web/src/record-key.tsx`, with a panel's key in `RecordPanel`'s `subtitle` in `apps/web/src/record-details.tsx`, and a table's `keyOf` in `apps/web/src/record-table.ts` for its row menus, Key column and search by key.
  - **On the Drafts page:** A draft's row and details carry its record's key. Each draft named under Approved with it, Waiting on it and Linked to comes after its record's key, small and dimmed, as a project's ID comes before its name. A draft of the planning settings has none.
    - **Drawn by:** The table's `keyOf` from `placeKey` in `apps/web/src/draft-places.ts`, and `KeyedName` in `apps/web/src/record-key.tsx`.
  - **Example:** The key under Offline Sync's title in its details beside Features.
- **Following a link:** A record named in a details panel links to its details, on its own page or tab, and the browser's back button goes back.
  - **Another page:** A link to a record on another page, such as Show in People on the Org chart, opens that page with the record's details open, not just a search for it. A project or proposal named in a feature's details on Features opens on Projects the same way, and Back returns to Features as it was.
  - **On Releases:** Each link opens on its own tab: a release's details link its schedule and cycles; a cycle's, its release and schedule; a schedule's, its current cycle and next release. A schedule's details also offer Show its releases and Show its cycles, opening those tabs filtered to it.
  - **On the Drafts page:** A draft's details offer Show on and its record's page, such as Show on People, only for a role that opens that page. The link opens the record, with its details open where that page has them. Under Linked to, each change links to its own details beside the table.
    - **Named in words:** The drafts under Approved with it or Waiting on it are named in words, not as links, as a decision's dialog names them: a recorded exception.
  - **Drawn by:** `RecordLink` in `apps/web/src/record-details.tsx`; the server's lookup by `goRoutes` in `apps/server/src/routes/go.ts`; Show on by the Drafts route's `recordLink` in `apps/web/src/router.tsx`.
  - **Example:** A customer in Offline Sync's details opens Projects' Customers tab with that customer's details.
- **Opening from a table:** On every table, a row opens its own record's details from the details button over its Name cell, or Show details in its menu, as [A row's controls](tables.md#tables) sets out.
  - **Other records in a cell:** Another record named in a cell, such as a project's features, is a link to its details on its own page, as in Following a link.
  - **Drawn by:** `RowControls` in `apps/web/src/row-controls.tsx`, through the table's `showDetails` in `apps/web/src/record-table.ts`.
  - **Example:** Point at any row on People.
- **Several records in a cell:** A cell naming several records lists them on one line, cut short where they don't fit, with every name in its tooltip, one to a line.
  - **In a details panel:** A details panel lists them one to a line, each linked to its record.
  - **A short list:** A list of records in a panel, such as a release's, cycle's or schedule's Features or a project's or release's Activities, folds past its first five as [A long list](#details-panels) sets out, and reads None when empty. Under it, buttons act on them: Show on Features and Show on the Board for features, and Add activity, for those who may, for activities.
  - **Show on its page:** For activities, the row's name is a link whenever there is one, showing them on their own page filtered to the record, read by its name and the page, such as "Activities, show on Activities". The record's ⋯ menu offers the same whenever the link shows, such as Show on Activities, and no button under the list does.
    - **Example:** Crane Control's Activities row and its ⋯ menu.
  - **Drawn by:** The cell's kind in `apps/web/src/cell-kinds.tsx`, its column from `recordsColumn` in `apps/web/src/plan-table.tsx`, and its tip from `TableTips` in `apps/web/src/table-tips.tsx`. In a panel, `RecordLinkList` in `apps/web/src/record-details.tsx`, with `ShortList` in `apps/web/src/short-list.tsx` for a short list, used by `FeatureList` in `apps/web/src/release-features.tsx` for a record's features. A row's name as a link, from its column's `showOn`, drawn by `Row` in `apps/web/src/record-details.tsx`, with `ShowOnItem` there for the menu, and for activities `activitiesShowOn` and `listingActivities` in `apps/web/src/activity-list.tsx`.
  - **Example:** Crane Control's Features cell.

## History

- **An entry:** Each entry is a sentence naming who did what, with details dimmed after a colon. Entries run newest first, each with its day, year and time. An entry worth a second look ends in a grey Worth checking box, as a fact does, since a dot always means a draft.
  - **Drawn by:** `EntryList`, `EntryRow`, `EntryDetails` and `WorthChecking` in `apps/web/src/history-entries.tsx`.
  - **Example:** The seeded rejections on the Change history page.
- **A change in words:** Wherever a change is described (a record's menu, a draft's details on the Drafts page, the change history), the field is semibold and each value sits on a light ground, like a value in code.
  - **In a table's cell:** In a table's cell, such as the Drafts table's What changes, it is lighter: the field in medium weight and each value on a fainter ground, so a column of changes doesn't outweigh the rows' names.
  - **Drawn by:** `PhraseText` and `PhraseList` in `apps/web/src/phrase.tsx`, with `PhraseList`'s `light` for the lighter form.
  - **Example:** The seeded draft of the Level column, Name from Level to Grade, in the Drafts table's What changes and in its details.
- **A record's own history:** A history in a record's details has a row per change, newest first, with a draft's row first, after its dot. Each row is dated the day it was drafted and keeps that date once approved. A row is never removed or struck through, since history is not undone.
  - **Drawn by:** `ScopeHistory` in `apps/web/src/scope-history.tsx`.
  - **Example:** Fleet Tracking Bid's scope history, where Report Builder was removed with a reason.

## Details Panels

- **One frame:** Every details panel is drawn in the one side panel frame. One shared piece spaces its sections; no panel spaces its own.
  - **Drawn by:** `SidePanelFrame` in `apps/web/src/side-panel.tsx`, through `RecordPanel` in `apps/web/src/record-details.tsx`, whose `subtitle` holds a record's key under its name, with `DetailSections` there spacing the sections.
  - **Example:** Any seeded person's details beside People.
- **A panel's menu:** A record's details panel has a ⋯ at its top, before its close ×, named Actions for the record.
  - **The same menu:** it opens the menu of the record's row on its table, less Show details: the same items, words and order, such as Copy link, Approve draft…, Reject draft…, Publish draft…, Resubmit and Discard draft.
  - **Acting:** each item does what it does from the row, and focus stays in the panel.
  - **A record that goes:** Discarding the draft that added the record takes it away, so focus goes to the table.
  - **Esc:** Esc closes the menu alone, keeping the panel open, as it does any dropdown open in a panel, such as a select's choices; the next Esc closes the panel. `SidePanelFrame` in `apps/web/src/side-panel.tsx` leaves an Esc that closes a dropdown to it.
  - **Nothing to offer:** A panel whose record's row would offer only Show details has no ⋯.
  - **Panels with their own:** A list's panel on the Lists page keeps its own menu of the list's drafts, and a feature team's panel on the Org chart its buttons at its foot, since neither is a shared table's record. A person's details beside the Org chart, which has no table, have none.
  - **Drawn by:** `PanelMenu` in `apps/web/src/panel-menu.tsx`, on `PanelMoreMenu` there, which draws every ⋯ menu in a panel, placed by `RecordPanel` in `apps/web/src/record-details.tsx`, with the items from the table beside it, `RecordGrid`, by `panelMenuItems` in `apps/web/src/row-menus.tsx`, the one piece the row's menu draws.
  - **Example:** On People, as the Engineering Operations Manager, open Mariana Metz's details and select its ⋯.
- **Follow the Person panel:** Every record's details follow Person details: the record's name and draft mark at the top, then headed sections of rows, then the columns an organization added, under Columns. A panel never mixes in another layout, such as labels over form fields.
  - **Labels:** A label sits beside its value while the panel is wide and over it once narrow. The labels form a column as wide as the section's longest, up to half the panel, so none wraps.
  - **Pencils:** Each value that can be changed has a pencil at its right, named Change and the label. The pencil shows while its row is pointed at or has focus, or always on a screen that can't be pointed at.
  - **Clicking the row:** Clicking anywhere on the row, label included, does the same as its pencil, and the row turns the hover grey while pointed at.
  - **Drawn by:** `RecordSection`, `Row`, `changeButton` and `RecordLink` in `apps/web/src/record-details.tsx`, with `useRecordEditing` in `apps/web/src/record-editing.tsx` for the pencils, and `ValueField` there for a value typed in place, which a scope history's reason for a removal also uses.
  - **Example:** Any seeded person's details beside People.
- **A draft's details:** A draft's details, beside the Drafts table, follow Person details. They show, in order:
  1. **The top:** The draft's record after its dot, with any fact boxes, and its record's key under it.
  1. **Under Details:** The table's columns, with What changes in its full form.
  1. **Under Approved with it, or Waiting on it once rejected:** The other drafts that deciding it takes along.
  1. **On Not published, under Linked to:** The user's own changes it is published and discarded with.
  1. **Then Approve… and Reject…:** While the role may decide it now, or else a dimmed line saying why not, such as Back with its maker to change and resubmit.
  1. **Last:** A link to its record on its own page.
  - **Drawn by:** `DraftPanel` in `apps/web/src/drafts-panel.tsx`, on `RecordSection`, `Row` and `RecordLinkList` in `apps/web/src/record-details.tsx`. The reasons' words come from `apps/web/src/draft-details.tsx`, which the row's menu shares.
  - **Example:** On the Drafts page's To decide tab, the details of Silje Holm-Schrøder's draft, approved with the new list, column and choice it uses.
- **A long note:** A note in a record's details folds to about its first dozen lines, ending in a short fade; a note that fits shows in full.
  - **Show more:** Show more under it opens the note in its own panel, as it reads, read only for those who may not change it.
  - **The row's button:** In place of a pencil, the note's row has the button for opening beside: a box with its right side marked, shown as a pencil is.
  - **No note panel to open:** A panel with no note panel to open, such as a person's details shown for another day, unfolds the note in place with Show more and folds it again with Show less.
  - **Drawn by:** `FoldedNote` in `apps/web/src/folded-note.tsx`, on Mantine's `Spoiler`, its fade's height from the theme's `--fathom-note-fade` in `apps/web/src/theme.ts`; the button by `OpenBesideButton` in `apps/web/src/row-controls.tsx`, which tables' details buttons share.
  - **Example:** Jarrod Mante's Onboarding note on People.
- **A long list:** A list in a record's details, such as a schedule's cycles, folds as a long note does.
  - **From its start:** From where it starts, such as the current cycle, it shows its first few, with Show all (n) under them, which then reads Show less.
  - **Earlier items:** Items before the start fold above it, behind Earlier cycles (n), which then reads Hide earlier cycles. While they do, the control under the list reads Later cycles (n), then Hide later cycles.
  - **The controls:** Each control keeps its place and focus, so nothing moves under it. Every fold's control, a long note's Show more included, is a plain link in one small style.
  - **Drawn by:** `FoldedList` in `apps/web/src/folded-list.tsx`, with the controls' style `foldControl` from `apps/web/src/folded-note.tsx`.
  - **Example:** A schedule's Cycles in its details on Releases.
- **Columns follow the panel's order:** A table's default column order and its details panel's sections and rows follow one shared definition.
  - **Drawn by:** `inGroupOrder` in `apps/web/src/record-table.ts`, from `featureColumnGroups` in `apps/web/src/feature-table.tsx`, `activityColumnGroups` in `apps/web/src/activity-table.tsx`, whose shared columns come from `planningColumns` in `apps/web/src/planning-columns.tsx`, and `customerColumnGroups` in `apps/web/src/project-grids.tsx`.
  - **Example:** Features, whose columns start Name, Status, Description, Notes, as its details' Details section does; Projects' Customers tab, whose columns run Name, Description, Notes, Projects, Proposals, Features.
- **Actions on a list in a panel:** Actions on a list inside a details panel sit under the list, at its left, as outlined buttons without an icon, the main one first. They sit where the next item would go, and the list's heading stays plain, like every other section's.
  - **Pickers:** A picker that adds to the list, such as a feature team's Add member, is such an action: an outlined button under the list that opens the picker.
  - **Drawn by:** Each panel draws its own; a plan record's details draw a list's from its column's `chooseWords` and `adds`, in `DetailRow` in `apps/web/src/plan-record-details.tsx`.
  - **Example:** Add member under a feature team's members, in its panel on the Org chart's Feature teams, or Choose features and New feature under a proposal's Features, in its details on Projects.

## Panels and Focus

- **Opening and closing:** Choosing a record opens its details in a side panel, at its own address. Esc, the close button, the record's row's details button, or a click on the page outside the panel, the rows and the controls closes it.
  - **Narrow screens:** On a narrow screen, the panel covers the screen and keeps focus until closed. Of panels stacked, the one opened last shows, such as a New form opened from a picker in a record's details, and closing it shows the one in front before it again. Of panels opened together, as on opening an address, the top one shows.
  - **Panels listing records:** A panel listing records, such as the Org chart's Teams, is also a side panel at its own address, never a drawer.
  - **Drawn by:** `WithSidePanel` and `SidePanelFrame` in `apps/web/src/side-panel.tsx`.
  - **Example:** Offline Sync's details on Features.
- **Maximizing:** A panel stacked under another, such as a note under a record's details or Metrics, has a Maximize button before its close button, showing four corners pointing out. It gives the panel the side column's whole height, folding away the panels above it, which keep what they hold.
  - **Restoring:** The button then shows the corners pointing in, named Restore, and brings them back as they were. Opening or closing any panel restores the stack too, so a panel opened shows.
  - **Not kept:** Maximizing is layout, as the panels' heights are, so the address doesn't keep it, and neither does the browser.
  - **No Maximize:** The top panel has no Maximize, and nor does a narrow screen, where only one panel shows.
  - **Drawn by:** `SidePanelFrame` in `apps/web/src/side-panel.tsx`, given its place in the stack by `PanelStack` there, with `maximizable` and `maximizedPanel` deciding which panel may be maximized and which is.
  - **Example:** On People, open Jarrod Mante's details, then his Onboarding note, and select Maximize on the note.
- **Focus goes where expected:** Opening a panel or dialog puts focus on its first thing to read or change, such as the record's name. Closing it puts focus back where it was opened from, such as the record's Name cell.
  - **A New form:** Opening a New form, on its own page or stacked under a record's details, puts the cursor in its first field typed into, such as Name, ready to type into, never on its title, which can't be changed. Esc in that field, with nothing typed to undo, closes the form, asking first when anything was entered. Enter in a field typed into adds the record, as Add does, refusing what Add would refuse; in a planned hire's Fill form, it fills the hire, as Fill does.
  - **Fields:** Choosing the × in a field keeps focus in the field. A value opened for changing in a details panel has its text selected, so typing replaces it.
  - **Drawn by:** `focusSoon` and `selectSoon` in `apps/web/src/focus.ts`, with `SidePanelFrame` in `apps/web/src/side-panel.tsx`; a New form's first field by `NewRecordPanel` in `apps/web/src/new-record-panel.tsx`, through `firstTypedInto` and `useFocusOnOpen` in `apps/web/src/record-editing.tsx`, which the Fill form shares; Enter by `NewFormEnter` and `useAfterUpdate` in `apps/web/src/new-form-enter.ts`.
  - **Example:** Close Offline Sync's details: focus is back on its Name cell. On Projects, select New project: the cursor is in Name.

## Help

- **A Help page:** A Help page is drawn as [Visual Design](../../design/visual-design.md#layout) sets out, its text through the one rendering every note uses, never its own renderer, and its diagrams as [Help Page Standards](../help-pages.md#rules) sets out. Help is reached only from the sidebar's Help section, with no button on each page. The Overview is the one exception: each job and task on it links to its section of a starting role's Help page.
  - **Links:** A link to a Help page, in a Help page or any note, stays in Fathom. A link whose text only repeats its address reads the page's title.
  - **Drawn by:** `HelpPageView` in `apps/web/src/help-page.tsx`, its text through `NoteView` in `apps/web/src/note-editor.tsx` with `anchors`, its links by `NoteLink` there, its diagrams coloured by `apps/web/src/help-page.module.css`, and the pages from `apps/web/src/help-pages.ts`.
  - **Example:** Select Help pages, then Pages, then the link to Lists.
