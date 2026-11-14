---
title: "Manual Test: Features Board"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/conventions.md"]
last_updated: "2026-11-14"
---

# Manual Test: Features Board

## Scope

Verifies the Board on the Features page: switching between the table and the board, the columns of one release stream's cycles and Later, the cards and the Card menu, the strip and the Stream menu, rows from the Group by menu, and how search, drafts, a feature's details and the keyboard work on the board. The table itself is verified in [Features](features-manual-test.md).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out. A browser window at least 1,200 pixels wide, so the board shows several columns.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Product Manager:** `product.manager@fathom.test`
- **Feature Lead:** `feature.lead@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks, boxes, the Group by menu and seeded dates. This test adds:

- **Table and Board switch:** the two-part switch reading **Table** and **Board** just after the **Features** heading, on the same line.
- **Board:** the panel of columns and cards shown once **Board** is chosen.
- **Column heading:** the top of each column of the board, naming its cycle, or **Later**.
- **Card:** the box for one feature on the board.
- **Strip:** the row of cycle names above the board, after the **Stream** and **Card** buttons, between a **‹** button and the **›** and **Today** buttons.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### BOARD-01: The Board Shows One Stream's Cycles

**Account:** Product Manager, `product.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account.

- [ ] `F9C1` Select the **Features** page in the left-hand menu.
  - **Expected:**
    - Just after the **Features** heading, on the same line, the Table and Board switch reads **Table** and **Board**, with **Table** chosen.
    - The table of features shows.
  - **Notes:**

- [ ] `D5B7` Select **Board** in the Table and Board switch.
  - **Expected:**
    - The bar above the board holds the search box, **Draft**, **Metrics** and **Group by: None**.
    - Under it, one row starts with the buttons **Stream: Platform** and **Card**, then the strip.
    - The board's columns run from left to right, the last headed "Later".
  - **Notes:**

- [ ] `F45E` Read the first column heading.
  - **Expected:**
    - At its top, a yellow dot is before "Harbor 2 LTS" in a teal box.
    - Under it, the cycle is named, such as "Cycle 26.4".
    - Under that, in grey, its first and last days read, such as "1 Oct 2026 to 31 Dec 2026", and today falls between them.
    - A red line runs along the heading's top edge.
  - **Notes:**

- [ ] `E3C1` Point at the yellow dot before "Harbor 2 LTS".
  - **Expected:** A tip reads "Draft: changed from “Harbor 2”".
  - **Notes:**

- [ ] `D480` Read the second column heading.
  - **Expected:**
    - At its top, a green dot is before "Harbor 3" in a grey box, dimmed.
    - Under it, the next cycle is named.
    - Under that, in grey, its first and last days read.
    - No red line is along its top edge.
  - **Notes:**

- [ ] `69B1` Read the third column heading.
  - **Expected:**
    - At its top, a yellow dot is before "Harbor 3" in a grey box, with a yellow **Moved** box after it.
    - No dimmed release is under it.
  - **Notes:**

- [ ] `B09B` Read the column headed **Later**.
  - **Expected:**
    - The heading has no box and no days.
    - The column is a shade darker than the others.
    - It holds the cards 'Partner Portal', 'Voice Notes' and 'Shift Handover Notes'.
  - **Notes:**

- [ ] `129B` Read the strip.
  - **Expected:**
    - It names each of Platform's cycles, from the earliest on the left.
    - The cycles shown as columns are tinted.
    - The current cycle, the first column's, is underlined in red, the same red as the line along the top of its column's heading.
  - **Notes:**

- [ ] `3C2E` Reload the page.
  - **Expected:** The board shows as it did.
  - **Notes:**

- [ ] `8882` Select **Table** in the Table and Board switch.
  - **Expected:** The table of features shows, grouped by "Cycle".
  - **Notes:**

- [ ] `179C` Press the browser's Back button.
  - **Expected:** The board shows again.
  - **Notes:**

### BOARD-02: Cards Show What the Card Menu Chooses

**Account:** Product Manager, `product.manager@fathom.test`, the account BOARD-01 ended with.

**Preconditions:** **Features** page open, showing the board.

- [ ] `285F` Read the cards in the first column, from the top.
  - **Expected:**
    - 'Offline Sync' is first, then 'Usage Alerts'.
  - **Notes:**

- [ ] `2BCB` Read the card 'Offline Sync', from the top.
  - **Expected:**
    - Its name, "Offline Sync".
    - "In progress · Critical priority".
    - The word "Size", then three blue-grey blocks, from light to dark, filling three quarters of the line.
    - The word "Risk", then three short bars, green, then orange, then red, filling the line, lined up under the size's blocks.
    - "Needed by" and a month.
  - **Notes:**

