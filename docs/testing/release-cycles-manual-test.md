---
title: "Manual Test: Cycles"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md"]
last_updated: "2026-11-18"
---

# Manual Test: Cycles

## Scope

Verifies the Releases page's **Cycles** tab: its table and a cycle's details, changing one cycle's length with the cycles and releases after it moving or keeping their dates, and approving and discarding those drafts. [Schedules](release-schedules-manual-test.md) verifies the **Schedules** tab, [Releases](releases-manual-test.md) the **Releases** tab, and [Release Timelines and Links](releases-timeline-manual-test.md) the timeline and the links between the tabs.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**
- **Second Workforce Administrator:** `engineering.operations.manager.2@fathom.test`, shown in Fathom as **Second Engineering Operations Manager**
- **Project Manager:** `project.manager@fathom.test`
- **Team Member:** `team.member@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data), [Publish](manual-test-basics.md#publish) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks, the Publish button and the change button. This test adds:

- **Tabs:** the tabs **Releases**, **Cycles** and **Schedules** just after the **Releases** heading, on the same line. The page opens on **Releases**.
- **Cycles table:** the table on the **Cycles** tab, under the timeline, with a row for each cycle. Its columns are **Cycle**, **Schedule**, **Starts**, **Ends**, **Current**, **Release** and **Features**. Cycles that have ended, and those starting after next quarter, show only once **Show past cycles** or **Show later cycles** is chosen in the **Views** menu.
- **A cycle's details:** the side panel for the selected cycle, headed with its schedule's name, a colon and the cycle's name, such as "Platform: 27.1". Its **Details** rows are the table's columns, then **Duration**.
- **Duration pencil:** the change button at the right of the **Duration** row of a cycle's details. It opens a menu of **This cycle only…** and **This and later cycles…**.
- **A cycle's ⋯ menu:** the ⋯ menu of a cycle's row, which names the draft that changes the cycle, if any, and offers **Discard draft** and **Resubmit** to those who change schedules, and **Approve…** and **Reject…** to an account whose role approves its drafts.
- **Schedules tab:** the tab with a row for each schedule, whose ⋯ menu decides and discards a schedule's drafts.
- **Seeded dates in this test:** **This quarter** is the quarter today is in, and **the first half** is Platform's first half-year cycle, three quarters after this quarter. The examples after "such as" are as the seed data is when added on 17 November 2026.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. REL-23 to REL-26 change cycles' lengths; REL-41 restores the seed data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out. To run the test again, start again from Restore the Seed Data.

### Part 1: Changing One Cycle's Length

#### REL-23: A Cycle's New Length Moves the Cycles and Releases After It

**Account:** Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`; the first test case. Step `6FE2` signs in as another account, and step `B6FF` as the Workforce Administrator.

**Preconditions:** Restore the Seed Data run, then signed in with this account.

- [ ] `11A6` Run Discard the Unpublished Changes.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `6FE2` Sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Project Manager**.
  - **Notes:**

- [ ] `F216` Select the **Releases** page in the left-hand menu.
  - **Expected:** The **Releases** tab is chosen.
  - **Notes:**

- [ ] `1C47` Select the **Schedules** tab.
  - **Expected:** 'Platform' has no grey lock in its slot.
  - **Notes:**

- [ ] `39A5` Select the **⋯** at the right of the first cell of the row for 'Platform', then **Approve…**.
  - **Expected:** A dialog titled "Approve 3 drafts?" opens.
  - **Notes:**

- [ ] `A102` Select **Approve**.
  - **Expected:**
    - A notification says "Approved 3 drafts."
    - 'Platform' has no dot in the table.
  - **Notes:**

- [ ] `B6FF` Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Operations Manager**.
  - **Notes:**

- [ ] `196D` Select the **Releases** page in the left-hand menu.
  - **Expected:** The **Releases** tab is chosen.
  - **Notes:**

- [ ] `4DF0` Select the **Cycles** tab.
  - **Expected:** The rows show as one list, with no headings.
  - **Notes:**

