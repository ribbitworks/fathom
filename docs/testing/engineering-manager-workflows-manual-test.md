---
title: "Manual Test: Engineering Manager Workflows"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/help/working-as-an-engineering-manager.md", "docs/product/roles.md"]
last_updated: "2026-11-19"
---

# Manual Test: Engineering Manager Workflows

## Scope

Verifies the workflows of [Working as an Engineering Manager](../help/working-as-an-engineering-manager.md) on the seed data: putting someone on a feature team from a month ahead, approved by a Project Manager; finding who is over or under allocated; estimating a feature; seeing a team on the org chart, alone and on an earlier date; and counting people with Metrics.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with a browser window at least 1,440 pixels wide.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Engineering Manager:** `engineering.manager@fathom.test`
- **Project Manager:** `project.manager@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Reset the Database](manual-test-basics.md#reset-the-database) and [Publish](manual-test-basics.md#publish).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses. This test adds:

- **Months from today:** the steps name months by where they fall from the current month: **last month** is the one before it, and **two months after the current month** the second month after it. The examples after "such as" are for a run in November 2026.
- **Date box:** the box labelled **Date** between the **Org chart** heading and the chart, before the left arrow, timeline, right arrow and **Today**.

## Test Cases

Run the test cases in order, in about 30 minutes. Start with Start Fathom, then Reset the Database. Check each step whose expected result you see, and write anything else under its notes.

### MANAGER-01: Someone Is Put on a Feature Team From a Month Ahead

**Account:** Engineering Manager, `engineering.manager@fathom.test`; the first test case. Step `EF8B` signs in as another account.

**Preconditions:** Reset the Database run. Signed in with this account. Select the **Feature assignments** page in the left-hand menu, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `3DCD` Type `Candice` in the search box.
  - **Expected:**
    - Only the row of 'Candice Swift' is listed.
    - No cell in her row holds a label.
  - **Notes:**

- [ ] `5E92` Select her cell two months after the current month, and press Enter.
  - **Expected:** The team list opens, with no team shown as chosen.
  - **Notes:**

- [ ] `03CF` Type `Payments`, and press Tab.
  - **Expected:**
    - The team list closes.
    - From the cell selected on, each cell holds a 'Payments core' label with a hollow yellow dot before it.
    - The cells before the one selected hold no label.
    - The row is faintly yellow.
    - A light green Live row is under it.
  - **Notes:**

- [ ] `DBC1` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens.
  - **Notes:**

- [ ] `F5E0` Choose **Feature teams** in the teams switch.
  - **Expected:** The chart shows the feature teams side by side.
  - **Notes:**

- [ ] `D737` Select the Feature teams button, then 'Payments core'.
  - **Expected:**
    - The team panel is titled 'Payments core'.
    - 'Candice Swift' is in the **Members** row, with a hollow yellow dot before her name.
    - Her name is followed in grey by "from" and the first day of the month two months after the current one.
  - **Notes:**

- [ ] `F14B` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `EF8B` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `08A8` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `FCC5` Type `Candice Swift` in the search box.
  - **Expected:**
    - One row is shown, whose **Record** reads 'Payments core', with **Type** "Feature team".
    - Its **What changes** adds "Candice Swift" to **Members**.
    - The row has a tick box.
  - **Notes:**

- [ ] `FB97` Tick that row's tick box.
  - **Expected:**
    - The tick box is ticked.
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `951E` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `1CA8` Select **Approve** in the dialog.
  - **Expected:** A notice reads "Approved 1 draft."
  - **Notes:**

### MANAGER-02: Who Is Over or Under Allocated

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from MANAGER-01.

**Preconditions:** Signed in with this account.

- [ ] `825A` Select the **Capacity** page in the left-hand menu.
  - **Expected:** The mode switch has **People** chosen.
  - **Notes:**

- [ ] `CB7D` Select **Feature team** in the Group by menu.
  - **Expected:** Under the 'Payments core' group, cells list features, each on a line of its own with its percentage at the right, such as "50%".
  - **Notes:**

- [ ] `FAE8` Search for `Blaise Gislason`, and read his cell in the current month's column.
  - **Expected:**
    - The cell lists 'Depot Operations' at "25%" and 'Transit Displays' at "100%".
    - The last line reads "Over" and "125%", in red and bold.
  - **Notes:**

- [ ] `6AC8` Clear the search box, and type `Jeremiah Bogisich`. Read his cell in the current month's column.
  - **Expected:**
    - The cell lists 'Depot Operations' at "50%".
    - The last line reads "Under" and "50%", in grey.
  - **Notes:**

- [ ] `7165` Clear the search box, and type `Carmine Labadie`. Read his cell in the current month's column.
  - **Expected:**
    - The cell lists no feature.
    - Its only line reads "Under" and "0%", in grey.
  - **Notes:**

### MANAGER-03: A Feature Is Estimated

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as MANAGER-02.

**Preconditions:** None beyond MANAGER-02.

- [ ] `C1A2` Select the **Features** page in the left-hand menu.
  - **Expected:** The table lists the features in one list, with no headings.
  - **Notes:**

- [ ] `35DF` Type `Offline Sync` in the search box.
  - **Expected:** Only the row of 'Offline Sync' is listed.
  - **Notes:**

- [ ] `AFF1` Select its **Effort** cell, type `120`, and press Enter.
  - **Expected:** The cell reads "120 h", with a hollow yellow dot before it.
  - **Notes:**

### MANAGER-04: An Engineering Manager Reads a Note Beside the Chart

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as MANAGER-03.

**Preconditions:** **Org chart** page open from the left-hand menu, with **Reporting teams** chosen in the teams switch.

- [ ] `11FE` On the card at the top of the chart, select the name 'Silje Holm-Schrøder'.
  - **Expected:**
    - The details panel slides out on the right, headed 'Silje Holm-Schrøder'.
    - The link **Show in People** is under her position.
    - The chart narrows.
    - Her card, with a blue ring, stays in the middle of the space left.
  - **Notes:**

- [ ] `4EB5` Select 'Tanushree Patel-Singh' under **Direct reports**, and read **Onboarding** under **Columns**.
  - **Expected:**
    - The panel shows 'Tanushree Patel-Singh'.
    - **Onboarding** shows the heading "First weeks".
    - Under the heading is a checklist of four steps, with only "Laptop and accounts ready" ticked.
    - In the checklist, the buddy's name 'Elly Gunther' is in bold.
    - Under the checklist, "On track" is in teal.
    - The last line ends with the link "onboarding guide".
  - **Notes:**

- [ ] `A189` Select the **×** at the top right of the panel.
  - **Expected:** The panel slides away.
  - **Notes:**

### MANAGER-05: A Person Drafted to Another Manager Is Drawn in Both Places

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as MANAGER-04.

**Preconditions:** **Org chart** page open, showing the top two levels.

- [ ] `804B` Read the card for 'Simone Jean', under 'Silje Holm-Schrøder'.
  - **Expected:**
    - The card is faintly yellow.
    - A yellow dot is before her name.
  - **Notes:**

- [ ] `EA88` On the card for 'Viktoria Holmberg', select **Show 3 reports**.
  - **Expected:**
    - 'Simone Jean', '우아현' and '西尾 亮' appear in a column under her.
    - The card for 'Simone Jean' there is faded and light green, with a dashed edge.
    - Its name is in grey, with a green dot before it.
    - The line to it is dashed.
  - **Notes:**

### MANAGER-06: A Team Is Shown Alone, and on an Earlier Date

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as MANAGER-05.

**Preconditions:** **Org chart** page open from the left-hand menu.

- [ ] `D1F1` Select the **Show only this team** button at the top right of the card for 'Lorenza Thiel'.
  - **Expected:**
    - 'Lorenza Thiel' is at the top of the chart, with her reports under her.
    - To the right of the heading, the page reads "Only the team of Lorenza Thiel is shown."
  - **Notes:**

- [ ] `9A41` Select the left arrow once.
  - **Expected:**
    - The **Date** box shows the first day of last month.
    - The text below the row ends "Nothing can be changed on this date."
    - There is no **Draft** button above the chart.
  - **Notes:**

- [ ] `BE0B` Select **Today**.
  - **Expected:** The text below the row is gone.
  - **Notes:**

- [ ] `762D` Select **Show everyone**.
  - **Expected:** The line "Only the team of Lorenza Thiel is shown." is gone.
  - **Notes:**

### MANAGER-07: Metrics Count People by Two Columns and Follow a Filter

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as MANAGER-06.

**Preconditions:** **People** page open from the left-hand menu, with no filters and no search.

- [ ] `534E` Select **Metrics** above the table.
  - **Expected:**
    - The Metrics panel opens on the right.
    - The table narrows beside it.
  - **Notes:**

- [ ] `7ECB` Set **Break down by** to **Position**.
  - **Expected:** **Break down by** reads **Position**.
  - **Notes:**

- [ ] `4DDB` Set **and by** to **Site**.
  - **Expected:**
    - A table headed **Position by Site** has a column for each site, an **Empty** column for the planned hires that have no site, and an **All** column.
    - The **Position by Site** table has a row for each position and an **All** row.
  - **Notes:**

- [ ] `D46A` Open the **Site** column menu, and select **Filter…**.
  - **Expected:**
    - The filter opens.
    - It lists the sites.
  - **Notes:**

- [ ] `40DD` Pick only 'Ashgrove'.
  - **Expected:** 'Ashgrove' is the only site picked.
  - **Notes:**

- [ ] `D6E7` Press Esc.
  - **Expected:**
    - The bar above the table says how many rows are shown of how many, such as "48 of 160".
    - The count line under the panel's title gives the first number in the bar, such as "47 people and 1 planned hire".
    - The **Position by Site** table has only the 'Ashgrove' column besides **All**.
  - **Notes:**

- [ ] `EBB7` Select **Clear all** in the bar above the table.
  - **Expected:**
    - The filter is cleared.
    - The panel stays open.
  - **Notes:**

### MANAGER-08: Metrics Show Live Figures Beside Drafts

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as MANAGER-07.

**Preconditions:** **People** page open, with the Metrics panel open.

- [ ] `F2CD` Open the Draft menu, and select **Drafts & Live**.
  - **Expected:**
    - The Draft menu stays open.
    - A tick is before **Drafts & Live**.
  - **Notes:**

- [ ] `ACCE` Press Esc.
  - **Expected:** The Draft menu closes.
  - **Notes:**

- [ ] `C058` Set **Break down by** to **Grade**.
  - **Expected:** **Break down by** reads **Grade**.
  - **Notes:**

- [ ] `CAEB` Set **and by** to **Nothing more**.
  - **Expected:**
    - At least one row, such as 'P1', shows a count with a dimmed live figure under it, with a green dot before the live figure.
    - Rows whose count the drafts do not change show no live figure.
  - **Notes:**

- [ ] `DDDB` Press Esc.
  - **Expected:**
    - The panel closes.
    - The **Metrics** button has the keyboard focus.
  - **Notes:**

**Afterwards:** Run Reset the Database.
