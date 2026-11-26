---
title: "Visual Design"
category: "Design"
audience: "Contributors"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/standards/ui-conventions.md"]
last_updated: "2026-11-25"
---

# Fathom: Visual Design

How Fathom's screens look and behave, so every page is built the same way. The principles and conventions every screen shares, with the piece that draws each, are in [UI Conventions](../standards/ui-conventions.md).

It applies the components and typeface chosen in [ADR 0004](../adr/0004-ui-components.md). The theme in `apps/web/src/theme.ts` holds the values; this document holds the rules, and each page's own design is in its page document.

## Pages

- **[People](pages/people.md):** the People table's date row, a person's details, and grouping.
- **[Org chart](pages/org-chart.md):** the chart of reporting and feature teams, its cards, and its team panels.
- **[Capacity](pages/capacity.md):** who is on which feature team and allocated to what, month by month, and the planning settings.
- **[Projects](pages/projects.md):** the tabs for projects, proposals, customers, and milestones, and their details.
- **[Features](pages/features.md):** the features table and the Features Board.
- **[Activities](pages/activities.md):** the activities table, built as Features' is.
- **[Releases](pages/releases.md):** releases, cycles, and schedules, on a timeline over a table.
- **[Administration](pages/administration.md):** Accounts, Roles, Settings, Lists, and Data classes.
- **[History pages](pages/history.md):** Change history and Access history.
- **[Sign-in and problem pages](pages/sign-in.md):** signing in, the first password change, and the problem pages.

## Layout

- **Frame:** A deep-water sidebar on the left, the same in light and dark mode, groups pages into sections. It shows only the pages the user's role allows.
  - **First page:** Fathom opens on the Overview, or, for a user who may not see the plan, the first page their role allows, else Help's index.
  - **Help:** The last section, open to everyone, holding Help pages and About Fathom.
