---
title: "Manual Test: Saved Views"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-08"
---

# Manual Test: Saved Views

## Scope

Verifies how personal and shared views look and work on the People page: the Views menu's two groups, saving a view as personal or shared, and sharing a view and taking it back, as seen from more than one account.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place and the [Fictional Seed Data](../design/development-setup.md#fictional-seed-data) added.
- Roles as Fathom starts them: no change made to what any role grants in this clone's database.
- A desktop web browser.
- A second browser, or a private window, for signing in as a second account while the first stays signed in.
- Two terminals open at the repository root: the first runs Fathom ([R0](#r0-start-fathom)), the second the data commands ([R1](#r1-restore-the-seed-data)).

## Test Accounts

[R1](#r1-restore-the-seed-data) creates these accounts, so they exist once it has run. They share one password, which it prints when it finishes.

- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It holds the Workforce Administrator role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Second Workforce Administrator account:** `engineering.operations.manager.2@fathom.test`, shown in Fathom as **Second Engineering Operations Manager**. It holds the Workforce Administrator role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Resource Planner account:** `resource.planner@fathom.test`, shown in Fathom as **Resource Planner**. It holds the Resource Planner role, as [Roles](../product/roles.md#starting-roles) sets out.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at the address `pnpm dev` prints, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R1: Restore the Seed Data

Use after R0, before the first test case. Fathom keeps running. This removes the seed data and every draft of it, then adds the seed data again; it keeps accounts and anything else added by hand.

1. In the second terminal, run:

   ```sh
   pnpm db:reseed
   ```

2. Confirm that the last line printed gives the shared password, with no error above it.
3. Reload the browser page.

## Terms

- **Views menu:** the menu that opens from the last of the buttons after the search box above the People table. The button says **Views**, or the name of the view applied.
- **Main window:** the browser window the test starts in.
- **Second window:** the second browser or private window.
- **Appearance menu:** the choices **System**, **Light** and **Dark** under **Appearance**, in the menu that opens from the account's name and initials at the top right.

## Test Cases

### VIEW-01: A Personal View Is Kept to Its Maker

**Account:** Resource Planner, `resource.planner@fathom.test`, the first account of this test.

**Preconditions:** R1 has been run. Signed in with this account in the main window. Select **People** in the left-hand menu.

- [ ] **Step 1.** Type `an` in the search box above the table.
  - **Expected:** The table shows only the rows matching **an**, and a **Views** button shows above the table.
  - **Notes:**

- [ ] **Step 2.** Open the Views menu.
  - **Expected:** **Save view…** is offered.
  - **Notes:**

- [ ] **Step 3.** Select **Save view…**.
  - **Expected:** A dialog titled **Save view** shows **Name** and, under **Includes**, the search. It offers no choice about sharing.
  - **Notes:**

- [ ] **Step 4.** Type `Fictional planner view` in **Name**.
  - **Expected:** The name shows in **Name**, with no message under it.
  - **Notes:**

- [ ] **Step 5.** Select **Save view** in the dialog.
  - **Expected:** The dialog closes, and the Views menu's button says **Fictional planner view**.
  - **Notes:**

- [ ] **Step 6.** Open the Views menu.
  - **Expected:** The heading **My views** is above **Fictional planner view**, which has a check mark. **Rename…** and **Delete view** are offered. **Share current view** is not.
  - **Notes:**

- [ ] **Step 7.** In the second window, sign in as Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`, changed from this case's first account.
  - **Expected:** Fathom opens, signed in as **Second Engineering Operations Manager**.
  - **Notes:**

- [ ] **Step 8.** In the second window, select **People** in the left-hand menu.
  - **Expected:** The People table shows, with no view applied.
  - **Notes:**

- [ ] **Step 9.** In the second window, type `an` in the search box above the table.
  - **Expected:** A **Views** button shows above the table.
  - **Notes:**

- [ ] **Step 10.** In the second window, open the Views menu.
  - **Expected:** **Fictional planner view** is not listed.
  - **Notes:**

### VIEW-02: A Shared View Is Saved and Seen by Others

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from VIEW-01.

**Preconditions:** The second window is signed in as Second Workforce Administrator, as VIEW-01 leaves it. In the main window, sign out, sign in with this case's account, and select **People** in the left-hand menu.

- [ ] **Step 1.** In the main window, type `el` in the search box above the table.
  - **Expected:** The table shows only the rows matching **el**.
  - **Notes:**

- [ ] **Step 2.** Open the Views menu.
  - **Expected:** **Save view…** is offered.
  - **Notes:**

- [ ] **Step 3.** Select **Save view…**.
  - **Expected:** The dialog shows a checkbox, **Share with everyone who sees this table**, not ticked, below **Name**.
  - **Notes:**

- [ ] **Step 4.** Type `Fictional team view` in **Name**.
  - **Expected:** The name shows in **Name**, with no message under it.
  - **Notes:**

- [ ] **Step 5.** Tick **Share with everyone who sees this table**.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] **Step 6.** Select **Save view** in the dialog.
  - **Expected:** The dialog closes, and the Views menu's button says **Fictional team view**.
  - **Notes:**

- [ ] **Step 7.** Open the Views menu.
  - **Expected:** The heading **Shared views** is above **Fictional team view**. **Take back current view** is offered.
  - **Notes:**

- [ ] **Step 8.** In the second window, sign out, and sign in as Resource Planner, `resource.planner@fathom.test`, changed from this case's first account.
  - **Expected:** Fathom opens, signed in as **Resource Planner**.
  - **Notes:**

- [ ] **Step 9.** In the second window, select **People** in the left-hand menu.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] **Step 10.** In the second window, open the Views menu.
  - **Expected:** **My views** lists **Fictional planner view** and, below it, **Shared views** lists **Fictional team view**.
  - **Notes:**

- [ ] **Step 11.** In the second window, select **Fictional team view**.
  - **Expected:** The search box shows **el**.
  - **Notes:**

- [ ] **Step 12.** In the second window, open the Views menu.
  - **Expected:** **Rename…**, **Delete view**, and **Take back current view** are not offered.
  - **Notes:**

### VIEW-03: A View Is Shared and Taken Back

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as VIEW-02.

**Preconditions:** In the main window, this account is signed in on **People**. In the second window, Resource Planner, `resource.planner@fathom.test` is signed in on **People**, as VIEW-02 leaves it.

- [ ] **Step 1.** In the main window, replace the text in the search box above the table with `ar`.
  - **Expected:** The table shows only the rows matching **ar**.
  - **Notes:**

- [ ] **Step 2.** Open the Views menu.
  - **Expected:** **Save view…** is offered.
  - **Notes:**

- [ ] **Step 3.** Select **Save view…**.
  - **Expected:** A dialog titled **Save view** shows, with **Share with everyone who sees this table** not ticked.
  - **Notes:**

- [ ] **Step 4.** Type `Fictional passed round` in **Name**.
  - **Expected:** The name shows in **Name**, with no message under it.
  - **Notes:**

- [ ] **Step 5.** Select **Save view** in the dialog.
  - **Expected:** The dialog closes, and the Views menu's button says **Fictional passed round**.
  - **Notes:**

- [ ] **Step 6.** Open the Views menu.
  - **Expected:** **Fictional passed round** is under **My views**, and **Share current view** is offered.
  - **Notes:**

- [ ] **Step 7.** Select **Share current view**.
  - **Expected:** A notice at the top right says **Shared the Fictional passed round view.** and offers **Undo**.
  - **Notes:**

- [ ] **Step 8.** Open the Views menu.
  - **Expected:** **Fictional passed round** is under **Shared views**, and **Take back current view** is offered in place of **Share current view**.
  - **Notes:**

- [ ] **Step 9.** In the second window, reload the page.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] **Step 10.** In the second window, open the Views menu.
  - **Expected:** **Fictional passed round** is under **Shared views**.
  - **Notes:**

- [ ] **Step 11.** In the main window, select **Take back current view** from the Views menu.
  - **Expected:** A notice says **Took back the Fictional passed round view.** and offers **Undo**.
  - **Notes:**

- [ ] **Step 12.** In the main window, open the Views menu.
  - **Expected:** **Fictional passed round** is under **My views** again.
  - **Notes:**

- [ ] **Step 13.** In the second window, reload the page.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] **Step 14.** In the second window, open the Views menu.
  - **Expected:** **Fictional passed round** is not listed.
  - **Notes:**

### VIEW-04: Sharing a View Whose Name Is Taken Says So

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as VIEW-03.

**Preconditions:** In the main window, this account is signed in on **People**, with **Fictional team view** saved as VIEW-02 leaves it.

- [ ] **Step 1.** Replace the text in the search box above the table with `ma`.
  - **Expected:** The table shows only the rows matching **ma**.
  - **Notes:**

- [ ] **Step 2.** Open the Views menu.
  - **Expected:** **Save view…** is offered.
  - **Notes:**

- [ ] **Step 3.** Select **Save view…**.
  - **Expected:** A dialog titled **Save view** shows, with **Share with everyone who sees this table** not ticked.
  - **Notes:**

- [ ] **Step 4.** Type `Fictional team view` in **Name**.
  - **Expected:** The name shows in **Name**, with no message under it.
  - **Notes:**

- [ ] **Step 5.** Select **Save view** in the dialog.
  - **Expected:** The dialog closes, and the Views menu's button says **Fictional team view**.
  - **Notes:**

- [ ] **Step 6.** Open the Views menu.
  - **Expected:** **Fictional team view** is listed under both **My views** and **Shared views**, the one under **My views** with a check mark.
  - **Notes:**

- [ ] **Step 7.** Select **Share current view**.
  - **Expected:** A notice says **There is already a shared view named Fictional team view**.
  - **Notes:**

- [ ] **Step 8.** Open the Views menu.
  - **Expected:** The view with the check mark is still under **My views**.
  - **Notes:**

### VIEW-05: The Menu and Dialog Read Well in Light and Dark

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as VIEW-04.

**Preconditions:** In the main window, this account is signed in on **People**, with views saved as the earlier cases leave them. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Open the Views menu.
  - **Expected:** **My views** and **Shared views** read as headings, set apart from the names below them, and the names line up under each.
  - **Notes:**

- [ ] **Step 2.** Press Esc to close the menu.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] **Step 3.** Choose **Dark** in the Appearance menu.
  - **Expected:** Fathom turns dark.
  - **Notes:**

- [ ] **Step 4.** Open the Views menu.
  - **Expected:** The headings and names are as easy to read as in light.
  - **Notes:**

- [ ] **Step 5.** Select **Save view…**.
  - **Expected:** The dialog and its checkbox are as easy to read as in light.
  - **Notes:**

- [ ] **Step 6.** Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] **Step 7.** Choose **Light** in the Appearance menu.
  - **Expected:** Fathom turns light.
  - **Notes:**

### VIEW-06: The Menu and Dialog Work by Keyboard

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as VIEW-05.

**Preconditions:** In the main window, this account is signed in on **People**, with views saved as the earlier cases leave them.

- [ ] **Step 1.** Select the search box.
  - **Expected:** The search box has focus.
  - **Notes:**

- [ ] **Step 2.** Press Tab until the Views menu's button has focus.
  - **Expected:** The button has a focus ring.
  - **Notes:**

- [ ] **Step 3.** Press Enter.
  - **Expected:** The Views menu opens.
  - **Notes:**

- [ ] **Step 4.** Press the Down arrow key several times.
  - **Expected:** Focus moves through the views and skips the headings **My views** and **Shared views**.
  - **Notes:**

- [ ] **Step 5.** Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] **Step 6.** Open the Views menu and select **Save view…**.
  - **Expected:** The dialog opens with focus in **Name**.
  - **Notes:**

- [ ] **Step 7.** Press Tab.
  - **Expected:** Focus moves to **Share with everyone who sees this table**.
  - **Notes:**

- [ ] **Step 8.** Press Space.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] **Step 9.** Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

### VIEW-07: The Views Saved Are Removed

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as VIEW-06.

**Preconditions:** In the main window, this account is signed in on **People**. In the second window, Resource Planner, `resource.planner@fathom.test` is signed in on **People**.

- [ ] **Step 1.** In the main window, open the Views menu and select **Fictional passed round**.
  - **Expected:** The Views menu's button says **Fictional passed round**.
  - **Notes:**

- [ ] **Step 2.** Open the Views menu and select **Delete view**.
  - **Expected:** **Fictional passed round** is gone from the Views menu.
  - **Notes:**

- [ ] **Step 3.** Open the Views menu and select **Fictional team view** under **My views**.
  - **Expected:** The Views menu's button says **Fictional team view**.
  - **Notes:**

- [ ] **Step 4.** Open the Views menu and select **Delete view**.
  - **Expected:** **Fictional team view** is listed only under **Shared views**.
  - **Notes:**

- [ ] **Step 5.** Open the Views menu and select **Fictional team view** under **Shared views**.
  - **Expected:** The Views menu's button says **Fictional team view**.
  - **Notes:**

- [ ] **Step 6.** Open the Views menu and select **Delete view**.
  - **Expected:** **Fictional team view** is gone from the Views menu.
  - **Notes:**

- [ ] **Step 7.** In the second window, reload the page.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] **Step 8.** In the second window, open the Views menu and select **Fictional planner view**.
  - **Expected:** The Views menu's button says **Fictional planner view**.
  - **Notes:**

- [ ] **Step 9.** In the second window, open the Views menu and select **Delete view**.
  - **Expected:** **Fictional planner view** is gone from the Views menu.
  - **Notes:**
