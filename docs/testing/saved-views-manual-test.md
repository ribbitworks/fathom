---
title: "Manual Test: Saved Views"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-14"
---

# Manual Test: Saved Views

## Scope

Verifies how personal and shared views look and work on the People page: the Views menu's two groups, saving a view as personal or shared, sharing a view and taking it back, and moving columns as part of a view, as seen from more than one account.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A second browser, or a private window, for signing in as a second account while the first stays signed in.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Second Workforce Administrator:** `engineering.operations.manager.2@fathom.test`, shown in Fathom as "Second Engineering Operations Manager"
- **Feature Lead:** `feature.lead@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the column menu. This test adds:

- **Main window:** the browser window the test starts in.
- **Second window:** the second browser or private window.
- **Stop-sharing item:** the item in the Views menu, offered in place of **Share current view** while the view applied is shared, that stops sharing it.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### VIEW-01: A Personal View Is Kept to Its Maker

**Account:** Feature Lead, `feature.lead@fathom.test`, the first account of this test.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account in the main window. Select the **People** page in the left-hand menu.

- [ ] `751F` Type `Patel-Singh` in the search box above the table.
  - **Expected:**
    - Only the row of 'Tanushree Patel-Singh' shows.
    - A **Views** button shows above the table.
  - **Notes:**

- [ ] `6ACB` Open the Views menu.
  - **Expected:** **Save view…** is offered.
  - **Notes:**

- [ ] `A68D` Select **Save view…**.
  - **Expected:** A dialog titled "Save view" shows:
    - **Name**.
    - Under **Includes**, the search.
    - No choice about sharing.
  - **Notes:**

- [ ] `4DD1` In the open dialog, type `Fictional planner view` in **Name**.
  - **Expected:**
    - The name shows in **Name**.
    - No message is under it.
  - **Notes:**

- [ ] `D243` Select **Save view** in the dialog.
  - **Expected:**
    - The dialog closes.
    - The Views menu's button says `Fictional planner view`.
  - **Notes:**

- [ ] `1D08` Open the Views menu.
  - **Expected:**
    - The heading **My views** is above `Fictional planner view`.
    - `Fictional planner view` has a check mark.
    - **Rename…** and **Delete view** are offered.
    - **Share current view** is not offered.
  - **Notes:**

- [ ] `0AEE` In the second window, sign in as Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`, changed from this case's first account.
  - **Expected:** The top bar's right end reads "Second Engineering Operations Manager".
  - **Notes:**

- [ ] `6F55` In the second window, select the **People** page in the left-hand menu.
  - **Expected:**
    - The People table shows.
    - No view is applied.
  - **Notes:**

- [ ] `86F9` In the second window, type `Patel-Singh` in the search box above the table.
  - **Expected:** A **Views** button shows above the table.
  - **Notes:**

- [ ] `F318` In the second window, open the Views menu.
  - **Expected:** `Fictional planner view` is not listed.
  - **Notes:**

### VIEW-02: A Shared View Is Saved and Seen by Others

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from VIEW-01.

**Preconditions:** The second window is signed in as Second Workforce Administrator, as VIEW-01 leaves it. In the main window, sign out, sign in with this case's account, and select the **People** page in the left-hand menu.

- [ ] `752E` In the main window, type `el` in the search box above the table.
  - **Expected:** The table shows only the rows matching `el`.
  - **Notes:**

- [ ] `5C51` Open the Views menu.
  - **Expected:** **Save view…** is offered.
  - **Notes:**

- [ ] `B284` Select **Save view…**.
  - **Expected:**
    - The dialog shows a checkbox, **Share with everyone who sees this table**, below **Name**.
    - The checkbox is not ticked.
  - **Notes:**

- [ ] `93C1` Type `Fictional team view` in **Name**.
  - **Expected:**
    - The name shows in **Name**.
    - No message is under it.
  - **Notes:**