- **Top bar:** It names where the user is, as [The Top Bar](../standards/ui-conventions/pages-and-panels.md#the-top-bar) sets out, and holds the account menu.
  - **Account menu:** The email address, then the role acted as, then Change name…, Change password…, Appearance (System, Light, Dark), and Sign out.
  - **Several roles:** A Role group ticks the role acted as. Choosing another switches at once, without signing in again; a page the new role doesn't allow gives way to the first one it does.
- **Collapsed sidebar:** A rail of icons, each naming its page on hover or focus. Each item keeps its height, and a section's heading becomes a thin line of the same height, so nothing moves. The choice is remembered.
- **Narrow screens:** The sidebar opens from a menu button, and closes when the user moves to another page.
- **Pages:** Each starts with its heading, as [The Page Heading](../standards/ui-conventions/pages-and-panels.md#the-page-heading) sets out. The main action is at the right, after the Export icon where the table exports, as [Exporting](../standards/ui-conventions/tables.md#exporting) sets out. Content sits in bordered panels on a canvas a shade darker than them.
- **Help pages:** Help pages opens Help's index, `docs/help/index.md`. Each Help page has its own address, open to every role, as [Help](../standards/ui-conventions/pages-and-panels.md#help) sets out.
  - **Look:** Its title is the heading, and the rest is one bordered panel as wide as the page, drawn as a note reads, with its headings as anchors.
  - **Diagrams:** Drawn at their own size, so their words never shrink, and scrolled sideways with the slim scroll bar when the panel is narrower. Boxes are edged as the Org chart's cards are, on the panel's colour, and arrows and their words are in its lines' grey, light or dark.
- **About Fathom:** It opens a box in the middle of the screen, over the current page. Dialogs open near the top, but this one asks nothing of the user.
  - **Rows:** Under Fathom's mark and name: Version, Commit, and Committed, as [Version and Build](development-setup.md#version-and-build) sets out. Commit adds "modified" for a build from changed files.
  - **Unknown:** A build given nothing from git, as [Development Setup](development-setup.md#ways-to-run-fathom) describes, shows each row as Unknown.
- **Why something is missing:** A page or view a role can't fully see is left out, never shown cut down, as [A page without its data](../standards/ui-conventions/drafts-and-values.md#access) sets out.

## Type and Colour

- **Typeface:** IBM Plex Sans, at weights 400 for text, 500 for emphasis, and 600 for headings and names. Weight 700 is bundled for Mantine's own bold text, such as table headings.
- **Figures:** Dates, times, and numbers that line up in columns use figures of equal width.
- **Colours:** Defined once in the theme as CSS variables and used by name, never written into a page.

## Components

- **Menus and popovers:** Every menu, popover and drop-down list stands out from the page, and from a tinted row or a panel beneath it, by a darker edge and a clear shadow, in light and dark mode alike, from the theme's `--fathom-overlay-edge` and `--fathom-overlay-shadow`. A new menu or popover uses Mantine's, with no shadow or edge of its own. A menu taller than the room left in the window is held to it and scrolls inside itself.
- **Tables:** Lists of records are tables in a panel, using the full width, as [Tables](../standards/ui-conventions/tables.md#tables) sets out.
  - **Cells and headers:** Each cell is one line, cut short when it doesn't fit. Headers are small, semibold, and dimmed, and stay in view while the rows scroll.
  - **Lines:** The lines between rows and columns are a shade darker than Mantine's, from the theme's `--fathom-row-line`, so rows stand apart. A line within a cell over a sum, such as a month's Over on Capacity's Allocations, is fainter, from `--fathom-sum-line`, so it never reads as another row.
  - **Long tables:** Such as People or Accounts, fill the window and scroll within it. People's rows are dense for editing.
  - **Row menu:** Behind a ⋯ at the row's end, always shown, and opened as [A row's controls](../standards/ui-conventions/tables.md#tables) sets out.
  - **No audit detail:** Rows don't show who changed a record or when. Dates follow [Dates](../standards/ui-conventions/dates-timelines-and-boards.md#dates).
  - **Coloured names:** A team or release with a colour shows its square before its name, as [A coloured name](../standards/ui-conventions/drafts-and-values.md#values) sets out.
- **Side panels:** Every side panel, such as a record's or the Metrics panel, sits beside the content, which narrows and stays usable. Panels open, close, and hold focus as [Panels and Focus](../standards/ui-conventions/pages-and-panels.md#panels-and-focus) sets out.
  - **Width:** The edge drags, or moves with the arrow keys, and the width is kept, starting at 640 pixels. Lists' record panel keeps a width of its own.
  - **Stacking:** Panels open together, such as a note and Metrics, stack, each scrolling on its own, with at least a fifth of the height, or as little as a stacked New form needs. A New form stacked under a record's details is as tall as its fields, with no edge beside it to move, while every other panel keeps at least a fifth, the form scrolling where that leaves it too little; Maximize gives it the column. A person's details with their timeline open under them are as tall as they hold too, at most half the column, scrolling past that. It comes and goes without the slide, and alone, maximized or on a narrow screen it fills the column as any panel does. Only the one opened last shows on a narrow screen. A panel under another can be maximized, as [Maximizing](../standards/ui-conventions/pages-and-panels.md#panels-and-focus) sets out, folding the panels above it away and back as a panel closing or opening does.
  - **Motion:** A panel slides in from the right, unless the computer asks for less motion.
  - **Edge:** Once what a panel holds is scrolled, a thin line under its heading shows where it goes out of view, as the line over its foot does.
  - **Heading:** A panel's heading holds its title, then its buttons at the right: a record's ⋯ menu, as [A panel's menu](../standards/ui-conventions/pages-and-panels.md#details-panels) sets out, then Maximize on a panel stacked under another, then the close ×.
  - **Labels:** Beside their values while the panel is wide, over them once it is narrow, following the panel's width, not the window's. A record's details follow [Details Panels](../standards/ui-conventions/pages-and-panels.md#details-panels).
- **Text fields:** As [Fields](../standards/ui-conventions/entering-and-saving.md#fields) sets out.
- **Entering data:** Lists of items are edited in place, from the keyboard, as [Entering Data](../standards/ui-conventions/entering-and-saving.md#entering-data) sets out.
- **Editing like a spreadsheet:** Tables where many records are entered, such as People, work as [Entering Data](../standards/ui-conventions/entering-and-saving.md#entering-data) and [Refusals](../standards/ui-conventions/entering-and-saving.md#refusals) set out.
  - **Derived columns:** A column that follows from another, such as Team from Manager, is read only, and pasting into it is ignored. Filled-in values follow [Values](../standards/ui-conventions/drafts-and-values.md#values).
  - **New rows:** Once something is typed, the row shows a new record's starting values. The added record shows at once as a draft. On People, State decides between a person and a planned hire, as [Adding a Person or Planned Hire](pages/people.md#adding-a-person-or-planned-hire) sets out.
  - **List columns:** Typing narrows the choices, which drop below the cell; a check marks each one picked where several can be.
  - **Web link columns:** A link shows its text, or else its host without `www.`, however long the address, with the whole address on hover. It opens in a new tab, as [Misleading links](../security/security-plan.md#tampering) sets out. Editing opens a small form for the address and the text.
  - **Checkbox cells:** Such as Manager? on People. A click, Space, or Enter toggles the box; typing does nothing.
  - **Widths:** Each column starts as wide as what it holds, up to about 30 characters, its cells up to 24 in the column naming each record, such as People's Name, and never follows typing. Anyone can set it narrower or wider, as part of the view, and Reset width brings back its start.
  - **Column menu:** Grouped as the column's link; sorting; filtering, Metrics, and units; freezing, width, moving, and hiding; then changing and removing, and its class.
    - **In order:** Copy link | the sort orders | Filter…, Metrics, Show in and Decimal places, where a column has units | Freeze up to this column, Unfreeze columns, Wider, Narrower, Reset width, Move left, Move right, Hide column | Edit column…, Remove column | Change class….
    - **Remove column:** shown to those who may remove the column, it drafts its removal with Undo, as the column dialog's does.
  - **Can't add:** A role that can't see a column every record needs, such as Position, has no empty row, and New is turned off with a line saying why.
- **Searching, filtering, and sorting:** A search field above a table works as [Search](../standards/ui-conventions/tables.md#search) sets out, with a × to clear it once something is typed.
  - **Sorting:** Each column's menu, open to viewers too, adds the column as the next level of the sort. A column already sorted changes direction in place, and any level, the first included, can be removed on its own. Sorted and filtered columns are marked in their headers.
  - **Filtering:** The menu opens the column's filter beside its header, as [Filtering a column](../standards/ui-conventions/tables.md#tables) sets out. A filter that is no one column's has its own button after the search field, as [Filtering across a table](../standards/ui-conventions/tables.md#tables) sets out.
  - **Pills:** Each filter is a pill above the table, beside the row count, such as "35 of 150".
  - **Clear all:** Clears the whole view but leaves the metrics open. Rows stay put while edited, as [Staying Put](../standards/ui-conventions/tables.md#staying-put) sets out.
- **Saved views:** A Views menu, the last button after the search field, as [What the Views menu holds](../standards/ui-conventions/tables.md#tables) and [Saved views on every page](../standards/ui-conventions/tables.md#tables) set out.
  - **Order:** The page's own choices; the views under My views and Shared views; then each change the view makes, such as Sort or Hidden, with an × to undo it.
  - **Name:** The applied view's name, with a dot once it has changed.
  - **Actions:** Clear view, which also closes the metrics; Save view…, or Save as new view… while a view is applied; Update view; Rename…; sharing; and Delete view.
  - **Save dialog:** A name, a checkbox to share, and the parts the view keeps listed under Includes.
- **Numbers:** A Number column's cells show each number as the reader's language writes it; a draft's details and the change history show it as typed.
  - **Typing:** A number is typed as 1234.5 in every language, since a comma or point means different things in different places and a wrong guess is a thousand times off. Anything else is refused with the form to use.
  - **Filter:** Offers at least, at most, and No number.
- **Units:** A number column shown in a unit, such as Effort, shows each amount with the unit's code: h, PD, PW, PM, or PQ. Effort, a feature's estimate, is the only such column.
  - **Menu:** Show in names each unit after Hours with the approved conversions behind it, such as Person-days (8 hours) or Person-weeks (8h / PD, 5 days / PW). Decimal places offers two, one, or none. Both are part of the view, and changing the unit clears the column's filter.
  - **Rounding:** An estimate is kept to its unit's step, rounded up when entered: whole hours, half person-days, and whole person-days for the larger units. Shown in any unit, it rounds up to that unit's step and the decimal places chosen, so it reads back as entered; totals are added before rounding.
  - **Tooltip:** Gives the hours, then rounded up where the amount was, such as 1 hour, rounded up.
  - **Largest:** 999,999 hours, refused above that in whatever unit it is typed.
  - **In a panel:** A menu of units sits beside the field, starting on the table's unit without changing it, and units are spelt out, such as 2.5 person-days (20 hours). A table's cell is typed in the unit it shows. Either way the estimate is saved in hours, which a draft's details and the change history give.
  - **Metrics:** Features and Activities aren't broken down by Effort, which would count only whether they have an estimate; Metrics adds it up instead.
- **Notes:** A Note column's cell shows the note's words without formatting, on one line, cut short, and so do drafts and the change history. Typing in it does nothing.
  - **Format:** GitHub-flavoured Markdown, so a note exports as it is: paragraphs, headings three levels deep (a deeper one becomes the third), line breaks, bold, italic, strikethrough, inline code, bullet, numbered and checkbox lists, and links.
  - **Lists:** A list's items all have checkboxes or none, a numbered list has none and counts from 1, lists hold no headings, and lists may hold one another.
  - **Not allowed:** Quotes, highlighting, images, code blocks, tables, and any HTML but the colour tag, `<span data-colour="…">`.
  - **Links:** A web address under the [web link](#components) rules, or a Help page by its file name and, optionally, a heading, such as `lists.md#add-choices`. A link whose text only repeats its address shows its host. Links read in Fathom's link colour, underlined, as a web link in a table's cell does, visited or not.
  - **Checks:** Typing and pasting clean to what notes allow; the server refuses anything else rather than removing it, so what is kept is exactly what was checked; and a sanitiser shows only the same. Each step uses an open-source library, never a parser of Fathom's own.
  - **Panel:** A click, Enter, or F2 opens the note in a side panel, titled with the column's name, stacked above Metrics if it is open.
  - **Modes:** For those who may change it, Note, Editor, and Markdown switch views. It opens on Note, or the Editor for an empty note. The Editor's toolbar stays in sight as a long note scrolls.
  - **Saving:** Once anything changes, Clear, Cancel, and Save show at the foot, and the table waits until one is chosen, as [Leaving Unsaved Work](../standards/ui-conventions/entering-and-saving.md#leaving-unsaved-work) sets out. Esc doesn't close it while it's being changed, so nothing written is lost by mistake.
  - **Reading:** While a note is only read, the table stays usable, and opening another note replaces it.
  - **A release's note:** The last row of its details, opening in a panel of its own beside them.
  - **Kept open:** A note opened from a record's details or a table's cell, on any page, is kept in the address, as [Kept in the address](../standards/ui-conventions/tables.md#the-address) sets out.
  - **Colours:** From the palette releases and teams share, in a text shade that reads in both modes, kept in the colour tag, such as `<span data-colour="teal">…</span>`.
  - **Flow:** A note goes from its panel to the screen like this:

  ```mermaid
  flowchart LR
      editor[Editor or Markdown view] -->|cleaned to what notes allow| draft[Draft of the note]
      draft -->|server refuses anything else| approval[Approval]
      approval --> live[Live note]
      live -->|sanitised| shown[Note shown in its panel, preview in its cell]
  ```

- **Hiding columns:** As [Hiding columns](../standards/ui-conventions/tables.md#tables) sets out, for every column but the one naming each record. Focus moves to the heading that takes its place.
- **Frozen columns:** Freeze up to this column keeps that column and those before it on the left while the rest scroll sideways. Which columns are frozen is part of the view.
  - **Edge:** A thin line, with a soft shadow while scrolled sideways; a fade at either edge shows more columns that way.
  - **Limit:** Frozen columns take at most half the table's width.
  - **Default:** The first column is frozen; any other choice shows in the Views menu.
- **Metrics:** A Metrics button after the Draft menu, or after the search field on a table without drafts, opens the Metrics panel. Metrics in a column's menu opens it broken down by that column.
  - **Count:** The rows counted, such as "35 people", or "35 people with drafts, 34 live".
  - **Break down by:** One column gives a row for each choice, or each month in date order, with its count and share, then a row for all the rows; another column gives Populated and Empty. A second, and by, crosses them in a table with All, as Count or Share. A share of a narrower group comes from filtering first. Under a column whose rows may hold several choices, a note reads, for example, A feature in several projects counts in each; a column whose name isn't plural, such as Status, reads as its choices, A feature in several status choices.
  - **Columns offered:** Choices, months and check boxes always; dates and numbers unless required; text, notes and web links never, as names and descriptions are one per record. A table may leave out a column it would offer, such as one with a choice for each record.
  - **Measure:** Shows once Break down by has a column. Offers the table's number columns, each with its unit, such as Effort (PD) and added number columns, with Nothing first. It opens on Effort on Features and Activities, and on Nothing elsewhere. Each group then shows its total, the average of the rows with a value, and None, how many have none, each blank where it has nothing to show, as an empty cell is; Effort adds hours and shows them in the column's unit, rounded up. With and by, the switch gains the column, such as Effort (PD).
  - **Names:** A record's ID, dimmed, comes before its name, as in its column.
  - **Drafts:** Draft figures leave out rows drafted to be removed. A figure a draft moves has its dot before it: hollow for the user's own unpublished change, red in a ring for a rejected draft, or yellow for a waiting one, the first of these that moves it. Under Drafts & Live, the figure is semibold, as a value a draft changes is, and a figure whose live figure differs has it under it, small and dimmed, after a green dot. Drafts applied shows the dots without the live figures. Live only marks each figure a waiting draft will move with Live's green dot. The All row is bold throughout, so semibold sets nothing apart there.
  - **View:** Part of the view once a column is chosen.
- **Ordering:** As [Entering Data](../standards/ui-conventions/entering-and-saving.md#entering-data) sets out for moving items.
- **Retiring:** Records that others use are [retired](../product/domain.md#table-terms) rather than deleted. Retired records are shown only when asked for.
- **Exporting:** As [Exporting](../standards/ui-conventions/tables.md#exporting) sets out. General data saves at once; Personal or Confidential data asks first, naming each class as [the export question](pages/administration.md#data-classes) sets out. A failure shows in red in that dialog.
- **Dialogs:** Creating and changing settings, such as a list's name, happens in dialogs, which cannot be closed while a change is being saved.
- **Drafts:** How drafts look, and what can be done with them, on every table that has them.
  - **Marks:** How a record, a part of one, or a value with a draft is marked, and a warning about a value, as [UI Conventions](../standards/ui-conventions/drafts-and-values.md#drafts) sets out.
  - **Rows:** As [Drafts](../standards/ui-conventions/drafts-and-values.md#drafts) sets out for a table edited like a spreadsheet.
  - **Columns:** As [Drafts](../standards/ui-conventions/drafts-and-values.md#drafts) sets out for a column's draft.
  - **Lists:** A list and its choices are marked as [Drafts](../standards/ui-conventions/drafts-and-values.md#drafts) sets out for a record made of parts and for a move. Retiring and restoring them are drawn as [Retiring](../standards/ui-conventions/drafts-and-values.md#drafts) sets out.
  - **Menus:** A record's menu starts with its name, then a divider. A click anywhere in a menu but its items closes it.
    - **A table row's menu:** A divider sets apart each group present: the table's own items, such as Show details; Approve and Reject; then Resubmit, Discard, and Remove.
      - **Its draft section:** Starts with the draft's mark and any rejection's reason, then one line for each change, naming the field in semibold and setting each value apart, as in code, with who made the change.
    - **A list's menu:** Has a short section for its own draft and one for a new order of its choices, each with its mark, who made it, and any reason.
  - **Publishing:** As [Publishing](../standards/ui-conventions/entering-and-saving.md#publishing) sets out, with Publish in the top bar beside the user's account.
    - **Someone else's changes:** A record someone else is changing is read only, and its menu says Being changed by, with who, and that it can be changed once they publish or discard their changes. Approvers cannot decide it.
    - **The user's own draft:** Approvers cannot decide the user's own unpublished draft either, whose menu says only they see it until they publish it.
  - **Actions:** Those who may edit discard a draft, or resubmit a rejected one; a new order is discarded with Discard new order. Approvers approve or reject a waiting draft from its menu, when their role approves drafts of its area.
    - **Rejected drafts:** A rejected draft offers Approvers nothing to decide until it is resubmitted, and a draft that depends on a rejected draft has Approve disabled, with "Waits on a rejected draft" under it.
    - **The account's own changes:** A draft this account changed, when its role does not let it approve its own, has Approve disabled, with "Needs another approver" under it, the same phrase as on the Drafts page; Reject stays.
  - **Deciding several:** The Draft menu offers Approve N drafts… and Reject N drafts… for the waiting drafts shown.
    - **Label:** Both sit under a Waiting drafts label that, when a search, a filter, a hidden column or Drafts applied hides some, says how many are shown, such as 9 of 11 waiting drafts shown.
    - **Counts:** Both counts take only the drafts the role may decide now, each once, so drafts held by someone else, not yet published or of a kind the role doesn't approve never count as hidden.
    - **Dialog:** Names the drafts it decides, up to five, then "and n others", lists the related drafts it includes, and says how many it skips because they depend on a rejected draft.
    - **Approving:** Leaves waiting, and names, the drafts another approver must approve, as [Approving several](../standards/ui-conventions/drafts-and-values.md#drafts) sets out; only when every one is does the dialog decide none.
    - **Deciding none:** When every draft needs another approver, the dialog is titled Another approver needed, says why, names them, and offers only Close.
    - **Why:** Such as "This account changed these drafts, so another approver must approve them:" or, for an area the user's role does not approve, such as the new column a person's draft uses, "This role can't approve these drafts:", or "This role can't reject these drafts:" when rejecting.
  - **Draft menu:** The Draft button above the table names the choice shown, such as Drafts & Live, with a dot while its filter is in use.
    - **Filter:** Filters to records whose drafts are waiting or rejected, or that have no draft, shown in a pill such as "Draft: Waiting".
    - **Showing:** Chooses what to show: Drafts & Live, the default; Drafts applied; or Live only.
    - **Drafts applied:** Everything as it will be once the waiting drafts are approved, without live rows or removed records, and with rejected drafts taken back, so the Rejected filter is unavailable.
    - **Live only:** Everything as it is now, read only, with the filter unavailable.
    - **Kept:** The filter and what to show are kept in the page address and in saved views.
  - **Drafts page:** First in the sidebar's History section. The shared table, read only, a row for each draft the user sees, newest first, with its search, Metrics counting drafts, Group by with Then by, and Views with saved views, sharing as any table's do.
    - **Tabs:** Beside the heading, drawn as [The Page Heading](../standards/ui-conventions/pages-and-panels.md#the-page-heading) sets out and kept in the address and in saved views, each followed by how many drafts it holds, dimmed.
      - **To decide:** The drafts the role may decide now, for roles that approve.
      - **Not published:** The user's own changes, for roles that make drafts.
      - **All drafts:** Every published draft, for everyone who opens the page. It is read only, and is where rejected drafts, those waiting on one, those someone else is changing and those the role can't decide are found.
      - **Opening:** The page opens on the tab it last showed, as [The last view](../standards/ui-conventions/tables.md#tables) sets out, or at first on the first tab the role has.
      - **Switching:** Switching tabs keeps the rest of the view, unticks every row and closes any details.
    - **Columns:** Record, Change, State, What changes, Type, Area, Made by, Drafted, Reason and Key.
      - **Record:** The record's name, with what it belongs to where its name alone may not say, such as Harbourside in Sites, and a project's or proposal's ID first, after the draft's dot, any lock, and the grey boxes.
      - **Record's grey boxes:** Waits on a rejected draft and Needs another approver, shown only to a role that could otherwise decide it.
        - **Unseen details:** Needs another approver also marks a draft of a list, a list's choice or its order whose class the role can't see, and a person's draft holding details the role can't see. Each stays off To decide, its details saying why.
        - **Taken along:** it also marks a draft whose approval takes along one another approver must approve, such as a feature filled in a column still drafted to be added that the role can't approve or this account changed. It stays on To decide, since it can still be rejected.
      - **Change:** Added, Changed, Removed or Reordered.
      - **State:** Waiting, Rejected or Not published, shown from the start so it can be filtered by.
      - **What changes:** In the lighter form of [A change in words](../standards/ui-conventions/pages-and-panels.md#history).
      - **Area:** The areas whose Approvers decide it.
      - **Made by:** Left out on Not published.
      - **Drafted:** The day.
      - **Reason:** A rejection's reason.
      - **Key:** The key of the draft's record, hidden at first, empty for the planning settings, which have none.
    - **Row menu and grouping:** A row's menu offers Copy link to the record. Group by offers Change, State, Type, Area and Made by.
    - **Draft mark:** The dot in a row's slot is its only draft mark, as [A table of drafts](../standards/ui-conventions/drafts-and-values.md#drafts) sets out.
    - **Ticks:** Rows can be ticked on To decide and Not published; All drafts has no ticks.
      - **On To decide:** Each draft the role may decide now can be ticked, as [Ticking rows](../standards/ui-conventions/tables.md#tables) sets out. A row's menu on To decide offers Approve draft… and Reject draft… too.
      - **To decide's buttons:** At the heading's right, while rows are ticked, are Reject… and Approve n drafts…, counting only the ticked drafts this account may approve, with a dimmed line before them saying how many need another approver. Approve is greyed out only while every ticked draft does.
      - **On Not published:** Each change can be ticked, with the changes it must go with ticked alongside. At the heading's right, while rows are ticked, are Discard n changes…, which asks first, and Publish n changes.
    - **Details:** A draft's details open beside the table from the details button over its Record cell, or Show details in its menu, as [A draft's details](../standards/ui-conventions/pages-and-panels.md#details-panels) sets out, with its record's key under its title.
      - **Show on:** Under the title and key are Show on and the record's page, such as Show on Releases, opening a release's draft on Releases' Releases tab, and a schedule's or cycle pattern's on its Schedules tab, with its details open.
- **Undo, not confirmation:** As [Saving and Undo](../standards/ui-conventions/entering-and-saving.md#saving-and-undo) sets out.
- **Empty and failed states:** An empty table says so in a few words. A table that cannot be loaded says so and offers Try again.
- **Messages:** As [Saving and Undo](../standards/ui-conventions/entering-and-saving.md#saving-and-undo) sets out for failures.
- **Styles:** Mantine's components, theme, and style props, such as a one-off size or margin, come first. Anything more goes in a CSS Module, never in a `style` attribute.
  - **Exceptions:** A position or size worked out while the page runs, such as where the app menu opens, the org chart's cards, the Features Board's columns, a timeline's bars and a table's column widths; and a colour chosen in the data from the palette, such as a team's colour or a note's text colour.
  - **Setting them:** Each exception may be set in a `style` attribute, directly or as a CSS variable a CSS Module reads.

## Shared Building Blocks

One component does each job, in `apps/web/src/`. A new screen uses or extends the one listed rather than making another, and a review rates a second one doing the same job as HIGH, as [Reuse across the codebase](../standards/code-review.md#architecture-and-design) sets out.

- **Tables of records:** `RecordGrid` in `record-grid.tsx`, given its records, columns and actions as `record-table.ts` sets out, with each kind of cell, its display and its editor, in `cellKinds` in `cell-kinds.tsx`.
- **Columns of planned work:** `planningColumns` and `inGroupsThenAdded` in `planning-columns.tsx`, the columns features and activities share, drawn by Features' and Activities' tables, `feature-table.tsx` and `activity-table.tsx`, through `plannedGrid` in `projects-page.tsx`.
- **Search, views, and the bar above a table:** `TableSearch`, `ViewBar`, and `ViewsMenu` in `table-controls.tsx`, with a page's saved views, on a table or not, such as the Org chart's, from `useSavedViews` in `saved-views.tsx`.
- **Side panels:** `WithSidePanel` and `SidePanelFrame` in `side-panel.tsx`, the frame holding a panel's heading, with its marks beside it, its subtitle and its actions. A record's details panel is `RecordPanel` in `record-details.tsx`, on that frame, with its ⋯ menu from `PanelMenu` in `panel-menu.tsx`. Every ⋯ menu in a side panel, `RecordMenu`'s and a list's drafts' included, is drawn by `PanelMoreMenu` there.
- **A coloured name:** `ColouredName` in `colour-swatch.tsx`, as [A coloured name](../standards/ui-conventions/drafts-and-values.md#values) sets out.
- **One tooltip for a whole table:** `TableTips` in `table-tips.tsx`, showing the tip of whatever carries `tipAttribute` under the pointer or in the cell with keyboard focus, such as a feature team's whole name or an estimate's hours.
- **Resizing by an edge:** `ResizeEdge` in `resize-edge.tsx`, for side panels and table columns, with a table's column widths in `useColumnWidths` in `column-widths.ts`.
- **A text field with an × to empty it:** `ClearableInput` in `clearable-input.tsx`.
- **Choosing from a list:** `ChoicePicker` in `choice-picker.tsx`, with its New option given by a column's `adds`, and the plan's New form it opens, stacked under the picker's panel, from `useAddFromPanel` in `add-from-panel.tsx`.
- **Typing a list's choices:** `ChoiceEntryRow` in `choice-entry-row.tsx`, the empty row starting with + where a choice is typed or several pasted, with `useChoiceEntry` in `choice-entry.ts` and the refusals in `choice-rules.ts`, on a list's panel and in a column's dialog for a new list, through `NewListChoices` in `new-list-choices.tsx`.
- **Adding another kind of record from a record's details:** the same stacked New form, from `useAddFromPanel`'s `addActivity`, wired to Add activity by `addingActivity` in `activity-list.tsx`.
- **A group of choices in a menu, the chosen one ticked:** `MenuChoices` in `app-menu.tsx`.
- **A menu beside the pointer:** `MenuAtPoint` in `app-menu.tsx`, for a right-click on a table's row or a card, and a card's menu opened from its keys or its ⋯.
- **A column in units:** a column's `units` in `record-table.ts`, resolved into the unit and decimal places the view names by `inViewUnits` in `grid-columns.tsx`, with `useChosenUnits` in `record-editing.tsx` for a form or panel's own choice, and an estimate's cell in `EffortCell` in `effort-cell.tsx`.
- **Entering a day:** `DayInput` in `day-input.tsx`.
- **Adding a record in a side panel:** `NewRecordPanel` in `new-record-panel.tsx`, driven by a table's columns, with each page drawing its own fields in it: `NewPersonPanel` in `new-person-panel.tsx` for People and `NewPlanRecordPanel` in `new-plan-record-panel.tsx` for the plan's records.
- **A record's details in a side panel:** `Row` for each value, `RecordLink` for a link to another record, `RecordLinkList` for several, one to a line, `RecordSection` for a headed group of rows, and `DetailSections` spacing the sections, in `record-details.tsx`, with `FoldedNote` in `folded-note.tsx` and `FoldedList` in `folded-list.tsx` for a long note or list.
- **A record's timeline of days:** `RecordTimeline` in `record-timeline.tsx`, one row a day newest first, each change a `Phrase` whose values may link, with Today drawn across as a timeline draws it, and `FoldedList`'s newest-first folds.
- **A short list of records in a side panel, with buttons under it:** `ShortList` in `short-list.tsx`, such as a release's features and a project's activities.
- **A details row's name showing the records it lists on their own page:** a column's `showOn` in `record-table.ts`, drawn as the row's name by `Row` in `record-details.tsx`, with `ShowOnItem` there for the same in the record's menu, such as a project's Activities from `activitiesShowOn` in `activity-list.tsx`.
- **Changing a record's values in a side panel:** `useRecordEditing` in `record-editing.tsx`, with what a person's notes add in `person-editing.tsx`.
- **A record's menu outside a table:** `RecordMenu` in `record-menu.tsx`, such as a milestone's in a project's details, offering Publish draft… where `usePublishDraft` in `publish-draft.tsx` gives it.
- **Something that could not be loaded:** `LoadProblem` in `load-problem.tsx`.
- **The buttons over a Name cell:** `RowControls` in `row-controls.tsx`, placed by `nameCellControls` in `row-menus.tsx` in the column its table names.
- **Notes:** `NotePanel`, `NoteView`, and `NoteCell` in `note-editor.tsx`, with `useNoteEditing` in `note-editing.tsx` opening one from a record's details and keeping it in the address, through `note-address.ts`, and `useTableNoteAddress` in `grid-note-address.ts` keeping one opened from a table's cell.
- **Links:** `LinkEditor`, `LinkCell`, and `LinkMenuItem` in `link-field.tsx`.
- **A draft's menu items and deciding drafts:** `DraftItems` in `list-drafts.tsx`, `DecisionModal` in `decision-dialog.tsx`, opened by `useDecisionDialog` there, and `OtherApproverNote` in `draft-details.tsx`.
- **Draft and status marks:** `DraftedItem`, `DraftedValue`, `RowMarks`, `MarkedItem`, `FactBox` and `LiveLine` in `status-mark.tsx`, under the page's `DraftView`, as [Drafts](../standards/ui-conventions/drafts-and-values.md#drafts) sets out.
- **A page's title row:** `PageHeader` in `page-header.tsx`, with the Export icon from `PageExportMenu` in `page-export.tsx`, and the tabs beside it from `HeadingTabs` and `HeadingTabPanel` there.
- **Exporting a table:** `useTableExport` in `table-export.tsx`, offering the export to the Export icon through `useOfferedExport` in `page-export.tsx`, the question in `export-question.tsx`, and the file, its name and saving it in `exports.ts`.
- **A dialog's buttons:** `DialogActions` in `dialog-actions.tsx`.
- **A column's filter:** `FilterPopover` in `table-controls.tsx`.
- **A filter across a table, from the bar above it:** a table's `barFilters`, each drawn by `BarFilterButton` in `table-controls.tsx` with `FilterPopover`, and filtering the rows beside the draft filter through `filtersBesideColumns` in `table-view.ts`.
- **Icons and colour swatches:** `Icon` in `icons.tsx` and `Swatch` in `colour-swatch.tsx`.

## Planned

Designs agreed but not built yet:

- **A page that can't load:** every page and part of one that can't load its data showing `LoadProblem` ([issue #194](https://github.com/ribbitworks/fathom/issues/194)).
