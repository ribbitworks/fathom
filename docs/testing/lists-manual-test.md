---
title: "Manual Test: The Lists Table, Built-in Lists and Lists with Meanings"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/db/migrations/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/administration.md"]
last_updated: "2026-11-25"
---

# Manual Test: The Lists Table, Built-in Lists and Lists with Meanings

## Scope

Verifies the Lists page's built-in lists, **Positions**, **Hiring states**, **Proposal statuses**, **Statuses**, **Feature priorities**, **Feature sizes** and **Feature risks**:

- Their grey **Built in** box, and the switch that narrows the table to built-in or custom lists.
- Changing their class, which sets who sees the Position column.
- Each hiring state's meaning, and giving new choices a meaning.
- The rules that keep a choice offered for every meaning, when drafting and when approving.
- Each size's weight.

It also verifies the table of lists: the columns that use each list, filtering and saving a view, renaming a list in its row, and a row's menu for those who change lists and those who only read them.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Engineering Director:** `engineering.director@fathom.test`
- **Feature Lead:** `feature.lead@fathom.test`
- **Product Manager:** `product.manager@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Reset the Database](manual-test-basics.md#reset-the-database).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the Publish button and the ⋯ menu. This test adds:

- **Panel:** the side panel that opens beside the table of lists from a list's details button, showing the list's choices.
- **Empty row:** the last row of the panel's choices, starting with a **+**, where new choices are typed.
- **Meaning menu:** the drop-down at the end of a choice's row while it is being edited, and at the end of the empty row.
- **Weight box:** the box at the end of a **Feature sizes** choice's row while it is being edited, and at the end of the empty row.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### LIST-01: Built-in Lists Are Marked

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Lists** page open from the left-hand menu.

- [ ] `97EB` Read the **Name** column of the **Feature priorities**, **Feature risks**, **Feature sizes**, **Hiring states**, **Positions**, **Proposal statuses** and **Statuses** rows.
  - **Expected:**
    - Each name has a grey **Built in** box after it.
    - These seven rows are the first in the table, in this order.
    - No other list has a **Built in** box.
  - **Notes:**

- [ ] `2C8A` Select the details button of **Positions**.
  - **Expected:**
    - The panel opens with **Positions** at the top.
    - A grey **Built in** box is after it.
    - Under the choices, in grey, a line reads "Every person and planned hire has one of these positions."
  - **Notes:**

- [ ] `4E5E` Select the details button of **Hiring states**.
  - **Expected:**
    - The panel opens with **Hiring states** at the top.
    - A grey **Built in** box is after it.
    - No description is shown under the name.
    - Under the choices, in grey, a line reads "Proposed: the request to hire is not yet approved."
    - Under it, in grey, a line reads "Open: the request to hire is approved."
  - **Notes:**

### LIST-02: Each Hiring State Shows Its Meaning

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as LIST-01.

**Preconditions:** As LIST-01, with the **Hiring states** panel open.

- [ ] `C4C0` Read each choice's row in the panel.
  - **Expected:**
    - **Request to hire** shows "Proposed" at the end of its row.
    - **Approved to hire** shows "Open" at the end of its row.
  - **Notes:**

### LIST-03: A New Choice Takes the Meaning Chosen

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as LIST-02.

**Preconditions:** As LIST-01, with the **Hiring states** panel open.

- [ ] `889C` In the empty row's meaning menu, choose **Open**.
  - **Expected:** The empty row's meaning menu reads "Open".
  - **Notes:**

- [ ] `F477` Type `Fictional Interviewing` in the empty row's **Name** box and press Enter.
  - **Expected:**
    - A row `Fictional Interviewing` appears above the empty row
    - It has a hollow yellow dot in its slot
    - It has "Open" at the end of the row
    - The empty row is empty again
    - Its meaning menu still reads "Open"
  - **Notes:**

### LIST-04: The Last Choice for a Meaning Is Kept

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as LIST-03.

**Preconditions:** As LIST-03.

- [ ] `B11B` Select the **⋯** button at the end of the **Request to hire** row.
  - **Expected:**
    - **Retire** and **Remove** are greyed out.
    - "Needed for Proposed" is under them.
  - **Notes:**

### LIST-05: A Choice Can Be Retired When Another Has the Same Meaning

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as LIST-04.

**Preconditions:** As LIST-04.

- [ ] `D78F` Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `CD6E` Select the **⋯** button at the end of the **Approved to hire** row, then select **Retire**.
  - **Expected:** The **Approved to hire** row:
    - Stays where it is
    - Has a hollow yellow dot in its slot
    - Has a yellow **Retired** box after its name
  - **Notes:**

- [ ] `2F42` Select the Publish button.
  - **Expected:**
    - A notice says the changes were published.
    - The Publish button is gone from the top bar.
  - **Notes:**

### LIST-06: Approving Cannot Leave a Meaning With No Choice

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from LIST-05.

**Preconditions:** LIST-05 done. Signed in with this account. **Lists** page open, with the **Hiring states** panel open.

- [ ] `95B3` Select the **⋯** button at the end of the **Approved to hire** row, then select **Approve…**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `DCBD` Select **Approve**.
  - **Expected:**
    - The dialog stays open.
    - It reads "This would leave Hiring states with no choice that means Open."
  - **Notes:**

- [ ] `113E` Select **Cancel**.
  - **Expected:**
    - The dialog closes
    - The **Approved to hire** row still has a yellow dot in its slot
    - It still has a yellow **Retired** box after its name
  - **Notes:**

### LIST-07: Changing the Class of Positions Sets Who Sees the Position Column

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from LIST-06. Steps `EACE` and `50D4` sign in as other accounts.

**Preconditions:** LIST-06 done. Signed in with this account. **Lists** page open, with the **Positions** panel open.

- [ ] `3AA3` Select **Edit list…**.
  - **Expected:**
    - A dialog opens.
    - It has no **Class** choice in it.
  - **Notes:**

- [ ] `AA11` Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] `BE18` Select **Change class…**.
  - **Expected:**
    - A dialog titled "Change the class of Positions" opens
    - **General** is chosen
    - **Personal** and **Confidential** can each be chosen
  - **Notes:**

- [ ] `784A` Select **Personal**.
  - **Expected:** **Personal** is chosen.
  - **Notes:**

- [ ] `03C9` Select **Change**.
  - **Expected:**
    - The dialog closes
    - No dot is beside **Positions**
    - The Publish button doesn't appear
    - An eye with a line through it is before **Positions** in its panel
    - An eye with a line through it is before **Positions** in the table of lists
  - **Notes:**

- [ ] `EACE` Sign out, and sign in as the Feature Lead, `feature.lead@fathom.test`.
  - **Expected:** The top bar's right end reads "Feature Lead".
  - **Notes:**

- [ ] `B349` Select the **People** page in the left-hand menu.
  - **Expected:** The table has no **Position** column.
  - **Notes:**

- [ ] `50D4` Sign out, and sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Operations Manager".
  - **Notes:**

- [ ] `DACD` Select the **People** page in the left-hand menu.
  - **Expected:**
    - An eye with a line through it is before **Position** in its column's heading
    - **New person** is not greyed out
  - **Notes:**

- [ ] `0F88` Run Reset the Database.
  - **Expected:**
    - The last line printed gives the shared password.
    - No error is above it.
  - **Notes:**

### LIST-08: The Lists Shown Can Be Narrowed to Built-in or Custom Ones

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as the account LIST-07 ended with.

**Preconditions:** LIST-07 done, so the database is as Reset the Database leaves it. Signed in with this account. **Lists** page open from the left-hand menu, with no list's panel open.

- [ ] `DB05` In the switch beside the page's title, select **Built in**.
  - **Expected:**
    - The table shows only **Feature priorities**, **Feature risks**, **Feature sizes**, **Hiring states**, **Positions**, **Proposal statuses** and **Statuses**.
    - The count reads "7 lists".
  - **Notes:**

**Afterwards:** Run Reset the Database.

### LIST-09: Each Size Has a Weight

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as LIST-08.

**Preconditions:** LIST-08 done, so the database is as Reset the Database leaves it. Signed in with this account. **Lists** page open from the left-hand menu.

- [ ] `4A00` Select the details button of **Feature sizes**.
  - **Expected:** The choices' rows end, in order:
    - **XS** with `0.5`
    - **S** with `1`
    - **M** with `2`
    - **L** with `3`
    - **XL** with `4`
  - **Notes:**

- [ ] `1011` Select **2** at the end of the **M** row.
  - **Expected:** The row opens for editing, with the cursor in its weight box.
  - **Notes:**

- [ ] `A8B2` Replace `2` with `2.5` and press Enter.
  - **Expected:**
    - The **M** row ends with `2.5`
    - It has a hollow yellow dot in its slot
    - A light green Live row under it ends with `2`
  - **Notes:**

- [ ] `F2C1` Type `Fictional XXL` in the empty row's **Name** box and press Enter.
  - **Expected:**
    - No row is added
    - "Weight needed" is under the empty row's **Name** box, in red
    - The cursor is in the empty row's weight box
  - **Notes:**

- [ ] `C962` Type `6` in the empty row's weight box and press Enter.
  - **Expected:**
    - A row `Fictional XXL` appears above the empty row
    - It has a hollow yellow dot in its slot
    - It ends with `6`
    - The empty row is empty again
  - **Notes:**

**Afterwards:** Run Reset the Database.

### LIST-10: The Table Shows Which Columns Use Each List

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as LIST-09.

**Preconditions:** LIST-09 done, so the database is as Reset the Database leaves it. Signed in with this account. **Lists** page open from the left-hand menu, with no list's panel open.

- [ ] `79D3` Read the **Used by** cells of **Positions**, **Feature sizes** and **Sites**.
  - **Expected:**
    - **Positions** reads "People: Position"
    - **Feature sizes** reads "Features: Size"
    - **Sites** names "People: Site"
  - **Notes:**

- [ ] `CA8F` Open the **Used by** column's filter, tick **Empty**, and close the filter.
  - **Expected:**
    - A pill reads "Used by: Empty"
    - **Languages** shows, and **Sites** and **Positions** don't
  - **Notes:**

- [ ] `5427` Select **Save view…** in the **Views** menu.
  - **Expected:** The **Save view** dialog opens.
  - **Notes:**

- [ ] `2FBA` Type `Fictional unused lists` and select **Save view**.
  - **Expected:** The **Views** menu's button names **Fictional unused lists**.
  - **Notes:**

- [ ] `25ED` Select **Clear view** in the **Views** menu.
  - **Expected:** Every list shows again, with no pill.
  - **Notes:**

### LIST-11: A List Is Renamed in Its Row

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as LIST-10. Step `F2E2` signs in as another account.

**Preconditions:** LIST-10 done. Signed in with this account. **Lists** page open from the left-hand menu, with no list's panel open.

- [ ] `270A` Double-click the name **Levels**, replace it with `Fictional pay levels`, and press Enter.
  - **Expected:**
    - The row's name reads **Fictional pay levels**, after a hollow yellow dot
    - A light green Live row under it reads **Levels**
  - **Notes:**

- [ ] `78D2` Double-click the name **Fictional pay levels**, replace it with `Sites`, and press Enter.
  - **Expected:**
    - The name stays open for editing
    - A red line reads "Another list has that name"
  - **Notes:**

- [ ] `72F4` Press Esc.
  - **Expected:** The name reads **Fictional pay levels** again.
  - **Notes:**

- [ ] `BA5B` Open the ⋯ menu of **Positions**.
  - **Expected:** It offers **Show details** and **Copy link**, with no **Retire** or **Remove list**.
  - **Notes:**

- [ ] `D878` Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `2ED1` Open the ⋯ menu of **Sites**.
  - **Expected:** It offers **Show details**, **Copy link**, **Retire** and **Remove list**, the last in red.
  - **Notes:**

- [ ] `E6FB` Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `F2E2` Sign out, and sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** Fathom opens.
  - **Notes:**

- [ ] `330E` Select the **Lists** page in the left-hand menu.
  - **Expected:** There is no **New list** button.
  - **Notes:**

- [ ] `2E68` Open the ⋯ menu of **Sites**.
  - **Expected:** It offers only **Show details** and **Copy link**.
  - **Notes:**

- [ ] `40AE` Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `866E` Double-click the name **Sites**.
  - **Expected:** The name isn't opened for editing.
  - **Notes:**

**Afterwards:** Run Reset the Database.
