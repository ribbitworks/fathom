---
title: "Manual Test: Saved Views"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-27"
---

# Manual Test: Saved Views

## Scope

Verifies how personal and shared views look and work, as seen from more than one account:

- On People: the Views menu's two groups, saving a view as personal or shared, sharing a view and stopping sharing it, the menu and dialog by keyboard, moving a column for one account, deleting views, and hiding a column and showing it again.
- That a view on Features is shared by its table and Board.
- That a view on the Org chart keeps the team shown alone and the levels shown.

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

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data). Restore the Seed Data keeps saved views, so the test cases delete the views they save.

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the Views menu and the column menu. This test adds:

- **Main window:** the browser window the test starts in.
- **Second window:** the second browser or private window.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### VIEW-01: A Personal View Is Kept to Its Maker

**Account:** Feature Lead, `feature.lead@fathom.test`, the first account of this test.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account in the main window. Select the **People** page in the left-hand menu.

- [ ] `751F` Search for `Patel-Singh`.
  - **Expected:**
    - Only the row of 'Tanushree Patel-Singh' shows.
    - The Views menu's button reads **Views**, with a dot.
  - **Notes:**

- [ ] `A68D` Open the Views menu and select **Save view…**.
  - **Expected:** A dialog titled "Save view" shows:
    - **Name**.
    - Under **Includes**, **Search** reading “Patel-Singh”.
    - No choice about sharing.
  - **Notes:**

- [ ] `4DD1` Type `Fictional planner view` in **Name**.
  - **Expected:** The name shows in **Name**, with no message under it.
  - **Notes:**

- [ ] `D243` Select **Save view** in the dialog.
  - **Expected:**
    - The dialog closes.
    - The Views menu's button reads `Fictional planner view`.
  - **Notes:**

