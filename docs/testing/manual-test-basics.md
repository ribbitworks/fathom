---
title: "Manual Test Basics"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["docs/testing/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md"]
last_updated: "2026-11-11"
---

# Manual Test Basics

What every manual test in `docs/testing/` shares: the environment, where the accounts come from, the procedures the test cases refer to by name, and the terms they use. Each manual test links here and adds only what is its own.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- Roles as Fathom starts them: no change made to what any role grants in this clone's database. If one was changed, run [Reset the Database](#reset-the-database) before the first test case.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom, the second the data commands.

## Test Accounts

[Restore the Seed Data](#restore-the-seed-data) and [Reset the Database](#reset-the-database) create every account [Development Accounts](../design/development-setup.md#development-accounts) lists, with the name Fathom shows for each and the roles it holds, as [Roles](../product/roles.md#starting-roles) sets out. They share one password, which both procedures print when they finish. Each test names the accounts it uses by role and email address.

## Common Procedures

Test cases refer to these by name, such as "Run Restore the Seed Data".

### Start Fathom

Run once, before the first test case.

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at the address `pnpm dev` prints, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### Restore the Seed Data

Run after Start Fathom, before the first test case, and wherever a test case says so. Fathom keeps running. This removes the [Fictional Seed Data](../design/development-setup.md#fictional-seed-data) and every draft of it, including drafts made during the test, then adds the seed data again; it keeps accounts and anything else added by hand. It cannot restore the seed data once its drafts have been approved; run Reset the Database then.

1. In the second terminal, run:

   ```sh
   pnpm db:reseed
   ```

2. Confirm that the last line printed gives the shared password, with no error above it.
3. Reload the browser page.

### Reset the Database

Run only where a test says so. This deletes every account and record in the development database, including anything added by hand, and puts every role back as Fathom starts it. Ask the owner before running it on a database others use.

1. Stop Fathom: press Ctrl+C in the first terminal.
2. In the second terminal, run:

   ```sh
   pnpm db:reset && pnpm db:seed
   ```

3. Confirm that the last line printed gives the shared password, with no error above it.
4. Run Start Fathom.
5. Sign in again with the account the test case names.

### Open a Role

1. Select the **Roles** page in the left-hand menu.
2. Select **Edit** in the role's row.

### Publish

1. Select the Publish button.
2. Confirm that a notification says **Published**, and that the button is gone.

## Terms

- **Page and left-hand menu:** Fathom's pages are listed in the left-hand menu, the dark sidebar down the left of the window, in sections such as **Plan** and **People**. "Select the **Features** page" means selecting **Features** there. When the menu is collapsed to a narrow rail of icons, point at an icon to see its page's name, or select the button at the top of the rail, **Expand sidebar**, to show the names again. Opening a page from the menu shows its table as it starts, without the search, filters, sorting or grouping chosen there before.
- **Top bar and account menu:** the bar across the top of the window. The account menu opens from the account's name and initials at its right, and holds **Appearance**, with **System**, **Light** and **Dark**.
- **Appearance menu:** the choices **System**, **Light** and **Dark** under **Appearance** in the account menu.
- **Role menu:** the choices under **Role** in the account menu, one for each role the account holds, shown only for an account with more than one role.
- **Publish button:** the button in the top bar that reads **Publish** followed by the number of changes waiting, such as **Publish 4 changes**.
- **Mark:** a coloured dot followed by a word, such as a yellow dot and **Draft**, shown beside a record's name, in a row's first cell, or under a column's name. A hollow dot means the change is still unpublished.
- **Draft row and Live row:** a record with a draft is tinted light blue; under it, a light green row marked **Live** shows the record as it is now.
- **Search for:** type the text in the search box above a table, so only the matching rows show.
- **Views menu:** the menu that opens from the last of the buttons after the search box above a table. The button reads **Views**, or the name of the view applied.
- **Draft menu:** the menu that opens from the **Draft** button above a table, beside the search box, or, on the **Org chart** page, just right of the finder, the box reading **Find a person or team**.
- **Group by menu:** the menu that opens from the button above a table whose label starts **Group by:**, such as **Group by: Cycle**, naming the grouping in use.
- **Group heading:** the full-width row above each group of rows in a grouped table, naming the group, with how many rows it holds at its right.
- **Column menu:** the menu that opens when you select a column's name in a table's header.
- **⋯ menu:** the menu that opens from a **⋯** button, such as the one at the end of a table row, beside a list's name at the top of its panel, or beside the Publish button.
- **Details button:** the small button with an arrow out of a box at the right of a row's **Name** cell, shown while the row is pointed at.
- **Side panel:** the panel on the right that opens from **Show details** in a row's ⋯ menu, or from the details button. Its close button, an **×**, is at its top right.
- **Change button:** a small pencil at the right of a value in a side panel, shown to accounts that may change it.
- **Grid:** the table on the left of the role dialog, with an area in each row and the columns **View**, **Draft**, **Approve** and **Edit**.
- **Dates:** steps type dates as digits, such as `2030-03-15`; tables and panels show them as the browser's language writes them, such as **15 Mar 2030** or **Mar 15, 2030**.
