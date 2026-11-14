---
title: "Manual Test: Data Classes"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/shared/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-14"
---

# Manual Test: Data Classes

## Scope

Verifies what only a person can judge of changing the class of data: the Data classes page and its three sections, the dialog that changes a class, the symbol marking a classified column or list, and how a change of class changes what another role sees. Changing a list's class from its panel is in [Lists](lists-manual-test.md) LIST-07.

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
    - **Name**, **Class** and the third column start at the same place in all three tables
    - The **Change class…** buttons line up down the page
  - **Notes:**

- [ ] `753A` Look at the **Built-in details** section.
  - **Expected:**
    - It lists **Start date**, **End date**, **Past managers**, **Feature team dates**, **Future reorganizations** and **Hiring plan**
    - **Start date**'s class is an eye with a line through it, then **Personal**
    - **Start date**'s **About** starts "These need it: People on other dates"
    - **Hiring plan**'s class is a lock with a keyhole, then **Confidential**
    - The three class names in **Class** start at the same place
    - **Hiring plan**'s **About** reads "These need it: Planned hires on People and the Org chart."
  - **Notes:**

- [ ] `A726` Look at the **Columns** section.
  - **Expected:**
    - It lists People's added columns, such as **Site**
    - Each column's class is an open eye, then **General**
    - **Site**'s third column reads "People shows it. It has the class of its list, Sites."
    - **Site** has no **Change class…** button
  - **Notes:**

- [ ] `2A27` Look at the **Lists** section.
  - **Expected:**
    - It lists the lists, such as 'Sites'
    - The third column of 'Sites' reads "These People columns use it: Site."
    - Each list's row ends with a **Change class…** button
  - **Notes:**

- [ ] `CA89` Sign out, and sign in as the Engineering Manager, `engineering.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Manager".
  - **Notes:**

- [ ] `7EC0` Look at the left-hand menu.
  - **Expected:** There is no **Data classes** item.
  - **Notes:**

### CLASS-02: Changing a Detail's Class Changes What Another Role Sees

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as CLASS-01 ended with. Steps `2401`, `035D` and `605E` sign in as other accounts.

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
    - **General**, **Personal** and **Confidential** are listed, with no line under any of them
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
    - **Start date**'s class is an open eye, then **General**
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
    - **End date**'s class is an open eye, then **General**
  - **Notes:**

- [ ] `8F30` Select the **Access history** page in the left-hand menu.
  - **Expected:**
    - The newest entry has a yellow dot before it
    - It reads "Engineering Director changed End date's class: from Personal to General"
    - The entry under it reads "Engineering Director changed Start date's class: from Personal to General"
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

### CLASS-03: Changing a Column's Class Marks Its Heading

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from CLASS-02.

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
    - An eye with a line through it is before **Portfolio** in its heading
    - The eye is centred on the heading's text
  - **Notes:**

- [ ] `9C4E` Point at the eye before **Portfolio**.
  - **Expected:** A tip reads "Personal".
  - **Notes:**

- [ ] `EAD1` Open the column menu of **Site**.
  - **Expected:**
    - **Change class…** is greyed out
    - "This column takes its list's class" is under it
  - **Notes:**

- [ ] `D938` Select the **Data classes** page in the left-hand menu.
  - **Expected:** In the **Columns** section, **Portfolio**'s class is an eye with a line through it, then **Personal**.
  - **Notes:**

**Afterwards:** Run Reset the Database.