- [ ] `5E73` Tick **Share with everyone who sees this table**.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `DAD1` Select **Save view** in the dialog.
  - **Expected:**
    - The dialog closes.
    - The Views menu's button says `Fictional team view`.
  - **Notes:**

- [ ] `C808` Open the Views menu.
  - **Expected:**
    - The heading **Shared views** is above `Fictional team view`.
    - The stop-sharing item is offered.
  - **Notes:**

- [ ] `AA2A` In the second window, sign out, and sign in as Feature Lead, `feature.lead@fathom.test`, changed from this case's first account.
  - **Expected:** The top bar's right end reads "Feature Lead".
  - **Notes:**

- [ ] `3ECC` In the second window, select the **People** page in the left-hand menu.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] `E787` In the second window, open the Views menu.
  - **Expected:**
    - **My views** lists `Fictional planner view`.
    - Below it, **Shared views** lists `Fictional team view`.
  - **Notes:**

- [ ] `9FDA` In the second window, select `Fictional team view`.
  - **Expected:** The search box shows `el`.
  - **Notes:**

- [ ] `1AF5` In the second window, open the Views menu.
  - **Expected:** None of these is offered:
    - **Rename…**.
    - **Delete view**.
    - The stop-sharing item.
  - **Notes:**

### VIEW-03: A View Is Shared and Taken Back

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as VIEW-02.

**Preconditions:** In the main window, this account is signed in on **People**. In the second window, Feature Lead, `feature.lead@fathom.test` is signed in on **People**, as VIEW-02 leaves it.

- [ ] `CEDD` In the main window, replace the text in the search box above the table with `ar`.
  - **Expected:** The table shows only the rows matching `ar`.
  - **Notes:**

- [ ] `E7E3` Open the Views menu.
  - **Expected:** **Save view…** is offered.
  - **Notes:**

- [ ] `3AB9` Select **Save view…**.
  - **Expected:**
    - A dialog titled "Save view" shows.
    - **Share with everyone who sees this table** is not ticked.
  - **Notes:**

- [ ] `FBAE` Type `Fictional passed round` in **Name**.
  - **Expected:**
    - The name shows in **Name**.
    - No message is under it.
  - **Notes:**

- [ ] `72CD` Select **Save view** in the dialog.
  - **Expected:**
    - The dialog closes.
    - The Views menu's button says `Fictional passed round`.
  - **Notes:**

- [ ] `AE09` Open the Views menu.
  - **Expected:**
    - `Fictional passed round` is under **My views**.
    - **Share current view** is offered.
  - **Notes:**

- [ ] `019D` Select **Share current view**.
  - **Expected:** A notice shows at the top right:
    - It says "Shared the Fictional passed round view."
    - It offers **Undo**.
  - **Notes:**

- [ ] `9A64` Open the Views menu.
  - **Expected:**
    - `Fictional passed round` is under **Shared views**.
    - The stop-sharing item is offered.
    - **Share current view** is not offered.
  - **Notes:**

- [ ] `EFA4` In the second window, reload the page.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] `910D` In the second window, open the Views menu.
  - **Expected:** `Fictional passed round` is under **Shared views**.
  - **Notes:**

- [ ] `13B2` In the main window, select the stop-sharing item from the Views menu.
  - **Expected:** A notice shows:
    - It names `Fictional passed round`.
    - It offers **Undo**.
  - **Notes:**

- [ ] `CF63` In the main window, open the Views menu.
  - **Expected:** `Fictional passed round` is under **My views** again.
  - **Notes:**

- [ ] `7A01` In the second window, reload the page.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] `4E5A` In the second window, open the Views menu.
  - **Expected:** `Fictional passed round` is not listed.
  - **Notes:**

### VIEW-04: Sharing a View Whose Name Is Taken Says So

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as VIEW-03.

**Preconditions:** In the main window, this account is signed in on **People**, with `Fictional team view` saved as VIEW-02 leaves it.

