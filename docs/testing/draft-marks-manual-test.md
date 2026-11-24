---
title: "Manual Test: Draft Marks"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/standards/ui-conventions.md", "docs/design/visual-design.md", "docs/design/development-setup.md"]
last_updated: "2026-11-23"
---

# Manual Test: Draft Marks

## Scope

Verifies how drafts are marked on a table, a side panel, the org chart's cards and the Drafts page: dots, boxes, the lock, Live rows and tints, how they sit beside their text, and what each of the three Draft views shows.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Superuser:** `superuser@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms this test uses, such as Mark, Lock, Box, Slot, and Draft row and Live row, with each mark's colour.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### MARK-01: A Table Marks Each Draft in Its Row

**Account:** Superuser, `superuser@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `866B` Type `Vianney Rousseau` in the search box.
  - **Expected:** In the row of 'Vianney Rousseau':
    - A yellow dot in the row's slot
    - No dot before the name or any other value
    - The row faintly yellow
  - **Notes:**

- [ ] `78FC` Point at the yellow dot in the row of 'Vianney Rousseau'.
  - **Expected:** A tip shows words saying what the draft does.
  - **Notes:**

- [ ] `B859` Type `Salvador Quiñones Méndez` in the search box.
  - **Expected:** In the row of 'Salvador Quiñones Méndez':
    - A yellow dot in the slot
    - The row struck through
  - **Notes:**

- [ ] `C825` Type `Ophélie Roussel` in the search box.
  - **Expected:** In the row of 'Ophélie Roussel':
    - A red dot in a ring in the slot
    - The row faintly red
  - **Notes:**

- [ ] `A2FD` Type `西尾 亮` in the search box.
  - **Expected:** In the row of '西尾 亮':
    - Nothing in the slot
    - No dot before the name
    - A yellow dot before **End**, in semibold
    - A yellow dot before **Grade**, in semibold
  - **Notes:**

- [ ] `B6E7` Look at the Live row under the row of '西尾 亮'.
  - **Expected:**
    - The row light green
    - Nothing in its slot
    - A green dot before the live **End**
    - A green dot before the live **Grade**
  - **Notes:**

- [ ] `00CF` Type `Viktoria Holmberg` in the search box.
  - **Expected:** In the row of 'Viktoria Holmberg':
    - The grey lock alone in the slot
    - A yellow dot before each changed value
  - **Notes:**

- [ ] `87D0` Type `우아현` in the search box.
  - **Expected:** In the row of '우아현':
    - Nothing in the slot
    - A red dot in a ring before the **Position** value
    - The **Position** value in semibold
    - **Manager** reads 'Viktoria Holmberg', then a red **Left** box
    - No dot before the **Manager** value
    - The row faintly red
  - **Notes:**

### MARK-02: A Side Panel Marks Drafted Values and Parts

**Account:** Superuser, `superuser@fathom.test`, the same as MARK-01.

**Preconditions:** **People** page open, with 'Simone Jean' typed in the search box.

- [ ] `26DE` Select the details button in the row of 'Simone Jean'.
  - **Expected:** In the side panel's **Manager** row:
    - A yellow dot before 'Silje Holm-Schrøder'
    - Under it, a green dot before 'Viktoria Holmberg', then a red **Left** box
  - **Notes:**

- [ ] `1EE3` Type `Viktoria Holmberg` in the search box.
  - **Expected:** Only the row of 'Viktoria Holmberg' shows.
  - **Notes:**

- [ ] `DFF0` Select the details button in the row of 'Viktoria Holmberg'.
  - **Expected:** In the side panel:
    - Under her name, her position, then a red **Left** box
    - Under **Direct reports**, a yellow dot before 'Simone Jean'
    - 'Simone Jean' struck through
  - **Notes:**

**Afterwards:** Open the **Views** menu above the table and select **Clear view**.

### MARK-03: The Org Chart's Cards Are Marked

**Account:** Superuser, `superuser@fathom.test`, the same as MARK-02.

**Preconditions:** **Org chart** page open from the left-hand menu, with **Reporting teams** chosen in the teams switch.

- [ ] `7F4E` Type `Simone` in the finder.
  - **Expected:** A yellow dot before 'Simone Jean' in the finder's list.
  - **Notes:**

- [ ] `22BC` Choose 'Simone Jean' in the finder's list.
  - **Expected:**
    - Her card under 'Silje Holm-Schrøder': a yellow dot before her name
    - That card faintly yellow
    - Her Live card under 'Viktoria Holmberg': a green dot before her name
    - The card of 'Viktoria Holmberg': her name, then a red **Left** box
  - **Notes:**

- [ ] `2B1C` Choose **Feature teams** in the teams switch.
  - **Expected:**
    - The card titled 'Search and discovery': a yellow dot before the title
    - Under 'Mobile apps', a yellow dot before 'Atmananda Ganaka'
    - Under 'Mobile apps', a yellow dot before 'Priscille Adam'
    - 'Priscille Adam' struck through
    - The card titled 'Platform reliability': the grey lock before the title
  - **Notes:**

**Afterwards:** Choose **Reporting teams** in the teams switch.

### MARK-04: A List's Row and Panel Are Marked

**Account:** Superuser, `superuser@fathom.test`, the same as MARK-03.

**Preconditions:** **Lists** page open from the left-hand menu.

- [ ] `61EF` Type `Languages` in the search box.
  - **Expected:** In the row of 'Languages':
    - A yellow dot in the slot
    - 'Languages', then a yellow **Retired** box
  - **Notes:**

- [ ] `B138` Type `Positions` in the search box.
  - **Expected:** In the row of 'Positions':
    - 'Positions', then a grey **Built in** box
    - A red dot in a ring before the description
  - **Notes:**

- [ ] `30BC` Type `Sites` in the search box.
  - **Expected:**
    - In the row of 'Sites', a yellow dot before its choices
    - Under it, a light green Live row
    - A green dot before the Live row's choices
  - **Notes:**

- [ ] `4A64` Select 'Sites' in its row, not its Live row.
  - **Expected:**
    - The row of 'Sites' has a thin blue bar at its left edge
    - In the panel, 'Harbourside': a red dot in a ring in its slot
    - 'Harbourside': no dot before its name
    - 'Northmere Labs': nothing in its slot
    - 'Northmere Labs': a yellow dot before the name
    - 'Northmere Labs': a yellow dot before the new description
    - Under 'Northmere Labs', a light green Live row
    - In that Live row, a green dot before 'Northmere'
    - In that Live row, a green dot before the live description
  - **Notes:**

### MARK-05: The Drafts Page Marks Each Row in Its Slot Alone

**Account:** Superuser, `superuser@fathom.test`, the same as MARK-04.

**Preconditions:** **Drafts** page open from the left-hand menu, then **All drafts** selected beside the page's title.

- [ ] `41DB` Type `Ophélie Roussel` in the search box.
  - **Expected:** In the row of 'Ophélie Roussel':
    - A red dot in a ring before the name, in the **Record** column
    - The row not tinted, and the name not in semibold
    - The rejection's reason in the **Reason** column
  - **Notes:**

- [ ] `34BF` Type `Viktoria Holmberg` in the search box.
  - **Expected:** In the row of 'Viktoria Holmberg', a yellow dot, then the grey lock, before the name.
  - **Notes:**

- [ ] `6089` Type `Salvador Quiñones Méndez` in the search box.
  - **Expected:** In the row of 'Salvador Quiñones Méndez':
    - A yellow dot before the name
    - The name not struck through
    - No light green Live row under it
  - **Notes:**

### MARK-06: Drafts Applied Shows Dots Without Tints or Live Rows

**Account:** Superuser, `superuser@fathom.test`, the same as MARK-05.

**Preconditions:** **People** page open from the left-hand menu.

- [ ] `CE9E` Choose **Drafts applied** in the Draft menu.
  - **Expected:**
    - Yellow dots still show
    - No red dots in a ring
    - No row or column tinted
    - No value in semibold
    - No Live rows
    - No green dots
  - **Notes:**

- [ ] `FA5C` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart shows the reporting teams.
  - **Notes:**

- [ ] `2E7F` Choose **Drafts applied** in the Draft menu.
  - **Expected:**
    - Yellow dots still show
    - No card tinted
    - No Live cards
    - No green dots
  - **Notes:**

### MARK-07: Live Only Marks What a Waiting Draft Would Change

**Account:** Superuser, `superuser@fathom.test`, the same as MARK-06.

**Preconditions:** **Org chart** page open, with **Reporting teams** chosen in the teams switch.

- [ ] `7BA0` Choose **Live only** in the Draft menu.
  - **Expected:**
    - No yellow dots
    - No red dots in a ring
    - No card tinted
  - **Notes:**

- [ ] `7A48` Type `Simone` in the finder.
  - **Expected:** 'Simone Jean' is in the finder's list.
  - **Notes:**

- [ ] `5ED1` Choose 'Simone Jean' in the finder's list.
  - **Expected:**
    - Her one card is under 'Viktoria Holmberg'
    - A green dot before her name on that card
  - **Notes:**

- [ ] `D892` Select the **People** page in the left-hand menu.
  - **Expected:** The table of people shows.
  - **Notes:**

- [ ] `9D72` Choose **Live only** in the Draft menu.
  - **Expected:**
    - No yellow dots
    - No red dots in a ring
    - No row or column tinted
    - A green dot before **Level** in its column's header
  - **Notes:**

- [ ] `D843` Type `西尾 亮` in the search box.
  - **Expected:** In the row of '西尾 亮':
    - Nothing in the slot
    - A green dot before **End**
    - A green dot before **Level**
  - **Notes:**

- [ ] `B992` Type `우아현` in the search box.
  - **Expected:** In the row of '우아현':
    - No dot
    - **Manager** reads 'Viktoria Holmberg', then a red **Left** box
  - **Notes:**

**Afterwards:** Open the **Views** menu above the table and select **Clear view**.

### MARK-08: Marks Read in Dark Mode

Covered by the [Dark Mode](dark-mode-manual-test.md) manual test.

### MARK-09: Marks Sit on the Centreline of Their Text

**Account:** Superuser, `superuser@fathom.test`, the same as MARK-07.

**Preconditions:** **People** page open from the left-hand menu.

- [ ] `C352` Type `우아현` in the search box.
  - **Expected:**
    - The red dot in a ring is centred on the centreline of the **Position** value's capital letters
    - The red **Left** box is centred on the centreline of the capital letters of 'Viktoria Holmberg'
    - The dot and the box each sit just beside their text, with no extra space
  - **Notes:**

- [ ] `BB21` Type `Viktoria Holmberg` in the search box.
  - **Expected:** The grey lock is centred on the centreline of the name's capital letters.
  - **Notes:**

- [ ] `5F7B` Type `Vianney Rousseau` in the search box.
  - **Expected:** The yellow dot is centred on the centreline of the name's capital letters.
  - **Notes:**

### MARK-10: The Account's Own Unpublished Changes Have Hollow Dots

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from MARK-09.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `2E90` Type `Mariana Metz` in the search box.
  - **Expected:** In the row of 'Mariana Metz':
    - Nothing in the slot
    - A hollow yellow dot before the new **Site**
  - **Notes:**

- [ ] `8EC2` Select the **Lists** page in the left-hand menu.
  - **Expected:** The table of lists shows.
  - **Notes:**

- [ ] `F1E1` Type `Equipment` in the search box.
  - **Expected:** In the row of 'Equipment', a hollow yellow dot in the slot.
  - **Notes:**
