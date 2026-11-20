---
title: "Manual Test: Acceptance, Deciding the Changes"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/testing/acceptance/acceptance-staffing-the-work-manual-test.md", "docs/help/how-work-moves-between-roles.md", "docs/help/working-as-a-product-manager.md", "docs/help/working-as-an-engineering-director.md", "docs/product/roles.md"]
last_updated: "2026-11-20"
---

# Manual Test: Acceptance, Deciding the Changes

## Scope

Verifies that work passes between roles until nothing waits, as [How Work Moves Between Roles](../../help/how-work-moves-between-roles.md) describes. The Product Manager changes the release the Project Manager rejected and sends it again, takes a feature off the proposal with a reason, and approves the Feature Lead's, the Engineering Manager's and the Project Manager's drafts of the plan. The Engineering Director approves the feature teams' changes and the Product Manager's drafts, then reads the plan the team has built and how the rejected release went.

## Test Environment

What [Staffing the Work](acceptance-staffing-the-work-manual-test.md) left, run straight after it: Fathom running on its installation, at `https://localhost:10443`, in a browser window at least 1,440 pixels wide.

## Test Accounts

[The Team's Accounts](acceptance-team-accounts-manual-test.md) made these:

- **Product Manager:** `priya.lund@fathom.test`, shown in Fathom as `Priya Lund`, with the password `fictional priya password`
- **Engineering Director:** `odile.brandt@fathom.test`, shown in Fathom as `Odile Brandt`, with the password `fictional odile password`

## Common Procedures

This test uses [Publish](../manual-test-basics.md#publish). [Start Again](../manual-test-basics.md#start-again) removes the installation, for a fresh run from [Installing Fathom](acceptance-installing-fathom-manual-test.md).

## Terms

[Manual Test Basics](../manual-test-basics.md#terms) defines the terms every test uses, such as marks, a row's slot, the tick box, the side panel, the details button, the ⋯ menu and the Group by menu. This test adds:

- **Next year:** the year after the current one. Its first cycles are named by its last two digits and their number, such as "27.2" for the second in 2027; the examples after "such as" are for a run in 2026.

## Test Cases

Run the test cases in order, in about 30 minutes, straight after [Staffing the Work](acceptance-staffing-the-work-manual-test.md). Check each step whose expected result you see, and write anything else under its notes. [Reading the Plan](acceptance-reading-the-plan-manual-test.md) follows on from the last test case.

### DECIDE-01: The Rejected Release Is Changed and Sent Again

**Account:** Product Manager, `priya.lund@fathom.test`, changed from STAFF-09 in [Staffing the Work](acceptance-staffing-the-work-manual-test.md); the first test case. The first step signs in as this account.

**Preconditions:** [Staffing the Work](acceptance-staffing-the-work-manual-test.md) run just before.

- [ ] `9BD2` Sign out from the account menu, and sign in as the Product Manager, `priya.lund@fathom.test`, with the password `fictional priya password`.
  - **Expected:** The top bar's right end shows `Priya Lund`.
  - **Notes:**

- [ ] `933C` Select the **Releases** page in the left-hand menu.
  - **Expected:** The row of `Fictional Spring` has a red dot in a ring in its slot, and is faintly red.
  - **Notes:**

- [ ] `F87A` Open the ⋯ menu of `Fictional Spring`.
  - **Expected:**
    - The menu shows a red dot in a ring, then "Rejected, added".
    - Under it, "Reason: Fictional reason: ship it at the end of the second cycle."
    - The menu offers **Resubmit** and **Discard draft**.
  - **Notes:**

- [ ] `B9E5` Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `E864` Select the details button at the right of the first cell of the row for `Fictional Spring`.
  - **Expected:** The release's details open, with a pencil beside **Cycles**.
  - **Notes:**

- [ ] `AFDC` Select the pencil beside **Cycles**.
  - **Expected:** A dialog opens with **First cycle** and **Last cycle**, each reading next year's first cycle.
  - **Notes:**

- [ ] `6CA7` Choose next year's second cycle in **Last cycle**, such as "27.2 (2027-04-01 to 2027-06-30)".
  - **Expected:** **Last cycle** shows the cycle chosen.
  - **Notes:**

- [ ] `ECBC` Select **Save**.
  - **Expected:**
    - The dialog closes.
    - **Cycles** lists next year's first two cycles, with a hollow yellow dot.
    - **Ships on** reads June 30 of next year.
  - **Notes:**

### DECIDE-02: A Feature Is Taken Off the Proposal With a Reason

**Account:** Product Manager, `priya.lund@fathom.test`, the same as DECIDE-01.

**Preconditions:** DECIDE-01 done.

- [ ] `0C07` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** page opens.
  - **Notes:**

- [ ] `7DF1` Select the **Proposals** tab.
  - **Expected:** The **Features** cell of `Fictional Harbour Bid` names `Fictional Tide Tables` and `Fictional Gauge Alerts`.
  - **Notes:**

- [ ] `A8B6` Select the **Features** cell of `Fictional Harbour Bid`, and press Enter.
  - **Expected:** A list of features opens, with `Fictional Tide Tables` and `Fictional Gauge Alerts` picked.
  - **Notes:**

- [ ] `2FC7` Type `Gauge`, and press Enter.
  - **Expected:** `Fictional Gauge Alerts` has no tick.
  - **Notes:**

- [ ] `DA9C` Press Enter again.
  - **Expected:** The **Features** cell names `Fictional Tide Tables` alone.
  - **Notes:**

- [ ] `F142` Select **Show details** in the ⋯ menu of `Fictional Harbour Bid`.
  - **Expected:**
    - Under **Scope history**, the first row has a hollow yellow dot, then `Fictional Gauge Alerts`.
    - Its next line reads "Removed" and today's date, in grey.
  - **Notes:**

- [ ] `13A6` Select the change button at the right of the first row under **Scope history**.
  - **Expected:** An empty box opens under "Removed" and today's date, with the cursor in it.
  - **Notes:**

- [ ] `18B5` Type `Fictional reason: the bid covers tide times only`, and press Enter.
  - **Expected:** The first row's last line reads "Reason: Fictional reason: the bid covers tide times only".
  - **Notes:**

- [ ] `14CB` Run Publish.
  - **Expected:** The Publish button, which read **Publish 2 changes**, is gone.
  - **Notes:**

### DECIDE-03: The Product Manager Approves the Others' Drafts of the Plan

**Account:** Product Manager, `priya.lund@fathom.test`, the same as DECIDE-02.

**Preconditions:** DECIDE-02 done.

- [ ] `B718` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **To decide** is chosen beside the page's title.
    - Five rows are shown, each with a tick box:
      - `Fictional Gauge Alerts`, with **Type** "Feature" and **Made by** "Dara Finch as Feature Lead"
      - `Fictional Lamp Schedule`, with **Type** "Feature" and **Made by** "Ada Quill as Engineering Manager"
      - "Keepers trained of FLR-1 Fictional Lamp Room", with **Type** "Milestone" and **Made by** "Tomas Reed as Project Manager"
      - "Fictional Spring in Fictional Mainline" and `Fictional Harbour Bid`, each made by "Priya Lund as Product Manager" and followed by a grey **Needs another approver** box
  - **Notes:**

- [ ] `B382` Tick the tick box of the row of `Fictional Gauge Alerts`.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `A1CE` Tick the tick box of the row of `Fictional Lamp Schedule`.
  - **Expected:** The button reads **Approve 2 drafts…**.
  - **Notes:**

- [ ] `7E6D` Tick the tick box of the row of "Keepers trained of FLR-1 Fictional Lamp Room".
  - **Expected:** The button reads **Approve 3 drafts…**.
  - **Notes:**

- [ ] `B97E` Select **Approve 3 drafts…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 3 drafts?" opens.
  - **Notes:**

- [ ] `B7AC` Select **Approve** in the dialog.
  - **Expected:**
    - A notification says "Approved 3 drafts."
    - The two rows of the Product Manager's own drafts are left.
  - **Notes:**

### DECIDE-04: The Engineering Director Approves the Rest

**Account:** Engineering Director, `odile.brandt@fathom.test`, changed from DECIDE-03. The first step signs in as this account.

**Preconditions:** DECIDE-03 done.

- [ ] `80B4` Sign out from the account menu, and sign in as the Engineering Director, `odile.brandt@fathom.test`, with the password `fictional odile password`.
  - **Expected:** The top bar's right end shows `Odile Brandt`.
  - **Notes:**

- [ ] `C821` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **To decide** is chosen beside the page's title.
    - Four rows are shown, each with a tick box:
      - `Harbour team`, with **Type** "Feature team" and **Made by** "Dara Finch as Feature Lead"
      - `Tide team`, with **Type** "Feature team" and **Made by** "Ada Quill as Engineering Manager"
      - "Fictional Spring in Fictional Mainline", with **Type** "Release", and `Fictional Harbour Bid`, with **Type** "Proposal", each with **Made by** "Priya Lund as Product Manager"
  - **Notes:**

- [ ] `5F2E` Tick the tick box before **Record** in the table's header.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 4 drafts…**.
  - **Notes:**

- [ ] `EEC9` Select **Approve 4 drafts…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 4 drafts?" opens.
  - **Notes:**

- [ ] `C79B` Select **Approve** in the dialog.
  - **Expected:**
    - A notification says "Approved 4 drafts."
    - The table reads "No drafts".
  - **Notes:**

### DECIDE-05: The Engineering Director Reads the Plan the Team Built

**Account:** Engineering Director, `odile.brandt@fathom.test`, the same as DECIDE-04.

**Preconditions:** DECIDE-04 done.

- [ ] `FAAD` Select the **Features** page in the left-hand menu.
  - **Expected:**
    - No row has a dot.
    - `Fictional Gauge Alerts` reads "In progress" and "40 h"; `Fictional Lamp Schedule` reads "80 h".
  - **Notes:**

- [ ] `FE07` Select **Release** in the Group by menu.
  - **Expected:**
    - One heading reads "Fictional Mainline: Fictional Spring, ships" and June 30 of next year.
    - The three features are under it.
  - **Notes:**

- [ ] `4A03` Select the **Change history** page in the left-hand menu.
  - **Expected:** The **Change history** page opens.
  - **Notes:**

- [ ] `D87A` Type `Fictional Spring` in the search box.
  - **Expected:** The entries read, newest first:
    - `Odile Brandt` "approved 4 drafts", with a line for the release `Fictional Spring`
    - `Priya Lund` "drafted changes to the release Fictional Spring in Fictional Mainline"
    - `Tomas Reed` "rejected the draft of" the release, with the reason "Fictional reason: ship it at the end of the second cycle."
    - `Priya Lund`'s entries from [Planning Features and a Release](acceptance-planning-features-and-a-release-manual-test.md), among them "drafted adding the release Fictional Spring in Fictional Mainline"
  - **Notes:**

**Afterwards:** Run [Reading the Plan](acceptance-reading-the-plan-manual-test.md) next, on this installation. To stop here instead, run [Start Again](../manual-test-basics.md#start-again).
