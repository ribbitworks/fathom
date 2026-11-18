---
title: "Manual Test Basics"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["docs/testing/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md"]
last_updated: "2026-11-18"
---

# Manual Test Basics

What every manual test in `docs/testing/` and `docs/testing/acceptance/` shares: the environment, where the accounts come from, the procedures the test cases refer to by name, and the terms they use. Each manual test links here and adds only what is its own.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- Roles as Fathom starts them: no change made to what any role grants in this clone's database. If one was changed, run [Reset the Database](#reset-the-database) before the first test case.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom, the second the data commands.

## Test Accounts

[Restore the Seed Data](#restore-the-seed-data), [Reset the Database](#reset-the-database) and [Start From an Empty Database](#start-from-an-empty-database) create every account [Development Accounts](../design/development-setup.md#development-accounts) lists, with the name Fathom shows for each and the roles it holds, as [Roles](../product/roles.md#starting-roles) sets out. They share one password, which each of them prints when it finishes. Each test names the accounts it uses by role and email address.

## Reading a Step

Each step starts with its ID, such as `7C2E`, which stays the same when steps are added or removed around it. Name a step by its test case and ID, such as REL-11 `7C2E`, in notes and issues.

```markdown
- [ ] `7C2E` Select **Approve**.
  - **Expected:**
    - A notification says "Approved 1 draft."
    - In the table, 'Patches' is no longer listed.
  - **Notes:**
```

In short, the text in a step is marked as [Testing Standards](../standards/testing.md#manual-tests) sets out:

- **Bold:** something to select or read on screen, such as a button, menu, page, field or column.
- `Backticks`: something to type, an exact value, or a step's ID.
- "Double quotes": the exact text to check on screen, such as a notification.
- 'Single quotes': seed data, such as a person, team, schedule or release.

## Recording Results

Mark each step's checkbox while running it, and write anything else under its **Notes:**:

- `- [x]`: the step passes.
- `- [?]`: the step passes, with questions or suggestions in its notes.
- `- [!]`: the step fails; its notes say what was seen instead.

Marks and notes are kept while a test is being run and changed, and cleared before the test is committed, so every committed test starts unmarked.

Before they are cleared, save the marked copy outside the repository, since its notes are working notes. It is named after the test with the date and time it was last run, as `<test>_YYYY_MM_DD_hh_mm.md`, such as `roles-manual-test_2026_11_12_14_30.md`, and starts with the test's title, followed by a line giving that date and time and the branch it was run on, such as **Last run:** 2026-11-12 14:30, on `feat/simpler-roles`.

## Common Procedures

Test cases refer to these by name, such as "Run Restore the Seed Data".

### Start Fathom

Run once, before the first test case.

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom, showing the **Sign in** page or the page last open. If it doesn't open, open the web address `pnpm dev` prints.
3. Leave the terminal running for the whole test.

### Restore the Seed Data

Run after Start Fathom, before the first test case unless the test starts another way, and wherever a test case says so. Fathom keeps running. This removes the [Fictional Data](../design/development-setup.md#fictional-data) and every draft of it, including drafts made during the test, then adds the seed data again; it keeps accounts and anything else added by hand. It also forgets the view each development account last showed on each page, so every page opens on its own view. The seed data's own drafts that were approved since it was added are not made again; run Reset the Database to have them back.

1. In the second terminal, run:

   ```sh
   pnpm db:reseed
   ```

2. Confirm that the last line printed gives the shared password, with no error above it.
3. Reload the browser page.

### Reset the Database

Run only where a test says so. This deletes every account and record in the development database, including anything added by hand, and puts every role back as Fathom starts it. Before running it on a database others use, check first with the others who use it.

1. Stop Fathom: press Ctrl+C in the first terminal.
2. In the second terminal, run:

   ```sh
   pnpm db:reset && pnpm db:seed
   ```

3. Confirm that the last line printed gives the shared password, with no error above it.
4. Run Start Fathom.
5. Sign in again with the account the test case names.

### Start From an Empty Database

Run only where a test says so. This deletes every account and record in the development database, including anything added by hand, puts every role back as Fathom starts it, and adds back only the development accounts, with no other data. Before running it on a database others use, check first with the others who use it.

1. Stop Fathom: press Ctrl+C in the first terminal.
2. In the second terminal, run:

   ```sh
   pnpm db:reset && pnpm db:seed:accounts
   ```

3. Confirm that the last line printed gives the shared password, with no error above it.
4. Run Start Fathom.

### Open a Role

1. Select the **Roles** page in the left-hand menu.
2. Select **Edit** in the role's row.

### Publish

1. Select the Publish button.
2. Confirm that a notification says "Published" followed by the number of changes, and that the button is gone.

### Discard the Unpublished Changes

1. Select the **⋯** button beside the Publish button, then **Discard all…**.
2. In the dialog titled **Discard** followed by the number of changes, select **Discard**.
3. Confirm that a notification says "Discarded" followed by the number of changes, and that the Publish button is gone.

## Terms

- **Page and left-hand menu:** Fathom's pages are listed in the left-hand menu, the dark sidebar down the left of the window, in sections such as **Plan** and **People**. "Select the **Features** page" means selecting **Features** there. When the menu is collapsed to a narrow rail of icons, point at an icon to see its page's name, or select the button at the top of the rail, **Expand sidebar**, to show the names again. Opening a page from the menu shows its table as it starts, without the search, filters, sorting or grouping chosen there before.
- **Top bar and account menu:** the bar across the top of the window. The account menu opens from the account's name and initials at its right, and holds **Appearance**, with **System**, **Light** and **Dark**.
- **Appearance menu:** the choices **System**, **Light** and **Dark** under **Appearance** in the account menu.
- **Role menu:** the choices under **Role** in the account menu, one for each role the account holds, shown only for an account with more than one role.
- **Publish button:** the button in the top bar that reads **Publish** followed by the number of changes waiting, such as **Publish 4 changes**.
- **Mark:** a dot just before what a draft changes, such as a record's name, a value, a part such as a team's member, or a column's name, with no words beside it: yellow while the draft waits for approval, hollow yellow for the account's own unpublished changes, and red in a ring once rejected. A green dot marks a live value, the record as it is now, in a Live row or under a drafted value, and, under **Live only**, what a waiting draft would change. Pointing at a dot shows its words, such as **Draft: added**. A removed record or part is struck through after its dot.
- **Lock:** a grey lock before a record someone else has unpublished changes to. Pointing at it shows **Being changed by** and their name. The record is read only until they publish or discard them.
- **Class mark:** a small grey symbol just before a column's name in its heading, or a list's name, giving the class of its data: an eye with a line through it for **Personal**, and a lock with a keyhole for **Confidential**. Pointing at it shows the class's name. A **General** column or list has none. The lock with a keyhole is not the lock above, which has no keyhole.
- **Box:** a small outlined word just after an item: yellow for **Moved**, **Reordered**, **Retired** or **Restored**; red for a warning after a value, such as **Left**; grey for a fact, such as **Built in** or **Planned, expected** and a month.
- **Slot:** the narrow space at the start of a table's row, before its first value, holding the mark of a draft that adds, removes, retires or moves the record. A draft that only changes values the row shows leaves the slot empty, with a dot before each changed value.
- **Draft row and Live row:** while **Drafts & Live** is chosen in the Draft menu, as each page starts, a row with a draft is tinted faint yellow, or faint red once the draft is rejected, and its changed values are in semibold; under it, a light green Live row shows the record as it is now, with a green dot before each live value the draft changes, or in its slot. **Drafts applied** and **Live only** show no tints and no Live rows.
- **Page's heading and title:** the line at the top of a page holding its title, such as **Drafts**, any tabs just after the title, and the page's buttons at its right. On the **Drafts** page, buttons for the ticked rows show there only while rows are ticked.
- **Tick box:** the small box before a row's slot on a table whose rows can be chosen together, such as on the **Drafts** page. The tick box in the table's header, before the first column's name, ticks every row shown that can be ticked. A greyed-out tick box can't be ticked.
- **Search for:** type the text in the search box above a table, so only the matching rows show.
- **Views menu:** the menu that opens from the last of the buttons after the search box above a table. The button reads **Views**, or the name of the view applied.
- **Draft menu:** the menu that opens from the **Draft** button above a table, beside the search box, or, on the **Org chart** page, just right of the finder. The button, with a funnel icon, names the choice shown, such as **Drafts & Live**, and has a dot after it while a draft filter is in use.
- **Group by menu:** the menu that opens from the button above a table whose label starts **Group by**, such as **Group by**, **Group by: Cycle** or **Group by: Manager, then Site**. Its choices may be under a **Group by** label and a **Then by** label, and it may end with **Clear grouping**.
- **Group heading:** the full-width row above each group of rows in a grouped table, naming the group, with how many rows it holds at its right.
- **Column menu:** the menu that opens from a column's name in a table's header.
- **⋯ menu:** the menu that opens from a **⋯** button, such as the one at the end of a table row, beside a list's name at the top of its panel, or beside the Publish button. A table row's ⋯ menu also opens from the **⋯** after its details button, or from a right-click anywhere on the row.
- **Details button:** the small button drawn as a box with a line down its right side, at the right of a row's **Name** cell, or its first cell where that column has no heading, with a **⋯** button after it, both shown while the row is pointed at.
- **Side panel:** the panel on the right that opens from **Show details** in a row's ⋯ menu, or from the details button. Steps also call it the details panel. It is headed with the record's name, and its close button, an **×**, is at its top right.
- **Open button:** a small box with its right side marked, at the right of a note in a side panel, in place of a change button, shown while the note's row is pointed at or has focus. It opens the note in a panel of its own, to read it, and to change it for accounts that may. Selecting the row anywhere does the same.
- **Change button:** a small pencil at the right of a value in a side panel, shown to accounts that may change it while the value's row is pointed at or has focus. Selecting the row anywhere does the same. To check whether a value or row has a change button, or whether a panel shows any, point at each row the step names, or at each of the panel's rows.
- **Grid:** the table on the left of the role dialog, with an area in each row and the columns **Area**, **View**, **Approve** and **Edit**. Under a **Data classification** heading, its last rows are the classes **General**, **Personal** and **Confidential**.
- **Chart:** on the **Org chart** page, the large panel under the finder and the date row that holds the cards.
- **Finder:** the box reading **Find a person or team** at the left, just under the **Org chart** heading.
- **Teams switch:** the two-part switch reading **Reporting teams** and **Feature teams** just after the **Org chart** heading, on the same line.
- **Card:** the box for one person on the chart, showing their name, their position under it, and the team's name under that on the card of a reporting team's manager, when the team has a name, and on a feature team's first card.
- **Band:** the strip of colour along the top edge of a card.
- **Feature teams button:** the button reading **Feature teams** above the chart, at its left, just right of the finder and of the **Draft** button where that is shown, once the chart shows feature teams. It lists the feature teams, and **New feature team** to those who may add one.
- **Team panel:** the panel that opens to the right of the chart when a feature team is chosen, titled with the team's name, with a **Details** section and a **Members** section.
- **Mode switch:** the switch just after the **Capacity** heading, on the same line, reading **People** and **Settings**.
- **Team list:** the list of feature teams that opens below a month's cell on the **Feature assignments** page for editing, with a box to type in at its top.
- **Seeded dates:** the seed data is dated from the day it is added, as [Fictional Data](../design/development-setup.md#fictional-data) sets out, so its cycles and releases move with today, and steps name them by where they fall. A cycle's name is the year it ends in and its number in that year, such as '27.1'.
- **Dates:** steps type dates as digits, such as `2030-03-15`; tables and panels show them as the browser's language writes them, such as `15 Mar 2030` or `Mar 15, 2030`.
