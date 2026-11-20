---
title: "Manual Test: Acceptance, Staffing the Work"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/testing/acceptance/acceptance-reviewing-the-plan-manual-test.md", "docs/help/working-as-a-feature-lead.md", "docs/help/working-as-an-engineering-manager.md", "docs/product/roles.md"]
last_updated: "2026-11-20"
---

# Manual Test: Acceptance, Staffing the Work

## Scope

Verifies that the people who build the plan pick it up once it's approved. The Feature Lead keeps her team's feature and team current, as [Working as a Feature Lead](../../help/working-as-a-feature-lead.md) describes: a status, an estimate and a new member. The Engineering Manager staffs the work, as [Working as an Engineering Manager](../../help/working-as-an-engineering-manager.md) describes: someone put on a feature team from next month, a team's lead changed and a feature estimated. The Engineering Manager then checks who is over or under allocated, and counts the people by site. Their changes wait for the approvers in [Deciding the Changes](acceptance-deciding-the-changes-manual-test.md).

Nobody can be allocated to a feature yet on a new Fathom, since Capacity's **People** mode is read only, so every month reads **Under**.

## Test Environment

What [Reviewing the Plan](acceptance-reviewing-the-plan-manual-test.md) left, run straight after it:

- Fathom running on its installation, at `https://localhost:10443`, in a browser window at least 1,440 pixels wide.
- The password list, open in a plain text editor.

## Test Accounts