- [ ] `898A` Select **Group by** above the table, then **Schedule**.
  - **Expected:** The rows are under the headings 'Platform', 'Patches' and 'Field Apps'.
  - **Notes:**

- [ ] `B1AB` Select the details button at the right of the first cell of the row under 'Platform' for next quarter's cycle, such as '27.1'.
  - **Expected:** The side panel opens, headed "Platform:" and the cycle's name, such as "Platform: 27.1".
  - **Notes:**

- [ ] `9A23` Select the pencil at the right of the **Duration** row.
  - **Expected:** A menu offers **This cycle only…** and **This and later cycles…**.
  - **Notes:**

- [ ] `1DD2` Select **This cycle only…**.
  - **Expected:**
    - A dialog titled "Change the length of" and the cycle's name opens, such as "Change the length of 27.1".
    - **Length** reads `3`, followed by "months", with the cycle's dates under its label.
    - Under **Later cycles**, **Move with it** is selected, and **Keep their dates** is offered.
    - **New dates** lists that cycle and the next one, each a quarter long, and the first half, half a year long, such as `27.1`, `2027-01-01 to 2027-03-31`; `27.2`, `2027-04-01 to 2027-06-30`; and `27.3`, `2027-07-01 to 2027-12-31`.
  - **Notes:**

- [ ] `E427` Replace `3` in **Length** with `2`.
  - **Expected:**
    - **New dates** lists the cycle two months long, then the next a quarter and the first half half a year, such as `27.1`, `2027-01-01 to 2027-02-28`; `27.2`, `2027-03-01 to 2027-05-31`; and `27.3`, `2027-06-01 to 2027-11-30`.
    - Under **Releases that move**: 'Harbor 3' and 'Harbor 4'.
    - Under **Features that move**: 'Data Retention Controls' and 'Report Builder'.
    - Below them, a line for each release that moves says the day it now ships, such as "Harbor 3 ships 2028-05-31." and "Harbor 4 ships 2028-11-30."
  - **Notes:**

- [ ] `CDF0` Select **Change length**.
  - **Expected:**
    - The dialog closes, and a notification says "Drafted the new length."
    - In the side panel, **Duration** reads "2 months", after a hollow yellow dot.
    - In the table, the cycle's row has a hollow yellow dot in its slot, and its **Ends** is the cycle's new last day, such as "Feb 28, 2027".
  - **Notes:**

- [ ] `4CBE` Run Publish.
  - **Expected:** The dots before **Duration** and in the cycle's row are solid yellow.
  - **Notes:**

#### REL-24: Approving One Draft of a New Length Approves Them All

**Account:** Project Manager, `project.manager@fathom.test`, changed from REL-23.

**Preconditions:** Run after REL-23. Signed in with this account. **Releases** page open from the left-hand menu, then the **Cycles** tab, grouped by **Schedule** from **Group by** above the table.

- [ ] `1913` Select the **⋯** at the right of the first cell of the row under 'Platform' for the cycle REL-23 changed, such as '27.1', then **Approve…**.
  - **Expected:**
    - A dialog titled "Approve 7 drafts?" opens.
    - It says "Also approves the drafts these depend on:", then lists six drafts, among them the releases 'Harbor 3' and 'Harbor 4', and the features 'Data Retention Controls' and 'Report Builder'.
  - **Notes:**

- [ ] `3A60` Select **Approve**.
  - **Expected:**
    - A notification says "Approved 7 drafts."
    - No row under 'Platform' has a dot.
    - The changed cycle's **Ends** is still its new last day, such as "Feb 28, 2027".
  - **Notes:**

#### REL-25: Later Cycles Can Keep Their Dates

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from REL-24.

**Preconditions:** Run after REL-24. Signed in with this account. **Releases** page open from the left-hand menu, then the **Schedules** tab.

- [ ] `B25E` Select the **⋯** at the right of the first cell of the row for 'Patches', then **Discard draft**.
  - **Expected:**
    - A notification says "Discarded the draft."
    - 'Patches' has no **Retired** box.
  - **Notes:**

