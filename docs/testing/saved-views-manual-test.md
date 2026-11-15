---
title: "Manual Test: Saved Views"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-15"
---

# Manual Test: Saved Views

## Scope

Verifies how personal and shared views look and work on the People page: the Views menu's two groups, saving a view as personal or shared, sharing a view and stopping sharing it, moving columns as part of a view, and a view on a column the role can no longer see, as seen from more than one account; hiding a column and showing it again; that a view on Releases shows only its streams in the timeline; that a view on Features is shared by its table and Board, and kept to Features; and that a view keeps People grouped by two levels.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A second browser, or a private window, for signing in as a second account while the first stays signed in.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Second Workforce Administrator:** `engineering.operations.manager.2@fathom.test`, shown in Fathom as "Second Engineering Operations Manager"
- **Feature Lead:** `feature.lead@fathom.test`
- **Engineering Director:** `engineering.director@fathom.test`
- **Product Manager:** `product.manager@fathom.test`

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

### VIEW-03: A View Is Shared and Then Stops Being Shared

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as VIEW-02.

**Preconditions:** In the main window, this account is signed in on **People**. In the second window, Feature Lead, `feature.lead@fathom.test` is signed in on **People**, as VIEW-02 leaves it.

- [ ] `CEDD` In the main window, replace the text in the search box above the table with `ar`.
  - **Expected:** The table shows only the rows matching `ar`.
  - **Notes:**

- [ ] `E7E3` Open the Views menu.
  - **Expected:**
    - **Save as new view…** is offered.
    - **Update Fictional team view** is offered.
  - **Notes:**

- [ ] `3AB9` Select **Save as new view…**.
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
  - **Expected:** **Save as new view…** is offered.
  - **Notes:**

- [ ] `DC7D` Select **Save as new view…**.
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

- [ ] `2DAC` Open the Views menu and select **Save as new view…**.
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

### VIEW-10: A View on Releases Shows Its Streams in the Timeline Too

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as VIEW-09.

**Preconditions:** In the main window, this account is signed in. Select the **Releases** page in the left-hand menu.

- [ ] `289E` Type `Patches` in the search box above the table.
  - **Expected:**
    - The table lists only 'Patches'.
    - The timeline above the table shows only the 'Patches' row.
    - A **Views** button shows above the table.
  - **Notes:**

- [ ] `30E8` Open the Views menu, and select **Save view…**.
  - **Expected:**
    - A dialog titled "Save view" shows **Name**.
    - Under **Includes**, **Search** reads “Patches”.
  - **Notes:**

- [ ] `9EB8` Type `Fictional patches` in **Name**.
  - **Expected:** The name shows in **Name**.
  - **Notes:**

- [ ] `E207` Select **Save view** in the dialog.
  - **Expected:** The Views menu's button says `Fictional patches`.
  - **Notes:**

- [ ] `F2CE` Open the Views menu, and select **Clear view**.
  - **Expected:**
    - The table lists 'Platform' and 'Patches'.
    - The timeline shows a row for 'Platform' and a row for 'Patches'.
  - **Notes:**

- [ ] `AA19` Open the Views menu, and select `Fictional patches` under **My views**.
  - **Expected:**
    - The table lists only 'Patches'.
    - The timeline shows only the 'Patches' row.
  - **Notes:**

- [ ] `724E` Open the Views menu, and select **Delete view**.
  - **Expected:** `Fictional patches` is gone from the Views menu.
  - **Notes:**

### VIEW-11: A View on a Column the Role Can No Longer See Is Dimmed

**Account:** Feature Lead, `feature.lead@fathom.test`, in the second window, changed from VIEW-10.

**Preconditions:** In the second window, this account is signed in on **People**, with no view applied. In the main window, Workforce Administrator, `engineering.operations.manager@fathom.test` is signed in.

- [ ] `736D` In the second window, filter the **Site** column to 'Northmere Labs' from its column menu.
  - **Expected:** Only people at 'Northmere Labs' show.
  - **Notes:**

