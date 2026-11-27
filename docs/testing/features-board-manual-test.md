---
title: "Manual Test: Features Board"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/features.md", "docs/standards/ui-conventions.md"]
last_updated: "2026-11-27"
---

# Manual Test: Features Board

## Scope

Verifies the Board on the Features page:

- Switching between the table and the board.
- The columns of months and No date, or of one schedule's cycles and Later.
- The cards and the Card menu, the strip and the Columns menu.
- Rows from the Group by menu, with a card in each row of a feature under several values.
- How search, drafts, a feature's details and the keyboard work on the board, and done and cancelled features.

The table itself is verified in [Features](features-manual-test.md), and a card's key and ⋯ menu in [Record Keys](record-keys-manual-test.md).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out. A browser window at least 1,200 pixels wide, so the board shows several columns.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Product Manager:** `product.manager@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks, locks, boxes, the Group by menu and seeded dates. This test adds:

- **Table and Board switch:** the two-part switch reading **Table** and **Board** just after the **Features** heading, on the same line.
- **Board:** the panel of columns and cards shown once **Board** is chosen.
- **Column heading:** the top of each column of the board, naming its month or cycle, or **No date** or **Later**.
- **Card:** the box for one feature on the board.
- **Strip:** the row of quarter or cycle names above the board, after the **Columns** and **Card** buttons, between a **‹** button and the **›** and **Today** buttons.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### BOARD-01: The Board Shows Months, Then One Schedule's Cycles

