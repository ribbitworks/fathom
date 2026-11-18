---
title: "Manual Test: Releases"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/product/decisions.md"]
last_updated: "2026-11-17"
---

# Manual Test: Releases

## Scope

Verifies the Releases page's **Releases** tab: its table and a release's details, making a release, changing a release's name, ship day, colour and note as drafts, removing one, and rejecting and resubmitting a release's draft. [Schedules](release-schedules-manual-test.md) verifies the **Schedules** tab, [Cycles](release-cycles-manual-test.md) the **Cycles** tab, and [Release Timelines and Links](releases-timeline-manual-test.md) the timeline and the links between the tabs.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Product Manager:** `product.manager@fathom.test`
- **Project Manager:** `project.manager@fathom.test`
- **Team Member:** `team.member@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data), [Publish](manual-test-basics.md#publish) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks, the Publish button and the change button. This test adds:

- **Tabs:** the tabs **Releases**, **Cycles** and **Schedules** just after the **Releases** heading, on the same line. The page opens on **Releases**.
- **Releases table:** the table on the **Releases** tab, under the timeline, with a row for each release, grouped under a heading for each schedule. Its columns are **Release**, **Schedule**, **Ships on**, **Cycles**, **Features** and **Status**. Releases that have shipped show only once **Show shipped** is chosen in the **Views** menu.
- **A release's details:** the side panel for the selected release, headed with its name and, under it, its key. Its **Details** rows are **Release**, **Schedule**, **Ships on**, **Cycles**, **Features**, **Status**, **Colour** and **Note**.
- **Pencil:** the change button at the right of a row of **Details**, for **Release**, **Ships on**, **Cycles** and **Colour**.
- **A release's ⋯ menu:** the ⋯ menu of a release's row. It offers **Remove release**, and **Add note…** while the release has no note, to those who change releases, **Discard draft** and **Resubmit** for the release's draft, and **Approve…** and **Reject…** to an account whose role approves its drafts.
- **Timeline:** the section headed **Timeline** above the table, with the zoom buttons **All**, **Year**, **6 months**, **Quarter**, **Month**, **Week** and **Days** at its top right. It has a row for each schedule the table lists, named on the left, with each release as a strip of its colour and a diamond on the day it ships, over the schedule's cycles, which are drawn faint.
- **Seeded dates in this test:** 'Lantern 3' is the 'Field Apps' release two cycles after the current one. The examples after "such as" are as the seed data is when added on 17 November 2026.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out. To run the test again, start again from Restore the Seed Data.

### Part 1: Changing a Release

#### REL-12: A Release Is Changed by a Draft

**Account:** Product Manager, `product.manager@fathom.test`; the first test case.

**Preconditions:** Restore the Seed Data run, then signed in with this account. **Releases** page open from the left-hand menu.

- [ ] `285E` Select the details button at the right of the first cell of the row for 'Lantern 3'.
  - **Expected:**
    - The side panel opens, headed 'Lantern 3'.
    - Under the name, its key reads "#RELEASE-" and a number.
  - **Notes:**

- [ ] `3F25` Select the pencil at the right of the **Release** row.
  - **Expected:**
    - A dialog titled "Rename Lantern 3" opens.
    - Its one field, **Name**, holds 'Lantern 3'.
  - **Notes:**

- [ ] `3CA7` Replace the name with `Lantern Three`.
  - **Expected:** The **Name** box holds `Lantern Three`.
  - **Notes:**

- [ ] `43E8` Select **Save**.
  - **Expected:**
    - The dialog closes, and a notification says "Drafted the change to the release."
    - The side panel's heading shows a hollow yellow dot before `Lantern Three`.
    - In the table, the row's **Release** shows a hollow yellow dot before `Lantern Three`.
  - **Notes:**

- [ ] `3E52` Run Publish.
  - **Expected:** The dot before `Lantern Three`, in the table and the panel's heading, is now solid yellow.
  - **Notes:**

#### REL-13: A Rejected Draft Says Why It Was Rejected

**Account:** Project Manager, `project.manager@fathom.test`, changed from REL-12.

**Preconditions:** Run after REL-12. Signed in with this account. **Releases** page open from the left-hand menu.

- [ ] `E857` Select the **⋯** at the right of the first cell of the row for `Lantern Three`, then **Reject…**.
  - **Expected:**
    - A dialog titled "Reject 1 draft?" opens.
    - It has a **Reason** box.
  - **Notes:**

- [ ] `EC7D` Type `Keep the old name` in **Reason**.
  - **Expected:** The **Reason** box holds `Keep the old name`.
  - **Notes:**

- [ ] `784C` Select **Reject**.
  - **Expected:**
    - A notification says "Rejected 1 draft."
    - In the table, a red dot in a ring is before `Lantern Three`.
  - **Notes:**

#### REL-14: A Rejected Draft Can Be Resubmitted

**Account:** Product Manager, `product.manager@fathom.test`, changed from REL-13.

**Preconditions:** Run after REL-13. Signed in with this account. **Releases** page open from the left-hand menu.

- [ ] `331A` Select the **⋯** at the right of the first cell of the row for `Lantern Three`.
  - **Expected:**
    - Its draft section is headed by a red dot in a ring and "Rejected".
    - Under the heading, it reads "Reason: Keep the old name".
    - It offers **Resubmit** and **Discard draft**.
  - **Notes:**

- [ ] `6DE5` Select **Resubmit**.
  - **Expected:**
    - A notification says "Resubmitted the draft."
    - In the table, a yellow dot is before `Lantern Three` again.
  - **Notes:**

#### REL-15: A Release Is Removed by a Draft

**Account:** Product Manager, `product.manager@fathom.test`, the account REL-14 ended with.

**Preconditions:** Run after REL-14. **Releases** page open, with **Year** chosen on the timeline.

- [ ] `C20C` Select the **⋯** at the right of the first cell of the row for 'Lantern 2', then **Remove release**.
  - **Expected:**
    - A notification says "Drafted removing Lantern 2."
    - The row for 'Lantern 2' has a hollow yellow dot in its slot, and is struck through.
  - **Notes:**

- [ ] `25FE` Read the row for 'Field Apps' on the timeline.
  - **Expected:** The strip of 'Lantern 2' is struck through, with a hollow yellow dot before its name.
  - **Notes:**

- [ ] `1DF3` Select the **⋯** at the right of the first cell of the row for 'Lantern 2', then **Discard draft**.
  - **Expected:**
    - A notification says "Discarded the draft."
    - The row for 'Lantern 2' has no dot and is not struck through.
    - On the timeline, 'Lantern 2' is not struck through and has no dot.
  - **Notes:**

#### REL-17: A Release Ships on a Day of Its Own

**Account:** Product Manager, `product.manager@fathom.test`, the account REL-15 ended with.

**Preconditions:** Run after REL-15. **Releases** page open, with no side panel open.

- [ ] `1179` Select the details button at the right of the first cell of the row for `Lantern Three`.
  - **Expected:** The side panel opens, headed by a yellow dot and `Lantern Three`.
  - **Notes:**

- [ ] `DC88` Select the pencil at the right of the **Ships on** row.
  - **Expected:**
    - A dialog titled "Change when Lantern Three ships" opens, with only a **Ships on** field, which is empty.
    - Under it, "Leave empty to ship at the end of its last cycle, on" and that cycle's last day, such as "2027-12-31".
  - **Notes:**

- [ ] `DED5` Type the day a month after that one in **Ships on**, as its digits, such as `20280131`.
  - **Expected:**
    - **Ships on** shows that day, such as `2028-01-31`.
    - The line under it starts "Ships".
  - **Notes:**

- [ ] `C5B2` Select **Save**.
  - **Expected:**
    - The dialog closes, and a notification says "Drafted the change to the release."
    - **Ships on** in the side panel reads the day typed, such as "Jan 31, 2028", after a hollow yellow dot.
  - **Notes:**

- [ ] `9792` Select **All** at the top right of the timeline.
  - **Expected:** In the row for 'Field Apps', a dashed line runs from the right end of the strip of `Lantern Three` to its diamond, on the day typed.
  - **Notes:**

- [ ] `5D17` Select the **⋯** at the right of the first cell of the row for `Lantern Three`, then **Discard draft**.
  - **Expected:**
    - A notification says "Discarded the draft."
    - The row reads 'Lantern 3', with no dot.
    - Its **Ships on** is the last day of its cycle again, such as "Dec 31, 2027".
    - On the timeline, its diamond is under the right end of its strip, with no dashed line.
  - **Notes:**

#### REL-22: A Release's Colour Is Chosen in Its Dialog

**Account:** Product Manager, `product.manager@fathom.test`, the account REL-17 ended with.

**Preconditions:** Run after REL-17. **Releases** page open, with the details of 'Lantern 3' open beside the table.

- [ ] `962F` Select the pencil at the right of the **Colour** row.
  - **Expected:**
    - A dialog titled "Change the colour of Lantern 3" opens.
    - Its one field, **Colour**, reads "Lime", with a lime square before it.
    - "How the release is drawn on the timeline" is under its label.
  - **Notes:**

- [ ] `2CB3` Open **Colour**.
  - **Expected:**
    - The list offers "Sea (default)", then "Indigo", "Violet", "Grape", "Pink", "Red", "Orange", "Yellow", "Lime", "Green" and "Teal".
    - Each has a square of its colour.
  - **Notes:**

- [ ] `50B5` Select **Teal**.
  - **Expected:** **Colour** reads "Teal", with a teal square before it.
  - **Notes:**

- [ ] `CE70` Select **Save**.
  - **Expected:**
    - The dialog closes, and a notification says "Drafted the change to the release."
    - In the side panel, **Colour** reads "Teal", after a hollow yellow dot.
    - In the table, the square before 'Lantern 3' is teal.
    - On the timeline, the strip of 'Lantern 3' is teal.
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes.

#### REL-27: A Release's Note Is Written Beside Its Details

**Account:** Product Manager, `product.manager@fathom.test`, the account REL-22 ended with.

**Preconditions:** Run after REL-22. **Releases** page open, with no side panel open.

- [ ] `AF73` Select the **⋯** at the right of the first cell of the row for 'Lantern 3', then **Add note…**.
  - **Expected:**
    - The details of 'Lantern 3' open beside the table.
    - Beside them, a panel titled "Note for Lantern 3" opens, with an empty note ready for typing and **Save** at the bottom.
  - **Notes:**

- [ ] `E879` Type `Ships with the new depot maps`.
  - **Expected:** The note reads `Ships with the new depot maps`.
  - **Notes:**

- [ ] `AAD0` Select **Save**.
  - **Expected:**
    - The note's panel closes, and a notification says "Drafted the note on Lantern 3."
    - The **Note** row of the details reads `Ships with the new depot maps`, after a hollow yellow dot.
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes.

### Part 2: The Releases Tab With the Seed Data

#### REL-37: The Releases Tab Shows Each Release

**Account:** Product Manager, `product.manager@fathom.test`, the account REL-27 ended with.

**Preconditions:** Restore the Seed Data run, then signed in with this account.

- [ ] `F2C3` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - **Releases** is the tab chosen, and the button at the top right reads **New release**.
    - The table's columns are, in order: **Release**, **Schedule**, **Ships on**, **Cycles**, **Features** and **Status**.
    - The rows are under the headings 'Platform', 'Patches' and 'Field Apps'.
  - **Notes:**

- [ ] `C42A` Read the rows under 'Field Apps'.
  - **Expected:**
    - 'Lantern 2' and 'Lantern 3' are listed, in that order.
    - The **Ships on** day of 'Lantern 2' is later than the last day of its last cycle.
  - **Notes:**

- [ ] `9E90` Read the row for 'Harbor 3', under 'Platform'.
  - **Expected:**
    - **Ships on** is a day, and **Cycles** names its first and last cycles, such as "27.2 to 28.1".
    - **Ships on** and **Cycles** each have a yellow dot before them.
    - **Status** is blank.
  - **Notes:**

- [ ] `6E0B` Read the light green **Live** row under the row for 'Harbor 3'.
  - **Expected:** Its **Ships on** and **Cycles** show an earlier day and earlier cycles than the row above.
  - **Notes:**

- [ ] `5509` Open the **Views** menu.
  - **Expected:** It offers "Show shipped (3)".
  - **Notes:**

- [ ] `B630` Select **Show shipped**.
  - **Expected:**
    - 'Harbor 1' is listed under 'Platform', and **Status** reads "Shipped".
    - Under 'Patches', the release that has shipped is listed too, and **Status** reads "Shipped".
    - Under 'Field Apps', 'Lantern 1' is listed before 'Lantern 2', and **Status** reads "Shipped".
    - 'Harbor 1' is drawn on the timeline above the table.
  - **Notes:**

- [ ] `8A1D` Select **Filter…** in the **Schedule** column's menu.
  - **Expected:** A dialog opens listing 'Platform', 'Patches' and 'Field Apps', each with a checkbox.
  - **Notes:**

- [ ] `3D7A` Tick 'Platform'.
  - **Expected:**
    - Every release listed reads 'Platform' in **Schedule**, and none reads 'Patches'.
    - A pill above the table reads "Schedule: Platform".
    - The timeline above the table draws only 'Platform'.
  - **Notes:**

#### REL-38: A Release's Details Offer Its Note and a Pencil for Each Value

**Account:** Product Manager, `product.manager@fathom.test`, the account REL-37 ended with.

**Preconditions:** **Releases** page selected again in the left-hand menu, so the **Releases** tab shows with no filter, grouped by schedule, and shipped releases hidden.

- [ ] `EC21` Select the details button at the right of the first cell of the row for 'Harbor 2 LTS'.
  - **Expected:**
    - The side panel opens, headed 'Harbor 2 LTS'.
    - Under **Details**, the rows are, in order: **Release**, **Schedule**, **Ships on**, **Cycles**, **Features**, **Status**, **Colour** and **Note**.
    - **Status** reads "Not shipped", and **Schedule** reads 'Platform'.
    - **Note** shows the release's whole note.
  - **Notes:**

- [ ] `7E5C` Select the open button at the right of the **Note** row.
  - **Expected:** A panel titled "Note for Harbor 2 LTS" opens beside the release's details.
  - **Notes:**

- [ ] `A106` Select the **×** at the top right of the note's panel.
  - **Expected:** The release's details are still open.
  - **Notes:**

- [ ] `DEB6` Point at the **Ships on** row.
  - **Expected:** A pencil shows at the row's right.
  - **Notes:**

- [ ] `F33C` Select the pencil.
  - **Expected:** A dialog titled "Change when Harbor 2 LTS ships" opens, with only a **Ships on** field.
  - **Notes:**

- [ ] `1443` Select **Cancel**.
  - **Expected:** The dialog closes, and nothing in the panel has changed.
  - **Notes:**

#### REL-39: A Release Is Added to a Schedule Chosen

**Account:** Product Manager, `product.manager@fathom.test`, the account REL-38 ended with.

**Preconditions:** **Releases** page open on the **Releases** tab.

- [ ] `6B37` Select **New release**.
  - **Expected:** A dialog opens whose first field is **Schedule**.
  - **Notes:**

- [ ] `4C8F` Open the **Schedule** list.
  - **Expected:** It offers 'Platform' and 'Field Apps', and not 'Patches'.
  - **Notes:**

- [ ] `35C5` Choose 'Platform'.
  - **Expected:** **First cycle** and **Last cycle** offer Platform's cycles.
  - **Notes:**

- [ ] `864E` Type `Fictional Harbor` in **Name**.
  - **Expected:** The name is in the field.
  - **Notes:**

- [ ] `3D01` Choose the cycle of the quarter after this quarter in **First cycle**, such as '27.1'.
  - **Expected:**
    - **First cycle** and **Last cycle** both read that cycle.
    - The dialog shows no problem.
  - **Notes:**

- [ ] `EA8F` Select **Make release**.
  - **Expected:**
    - The dialog closes, and a notification says "Drafted the new release."
    - 'Fictional Harbor' is listed under 'Platform', with a hollow dot in its slot.
    - Its details are open beside the table.
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes.

#### REL-40: A Role That Can't Change Releases Sees No Pencils

Covered by [REL-35](release-schedules-manual-test.md#rel-35-a-role-that-cant-change-schedules-sees-no-pencils), which checks that a role that can't change a record sees no pencils in its details.