- [ ] `67F2` Open the Views menu, and select **Save view…**.
  - **Expected:** A dialog titled "Save view" shows **Name**.
  - **Notes:**

- [ ] `9E64` Type `Fictional by site` in **Name**.
  - **Expected:** The name shows in **Name**.
  - **Notes:**

- [ ] `C2D4` Select **Save view** in the dialog.
  - **Expected:** The Views menu's button says `Fictional by site`.
  - **Notes:**

- [ ] `D781` In the main window, select the **Data classes** page in the left-hand menu.
  - **Expected:** The **Lists** section, last on the page, below **Columns**, lists 'Sites'.
  - **Notes:**

- [ ] `C247` In the **Lists** section, select **Change class…** on the row of 'Sites'.
  - **Expected:**
    - A dialog titled "Change the class of Sites" opens.
    - **General** is chosen.
  - **Notes:**

- [ ] `5607` Select **Personal**.
  - **Expected:** **Personal** is chosen.
  - **Notes:**

- [ ] `4ABF` Select **Change**.
  - **Expected:** The class of 'Sites' is an eye with a line through it, then **Personal**.
  - **Notes:**

- [ ] `589F` In the second window, select the **People** page in the left-hand menu.
  - **Expected:**
    - The table has no **Site** column.
    - A **Views** button shows above the table.
  - **Notes:**

- [ ] `64E5` In the second window, open the Views menu.
  - **Expected:**
    - **My views** lists `Fictional by site`, dimmed.
    - Under its name, a line reads "Uses Site, which this role can't see."
  - **Notes:**

- [ ] `7A0C` Select `Fictional by site`.
  - **Expected:**
    - The view isn't applied: the Views menu's button still says **Views**.
    - A menu beside it offers **Rename…** and **Delete…**, and nothing else.
  - **Notes:**

- [ ] `03A4` Select **Rename…**.
  - **Expected:**
    - A dialog titled "Rename view" opens.
    - **Name** holds `Fictional by site`.
  - **Notes:**

- [ ] `526D` Clear **Name** and type `Fictional by place`.
  - **Expected:** **Name** holds `Fictional by place`.
  - **Notes:**

- [ ] `F7B6` Select **Rename**.
  - **Expected:**
    - The dialog closes.
    - No notification shows.
  - **Notes:**

- [ ] `8DDC` Open the Views menu.
  - **Expected:** **My views** lists `Fictional by place`, dimmed, with the line "Uses Site, which this role can't see." under it.
  - **Notes:**

- [ ] `CD3D` Select `Fictional by place`, then **Delete…**.
  - **Expected:**
    - A dialog titled "Delete the Fictional by place view?" opens.
    - It reads "This can't be undone."
  - **Notes:**

- [ ] `732D` Select **Delete**.
  - **Expected:**
    - The dialog closes.
    - A notification reads "Deleted the Fictional by place view." with no **Undo**.
    - No **Views** button shows above the table.
  - **Notes:**

**Afterwards:** In the main window, on the **Data classes** page, in the **Lists** section, select **Change class…** on the row of 'Sites', select **General**, and select **Change**. The class of 'Sites' is an open eye, then **General**.

### VIEW-12: A Column Is Hidden and Shown Again

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, in the main window, changed from VIEW-11.

**Preconditions:** In the main window, this account is signed in on **People**, with no view applied.

- [ ] `D6A1` Select **Name** in the People table's header.
  - **Expected:**
    - The column menu opens.
    - It offers no **Hide column**.
  - **Notes:**

- [ ] `7B72` Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `98E2` Select **Site** in the People table's header.
  - **Expected:**
    - The column menu opens.
    - **Hide column** is listed after **Narrower**.
  - **Notes:**

- [ ] `FA93` Press the Down arrow key until **Hide column** is highlighted.
  - **Expected:** **Hide column** is highlighted.
  - **Notes:**

- [ ] `8FB0` Press Enter.
  - **Expected:**
    - The menu closes.
    - The table has no **Site** column.
    - The heading of the column that was right of **Site** has a focus ring.
    - No notification shows.
  - **Notes:**

