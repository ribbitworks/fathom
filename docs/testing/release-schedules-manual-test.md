---
title: "Manual Test: Schedules"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md"]
last_updated: "2026-11-27"
---

# Manual Test: Schedules

## Scope

Verifies the Releases page's **Schedules** tab: adding a schedule and setting up its cycles, the table and a schedule's details, retiring and approving a schedule, and that a role that can't change schedules sees no pencils. [Releases](releases-manual-test.md) verifies the **Releases** tab, [Cycles](release-cycles-manual-test.md) the **Cycles** tab, and [Release Timelines and Links](releases-timeline-manual-test.md) the timeline and the links between the tabs.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**
- **Project Manager:** `project.manager@fathom.test`
- **Team Member:** `team.member@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Start From an Empty Database](manual-test-basics.md#start-from-an-empty-database), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data), [Publish](manual-test-basics.md#publish) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks, the Publish button and the change button. This test adds:

- **Tabs:** the tabs **Releases**, **Cycles** and **Schedules** just after the **Releases** heading, on the same line. The page opens on **Releases**, or on the tab it last showed.
- **Schedules table:** the table on the **Schedules** tab, under the timeline, with a row for each schedule. Its columns are **Schedule**, **Current cycle**, **Cycle starts**, **Cycle ends**, **Features this cycle**, **Next release**, **Release date**, **Cycle length** and **Schedule ends**. While any schedule is retired, **Show retired** and how many are retired is in the **Views** menu.
- **Selecting a schedule in the table:** selecting the details button at the right of the first cell of the schedule's row, which opens the schedule in the side panel.
- **A schedule's details:** the side panel for the selected schedule, with the sections **Details** and **Cycles**. **Details** has a row for each of the table's columns, then **Name pattern**. **Cycles** is a table with the columns **Cycle**, **Starts**, **Ends** and **Duration**.
- **Pencil:** the change button at the right of a row of **Details**. In **Cycles**, the pencil in a cycle's **Duration** cell opens a menu of **This cycle only…** and **This and later cycles…**.
- **A schedule's ⋯ menu:** the ⋯ menu of a schedule's row. The **⋯** at the top of the schedule's side panel opens the same menu.
- **Seeded dates in this test:** the cycle today is in, such as '26.4', is Platform's current cycle. The examples after "such as" are as the seed data is when added on 17 November 2026.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Start From an Empty Database. REL-01 to REL-05 start from an empty database; REL-06 adds the seed data; REL-31 restores it.

Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out. To run the test again, start again from Start From an Empty Database.

### Part 1: From an Empty Database

#### REL-01: A New Fathom Starts With No Schedules

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Start From an Empty Database run, then signed in with this account.

- [ ] `575D` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The tabs **Releases**, **Cycles** and **Schedules** are beside the **Releases** heading, and **Releases** is chosen.
    - The Export icon at the top right is greyed out.
    - The search box, **Views** and "0 releases" are above the table.
    - There is no timeline.
    - The table shows its column headings, starting **Release**, **Schedule**, **Ships on**.
    - In the table, dimmed, it reads "No releases yet", with the link **Make a schedule first** under it.
  - **Notes:**

- [ ] `4C1A` Point at the greyed-out Export icon.
  - **Expected:** A tip reads "There's nothing to export".
  - **Notes:**

- [ ] `6F1D` Select **Make a schedule first** in the table.
  - **Expected:**
    - The **Schedules** tab is chosen.
    - The table shows its column headings, starting **Schedule**.
    - In the table, dimmed, it reads "No schedules yet".
    - "0 schedules" is above the table.
    - A **New schedule** button is at the top right, with the focus on it.
  - **Notes:**

#### REL-02: The Engineering Operations Manager Drafts a New Schedule

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account REL-01 ended with.

**Preconditions:** Run after REL-01. **Releases** page open on the **Schedules** tab.

- [ ] `BE80` Select **New schedule** at the top right of the page.
  - **Expected:**
    - A dialog titled "New schedule" opens.
    - It has a **Name** box.
  - **Notes:**

- [ ] `B5F3` Type `Testing Schedule` in **Name**.
  - **Expected:** The **Name** box holds `Testing Schedule`.
  - **Notes:**

- [ ] `DEC9` Select **Add schedule**.
  - **Expected:**
    - The dialog closes, and a notification says "Drafted the new schedule."
    - The schedules table shows one row, `Testing Schedule`, with a hollow yellow dot in its slot.
    - The side panel opens on the right, headed by a hollow yellow dot and `Testing Schedule`.
    - Under **Cycles**, it reads "None".
  - **Notes:**

#### REL-03: A New Schedule's Cycles Show Their Names Before They Are Saved

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account REL-02 ended with.

**Preconditions:** Run after REL-02. `Testing Schedule` open in the side panel.

- [ ] `CC32` In the side panel, select the pencil at the right of the **Name pattern** row.
  - **Expected:**
    - A dialog titled "Set up cycles for Testing Schedule" opens.
    - The **First cycle starts** box is empty, showing the example date `2027-01-01` in grey.
    - **Each cycle lasts** is set to `3`.
    - **Months** is selected.
    - **Names** is set to `{YY}.{N}`.
  - **Notes:**

- [ ] `0CC6` Type `20270104` in **First cycle starts**.
  - **Expected:** The box shows `2027-01-04`.
  - **Notes:**

- [ ] `FBA3` Replace `3` in **Each cycle lasts** with `2`.
  - **Expected:** **Each cycle lasts** reads `2`.
  - **Notes:**

- [ ] `5CDA` Select **Weeks**.
  - **Expected:** Under **First cycles**, three lines:
    - `27.1` with `Jan 4 to Jan 17, 2027`.
    - `27.2` with `Jan 18 to Jan 31, 2027`.
    - `27.3` with `Feb 1 to Feb 14, 2027`.
  - **Notes:**

- [ ] `2BC4` Replace **Names** with `Sprint {#}`.
  - **Expected:** The three lines under **First cycles** now start with `Sprint 1`, `Sprint 2` and `Sprint 3`.
  - **Notes:**

- [ ] `1E14` Select **Set up cycles**.
  - **Expected:**
    - The dialog closes, and a notification says "Drafted the cycles."
    - Under **Details**, **Name pattern** reads `Sprint {#}`.
    - **Cycle length** reads "2 weeks".
    - **Schedule ends** reads "No end date".
    - The **Cycles** table lists six cycles, from `Sprint 1`, which starts on Jan 4, 2027.
    - Under the table, "Show all" and how many cycles there are.
  - **Notes:**

- [ ] `7D69` Run Publish.
  - **Expected:** The dot before `Testing Schedule`, in the table and in the panel's heading, is now solid yellow.
  - **Notes:**

#### REL-04: The Product Manager Makes a Release From a Schedule's Cycles

Covered by [REL-39](releases-manual-test.md#rel-39-a-release-is-added-to-a-schedule-chosen), which makes a release in a schedule chosen.

#### REL-05: Approving a New Schedule Approves Its Cycles With It

**Account:** Project Manager, `project.manager@fathom.test`, changed from REL-03.

**Preconditions:** Run after REL-03. Signed in with this account. **Releases** page open from the left-hand menu, then the **Schedules** tab.

- [ ] `1115` Select the **⋯** at the right of the first cell of the row for `Testing Schedule`, then **Approve draft…**.
  - **Expected:** A dialog titled "Approve 2 drafts?" opens.
  - **Notes:**

- [ ] `A9B9` Select **Approve**.
  - **Expected:**
    - A notification says "Approved 2 drafts."
    - `Testing Schedule` no longer has a dot in the table.
  - **Notes:**

### Part 2: With the Seed Data

#### REL-06: The Seed Data Adds Three Schedules

**Account:** Team Member, `team.member@fathom.test`, changed from REL-05.

**Preconditions:** Run after REL-05. Signed in with this account. **Releases** page open from the left-hand menu, then the **Schedules** tab.

- [ ] `9A9D` Run Restore the Seed Data.
  - **Expected:**
    - After the page reloads, the **Schedules** tab is chosen.
    - The table shows `Testing Schedule`, 'Platform', 'Patches' and 'Field Apps', in that order, under no heading.
    - 'Platform' has a grey lock in its slot.
    - 'Patches' has a yellow dot in its slot, and the yellow **Retired** box follows its name.
    - There is no **New schedule** button.
  - **Notes:**

#### REL-07: A Schedule's Cycles Show How Long Each Lasts

Covered by [REL-32](#rel-32-a-schedules-details-follow-its-row), which reads a schedule's **Cycles**.

#### REL-08: Cycles Change Only From the Start of a Cycle

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from REL-06.

**Preconditions:** Run after REL-06. Signed in with this account. **Releases** page open from the left-hand menu, then the **Schedules** tab, with `Testing Schedule` selected in the table.

- [ ] `A34D` In the side panel, select the pencil at the right of the **Name pattern** row.
  - **Expected:**
    - A dialog titled "Change the length or names of Testing Schedule's cycles" opens.
    - It has **From the start of**, with the line "Cycles before it keep their names and dates" under its label.
  - **Notes:**

- [ ] `B1D3` Choose the day that ends in "(Sprint 3)" in **From the start of**, such as "Feb 1, 2027 (Sprint 3)".
  - **Expected:** **From the start of** reads that choice.
  - **Notes:**

- [ ] `F3AA` Replace the number in **Each cycle lasts** with `4`.
  - **Expected:** **Each cycle lasts** reads `4`.
  - **Notes:**

- [ ] `81B0` Select **Change cycles**.
  - **Expected:**
    - The dialog closes, and a notification says "Drafted the change to the cycles."
    - In the **Cycles** table, `Sprint 1` and `Sprint 2` have no dot, and their **Duration** reads "2 weeks".
    - `Sprint 3` and the cycles after it have a hollow yellow dot before their names, and their **Duration** reads "4 weeks".
  - **Notes:**

- [ ] `53D1` Run Discard the Unpublished Changes.
  - **Expected:**
    - No cycle in the **Cycles** table has a dot.
    - Each cycle's **Duration** reads "2 weeks".
  - **Notes:**

### Part 3: Changing a Schedule

#### REL-09: A Schedule Is Renamed by a Draft

Proved by automated tests in `apps/web/src/releases-page-schedule-details.test.tsx`.

#### REL-10: A Schedule Is Retired by a Draft

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account REL-08 ended with.

**Preconditions:** Run after REL-08. `Testing Schedule` open in the side panel.

- [ ] `9ABF` Select the **⋯** at the right of the first cell of the row for `Testing Schedule`, then **Retire**.
  - **Expected:**
    - A notification says "Drafted retiring Testing Schedule."
    - The side panel's heading shows a hollow yellow dot, `Testing Schedule`, then the yellow **Retired** box.
    - In the table, `Testing Schedule` is still the first row, with a hollow yellow dot in its slot and the yellow **Retired** box after its name.
  - **Notes:**

- [ ] `F297` Select the **⋯** at the right of the first cell of the row for `Testing Schedule`, then **Discard draft**.
  - **Expected:**
    - A notification says "Discarded the draft."
    - `Testing Schedule` has no dot and no **Retired** box.
  - **Notes:**

#### REL-11: Approving a Retiring Schedule Takes It Off the Table

**Account:** Project Manager, `project.manager@fathom.test`, changed from REL-10.

**Preconditions:** Run after REL-10. Signed in with this account. **Releases** page open from the left-hand menu, then the **Schedules** tab, with 'Patches' selected in the table.

- [ ] `13A5` Select the **⋯** at the right of the first cell of the row for 'Patches', then **Approve draft…**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `5D18` Select **Approve**.
  - **Expected:**
    - A notification says "Approved 1 draft."
    - In the table, 'Patches' is no longer listed.
    - The side panel's heading shows 'Patches', then a grey **Retired** box.
  - **Notes:**

- [ ] `A9FD` Select **Show retired (1)** in the **Views** menu.
  - **Expected:** 'Patches' is listed in the table again, with no dot.
  - **Notes:**

**Afterwards:** Open the **Views** menu above the table and select **Clear view**.

#### REL-16: A Schedule With No End Date Has Cycles Two Years Ahead

Covered by [REL-41](release-cycles-manual-test.md#rel-41-the-cycles-tab-lists-every-schedules-cycles), whose step `24B9` reads the last cycle two years ahead.

#### REL-28: Schedules Are Grouped by Status

Proved by automated tests in `apps/web/src/releases-page-schedules.test.tsx`.

#### REL-29: A Schedule Ends on Its Last Day

Covered by [REL-36](releases-timeline-manual-test.md#rel-36-each-tabs-timeline-draws-what-its-table-lists), which saves a schedule's last day and reads it on the timeline.

#### REL-30: Schedules Group by Status

Proved by automated tests in `apps/web/src/releases-page-schedules.test.tsx`.

### Part 4: The Schedules Tab With the Seed Data

#### REL-31: The Schedules Tab Shows Each Schedule Now

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from REL-11.

**Preconditions:** Restore the Seed Data run, then signed in with this account.

- [ ] `5B30` Select the **Releases** page in the left-hand menu.
  - **Expected:** The tabs **Releases**, **Cycles** and **Schedules** are beside the **Releases** heading, and **Releases** is chosen.
  - **Notes:**

- [ ] `C61E` Select the **Schedules** tab.
  - **Expected:**
    - **Schedules** is chosen.
    - At the top right, the Export button, an arrow pointing down onto a line, is just before **New schedule**.
    - The table's columns are, in order: **Schedule**, **Current cycle**, **Cycle starts**, **Cycle ends**, **Features this cycle**, **Next release**, **Release date**, **Cycle length** and **Schedule ends**.
    - The rows are not under any heading, and the button beside **Metrics** reads "Group by", with nothing after it.
  - **Notes:**

- [ ] `A976` Read the row for 'Platform'.
  - **Expected:**
    - **Current cycle** names the cycle today is in, such as '26.4', and **Cycle starts** and **Cycle ends** are its first and last days.
    - **Next release** shows a yellow dot, a small coloured square, then the release's name, such as 'Harbor 2 LTS'.
    - **Cycle length** reads "3 months".
    - **Schedule ends** is blank.
  - **Notes:**

- [ ] `A52C` Read the light green **Live** row under the row for 'Platform'.
  - **Expected:** Its **Next release** shows a green dot, a square of another colour from the one in the row above, then 'Harbor 2'.
  - **Notes:**

#### REL-32: A Schedule's Details Follow Its Row

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account REL-31 ended with.

**Preconditions:** **Releases** page open on the **Schedules** tab.

- [ ] `40DF` Select 'Platform' in the table.
  - **Expected:**
    - The side panel opens, headed 'Platform'.
    - Under **Details**, the rows are, in order: **Schedule**, **Current cycle**, **Cycle starts**, **Cycle ends**, **Features this cycle**, **Next release**, **Release date**, **Cycle length**, **Schedule ends** and **Name pattern**.
    - **Schedule ends** reads "No end date".
    - **Name pattern** reads `{YY}.{N}`, then "(now" and the current cycle's name, such as "(now 26.4)".
    - **Next release** shows a yellow dot, a small teal square, then 'Harbor 2 LTS', underlined as a link.
  - **Notes:**

- [ ] `97F9` Read the **Cycles** section, under **Details**.
  - **Expected:**
    - "Earlier cycles" and how many there are, such as "Earlier cycles (3)", is above a table with the columns **Cycle**, **Starts**, **Ends** and **Duration**.
    - The table's first row is the current cycle, with a **Current** box after its name, followed by five more.
    - Nothing is under the table.
  - **Notes:**

- [ ] `E45A` Select 'Patches' in the table.
  - **Expected:**
    - The side panel shows 'Patches'.
    - Its **Cycles** section has "Earlier cycles" and how many there are above the table, and "Later cycles" and how many more there are under it.
  - **Notes:**

- [ ] `FC53` Select **Later cycles**.
  - **Expected:**
    - Every cycle from the current one is listed.
    - "Hide later cycles" is where "Later cycles" was, and has the focus.
  - **Notes:**

- [ ] `4866` Select **Earlier cycles**.
  - **Expected:**
    - The cycles before the current one are listed above it, in grey.
    - The control reads "Hide earlier cycles", and has the focus.
  - **Notes:**

#### REL-33: A Schedule Is Changed Only While Nobody Holds It and It Isn't Retiring

Covered by [DRAFT-16](unpublished-changes-manual-test.md#draft-16-a-record-someone-else-is-changing-is-held) in Unpublished Changes, which reads the lock and who holds the record. That a retired schedule offers **Restore** is proved by automated tests in `apps/web/src/releases-page-schedule-details.test.tsx`.

#### REL-34: A Schedule Is Changed From Its Details

Covered by [REL-08](#rel-08-cycles-change-only-from-the-start-of-a-cycle), which changes a schedule's cycles from its details, and [REL-36](releases-timeline-manual-test.md#rel-36-each-tabs-timeline-draws-what-its-table-lists), which changes when a schedule ends.

#### REL-35: A Role That Can't Change Schedules Sees No Pencils

**Account:** Team Member, `team.member@fathom.test`, changed from REL-32.

**Preconditions:** Signed in with this account. **Releases** page open on the **Schedules** tab.

- [ ] `0012` Select 'Field Apps' in the table.
  - **Expected:** The side panel opens on 'Field Apps', with no lock and no **Retired** box.
  - **Notes:**

- [ ] `482D` Point at the **Schedule ends** row.
  - **Expected:** No pencil shows.
  - **Notes:**

- [ ] `CAF8` Point at the **Duration** cell of the cycle after the current one, in the **Cycles** section.
  - **Expected:** No pencil shows.
  - **Notes:**
