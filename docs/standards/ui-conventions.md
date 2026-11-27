---
title: "UI Conventions"
category: "Standards"
audience: "Contributors"
applies_to: ["apps/web/**", "docs/testing/**"]
dependencies: ["docs/design/visual-design.md", "docs/standards/code-review.md", "docs/standards/ui-conventions/drafts-and-values.md", "docs/standards/ui-conventions/dates-timelines-and-boards.md", "docs/standards/ui-conventions/pages-and-panels.md", "docs/standards/ui-conventions/entering-and-saving.md", "docs/standards/ui-conventions/tables.md"]
last_updated: "2026-11-27"
---

# UI Conventions

The principles and conventions every screen follows, for those who build screens. The principles and the rules for words are here; the conventions are in the [parts](#the-conventions) listed below.

Each convention gives:

- **The rule.**
- **The shared piece that draws it:** So a new screen reuses it rather than drawing its own.
- **An example:** From the [fictional data](../design/development-setup.md#fictional-data), or the steps that make one.

[Planned](#planned) lists where Fathom doesn't follow them yet. How each page is laid out is in [Visual Design](../design/visual-design.md) and the page designs in `docs/design/pages/`.

## Principles

These principles come first:

- **No instructional text:** If a screen needs explaining, the design is wrong. No hints, help lines, or placeholder sentences telling people what to do.
  - **Text always on screen:** The rule is for this text. A refusal may say what to do next, such as Choose a manager, or leave Manager assigned empty.
  - **Menus and dialogs:** A menu or dialog may state, in one short line, a fact needed at that moment, such as Nobody else sees these changes until they're published, but never how to use the control.
  - **Labels:** One or two words. An optional field may add "(optional)" to its label.
  - **Not instruction:** Familiar patterns, such as a grip handle for dragging, speak for themselves. Saying what an action will do, as a confirmation does, is not instruction, and neither is reference material, such as what each role lets a user do.
- **No assumptions:** Screens add no purposes, defaults, restrictions, or wording the maintainer has not asked for. Where something is unclear, it is left out and the maintainer is asked.
- **Words people say:** Every label, note, and message on screen, the server's refusals included, reads as a person would say it aloud.
  - **Short, with a subject and a verb:** Such as "Hiring states needs a choice that means Proposed", never a stack of nouns, such as "the only offered choice meaning Proposed".
    - **Under its field:** A refusal shown under its own field may be the noun and "needed", such as Name needed, Date needed or Reason needed. A refusal anywhere else, such as in a notice, under a table's row or in a dialog's text, stays a full sentence.
  - **Everyday verbs:** Such as "the column that uses this list", never "the column drawing on it".
  - **Fewest words:** The fewest plain words that say it, such as "Show all features", never "Show all its features". No filler words, and no label that explains its control, such as "Save changes to this project" for "Save".
- **Never the second person:** Nothing on screen, the server's refusals included, says "you" or "your". Say what is so, such as "This role can't choose an earlier date". Help pages are the exception, as [Help Page Standards](help-pages.md) sets out.
- **Keyboard-first data entry:** Wherever people enter or change data, everything can be done from the keyboard, and adding many items in a row never needs the mouse.
  - **Keys:** Tab moves between fields, Enter saves and starts the next item, Esc cancels, and arrow keys move between items.
  - **Many records:** Where many records are entered, such as resources, editing works like a spreadsheet, including pasting rows.
- **The bar:** Top-tier modern products, such as Linear or Notion: calm, dense, and obvious.

The rest follow from them:

- **Quiet and dense:** Fathom is a work tool used every day, so pages favour clear structure and plenty of information over decoration. As few borders, lines, labels, and columns as the task allows; metadata, such as who changed something, stays out of the way.
- **One main action per screen:** Every other action is secondary or in a menu.
- **Buttons look like buttons:** The main action is filled. Every other text button has an outline, as Cancel does.
  - **Red:** A button that deletes or deactivates is red, filled or outlined. Retiring is neither, since a retired record can be restored, so Retire stays grey.
  - **Tinted:** A toggle, such as Show retired, is tinted while on, and a button inside an alert, such as Try again, is tinted in the alert's colour.
  - **No outline:** Only icon buttons, such as ⋯ and ×, and links within a sentence, such as Show all in the change history, have no outline.
- **Controls when needed:** Controls that are not always needed, such as grip handles for dragging, a table row's buttons over its Name cell and a details panel's pencils, appear on hover or keyboard focus.
  - **A table row's controls:** Its buttons, its "⋯" menu button and its right-click menu work as [A row's controls](ui-conventions/tables.md#tables) sets out.
- **No wasted space:** Layout serves the content; nothing takes width or height it does not earn.
- **Colour means something:** Neutrals carry the page. Sea blue marks actions and the current place.
  - **Other colours:** Appear only for meaning, such as green for active, yellow for drafts waiting for approval, and red for problems.
  - **Colours people choose:** The exception to that, for releases on the [Releases timeline](../design/pages/releases.md), for teams wherever they are named, as on the [Org chart](../design/pages/org-chart.md), and for text in notes.
- **Never colour alone:** Anything shown by colour is also shown in words, visible or read aloud by screen readers.
- **Both modes:** Fathom follows the computer's setting until a person chooses Light or Dark in their account menu; System follows it again. The choice is kept in that browser alone, and applies on every page, signing in included.
- **International:** Names and text in any language and script are shown, entered, searched, and sorted as well as English is.
  - **Names and text:** No screen assumes Latin letters, a given name first, or one name per person, and text is never cut so a character breaks.
  - **Search:** Ignores letter case and accents, such as é or ё, but not marks that make another letter in other scripts, such as Japanese が, though Cyrillic letters such as й also match their plain letter.
  - **Language settings and fonts:** Sorting, dates, and counts follow each person's own language settings, and scripts the typeface lacks fall back to the system's fonts.
  - **Tried with every script:** The [seed data](../design/development-setup.md#fictional-data) includes names in other scripts, so every screen is tried with them.

## Words

- **Plain words:** Every word on screen follows the [Principles](#principles). On top of them, use the plain verb: added, removed, changed, retired, restored, never "comes off" or "taking off".
  - **Removed, not deleted:** Records and their drafts are removed, never deleted; delete is for what isn't a record, such as a saved view.
  - **Setting up fields and tables:** In everyday words, such as Required, never database terms. A column of web addresses is a Web link, so it isn't taken for Link to another table, and a column of tick boxes is a Checkbox, never Yes/No or Boolean.
    - **The Type list:** New column names only the types Fathom offers, in a fixed order, and a new column starts on the first, Text. Drawn by `typeNames` in `apps/web/src/column-dialog.tsx`.
  - **Naming patterns:** A naming pattern is shown as typed, such as {YY}.{N}, only where it is set: the Names field of the dialog that sets a schedule's cycles, and the row in the schedule's details that names its pattern. Everywhere else, cycles show their real names, such as 27.1.
  - **Drawn by:** The words themselves, with `draftWords` in `apps/web/src/draft-marks.ts` and `DraftedWords` in `apps/web/src/status-mark.tsx` for drafts.
  - **Example:** Draft: removed.
- **Tips:** A tip of one phrase has no period, such as Also under Search; a tip of several sentences ends each with one.
  - **Drawn by:** The words themselves, shown by `TableTips` or `Tipped` in `apps/web/src/table-tips.tsx` on tables.
  - **Example:** On People, choose Feature teams in Group by, and point at the +1 after Lorenza Thiel's name.
- **A menu item's or button's "…":** A menu item that opens a dialog or a confirmation ends in "…", such as Edit column…, Approve draft… or Change password….
  - **Buttons:** A button that acts on something already there and opens a dialog ends in "…" too, such as Edit list…, Change class…, Edit…, Approve… or Reject….
  - **Asking only sometimes:** One that asks first only sometimes has one too, such as Publish draft…, which asks only when other changes go with the draft.
  - **No "…":** One that acts at once, even with Undo, or opens a side panel, has none, such as Delete view, Remove column or New feature team. The dialog's own title has none either, such as Edit column.
  - **"New":** A button or menu item starting with "New" never has one, whether it opens a dialog, a form or a panel, such as New list, New account, New column or New feature. "New" already says more is coming, and the buttons look alike side by side.
  - **Drawn by:** The words themselves:
    - **Menus:** the column menu in `apps/web/src/column-header.tsx`, `draftItemLabel` for a row's Approve draft… and Reject draft… in `apps/web/src/row-menus.tsx`, and the account menu in `apps/web/src/layout.tsx`.
    - **Buttons:** Edit list… and Change class… in `apps/web/src/list-panel-head.tsx`, Edit… in `apps/web/src/accounts-panel.tsx`, and Approve… and Reject… in `apps/web/src/drafts-panel.tsx`.
    - **New buttons:** New list in `apps/web/src/lists-page.tsx`, New account in `apps/web/src/accounts-page.tsx`, and New column and New feature in `apps/web/src/plan-page-heading.tsx`.
  - **Example:** On People, open the Site column's menu: Edit column… opens its dialog, and Remove column removes the column at once, as a draft.

## The Conventions

- [Drafts, Values and Access](ui-conventions/drafts-and-values.md): How drafts, values and data classes are marked, and what a role without access sees.
- [Dates, Timelines and Boards](ui-conventions/dates-timelines-and-boards.md): How days and months are shown and typed, the shared timeline, and boards of cards.
- [Pages and Panels](ui-conventions/pages-and-panels.md): The top bar, the page heading, links to records, history, details panels, focus, and Help pages.
- [Entering and Saving Data](ui-conventions/entering-and-saving.md): Fields, choices, entering data from the keyboard, saving and undo, refusals, and publishing.
- [Tables, Addresses and Search](ui-conventions/tables.md): Tables, their views and groupings, what the address keeps, exporting, and search.

## Planned

Where Fathom doesn't yet follow the conventions, by the section that sets each out, with the issue that records each gap where there is one:

- **[Timelines](ui-conventions/dates-timelines-and-boards.md#timelines):**
  - The Plan and the project timeline.
  - Feature rows, whose label shows the feature's ID and name on the bar's line with its Size mark under them, leaving room under the bar for day marks such as Needed by.
  - The release layer's Releases picker.
  - The cycle and release lines on the month grids, which name their months their own way.
  - The date row on People and the Org chart, `apps/web/src/date-control.tsx`, becoming the strip.
- **[Values](ui-conventions/drafts-and-values.md#values):** The Size and Risk marks in a feature's details, a timeline's row labels and group headings, as well as on the Features Board's cards.
- **[Dates](ui-conventions/dates-timelines-and-boards.md#dates):** People's date cells and Person details, which still have their own fields rather than `DayInput` ([issue #185](https://github.com/ribbitworks/fathom/issues/185)).
- **[Links to Records](ui-conventions/pages-and-panels.md#links-to-records):** Each record's [record key](../design/domain-model.md#change-and-history-entities) shown beside its name wherever a project or proposal is named with its ID, and links to records in a table's cells.
- **[Details Panels](ui-conventions/pages-and-panels.md#details-panels):**
  - A project's details, whose Show milestones sits beside the Milestones heading, with no outline, and Add milestone under the list with a + before it; both move under the list, Add milestone first ([issue #35](https://github.com/ribbitworks/fathom/issues/35)).
  - A person's details beside the Org chart, which have no ⋯ to discard or publish their draft, since the Org chart has no table to give the menu.
- **[Fields](ui-conventions/entering-and-saving.md#fields):** The fields with no × yet ([issue #182](https://github.com/ribbitworks/fathom/issues/182), [issue #195](https://github.com/ribbitworks/fathom/issues/195)).
- **[Saving and Undo](ui-conventions/entering-and-saving.md#saving-and-undo):** The Application settings page, which confirms a save in a notification with no Undo, and doesn't ask when left with a change unsaved ([issue #64](https://github.com/ribbitworks/fathom/issues/64)); accounts, edited in a dialog with Save, and changing an account's roles, which doesn't ask first ([issue #252](https://github.com/ribbitworks/fathom/issues/252)).
- **[Refusals](ui-conventions/entering-and-saving.md#refusals):** A table's empty row, which names the server's refusal of a new record in a notification, not under the row; and the Fill form, whose Fill can miss a click when leaving a field shows or takes away the reason under it.
- **[Leaving Unsaved Work](ui-conventions/entering-and-saving.md#leaving-unsaved-work):** Leaving a fill, which asks Stop filling this planned hire? with Keep filling ([issue #141](https://github.com/ribbitworks/fathom/issues/141)); and these, left without asking: the role and account dialogs ([issue #242](https://github.com/ribbitworks/fathom/issues/242)), the list dialog ([issue #71](https://github.com/ribbitworks/fathom/issues/71)), the view dialog ([issue #129](https://github.com/ribbitworks/fathom/issues/129)) and New feature team ([issue #150](https://github.com/ribbitworks/fathom/issues/150)).
- **[Controls turned off](ui-conventions/entering-and-saving.md#refusals):** The lines under turned-off menu items, such as Retire and Remove in a list's choices, not yet tied to their items, nor drawn by `useTurnedOff` ([issue #464](https://github.com/ribbitworks/fathom/issues/464)).
- **[The Address](ui-conventions/tables.md#the-address):** The New and Fill forms, and a note in a form, all still kept in the page alone ([issue #138](https://github.com/ribbitworks/fathom/issues/138)).
- **[Panels and Focus](ui-conventions/pages-and-panels.md#panels-and-focus):** The Org chart's Teams, still a drawer kept out of the address ([issue #146](https://github.com/ribbitworks/fathom/issues/146)).