- [ ] `235A` Point at the blocks after **Size** on 'Offline Sync'.
  - **Expected:** A tip reads "L, 3 × S".
  - **Notes:**

- [ ] `4802` Point at the bars after **Risk** on 'Offline Sync'.
  - **Expected:** A tip reads "High".
  - **Notes:**

- [ ] `C157` Read the card 'Scheduler API' in the second column.
  - **Expected:**
    - "Planned · Medium priority" is under its name.
    - At its foot, "Not staffed" is in a red box.
  - **Notes:**

- [ ] `883E` Find the card 'Report Builder', selecting **›** in the strip if it isn't shown.
  - **Expected:**
    - Its status, "Possible", is in italics.
    - Its card has no "Not staffed" box.
  - **Notes:**

- [ ] `6582` Select **Card**.
  - **Expected:**
    - A menu lists, from the top:
      - **Status**
      - **Priority**
      - **Size**
      - **Risk**
      - **Needed by**
      - **Staffed months**
    - Each is ticked.
  - **Notes:**

- [ ] `0BC4` Select **Risk**.
  - **Expected:**
    - The menu stays open, with **Risk** no longer ticked.
    - No card shows the word "Risk".
  - **Notes:**

- [ ] `037A` Select **Staffed months**, then press Esc.
  - **Expected:**
    - The menu closes.
    - No card shows "Not staffed".
  - **Notes:**

- [ ] `B1F6` Reload the page.
  - **Expected:**
    - The board shows.
    - No card shows the word "Risk" or "Not staffed".
  - **Notes:**

- [ ] `DA72` Select **Card**, then **Risk**.
  - **Expected:** The cards show their risk again.
  - **Notes:**

- [ ] `528D` Select **Staffed months**.
  - **Expected:** 'Scheduler API' shows "Not staffed" again.
  - **Notes:**

- [ ] `20D6` Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

### BOARD-03: The Strip and the Stream Menu Choose the Columns

**Account:** Product Manager, `product.manager@fathom.test`, the account BOARD-02 ended with.

**Preconditions:** **Features** page open, showing the board from the current cycle, with **Drafts beside live** chosen in the Draft menu; select **Today** in the strip if it doesn't show the current cycle first.

- [ ] `72C8` Select **›** in the strip.
  - **Expected:**
    - The first column is the next cycle, headed "Harbor 3".
    - In the strip, that cycle is filled with blue.
    - The last column is still "Later".
  - **Notes:**

- [ ] `B660` Select **‹** in the strip twice.
  - **Expected:**
    - The first column is the cycle before the current one, headed "Harbor 2".
    - It holds the cards 'Single Sign-On Setup' and 'Bulk Import'.
  - **Notes:**

- [ ] `E492` Select the first cycle in the strip.
  - **Expected:**
    - The first column is that cycle, headed "Harbor 1".
    - It holds no card.
    - The **‹** button is turned off.
  - **Notes:**

- [ ] `0191` Press the browser's Back button.
  - **Expected:** The first column is again the cycle before the current one.
  - **Notes:**

- [ ] `21F1` Select **Today**.
  - **Expected:**
    - The first column is the current cycle, with the red line along its heading's top.
    - No cycle in the strip is filled with blue.
  - **Notes:**

- [ ] `8C55` Select **Stream: Platform**.
  - **Expected:**
    - A menu headed "Release stream" lists **Platform** and **Patches**.
    - **Platform** is ticked.
    - **Patches** has a yellow dot before it and a yellow **Retired** box after it.
  - **Notes:**

- [ ] `A0DA` Select **Patches**.
  - **Expected:**
    - The button reads **Stream: Patches**.
    - The columns are Patches' cycles from the current one, named such as "Cycle P26.13", each four weeks long.
    - The first two columns are each headed with the same patch release, such as "Patch Dec", in a red box, after a red dot in a ring.
    - No column other than "Later" holds a card.
    - "Later" holds 'Partner Portal', 'Voice Notes' and 'Shift Handover Notes'.
  - **Notes:**

**Afterwards:** Select **Stream: Patches**, then **Platform**.

### BOARD-04: Group By Puts the Cards in Rows

**Account:** Product Manager, `product.manager@fathom.test`, the account BOARD-03 ended with.

**Preconditions:** **Features** page open, showing Platform's board from the current cycle.

- [ ] `2F2F` Select **Group by: None**.
  - **Expected:**
    - The menu lists, from the top:
      - **None**, ticked
      - **Release**
      - **Needed by**
      - **Status**
      - **Priority**
      - **Size**
      - **Risk**
      - **Feature team**
      - **Kind**
    - **Cycle** isn't listed.
  - **Notes:**