[The Team's Accounts](acceptance-team-accounts-manual-test.md) made these, and each signs in for the first time in this test:

- **Feature Lead:** `dara.finch@fathom.test`, shown in Fathom as `Dara Finch`, with the new password `fictional dara password`
- **Engineering Manager:** `ada.quill@fathom.test`, shown in Fathom as `Ada Quill`, with the new password `fictional ada password`

## Common Procedures

This test uses [Change a Generated Password](../manual-test-basics.md#change-a-generated-password) and [Publish](../manual-test-basics.md#publish). [Start Again](../manual-test-basics.md#start-again) removes the installation, for a fresh run from [Installing Fathom](acceptance-installing-fathom-manual-test.md).

## Terms

[Manual Test Basics](../manual-test-basics.md#terms) defines the terms every test uses, such as marks, the Publish button, the teams switch, the Feature teams button, the team panel, the team list, the Group by menu and the mode switch. This test adds:

- **Next month:** the month after the current one.

## Test Cases

Run the test cases in order, in about 30 minutes, straight after [Reviewing the Plan](acceptance-reviewing-the-plan-manual-test.md). Check each step whose expected result you see, and write anything else under its notes. [Deciding the Changes](acceptance-deciding-the-changes-manual-test.md) follows on from the last test case.

### STAFF-01: The Feature Lead Signs In for the First Time

**Account:** Feature Lead, `dara.finch@fathom.test`, changed from REVIEW-04 in [Reviewing the Plan](acceptance-reviewing-the-plan-manual-test.md); the first test case. The first step signs out the Project Manager.

**Preconditions:** [Reviewing the Plan](acceptance-reviewing-the-plan-manual-test.md) run just before.

- [ ] `C2C6` Sign out from the account menu.
  - **Expected:** The **Sign in** page shows.
  - **Notes:**

- [ ] `9C4B` Sign in as the Feature Lead, `dara.finch@fathom.test`, with the password beside it in the password list.
  - **Expected:** A page headed **Change password** shows, with no left-hand menu.
  - **Notes:**

- [ ] `91F5` Run Change a Generated Password, with the new password `fictional dara password`.
  - **Expected:**
    - Fathom opens on the **Overview**.
    - The top bar's right end shows `Dara Finch`.
  - **Notes:**

### STAFF-02: The Feature Lead Keeps Her Team's Feature Current

**Account:** Feature Lead, `dara.finch@fathom.test`, the same as STAFF-01.

**Preconditions:** STAFF-01 done.

- [ ] `2C5A` Select the **Features** page in the left-hand menu.
  - **Expected:** `Fictional Gauge Alerts` reads "Planned" in **Status** and `Harbour team` in **Feature team**, with no dot.
  - **Notes:**

- [ ] `085F` Select the **Status** cell of `Fictional Gauge Alerts`, press Enter, choose **In progress**, and press Enter.
  - **Expected:**
    - The cell reads "In progress", with a hollow yellow dot before it.
    - A Live row under it reads "Planned".
  - **Notes:**

- [ ] `12D0` Select the **Effort** cell of `Fictional Gauge Alerts`, above its Live row, type `40`, and press Enter.
  - **Expected:** The cell reads "40 h", with a hollow yellow dot before it.
  - **Notes:**

### STAFF-03: The Feature Lead Adds a Member to Her Team

**Account:** Feature Lead, `dara.finch@fathom.test`, the same as STAFF-02.

**Preconditions:** STAFF-02 done.

- [ ] `2A15` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens.
  - **Notes:**

- [ ] `9D0B` Choose **Feature teams** in the teams switch.
  - **Expected:** `Tide team` and `Harbour team` are drawn side by side, `Harbour team` led by `Dara Finch`.
  - **Notes:**

- [ ] `3D3C` Select the Feature teams button, then `Harbour team`.
  - **Expected:** The team panel is titled `Harbour team`, and **Members** lists `Dara Finch` and `Emil Stone`.
  - **Notes:**

- [ ] `4C51` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `CC70` Type `Bram`, and press Enter.
  - **Expected:** `Bram Oakes` has a tick.
  - **Notes:**

- [ ] `D59F` Press Enter.
  - **Expected:**
    - **Members** lists `Bram Oakes`, with a hollow yellow dot before his name.
    - On the chart, a card for `Bram Oakes` is under `Harbour team`, and his card under `Tide team` is still there.
  - **Notes:**

- [ ] `F0B9` Run Publish.
  - **Expected:** The Publish button, which read **Publish 2 changes**, is gone.
  - **Notes:**

### STAFF-04: The Engineering Manager Signs In for the First Time

**Account:** Engineering Manager, `ada.quill@fathom.test`, changed from STAFF-03. The first step signs out the Feature Lead.

**Preconditions:** STAFF-03 done.

- [ ] `E4EA` Sign out from the account menu.
  - **Expected:** The **Sign in** page shows.
  - **Notes:**

- [ ] `37B9` Sign in as the Engineering Manager, `ada.quill@fathom.test`, with the password beside it in the password list.
  - **Expected:** A page headed **Change password** shows, with no left-hand menu.
  - **Notes:**

- [ ] `AED9` Run Change a Generated Password, with the new password `fictional ada password`.
  - **Expected:**
    - Fathom opens on the **Overview**.
    - The top bar's right end shows `Ada Quill`.
  - **Notes:**

### STAFF-05: Someone Is Put on a Feature Team From Next Month

**Account:** Engineering Manager, `ada.quill@fathom.test`, the same as STAFF-04.

**Preconditions:** STAFF-04 done.

- [ ] `EDA6` Select the **Feature assignments** page in the left-hand menu.
  - **Expected:** The page is headed **Feature assignments**, with a row for each person and a column for each month.
  - **Notes:**

- [ ] `6A2A` Type `Freya` in the search box.
  - **Expected:**
    - Only the row of `Freya Holt` is listed.
    - No cell in her row holds a label.
  - **Notes:**

- [ ] `F4E9` Select her cell for next month, and press Enter.
  - **Expected:** The team list opens under the cell, with no team shown as chosen.
  - **Notes:**

- [ ] `A184` Type `Tide`, and press Tab.
  - **Expected:**
    - The team list closes.
    - From next month on, each cell holds a `Tide team` label with a hollow yellow dot before it.
    - The current month's cell holds no label.
  - **Notes:**

### STAFF-06: A Team's Lead Is Changed

**Account:** Engineering Manager, `ada.quill@fathom.test`, the same as STAFF-05.

**Preconditions:** STAFF-05 done.

- [ ] `97AE` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens.
  - **Notes:**

- [ ] `1E97` Choose **Feature teams** in the teams switch.
  - **Expected:** A card named `Tide team` reads "No feature lead".
  - **Notes:**

- [ ] `6C62` Select the Feature teams button, then `Tide team`.
  - **Expected:** The team panel is titled `Tide team`.
  - **Notes:**

- [ ] `DB6C` Select the change button in the **Feature lead** row, type `Ada`, and press Enter.
  - **Expected:**
    - **Feature lead** reads `Ada Quill`, with a hollow yellow dot before it.
    - Under it, a green dot before "None", in grey.
    - In the **Members** row, `Freya Holt` has a hollow yellow dot before her name, followed in grey by "from" and the first day of next month.
  - **Notes:**

### STAFF-07: A Feature Is Estimated

**Account:** Engineering Manager, `ada.quill@fathom.test`, the same as STAFF-06.

**Preconditions:** STAFF-06 done.

- [ ] `42E9` Select the **Features** page in the left-hand menu.
  - **Expected:**
    - `Fictional Gauge Alerts` reads "In progress" in **Status**, with a yellow dot before it.
    - A Live row under it reads "Planned".
  - **Notes:**

- [ ] `EC4D` Select the **Effort** cell of `Fictional Lamp Schedule`, type `80`, and press Enter.
  - **Expected:** The cell reads "80 h", with a hollow yellow dot before it.
  - **Notes:**

- [ ] `B422` Run Publish.
  - **Expected:** The Publish button, which read **Publish 2 changes**, is gone.
  - **Notes:**

### STAFF-08: Who Is Over or Under Allocated

**Account:** Engineering Manager, `ada.quill@fathom.test`, the same as STAFF-07.

**Preconditions:** STAFF-07 done. **Features** page open.

- [ ] `B8D2` On the **Features** page, read the **Staffed** column.
  - **Expected:** **Staffed** reads "No" for `Fictional Tide Tables` and `Fictional Gauge Alerts`, and is empty for `Fictional Lamp Schedule`.
  - **Notes:**

- [ ] `66A8` Select the **Capacity** page in the left-hand menu.
  - **Expected:** The mode switch has **People** chosen.
  - **Notes:**

- [ ] `E6C3` Select **Feature team** in the Group by menu.
  - **Expected:**
    - The groups are `Harbour team`, `Tide team` and **No feature team**, each ending with a total row.
    - No cell lists a feature.
  - **Notes:**

- [ ] `8B4A` Type `Cleo` in the search box, and read the current month's cell of her row under `Tide team`.
  - **Expected:** The cell's only line reads "Under" and "0%".
  - **Notes:**

### STAFF-09: The People Are Counted by Site

**Account:** Engineering Manager, `ada.quill@fathom.test`, the same as STAFF-08.

**Preconditions:** STAFF-08 done.

- [ ] `7C01` Select the **People** page in the left-hand menu.
  - **Expected:** The **Site** column's name has an eye with a line through it before it.
  - **Notes:**

- [ ] `0A4A` Select **Metrics** above the table.
  - **Expected:** The Metrics panel opens on the right.
  - **Notes:**

- [ ] `E19A` Set **Break down by** to **Site**.
  - **Expected:** The panel counts 4 at `Harbourside`, 3 at `Northmere` and 1 under **Empty**.
  - **Notes:**

**Afterwards:** Run [Deciding the Changes](acceptance-deciding-the-changes-manual-test.md) next, on this installation. To stop here instead, run [Start Again](../manual-test-basics.md#start-again).
