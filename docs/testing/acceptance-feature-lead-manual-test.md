---
title: "Manual Test: Acceptance, Feature Lead"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/help/working-as-a-feature-lead.md", "docs/product/roles.md"]
last_updated: "2026-11-13"
---

# Manual Test: Acceptance, Feature Lead

## Scope

Verifies the workflows of [Working as a Feature Lead](../help/working-as-a-feature-lead.md) on the seed data: shaping a feature team, approved by a Project Manager; keeping a feature's status and estimate current, approved by a Product Manager; seeing what each release and cycle holds; and finding someone on the org chart. It also verifies that the account, which holds a second role, switches between them at once, and that the change history names the role a change was made as.

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

Run the test cases in order, in about 30 minutes. Start with Start Fathom, then Reset the Database. Check each step whose expected result you see, and write anything else under its notes.

### LEAD-01: A Feature Lead Proposes a Lead and a Member

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser; the first test case. Step `76A1` signs in as another account in the second browser.

**Preconditions:** Reset the Database run. Signed in with this account, acting as **Feature Lead**. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch.

- [ ] `DAF2` Select the Feature teams button, then 'Platform reliability'.
  - **Expected:**
    - The team panel opens, titled 'Platform reliability', with a grey lock before it.
    - Pointing at the lock shows "Being changed by Second Engineering Operations Manager".
    - No row has a change button.
  - **Notes:**

- [ ] `76A1` In the second browser, sign in as the Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`.
  - **Expected:** The top bar shows the **Publish** button.
  - **Notes:**

- [ ] `F276` In the second browser, run Discard the Unpublished Changes.
  - **Expected:**
    - A notice says "Discarded" followed by the number of changes.
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

### LEAD-02: A Project Manager Approves the Feature Team

**Account:** Project Manager, `project.manager@fathom.test`, in the main browser, changed from LEAD-01.

**Preconditions:** LEAD-01 done. Signed in with this account.

- [ ] `2C45` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] `2EBA` Type `Platform reliability` in the search box.
  - **Expected:**
    - One entry is shown, "the feature team Platform reliability".
    - A line sets **Feature lead** to "Polly Smith".
    - A line for **Members** adds "Rosendo Champlin".
    - It was made by "Feature Lead".
  - **Notes:**

- [ ] `D2E4` Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `47EF` Select **Approve 1 draft**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `DC0A` Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notice begins "Approved".
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

### LEAD-03: A Feature's Status and Estimate Are Kept Current

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

- [ ] `B465` Run Publish.
  - **Expected:** The dots before "In progress" and "40 h" are filled yellow.
  - **Notes:**

- [ ] `DA73` Sign out, and sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Product Manager".
  - **Notes:**

- [ ] `E274` Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] `E3BC` Open the **⋯** menu of 'Data Retention Controls', and select **Approve draft**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `384C` Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads "Approved 1 draft."
    - 'Data Retention Controls' has no dot.
    - It reads "In progress" in **Status** and "40 h" in **Effort**.
  - **Notes:**

### LEAD-04: What Each Release and Cycle Holds

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser, changed from LEAD-03.

**Preconditions:** Signed in with this account, acting as **Feature Lead**. **Features** page open from the left-hand menu.

- [ ] `2EDD` Select **Group by: Cycle** above the table, then **Release**.
  - **Expected:**
    - The headings are, from top to bottom, **Platform: Harbor 1**, **Platform: Harbor 2 LTS**, **Platform: Harbor 3**, **Platform: Not released yet** and **Later**.
    - Each of the three 'Harbor' headings is followed by a comma, "ships" and a date.
  - **Notes:**

- [ ] `9BF5` Select **Group by: Release**, then **Cycle**.
  - **Expected:**
    - The headings name the cycles, such as **Platform: 27.1**.
    - The last heading is **Later**.
  - **Notes:**

### LEAD-05: Someone Is Found on the Org Chart

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

### LEAD-06: Switching Role Changes What Can Be Done at Once

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser, the same as LEAD-05.

**Preconditions:** Acting as **Feature Lead**. Select the **Releases** page in the left-hand menu, and the details button at the right of the **Stream** cell of 'Platform'.

- [ ] `95E5` Open the account menu.
  - **Expected:**
    - **Role** lists **Engineering Manager** and **Feature Lead**.
    - A tick is beside **Feature Lead** only.
  - **Notes:**

- [ ] `3F53` Press Esc, and look at the **People** section of the left-hand menu.
  - **Expected:**
    - It shows **People**, **Org chart** and **Drafts**.
    - There is no **Feature assignments** and no **Capacity**.
  - **Notes:**

- [ ] `FDE2` Choose **Engineering Manager** in the role menu.
  - **Expected:**
    - The menu closes.
    - The page stays on **Releases** with 'Platform' open, without the browser reloading.
    - The **People** section of the left-hand menu now shows **Feature assignments** and **Capacity**.
  - **Notes:**

### LEAD-07: The Change History Names the Role a Change Was Made As

**Account:** Feature Lead, `feature.lead@fathom.test`, in the main browser, the same as LEAD-06.

**Preconditions:** LEAD-06 done, acting as **Engineering Manager**. **Releases** page open, with 'Platform' open in the side panel.

- [ ] `2E35` Select the **⋯** button at the end of the 'Harbor 1' row, then **Change…**.
  - **Expected:**
    - A dialog titled "Change Harbor 1" opens.
    - **Name** holds 'Harbor 1'.
  - **Notes:**

- [ ] `507D` Replace the name with `Fictional Harbor One`.
  - **Expected:** **Name** holds `Fictional Harbor One`.
  - **Notes:**

- [ ] `DE68` Select **Save**.
  - **Expected:**
    - A notification says "Drafted the change to the release."
    - The row reads `Fictional Harbor One`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `CB6B` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

- [ ] `DC52` Select the **Change history** page in the left-hand menu.
  - **Expected:**
    - The latest entry names `Fictional Harbor One`.
    - It starts with "Feature Lead as Engineering Manager".
  - **Notes:**

- [ ] `E452` Select **Releases**.
  - **Expected:** The **Releases** page opens.
  - **Notes:**

- [ ] `D9AF` Select the details button at the right of the **Stream** cell of 'Platform'.
  - **Expected:** The side panel's heading reads 'Platform'.
  - **Notes:**

- [ ] `BB58` Select the **⋯** button at the end of the `Fictional Harbor One` row, then **Discard draft**.
  - **Expected:**
    - A notification says "Discarded the draft."
    - The row reads 'Harbor 1', with no dot.
  - **Notes:**

- [ ] `04D0` Choose **Feature Lead** in the role menu.
  - **Expected:** The **People** section of the left-hand menu shows no **Feature assignments** and no **Capacity**.
  - **Notes:**

**Afterwards:** Run Reset the Database.