- [ ] `0442` Select **Position** in the People table's header.
  - **Expected:** The column menu opens.
  - **Notes:**

- [ ] `A7CE` Select **Hide column**.
  - **Expected:** The table has no **Position** column.
  - **Notes:**

- [ ] `AFC7` Open the Views menu.
  - **Expected:**
    - Under the heading **Hidden**, the menu lists **Show all columns**, **Position** and **Site**, in that order.
    - The **Hidden** heading and its items are set apart from the items around them.
  - **Notes:**

- [ ] `548D` Select **Save view…**.
  - **Expected:** Under **Includes**, **Hidden** reads "Position, Site".
  - **Notes:**

- [ ] `1CE7` Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] `BFE1` Select the search box.
  - **Expected:** The search box has focus.
  - **Notes:**

- [ ] `BCD3` Press Tab until the Views menu's button has focus.
  - **Expected:** The button has a focus ring.
  - **Notes:**

- [ ] `4A8B` Press Enter.
  - **Expected:** The Views menu opens.
  - **Notes:**

- [ ] `0859` Press the Down arrow key until **Site** is highlighted.
  - **Expected:** **Site** is highlighted.
  - **Notes:**

- [ ] `F9D2` Press Enter.
  - **Expected:**
    - The menu closes.
    - **Site** is back in the place it had before.
    - The table still has no **Position** column.
  - **Notes:**

- [ ] `8787` Press Enter.
  - **Expected:**
    - The Views menu opens.
    - Under **Hidden**, it lists **Position** alone, with no **Show all columns**.
  - **Notes:**

- [ ] `B04F` Press the Down arrow key until **Position** is highlighted.
  - **Expected:** **Position** is highlighted.
  - **Notes:**

- [ ] `180A` Press Enter.
  - **Expected:** **Position** is back in the place it had before.
  - **Notes:**

- [ ] `49AA` Open the Views menu.
  - **Expected:** The menu has no **Hidden** heading.
  - **Notes:**

### VIEW-13: A View on Features Is Shared by Its Table and Board

**Account:** Engineering Director, `engineering.director@fathom.test`, in the main window, changed from VIEW-12.

**Preconditions:** In the main window, this account is signed in on **Features**, showing the table, with no view applied. In the second window, Product Manager, `product.manager@fathom.test` is signed in on **Features**, showing the table, with no view applied.

- [ ] `CBA2` In the main window, type `offline` in the search box.
  - **Expected:** The table lists 'Offline Sync' alone.
  - **Notes:**

- [ ] `4C59` Select **Board** in the switch after the **Features** heading.
  - **Expected:**
    - The board shows, with the button **Stream: Platform**.
    - The board holds the card 'Offline Sync' alone.
  - **Notes:**

- [ ] `BCED` Select **Card**, then **Risk**.
  - **Expected:** The cards no longer show **Risk**.
  - **Notes:**

- [ ] `CE29` Press Esc.
  - **Expected:** The Card menu closes.
  - **Notes:**

- [ ] `7291` Open the Views menu, and select **Save view…**.
  - **Expected:**
    - A dialog titled "Save view" opens.
    - Under **Includes**, **Search** reads “offline”.
    - Under **Includes**, **Board** reads "Card Status, Priority, Size, Needed by, Staffed months".
  - **Notes:**

- [ ] `7293` Type `Fictional roadmap` in **Name**.
  - **Expected:** The name shows in **Name**.
  - **Notes:**

- [ ] `CFB2` Tick **Share with everyone who sees this table**.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `FFDF` Select **Save view** in the dialog.
  - **Expected:** The Views menu's button says `Fictional roadmap`.
  - **Notes:**

- [ ] `D1B9` Select **Table** in the switch after the **Features** heading.
  - **Expected:**
    - The table lists 'Offline Sync' alone.
    - The Views menu's button says `Fictional roadmap`, with no dot.
  - **Notes:**

- [ ] `11C8` In the second window, reload the page.
  - **Expected:**
    - The table shows.
    - The Views menu's button reads **Views**, with no dot.
  - **Notes:**

