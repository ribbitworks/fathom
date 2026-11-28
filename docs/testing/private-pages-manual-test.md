---
title: "Manual Test: Private Pages"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/mine-section.tsx", "apps/web/src/new-page-dialog.tsx", "apps/web/src/private-page.tsx", "apps/web/src/private-table.ts", "apps/web/src/private-row-actions.ts"]
dependencies: ["docs/standards/testing.md", "docs/design/pages/mine.md", "docs/help/private-pages.md"]
last_updated: "2026-11-27"
---

# Manual Test: Private Pages

## Scope

Verifies how a person's own pages under **Mine** look and work:

- **Mine** in the left-hand menu, open and collapsed, with the violet ring before each page.
- Making a page with **New page**, in two steps, from the keyboard.
- Typing rows in a page's table like a spreadsheet, undoing a change, and removing a row with **Undo**.
- That another account doesn't see **Mine**.
- That a row's link, copied from its menu, opens its page for its maker.
- Removing a column, asking first and offering **Undo** after.
- Renaming and removing a page from its **⋯**, removing asking first and offering **Undo** after.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A second browser, or a private window, for signing in as a second account while the first stays signed in.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Feature Lead:** `feature.lead@fathom.test`
- **Team Member:** `team.member@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses. This test adds:

- **Violet ring:** the small hollow violet circle before a private page's name.
- **Main window:** the browser window the test starts in.
- **Second window:** the second browser or private window.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### PRIV-01: Mine Comes After People in the Left-Hand Menu

**Account:** Feature Lead, `feature.lead@fathom.test`, the first account of this test.

**Preconditions:** Restore the Seed Data has just run, and the left-hand menu is not collapsed.

- [ ] `07FD` Sign in as the Feature Lead, `feature.lead@fathom.test`.
  - **Expected:**
    - The left-hand menu has a section headed **Mine**, after **People** and before **Administration**.
    - Under **Mine**, the only item is **New page**, after a **+**.
  - **Notes:**

### PRIV-02: New Page Makes a Page in Two Steps, from the Keyboard

**Account:** Feature Lead, `feature.lead@fathom.test`, as PRIV-01 ends.

**Preconditions:** Any page open.

- [ ] `0A68` Under **Mine**, select **New page**.
  - **Expected:**
    - A dialog titled **New page** opens.
    - The **Name** box has focus.
  - **Notes:**

- [ ] `149E` Press Enter.
  - **Expected:**
    - "Name needed" shows in red under **Name**.
    - The **Name** box keeps focus.
  - **Notes:**

- [ ] `181B` Type `Follow-ups` and press Enter.
  - **Expected:**
    - A table with the headings **Name**, **Type** and **List**.
    - Its first row reads `Name` and **Text**, with no **×** at its end.
    - Under it, an empty row with **Text**, whose name box has focus.
  - **Notes:**

- [ ] `5D3B` Type `Due`.
  - **Expected:**
    - The row reads `Due` and **Text**, with a **×** at its end.
    - A new empty row shows under it.
  - **Notes:**

- [ ] `E71C` Press Tab, and choose **Date** in the row's **Type** list.
  - **Expected:** The row reads `Due` and **Date**.
  - **Notes:**

- [ ] `93F6` Select the empty row's name box, and type `Done`.
  - **Expected:** The row reads `Done` and **Text**, with a **×** at its end.
  - **Notes:**

- [ ] `C0A8` Press Tab, and choose **Checkbox** in the row's **Type** list.
  - **Expected:** The row reads `Done` and **Checkbox**.
  - **Notes:**

- [ ] `2449` Select the **Type** of the first row, `Name`.
  - **Expected:** It offers only **Text**, **Number** and **Date**.
  - **Notes:**

- [ ] `2CDF` Choose **Text**, then select **Back**.
  - **Expected:** The **Name** box reads `Follow-ups`.
  - **Notes:**

- [ ] `3226` Select **Next**.
  - **Expected:** The three rows `Name`, `Due` and `Done` are as they were, with the empty row under them.
  - **Notes:**

- [ ] `3DBA` Select **Add page**.
  - **Expected:**
    - The dialog closes.
    - The page's heading reads **Follow-ups**, after a violet ring.
    - The top bar reads "Mine / Follow-ups".
    - Under **Mine** in the left-hand menu, **Follow-ups** shows after a violet ring, marked as the current page, then **New page**.
    - A table with the columns **Name**, **Due** and **Done**, and an empty row.
    - Above it, **Search**, **Metrics** and **Views**, and no **Drafts & Live** menu.
  - **Notes:**

- [ ] `3E4D` Point at the violet ring before the heading.
  - **Expected:** A tip reads "Private. Nobody else sees this page."
  - **Notes:**

### PRIV-03: Rows Are Typed Like a Spreadsheet and Saved at Once

**Account:** Feature Lead, `feature.lead@fathom.test`, as PRIV-02 ends.

**Preconditions:** The **Follow-ups** page open, as PRIV-02 ends.

- [ ] `3EBD` Select the empty row's **Name** cell, type `Check offline conflicts`, and press Enter.
  - **Expected:**
    - A row reads 'Check offline conflicts', with no dot, tint or **Live** row.
    - A new empty row shows under it, its **Name** cell selected.
  - **Notes:**

- [ ] `425F` Type `Ask about bulk edits` and press Enter.
  - **Expected:** A second row reads 'Ask about bulk edits', under the first.
  - **Notes:**

- [ ] `4A1E` Type `Review the export`, and press Tab.
  - **Expected:**
    - The **Due** cell of the row being typed in is selected.
    - A violet ring shows before 'Review the export', with no tint on the row.
  - **Notes:**

- [ ] `4B57` Point at the violet ring before 'Review the export'.
  - **Expected:** A tip reads "New, not saved yet".
  - **Notes:**

- [ ] `4C93` Select the **Search** box above the table.
  - **Expected:**
    - A third row reads 'Review the export', with no ring.
    - A new empty row shows under it.
  - **Notes:**

- [ ] `4D2C` Select the **Due** cell of 'Check offline conflicts', type `2026-12-04`, and press Enter.
  - **Expected:** The cell reads "Dec 4, 2026".
  - **Notes:**

- [ ] `58B8` Select the **Done** cell of 'Check offline conflicts', and press Space.
  - **Expected:** The **Done** box of 'Check offline conflicts' is ticked.
  - **Notes:**

- [ ] `5C19` Press Cmd+Z on a Mac, or Ctrl+Z elsewhere.
  - **Expected:** The **Done** box of 'Check offline conflicts' is unticked again.
  - **Notes:**

- [ ] `683F` Reload the page.
  - **Expected:**
    - 'Check offline conflicts' with "Dec 4, 2026" and **Done** unticked, then 'Ask about bulk edits', then 'Review the export', in that order.
    - The count above the table reads "3 rows".
  - **Notes:**

### PRIV-04: A Row Is Removed at Once, with Undo

**Account:** Feature Lead, `feature.lead@fathom.test`, as PRIV-03 ends.

**Preconditions:** The **Follow-ups** page open, as PRIV-03 ends.

- [ ] `6E7E` Point at the row of 'Ask about bulk edits', and select the **⋯** over its **Name** cell.
  - **Expected:** A menu opens with **Copy link** and **Remove row**.
  - **Notes:**

- [ ] `7784` Select **Remove row**.
  - **Expected:**
    - The row is gone from the table.
    - A notification reads "Removed Ask about bulk edits.", with **Undo**.
  - **Notes:**

- [ ] `7C81` Select **Undo** in the notification.
  - **Expected:** 'Ask about bulk edits' is back, after 'Check offline conflicts'.
  - **Notes:**

### PRIV-05: Mine in the Collapsed Menu

**Account:** Feature Lead, `feature.lead@fathom.test`, as PRIV-04 ends.

**Preconditions:** The **Follow-ups** page open, as PRIV-04 ends.

- [ ] `8283` Select **Collapse sidebar** at the top of the left-hand menu.
  - **Expected:**
    - Under the line where **Mine** was, a violet ring then "F" stands for **Follow-ups**, marked as the current page.
    - Under it, a **+** stands for **New page**.
  - **Notes:**

- [ ] `8758` Point at the "F".
  - **Expected:** A tip reads "Follow-ups".
  - **Notes:**

- [ ] `8A56` Select **Expand sidebar**.
  - **Expected:** **Mine** lists **Follow-ups**, after its violet ring, then **New page**.
  - **Notes:**

### PRIV-06: Nobody Else Sees Mine

**Account:** Team Member, `team.member@fathom.test`, in the second window, changed from PRIV-05. The Feature Lead stays signed in in the main window.

**Preconditions:** The **Follow-ups** page open in the main window, as PRIV-05 ends.

- [ ] `A4E4` In the second window, sign in as the Team Member, `team.member@fathom.test`.
  - **Expected:** The left-hand menu has no **Mine** section, and starts with **Plan**.
  - **Notes:**

### PRIV-07: A Row's Link Opens Its Page for Its Maker

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main window, the same as PRIV-06's main window.

**Preconditions:** The **Follow-ups** page open in the main window, as PRIV-06 leaves it.

- [ ] `A40A` In the main window, select the **⋯** over the **Name** cell of 'Check offline conflicts', then **Copy link**.
  - **Expected:** A notification reads "Link copied."
  - **Notes:**

- [ ] `B32A` In the main window, paste the link into the address bar, and press Enter.
  - **Expected:** The **Follow-ups** page opens, with its three rows.
  - **Notes:**

### PRIV-08: Removing a Column Asks First, Then Offers Undo

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main window, as PRIV-07 ends.

**Preconditions:** The **Follow-ups** page open in the main window, as PRIV-07 leaves it.

- [ ] `C5DF` Select the **Due** heading.
  - **Expected:** The menu ends with **Remove column…**, in red.
  - **Notes:**

- [ ] `E707` Select **Remove column…**.
  - **Expected:**
    - A dialog asks "Remove the Due column?", with **Cancel** and **Remove** in red.
    - **Cancel** has focus.
  - **Notes:**

- [ ] `4C35` Press Esc.
  - **Expected:**
    - The dialog closes, and **Due** is still in the table.
    - The **Due** heading has focus.
  - **Notes:**

- [ ] `7A35` Press Enter, then select **Remove column…**.
  - **Expected:** The dialog asks "Remove the Due column?" again.
  - **Notes:**

- [ ] `1B00` Select **Remove**.
  - **Expected:**
    - **Due** is gone from the table.
    - A notification reads "Removed the Due column.", with **Undo**.
  - **Notes:**

- [ ] `EE7A` Press Cmd+Z on a Mac, or Ctrl+Z elsewhere.
  - **Expected:** **Due** is back, with "Dec 4, 2026" in the row of 'Check offline conflicts'.
  - **Notes:**

- [ ] `1A56` Select the **Name** heading.
  - **Expected:** The menu offers no **Remove column…**.
  - **Notes:**

### PRIV-09: A Page Is Renamed and Removed from Its ⋯

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main window, as PRIV-08 ends.

**Preconditions:** The **Follow-ups** page open in the main window, as PRIV-08 leaves it, and no other page under **Mine**.

- [ ] `6F37` Select the **⋯** at the right of the page's heading, after the Export icon.
  - **Expected:**
    - A menu opens with **Rename page…**, **Copy link** and **Copy key**, a line, then **Remove page…** in red.
    - The heading is still one line.
  - **Notes:**

- [ ] `7B30` Select **Copy key**.
  - **Expected:** A notification reads "Key copied."
  - **Notes:**

- [ ] `C62E` Paste into the **Search** box above the table.
  - **Expected:** The box reads the page's key: "#PAGE-", then four letters and digits.
  - **Notes:**

- [ ] `4EB1` Clear the **Search** box, then select the **⋯** and **Rename page…**.
  - **Expected:**
    - A dialog titled **Rename page** opens.
    - Its **Name** box reads "Follow-ups" and has focus.
  - **Notes:**

- [ ] `ACC9` Type `Open questions` in place of the name, and press Enter.
  - **Expected:**
    - The dialog closes, and the **⋯** has focus.
    - The heading, the top bar and **Mine** in the left-hand menu read "Open questions".
  - **Notes:**

- [ ] `DC01` Press Cmd+Z on a Mac, or Ctrl+Z elsewhere.
  - **Expected:** The heading, the top bar and **Mine** read "Follow-ups" again.
  - **Notes:**

- [ ] `92F7` Select the **⋯**, then **Remove page…**.
  - **Expected:** A dialog asks "Remove the Follow-ups page?", with **Cancel** and **Remove** in red.
  - **Notes:**

- [ ] `1E51` Select **Remove**.
  - **Expected:**
    - The **Overview** opens.
    - **Mine** lists only **New page**.
    - A notification reads "Removed the Follow-ups page.", with **Undo**.
  - **Notes:**

- [ ] `4C50` Select **Undo** in the notification.
  - **Expected:**
    - The **Follow-ups** page opens, with its three rows.
    - **Mine** lists **Follow-ups** again.
  - **Notes:**