- [ ] `8092` Select **Feature team**.
  - **Expected:**
    - A row label at the left of the board names each feature team that has a feature, with how many features it holds after it.
    - The last row is "No feature team".
    - Each card is in its feature team's row, under its cycle.
  - **Notes:**

- [ ] `A791` Look at 'Scheduler API'.
  - **Expected:** It is in the row "No feature team", in the second column.
  - **Notes:**

- [ ] `63AD` Select **Table** in the Table and Board switch.
  - **Expected:**
    - The table shows **Group by: Feature team**.
    - Its group headings name the feature teams.
  - **Notes:**

- [ ] `52C1` Select **Board** in the Table and Board switch.
  - **Expected:** The board shows its rows by feature team.
  - **Notes:**

- [ ] `135A` Select **Group by: Feature team**, then **Priority**.
  - **Expected:**
    - The rows read, from the top, "Critical", "High", "Medium" and "Low".
    - 'Offline Sync' is in the row "Critical".
  - **Notes:**

**Afterwards:** Select **Group by: Priority**, then **None**.

### BOARD-05: Search, Details and the Keyboard Work on the Board

**Account:** Product Manager, `product.manager@fathom.test`, the account BOARD-04 ended with.

**Preconditions:** **Features** page open, showing Platform's board from the current cycle, with no rows.

- [ ] `8A3D` Type `offline` in the search box.
  - **Expected:**
    - Only the card 'Offline Sync' shows.
    - Beside the search box, the count reads "1 of 12".
  - **Notes:**

- [ ] `A605` Empty the search box, then select the card 'Offline Sync'.
  - **Expected:**
    - The side panel opens, headed "Offline Sync".
    - The card has a grey background with a blue bar at its left edge.
  - **Notes:**

- [ ] `3E98` Press Esc.
  - **Expected:**
    - The side panel closes.
    - The card 'Offline Sync' has the focus ring.
  - **Notes:**

- [ ] `36F2` Press the Down arrow.
  - **Expected:** The focus ring moves to 'Usage Alerts'.
  - **Notes:**

- [ ] `861B` Press the Right arrow.
  - **Expected:** The focus ring moves to a card in the second column.
  - **Notes:**

- [ ] `752E` Press Enter.
  - **Expected:** The side panel opens, headed with that card's name.
  - **Notes:**

- [ ] `9603` Press Esc.
  - **Expected:**
    - The side panel closes.
    - The card has the focus ring.
  - **Notes:**

- [ ] `7C54` Press Tab.
  - **Expected:** The focus leaves the board, on to the browser's own controls, such as its address bar.
  - **Notes:**

### BOARD-06: Drafts Show on the Cards

**Account:** Product Manager, `product.manager@fathom.test`, the account BOARD-05 ended with.

**Preconditions:** **Features** page open, showing Platform's board from the current cycle, with no rows.

- [ ] `5EAD` Look at the card 'Shift Handover Notes' in **Later**.
  - **Expected:**
    - A yellow dot is before its name.
    - The card is tinted faint yellow.
  - **Notes:**

- [ ] `FB2D` Select **Table** in the Table and Board switch.
  - **Expected:** The table of features shows.
  - **Notes:**

- [ ] `5229` Choose, in the **Target cycle** cell of 'Scheduler API', the cycle after the one it holds.
  - **Expected:** The cell shows the cycle chosen, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `B431` Select **Board** in the Table and Board switch.
  - **Expected:**
    - 'Scheduler API' is in the third column, with a hollow yellow dot before its name and a yellow **Moved** box after it.
    - The card is tinted faint yellow.
    - In the second column, a dimmed card 'Scheduler API' has a green dot before its name.
  - **Notes:**

- [ ] `FB10` Select **Draft**, then **Live only**.
  - **Expected:**
    - 'Scheduler API' is in the second column, with a green dot before its name.
    - No card is in the third column under that name.
    - 'Shift Handover Notes' isn't shown.
  - **Notes:**

**Afterwards:** Select **Draft**, then **Drafts beside live**, and run Discard the Unpublished Changes.

### BOARD-07: A Role That Doesn't See Allocations Still Sees Not Staffed

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from BOARD-06.

**Preconditions:** Signed in with this account. **Features** page open from the left-hand menu.

- [ ] `C5FB` Select **Board** in the Table and Board switch.
  - **Expected:**
    - The board shows Platform's cycles from the current one.
    - 'Scheduler API' shows "Not staffed" in a red box.
  - **Notes:**

- [ ] `F21A` Select **Card**.
  - **Expected:** The menu lists **Status**, **Priority**, **Size**, **Risk**, **Needed by** and **Staffed months**, each ticked.
  - **Notes:**

**Afterwards:** Press Esc.