- [ ] `B1A5` Select the **Cycles** tab.
  - **Expected:** The rows show as one list, with no headings.
  - **Notes:**

- [ ] `5B45` Select **Group by** above the table, then **Schedule**.
  - **Expected:** The rows are under the headings 'Platform', 'Patches' and 'Field Apps'.
  - **Notes:**

- [ ] `A5F5` Select the details button at the right of the first cell of the row under 'Patches' after the one whose **Current** reads "Current".
  - **Expected:**
    - The side panel opens, headed "Patches:" and the cycle's name.
    - **Duration** reads "4 weeks".
  - **Notes:**

- [ ] `9490` Select the pencil at the right of the **Duration** row.
  - **Expected:** A menu offers **This cycle only…** and **This and later cycles…**.
  - **Notes:**

- [ ] `3DF6` Select **This cycle only…**.
  - **Expected:** A dialog titled "Change the length of" and the cycle's name opens.
  - **Notes:**

- [ ] `045F` Replace `4` in **Length** with `2`.
  - **Expected:** **Length** reads `2`, followed by "weeks".
  - **Notes:**

- [ ] `B0CC` Select **Keep their dates**.
  - **Expected:**
    - **New dates** lists that cycle two weeks long, then the next cycle from the day after to the end of the cycle after it, six weeks long, then the cycle after that, four weeks long.
    - Below it, a line says the later patch release ships on the changed cycle's new last day, such as "Patch January ships 2026-12-27."
  - **Notes:**

- [ ] `58F4` Select **Change length**.
  - **Expected:** The dialog closes, and a notification says "Drafted the new length."
  - **Notes:**

- [ ] `CD05` Run Publish.
  - **Expected:**
    - In the side panel, **Duration** reads "2 weeks", after a yellow dot.
    - In the table, the rows of the changed cycle and the cycle after it each have a yellow dot in their slot.
    - The changed cycle's **Ends** is two weeks after its **Starts**.
  - **Notes:**

#### REL-26: Discarding One Draft of a New Length Discards Them All

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account REL-25 ended with.

**Preconditions:** Run after REL-25. **Releases** page open on the **Cycles** tab, grouped by **Schedule**, as REL-25 leaves it.

- [ ] `BC43` Select the **⋯** at the right of the first cell of the row under 'Patches' after the cycle REL-25 changed, then **Discard draft**.
  - **Expected:** A notification says "Discarded the draft."
  - **Notes:**

- [ ] `0DE5` Read the rows under 'Patches'.
  - **Expected:**
    - No row has a dot.
    - The cycle REL-25 changed ends four weeks after it starts again.
  - **Notes:**

### Part 2: The Cycles Tab With the Seed Data

#### REL-41: The Cycles Tab Lists Every Schedule's Cycles

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account REL-26 ended with.

**Preconditions:** Restore the Seed Data run, then signed in with this account. **Releases** page open.

- [ ] `4BA7` Select the **Cycles** tab.
  - **Expected:**
    - **Cycles** is chosen, and there is no button at the top right.
    - The table's columns are, in order: **Cycle**, **Schedule**, **Starts**, **Ends**, **Current**, **Release** and **Features**.
    - The rows show as one list, with no headings.
  - **Notes:**

- [ ] `6B2A` Select **Group by** above the table, then **Schedule**.
  - **Expected:** The rows are under the headings 'Platform', 'Patches' and 'Field Apps'.
  - **Notes:**

- [ ] `20B5` Read the first row under 'Field Apps'.
  - **Expected:**
    - **Cycle** is a name starting with "FA", and **Schedule** reads 'Field Apps'.
    - **Starts** is on or before today, and **Ends** is on or after today.
    - **Current** reads "Current".
    - **Release** shows a small coloured square, then 'Lantern 2'.
  - **Notes:**

- [ ] `559C` Read the second row under 'Field Apps'.
  - **Expected:**
    - **Starts** is the day after the first row's **Ends**.
    - **Current** and **Release** are blank.
  - **Notes:**