- [ ] `8296` Open the Views menu.
  - **Expected:** **Shared views** lists `Fictional roadmap`.
  - **Notes:**

- [ ] `FD34` Select `Fictional roadmap`.
  - **Expected:**
    - The table still shows, listing 'Offline Sync' alone.
    - The Views menu's button says `Fictional roadmap`, with no dot.
  - **Notes:**

- [ ] `7D74` Select **Board** in the switch after the **Features** heading.
  - **Expected:**
    - The board holds the card 'Offline Sync' alone, without **Risk**.
    - The Views menu's button still says `Fictional roadmap`, with no dot.
  - **Notes:**

- [ ] `B1FA` Select the **Projects** page in the left-hand menu.
  - **Expected:**
    - The **Projects** tab is chosen.
    - No Views menu shows above the table.
  - **Notes:**

- [ ] `AC9D` In the main window, open the Views menu and select **Delete view**.
  - **Expected:** A notification reads "Deleted the Fictional roadmap view.", with **Undo**.
  - **Notes:**

- [ ] `4A6B` In the second window, select the **Features** page in the left-hand menu.
  - **Expected:** The table shows, with no view applied.
  - **Notes:**

- [ ] `036B` Reload the page.
  - **Expected:** No Views menu shows above the table.
  - **Notes:**

### VIEW-14: A View Keeps People Grouped by Manager, Then Site

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, in the main window, changed from VIEW-13.

**Preconditions:** This account is signed in on **People**, with no view applied.

- [ ] `5E1A` Select **Group by**, then **Manager**.
  - **Expected:**
    - The button reads **Group by: Manager**.
  - **Notes:**

- [ ] `A7C3` Select **Group by: Manager**.
  - **Expected:**
    - The menu lists **Manager**, ticked, and the other groupings under a **Group by** label.
    - After them, under a **Then by** label, it lists **None**, ticked, then the same groupings less **Manager**.
  - **Notes:**

- [ ] `B5E8` Select **Site** under **Then by**.
  - **Expected:**
    - The button reads **Group by: Manager, then Site**.
    - Under the first manager's heading, a smaller, lighter heading set in from it names a site, with how many people it holds.
    - Each site heading under that manager is followed by people at that site only.
    - The counts on the site headings under that manager add up to the count on the manager's heading.
  - **Notes:**

- [ ] `7A1F` Select **Group by: Manager, then Site**.
  - **Expected:** The menu ends with **Clear grouping**, set apart from the choices.
  - **Notes:**

- [ ] `2C6D` Press Esc.
  - **Expected:** The menu closes, and the button still reads **Group by: Manager, then Site**.
  - **Notes:**

- [ ] `3D90` Open the Views menu, and select **Save view…**.
  - **Expected:**
    - A dialog titled "Save view" opens.
    - Under **Includes**, **Group by** reads "Manager, then Site".
  - **Notes:**

- [ ] `C24B` Type `Fictional managers by site` in **Name**.
  - **Expected:** The name shows in **Name**.
  - **Notes:**

- [ ] `0D7E` Select **Save view** in the dialog.
  - **Expected:** The Views menu's button says `Fictional managers by site`.
  - **Notes:**

- [ ] `91E6` Select the **People** page in the left-hand menu.
  - **Expected:**
    - The rows show as one list.
    - The button reads **Group by**, naming no grouping.
  - **Notes:**

- [ ] `F05D` Open the Views menu, and select `Fictional managers by site`.
  - **Expected:**
    - The button reads **Group by: Manager, then Site**.
    - Under each manager's heading, smaller, lighter headings set in from it name sites, each with how many people it holds.
  - **Notes:**

- [ ] `6B28` Open the Views menu, and select **Delete view**.
  - **Expected:** A notification reads "Deleted the Fictional managers by site view.", with **Undo**.
  - **Notes:**

- [ ] `D83B` Select **Group by: Manager, then Site**, then **Clear grouping**.
  - **Expected:**
    - The button reads **Group by**.
    - The rows show as one list.
  - **Notes:**