- [ ] `7FD6` Replace the text in the search box above the table with `ma`.
  - **Expected:** The table shows only the rows matching `ma`.
  - **Notes:**

- [ ] `3F47` Open the Views menu.
  - **Expected:** **Save view…** is offered.
  - **Notes:**

- [ ] `DC7D` Select **Save view…**.
  - **Expected:**
    - A dialog titled "Save view" shows.
    - **Share with everyone who sees this table** is not ticked.
  - **Notes:**

- [ ] `368C` Type `Fictional team view` in **Name**.
  - **Expected:**
    - The name shows in **Name**.
    - No message is under it.
  - **Notes:**

- [ ] `237C` Select **Save view** in the dialog.
  - **Expected:**
    - The dialog closes.
    - The Views menu's button says `Fictional team view`.
  - **Notes:**

- [ ] `9A6D` Open the Views menu.
  - **Expected:**
    - `Fictional team view` is listed under **My views**.
    - It has a check mark.
    - `Fictional team view` is listed under **Shared views**.
  - **Notes:**

- [ ] `CCA5` Select **Share current view**.
  - **Expected:** A notice says "There is already a shared view named Fictional team view".
  - **Notes:**

- [ ] `F098` Open the Views menu.
  - **Expected:** The view with the check mark is still under **My views**.
  - **Notes:**

### VIEW-05: The Menu and Dialog Read Well

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as VIEW-04.

**Preconditions:** In the main window, this account is signed in on **People**, with views saved as the earlier cases leave them.

- [ ] `6F7C` Open the Views menu.
  - **Expected:**
    - **My views** and **Shared views** read as headings, set apart from the names below them.
    - The names line up under each heading.
  - **Notes:**

- [ ] `7B89` Press Esc to close the menu.
  - **Expected:** The menu closes.
  - **Notes:**

### VIEW-06: The Menu and Dialog Work by Keyboard

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as VIEW-05.

**Preconditions:** In the main window, this account is signed in on **People**, with views saved as the earlier cases leave them.

- [ ] `6EFD` Select the search box.
  - **Expected:** The search box has focus.
  - **Notes:**

- [ ] `C0E6` Press Tab until the Views menu's button has focus.
  - **Expected:** The button has a focus ring.
  - **Notes:**

- [ ] `5D62` Press Enter.
  - **Expected:** The Views menu opens.
  - **Notes:**

- [ ] `15CC` Press the Down arrow key several times.
  - **Expected:**
    - Focus moves through the views.
    - Focus skips the headings **My views** and **Shared views**.
  - **Notes:**

- [ ] `6FC0` Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `2DAC` Open the Views menu and select **Save view…**.
  - **Expected:**
    - The dialog opens.
    - Focus is in **Name**.
  - **Notes:**

- [ ] `F9C3` Press Tab.
  - **Expected:** Focus moves to **Share with everyone who sees this table**.
  - **Notes:**

- [ ] `AB89` Press Space.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `3B05` Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

### VIEW-07: A Column Moves for One Account Only

**Account:** Feature Lead, `feature.lead@fathom.test`, in the second window, changed from VIEW-06.

**Preconditions:** In the second window, this account is signed in on **People**, with no view applied. In the main window, Workforce Administrator, `engineering.operations.manager@fathom.test` is signed in on **People**, with no view applied.

- [ ] `D150` In the second window, select **Position** in the People table's header.
  - **Expected:**
    - The Column menu opens.
    - It offers **Move left** and **Move right**.
  - **Notes:**

- [ ] `F33A` Select **Move right**.
  - **Expected:**
    - **Position** moves one place to the right
    - No dot before its name
    - No **Moved** box after its name
    - No **Publish** button is in the top bar
  - **Notes:**

- [ ] `E749` Open the Views menu.
  - **Expected:**
    - **Columns moved** is listed.
    - An × is at its right.
  - **Notes:**

