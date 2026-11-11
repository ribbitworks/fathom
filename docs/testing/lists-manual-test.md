---
title: "Manual Test: Built-in Lists and Lists with Meanings"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/db/migrations/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-07"
---

# Manual Test: Built-in Lists and Lists with Meanings

## Scope

Verifies the Lists page's built-in lists, Positions, Hiring states, Proposal statuses and Feature statuses: their mark, the line telling those who may change them that they are theirs to change, the switch that narrows the table to built-in or custom lists, changing their visibility, which sets who sees the Position column, each hiring state's meaning, giving new choices a meaning, and the rules that keep a choice offered for every meaning, when drafting and when approving.

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

- **Panel:** the area that opens beside the table of lists when you select a list's name, showing the list's choices.
- **Empty row:** the last row of the panel's choices, starting with a **+**, where new choices are typed.
- **Meaning menu:** the drop-down at the end of a choice's row while it is being edited, and at the end of the empty row.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Check each step whose expected result you see, and write anything else under its notes.

### LIST-01: Built-in Lists Are Marked

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Lists** page open from the left-hand menu.

- [ ] **Step 1.** Read the **Name** column of the **Feature statuses**, **Hiring states**, **Positions** and **Proposal statuses** rows.
  - **Expected:** Each name has a grey **Built in** label beside it. No other list has one.
  - **Notes:**

- [ ] **Step 2.** Select **Positions**.
  - **Expected:** The panel opens with **Positions** at the top and **Built in** beside it. Under the choices, in grey, it reads three lines: **These can be renamed, added to, or retired.**, **Every person and planned hire has one of these positions.** and **Keep at least one.**
  - **Notes:**

- [ ] **Step 3.** Select **Hiring states**.
  - **Expected:** The panel opens with **Hiring states** at the top and **Built in** beside it. No description is shown under the name. Under the choices, in grey, it reads four lines: **These can be renamed, added to, or retired.**, **Proposed: the request to hire is not yet approved.**, **Open: the request to hire is approved.** and **Keep at least one choice for each.**
  - **Notes:**

### LIST-02: Each Hiring State Shows Its Meaning

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as LIST-01.

**Preconditions:** As LIST-01, with the **Hiring states** panel open.

- [ ] **Step 1.** Read each choice's row in the panel.
  - **Expected:** **Request to hire** shows **Proposed** at the end of its row. **Approved to hire** shows **Open** at the end of its row.
  - **Notes:**

### LIST-03: A New Choice Takes the Meaning Chosen

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as LIST-02.

**Preconditions:** As LIST-01, with the **Hiring states** panel open.

- [ ] **Step 1.** In the empty row's meaning menu, choose **Open**. Type **Fictional Interviewing** in the empty row's **Name** box and press Enter.
  - **Expected:** A row **Fictional Interviewing** appears above the empty row, with a hollow yellow dot and **Draft: added**, and **Open** at the end of the row. The empty row is empty again and its meaning menu still reads **Open**.
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

- [ ] **Step 1.** Press Esc. Select the **⋯** button at the end of the **Approved to hire** row, then select **Retire**.
  - **Expected:** The **Approved to hire** row stays where it is, with a hollow yellow dot and **Draft: retired**.
  - **Notes:**

- [ ] **Step 2.** Select the Publish button.
  - **Expected:** A notice says the changes were published. The Publish button is gone from the top bar.
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
  - **Expected:** The dialog closes. The **Approved to hire** row still has a yellow dot and **Draft: retired**.
  - **Notes:**

### LIST-07: Positions' Visibility Sets Who Sees the Position Column

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from LIST-06. Steps 3, 4 and 5 sign in as other accounts.

**Preconditions:** LIST-06 done. Signed in with this account. **Lists** page open, with the **Positions** panel open.

- [ ] **Step 1.** Select **Edit list**. Under **Visible to**, select **Restricted**, then select **Save**.
  - **Expected:** The dialog closes. **Positions** has a hollow yellow dot beside its name.
  - **Notes:**

- [ ] **Step 2.** Select the Publish button.
  - **Expected:** A notice says the changes were published.
  - **Notes:**

- [ ] **Step 3.** Sign in as the Engineering Director, `engineering.director@fathom.test`. Open the **Lists** page and select **Positions**. Select the **⋯** button beside **Edit list**, then select **Approve…**, then **Approve**.
  - **Expected:** The dialog closes, and the dot beside **Positions** is gone.
  - **Notes:**

- [ ] **Step 4.** Sign in as the Resource Planner, `resource.planner@fathom.test`. Open the **People** page.
  - **Expected:** The table has no **Position** column.
  - **Notes:**

- [ ] **Step 5.** Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`. Open the **People** page.
  - **Expected:** The table has a **Position** column, and **New** can be selected.
  - **Notes:**

- [ ] **Step 6.** Run Reset the Database.
  - **Expected:** The last line printed gives the shared password, with no error above it.
  - **Notes:**

### LIST-08: The Lists Shown Can Be Narrowed to Built-in or Custom Ones

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as the account LIST-07 ended with.

**Preconditions:** LIST-07 done, so the database is as Reset the Database leaves it. Signed in with this account. **Lists** page open from the left-hand menu, with no list's panel open.

- [ ] **Step 1.** In the switch beside **Search lists**, select **Built in**.
  - **Expected:** The table shows only **Feature statuses**, **Hiring states**, **Positions** and **Proposal statuses**, and the count reads **4 of 12**.
  - **Notes:**

**Afterwards:** Run Reset the Database.