- [ ] `1E5A` Select **Filter…** in the **Current** column's menu.
  - **Expected:** A dialog opens with one checkbox, **Current**, and nothing else.
  - **Notes:**

- [ ] `6450` Tick **Current**.
  - **Expected:**
    - Each of 'Platform', 'Patches' and 'Field Apps' has one row under it.
    - Each row's **Current** reads "Current".
  - **Notes:**

- [ ] `276A` Untick **Current**.
  - **Expected:** The rows listed before the box was ticked are listed again.
  - **Notes:**

- [ ] `C4B0` Open the **Views** menu.
  - **Expected:**
    - It offers "Show past cycles" and how many cycles have ended, such as "Show past cycles (7)".
    - It offers "Show later cycles" and how many more cycles there are.
  - **Notes:**

- [ ] `E2B2` Select **Show past cycles**.
  - **Expected:**
    - Two more rows are listed under 'Field Apps', before the one whose **Current** reads "Current".
    - The first of them has a blank **Release**, and the second shows a square, then 'Lantern 1'.
  - **Notes:**

- [ ] `B184` Read the last row under 'Platform'.
  - **Expected:** Its **Starts** is no later than the last day of the quarter after this quarter.
  - **Notes:**

- [ ] `24B9` Select **Show later cycles** in the **Views** menu.
  - **Expected:**
    - More rows are listed under each heading, after those listed before.
    - The last row under 'Platform' has a **Starts** on or before the day two years from today, and an **Ends** on or after it.
  - **Notes:**

#### REL-42: A Cycle's Duration Is Changed From Its Details

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account REL-41 ended with.

**Preconditions:** **Releases** page selected again in the left-hand menu, then the **Cycles** tab.

- [ ] `2B13` Select **Group by** above the table, then **Schedule**.
  - **Expected:** The rows are under the headings 'Platform', 'Patches' and 'Field Apps'.
  - **Notes:**

- [ ] `BC9F` Select the details button at the right of the first cell of the second row under 'Field Apps'.
  - **Expected:**
    - The side panel opens, headed "Field Apps:" and the cycle's name, as **Cycle** reads it in the row.
    - Under **Details**, the rows are, in order: **Cycle**, **Schedule**, **Starts**, **Ends**, **Current**, **Release**, **Features** and **Duration**.
    - **Current** reads "Not current".
    - **Release** reads "None".
    - **Duration** reads "6 months".
  - **Notes:**

- [ ] `17EB` Point at the **Duration** row.
  - **Expected:** A pencil shows at the row's right, and no other row shows one.
  - **Notes:**

- [ ] `1D29` Select the pencil.
  - **Expected:** A menu offers **This cycle only…** and **This and later cycles…**.
  - **Notes:**

- [ ] `36DD` Select **This cycle only…**.
  - **Expected:** A dialog opens titled "Change the length of" and the cycle's name, with a **Length** field reading `6`.
  - **Notes:**

- [ ] `2982` Clear **Length** and type `5`.
  - **Expected:** **Length** reads `5`, and the dialog shows no problem.
  - **Notes:**

- [ ] `DA6C` Select **Change length**.
  - **Expected:**
    - The dialog closes.
    - **Duration** in the side panel reads "5 months", after a hollow dot.
    - In the table, the cycle's row has a hollow dot in its slot.
  - **Notes:**

- [ ] `965D` Select **⋯** at the right of the first cell of the cycle's row.
  - **Expected:**
    - The menu's heading names the draft after a hollow dot.
    - Under it, a line reads "Part of a change to the cycles of Field Apps from" and the cycle's name.
    - Lines under it name **Ends** and **Duration**, each with its value before and after.
    - It offers **Discard draft**.
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes.

#### REL-43: A Role That Can't Change Schedules Sees No Duration Pencil

Covered by [REL-35](release-schedules-manual-test.md#rel-35-a-role-that-cant-change-schedules-sees-no-pencils), which checks that a role that can't change schedules sees no **Duration** pencil.