- [ ] `C014` Press Esc to close the menu.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `1E05` Reload the page.
  - **Expected:** **Position** is still in the place it moved to.
  - **Notes:**

- [ ] `9E8C` In the main window, reload the page.
  - **Expected:** **Position** is in its original place.
  - **Notes:**

- [ ] `D407` In the second window, open the Views menu and select **Columns moved**.
  - **Expected:** **Position** is back in its original place.
  - **Notes:**

### VIEW-08: A Moved Column Is Kept in a Saved View and Cleared

**Account:** Feature Lead, `feature.lead@fathom.test`, in the second window, the same as VIEW-07.

**Preconditions:** In the second window, this account is signed in on **People**, with **Position** in its original place.

- [ ] `1B62` Select **Position** in the People table's header, then **Move right** in the Column menu.
  - **Expected:** **Position** moves one place to the right.
  - **Notes:**

- [ ] `074D` Open the Views menu.
  - **Expected:** **Save view…** is offered.
  - **Notes:**

- [ ] `92C0` Select **Save view…**.
  - **Expected:** Under **Includes**, the dialog shows **Column order** and **Moved**.
  - **Notes:**

- [ ] `7D5A` Type `Fictional moved columns` in **Name**.
  - **Expected:**
    - The name shows in **Name**.
    - No message is under it.
  - **Notes:**

- [ ] `D207` Select **Save view** in the dialog.
  - **Expected:**
    - The dialog closes.
    - The Views menu's button says `Fictional moved columns`.
  - **Notes:**

- [ ] `E128` Select **Clear all** above the table.
  - **Expected:** **Position** is back in its original place.
  - **Notes:**

- [ ] `58C2` Open the Views menu and select `Fictional moved columns`.
  - **Expected:** **Position** moves one place to the right again.
  - **Notes:**

- [ ] `A032` Open the Views menu and select **Clear view**.
  - **Expected:** **Position** is back in its original place.
  - **Notes:**

### VIEW-09: The Views Saved Are Removed

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from VIEW-08.

**Preconditions:** In the main window, this account is signed in on **People**. In the second window, Feature Lead, `feature.lead@fathom.test` is signed in on **People**.

- [ ] `258A` In the main window, open the Views menu and select `Fictional passed round`.
  - **Expected:** The Views menu's button says `Fictional passed round`.
  - **Notes:**

- [ ] `DABB` Open the Views menu and select **Delete view**.
  - **Expected:** `Fictional passed round` is gone from the Views menu.
  - **Notes:**

- [ ] `F51B` Open the Views menu and select `Fictional team view` under **My views**.
  - **Expected:** The Views menu's button says `Fictional team view`.
  - **Notes:**

- [ ] `BD8F` Open the Views menu and select **Delete view**.
  - **Expected:** `Fictional team view` is listed only under **Shared views**.
  - **Notes:**

- [ ] `71DC` Open the Views menu and select `Fictional team view` under **Shared views**.
  - **Expected:** The Views menu's button says `Fictional team view`.
  - **Notes:**

- [ ] `0F34` Open the Views menu and select **Delete view**.
  - **Expected:** `Fictional team view` is gone from the Views menu.
  - **Notes:**

- [ ] `C435` In the second window, reload the page.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] `52B0` In the second window, open the Views menu and select `Fictional planner view`.
  - **Expected:** The Views menu's button says `Fictional planner view`.
  - **Notes:**

- [ ] `56CA` In the second window, open the Views menu and select **Delete view**.
  - **Expected:** `Fictional planner view` is gone from the Views menu.
  - **Notes:**

- [ ] `FC1D` In the second window, open the Views menu and select `Fictional moved columns`.
  - **Expected:** The Views menu's button says `Fictional moved columns`.
  - **Notes:**

- [ ] `B00D` In the second window, open the Views menu and select **Delete view**.
  - **Expected:** `Fictional moved columns` is gone from the Views menu.
  - **Notes:**
