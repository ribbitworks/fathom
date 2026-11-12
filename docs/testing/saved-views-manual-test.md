---
title: "Manual Test: Saved Views"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-11"
---

# Manual Test: Saved Views

## Scope

Verifies how personal and shared views look and work on the People page: the Views menu's two groups, saving a view as personal or shared, sharing a view and taking it back, and moving columns as part of a view, as seen from more than one account.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A second browser, or a private window, for signing in as a second account while the first stays signed in.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**
- **Second Workforce Administrator:** `engineering.operations.manager.2@fathom.test`, shown in Fathom as **Second Engineering Operations Manager**
- **Resource Planner:** `resource.planner@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the Appearance menu and the column menu. This test adds:

- **Main window:** the browser window the test starts in.
- **Second window:** the second browser or private window.
- **Stop-sharing item:** the item in the Views menu, offered in place of **Share current view** while the view applied is shared, that stops sharing it.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### VIEW-01: A Personal View Is Kept to Its Maker

**Account:** Resource Planner, `resource.planner@fathom.test`, the first account of this test.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account in the main window. Select the **People** page in the left-hand menu.

- [ ] **Step 1.** Type `an` in the search box above the table.
  - **Expected:**
    - The table shows only the rows matching **an**.
    - A **Views** button shows above the table.
  - **Notes:**

- [ ] **Step 2.** Open the Views menu.
  - **Expected:** **Save view…** is offered.
  - **Notes:**

- [ ] **Step 3.** Select **Save view…**.
  - **Expected:** A dialog titled **Save view** shows:
    - **Name**.
    - Under **Includes**, the search.
    - No choice about sharing.
  - **Notes:**

- [ ] **Step 4.** Type `Fictional planner view` in **Name**.
  - **Expected:**
    - The name shows in **Name**.
    - No message is under it.
  - **Notes:**

- [ ] **Step 5.** Select **Save view** in the dialog.
  - **Expected:**
    - The dialog closes.
    - The Views menu's button says **Fictional planner view**.
  - **Notes:**

- [ ] **Step 6.** Open the Views menu.
  - **Expected:**
    - The heading **My views** is above **Fictional planner view**.
    - **Fictional planner view** has a check mark.
    - **Rename…** and **Delete view** are offered.
    - **Share current view** is not offered.
  - **Notes:**

- [ ] **Step 7.** In the second window, sign in as Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`, changed from this case's first account.
  - **Expected:** The top bar's right end reads **Second Engineering Operations Manager**.
  - **Notes:**

- [ ] **Step 8.** In the second window, select the **People** page in the left-hand menu.
  - **Expected:**
    - The People table shows.
    - No view is applied.
  - **Notes:**

- [ ] **Step 9.** In the second window, type `an` in the search box above the table.
  - **Expected:** A **Views** button shows above the table.
  - **Notes:**

- [ ] **Step 10.** In the second window, open the Views menu.
  - **Expected:** **Fictional planner view** is not listed.
  - **Notes:**

### VIEW-02: A Shared View Is Saved and Seen by Others

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from VIEW-01.

**Preconditions:** The second window is signed in as Second Workforce Administrator, as VIEW-01 leaves it. In the main window, sign out, sign in with this case's account, and select the **People** page in the left-hand menu.

- [ ] **Step 1.** In the main window, type `el` in the search box above the table.
  - **Expected:** The table shows only the rows matching **el**.
  - **Notes:**

- [ ] **Step 2.** Open the Views menu.
  - **Expected:** **Save view…** is offered.
  - **Notes:**

- [ ] **Step 3.** Select **Save view…**.
  - **Expected:**
    - The dialog shows a checkbox, **Share with everyone who sees this table**, below **Name**.
    - The checkbox is not ticked.
  - **Notes:**

- [ ] **Step 4.** Type `Fictional team view` in **Name**.
  - **Expected:**
    - The name shows in **Name**.
    - No message is under it.
  - **Notes:**