**Account:** Product Manager, `product.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account.

- [ ] `F9C1` Select the **Features** page in the left-hand menu.
  - **Expected:**
    - Just after the **Features** heading, on the same line, the Table and Board switch reads **Table** and **Board**, with **Table** chosen.
    - The table of features shows.
  - **Notes:**

- [ ] `D5B7` Select **Board** in the Table and Board switch.
  - **Expected:**
    - The bar above the board holds the search box, **Draft**, **Metrics**, **Group by** and **Views**.
    - Under it, one row starts with the buttons **Columns: Months** and **Card**, then the strip.
    - The board's columns are months, from left to right, the first headed the month before this one and the second headed this month, such as "Oct 2026" and "Nov 2026", and the last "No date".
    - A red line runs along the bottom of this month's heading.
  - **Notes:**

- [ ] `5D2A` Select **Columns: Months**, then **Platform** under **A schedule's cycles**.
  - **Expected:**
    - The button reads **Columns: Platform cycles**.
    - The board's columns are Platform's cycles, from left to right, the last headed "Later".
  - **Notes:**

- [ ] `F45E` Read the second column heading.
  - **Expected:**
    - At its top, a yellow dot, then a teal square and "Harbor 2 LTS".
    - Under it, the cycle is named, such as "Cycle 26.4".
    - Under that, in grey, its first and last days read, such as "1 Oct 2026 to 31 Dec 2026", and today falls between them.
    - A red line runs along the heading's bottom edge.
  - **Notes:**

- [ ] `D480` Read the third column heading.
  - **Expected:**
    - At its top, dimmed, a green dot, then Harbor 3's colour square and "Harbor 3".
    - Under it, the next cycle is named.
    - Under that, in grey, its first and last days read.
    - No red line is along its bottom edge.
  - **Notes:**

- [ ] `69B1` Read the fourth column heading.
  - **Expected:**
    - At its top, a yellow dot, then Harbor 3's colour square and "Harbor 3", with a yellow **Moved** box after it.
    - No dimmed release is under it.
  - **Notes:**

- [ ] `B09B` Read the column headed **Later**.
  - **Expected:**
    - The heading has no release and no days.
    - The column is a shade darker than the others.
    - It holds the cards 'Partner Portal', 'Voice Notes' and 'Shift Handover Notes'.
  - **Notes:**

### BOARD-02: Cards Show What the Card Menu Chooses

**Account:** Product Manager, `product.manager@fathom.test`, the account BOARD-01 ended with.

**Preconditions:** **Features** page open, showing Platform's board from the current cycle.

- [ ] `2BCB` Read the card 'Offline Sync', from the top.
  - **Expected:**
    - Its name, "Offline Sync".
    - Its key, small and grey, "#FEATURE-" and a number.
    - "In progress · Critical priority".
    - The word "Size", then three blue-grey blocks, from light to dark, filling three quarters of the line.
    - The word "Risk", then three short bars, green, then orange, then red, filling the line, lined up under the size's blocks.
    - "Needed by" and a month.
  - **Notes:**

- [ ] `235A` Point at the blocks after **Size** on 'Offline Sync'.
  - **Expected:** A tip reads "L, 3 × S".
  - **Notes:**

- [ ] `C157` Read the card 'Scheduler API' in the third column.
  - **Expected:**
    - "Planned · Medium priority" is under its key.
    - At its foot, "Not staffed" is in red words, with no box.
  - **Notes:**

- [ ] `6582` Select **Card**.
  - **Expected:**
    - A menu lists, from the top:
      - **Key**
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

**Afterwards:** Select **Card**, then **Risk** and **Staffed months**, and press Esc.

### BOARD-03: The Strip and the Columns Menu Choose the Columns

**Account:** Product Manager, `product.manager@fathom.test`, the account BOARD-02 ended with.

**Preconditions:** **Features** page open, showing Platform's board from the current cycle, with **Drafts & Live** chosen in the Draft menu; select **Today** in the strip if it doesn't show the current cycle second.

- [ ] `72C8` Select **›** in the strip.
  - **Expected:**
    - The first column is the current cycle.
    - The second column is the next cycle, headed, dimmed, by a green dot and "Harbor 3".
    - In the strip, that cycle is filled with blue.
    - The last column is still "Later".
  - **Notes:**

- [ ] `B660` Select **‹** in the strip twice.
  - **Expected:**
    - The second column is the cycle before the current one, headed "Harbor 2 LTS".
    - It holds no card.
  - **Notes:**

- [ ] `21F1` Select **Today**.
  - **Expected:**
    - The first column is the cycle before the current one, and the second is the current cycle, with the red line along its heading's bottom.
    - In the strip, the current cycle is filled with blue.
  - **Notes:**

- [ ] `8C55` Select **Columns: Platform cycles**.
  - **Expected:**
    - Under the heading "Months", the menu lists, from the top, **All schedules**, **Platform**, **Patches** and **Field Apps**.
    - Under the heading "A schedule's cycles", it lists **Platform**, **Patches** and **Field Apps**.
    - **Platform** under "A schedule's cycles" is ticked.
    - Each **Platform** has a grey lock before it.
    - Each **Patches** has a yellow dot before it and a yellow **Retired** box after it.
    - Every name starts in line with the others.
  - **Notes:**

- [ ] `A0DA` Select **Patches** under **A schedule's cycles**.
  - **Expected:**
    - The button reads **Columns: Patches cycles**.
    - The columns are Patches' cycles, the current one second, named such as "Cycle P26.13", each four weeks long.
    - The second and third columns are each headed with the same patch release: a red dot in a ring, then a red square and its name, such as "Patch Dec".
    - No column other than "Later" holds a card.
    - "Later" holds 'Partner Portal', 'Voice Notes' and 'Shift Handover Notes'.
  - **Notes:**

- [ ] `C87D` Select **Columns: Patches cycles**, then **Field Apps** under **A schedule's cycles**.
  - **Expected:**
    - The button reads **Columns: Field Apps cycles**.
    - The columns are Field Apps' cycles, named such as "Cycle FA26.2", each six months long.
    - The current cycle's column, the second, with the red line along its heading's bottom, is headed with an indigo square and "Lantern 2".
    - The column after it has no release at its top.
    - That column holds the card 'Work Order Sync', with no "Not staffed".
  - **Notes:**

**Afterwards:** Select **Columns: Field Apps cycles**, then **Platform** under **A schedule's cycles**.

### BOARD-04: Group By Puts the Cards in Rows

**Account:** Product Manager, `product.manager@fathom.test`, the account BOARD-03 ended with.

**Preconditions:** **Features** page open, showing Platform's board from the current cycle, with **Drafts & Live** chosen in the Draft menu.

- [ ] `8092` Select **Group by**, then **Feature team**.
  - **Expected:**
    - A row label at the left of the board names each feature team that has a feature, after its colour's square, with how many features it holds after it.
    - The last row is "No feature team".
    - Each card is in its feature team's row, under its cycle.
  - **Notes:**

- [ ] `4E7B` Select **Group by: Feature team**, then **Projects**.
  - **Expected:**
    - Rows "Clinic Booking Rollout" and "P-2001 Crane Control" each hold a card 'Offline Sync'.
    - Each 'Offline Sync' card has a grey "+1" after its name.
    - The last row is "No projects".
  - **Notes:**

- [ ] `B19C` Point at the "+1" on the card 'Offline Sync' in the row "Clinic Booking Rollout".
  - **Expected:** A tip reads "Also under P-2001 Crane Control".
  - **Notes:**

- [ ] `D2A6` Select that card, then press Esc.
  - **Expected:**
    - The side panel opens, headed "Offline Sync", then closes.
    - The card 'Offline Sync' in the row "Clinic Booking Rollout" has the keyboard focus.
  - **Notes:**

- [ ] `7C51` Press the Down arrow until the focus leaves the row "Clinic Booking Rollout".
  - **Expected:** The focus reaches the next card down the column, through the rows below, including the card 'Offline Sync' in the row "P-2001 Crane Control".
  - **Notes:**

**Afterwards:** Select **Group by: Projects**, then **None**.

### BOARD-05: Search, Details and the Keyboard Work on the Board

**Account:** Product Manager, `product.manager@fathom.test`, the account BOARD-04 ended with.

**Preconditions:** **Features** page open, showing Platform's board from the current cycle, with no rows, with **Drafts & Live** chosen in the Draft menu.

- [ ] `8A3D` Search for `offline sync`.
  - **Expected:**
    - Only the card 'Offline Sync' shows.
    - After **Views**, the count reads "1 of 16".
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
  - **Expected:** The focus ring moves to a card in the third column.
  - **Notes:**

- [ ] `752E` Press Enter.
  - **Expected:** The side panel opens, headed with that card's name.
  - **Notes:**

- [ ] `7C54` Press Tab.
  - **Expected:** The focus leaves the board, on to the browser's own controls, such as its address bar.
  - **Notes:**

### BOARD-06: Drafts Show on the Cards

**Account:** Product Manager, `product.manager@fathom.test`, the account BOARD-05 ended with.

**Preconditions:** **Features** page open, showing Platform's board from the current cycle, with no rows, with **Drafts & Live** chosen in the Draft menu.

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
    - 'Scheduler API' is in the fourth column, with a hollow yellow dot before its name and a yellow **Moved** box after it.
    - The card is tinted faint yellow.
    - In the third column, a dimmed card 'Scheduler API' has a green dot before its name.
  - **Notes:**

- [ ] `FB10` Select **Draft**, then **Live only**.
  - **Expected:**
    - 'Scheduler API' is in the third column, with a green dot before its name.
    - No card is in the fourth column under that name.
    - 'Shift Handover Notes' isn't shown.
  - **Notes:**

**Afterwards:** Select **Draft**, then **Drafts & Live**, and run Discard the Unpublished Changes.

### BOARD-07: A Role That Doesn't See Allocations Still Sees Not Staffed

Proved by automated tests in `apps/server/src/allocations-reading.test.ts` and `apps/web/src/feature-card.test.tsx`.

### BOARD-08: The Board Leaves Out Then By

Proved by automated tests in `apps/web/src/feature-board-view.test.tsx`.

### BOARD-09: Months Step by Quarter

**Account:** Product Manager, `product.manager@fathom.test`, the account BOARD-06 ended with.

**Preconditions:** **Features** page open, showing Platform's board, with **Drafts & Live** chosen in the Draft menu. Here, "this month" is the month the tester runs the test in.

- [ ] `9B41` Select **Columns: Platform cycles**, then **All schedules** under **Months**.
  - **Expected:**
    - The button reads **Columns: Months**.
    - The first column is headed the month before this one, and the second is headed this month.
    - A red line runs along the bottom of this month's heading.
  - **Notes:**

- [ ] `B3D8` Read the strip.
  - **Expected:**
    - It names quarters, such as "Q4 2026", each as wide as its months on the board, the first and last cut short.
    - The quarters holding the months shown as columns are tinted.
    - The quarter holding this month is underlined in red.
    - The quarter holding this month is filled with blue.
  - **Notes:**

- [ ] `4E1A` Select the quarter after the one holding this month in the strip.
  - **Expected:**
    - The second column is the first month of that quarter.
    - The first column is the month before it.
    - That quarter is filled with blue.
    - The quarter holding this month is still underlined in red.
  - **Notes:**

- [ ] `6AD2` Select **›** in the strip.
  - **Expected:**
    - The second column is the first month of the quarter after.
    - That quarter is filled with blue.
    - The last column is still "No date".
  - **Notes:**

- [ ] `7F30` Select the quarter holding the month four months after this one in the strip.
  - **Expected:** The columns headed the month three months after this one and the month four months after it are both shown.
  - **Notes:**

- [ ] `D96B` Read the card 'Mobile Approvals' in the column headed the month four months after this one.
  - **Expected:**
    - A yellow dot is before **Needed by** on the card.
    - The card is tinted faint yellow.
  - **Notes:**

- [ ] `38C4` Read the card 'Mobile Approvals' in the column headed the month three months after this one.
  - **Expected:**
    - The card is dimmed.
    - A green dot is before its name.
  - **Notes:**

**Afterwards:** Select **Today**.

### BOARD-10: Months of One Schedule

**Account:** Product Manager, `product.manager@fathom.test`, the account BOARD-09 ended with.

**Preconditions:** **Features** page open, showing the board by months, with **Drafts & Live** chosen in the Draft menu.

- [ ] `C307` Select **Columns: Months**, then **Field Apps** under **Months**.
  - **Expected:**
    - The button reads **Columns: Months, Field Apps**.
    - The columns are still months.
    - The strip names quarters.
    - The card 'Work Order Sync' is on the board.
    - The card 'Offline Sync' isn't on the board.
  - **Notes:**

**Afterwards:** Select **Columns: Months, Field Apps**, then **All schedules** under **Months**.

### BOARD-11: Done and Cancelled Features

**Account:** Product Manager, `product.manager@fathom.test`, the account BOARD-10 ended with.

**Preconditions:** **Features** page open, showing the board by months of all schedules, with **Drafts & Live** chosen in the Draft menu.

- [ ] `5C1B` Select **Columns: Months**, then **Platform** under **A schedule's cycles**.
  - **Expected:**
    - The first column is the cycle before the current one, headed "Harbor 2 LTS".
    - It holds no card.
  - **Notes:**

- [ ] `D459` Open **Views**, then choose **Show done and cancelled (6)**.
  - **Expected:**
    - The first column holds the cards 'Single Sign-On Setup' and 'Bulk Import'.
    - **Views** marks **Show done and cancelled (6)** as chosen.
  - **Notes:**

- [ ] `A251` Select **Table** in the Table and Board switch.
  - **Expected:** The table of features shows.
  - **Notes:**

- [ ] `8F4F` Open **Views**.
  - **Expected:** The menu doesn't offer **Show done and cancelled**.
  - **Notes:**

**Afterwards:** Press Esc, select **Board**, open **Views**, choose **Show done and cancelled (6)** again to turn it off, then select **Columns: Platform cycles**, then **All schedules** under **Months**.
