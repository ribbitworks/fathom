---
title: "UI Conventions: Entering and Saving Data"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["apps/web/**", "docs/testing/**"]
dependencies: ["docs/standards/ui-conventions.md", "docs/design/visual-design.md"]
last_updated: "2026-11-19"
---

# Entering and Saving Data

Part of [UI Conventions](../ui-conventions.md): fields, choices, entering data from the keyboard, saving and undo, refusals, and publishing. Each entry gives the rule, the shared piece that draws it, and an example from the [fictional data](../../design/development-setup.md#fictional-data).

## Fields

- **An × to empty a field:** Every field typed into shows an × at its right to empty it while it holds any text, except those for passwords and on the Sign in page. Choosing the × keeps focus in the field. A table's cells aren't fields: Delete or Backspace empties one, so they show no ×, and neither do the choices in a list's panel, where Delete removes a choice.
  - **Drawn by:** `ClearableInput` in `apps/web/src/clearable-input.tsx`.
  - **Example:** Name in Offline Sync's details, once its pencil opens it.

## Choices

- **A choice with a description:** In a picker, a choice's description shows dimmed under its name, and typing finds a choice by its description too, ignoring letter case and accents, as [Finding rows](tables.md#search) does.
  - **Drawn by:** `ChoicePicker` and `OptionWords` in `apps/web/src/choice-picker.tsx`.
  - **Example:** on the Org chart, choose Feature teams, open Search's details and change its Lead: each person shows their position and reporting team under their name.
- **Choosing none:** A picker for a value that takes one choice and need not have one offers the column's word for an empty value, such as None, No manager or Later, as its first option, with a line under it, until something is typed. Nothing is highlighted until a key is pressed or an option pointed at, and once something is typed the first match is highlighted, so none is always in sight but Enter never picks it unasked. Choosing it empties the value.
  - **Drawn by:** `ChoicePicker` in `apps/web/src/choice-picker.tsx`, given the word through `cellKinds` in `apps/web/src/cell-kinds.tsx` from the column's `emptyLabel`.
  - **Example:** on People, open a person's Manager cell: No manager is first.
- **The keyboard's option in a drop-down list:** The option the keyboard is on, which Enter would pick, is light grey in light mode and a dark grey in dark mode, the same as an option pointed at; never the accent colour, which looks like a choice already made.
  - **Drawn by:** the theme, through `Combobox.extend` and `Select.extend` in `apps/web/src/theme.ts`, both giving their options the class in `apps/web/src/combobox.module.css`, so every drop-down list, Select and table cell's choices follow it. A new kind of drop-down list from Mantine, such as `MultiSelect`, needs the same class in the theme.
  - **Example:** on Features, open a Status cell's choices and press the Down arrow.
- **A switch's chosen side:** A switch between a page's views, such as the Org chart's Reporting teams and Feature teams, fills its chosen side with the accent colour, as a choice made is, never white on grey, which reads as turned off.
  - **Drawn by:** the theme, through `SegmentedControl.extend` in `apps/web/src/theme.ts`, so every switch follows it, `ModeSwitch` in `apps/web/src/page-header.tsx` included.
  - **Example:** the Org chart's switch.
- **The chosen one ticked:** A group of choices in a menu ticks the one chosen, read aloud as chosen, as in the Views menu's applied view.
  - **Drawn by:** `MenuChoices` in `apps/web/src/app-menu.tsx`.
  - **Example:** Hours ticked under Show in, in Effort's column menu.

## Entering Data

- **From the keyboard:** Wherever items are added or changed, everything works from the keyboard. Tab moves between fields, Enter saves and starts the next item, Esc cancels, and arrow keys move between items. Leaving an item by clicking or tabbing elsewhere saves it too, and pasting several lines adds one item for each. A record's parts, such as a project's milestones, are added from the record's details, or from their own table's New form, which asks which record they belong to.
  - **Drawn by:** `RecordGrid` in `apps/web/src/record-grid.tsx` for tables, and `apps/web/src/list-panel.tsx` for a list's choices.
  - **Example:** on the Lists page, select Sites and type a new choice in its empty row.
- **Like a spreadsheet:** Tables where many records are entered work like a spreadsheet. Arrow keys, Home, End and Tab move between cells, and Ctrl+Home and Ctrl+End go to the first and last. Enter, F2 or typing edits a cell; Enter saves and moves down, Tab saves and moves across, Esc cancels, and Delete clears. Pasting rows copied from a spreadsheet into an empty row adds one record for each.
  - **Drawn by:** `RecordGrid` in `apps/web/src/record-grid.tsx`.
  - **Example:** People, Features, and each table on Projects.
- **The empty row:** Empty rows at the end take new records, their cells blank until something is typed in one, so they aren't taken for records. A row being filled in is tinted as the draft it will be and marked by a hollow dot in its slot, whose tip and spoken words say New, not saved yet, and what is wrong so far or which required columns are still empty; what is wrong also shows in red after its first value. Its menu, also opened with Shift+F10, offers Clear row, which takes the row and what it holds away.
  - **Drawn by:** `RecordGrid` in `apps/web/src/record-grid.tsx`.
  - **Example:** type a name in the empty row at the end of Features.
- **Moving items:** Where people set an order, items have a grip for dragging on wide screens, shown on hover or focus, and Alt with the arrow keys moves the selected one. Its menu offers the same moves and shows each one's keys.
  - **Drawn by:** `apps/web/src/list-panel.tsx` for a list's choices, and the column menu in `apps/web/src/record-grid.tsx` for moving a column.
  - **Example:** the choices of Sites on the Lists page.

## Saving and Undo

- **Saved at once:** Changes save at once, without asking.
  - **Undo:** Cmd+Z or Ctrl+Z undoes the latest, except in a field with something typed in it, the note editor included, where the keys undo the typing alone. Undo covers every kind of record, the plan's included, checked by the same rules approving uses, and undoes everything saved with the change in one step, all or none.
  - **No notification in place:** changes seen in place show none.
  - **A notification with Undo:** shown at the top right, closing after a few seconds or when a newer change is made, for a change that takes something out of view, such as discarding the draft of a record only drafted to be added, deleting a saved view, or a team label a draft removes while Drafts applied is shown. Sharing a view, or stopping sharing it, shows one too, since nothing changes in view and it affects others.
  - **Settings:** they change Fathom for everyone, so they keep a Save button. Once saved, the change shows in place with no notification, Cmd+Z or Ctrl+Z undoes it, and leaving with a change unsaved asks first.
  - **Saved from a pencil:** the planning settings on Capacity each save at once from their pencil, as a details panel's values do, as a draft. An account's name and email address do too, with no notification, and Cmd+Z or Ctrl+Z undoes them.
  - **Drawn by:** `useSaving` and `isUndo` in `apps/web/src/saving.ts`, and `notifyUndoable` in `apps/web/src/notices.tsx`.
  - **Example:** on People, save a view, then delete it.
- **Asking first:** Of changes to data, only approving drafts, rejecting them, Discard all…, discarding chosen changes on the Drafts page, such as Discard 2 changes…, and deleting a saved view its maker can no longer use ask first, since they can't be undone, the last because its change history holds what the maker's role can't see; leaving unsaved work asks too, as [Leaving Unsaved Work](#leaving-unsaved-work) sets out, and so does exporting Personal or Confidential data, as [Exporting](tables.md#exporting) sets out. Each confirms what was done in a notification without Undo, such as Approved 3 drafts, since it takes drafts out of view. Changes to who may sign in, and to what they may do, ask first too, and confirm what was done in a notification without Undo: saving a change to a role that alters what the accounts holding it may do, whose question lists what each account gains and loses; changing an account's roles; resetting a password; and deactivating or reactivating an account.
  - **Drawn by:** `DecisionModal` in `apps/web/src/decision-dialog.tsx`, and `DiscardChangesModal` in `apps/web/src/unpublished.tsx` for Discard all… and discarding chosen changes. The role's confirmation, in `apps/web/src/roles-page.tsx`, the account's, in `apps/web/src/accounts-page.tsx`, and deleting a saved view, in `apps/web/src/saved-views.tsx`, are drawn by their own dialogs.
  - **Example:** Approve draft… in a seeded person's draft menu on People.
- **Failures:** A change that fails says so in plain words, saying what to do next, never as a raw error, and its notification stays until closed. The record goes back to how it was.
  - **Drawn by:** `notifyFailure` in `apps/web/src/notices.tsx`, with the words from `describeProblem` in `apps/web/src/api.ts`.
  - **Example:** none in the seed data; a lost connection while saving shows one.
- **A page that can't load:** A page, or a part of one, whose data can't be loaded says so in plain words in its place, with Try again.
  - **Drawn by:** `LoadProblem` in `apps/web/src/load-problem.tsx`.
  - **Example:** none in the seed data; stopping the server while a page loads shows one.

## Leaving Unsaved Work

- **Asking before discarding:** Leaving a form, a note, or a Settings panel with anything changed in it, by Cancel, the close button, another tab or another record, asks first, such as Discard the new customer? with Keep adding and Discard, or Discard changes to the note? with Keep writing and Discard. The question always starts with Discard and names what is lost, such as Discard the fill of TBD-3? A dialog with anything typed in it is a form here. A form can't be left while its record is being added, and a dialog can't be closed while a change is being saved.
  - **Drawn by:** `useDiscardQuestion` and `newRecordQuestion` in `apps/web/src/discard-question.tsx`, and the note's question, `noteQuestion`, in `apps/web/src/note-editing.tsx`.
  - **Example:** on Projects' Customers tab, select New customer, type a name, then Cancel.

## Refusals

- **A value refused:** A value refused when saved, by the page or by the server, keeps its editor open with what was typed, outlined in red, with the reason in red under it, so nothing is lost, in tables, panels and dialogs alike; in a table, the reason is under the row, in its first cell, and in a dialog, under the field it's about, or at the foot when it's about no one field. Esc leaves the value as it was.
  - **Drawn by:** `useRecordEditing` in `apps/web/src/record-editing.tsx` for a panel, and `RecordGrid` in `apps/web/src/record-grid.tsx` for a table.
  - **Example:** type 203013 in a Needed by cell on Features: Needed by: use a month such as 2027-03.
- **Names a role can't read:** A refusal naming the record that blocks a change, and the user's list of unpublished changes, name a record only to a role that reads its kind; any other role is told its kind alone, such as a feature or a planned hire. A record's name may include the record it belongs to, such as an allocation's feature.
  - **Drawn by:** the server, with `subjectOf` and each kind's `unseen` words in `apps/server/src/data/unpublished.ts`, and each plan kind's `unseenSubject` in `apps/server/src/data/release-kinds.ts` and `apps/server/src/data/allocation-kinds.ts`.
  - **Example:** with an account holding two roles, change a person on People, then switch to a role that doesn't see People: the Publish menu names the change to a person.
- **Controls turned off:** A control for a change the server would refuse is turned off, with a line saying why wherever the reason isn't plain to see. A control the reader might expect, such as New under Live only, is turned off with its reason rather than hidden; a control is hidden only when the role can never use it.
  - **Drawn by:** each page.
  - **Example:** in a list with meanings, such as Feature statuses, Retire and Remove are greyed out on the only choice that means Possible, with a line saying why.
- **Menu buttons:** A menu of actions on one thing opens from a ⋯, named "Actions for" the thing, such as Actions for Fictional Major. A ⋯ opening something else is named for what it opens, such as Unpublished changes. A card's ⋯, on the Features Board, shows only while the card is pointed at or has focus, and isn't a stop for Tab, since Shift+F10 on the card opens the same menu. The Org chart's cards have none: their menu opens from a right-click, Shift+F10 or the menu key.
  - **Drawn by:** `MoreButton`, named through `actionsFor`, in `apps/web/src/row-controls.tsx`, and a card's through `CardMenu` in `apps/web/src/card-menu.tsx`.
  - **Example:** on Lists, the ⋯ beside each list.

## Publishing

- **Private until published:** A person's changes are theirs alone until they publish them. While they have any, the top bar shows Publish with how many, such as Publish 3 changes, which publishes them all and confirms it in a notification without Undo, such as Published 3 changes., beside a menu listing them, with Discard all…, which asks first. Some changes can be published or discarded on their own, from the Drafts page's Not published tab, with the changes they must go with ticked alongside them, as [ADR 0008](../../adr/0008-unpublished-drafts.md) sets out; publishing confirms it in a notification without Undo, and discarding asks first. A record someone else is changing is held, as [Drafts](drafts-and-values.md#drafts) sets out.
  - **Drawn by:** `UnpublishedControl`, with `useUnpublishedActions` for both places, in `apps/web/src/unpublished.tsx`.
  - **Example:** change any value on Features: Publish 1 change shows in the top bar.