- [ ] **Step 5.** Tick **Share with everyone who sees this table**.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] **Step 6.** Select **Save view** in the dialog.
  - **Expected:**
    - The dialog closes.
    - The Views menu's button says **Fictional team view**.
  - **Notes:**

- [ ] **Step 7.** Open the Views menu.
  - **Expected:**
    - The heading **Shared views** is above **Fictional team view**.
    - The stop-sharing item is offered.
  - **Notes:**

- [ ] **Step 8.** In the second window, sign out, and sign in as Resource Planner, `resource.planner@fathom.test`, changed from this case's first account.
  - **Expected:** The top bar's right end reads **Resource Planner**.
  - **Notes:**

- [ ] **Step 9.** In the second window, select the **People** page in the left-hand menu.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] **Step 10.** In the second window, open the Views menu.
  - **Expected:**
    - **My views** lists **Fictional planner view**.
    - Below it, **Shared views** lists **Fictional team view**.
  - **Notes:**

- [ ] **Step 11.** In the second window, select **Fictional team view**.
  - **Expected:** The search box shows **el**.
  - **Notes:**

- [ ] **Step 12.** In the second window, open the Views menu.
  - **Expected:** None of these is offered:
    - **Rename…**.
    - **Delete view**.
    - The stop-sharing item.
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
  - **Expected:**
    - A dialog titled **Save view** shows.
    - **Share with everyone who sees this table** is not ticked.
  - **Notes:**

- [ ] **Step 4.** Type `Fictional passed round` in **Name**.
  - **Expected:**
    - The name shows in **Name**.
    - No message is under it.
  - **Notes:**

- [ ] **Step 5.** Select **Save view** in the dialog.
  - **Expected:**
    - The dialog closes.
    - The Views menu's button says **Fictional passed round**.
  - **Notes:**

- [ ] **Step 6.** Open the Views menu.
  - **Expected:**
    - **Fictional passed round** is under **My views**.
    - **Share current view** is offered.
  - **Notes:**

- [ ] **Step 7.** Select **Share current view**.
  - **Expected:** A notice shows at the top right:
    - It says **Shared the Fictional passed round view.**
    - It offers **Undo**.
  - **Notes:**

- [ ] **Step 8.** Open the Views menu.
  - **Expected:**
    - **Fictional passed round** is under **Shared views**.
    - The stop-sharing item is offered.
    - **Share current view** is not offered.
  - **Notes:**

- [ ] **Step 9.** In the second window, reload the page.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] **Step 10.** In the second window, open the Views menu.
  - **Expected:** **Fictional passed round** is under **Shared views**.
  - **Notes:**

- [ ] **Step 11.** In the main window, select the stop-sharing item from the Views menu.
  - **Expected:** A notice shows:
    - It names **Fictional passed round**.
    - It offers **Undo**.
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
  - **Expected:**
    - A dialog titled **Save view** shows.
    - **Share with everyone who sees this table** is not ticked.
  - **Notes:**

- [ ] **Step 4.** Type `Fictional team view` in **Name**.
  - **Expected:**
    - The name shows in **Name**.
    - No message is under it.
  - **Notes:**

- [ ] **Step 5.** Select **Save view** in the dialog.
  - **Expected:**
    - The dialog closes.
    - The Views menu's button says **Fictional team view**.
  - **Notes:**

- [ ] **Step 6.** Open the Views menu.
  - **Expected:**
    - **Fictional team view** is listed under **My views**.
    - It has a check mark.
    - **Fictional team view** is listed under **Shared views**.
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
  - **Expected:**
    - **My views** and **Shared views** read as headings, set apart from the names below them.
    - The names line up under each heading.
  - **Notes:**

- [ ] **Step 2.** Press Esc to close the menu.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] **Step 3.** Choose **Dark** in the Appearance menu.
  - **Expected:** Fathom turns dark.
  - **Notes:**

- [ ] **Step 4.** Open the Views menu.
  - **Expected:** The headings and names are easy to read.
  - **Notes:**

