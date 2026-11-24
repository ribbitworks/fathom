---
title: "UI Conventions: Entering and Saving Data"
category: "Standards"
audience: "Contributors"
applies_to: ["apps/web/**", "docs/testing/**"]
dependencies: ["docs/standards/ui-conventions.md", "docs/design/visual-design.md"]
last_updated: "2026-11-23"
---

# Entering and Saving Data

Part of [UI Conventions](../ui-conventions.md): fields, choices, entering data from the keyboard, saving and undo, refusals, and publishing. Examples come from the [fictional data](../../design/development-setup.md#fictional-data).

## Fields

- **An × to empty a field:** Every field typed into shows an × at its right while it holds text, except password fields and those on the Sign in page. The × empties the field and keeps focus in it.
  - **No ×:** A table's cells aren't fields and show no ×: Delete or Backspace empties one. Nor do a list panel's choices, where Delete removes a choice.
  - **Drawn by:** `ClearableInput` in `apps/web/src/clearable-input.tsx`.
  - **Example:** Name in Offline Sync's details, once its pencil opens it.

## Choices

- **A choice with a description:** In a picker, a choice's description shows dimmed under its name. Typing finds a choice by its description too, ignoring letter case and accents, as [Finding rows](tables.md#search) does.
  - **Drawn by:** `ChoicePicker` and `OptionWords` in `apps/web/src/choice-picker.tsx`.
  - **Example:** On the Org chart, choose Feature teams, open Search's details and change its Lead: each person shows their position and reporting team under their name.
- **Choosing none:** A picker for a value that takes one choice, and need not have one, offers the column's word for an empty value, such as None, No manager or Later, as its first option, with a line under it, until something is typed. Choosing it empties the value.
  - **Highlighting:** Nothing is highlighted until a key is pressed or an option pointed at; once something is typed, the first match is. So none is always in sight, but Enter never picks it unasked.
  - **Drawn by:** `ChoicePicker` in `apps/web/src/choice-picker.tsx`, given the word through `cellKinds` in `apps/web/src/cell-kinds.tsx` from the column's `emptyLabel`.
  - **Example:** On People, open a person's Manager cell: No manager is first.
- **The keyboard's option in a drop-down list:** The option the keyboard is on, which Enter would pick, looks like an option pointed at: light grey in light mode, dark grey in dark mode. It is never the accent colour, which looks like a choice already made.
  - **Drawn by:** The theme, through `Combobox.extend` and `Select.extend` in `apps/web/src/theme.ts`. Both give their options the class in `apps/web/src/combobox.module.css`, so every drop-down list, Select and table cell's choices follow it. A new kind of drop-down list from Mantine, such as `MultiSelect`, needs the same class in the theme.
  - **Example:** On Features, open a Status cell's choices and press the Down arrow.
- **A switch's chosen side:** A switch between a page's views, such as the Org chart's Reporting teams and Feature teams, fills its chosen side with the accent colour, as any choice made is, never white on grey, which reads as turned off.
  - **Drawn by:** The theme, through `SegmentedControl.extend` in `apps/web/src/theme.ts`, so every switch follows it, `ModeSwitch` in `apps/web/src/page-header.tsx` included.
  - **Example:** The Org chart's switch.
- **The chosen one ticked:** A group of choices in a menu ticks the chosen one, read aloud as chosen, as in the Views menu's applied view.
  - **Drawn by:** `MenuChoices` in `apps/web/src/app-menu.tsx`.
  - **Example:** Hours ticked under Show in, in Effort's column menu.

## Entering Data

- **From the keyboard:** Wherever items are added or changed, everything works from the keyboard. Tab moves between fields, Enter saves and starts the next item, Esc cancels, and arrow keys move between items.
  - **Clicking away and pasting:** Clicking or tabbing away saves an item too, and pasting several lines adds one item per line.
  - **A record's parts:** A record's parts, such as a project's milestones, are added from the record's details, or from their own table's New form, which asks which record they belong to.
  - **Drawn by:** `apps/web/src/grid-editing.tsx` and `apps/web/src/grid-saving.ts` for tables, and `useChoiceEditing` in `apps/web/src/choice-editing.ts` and `useChoiceEntry` in `apps/web/src/choice-entry.ts` for a list's choices.
  - **Example:** On the Lists page, select Sites and type a new choice in its empty row.
- **Like a spreadsheet:** Tables where many records are entered work like a spreadsheet. Pasting rows copied from a spreadsheet into an empty row adds one record per row.
  - **Moving:** Arrow keys, Home, End and Tab move between cells, and Ctrl+Home and Ctrl+End go to the first and last.
  - **Editing:** Enter, F2 or typing edits a cell. Enter saves and moves down, Tab saves and moves across, Esc cancels, and Delete clears.
  - **Drawn by:** `gridEditing` in `apps/web/src/grid-editing.tsx`, with pasting in `apps/web/src/grid-saving.ts`.
  - **Example:** People, Features, and each table on Projects.
- **The empty row:** Empty rows at the end take new records, their cells blank until something is typed in one, so they aren't taken for records.
  - **While it's filled in:** A row being filled in is tinted as the draft it will be, with a hollow dot in its slot. The dot's tip and spoken words say New, not saved yet, and what is wrong so far or which required columns are still empty; what is wrong also shows in red after the first value.
  - **Clear row:** The row's menu, also opened with Shift+F10, offers Clear row, which takes the row and what it holds away.
  - **Drawn by:** `gridSaving` in `apps/web/src/grid-saving.ts`, with its mark in `apps/web/src/grid-row.tsx` and Clear row in `apps/web/src/row-menus.tsx`.
  - **Example:** Type a name in the empty row at the end of Features.
- **Moving items:** Where people set an order, items have a grip for dragging on wide screens, shown on hover or focus. Alt with the arrow keys moves the selected item. Its menu offers the same moves, with their keys.
  - **Drawn by:** `ChoiceRow` in `apps/web/src/choice-row.tsx`, `ChoiceMenu` in `apps/web/src/choice-menu.tsx` and `useChoiceEditing` in `apps/web/src/choice-editing.ts` for a list's choices, and the column menu in `apps/web/src/column-header.tsx` for moving a column.
  - **Example:** The choices of Sites on the Lists page.

## Saving and Undo

- **Saved at once:** Changes save at once, without asking.
  - **Undo:** Cmd+Z or Ctrl+Z undoes the latest change. In a field with something typed in it, the note editor included, the keys undo only the typing. Undo covers every kind of record, the plan's included, checked by the same rules as approving, and undoes everything saved with the change at once, all or none.
  - **No notification in place:** A change seen in place shows none.
  - **A notification with Undo:** Shown at the top right, closing after a few seconds or at a newer change, for a change that takes something out of view, such as discarding the draft of a record only drafted to be added, deleting a saved view, or a team label that a draft removes while Drafts applied is shown.
    - **Sharing:** Sharing a view, or stopping sharing it, shows one too, since nothing changes in view and it affects others.
  - **Settings:** They change Fathom for everyone, so they keep a Save button. A saved change shows in place with no notification, and Cmd+Z or Ctrl+Z undoes it. Leaving with a change unsaved asks first.
  - **Saved from a pencil:** The planning settings on Capacity each save at once from their pencil, as a draft, as a details panel's values do. An account's name and email address do too, with no notification, and Cmd+Z or Ctrl+Z undoes them.
  - **Drawn by:** `useSaving` and `isUndo` in `apps/web/src/saving.ts`, and `notifyUndoable` in `apps/web/src/notices.tsx`.
  - **Example:** On People, save a view, then delete it.
- **Asking first:** Of changes to data, only these ask first, since they can't be undone: approving drafts, rejecting them, Discard all…, discarding chosen changes on the Drafts page (such as Discard 2 changes…), and deleting a saved view its maker can no longer use.
  - **A saved view its maker can't use:** Deleting it can't be undone because its change history holds what the maker's role can't see.
  - **Also asking:** Leaving unsaved work asks too ([Leaving Unsaved Work](#leaving-unsaved-work)), and so does exporting Personal or Confidential data ([Exporting](tables.md#exporting)).
  - **Confirming:** Each confirms what was done in a notification without Undo, such as Approved 3 drafts, since it takes drafts out of view.
  - **Who may sign in, and what they may do:** Changes to these also ask first and confirm in a notification without Undo:
    - Saving a change to a role that alters what its accounts may do, whose question lists what each account gains and loses.
    - Changing an account's roles.
    - Resetting a password.
    - Deactivating or reactivating an account.
  - **Drawn by:** `DecisionModal` in `apps/web/src/decision-dialog.tsx`, and `DiscardChangesModal` in `apps/web/src/unpublished.tsx` for Discard all… and discarding chosen changes. Their own dialogs draw the role's confirmation, in `apps/web/src/roles-page.tsx`, the account's, in `apps/web/src/accounts-page.tsx`, and deleting a saved view, in `apps/web/src/saved-views.tsx`.
  - **Example:** Approve draft… in a seeded person's draft menu on People.
- **Failures:** A change that fails says so in plain words, never as a raw error, and says what to do next. Its notification stays until closed, and the record goes back to how it was.
  - **Drawn by:** `notifyFailure` in `apps/web/src/notices.tsx`, with the words from `describeProblem` in `apps/web/src/api.ts`.
  - **Example:** None in the seed data; a lost connection while saving shows one.
- **A page that can't load:** A page, or part of one, whose data can't be loaded says so in plain words in its place, with Try again.
  - **Drawn by:** `LoadProblem` in `apps/web/src/load-problem.tsx`.
  - **Example:** None in the seed data; stopping the server while a page loads shows one.

## Leaving Unsaved Work

- **Asking before discarding:** Leaving a form, a note or a Settings panel with anything changed asks first, whether by Cancel, the close button, another tab or another record. A dialog with anything typed in it counts as a form.
  - **The question:** The question always starts with Discard and names what is lost, such as Discard the new customer? with Keep adding and Discard, Discard changes to the note? with Keep writing and Discard, or Discard the fill of TBD-3?
  - **While saving:** A form can't be left while its record is being added, and a dialog can't be closed while a change is being saved.
  - **Drawn by:** `useDiscardQuestion` and `newRecordQuestion` in `apps/web/src/discard-question.tsx`, and the note's question, `noteQuestion`, in `apps/web/src/note-editing.tsx`.
  - **Example:** On Projects' Customers tab, select New customer, type a name, then Cancel.

## Refusals

- **A value refused:** When the page or the server refuses a value on save, its editor stays open with what was typed, outlined in red, with the reason in red under it, so nothing is lost, in tables, panels and dialogs alike. Esc leaves the value as it was.
  - **Where the reason shows:** In a table, the reason is under the row, in its first cell. In a dialog, it is under the field it's about, or at the foot when it's about no one field.
  - **Focus in a dialog:** A dialog's refused Save puts focus in the first field refused, so it can be put right at once. A reason at the foot leaves focus where it was.
  - **Drawn by:** `useRecordEditing` in `apps/web/src/record-editing.tsx` for a panel, and `apps/web/src/grid-editing.tsx` for a table; a dialog's focus by `focusRefusedSoon` in `apps/web/src/focus.ts`, or by react-hook-form in the account, role, name and password dialogs, which focuses the first refused field given its `ref`.
  - **Example:** Type 203013 in a Needed by cell on Features: Needed by: use a month such as 2027-03.
- **Names a role can't read:** A refusal naming the record that blocks a change, and the user's list of unpublished changes, name a record only to a role that reads its kind. Any other role is told only its kind, such as a feature or a planned hire.
  - **A record's name:** A record's name may include the record it belongs to, such as an allocation's feature.
  - **Drawn by:** The server, with `subjectOf` and each kind's `unseen` words in `apps/server/src/data/unpublished.ts`, and each plan kind's `unseenSubject` in `apps/server/src/data/release-kinds.ts` and `apps/server/src/data/allocation-kinds.ts`.
  - **Example:** With an account holding two roles, change a person on People, then switch to a role that doesn't see People: the Publish menu names the change to a person.
- **Controls turned off:** A control for a change the server would refuse is turned off, with a line saying why wherever the reason isn't plain to see.
  - **Turned off, not hidden:** One the reader might expect is turned off with its reason, not hidden; a control is hidden only when the role can never use it, or, as New is under Live only, where nothing it made would show.
  - **Drawn by:** Each page.
  - **Example:** In a list with meanings, such as Feature statuses, Retire and Remove are greyed out on the only choice that means Possible, with a line saying why.
- **A record the role can't change:** Where a role may change records of a kind but not one record, such as a list of a class it can't see, the record's panel is read only, with one dimmed line saying why, rather than each control turned off.
  - **Drawn by:** `ListPanel`'s `unchangeable` in `apps/web/src/list-panel.tsx`, from `unchangeableLists` in `apps/web/src/lists.ts`.
  - **Example:** None in the seed data; a role with Edit Configuration but not Personal data, opening Work patterns on the Lists page.
- **Menu buttons:** A menu of actions on one thing opens from a ⋯ named "Actions for" the thing, such as Actions for Fictional Major. A ⋯ that opens something else is named for what it opens, such as Unpublished changes.
  - **On the Features Board:** A card's ⋯ shows only while the card is pointed at or has focus. It isn't a Tab stop, since Shift+F10 on the card opens the same menu.
  - **The Org chart's cards:** The Org chart's cards have none: their menu opens from a right-click, Shift+F10 or the menu key.
  - **Drawn by:** `MoreButton`, named through `actionsFor`, in `apps/web/src/row-controls.tsx`, and a card's through `CardMenu` in `apps/web/src/card-menu.tsx`.
  - **Example:** On Lists, the ⋯ beside each list.

## Publishing

- **Private until published:** A person's changes are theirs alone until they publish them. A record someone else is changing is held, as [Drafts](drafts-and-values.md#drafts) sets out.
  - **The top bar:** While they have any, the top bar shows Publish with how many, such as Publish 3 changes, beside a menu listing them. The menu offers Discard all…, which asks first.
  - **Publish:** Publish publishes them all and confirms it in a notification without Undo, such as Published 3 changes.
  - **Changes needing another role:** Changes made under another of the user's roles that the role in use can't make stay unpublished, with those that go with them.
    - **The notification:** The notification says how many, such as Published 3 changes. 1 needs another role., or, when none was published, Nothing was published. 2 changes need another role., which stays until closed.
  - **On the Drafts page:** From the Drafts page's Not published tab, some changes can be published or discarded on their own, with the changes they must go with ticked alongside ([ADR 0008](../../adr/0008-unpublished-drafts.md)). Publishing there confirms it in a notification without Undo, and discarding asks first.
  - **Drawn by:** `UnpublishedControl`, with `useUnpublishedActions` for both places, in `apps/web/src/unpublished.tsx`.
  - **Example:** Change any value on Features: Publish 1 change shows in the top bar.
