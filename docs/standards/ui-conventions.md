---
title: "UI Conventions"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["apps/web/**", "docs/testing/**"]
dependencies: ["docs/design/visual-design.md", "docs/standards/code-review.md", "docs/standards/ui-conventions/drafts-and-values.md", "docs/standards/ui-conventions/dates-timelines-and-boards.md", "docs/standards/ui-conventions/pages-and-panels.md", "docs/standards/ui-conventions/entering-and-saving.md", "docs/standards/ui-conventions/tables.md"]
last_updated: "2026-11-19"
---

# UI Conventions

The principles and conventions every screen follows, for those who build screens. The principles and the rules for words are here; the conventions are in the [parts](#the-conventions) listed below. Each convention gives the rule, the shared piece that draws it, so a new screen reuses it rather than drawing its own, and an example from the [fictional data](../design/development-setup.md#fictional-data), or the steps that make one. [Planned](#planned) lists where Fathom doesn't follow them yet. How each page is laid out is in [Visual Design](../design/visual-design.md) and the page designs in `docs/design/pages/`.

## Principles

These principles come first:

- **No instructional text:** If a screen needs explaining, the design is wrong. No hints, help lines, or placeholder sentences telling people what to do. This is for text always on screen: a refusal may say what to do next, such as Choose a manager, or leave Manager assigned empty, and a menu or dialog may state, in one short line, a fact needed at that moment, such as Nobody else sees these changes until they're published, but never how to use the control. Labels are one or two words, and an optional field may add "(optional)" to its label. Familiar patterns, such as a grip handle for dragging, speak for themselves. Saying what an action will do, as a confirmation does, is not instruction, and neither is reference material, such as what each role lets a user do.
- **No assumptions:** Screens add no purposes, defaults, restrictions, or wording the maintainer has not asked for. Where something is unclear, it is left out and the maintainer is asked.
- **Words people say:** Every label, note, and message on screen, the server's refusals included, reads as a person would say it aloud: short, with a subject and a verb, such as "Hiring states needs a choice that means Proposed", never a stack of nouns, such as "the only offered choice meaning Proposed", and everyday verbs, such as "the column that uses this list", never "the column drawing on it".
- **Never the second person:** Nothing on screen, the server's refusals included, says "you" or "your". Say what is so, such as "Nothing can be changed on this date" or "This role can't choose an earlier date". Help pages are the exception, as [Help Page Standards](help-pages.md) sets out.
- **Keyboard-first data entry:** Wherever people enter or change data, everything can be done from the keyboard, and adding many items in a row never needs the mouse: Tab moves between fields, Enter saves and starts the next item, Esc cancels, and arrow keys move between items. Where many records are entered, such as resources, editing works like a spreadsheet, including pasting rows.
- **The bar:** Top-tier modern products, such as Linear or Notion: calm, dense, and obvious.

The rest follow from them:

- **Quiet and dense:** Fathom is a work tool used every day, so pages favour clear structure and plenty of information over decoration. As few borders, lines, labels, and columns as the task allows; metadata, such as who changed something, stays out of the way.
- **One main action per screen:** Every other action is secondary or in a menu.
- **Buttons look like buttons:** The main action is filled. Every other text button has an outline, as Cancel does. A button that deletes or deactivates is red, filled or outlined; retiring is neither, since a retired record can be restored, so Retire stays grey. A toggle, such as Show retired, is tinted while on, and a button inside an alert, such as Try again, is tinted in the alert's colour. Only icon buttons, such as ⋯ and ×, and links within a sentence, such as Show all in the change history, have no outline.
- **Controls when needed:** Controls that are not always needed, such as grip handles for dragging, a table row's buttons over its Name cell and a details panel's pencils, appear on hover or keyboard focus. A table row's buttons, its "⋯" menu button and its right-click menu work as [A row's controls](ui-conventions/tables.md#tables) sets out.
- **No wasted space:** Layout serves the content; nothing takes width or height it does not earn.
- **Colour means something:** Neutrals carry the page. Sea blue marks actions and the current place. Other colours appear only for meaning, such as green for active, yellow for drafts waiting for approval, and red for problems, except for the colours people choose: for releases on the [Releases timeline](../design/pages/releases.md), for teams wherever they are named, as on the [Org chart](../design/pages/org-chart.md), and for text in notes.
- **Never colour alone:** Anything shown by colour is also shown in words, visible or read aloud by screen readers.
- **Both modes:** Fathom follows the computer's setting until a person chooses Light or Dark in their account menu; System follows it again. The choice is kept in that browser alone, and applies on every page, signing in included.
- **International:** Names and text in any language and script are shown, entered, searched, and sorted as well as English is: no screen assumes Latin letters, a given name first, or one name per person, and text is never cut so a character breaks. Search ignores letter case and accents, such as é or ё, but not marks that make another letter in other scripts, such as Japanese が, though Cyrillic letters such as й also match their plain letter. Sorting, dates, and counts follow each person's own language settings, and scripts the typeface lacks fall back to the system's fonts. The [seed data](../design/development-setup.md#fictional-data) includes names in other scripts, so every screen is tried with them.

## Words

- **Plain words:** Every word on screen follows the [Principles](#principles). On top of them, use the plain verb: added, removed, changed, retired, restored, never "comes off" or "taking off". Records and their drafts are removed, never deleted; delete is for what isn't a record, such as a saved view. Fields and tables are set up in everyday words, such as Must be filled in, never database terms; a column of web addresses is a Web link, so it isn't taken for Link to another table. A naming pattern is shown as typed, such as {YY}.{N}, only where it is set: the Names field of the dialog that sets a schedule's cycles, and the row in the schedule's details that names its pattern; everywhere else, cycles show their real names, such as 27.1.
  - **Drawn by:** the words themselves, with `draftWords` and `DraftedWords` in `apps/web/src/status-mark.tsx` for drafts.
  - **Example:** Draft: removed.
- **Tips:** A tip of one phrase has no period, such as Also under Search; a tip of several sentences ends each with one.
  - **Drawn by:** the words themselves, shown by `TableTips` or `Tipped` in `apps/web/src/table-tips.tsx` on tables.
  - **Example:** on People, choose Feature teams in Group by, and point at the +1 after Lorenza Thiel's name.
- **A menu item's "…":** A menu item that opens a dialog or a confirmation ends in "…", such as Edit column…, Approve draft… or Change password…. One that acts at once, even with Undo, or opens a side panel, has none, such as Delete view, Remove column or New feature team. The dialog's own title has none either, such as Edit column.
  - **Drawn by:** the words themselves: the column menu in `apps/web/src/column-header.tsx` and `draftItemLabel`, for a row's Approve draft… and Reject draft…, in `apps/web/src/row-menus.tsx`, and the account menu in `apps/web/src/layout.tsx`.
  - **Example:** on People, open the Site column's menu: Edit column… opens its dialog, and Remove column removes the column at once, as a draft.

## The Conventions

- [Drafts, Values and Access](ui-conventions/drafts-and-values.md): How drafts, values and data classes are marked, and what a role without access sees.
- [Dates, Timelines and Boards](ui-conventions/dates-timelines-and-boards.md): How days and months are shown and typed, the shared timeline, and boards of cards.
- [Pages and Panels](ui-conventions/pages-and-panels.md): The top bar, the page heading, links to records, history, details panels, focus, and Help pages.
- [Entering and Saving Data](ui-conventions/entering-and-saving.md): Fields, choices, entering data from the keyboard, saving and undo, refusals, and publishing.
- [Tables, Addresses and Search](ui-conventions/tables.md): Tables, their views and groupings, what the address keeps, exporting, and search.

## Planned

Where Fathom doesn't yet follow the conventions, by the section that sets each out, with the issue that records each gap where there is one:

- **[Timelines](ui-conventions/dates-timelines-and-boards.md#timelines):** the Plan and the project timeline; feature rows, whose label shows the feature's ID and name on the bar's line with its Size mark under them, leaving room under the bar for day marks such as Needed by; the release layer's Releases picker; the cycle and release lines on the month grids, which name their months their own way; and the date row on People and the Org chart, `apps/web/src/date-control.tsx`, becoming the strip.
- **[Values](ui-conventions/drafts-and-values.md#values):** the Size and Risk marks in a feature's details, a timeline's row labels and group headings, as well as on the Features Board's cards; and the Features Board's headings and the month grids, which still show a coloured name in a box tinted with its colour, from `TeamLabels` in `apps/web/src/team-labels.tsx`, rather than after its square.
- **[Dates](ui-conventions/dates-timelines-and-boards.md#dates):** People's date cells and Person details, which still have their own fields rather than `DayInput` ([issue #185](https://github.com/ribbitworks/fathom/issues/185)).
- **[Links to Records](ui-conventions/pages-and-panels.md#links-to-records):** each record's [record key](../design/domain-model.md#change-and-history-entities) shown beside its name wherever a project or proposal is named with its ID, and links to records in a table's cells.
- **[Details Panels](ui-conventions/pages-and-panels.md#details-panels):** a project's details, whose Show milestones sits beside the Milestones heading, with no outline, and Add milestone under the list with a + before it; both move under the list, Add milestone first ([issue #35](https://github.com/ribbitworks/fathom/issues/35)).
- **[Fields](ui-conventions/entering-and-saving.md#fields):** the fields with no × yet ([issue #182](https://github.com/ribbitworks/fathom/issues/182), [issue #195](https://github.com/ribbitworks/fathom/issues/195)).
- **[Saving and Undo](ui-conventions/entering-and-saving.md#saving-and-undo):** the Settings page, which confirms a save in a notification with no Undo, and doesn't ask when left with a change unsaved ([issue #64](https://github.com/ribbitworks/fathom/issues/64)); accounts, edited in a dialog with Save, and changing an account's roles, which doesn't ask first ([issue #252](https://github.com/ribbitworks/fathom/issues/252)).
- **[Leaving Unsaved Work](ui-conventions/entering-and-saving.md#leaving-unsaved-work):** leaving a fill, which asks Stop filling this planned hire? with Keep filling ([issue #141](https://github.com/ribbitworks/fathom/issues/141)); and these, left without asking: the role and account dialogs ([issue #242](https://github.com/ribbitworks/fathom/issues/242)), the list dialog ([issue #71](https://github.com/ribbitworks/fathom/issues/71)), the view dialog ([issue #129](https://github.com/ribbitworks/fathom/issues/129)) and New feature team ([issue #150](https://github.com/ribbitworks/fathom/issues/150)).
- **[Panels and Focus](ui-conventions/pages-and-panels.md#panels-and-focus):** the Org chart's Teams, still a drawer kept out of the address ([issue #146](https://github.com/ribbitworks/fathom/issues/146)).
