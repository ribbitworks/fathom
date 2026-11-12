---
title: "Manual Test: Data Classes"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/shared/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-11"
---

# Manual Test: Data Classes

## Scope

Verifies what only a person can judge of changing the class of data: the Data classes page and its three sections, the dialog that changes a class, the lock marking a classified column or list, and how a change of class changes what another role sees. Changing a list's class from its panel is in [Lists](lists-manual-test.md) LIST-07.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Engineering Director:** `engineering.director@fathom.test`, who may Classify data and sees Personal and Confidential data
- **Engineering Manager:** `engineering.manager@fathom.test`, who sees Personal data but not Confidential data

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Reset the Database](manual-test-basics.md#reset-the-database).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the column menu.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### CLASS-01: The Data Classes Page Shows the Class of Everything

**Account:** Engineering Director, `engineering.director@fathom.test`; the first test case. Step 6 signs in as another account.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select **Data classes** under **Administration** in the left-hand menu.
  - **Expected:**
    - Three sections follow the heading, **Built-in details**, **Columns** and **Lists**, each a table with **Name**, **Class**, a column saying what each row is about, and a **Change class…** button at the end of most rows
    - **Name** and **Class** stay on one line, and only the third column wraps
  - **Notes:**

- [ ] **Step 2.** Look at the **Built-in details** section.
  - **Expected:**
    - It lists **Start date**, **End date**, **Past managers**, **Feature team dates**, **Future reorganizations** and **Hiring plan**
    - **Start date**'s class is a grey box with a lock and **Personal**, and **Needed by** reads **Org chart on other dates, Org chart on future dates, Feature assignments, Feature assignments grouped by manager, Allocations, People's Start**
    - **Hiring plan**'s class is a grey box with a lock and **Confidential**, with nothing under **Needed by**
  - **Notes:**

- [ ] **Step 3.** Look at the **Columns** section.
  - **Expected:**
    - It lists People's added columns, such as **Site**, each reading **General**
    - **Site** reads **People, with the class of Sites** and has no **Change class…** button, since it takes its list's class
  - **Notes:**

- [ ] **Step 4.** Look at the **Lists** section.
  - **Expected:** It lists the lists, such as **Sites**, each with the columns using it, such as **Site** for **Sites**, and a **Change class…** button.
  - **Notes:**

- [ ] **Step 5.** Choose **Dark** in the Appearance menu.
  - **Expected:** The page and the grey boxes stay readable, with their locks lined up with their words.
  - **Notes:**

- [ ] **Step 6.** Sign out, and sign in as the Engineering Manager, `engineering.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Manager**.
  - **Notes:**

- [ ] **Step 7.** Look at the left-hand menu.
  - **Expected:** There is no **Data classes** item.
  - **Notes:**

### CLASS-02: Changing a Detail's Class Changes What Another Role Sees

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as CLASS-01 ended with. Steps 1, 11 and 13 sign in as other accounts.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Director**.
  - **Notes:**

- [ ] **Step 2.** Select **Data classes** under **Administration** in the left-hand menu.
  - **Expected:** The three sections show.
  - **Notes:**

- [ ] **Step 3.** Press Tab until **Change class…** on the **Start date** row has focus.
  - **Expected:** A focus ring shows around that **Change class…**.
  - **Notes:**

- [ ] **Step 4.** Press Enter.
  - **Expected:**
    - A dialog titled **Change the class of Start date** opens, with **Personal** chosen
    - **General**, **Personal** and **Confidential** each have a line saying what the class holds
  - **Notes:**

- [ ] **Step 5.** Press Esc.
  - **Expected:** The dialog closes, focus is back on **Change class…** on the **Start date** row, and the class is still **Personal**.
  - **Notes:**

- [ ] **Step 6.** Press Enter.
  - **Expected:** The dialog opens again, with **Personal** chosen.
  - **Notes:**

- [ ] **Step 7.** Select **Confidential**.
  - **Expected:** **Confidential** is chosen.
  - **Notes:**

- [ ] **Step 8.** Select **Change**.
  - **Expected:**
    - The dialog closes, with no notice and nothing to publish
    - **Start date**'s class is a grey box with a lock and **Confidential**
  - **Notes:**

- [ ] **Step 9.** Select **Change class…** on the **Start date** row.
  - **Expected:** The dialog opens, with **Confidential** chosen.
  - **Notes:**

- [ ] **Step 10.** Select **Change**.
  - **Expected:** The dialog closes, and the class is still **Confidential**.
  - **Notes:**

- [ ] **Step 11.** Sign out, and sign in as the Engineering Manager, `engineering.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Manager**.
  - **Notes:**

- [ ] **Step 12.** Select the **Org chart** page in the left-hand menu.
  - **Expected:** In place of the date row, a line reads **Other dates need Confidential access.**
  - **Notes:**

- [ ] **Step 13.** Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Director**.
  - **Notes:**

- [ ] **Step 14.** Select the **Access history** page in the left-hand menu.
  - **Expected:** The newest entry has a yellow dot before it and says the Engineering Director moved **Start date from Personal to Confidential**.
  - **Notes:**

### CLASS-03: Changing a Column's Class Marks Its Heading

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as CLASS-02 ended with.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] **Step 1.** Select **New column**.
  - **Expected:** The **New column** dialog opens.
  - **Notes:**

- [ ] **Step 2.** Type `Portfolio` in **Name**.
  - **Expected:** **Name** reads **Portfolio**.
  - **Notes:**

- [ ] **Step 3.** Choose **Web link** in **Type**.
  - **Expected:** **Class** is shown, with **General** chosen and **Personal** and **Confidential** each with a line saying what the class holds.
  - **Notes:**

- [ ] **Step 4.** Select **Add column**.
  - **Expected:** The dialog closes, and a **Portfolio** column is at the right end of the table, with a hollow dot before its name.
  - **Notes:**

- [ ] **Step 5.** Select the Publish button.
  - **Expected:** A notice reads **Published 1 change.**
  - **Notes:**

- [ ] **Step 6.** Open the **Portfolio** column menu, and select **Approve…**.
  - **Expected:** A dialog opens, with an **Approve** button.
  - **Notes:**

- [ ] **Step 7.** Select **Approve**.
  - **Expected:** A notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] **Step 8.** Open the **Portfolio** column menu, and select **Change class…**.
  - **Expected:** A dialog titled **Change the class of Portfolio** opens, with **General** chosen.
  - **Notes:**

- [ ] **Step 9.** Select **Personal**.
  - **Expected:** **Personal** is chosen.
  - **Notes:**

- [ ] **Step 10.** Select **Change**.
  - **Expected:**
    - The dialog closes
    - The **Portfolio** heading is followed by a grey box with a lock and **Personal**, which lines up with the heading's text
  - **Notes:**

- [ ] **Step 11.** Open the column menu of **Site**, which draws on a list.
  - **Expected:** **Change class…** is greyed out, with **Takes the class of its list** under it.
  - **Notes:**

- [ ] **Step 12.** Select the **Data classes** page in the left-hand menu.
  - **Expected:** In the **Columns** section, **Portfolio**'s class is a grey box with a lock and **Personal**.
  - **Notes:**

**Afterwards:** Run Reset the Database.
