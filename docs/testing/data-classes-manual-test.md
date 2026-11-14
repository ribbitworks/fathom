---
title: "Manual Test: Data Classes"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/shared/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-13"
---

# Manual Test: Data Classes

## Scope

Verifies what only a person can judge of changing the class of data: the Data classes page and its three sections, the dialog that changes a class, the lock marking a classified column or list, and how a change of class changes what another role sees. Changing a list's class from its panel is in [Lists](lists-manual-test.md) LIST-07.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Engineering Director:** `engineering.director@fathom.test`, who may Classify data and sees Personal and Confidential data
- **Engineering Manager:** `engineering.manager@fathom.test`, who sees Personal and Confidential data but may not Classify data
- **Feature Lead:** `feature.lead@fathom.test`, who sees neither Personal nor Confidential data

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Reset the Database](manual-test-basics.md#reset-the-database).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the column menu.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### CLASS-01: The Data Classes Page Shows the Class of Everything

**Account:** Engineering Director, `engineering.director@fathom.test`; the first test case. Step `CA89` signs in as another account.

**Preconditions:** Signed in with this account.

- [ ] `DB3B` Select **Data classes** under **Administration** in the left-hand menu.
  - **Expected:**
    - Three sections follow the heading: **Built-in details**, **Columns** and **Lists**
    - Each section is a table with **Name**, **Class**, and a column saying what each row is about
    - Most rows end with a **Change class…** button
    - **Name** and **Class** stay on one line
    - Only the third column wraps
  - **Notes:**

- [ ] `753A` Look at the **Built-in details** section.
  - **Expected:**
    - It lists **Start date**, **End date**, **Past managers**, **Feature team dates**, **Future reorganizations** and **Hiring plan**
    - **Start date**'s class is a grey box with a lock and **Personal**
    - **Start date**'s **Needed by** starts "Org chart on other dates"
    - **Hiring plan**'s class is a grey box with a lock and **Confidential**
    - **Hiring plan**'s **Needed by** is empty
  - **Notes:**

- [ ] `A726` Look at the **Columns** section.
  - **Expected:**
    - It lists People's added columns, such as **Site**
    - Each column's class reads **General**
    - **Site**'s third column reads "People, with the class of Sites"
    - **Site** has no **Change class…** button
  - **Notes:**

- [ ] `2A27` Look at the **Lists** section.
  - **Expected:**
    - It lists the lists, such as 'Sites'
    - The third column of 'Sites' reads "Site"
    - Each list's row ends with a **Change class…** button
  - **Notes:**

- [ ] `CA89` Sign out, and sign in as the Engineering Manager, `engineering.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Manager".
  - **Notes:**

- [ ] `7EC0` Look at the left-hand menu.
  - **Expected:** There is no **Data classes** item.
  - **Notes:**

### CLASS-02: Changing a Detail's Class Changes What Another Role Sees

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as CLASS-01 ended with. Steps `2401`, `035D`, `605E` and `17BB` sign in as other accounts.

**Preconditions:** Signed in with this account.

- [ ] `2401` Sign out, and sign in as the Feature Lead, `feature.lead@fathom.test`.
  - **Expected:** The top bar's right end reads "Feature Lead".
  - **Notes:**

- [ ] `25D8` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** table shows.
  - **Notes:**

- [ ] `A892` Read the column headers.
  - **Expected:** There are no **Start** and **End** columns.
  - **Notes:**

- [ ] `035D` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `C38C` Select **Data classes** under **Administration** in the left-hand menu.
  - **Expected:** The three sections show.
  - **Notes:**

- [ ] `AB5D` Press Tab until **Change class…** on the **Start date** row has focus.
  - **Expected:** A focus ring shows around that **Change class…**.
  - **Notes:**

- [ ] `3A94` Press Enter.
  - **Expected:**
    - A dialog titled "Change the class of Start date" opens
    - **Personal** is chosen
    - **General**, **Personal** and **Confidential** each have a line saying what the class holds
  - **Notes:**

- [ ] `87E5` Press Esc.
  - **Expected:**
    - The dialog closes
    - Focus is back on **Change class…** on the **Start date** row
    - The class is still **Personal**
  - **Notes:**

- [ ] `05E5` Press Enter.
  - **Expected:**
    - The dialog opens again
    - **Personal** is chosen
  - **Notes:**

- [ ] `DDCB` Select **General**.
  - **Expected:** **General** is chosen.
  - **Notes:**

- [ ] `C2A4` Select **Change**.
  - **Expected:**
    - The dialog closes
    - No notification shows
    - The Publish button doesn't appear
    - **Start date**'s class reads **General**, with no grey box or lock
  - **Notes:**

- [ ] `B18D` Select **Change class…** on the **Start date** row.
  - **Expected:**
    - The dialog opens
    - **General** is chosen
  - **Notes:**

- [ ] `B86B` Select **Change**.
  - **Expected:**
    - The dialog closes
    - The class is still **General**
  - **Notes:**

- [ ] `54A3` Select **Change class…** on the **End date** row.
  - **Expected:**
    - A dialog titled "Change the class of End date" opens
    - **Personal** is chosen
  - **Notes:**

- [ ] `2466` Select **General**.
  - **Expected:** **General** is chosen.
  - **Notes:**

- [ ] `4155` Select **Change**.
  - **Expected:**
    - The dialog closes
    - **End date**'s class reads **General**, with no grey box or lock
  - **Notes:**

- [ ] `605E` Sign out, and sign in as the Feature Lead, `feature.lead@fathom.test`.
  - **Expected:** The top bar's right end reads "Feature Lead".
  - **Notes:**

- [ ] `3577` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** table shows.
  - **Notes:**

- [ ] `C812` Read the column headers.
  - **Expected:** **Start** and **End** columns are shown.
  - **Notes:**

- [ ] `17BB` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `8F30` Select the **Access history** page in the left-hand menu.
  - **Expected:**
    - The newest entry has a yellow dot before it
    - It says the Engineering Director moved "End date from Personal to General"
    - The entry under it says the Engineering Director moved "Start date from Personal to General"
  - **Notes:**

### CLASS-03: Changing a Column's Class Marks Its Heading

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as CLASS-02 ended with.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `8AC9` Select **New column**.
  - **Expected:** The **New column** dialog opens.
  - **Notes:**

- [ ] `668B` Type `Portfolio` in **Name**.
  - **Expected:** **Name** reads `Portfolio`.
  - **Notes:**

- [ ] `394F` Choose **Web link** in **Type**.
  - **Expected:**
    - **Class** is shown
    - **General** is chosen
    - **Personal** and **Confidential** each have a line saying what the class holds
  - **Notes:**

- [ ] `DC8C` Select **Add column**.
  - **Expected:**
    - The dialog closes
    - A **Portfolio** column is at the right end of the table
    - A hollow dot is before its name
  - **Notes:**

- [ ] `71F0` Select the Publish button.
  - **Expected:** A notification reads "Published 1 change."
  - **Notes:**

- [ ] `525B` Open the **Portfolio** column menu, and select **Approve…**.
  - **Expected:**
    - A dialog opens
    - It has an **Approve** button
  - **Notes:**

- [ ] `4ED3` Select **Approve**.
  - **Expected:** A notification reads "Approved 1 draft."
  - **Notes:**

- [ ] `F2C4` Open the **Portfolio** column menu, and select **Change class…**.
  - **Expected:**
    - A dialog titled "Change the class of Portfolio" opens
    - **General** is chosen
  - **Notes:**

- [ ] `A291` Select **Personal**.
  - **Expected:** **Personal** is chosen.
  - **Notes:**

- [ ] `58D9` Select **Change**.
  - **Expected:**
    - The dialog closes
    - The **Portfolio** heading is followed by a grey box with a lock and **Personal**
    - The box lines up with the heading's text
  - **Notes:**

- [ ] `EAD1` Open the column menu of **Site**.
  - **Expected:**
    - **Change class…** is greyed out
    - "Takes the class of its list" is under it
  - **Notes:**

- [ ] `D938` Select the **Data classes** page in the left-hand menu.
  - **Expected:** In the **Columns** section, **Portfolio**'s class is a grey box with a lock and **Personal**.
  - **Notes:**

**Afterwards:** Run Reset the Database.
