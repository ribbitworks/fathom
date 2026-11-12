---
title: "Manual Test: Draft Marks"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/conventions.md", "docs/design/visual-design.md", "docs/design/development-setup.md"]
last_updated: "2026-11-11"
---

# Manual Test: Draft Marks

## Scope

Verifies how drafts are marked on a table, a side panel, the org chart's cards and the Drafts page: dots, boxes, the lock, Live rows and tints, how they sit beside their text, how they read in light and dark mode, and what each of the three Draft views shows.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Superuser:** `superuser@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms this test uses, such as Mark, Lock, Box, Slot, and Draft row and Live row, with each mark's colour.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Check each step whose expected result you see, and write anything else under its notes.

### MARK-01: A Table Marks Each Draft in Its Row

**Account:** Superuser, `superuser@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Light** chosen in the Appearance menu. **People** page open from the left-hand menu.

- [ ] **Step 1.** Type **Vianney Rousseau** in the search box.
  - **Expected:** In Vianney Rousseau's row:
    - A yellow dot in the row's slot
    - No dot before the name or any other value
    - The row faintly yellow
  - **Notes:**

- [ ] **Step 2.** Point at the yellow dot in Vianney Rousseau's row.
  - **Expected:** A tip shows words saying what the draft does.
  - **Notes:**

- [ ] **Step 3.** Type **Salvador Quiñones Méndez** in the search box.
  - **Expected:** In Salvador Quiñones Méndez's row:
    - A yellow dot in the slot
    - The row struck through
  - **Notes:**

- [ ] **Step 4.** Type **Ophélie Roussel** in the search box.
  - **Expected:** In Ophélie Roussel's row:
    - A red dot in a ring in the slot
    - The row faintly red
  - **Notes:**

- [ ] **Step 5.** Type **西尾 亮** in the search box.
  - **Expected:** In 西尾 亮's row:
    - Nothing in the slot
    - No dot before the name
    - A yellow dot before **End**, in semibold
    - A yellow dot before **Grade**, in semibold
  - **Notes:**

- [ ] **Step 6.** Look at the Live row under 西尾 亮's row.
  - **Expected:**
    - The row light green
    - Nothing in its slot
    - A green dot before the live **End**
    - A green dot before the live **Grade**
  - **Notes:**

- [ ] **Step 7.** Type **Viktoria Holmberg** in the search box.
  - **Expected:** In Viktoria Holmberg's row:
    - The grey lock alone in the slot
    - A yellow dot before each changed value
  - **Notes:**

- [ ] **Step 8.** Type **우아현** in the search box.
  - **Expected:** In 우아현's row:
    - Nothing in the slot
    - A red dot in a ring before the **Position** value, which is in semibold
    - **Manager:** **Viktoria Holmberg**, then a red **Left** box, with no dot
    - The row faintly red
  - **Notes:**

### MARK-02: A Side Panel Marks Drafted Values and Parts

**Account:** Superuser, `superuser@fathom.test`, the same as MARK-01.

**Preconditions:** **People** page open, with **Simone Jean** typed in the search box.

- [ ] **Step 1.** Select the details button in Simone Jean's row.
  - **Expected:** In the side panel's **Manager** row:
    - A yellow dot before **Silje Holm-Schrøder**
    - Under it, a green dot before **Viktoria Holmberg**, then a red **Left** box
  - **Notes:**

- [ ] **Step 2.** Type **Viktoria Holmberg** in the search box.
  - **Expected:** Only Viktoria Holmberg's row shows.
  - **Notes:**

- [ ] **Step 3.** Select the details button in Viktoria Holmberg's row.
  - **Expected:** In the side panel:
    - Under her name, her position, then a red **Left** box
    - Under **Direct reports**, a yellow dot before **Simone Jean**
    - **Simone Jean** struck through
  - **Notes:**

### MARK-03: The Org Chart's Cards Are Marked

**Account:** Superuser, `superuser@fathom.test`, the same as MARK-02.

**Preconditions:** **Org chart** page open from the left-hand menu, with **Reporting teams** chosen in the teams switch.

- [ ] **Step 1.** Type **Simone** in the finder.
  - **Expected:** A yellow dot before **Simone Jean** in the finder's list.
  - **Notes:**

- [ ] **Step 2.** Choose **Simone Jean** in the finder's list.
  - **Expected:**
    - Her card under Silje Holm-Schrøder: a yellow dot before her name
    - That card faintly yellow
    - Her Live card under Viktoria Holmberg: a green dot before her name
    - Viktoria Holmberg's card: her name, then a red **Left** box
  - **Notes:**

- [ ] **Step 3.** Choose **Feature teams** in the teams switch.
  - **Expected:**
    - The card titled **Search and discovery**: a yellow dot before the title
    - Under **Mobile apps**, a yellow dot before **Atmananda Ganaka**
    - Under **Mobile apps**, a yellow dot before **Priscille Adam**, her name struck through
    - The card titled **Platform reliability**: the grey lock before the title
  - **Notes:**

### MARK-04: A List's Row and Panel Are Marked

**Account:** Superuser, `superuser@fathom.test`, the same as MARK-03.

**Preconditions:** **Lists** page open from the left-hand menu.

- [ ] **Step 1.** Type **Languages** in the search box.
  - **Expected:** In Languages' row:
    - A yellow dot in the slot
    - **Languages**, then a yellow **Retired** box
  - **Notes:**

- [ ] **Step 2.** Type **Positions** in the search box.
  - **Expected:** In Positions' row:
    - **Positions**, then a grey **Built in** box
    - A red dot in a ring before the description
  - **Notes:**

- [ ] **Step 3.** Type **Sites** in the search box.
  - **Expected:**
    - In Sites' row, a yellow dot before its choices
    - Under it, a light green Live row with a green dot before its choices
  - **Notes:**

- [ ] **Step 4.** Select **Sites** in its row, not its Live row.
  - **Expected:**
    - Sites' row has a thin blue bar at its left edge
    - In the panel, **Harbourside**: a red dot in a ring in its slot, and no dot before its name
    - **Northmere Labs**: nothing in its slot, and a yellow dot before the name and before the new description
    - Under Northmere Labs, a light green Live row: a green dot before **Northmere** and before the live description
  - **Notes:**

### MARK-05: The Drafts Page Starts Each Entry With Its Mark

**Account:** Superuser, `superuser@fathom.test`, the same as MARK-04.

**Preconditions:** **Drafts** page open from the left-hand menu.

- [ ] **Step 1.** Type **Ophélie Roussel** in the search box.
  - **Expected:** In Ophélie Roussel's entry:
    - A red dot in a ring before the sentence
    - The **Reason:** line under the sentence
  - **Notes:**

- [ ] **Step 2.** Type **Viktoria Holmberg** in the search box.
  - **Expected:** In Viktoria Holmberg's entry, a yellow dot, then the grey lock, before the sentence.
  - **Notes:**

### MARK-06: Drafts Applied Shows Dots Without Tints or Live Rows

**Account:** Superuser, `superuser@fathom.test`, the same as MARK-05.

**Preconditions:** **People** page open from the left-hand menu.

- [ ] **Step 1.** Choose **Drafts applied** in the Draft menu.
  - **Expected:**
    - Yellow dots still show
    - No red dots in a ring
    - No row or column tinted
    - No value in semibold
    - No Live rows and no green dots
  - **Notes:**

- [ ] **Step 2.** Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart shows the reporting teams.
  - **Notes:**

- [ ] **Step 3.** Choose **Drafts applied** in the Draft menu.
  - **Expected:**
    - Yellow dots still show
    - No card tinted
    - No Live cards and no green dots
  - **Notes:**

### MARK-07: Live Only Marks What a Waiting Draft Would Change

**Account:** Superuser, `superuser@fathom.test`, the same as MARK-06.

**Preconditions:** **Org chart** page open, with **Reporting teams** chosen in the teams switch.

- [ ] **Step 1.** Choose **Live only** in the Draft menu.
  - **Expected:**
    - No yellow dots and no red dots in a ring
    - No card tinted
  - **Notes:**

- [ ] **Step 2.** Type **Simone** in the finder.
  - **Expected:** **Simone Jean** is in the finder's list.
  - **Notes:**

- [ ] **Step 3.** Choose **Simone Jean** in the finder's list.
  - **Expected:**
    - Her one card is under Viktoria Holmberg
    - A green dot before her name on that card
  - **Notes:**

- [ ] **Step 4.** Select the **People** page in the left-hand menu.
  - **Expected:** The table of people shows.
  - **Notes:**

- [ ] **Step 5.** Choose **Live only** in the Draft menu.
  - **Expected:**
    - No yellow dots and no red dots in a ring
    - No row or column tinted
    - A green dot before **Level** in its column's header
  - **Notes:**

- [ ] **Step 6.** Type **西尾 亮** in the search box.
  - **Expected:** In 西尾 亮's row:
    - Nothing in the slot
    - A green dot before **End**
    - A green dot before **Level**
  - **Notes:**

- [ ] **Step 7.** Type **우아현** in the search box.
  - **Expected:** In 우아현's row:
    - No dot
    - **Manager:** **Viktoria Holmberg**, then a red **Left** box
  - **Notes:**

### MARK-08: Marks Read in Dark Mode

**Account:** Superuser, `superuser@fathom.test`, the same as MARK-07.

**Preconditions:** **People** page open from the left-hand menu.

- [ ] **Step 1.** Choose **Dark** in the Appearance menu.
  - **Expected:** The page turns dark.
  - **Notes:**

- [ ] **Step 2.** Type **Vianney Rousseau** in the search box.
  - **Expected:**
    - The yellow dot is easy to see
    - The faintly yellow row is told apart from the page
    - Every value in the row is easy to read
  - **Notes:**

- [ ] **Step 3.** Type **Ophélie Roussel** in the search box.
  - **Expected:**
    - The red dot's ring is easy to see
    - The faintly red row is told apart from the page
    - Every value in the row is easy to read
  - **Notes:**

- [ ] **Step 4.** Type **西尾 亮** in the search box.
  - **Expected:**
    - The yellow dots and green dots are easy to see
    - The semibold values are easy to read
    - The light green Live row is told apart from the row above it
    - Every value in the Live row is easy to read
  - **Notes:**

- [ ] **Step 5.** Type **우아현** in the search box.
  - **Expected:** The red **Left** box and its word are easy to read.
  - **Notes:**

- [ ] **Step 6.** Type **Viktoria Holmberg** in the search box.
  - **Expected:** The grey lock is easy to see.
  - **Notes:**

- [ ] **Step 7.** Choose **Light** in the Appearance menu.
  - **Expected:** The page turns light.
  - **Notes:**

### MARK-09: Marks Sit on the Centreline of Their Text

**Account:** Superuser, `superuser@fathom.test`, the same as MARK-08.

**Preconditions:** **People** page open from the left-hand menu.

- [ ] **Step 1.** Type **우아현** in the search box.
  - **Expected:**
    - The red dot in a ring is centred on the centreline of the **Position** value's capital letters
    - The red **Left** box is centred on the centreline of **Viktoria Holmberg**'s capital letters
    - The dot and the box each sit just beside their text, with no extra space
  - **Notes:**

- [ ] **Step 2.** Type **Viktoria Holmberg** in the search box.
  - **Expected:** The grey lock is centred on the centreline of the name's capital letters.
  - **Notes:**

- [ ] **Step 3.** Type **Vianney Rousseau** in the search box.
  - **Expected:** The yellow dot is centred on the centreline of the name's capital letters.
  - **Notes:**

### MARK-10: The Account's Own Unpublished Changes Have Hollow Dots

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from MARK-09.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] **Step 1.** Type **Mariana Metz** in the search box.
  - **Expected:** In Mariana Metz's row:
    - Nothing in the slot
    - A hollow yellow dot before the new **Site**
  - **Notes:**

- [ ] **Step 2.** Select the **Lists** page in the left-hand menu.
  - **Expected:** The table of lists shows.
  - **Notes:**

- [ ] **Step 3.** Type **Equipment** in the search box.
  - **Expected:** In Equipment's row, a hollow yellow dot in the slot.
  - **Notes:**
