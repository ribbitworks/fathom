---
title: "UI Conventions: Tables, Addresses and Search"
category: "Standards"
audience: "Contributors"
applies_to: ["apps/web/**", "docs/testing/**"]
dependencies: ["docs/standards/ui-conventions.md", "docs/design/visual-design.md"]
last_updated: "2026-11-24"
---

# Tables, Addresses and Search

Part of [UI Conventions](../ui-conventions.md): tables, their views and groupings, what the address keeps, exporting, and search. Examples use the [fictional data](../../design/development-setup.md#fictional-data).

## Tables

- **Scroll bars:** Every table, timeline and board uses one style of scroll bar: slim and in the page's greys. It shows whenever there is more to scroll, so a wide view is seen to have more. Each scrolling frame with the style contains the visually hidden text of what it scrolls, so it never stretches the page.
  - **Drawn by:** `scrollBars` in `apps/web/src/pages.module.css`. Its size and colour come from the theme's `--fathom-scrollbar-size` and `--fathom-scrollbar-thumb` in `apps/web/src/theme.ts`.
  - **Example:** On Features, narrow the window until the table scrolls sideways.
- **Drafts in a table changed elsewhere:** A table whose records are changed outside it, such as in their details panel (every tab on Releases), still offers Publish draft…, Discard draft and Resubmit in a row's menu for a draft the user may change.
  - **A row for its parts too:** A row that stands for its parts' drafts as well as its own publishes, discards or resubmits the record's own draft.
  - **Drawn by:** `RecordGrid`'s `canEditDrafts`, one answer for the table or one for each row, such as a cycle's row carrying its release's draft on Releases' Cycles tab, with a table's `ownDraft`, in `apps/web/src/record-table.ts`, and the actions' `draftRef` naming the record each draft is of.
  - **Example:** On Releases' Schedules tab, a schedule drafted to be retired.
- **A row's controls:** While a row is pointed at, or its Name cell has focus, two buttons show at the right of the Name cell.
  - **The details button:** On a table whose records have details, a box with its right side marked, since the details open beside the table.
  - **The ⋯ button:** A ⋯ opens the row's menu, so it's in reach without scrolling to the row's end.
  - **One row at a time:** One row shows them at a time: the row whose menu is open, from its ⋯ or a right-click; else the row pointed at; else the row whose Name cell has focus.
  - **The ⋯ at the row's end:** Always shown.
  - **Right-click and keyboard:** A right-click anywhere on the row opens the same menu beside the pointer, except in a cell being typed in, which keeps the browser's own. Shift+F10 and the menu key open it from the keyboard.
  - **The menu:** A record's menu starts with Open and the column's name, such as Open Spec, for each Web link column holding a link. Then come Show details, where it has details, and Copy link, where it has a key. Then come the table's own items, such as Add note…, then Approve draft… and Reject draft… to a role that decides its draft now, then the user's own draft and the record itself, in this order:
    - **Publish draft…:** For the user's own unpublished draft. It publishes the draft with the changes it must go with, as [Publishing](entering-and-saving.md#publishing) sets out.
    - **Resubmit:** For a rejected draft.
    - **Discard draft:** For any draft the user may change.
    - **Remove:** Such as Remove person, for a record the user may change that its draft neither adds nor removes.
  - **Focus after an item:** Once Publish draft…, Discard draft or Remove acts, or the question Publish draft… asks closes, focus goes back to the row's cell.
  - **In its details:** The same menu, less Show details, opens from the ⋯ at the top of the record's details panel, as [A panel's menu](pages-and-panels.md#details-panels) sets out.
  - **No row header:** There is no row header at the left: the slot before the first value keeps the draft's dot.
  - **Drawn by:** `RowControls` and `MoreButton` in `apps/web/src/row-controls.tsx`, placed by `nameCellControls` in `apps/web/src/row-menus.tsx` in the column its table names as `nameColumn`, the menu's items by `recordActionItems` there, from the rule `recordMenuOffer` in `apps/web/src/menu-offer.ts`, with the record's details from the table's `showDetails`, and the menu beside the pointer by `MenuAtPoint` in `apps/web/src/app-menu.tsx`, which a card's `CardMenu` uses too.
  - **Example:** On People, point at any row, or right-click its Start cell.
- **Moving columns:** Anyone who sees a table can move any of its columns, built-in or added. A new table is drawn by the shared table, so its columns move too.
  - **Part of the view:** Column order, hiding, freezing and widths are part of the view, never a draft. So each user has their own, and nothing needs approval.
  - **Kept and cleared:** They are kept in the address, saved views and [the last view](#tables), and cleared by Clear all and Clear view. Every view starts from the table's own order.
  - **Drawn by:** `columnHeaders` in `apps/web/src/column-header.tsx`.
  - **Example:** On Features, select Move left in the Priority column's menu.
- **Hiding columns:** Anyone who sees a table can hide any column, required ones included, except the column naming each record. A new table is drawn by the shared table, so its columns hide too.
  - **The menus:** Hide column is in the column's menu, with Freeze up to this column, the width items, and Move left and Move right. The table's Views menu shows the column again; a board's leaves out what only changes the table, as [Menus above a board](dates-timelines-and-boards.md#boards) sets out.
  - **What stays:** A hidden column keeps its filter, its place in the sort and its place in the order. Its filter's pill stays, so nothing narrows the rows unseen. Metrics still offer it.
  - **Frozen columns:** Hiding a frozen column leaves one fewer frozen.
  - **What leaves it out:** An export, and so the question before exporting Personal or Confidential data. The empty row skips it, but still names a required one it needs, such as Site needed. A new record's form shows every column.
  - **Shared views:** Hidden columns reveal no value, so they don't decide who sees a shared view.
  - **Drawn by:** The column menu in `apps/web/src/column-header.tsx`, with the view's hidden columns kept by `withHidden` in `apps/web/src/table-view.ts` and listed by `ViewsMenu` in `apps/web/src/table-controls.tsx`.
  - **Example:** On People, select Hide column in the Site column's menu, then Site under Hidden in the Views menu.
- **Columns hidden at first:** A table may start a column hidden, such as the Key column. Showing one is kept in the view and saved with it, as hiding a column is.
  - **Drawn by:** A column's `hiddenAtFirst`. `apps/web/src/table-view.ts` keeps the view's shown columns, and the server sends and keeps them as `shown` in `packages/shared/src/views.ts`.
  - **Example:** On People, Key under Hidden in the Views menu.
- **Ticking rows:** A table that acts on several rows at once has a tick box before each row's slot. Actions on the ticked rows show in the page's heading (see [Actions on ticked rows](pages-and-panels.md#the-page-heading)).
  - **Ticking every row:** A box in the first header cell ticks every shown row that can be ticked, and says aloud how many are ticked.
  - **Keyboard:** Space on a row's first cell ticks it.
  - **Rows that can't be ticked:** A row that can't be ticked has its box greyed out.
  - **Rows no longer shown:** A row the view stops showing, by a search, a filter or a tab, is unticked.
  - **Linked rows:** Rows that act only together are ticked and unticked together. Each one's tip names the others, three then a count of the rest, such as Linked to the change to Laptop in Equipment. A row linked to one the view hides can't be ticked, and its tip ends not shown in the table.
  - **Drawn by:** `RowTick`, `AllTick`, `tickedOf` and `withTicks` in `apps/web/src/row-ticks.tsx`, given to `RecordGrid` as `ticks` in `apps/web/src/record-table.ts`.
  - **Example:** On the Drafts page's Not published tab, as the Engineering Operations Manager, point at the tick box of Equipment.
- **The Key column:** Every shared table whose records have keys has a Key column. It shows each record's whole key and is as wide as the longest.
  - **Its place:** It is hidden at first and placed after the column naming each record.
  - **Sorting and filtering:** It sorts and filters by the key's number.
  - **New rows:** A new row, not yet saved, shows no key.
  - **Drawn by:** `keyColumn` in `apps/web/src/grid-columns.tsx`, placed by `RecordGrid` from the table's `keyOf`.
  - **Example:** On People, choose Key under Hidden in the Views menu.
- **Filtering a column:** A column's filter that offers its empty values, such as Empty, No date or No number, also offers every value that isn't empty, under it and in the same style: Not empty, or Any date and Any number to match No date and No number.
  - **On a choice column:** Not empty comes after Empty, under the choices in use.
  - **One or the other:** Ticking one unticks the other, since both would show every row.
  - **The pill:** Every filter's pill names its column, a colon, then what it filters by, in the filter's own words for empty values, such as Onboarding: contains “plan” or Empty, and Start: from Mar 1, 2024 or No date.
  - **Not empty's pill:** Not empty shows every row with a value, whatever else the filter holds, so its pill names it alone, such as Onboarding: Not empty.
  - **Checkbox columns:** A checkbox column is never empty, so it offers none.
  - **Drawn by:** `FilterForm` and `describeFilter` in `apps/web/src/table-controls.tsx`, with the match in `apps/web/src/table-rows.ts` and the filter's `notEmpty` in `packages/shared/src/views.ts`.
  - **Example:** On People, tick Not empty in the Onboarding column's filter.
- **Filtering across a table:** A filter that is no one column's, such as a feature in any month of a grid of months, has a button of its own after the search field, named for what it filters by, such as Allocations on Capacity's Allocations. It opens the same filter as a column's, beside the button, and focus goes back to the button when it closes. While it filters, the button is marked with a dot, as the Draft menu is, and its pill names it as a column's does, such as Allocated to: Offline Sync. The view, the address and saved views keep it as they keep a column's filter.
  - **Drawn by:** a table's `barFilters` in `apps/web/src/record-table.ts`, each a `BarFilter`, drawn by `BarFilterButton` in `apps/web/src/table-controls.tsx` with `FilterPopover`, and filtering the rows with the draft filter through `filtersBesideColumns` in `apps/web/src/table-view.ts`.
  - **Example:** on Capacity's Allocations, select Allocations, then Offline Sync.
- **What the Views menu holds:** Besides the sort, saved views and Clear view, the Views menu may hold choices of which records the table shows beyond its filters. A page's modes and switches stay where they are.
  - **The choice:** It is a ticked item, first in the menu, kept in the address and saved with the view, and is offered while it would change the rows or while it is on.
  - **Adding records:** A choice that shows records otherwise left out, such as Show retired, says how many it adds, such as Show retired (1). Save view's Includes names it Show.
  - **Keeping only some:** A choice that keeps only the records matching it, such as Over, says how many it keeps, such as Over (4). With two on, the table keeps the records matching either. Save view's Includes names it Only.
  - **Drawn by:** `hiddenUnlessShown` and `keptByChoices` in `apps/web/src/view-choices.ts`, each giving a `ViewChoice` from `apps/web/src/table-controls.tsx` as `RecordGrid`'s `viewChoices` in `apps/web/src/record-table.ts`, shown by `ViewsMenu` as a `MenuToggle` from `apps/web/src/app-menu.tsx`, and named in Save view's Includes by `viewParts`.
  - **Example:** Show retired (1) in the Views menu on Releases, once Patches' retirement is approved; Over and Under on Capacity's Allocations.
- **Saved views on every page:** Every page with saved views gets them from one hook, so no page has its own. The hook reads the table's views; saves, renames, updates, shares and deletes them; and draws the Save view and Rename view dialogs.
  - **What a view keeps:** The search, filters, sort, groupings, metrics and column choices.
  - **Its name:** Unique, ignoring letter case, among the table's shared views and among each user's personal views on it.
  - **Personal:** Only its maker sees and changes it, and only they see its changes in the change history. A view the maker's role can no longer use is sent by name and what it's missing, never its filters. It shows dimmed under My views, with a line saying so, and offers only Rename… and Delete…, neither undone.
  - **Shared:** Sharing shows others only the changes made after it. Stopping sharing hides them all again; only the maker may stop sharing, and only while they may still share.
    - **Changing it:** Only the maker, or someone who may share views on the table, updates, renames or deletes one.
    - **Kept from a reader:** A shared view is kept from a reader when it filters, sorts, breaks down or groups by a column they can't see, at either level, or groups by data they can't see.
  - **Pages not opened:** A role that doesn't open a table's page is sent none of its views. The views are kept, and come back with the page.
  - **The menu:** While a view is applied, Save as new view… sits beside Update view, and Stop sharing current view makes a shared view personal again. The menu names the view the address started from, marked once the view has changed. With none applied, it is marked once the view differs from the table's default.
  - **One view, two forms:** Features' table and Board share one view. It keeps the Board's columns and card parts, but not which form shows. The Board's Views menu leaves out what only changes the table (its sort, units, and hidden, frozen, moved and widened columns), which stays in the view and shows again on the table. Each of Projects' tabs has views of its own, while a view on Drafts keeps its tab.
  - **The last view:** A page opened from the menu shows its last view (see [Kept in the address](#the-address)), even when it is the page already open. The server keeps it for each account and page, so it follows the account to another browser.
    - **What it holds:** The tab, the view, the saved view it started from and Features' Table or Board. It never holds the record shown, an open form, a note's panel or the time shown, such as People's date, the Board's first cycle or a month grid's quarter.
    - **Addresses:** An address naming a view, as a link does, wins and becomes the last view. An address naming a tab other than the page's first shows the last view only if it was on that tab.
    - **Clear view and history:** Clear view makes the default the last view. A last view isn't a draft and has no history.
    - **Reading it:** Reading it leaves out what the role can no longer see, as a saved view does.
  - **Drawn by:** `useSavedViews` in `apps/web/src/saved-views.tsx`, keeping the last view through `useLastView` in `apps/web/src/last-views.ts`. The views are in `ViewsMenu` in `apps/web/src/table-controls.tsx`, and the naming dialog is `ViewDialog` in `apps/web/src/view-dialog.tsx`.
    - **The address a page opens on:** `apps/web/src/last-views.ts` also gives `lastViewAddress`, the address a page opens on, given to `RecordGrid` as `saved`, or straight to `ViewsMenu` on the Org chart, which has no table, and `opensLastView`, which says when, with `menuChoice` carried by the menu's links.
  - **Example:** On Releases, type Patches in the search box and choose Save view… in the Views menu.
- **Group by starts with none:** Every table, and every view showing the same records another way, such as a board, opens with its rows in one list, unless [the last view](#tables) groups them. A board keeps a grouping chosen in its table where both offer it.
  - **The menu:** The Group by menu lists None first, then the table's groupings, such as Cycle, Release and Needed by on Features. Choosing None leaves nothing in the address.
  - **The button:** While nothing is grouped, the menu's button reads Group by alone, not Group by: None. Once a grouping is chosen, the button names it, such as Group by: Cycle.
  - **Clear grouping:** While rows are grouped, Clear grouping puts them back in one list, and clears Then by's grouping too. It is set apart at the end of the menu, as Clear view is in the Views menu.
  - **Drawn by:** The `groupings` of a table in `apps/web/src/record-table.ts`, read by `activeGrouping` in `apps/web/src/table-view.ts` and the Group by menu in `apps/web/src/table-controls.tsx`.
  - **Example:** On Features, choose Feature team in Group by, then switch to Board: the rows are feature teams.
- **The groups' order:** Groups run in their first order: earliest first, A to Z, or in their list's order. The group for none, such as No date, No manager or Later, comes last, on every table and board.
  - **Two orders:** While rows are grouped, the Group by menu offers two orders after its groupings, under a line. The second order turns the groups round, with the group for none at the top.
  - **Their names:** They are named by what the groups are: Earliest first and Latest first for times, such as cycles and months; A to Z and Z to A for names, such as managers, feature teams and projects; and List order and Reverse list order for a list's choices, such as statuses.
  - **The first grouping alone:** Then by's headings keep their order under each heading.
  - **Starting again:** Choosing another grouping, None or Clear grouping goes back to the first order.
  - **Part of the view:** Kept in the address and in saved and remembered views, and named in Save view's Includes as Group order. A view without it opens with the first order. The button names only the grouping, since the headings show the order.
  - **Drawn by:** `byGroupRank` and `rankOfNone` in `apps/web/src/row-groups.ts`, from each grouping's `holds`, with the choices drawn by `GroupOrderChoices` in `apps/web/src/table-controls.tsx`, used by every table and by `FeatureBoard` in `apps/web/src/feature-board-view.tsx`.
  - **Example:** On Features, choose Needed by in Group by, then Latest first: No date is the first heading.
- **A record under several headings:** Grouped by a column holding several values, a record has a row under each of its values. Each is its own row for focus and the keyboard. A record with no value shows under the column's words for none.
  - **Its mark:** A dimmed +1, or +2 and on, after its name. Its tip names the other headings, such as Also under P-2001 Crane Control. Grouped by two levels, the tip names each other place by the groups it differs in, giving both as the first, a colon and the second, such as Also under Priya Raman: Northmere.
  - **Counts:** Each heading counts its own records, while the table's count, Metrics and exports count each record once.
  - **One record:** A change in one row shows in all, the arrows step through every row, and a draft marks each, with its Live row under each.
  - **Focus:** Closing a record's details puts focus on its cell in the row last used, or else its first.
  - **Drawn by:** `RecordGrid` in `apps/web/src/record-grid.tsx`, with `AlsoUnder` in `apps/web/src/grid-groups.tsx` and `focusRecordCell` in `apps/web/src/grid-row.tsx`; a grouping's `of` gives a record's groups, and `byChoice` in `apps/web/src/choice-grouping.ts` a group for each choice; the Features Board's cards use the same `AlsoUnder`, and `focusCard` in `apps/web/src/feature-card.tsx`.
  - **Example:** On Features, choose Projects in Group by: a feature two projects need shows under both, each row marked +1. On People, choose Feature teams: Lorenza Thiel shows under Payments core and Search.
- **Grouping under each heading:** Once rows are grouped, Then by groups them again under each heading.
  - **The menu:** Then by has its own label, after Group by's choices in the same menu. It offers the same columns less the first, starting with None.
  - **The button:** The menu's button names both, such as Group by: Manager, then Site, so the second level takes no room of its own in the bar.
  - **Taking it away:** Choosing None, or the second level's column, in Group by takes the second level away.
  - **Its headings:** Set in under their first-level heading, smaller and lighter, each counting its own rows. A second-level group with no rows under a heading isn't shown there. Headings don't fold.
  - **Not offered:** A page that draws its rows another way, such as a board, or whose rows are made for their grouping, such as the month grids, offers no Then by.
  - **Drawn by:** `GroupingMenu` in `apps/web/src/table-controls.tsx`, the view's `thenBy` read by `activeThenBy` in `apps/web/src/table-view.ts`, and the headings by the table's rows in `apps/web/src/grid-row.tsx`, with a table's `oneLevel`, in `apps/web/src/record-table.ts`, for rows made for their grouping.
  - **Example:** On People, choose Manager in Group by, then open the menu again and choose Site under Then by.

## Staying Put

- **Nothing moves while it's being changed:** A row keeps its place and its group while it is edited, until the view next changes, so a sorted or filtered table doesn't jump. No column's width follows what is typed.
  - **Records added:** Until the view next changes, records the user adds stay at the end, matching or not. Records others add appear at the end only if they match.
  - **Drawn by:** `useShownRows` in `apps/web/src/grid-groups.tsx`.
  - **Example:** On Features, change Report Builder's Target cycle: it stays under its heading until the page is reloaded.

## The Address

- **Kept in the address:** Everything a page shows is kept in its address: the tab, the mode, the view (its search, filters, sort, groupings, metrics, frozen columns, column order, hidden columns, widths and units), the record shown in a panel, an open form, such as New or Fill, a note's panel, and the date shown.
  - **What that gives:** So reloading shows the same, a shared link shows it to others who may see it, and the browser's Back goes back through what was shown.
  - **A note's panel:** It is kept by its column and its record, whether opened from the record's details or from a table's cell, each kept apart so neither closes the other. It opens as any note does: who may write is decided as it opens, and anything typed but not saved is lost.
  - **Not kept:** Dialogs and menus aren't kept: a link's request to open a role's dialog or a column's menu is taken out of the address once used. A chart's zoom and pan aren't kept, and neither is a selection of rows, such as drafts chosen to approve.
  - **Opened from the menu:** A page opened from the menu, with no view in its address, opens on the tab, mode and view it last showed the account, but not on a record or a date.
  - **Back's history:** Changing the date shown adds to Back's history, as moving to another page does. So does any other choice of what to show, such as a switch or Show retired. Typing in a search replaces the current entry.
  - **Drawn by:** Each page's search parameters in `apps/web/src/router.tsx` and `apps/web/src/plan-routes.tsx`, with a table's view in `apps/web/src/table-view.ts`.
    - **A note's panel:** On every page, `noteSearch` on the signed-in route in `apps/web/src/signed-in-route.tsx`, with its address from `apps/web/src/note-address.ts`. `useNoteEditing` in `apps/web/src/note-editing.tsx` keeps it, and its row, `Row` in `apps/web/src/record-details.tsx`, opens it again when `useRecordEditing` in `apps/web/src/record-editing.tsx` asks.
    - **A note opened from a table's cell:** `tableNote`, kept and opened again by `useTableNoteAddress` in `apps/web/src/grid-note-address.ts`.
  - **Example:** On Projects, select the Customers tab and reload.
- **A record's link:** A link to a record is its kind and number after `/go/`, such as `/go/feature/123`. Its key typed after `/go/`, such as `/go/FEATURE-123`, opens the same.
  - **Opening it:** The link replaces itself with the address of the page that shows the record, details open, so Back returns to where the reader came from. A filled planned hire's link opens the person who filled it.
  - **No record:** A link that opens no record shows "Nothing found for" its key. To those whose History shows the removal, it says the record was removed.
  - **Access history:** Following a link records nothing in the access history; the page opened records what it shows, as always.
  - **Drawn by:** `recordLinkPath` in `packages/shared/src/record-keys.ts`, `followLink` in `apps/web/src/record-links.ts`, `RecordNotShown` in `apps/web/src/go-page.tsx`, and the server's lookup in `apps/server/src/routes/go.ts`.
  - **Example:** Copy Offline Sync's link from its key on Features, then paste it into the address bar.
- **The Org chart's address:** The Org chart keeps feature teams as `teams=feature`, the levels shown as `levels` (a count from the top, or `all`), and the team shown alone as `team`, by the manager's Fathom ID. `view=feature-teams` opens Feature teams too, and a team named by its manager's Employee ID opens that team.
  - **Drawn by:** The Org chart's search parameters in `apps/web/src/router.tsx`, with its view in `packages/shared/src/view-tables.ts`.
  - **Example:** On the Org chart, choose Feature teams and 3 levels, and reload.
- **Back to another page:** The browser's Back is the way back. A Back to button is offered only where Fathom itself jumps to another page.
  - **Drawn by:** No page offers one.
  - **Example:** None.
- **Kept in this browser:** A person's own settings for how Fathom looks are kept in the browser, not the address: Light or Dark, the collapsed sidebar, side panel widths and shares, the timeline's zoom, and the role last acted as, which the server remembers for each browser.
  - **Drawn by:** The piece that owns each, such as `apps/web/src/side-panel.tsx` for panel widths.
  - **Example:** On the Releases page, choose Quarter on the timeline and reload.

## Exporting

- **Exporting what a table shows:** A page whose table can be exported has an Export icon in its heading, before its main action. It opens CSV file and TSV file, and leaves the bar above the table its room for filters. A table offers it only once it says what its export holds.
  - **What it holds:** The file matches the screen: the search, filters and sort, and the columns shown, in their order and units, only those the role sees.
  - **Personal or Confidential data:** An export holding Personal or Confidential data asks first, naming each class in its colour and its columns (see [Data Classes](../../design/pages/administration.md#data-classes)). It is recorded once confirmed and a place to save it is chosen.
  - **Drafts:** As the Draft menu shows them: beside live, each drafted record's draft row, then its Live row; applied, the records as drafted; live only, the records as they are.
    - **The Draft column:** A Draft column says Yes on each row that differs from live, under every choice, and is empty on every other row, so a spreadsheet's filter can leave out either.
    - **The Change column:** A Change column says what the draft does, such as Added, Changed, not published, or Added, rejected. Under live only, it says what a waiting draft would change, as its green dot's tip says.
  - **Rows:** Always flat, whatever the grouping, since spreadsheets filter and sort only rows without headings. Total rows are left out; a record under several headings is in the file once.
  - **Values:** Numbers without their unit, which the heading names, such as Effort (PD); days as 2027-03-31; several values joined by a semicolon and a space; notes as plain text in one cell; checkboxes as Yes or No; a link as its address, or its text and its address in brackets.
    - **Values a spreadsheet would run:** A value other than a number that starts with =, +, -, @, a tab or a carriage return gets an apostrophe before it, so a spreadsheet shows it rather than running it.
  - **The file:** UTF-8 with a byte order mark, so spreadsheets read names in any script, and lines ending in a carriage return and line feed. A value holding the separator, a quote or a line break is quoted per RFC 4180, in TSV as in CSV.
  - **The name:** Lower case, its parts joined by underscores and each part's words by hyphens: fathom, the page, the saved view if one is applied, the exporter's account name, drafts-and-live or drafts if it holds any, and the day shown, such as fathom_people_engineers_engineering-director_drafts-and-live_2027-03-31.csv.
  - **Saving:** The browser's Save dialog opens with the name filled in where the browser offers one, as Chromium browsers do; Safari and Firefox follow their download settings. Cancelling saves and records nothing.
  - **Drawn by:** `PageExportMenu` and `useOfferedExport` in `apps/web/src/page-export.tsx`, offered for a table by `useTableExport` in `apps/web/src/table-export.tsx` from the table's `exported` in `apps/web/src/record-table.ts`, `ExportQuestion` in `apps/web/src/export-question.tsx`, and the file from `apps/web/src/exports.ts`.
  - **Example:** On People, as the Engineering Director, choose the Export icon, then CSV file.

## Search

- **Finding rows:** A search field above a table finds rows with every word typed anywhere in them, ignoring letter case and accents. When nothing matches, the table says so.
  - **Keyboard:** Cmd+F on a Mac, or Ctrl+F elsewhere, goes to it from anywhere but a dialog. Esc clears it, then leaves it, going back to the table where it can.
  - **The Key column:** The search leaves out the Key column, since its numbers would match inside other words; a whole key typed finds its record.
  - **The Org chart's finder:** It takes the same Cmd+F or Ctrl+F, and Esc clears it.
  - **Drop-down lists:** Typing in any drop-down list, such as the Org chart's finder, finds options the same way.
  - **Drawn by:** `TableSearch` in `apps/web/src/table-controls.tsx`. In a drop-down list, it is the `byWords` filter every `Select` takes from `apps/web/src/theme.ts`; any other searchable Mantine list, such as `MultiSelect` or `Autocomplete`, needs it too.
  - **Example:** Type offline in the search field on Features.