- [ ] **Step 5.** Select **Save view…**.
  - **Expected:** The dialog and its checkbox are easy to read.
  - **Notes:**

- [ ] **Step 6.** Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] **Step 7.** Choose **Light** in the Appearance menu.
  - **Expected:** The page is light.
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
  - **Expected:**
    - Focus moves through the views.
    - Focus skips the headings **My views** and **Shared views**.
  - **Notes:**

- [ ] **Step 5.** Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] **Step 6.** Open the Views menu and select **Save view…**.
  - **Expected:**
    - The dialog opens.
    - Focus is in **Name**.
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

### VIEW-07: A Column Moves for One Account Only

**Account:** Resource Planner, `resource.planner@fathom.test`, in the second window, changed from VIEW-06.

**Preconditions:** In the second window, this account is signed in on **People**, with no view applied. In the main window, Workforce Administrator, `engineering.operations.manager@fathom.test` is signed in on **People**, with no view applied.

- [ ] **Step 1.** In the second window, select **Position** in the People table's header.
  - **Expected:**
    - The Column menu opens.
    - It offers **Move left** and **Move right**.
  - **Notes:**

- [ ] **Step 2.** Select **Move right**.
  - **Expected:**
    - **Position** moves one place to the right
    - No dot before its name
    - No **Moved** box after its name
    - No **Publish** button is in the top bar
  - **Notes:**

- [ ] **Step 3.** Open the Views menu.
  - **Expected:**
    - **Columns moved** is listed.
    - An × is at its right.
  - **Notes:**

- [ ] **Step 4.** Press Esc to close the menu.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] **Step 5.** Reload the page.
  - **Expected:** **Position** is still in the place it moved to.
  - **Notes:**

- [ ] **Step 6.** In the main window, reload the page.
  - **Expected:** **Position** is in its original place.
  - **Notes:**

- [ ] **Step 7.** In the second window, open the Views menu and select **Columns moved**.
  - **Expected:** **Position** is back in its original place.
  - **Notes:**

### VIEW-08: A Moved Column Is Kept in a Saved View and Cleared

**Account:** Resource Planner, `resource.planner@fathom.test`, in the second window, the same as VIEW-07.

**Preconditions:** In the second window, this account is signed in on **People**, with **Position** in its original place.

- [ ] **Step 1.** Select **Position** in the People table's header, then **Move right** in the Column menu.
  - **Expected:** **Position** moves one place to the right.
  - **Notes:**

- [ ] **Step 2.** Open the Views menu.
  - **Expected:** **Save view…** is offered.
  - **Notes:**

- [ ] **Step 3.** Select **Save view…**.
  - **Expected:** Under **Includes**, the dialog shows **Column order** and **Moved**.
  - **Notes:**

- [ ] **Step 4.** Type `Fictional moved columns` in **Name**.
  - **Expected:**
    - The name shows in **Name**.
    - No message is under it.
  - **Notes:**

- [ ] **Step 5.** Select **Save view** in the dialog.
  - **Expected:**
    - The dialog closes.
    - The Views menu's button says **Fictional moved columns**.
  - **Notes:**

- [ ] **Step 6.** Select **Clear all** above the table.
  - **Expected:** **Position** is back in its original place.
  - **Notes:**

- [ ] **Step 7.** Open the Views menu and select **Fictional moved columns**.
  - **Expected:** **Position** moves one place to the right again.
  - **Notes:**

- [ ] **Step 8.** Open the Views menu and select **Clear view**.
  - **Expected:** **Position** is back in its original place.
  - **Notes:**

### VIEW-09: The Views Saved Are Removed

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from VIEW-08.

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

- [ ] **Step 10.** In the second window, open the Views menu and select **Fictional moved columns**.
  - **Expected:** The Views menu's button says **Fictional moved columns**.
  - **Notes:**

- [ ] **Step 11.** In the second window, open the Views menu and select **Delete view**.
  - **Expected:** **Fictional moved columns** is gone from the Views menu.
  - **Notes:**