- [ ] `0AEE` In the second window, sign in as Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`.
  - **Expected:** The top bar's right end reads "Second Engineering Operations Manager".
  - **Notes:**

- [ ] `6F55` In the second window, select the **People** page in the left-hand menu.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] `F318` In the second window, open the Views menu.
  - **Expected:** `Fictional planner view` is not listed.
  - **Notes:**

- [ ] `56CA` In the main window, open the Views menu and select **Delete view**.
  - **Expected:**
    - A notification reads "Deleted the Fictional planner view.", with **Undo**.
    - The Views menu's button reads **Views**, with a dot.
  - **Notes:**

### VIEW-02: A Shared View Is Saved and Seen by Others

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from VIEW-01.

**Preconditions:** The second window is signed in as Second Workforce Administrator, as VIEW-01 leaves it. In the main window, sign out, sign in with this case's account, and select the **People** page in the left-hand menu.

- [ ] `752E` In the main window, search for `el`.
  - **Expected:** The table shows only the rows matching `el`.
  - **Notes:**

- [ ] `B284` Open the Views menu and select **Save view…**.
  - **Expected:**
    - The dialog shows a checkbox, **Share with everyone who sees this page**, below **Name**.
    - The checkbox is not ticked.
  - **Notes:**

- [ ] `93C1` Type `Fictional team view` in **Name**.
  - **Expected:** The name shows in **Name**, with no message under it.
  - **Notes:**

- [ ] `5E73` Tick **Share with everyone who sees this page**.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `DAD1` Select **Save view** in the dialog.
  - **Expected:**
    - The dialog closes.
    - The Views menu's button reads `Fictional team view`.
  - **Notes:**

- [ ] `AA2A` In the second window, sign out, and sign in as Feature Lead, `feature.lead@fathom.test`, changed from Second Workforce Administrator.
  - **Expected:** The top bar's right end reads "Feature Lead".
  - **Notes:**

- [ ] `3ECC` In the second window, select the **People** page in the left-hand menu.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] `E787` In the second window, open the Views menu.
  - **Expected:**
    - **Shared views** lists `Fictional team view`.
    - **Shared views** reads as a heading, set apart from the name below it.
  - **Notes:**

### VIEW-03: A View Is Shared and Then Stops Being Shared

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as VIEW-02.

**Preconditions:** In the main window, this account is signed in on **People**, with `Fictional team view` applied. In the second window, Feature Lead, `feature.lead@fathom.test` is signed in on **People**, as VIEW-02 leaves it.

- [ ] `3AB9` In the main window, open the Views menu and select **Save as new view…**.
  - **Expected:**
    - A dialog titled "Save view" shows.
    - **Share with everyone who sees this page** is not ticked.
  - **Notes:**

- [ ] `FBAE` Type `Fictional passed round` in **Name** and press Enter.
  - **Expected:**
    - The dialog closes.
    - The Views menu's button reads `Fictional passed round`.
  - **Notes:**

- [ ] `019D` Open the Views menu and select **Share current view**.
  - **Expected:** A notification shows at the top right:
    - It reads "Shared the Fictional passed round view."
    - It offers **Undo**.
  - **Notes:**

- [ ] `EFA4` In the second window, reload the page.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] `910D` In the second window, open the Views menu.
  - **Expected:** `Fictional passed round` is under **Shared views**.
  - **Notes:**

- [ ] `13B2` In the main window, open the Views menu and select **Stop sharing current view**.
  - **Expected:** A notification shows:
    - It reads "Stopped sharing the Fictional passed round view."
    - It offers **Undo**.
  - **Notes:**

- [ ] `CF63` In the main window, open the Views menu.
  - **Expected:** `Fictional passed round` is under **My views** again.
  - **Notes:**

### VIEW-04: Sharing a View Whose Name Is Taken Says So

Proved by automated tests in `apps/web/src/people-page-saved-views.test.tsx`.

### VIEW-05: The Menu and Dialog Read Well

Covered by [VIEW-01](#view-01-a-personal-view-is-kept-to-its-maker) and [VIEW-02](#view-02-a-shared-view-is-saved-and-seen-by-others).

### VIEW-06: The Menu and Dialog Work by Keyboard

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as VIEW-03.

**Preconditions:** In the main window, this account is signed in on **People**, with `Fictional passed round` applied, as VIEW-03 leaves it. Press Esc if the Views menu is open.

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
  - **Expected:** Focus moves to **Share with everyone who sees this page**.
  - **Notes:**

- [ ] `3B05` Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

**Afterwards:** In the main window, open the Views menu and select **Clear view**.

### VIEW-07: A Column Moves for One Account Only

**Account:** Feature Lead, `feature.lead@fathom.test`, in the second window, changed from VIEW-06.

**Preconditions:** In the second window, this account is signed in on **People**, with no view applied. In the main window, Workforce Administrator, `engineering.operations.manager@fathom.test` is signed in on **People**, with no view applied.

- [ ] `F33A` In the second window, select **Position** in the People table's header, then **Move right** in the column menu.
  - **Expected:**
    - **Position** moves one place to the right.
    - No dot is before its name, and no **Moved** box after it.
    - No Publish button is in the top bar.
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

Proved by automated tests in `apps/web/src/people-page-saved-views.test.tsx`.

### VIEW-09: The Views Saved Are Removed

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, in the main window, changed from VIEW-07.

**Preconditions:** In the main window, this account is signed in on **People**, with no view applied.

- [ ] `258A` Open the Views menu and select `Fictional passed round`.
  - **Expected:** The Views menu's button reads `Fictional passed round`.
  - **Notes:**

- [ ] `DABB` Open the Views menu and select **Delete view**.
  - **Expected:**
    - A notification reads "Deleted the Fictional passed round view.", with **Undo**.
    - `Fictional passed round` is gone from the Views menu.
  - **Notes:**

- [ ] `71DC` Open the Views menu and select `Fictional team view` under **Shared views**.
  - **Expected:** The Views menu's button reads `Fictional team view`.
  - **Notes:**

- [ ] `0F34` Open the Views menu and select **Delete view**.
  - **Expected:** `Fictional team view` is gone from the Views menu.
  - **Notes:**

**Afterwards:** Open the Views menu and select **Clear view**.

### VIEW-10: A View on Releases Shows Its Schedules in the Timeline Too

Proved by automated tests in `apps/web/src/release-tab.test.tsx`.

### VIEW-11: A View on a Column the Role Can No Longer See Is Dimmed

Proved by automated tests in `apps/web/src/people-page-saved-views.test.tsx`.

### VIEW-12: A Column Is Hidden and Shown Again

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, in the main window, the same as VIEW-09.

**Preconditions:** Select the **People** page in the left-hand menu; no view is applied, as VIEW-09 leaves it.

- [ ] `98E2` Select **Site** in the People table's header.
  - **Expected:**
    - The column menu opens.
    - **Hide column** is listed after **Move right**.
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

- [ ] `AFC7` Open the Views menu.
  - **Expected:**
    - Under the heading **Hidden**, the menu lists **Show all columns**, **Key** and **Site**, in that order.
    - The **Hidden** heading and its items are set apart from the items around them.
  - **Notes:**

- [ ] `0859` Press the Down arrow key until **Site** is highlighted.
  - **Expected:** **Site** is highlighted.
  - **Notes:**

- [ ] `F9D2` Press Enter.
  - **Expected:**
    - The menu closes.
    - **Site** is back in the place it had before.
  - **Notes:**

### VIEW-13: A View on Features Is Shared by Its Table and Board

**Account:** Engineering Director, `engineering.director@fathom.test`, in the main window, changed from VIEW-12.

**Preconditions:** In the main window, sign out, sign in with this account, and select the **Features** page in the left-hand menu, showing the table, with no view applied. In the second window, sign out, sign in as Product Manager, `product.manager@fathom.test`, and select the **Features** page, showing the table, with no view applied.

- [ ] `CBA2` In the main window, search for `offline sync`.
  - **Expected:** The table lists 'Offline Sync' alone.
  - **Notes:**

- [ ] `7291` Open the Views menu and select **Save view…**.
  - **Expected:**
    - A dialog titled "Save view" opens.
    - Under **Includes**, **Search** reads “offline sync”.
  - **Notes:**

- [ ] `7293` Type `Fictional roadmap` in **Name**.
  - **Expected:** The name shows in **Name**.
  - **Notes:**

- [ ] `CFB2` Tick **Share with everyone who sees this page**.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `FFDF` Select **Save view** in the dialog.
  - **Expected:** The Views menu's button reads `Fictional roadmap`.
  - **Notes:**

- [ ] `11C8` In the second window, reload the page.
  - **Expected:**
    - The table shows.
    - The Views menu's button reads **Views**, with no dot.
  - **Notes:**

- [ ] `FD34` Open the Views menu and select `Fictional roadmap` under **Shared views**.
  - **Expected:**
    - The table still shows, listing 'Offline Sync' alone.
    - The Views menu's button reads `Fictional roadmap`, with no dot.
  - **Notes:**

- [ ] `7D74` Select **Board** in the switch after the **Features** heading.
  - **Expected:**
    - The board holds the card 'Offline Sync' alone.
    - The Views menu's button still reads `Fictional roadmap`, with no dot.
  - **Notes:**

- [ ] `AC9D` In the main window, open the Views menu and select **Delete view**.
  - **Expected:** A notification reads "Deleted the Fictional roadmap view.", with **Undo**.
  - **Notes:**

**Afterwards:** In the second window, select **Table** in the switch after the **Features** heading. In each window, open the Views menu and select **Clear view**.

### VIEW-14: A View Keeps People Grouped by Manager, Then Site

Proved by automated tests in `apps/web/src/group-order.test.ts`.

### VIEW-15: A View on Capacity's Feature Teams Is Shared and Kept to Its Tab

Proved by automated tests in `apps/web/src/capacity-page.test.tsx` and `apps/web/src/capacity-feature-teams.test.tsx`.

### VIEW-16: A View on the Org Chart Keeps Its Team and Levels

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, in the main window, changed from VIEW-13.

**Preconditions:** In the main window, sign out, sign in with this account, and select the **Org chart** page in the left-hand menu.

- [ ] `7B93` On the card for 'Lorenza Thiel', select the small org chart button at its top right.
  - **Expected:**
    - To the right of the heading, the page reads "Only the team of Lorenza Thiel is shown."
    - Last of the buttons on the left above the chart, the Views menu's button reads **Views**, with a dot.
  - **Notes:**

- [ ] `798E` Select **Show levels**, then **All levels**.
  - **Expected:** Every card under 'Lorenza Thiel' that has reports shows them.
  - **Notes:**

- [ ] `ABBF` Open the Views menu and select **Save view…**.
  - **Expected:**
    - A dialog titled "Save view" opens.
    - Under **Includes**, **Levels** reads "All".
    - Under **Includes**, **Shown alone** reads "The team of Lorenza Thiel".
  - **Notes:**

- [ ] `0DAE` Type `Fictional Lorenza's team` in **Name** and press Enter.
  - **Expected:** The Views menu's button reads `Fictional Lorenza's team`.
  - **Notes:**

- [ ] `0733` Reload the page.
  - **Expected:**
    - The page reads "Only the team of Lorenza Thiel is shown."
    - Every card under 'Lorenza Thiel' that has reports shows them.
    - The Views menu's button reads `Fictional Lorenza's team`, with no dot.
  - **Notes:**

- [ ] `AD9A` Open the Views menu and select **Delete view**.
  - **Expected:** A notification reads "Deleted the Fictional Lorenza's team view.", with **Undo**.
  - **Notes:**

**Afterwards:** Open the Views menu and select **Clear view**.

### VIEW-17: Accounts Are on the Shared Table, With a Saved View

Proved by automated tests in `apps/web/src/accounts-page.test.tsx`.
