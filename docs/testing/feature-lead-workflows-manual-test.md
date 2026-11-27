---
title: "Manual Test: Feature Lead Workflows"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/help/working-as-a-feature-lead.md", "docs/product/roles.md"]
last_updated: "2026-11-27"
---

# Manual Test: Feature Lead Workflows

## Scope

Verifies the workflows of [Working as a Feature Lead](../help/working-as-a-feature-lead.md) on the seed data:

- Changing a feature team's lead and members, approved by a Project Manager.
- Keeping a feature's team, status, estimate and note current, approved by a Product Manager.
- Seeing what each release and cycle holds, in the Features table and on the board.
- Finding someone on the org chart, and opening their details there and on People.

It also verifies that the account, which holds a second role, switches between them at once, and that the change history names the role a change was made as.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A browser window at least 1,440 pixels wide.
- A second browser, or a private window, for signing in as a second account while the first stays signed in.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Feature Lead:** `feature.lead@fathom.test`, holding the Feature Lead role, its default, and the Engineering Manager role
- **Project Manager:** `project.manager@fathom.test`
- **Product Manager:** `product.manager@fathom.test`
- **Second Workforce Administrator:** `engineering.operations.manager.2@fathom.test`, shown in Fathom as "Second Engineering Operations Manager"

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Reset the Database](manual-test-basics.md#reset-the-database), [Publish](manual-test-basics.md#publish) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the account menu and role menu, marks, the lock, Draft rows and Live rows, the Publish button, the finder, the teams switch, the team panel and the details button.

## Test Cases

Run the test cases in order, in about 30 minutes. Start with Start Fathom, then Reset the Database. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### LEAD-01: A Feature Lead Proposes a Lead and a Member

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser; the first test case. Step `76A1` signs in as another account in the second browser.

**Preconditions:** Reset the Database run. Signed out.

- [ ] `18D7` Sign in as the Feature Lead, `feature.lead@fathom.test`.
  - **Expected:** The **Overview** page opens, reading "Acting as Feature Lead".
  - **Notes:**

- [ ] `E4B7` Select **Staff the Feature Teams**.
  - **Expected:** Its tasks show under it, among them **Change a Team's Lead or Members**.
  - **Notes:**

- [ ] `13E2` Select the **Org chart › Feature teams** link beside **Change a Team's Lead or Members**.
  - **Expected:**
    - The **Org chart** page opens.
    - **Feature teams** is chosen in the teams switch.
  - **Notes:**

- [ ] `DAF2` Select the Feature teams button, then 'Platform reliability'.
  - **Expected:**
    - The team panel opens, titled 'Platform reliability', with a grey lock before it.
    - Pointing at the lock shows "Being changed by Second Engineering Operations Manager".
    - No row but **Colour** has a change button.
  - **Notes:**

- [ ] `76A1` In the second browser, sign in as the Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`.
  - **Expected:** The top bar shows the **Publish** button.
  - **Notes:**

- [ ] `F276` In the second browser, run Discard the Unpublished Changes.
  - **Expected:**
    - A notification says "Discarded" followed by the number of changes.
    - The **Publish** button is gone.
  - **Notes:**

- [ ] `9C39` In the main browser, reload the page.
  - **Expected:**
    - The team panel is titled 'Platform reliability', with no lock.
    - **Feature lead** reads "None".
    - **Name**, **Feature lead** and **Members** each have a change button.
  - **Notes:**

- [ ] `62AD` Select the change button in the **Feature lead** row, type `Polly`, and press Enter.
  - **Expected:**
    - **Feature lead** reads 'Polly Smith', with a hollow yellow dot before it.
    - On the chart, the card reading 'Platform reliability' and "No feature lead" is gone.
    - The card of 'Polly Smith' is at the top of the team in its place.
    - 'Platform reliability' is under her position.
    - The team's members are under her.
  - **Notes:**

- [ ] `9A03` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `496D` Type `Rosendo`, and press Enter.
  - **Expected:** 'Rosendo Champlin' has a tick.
  - **Notes:**

- [ ] `34DE` Press Enter.
  - **Expected:**
    - **Members** lists 'Rosendo Champlin', with a hollow yellow dot before his name.
    - On the chart, a card for him is under 'Polly Smith', with a hollow yellow dot before his name.
    - His card in 'Mobile apps' is still there.
  - **Notes:**

- [ ] `20F5` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

**Afterwards:** Choose **Reporting teams** in the teams switch.

### LEAD-02: A Project Manager Approves the Feature Team

**Account:** Project Manager, `project.manager@fathom.test`, in the main browser, changed from LEAD-01.

**Preconditions:** LEAD-01 done. Signed in with this account.

- [ ] `2C45` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `2EBA` Type `Platform reliability` in the search box.
  - **Expected:**
    - One row is shown, whose **Record** reads 'Platform reliability', with **Type** "Feature team".
    - Its **What changes** sets **Feature lead** to "Polly Smith".
    - Its **What changes** adds "Rosendo Champlin" to **Members**.
    - Its **Made by** reads "Feature Lead".
  - **Notes:**

- [ ] `D2E4` Tick that row's tick box.
  - **Expected:**
    - The tick box is ticked.
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `47EF` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `DC0A` Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notification says "Approved 1 draft."
  - **Notes:**

- [ ] `B3E6` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens.
  - **Notes:**

- [ ] `CB16` Choose **Feature teams** in the teams switch.
  - **Expected:**
    - 'Platform reliability' is led by 'Polly Smith'.
    - 'Rosendo Champlin' is among the cards under her.
    - No dot is before 'Polly Smith' or 'Rosendo Champlin'.
  - **Notes:**

### LEAD-03: A Feature's Team, Status, Estimate and Note Are Kept Current

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser, changed from LEAD-02. Step `DA73` signs in as another account.

**Preconditions:** Signed in with this account, acting as **Feature Lead**.

- [ ] `8D95` Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] `20BB` Type `Data Retention` in the search box.
  - **Expected:** Only the row of 'Data Retention Controls' is listed, reading "Planned" in **Status**.
  - **Notes:**

- [ ] `7E95` Select the row's **Status** cell, press Enter, choose **In progress**, and press Enter.
  - **Expected:**
    - The cell reads "In progress", with a hollow yellow dot before it.
    - The row is faintly yellow.
    - A Live row under it reads "Planned".
  - **Notes:**

- [ ] `41D5` Select the **Effort** cell of the row, above the Live row, type `40`, and press Enter.
  - **Expected:** The cell reads "40 h", with a hollow yellow dot before it.
  - **Notes:**

- [ ] `8F31` Open the column menu of **Effort**, and select **Person-days (8 hours)** under **Show in**.
  - **Expected:**
    - The menu closes.
    - The **Effort** cell of the row above the Live row reads "5 PD", with a hollow yellow dot before it.
  - **Notes:**

- [ ] `D2D0` Open the column menu of **Effort**, and select **Hours** under **Show in**.
  - **Expected:** The **Effort** cell of the row above the Live row reads "40 h" again.
  - **Notes:**

- [ ] `7C31` Select the row's **Feature team** cell, press Enter, choose 'Platform reliability', and press Enter.
  - **Expected:** The cell reads 'Platform reliability', with a hollow yellow dot before it.
  - **Notes:**

- [ ] `AA36` Select the **Notes** cell of the row, above the Live row.
  - **Expected:**
    - A side panel titled **Notes** opens beside the table.
    - **Clear**, **Cancel** and **Save** are at its bottom.
  - **Notes:**

- [ ] `32D2` Type `Fictional retention note` in the panel's text.
  - **Expected:** The panel shows `Fictional retention note`.
  - **Notes:**

- [ ] `BE5C` Select **Save**.
  - **Expected:**
    - The panel closes.
    - The **Notes** cell reads `Fictional retention note`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `B465` Run Publish.
  - **Expected:** The dots before "In progress", "40 h", 'Platform reliability' and `Fictional retention note` are filled yellow.
  - **Notes:**

- [ ] `DA73` Sign out, and sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Product Manager".
  - **Notes:**

- [ ] `E274` Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] `E3BC` Open the **⋯** menu of 'Data Retention Controls', and select **Approve draft…**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `384C` Select **Approve** in the dialog.
  - **Expected:**
    - A notification says "Approved 1 draft."
    - 'Data Retention Controls' has no dot.
    - It reads "In progress" in **Status**, "40 h" in **Effort**, 'Platform reliability' in **Feature team** and `Fictional retention note` in **Notes**.
  - **Notes:**

### LEAD-04: What Each Release and Cycle Holds, in the Table and on the Board

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser, changed from LEAD-03.

**Preconditions:** Signed in with this account, acting as **Feature Lead**. **Features** page open from the left-hand menu.

- [ ] `9C5B` Open the **Views** menu above the table and select **Clear view**.
  - **Expected:**
    - The search box above the table is empty.
    - Every feature's row shows.
  - **Notes:**

- [ ] `2EDD` Select **Group by** above the table, then **Release**.
  - **Expected:**
    - The headings are, from top to bottom, **Platform: Harbor 1**, **Platform: Harbor 2 LTS**, **Platform: Harbor 3**, **Field Apps: Lantern 1**, **Field Apps: Lantern 2**, **Platform: Not released yet**, **Field Apps: Not released yet** and **Later**.
    - Each of the five 'Harbor' and 'Lantern' headings is followed by a comma, "ships" and a date.
  - **Notes:**

- [ ] `9BF5` Select **Group by: Release**, then **Cycle** under **Group by**.
  - **Expected:**
    - The headings name the cycles, such as **Platform: 27.1**.
    - The last heading is **Later**.
  - **Notes:**

- [ ] `4DFE` Select **Group by: Cycle**, then **Clear grouping**.
  - **Expected:**
    - The button reads **Group by**.
    - The features are in one list.
  - **Notes:**

- [ ] `494C` Choose **Board** beside the **Features** heading.
  - **Expected:**
    - The board shows, with the button **Columns: Months**.
    - Its columns are months, this month second, then **No date**.
    - Each feature has a card in the month it's needed by.
  - **Notes:**

- [ ] `F853` Select **Columns: Months**, then **Platform** under **A schedule's cycles**.
  - **Expected:**
    - The button reads **Columns: Platform cycles**.
    - The board's columns are Platform's cycles, from left to right, the last headed "Later".
  - **Notes:**

**Afterwards:** Choose **Table** beside the **Features** heading, then open the **Views** menu above the table and select **Clear view**.

### LEAD-05: Someone Is Found on the Org Chart, and Their Details Opened

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser, the same as LEAD-04.

**Preconditions:** None beyond LEAD-04.

- [ ] `420E` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens.
  - **Notes:**

- [ ] `0D5F` In the finder, type `Gloria`, and select 'Gloria Armas Guardado'.
  - **Expected:**
    - The chart moves until the card for 'Gloria Armas Guardado' is in the middle of the panel.
    - A blue ring is around the card.
  - **Notes:**

- [ ] `CEB7` Select the name on the card for 'Gloria Armas Guardado'.
  - **Expected:**
    - The details panel slides out on the right, headed 'Gloria Armas Guardado'.
    - The link **Show in People** is under the position.
  - **Notes:**

- [ ] `D89A` Select **Show in People**.
  - **Expected:**
    - The **People** page opens.
    - Only the row of 'Gloria Armas Guardado' is listed.
  - **Notes:**

### LEAD-06: Switching Role Changes What Can Be Done at Once

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser, the same as LEAD-05.

**Preconditions:** Acting as **Feature Lead**. Select the **Releases** page in the left-hand menu, then the **Schedules** tab, then the details button at the right of the first cell of the row for 'Platform'.

- [ ] `95E5` Open the account menu.
  - **Expected:**
    - **Role** lists **Engineering Manager** and **Feature Lead**.
    - A tick is beside **Feature Lead** only.
  - **Notes:**

- [ ] `3F53` Press Esc, and look at the **People** section of the left-hand menu.
  - **Expected:**
    - It shows **People** and **Org chart**.
    - There is no **Capacity**.
    - There is no **New schedule** at the top right of the page.
  - **Notes:**

- [ ] `FDE2` Choose **Engineering Manager** in the role menu.
  - **Expected:**
    - The menu closes.
    - The page stays on the **Schedules** tab of **Releases** with 'Platform' open, without the browser reloading.
    - **New schedule** shows at the top right of the page.
    - The **People** section of the left-hand menu now shows **Capacity**.
  - **Notes:**

### LEAD-07: The Change History Names the Role a Change Was Made As

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser, the same as LEAD-06.

**Preconditions:** LEAD-06 done, acting as **Engineering Manager**. **Releases** page open on the **Schedules** tab, with 'Platform' open in the side panel.

- [ ] `2972` Select **New schedule**.
  - **Expected:** A dialog titled "New schedule" opens.
  - **Notes:**

- [ ] `3232` Type `Fictional Side Schedule` in **Name**.
  - **Expected:** **Name** holds `Fictional Side Schedule`.
  - **Notes:**

- [ ] `3712` Select **Add schedule**.
  - **Expected:**
    - A notification says "Drafted the new schedule."
    - The table has a `Fictional Side Schedule` row, with a hollow yellow dot in its slot.
  - **Notes:**

- [ ] `CB6B` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

- [ ] `DC52` Select the **Change history** page in the left-hand menu.
  - **Expected:**
    - The latest entry names `Fictional Side Schedule`.
    - It starts with "Feature Lead as Engineering Manager".
  - **Notes:**

- [ ] `E452` Select **Releases**.
  - **Expected:** The **Releases** page opens.
  - **Notes:**

- [ ] `F3DC` Select the **Schedules** tab.
  - **Expected:** The table lists `Fictional Side Schedule`, with a yellow dot in its slot.
  - **Notes:**

- [ ] `39E5` Select the **⋯** button at the right of the first cell of the row for `Fictional Side Schedule`, then **Discard draft**.
  - **Expected:**
    - A notification says "Discarded the draft."
    - The `Fictional Side Schedule` row is gone.
  - **Notes:**

- [ ] `04D0` Choose **Feature Lead** in the role menu.
  - **Expected:** The **People** section of the left-hand menu shows no **Capacity**.
  - **Notes:**

**Afterwards:** Run Reset the Database.

### LEAD-08: A Feature Lead Keeps Views of One Schedule and the Board

Covered by [VIEW-13](saved-views-manual-test.md#view-13-a-view-on-features-is-shared-by-its-table-and-board) in Saved Views and [LEAD-04](#lead-04-what-each-release-and-cycle-holds-in-the-table-and-on-the-board).
