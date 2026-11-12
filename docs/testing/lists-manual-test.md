---
title: "Manual Test: Built-in Lists and Lists with Meanings"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/db/migrations/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-11"
---

# Manual Test: Built-in Lists and Lists with Meanings

## Scope

Verifies the Lists page's built-in lists, Positions, Hiring states, Proposal statuses and Feature statuses: their grey **Built in** box, the switch that narrows the table to built-in or custom lists, changing their visibility, which sets who sees the Position column, each hiring state's meaning, giving new choices a meaning, and the rules that keep a choice offered for every meaning, when drafting and when approving.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**
- **Engineering Director:** `engineering.director@fathom.test`
- **Resource Planner:** `resource.planner@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Reset the Database](manual-test-basics.md#reset-the-database).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the Publish button and the ⋯ menu. This test adds:

- **Panel:** the area that opens beside the table of lists when a list's name is selected, showing the list's choices.
- **Empty row:** the last row of the panel's choices, starting with a **+**, where new choices are typed.
- **Meaning menu:** the drop-down at the end of a choice's row while it is being edited, and at the end of the empty row.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### LIST-01: Built-in Lists Are Marked

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Lists** page open from the left-hand menu.

- [ ] **Step 1.** Read the **Name** column of the **Feature statuses**, **Hiring states**, **Positions** and **Proposal statuses** rows.
  - **Expected:**
    - Each name has a grey **Built in** box after it
    - No other list has one
  - **Notes:**

- [ ] **Step 2.** Select **Positions**.
  - **Expected:**
    - The panel opens with **Positions** at the top and a grey **Built in** box after it.
    - Under the choices, in grey, a line reads **Every person and planned hire has one of these positions.**
  - **Notes:**

- [ ] **Step 3.** Select **Hiring states**.
  - **Expected:**
    - The panel opens with **Hiring states** at the top and a grey **Built in** box after it.
    - No description is shown under the name.
    - Under the choices, in grey, a line reads **Proposed: the request to hire is not yet approved.**
    - Under it, in grey, a line reads **Open: the request to hire is approved.**
  - **Notes:**

### LIST-02: Each Hiring State Shows Its Meaning

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as LIST-01.

**Preconditions:** As LIST-01, with the **Hiring states** panel open.

- [ ] **Step 1.** Read each choice's row in the panel.
  - **Expected:**
    - **Request to hire** shows **Proposed** at the end of its row.
    - **Approved to hire** shows **Open** at the end of its row.
  - **Notes:**

### LIST-03: A New Choice Takes the Meaning Chosen

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as LIST-02.

**Preconditions:** As LIST-01, with the **Hiring states** panel open.

- [ ] **Step 1.** In the empty row's meaning menu, choose **Open**.
  - **Expected:** The empty row's meaning menu reads **Open**.
  - **Notes:**

- [ ] **Step 2.** Type **Fictional Interviewing** in the empty row's **Name** box and press Enter.
  - **Expected:**
    - A row **Fictional Interviewing** appears above the empty row, with a hollow yellow dot in its slot, and **Open** at the end of the row
    - The empty row is empty again, and its meaning menu still reads **Open**
  - **Notes:**

### LIST-04: The Last Choice for a Meaning Is Kept

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as LIST-03.

**Preconditions:** As LIST-03.

- [ ] **Step 1.** Select the **⋯** button at the end of the **Request to hire** row.
  - **Expected:** **Retire** and **Remove** are greyed out, with **Needed for Proposed** under them.
  - **Notes:**

### LIST-05: A Choice Can Be Retired When Another Has the Same Meaning

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as LIST-04.

**Preconditions:** As LIST-04.

- [ ] **Step 1.** Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button at the end of the **Approved to hire** row, then select **Retire**.
  - **Expected:** The **Approved to hire** row:
    - Stays where it is
    - Has a hollow yellow dot in its slot
    - Has a yellow **Retired** box after its name
  - **Notes:**

- [ ] **Step 3.** Select the Publish button.
  - **Expected:**
    - A notice says the changes were published.
    - The Publish button is gone from the top bar.
  - **Notes:**

### LIST-06: Approving Cannot Leave a Meaning With No Choice

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from LIST-05.

**Preconditions:** LIST-05 done. Signed in with this account. **Lists** page open, with the **Hiring states** panel open.

- [ ] **Step 1.** Select the **⋯** button at the end of the **Approved to hire** row, then select **Approve…**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 2.** Select **Approve**.
  - **Expected:** The dialog stays open and reads **This would leave Hiring states with no choice that means Open.**
  - **Notes:**

- [ ] **Step 3.** Select **Cancel**.
  - **Expected:**
    - The dialog closes
    - The **Approved to hire** row still has a yellow dot in its slot
    - It still has a yellow **Retired** box after its name
  - **Notes:**

### LIST-07: Moving Positions to Another Class Sets Who Sees the Position Column

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from LIST-06. Steps 6 and 8 sign in as other accounts.

**Preconditions:** LIST-06 done. Signed in with this account. **Lists** page open, with the **Positions** panel open.

- [ ] **Step 1.** Select **Edit list**.
  - **Expected:** A dialog opens, with no **Class** choice in it.
  - **Notes:**

- [ ] **Step 2.** Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] **Step 3.** Select **Change class…**.
  - **Expected:**
    - A dialog titled **Change the class of Positions** opens
    - **General** is chosen, and **Personal** and **Confidential** can each be chosen, each with a line saying what it holds
  - **Notes:**

- [ ] **Step 4.** Select **Personal**.
  - **Expected:** **Personal** is chosen.
  - **Notes:**

- [ ] **Step 5.** Select **Change**.
  - **Expected:**
    - The dialog closes, with no dot beside **Positions** and nothing to publish
    - A grey box with a lock and **Personal** follows **Positions**, in its panel and in the table of lists
  - **Notes:**

- [ ] **Step 6.** Sign out, and sign in as the Resource Planner, `resource.planner@fathom.test`.
  - **Expected:** The top bar's right end reads **Resource Planner**.
  - **Notes:**

- [ ] **Step 7.** Select the **People** page in the left-hand menu.
  - **Expected:** The table has no **Position** column.
  - **Notes:**

- [ ] **Step 8.** Sign out, and sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Operations Manager**.
  - **Notes:**

- [ ] **Step 9.** Select the **People** page in the left-hand menu.
  - **Expected:**
    - The **Position** column's heading is followed by a grey box with a lock and **Personal**
    - **New** can be selected
  - **Notes:**

- [ ] **Step 10.** Run Reset the Database.
  - **Expected:** The last line printed gives the shared password, with no error above it.
  - **Notes:**

### LIST-08: The Lists Shown Can Be Narrowed to Built-in or Custom Ones

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as the account LIST-07 ended with.

**Preconditions:** LIST-07 done, so the database is as Reset the Database leaves it. Signed in with this account. **Lists** page open from the left-hand menu, with no list's panel open.

- [ ] **Step 1.** In the switch beside **Search lists**, select **Built in**.
  - **Expected:**
    - The table shows only **Feature statuses**, **Hiring states**, **Positions** and **Proposal statuses**.
    - The count reads **4 of 12**.
  - **Notes:**

**Afterwards:** Run Reset the Database.
