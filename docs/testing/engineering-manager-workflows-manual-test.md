---
title: "Manual Test: Engineering Manager Workflows"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/help/working-as-an-engineering-manager.md", "docs/product/roles.md"]
last_updated: "2026-11-25"
---

# Manual Test: Engineering Manager Workflows

## Scope

Verifies the workflows of [Working as an Engineering Manager](../help/working-as-an-engineering-manager.md) on the seed data:

- Estimating a feature, seeing what each cycle holds, and giving a feature that isn't staffed a team.
- Putting someone on a feature team from a month ahead, approved by a Project Manager, and changing a team's lead.
- Finding who is over or under allocated.
- Finding a team on the org chart, and seeing one alone and on an earlier date.

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

**Preconditions:** Reset the Database run. Signed in with this account. Select the **Capacity** page in the left-hand menu, then the **Feature teams** tab, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `3DCD` Type `Candice` in the search box.
  - **Expected:**
    - Only the row of 'Candice Swift' is listed.
    - No cell in her row names a team.
  - **Notes:**

- [ ] `5E92` Select her cell two months after the current month, and press Enter.
  - **Expected:** The team list opens, with no team shown as chosen.
  - **Notes:**

- [ ] `03CF` Type `Payments`, and press Tab.
  - **Expected:**
    - The team list closes.
    - From the cell selected on, each cell names 'Payments core' after a hollow yellow dot.
    - The cells before the one selected name no team.
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

- [ ] `825A` Select the **Capacity** page in the left-hand menu, then the **Allocations** tab.
  - **Expected:** **Allocations** is chosen in the **Capacity** page's tabs.
  - **Notes:**

- [ ] `CB7D` Select **Feature team** in the Group by menu.
  - **Expected:**
    - Under the 'Payments core' group, cells list features, each on a line of its own with its percentage at the right, such as "50%".
    - The group ends with a row in bold headed **Total, person-months**.
  - **Notes:**

- [ ] `FAE8` Search for `Silje Holm-Schrøder`, and read the cell in the current month's column.
  - **Expected:**
    - The cell lists 'Offline Sync' at "75%" and 'Usage Alerts' at "50%".
    - The last line reads "Over" and "+25%", in red and bold.
  - **Notes:**

- [ ] `6AC8` Clear the search box, and type `Lorenza Thiel`. Read the cell in the current month's column.
  - **Expected:**
    - The cell lists 'Mobile Approvals' at "50%".
    - The last line reads "Under" and "−50%", in red and bold.
  - **Notes:**

- [ ] `7165` Clear the search box, and type `Carmine Labadie`. Read his cell in the current month's column.
  - **Expected:**
    - The cell lists no feature.
    - Its only line reads "Not allocated", in red and bold, with no percentage.
  - **Notes:**

- [ ] `CF3F` Clear the search box.
  - **Expected:** Every row is listed again.
  - **Notes:**

- [ ] `291B` Open the **Views** menu, and select **Over**.
  - **Expected:**
    - **Over** is ticked.
    - The table lists only rows with a cell reading "Over" in the current month or a later one, such as 'Blaise Gislason'.
  - **Notes:**

- [ ] `77F0` Select **Over** again.
  - **Expected:**
    - **Over** is not ticked.
    - Every row is listed again.
  - **Notes:**

### MANAGER-03: Features Are Estimated, Seen by Cycle, and Given a Team Where Not Staffed

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

- [ ] `92C3` Clear the search box.
  - **Expected:** The table lists every feature.
  - **Notes:**

- [ ] `A87B` Select **Group by** above the table, then **Cycle**.
  - **Expected:**
    - The button reads **Group by: Cycle**.
    - The last heading is **Later**.
    - 'Voice Notes' and 'Partner Portal' are under **Later**.
  - **Notes:**

- [ ] `D93F` Open the Group by menu, and select **Clear grouping**.
  - **Expected:** The table lists the features in one list, with no headings.
  - **Notes:**

- [ ] `E5E9` Select the **Staffed** header, then **Filter…**.
  - **Expected:** The choices include **No**.
  - **Notes:**

- [ ] `BCDA` Tick **No**.
  - **Expected:** **No** is the only choice ticked.
  - **Notes:**

- [ ] `FBE6` Press Esc.
  - **Expected:**
    - Each row listed reads "No" in **Staffed**.
    - 'Scheduler API' is listed, and 'Offline Sync' is not.
    - The **Feature team** cell of 'Scheduler API' shows **No feature team** in red.
  - **Notes:**

- [ ] `4D8E` Select the **Feature team** cell of 'Scheduler API', press Enter, choose 'Mobile apps', and press Enter.
  - **Expected:** The cell reads 'Mobile apps', with a hollow yellow dot before it.
  - **Notes:**

- [ ] `A043` Run Publish.
  - **Expected:** The Publish button is gone.
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
    - There is no **Draft** button above the chart.
  - **Notes:**

- [ ] `BE0B` Select **Today**.
  - **Expected:** The text below the row is gone.
  - **Notes:**

- [ ] `762D` Select **Show everyone**.
  - **Expected:** The line "Only the team of Lorenza Thiel is shown." is gone.
  - **Notes:**

### MANAGER-07: Metrics Count People by Two Columns and Follow a Filter

Removed: this is checked in [METRICS-04](metrics-manual-test.md#metrics-04-metrics-follow-the-filters) in Metrics.

### MANAGER-08: Metrics Show Live Figures Beside Drafts

Removed: this is checked in [METRICS-05](metrics-manual-test.md#metrics-05-metrics-show-live-figures-beside-drafts) in Metrics.

### MANAGER-09: A Feature Team Is Found and Given a New Lead

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as MANAGER-06.

**Preconditions:** **Org chart** page open from the left-hand menu.

- [ ] `0A02` Choose **Feature teams** in the teams switch.
  - **Expected:** The chart shows the feature teams side by side.
  - **Notes:**

- [ ] `3D4E` Type `Payments` in **Find a person or team**.
  - **Expected:** 'Payments core' is listed under **Teams**.
  - **Notes:**

- [ ] `CC5A` Choose 'Payments core' under **Teams**.
  - **Expected:**
    - The chart centres on the card of 'Gilda Effertz'.
    - The card has a blue ring.
    - 'Payments core' is under her position.
  - **Notes:**

- [ ] `6B17` Select the Feature teams button, then 'Payments core'.
  - **Expected:**
    - The team panel is titled 'Payments core'.
    - **Feature lead** reads 'Gilda Effertz'.
  - **Notes:**

- [ ] `3BC5` Select the change button in the **Feature lead** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `13BA` Type `Lorenza`, and select 'Lorenza Thiel'.
  - **Expected:**
    - **Feature lead** reads 'Lorenza Thiel', with a hollow yellow dot before it.
    - Under it, 'Gilda Effertz' shows, with a green dot before it.
  - **Notes:**

- [ ] `9C8F` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

**Afterwards:** Run Reset the Database.
