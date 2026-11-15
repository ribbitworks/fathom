---
title: "Manual Test: Schedules, Cycles and Releases"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/product/decisions.md"]
last_updated: "2026-11-15"
---

# Manual Test: Schedules, Cycles and Releases

## Scope

Verifies the Releases page's **Schedules** tab: how schedules, their cycles and their releases are shown, in the table, the side panel and the timeline, what a Workforce Administrator and a Project Manager can do with schedules and their cycles, including changing one cycle's length, and how their drafts are published, approved and discarded.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out. If a role was changed, Start From an Empty Database puts it back, in place of Reset the Database.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**
- **Project Manager:** `project.manager@fathom.test`
- **Team Member:** `team.member@fathom.test`
- **Second Workforce Administrator:** `engineering.operations.manager.2@fathom.test`, shown in Fathom as **Second Engineering Operations Manager**

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Start From an Empty Database](manual-test-basics.md#start-from-an-empty-database), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data), [Publish](manual-test-basics.md#publish) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the Appearance menu, marks and the Publish button. This test adds:

- **Seeded dates in this test:** **This quarter** is the quarter today is in, and **the first half** is Platform's first half-year cycle, three quarters after this quarter. Patches' cycles are named such as **P24.3**, and Field Apps' cycles, each six months long, such as **FA26.2**. The examples after "such as" are as the seed data is when added on 7 November 2026.
- **Schedules table:** the table on the Releases page's **Schedules** tab, under the timeline, with a row for each schedule. Its first column has no heading and holds the schedule's name; the others are **Current cycle**, **Cycle starts**, **Cycle ends**, **Next release**, **Release date**, **Cycle length** and **Schedule ends**. The search field, the Draft menu, **Metrics**, **Group by** and **Views** are in the bar above the timeline; while any schedule is retired, **Show retired** and how many are retired is first in the **Views** menu.
- **Selecting a schedule in the table:** selecting the details button at the right of the schedule's name, in its row's first cell, which opens the schedule in the side panel.
- **Side panel on Releases:** the panel beside the timeline and the schedules table for the selected schedule, which they narrow to make room for, with the sections **Details** and **Cycles**. **Details** has a row for each of the table's columns, the first named **Schedule**, then **Name pattern**. **Cycles** is a table with the columns **Cycle**, **Starts**, **Ends** and **Duration**. Dragging the panel's left edge resizes it.
- **A row's pencil:** the pencil at the right of a row in the side panel's **Details**, shown while the row is pointed at, for a value that can be changed. In **Cycles**, the pencil in a cycle's **Duration** cell opens a menu of **This cycle only…** and **This and later cycles…**.
- **Timeline:** the section headed **Timeline** above the schedules table, with **−** and **+** buttons and the zoom buttons **All**, **Year**, **6 months**, **Quarter**, **Month**, **Week** and **Days** at its top right, and the strip under them. It has a row for each schedule that is not retired, named on the left, with a lane of the schedule's cycles above a lane of its releases, under an axis of two rows of dates. Hovering over a cycle or a release shows its name and dates.
- **Strip:** the row between the timeline's zoom buttons and its rows: **‹**, a box for each quarter of the timeline, **›**, and **Today** while today is on the timeline.
- **A schedule's ⋯ menu:** the **⋯** at the right of a schedule's first cell in the schedules table, shown while its row is pointed at, or the **⋯** at the row's end. It offers **Retire** or **Restore**, **Discard draft** and **Resubmit** for the schedule's own draft, and **Approve…** and **Reject…** for an account whose role approves its drafts.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Start From an Empty Database. Part 1 starts from an empty database; REL-06 adds the seed data for Part 2; Part 3 changes what Parts 1 and 2 left; REL-18 restores the seed data for Part 4, and REL-23 restores it again for Part 5. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out. To run the test again, start again from Start From an Empty Database.

### Part 1: From an Empty Database

#### REL-01: A New Fathom Starts With No Schedules

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Start From an Empty Database run, then signed in with this account.

- [ ] `575D` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The **Releases** page opens, with a **Schedules** tab beside its heading.
    - There is no table.
    - It reads "No schedules yet."
    - A **New schedule** button is at the top right.
  - **Notes:**

#### REL-02: The Engineering Operations Manager Drafts a New Schedule

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as REL-01.

**Preconditions:** Signed in with this account. Run after REL-01. **Releases** page open.

- [ ] `BE80` Select **New schedule** at the top right of the page.
  - **Expected:**
    - A dialog titled **New schedule** opens.
    - It has a **Name** box.
  - **Notes:**

- [ ] `B5F3` Type `Testing Schedule` in **Name**.
  - **Expected:** The **Name** box holds **Testing Schedule**.
  - **Notes:**

- [ ] `DEC9` Select **Add schedule**.
  - **Expected:**
    - The dialog closes.
    - The schedules table shows one row, **Testing Schedule**.
    - The row has a hollow yellow dot in its slot.
    - The side panel opens on the right, headed by a hollow yellow dot and **Testing Schedule**.
    - Under **Cycles**, it reads "None".
  - **Notes:**

#### REL-03: A New Schedule's Cycles Show Their Names Before They Are Saved

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as REL-02.

**Preconditions:** Signed in with this account. Run after REL-02. **Testing Schedule** open in the side panel.

- [ ] `CC32` In the side panel, point at the **Name pattern** row, then select its pencil.
  - **Expected:**
    - A dialog titled **Set up cycles for Testing Schedule** opens.
    - The **First cycle starts** box is empty, showing the example date **2027-01-01** in grey.
    - **Each cycle lasts** is set to **3**.
    - **Months** is selected.
    - **Names** is set to **{YY}.{N}**.
  - **Notes:**

- [ ] `0CC6` Type `20270104` in **First cycle starts**.
  - **Expected:** The box shows **2027-01-04**.
  - **Notes:**

- [ ] `FBA3` Replace **3** in **Each cycle lasts** with `2`.
  - **Expected:** **Each cycle lasts** reads **2**.
  - **Notes:**

- [ ] `5CDA` Select **Weeks**.
  - **Expected:** Below **Names**, under **First cycles**, three lines:
    - **27.1** with **2027-01-04 to 2027-01-17**.
    - **27.2** with **2027-01-18 to 2027-01-31**.
    - **27.3** with **2027-02-01 to 2027-02-14**.
  - **Notes:**

- [ ] `2BC4` Replace **Names** with `Sprint {#}`.
  - **Expected:** The three lines under **First cycles** now start with **Sprint 1**, **Sprint 2** and **Sprint 3**.
  - **Notes:**

- [ ] `1E14` Select **Set up cycles**.
  - **Expected:**
    - The dialog closes.
    - A notification says "Drafted the cycles."
    - Under **Details**, **Name pattern** reads `Sprint {#}`.
    - **Cycle length** reads "2 weeks".
    - **Schedule ends** reads "No end date".
    - The **Cycles** table lists six cycles, from **Sprint 1**, which starts on Jan 4, 2027.
    - Under the table, "Show all" and how many cycles there are.
  - **Notes:**

- [ ] `7D69` Run Publish.
  - **Expected:** The dot before **Testing Schedule**, in the table and in the panel's heading, is now solid yellow.
  - **Notes:**

#### REL-04: The Product Manager Makes a Release From a Schedule's Cycles

Not run for now: releases are made and changed on the Releases tab, which is still to come.

#### REL-05: Approving a New Schedule Approves Its Cycles With It

**Account:** Project Manager, `project.manager@fathom.test`, changed from REL-03.

**Preconditions:** Signed in with this account. Run after REL-03. **Releases** page open from the left-hand menu.

- [ ] `1115` Select the **⋯** at the right of the first cell of the row for **Testing Schedule**, then **Approve…**.
  - **Expected:** A dialog titled "Approve 2 drafts?" opens.
  - **Notes:**

- [ ] `A9B9` Select **Approve**.
  - **Expected:**
    - A notification says "Approved 2 drafts."
    - **Testing Schedule** no longer has a dot in the table.
  - **Notes:**

### Part 2: With the Seed Data

#### REL-06: The Seed Data Adds Three Schedules

**Account:** Team Member, `team.member@fathom.test`, changed from REL-05.

**Preconditions:** Signed in with this account. Run after REL-05. **Releases** page open from the left-hand menu.

- [ ] `9A9D` Run Restore the Seed Data.
  - **Expected:**
    - Restore the Seed Data finishes with no error.
    - After the page reloads, the table shows **Testing Schedule**, **Platform**, **Patches** and **Field Apps**, in that order, under no heading.
    - **Testing Schedule** has no dot.
    - **Platform** has a grey lock in its slot.
    - **Patches** has a yellow dot in its slot.
    - The yellow **Retired** box follows its name.
    - There is no **New schedule** button.
  - **Notes:**

- [ ] `17E3` Select **Platform** in the table.
  - **Expected:** The side panel opens, headed by the grey lock and **Platform**.
  - **Notes:**

#### REL-07: A Schedule's Cycles Show How Long Each Lasts

**Account:** Team Member, `team.member@fathom.test`, the same as REL-06.

**Preconditions:** Signed in with this account. Run after REL-06. **Releases** page open.

- [ ] `37FF` Select **Patches** in the table.
  - **Expected:** The side panel opens on **Patches**.
  - **Notes:**

- [ ] `403B` Scroll the side panel down to **Cycles**.
  - **Expected:** A table with the columns **Cycle**, **Starts**, **Ends** and **Duration**.
  - **Notes:**

- [ ] `C9E8` Read the first row, each column in order.
  - **Expected:** The row reads, from left to right:
    - the current cycle's name, such as **P24.3**, then a **Current** box
    - this week's Monday, such as **Nov 2, 2026**
    - the Sunday four weeks later, such as **Nov 29, 2026**
    - "4 weeks"
  - **Notes:**

#### REL-08: Cycles Change Only From the Start of a Cycle

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from REL-07.

**Preconditions:** Signed in with this account. Run after REL-07. **Releases** page open from the left-hand menu, with **Testing Schedule** selected in the table.

- [ ] `A34D` In the side panel, point at the **Name pattern** row, then select its pencil.
  - **Expected:**
    - A dialog titled **Change the length or names of Testing Schedule's cycles** opens.
    - It has **From the start of**.
    - It shows the text "Cycles before it keep their names and dates".
  - **Notes:**

- [ ] `B1D3` Choose **2027-02-01 (Sprint 3)** in **From the start of**.
  - **Expected:** **From the start of** reads **2027-02-01 (Sprint 3)**.
  - **Notes:**

- [ ] `F3AA` Replace the number in **Each cycle lasts** with `4`.
  - **Expected:** **Each cycle lasts** reads **4**.
  - **Notes:**

- [ ] `81B0` Select **Change cycles**.
  - **Expected:**
    - The dialog closes.
    - A notification says "Drafted the change to the cycles."
    - In the **Cycles** table, **Sprint 1** and **Sprint 2** have no dot, and their **Duration** reads "2 weeks".
    - **Sprint 3** and the cycles after it have a hollow yellow dot before their names, and their **Duration** reads "4 weeks".
  - **Notes:**

- [ ] `53D1` Run Discard the Unpublished Changes.
  - **Expected:**
    - No cycle in the **Cycles** table has a dot.
    - Each cycle's **Duration** reads "2 weeks".
  - **Notes:**

### Part 3: Changing What Is Already There

#### REL-09: A Schedule Is Renamed by a Draft

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as REL-08.

**Preconditions:** Signed in with this account. Run after REL-08. **Releases** page open from the left-hand menu, with **Testing Schedule** selected in the table.

- [ ] `7FC0` In the side panel, point at the **Schedule** row, then select its pencil.
  - **Expected:**
    - A dialog titled **Rename Testing Schedule** opens.
    - The **Name** box holds **Testing Schedule**.
  - **Notes:**

- [ ] `6D73` Replace the name with `Tested Schedule`.
  - **Expected:** The **Name** box holds **Tested Schedule**.
  - **Notes:**

- [ ] `7FFB` Select **Save**.
  - **Expected:**
    - The side panel shows a hollow yellow dot before **Tested Schedule**.
    - The table shows a hollow yellow dot before **Tested Schedule**.
  - **Notes:**

- [ ] `E7F7` Select the **⋯** at the right of the first cell of the row for **Tested Schedule**, then **Discard draft**.
  - **Expected:**
    - A notification says "Discarded the draft."
    - The side panel and the table show **Testing Schedule** again.
    - **Testing Schedule** has no dot in either.
  - **Notes:**

#### REL-10: A Schedule Is Retired by a Draft

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as REL-09.

**Preconditions:** Signed in with this account. Run after REL-09. **Releases** page open, with **Testing Schedule** selected in the table.

- [ ] `9ABF` Select the **⋯** at the right of the first cell of the row for **Testing Schedule**, then **Retire**.
  - **Expected:**
    - A notification says "Drafted retiring Testing Schedule."
    - The side panel's heading shows a hollow yellow dot, **Testing Schedule**, then the yellow **Retired** box.
    - In the table, **Testing Schedule** is still the first row.
    - It has a hollow yellow dot in its slot.
    - The yellow **Retired** box follows its name.
  - **Notes:**

- [ ] `F297` Select the **⋯** at the right of the first cell of the row for **Testing Schedule**, then **Discard draft**.
  - **Expected:**
    - A notification says "Discarded the draft."
    - **Testing Schedule** has no dot.
    - **Testing Schedule** has no **Retired** box.
  - **Notes:**

#### REL-11: Approving a Retiring Schedule Takes It Off the Table

**Account:** Project Manager, `project.manager@fathom.test`, changed from REL-10.

**Preconditions:** Signed in with this account. Run after REL-10. **Releases** page open from the left-hand menu, with **Patches** selected in the table.

- [ ] `13A5` Select the **⋯** at the right of the first cell of the row for **Patches**, then **Approve…**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `5D18` Select **Approve**.
  - **Expected:**
    - A notification says "Approved 1 draft."
    - In the table, **Patches** is no longer listed.
    - A **Views** button is at the right of the bar above the timeline.
    - The side panel's heading shows **Patches**, then a grey **Retired** box.
  - **Notes:**

- [ ] `A9FD` Select **Views**, then **Show retired (1)**.
  - **Expected:** **Patches** is listed in the table again, with no dot.
  - **Notes:**

- [ ] `A5A4` Select **Views**.
  - **Expected:**
    - **Show retired (1)** is ticked.
    - **Clear view** is offered.
  - **Notes:**

- [ ] `9C3B` Reload the page.
  - **Expected:** **Patches** is still listed in the table.
  - **Notes:**

#### REL-12: A Release Is Changed by a Draft

Not run for now: releases are made and changed on the Releases tab, which is still to come.

#### REL-13: A Rejected Draft Says Why It Was Rejected

Not run for now: releases are made and changed on the Releases tab, which is still to come.

#### REL-14: A Rejected Draft Can Be Resubmitted

Not run for now: releases are made and changed on the Releases tab, which is still to come.

#### REL-15: A Release Is Removed by a Draft

Not run for now: releases are made and changed on the Releases tab, which is still to come.

#### REL-16: A Schedule With No End Date Has Cycles Two Years Ahead

**Account:** Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`, changed from REL-11. Step `A85C` signs in as another account.

**Preconditions:** Signed in with this account. Run after REL-11. **Releases** page open from the left-hand menu.

- [ ] `9F3F` Run Discard the Unpublished Changes.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `A85C` Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Operations Manager**.
  - **Notes:**

- [ ] `CC73` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The schedules table shows **Platform**.
    - **Platform** has no grey lock in its slot.
  - **Notes:**

- [ ] `3A26` Select **Platform** in the table.
  - **Expected:**
    - The side panel opens, headed **Platform**.
    - There is no grey lock.
  - **Notes:**

- [ ] `CADE` Scroll the side panel down to the last row of **Cycles**.
  - **Expected:**
    - Nothing is under the table.
    - The last row is the half-year cycle holding the day two years from today, such as **28.2** from **Jul 1, 2028** to **Dec 31, 2028**.
  - **Notes:**

#### REL-17: A Release Ships on a Day of Its Own

Not run for now: releases are made and changed on the Releases tab, which is still to come.

### Part 4: The Timeline

#### REL-18: The Timeline Shows Every Current Schedule

**Account:** Team Member, `team.member@fathom.test`, changed from REL-16.

**Preconditions:** Signed in with this account. Run after REL-16. **Releases** page open from the left-hand menu.

- [ ] `6CDB` Run Restore the Seed Data.
  - **Expected:**
    - Restore the Seed Data finishes with no error.
    - After the page reloads, the schedules table shows **Testing Schedule**, **Platform**, **Patches** and **Field Apps**.
    - There is no **Views** button in the bar.
    - The **Timeline** heading shows above the schedules table, with the zoom buttons at its top right.
  - **Notes:**

- [ ] `56D9` Select **Year**.
  - **Expected:**
    - **Year** is highlighted.
    - The timeline has four rows, named **Testing Schedule**, **Platform**, **Patches** and **Field Apps**.
    - The axis's top row names years, such as **2027**.
    - Its second row names half years, such as **Jan to Jun 27** and **Jul to Dec 27**.
    - A red line crosses every row, about a sixth of the way across the timeline.
    - The red line is labelled **Today** in a row of its own above the axis.
  - **Notes:**

- [ ] `1FC4` Read **Platform**'s lanes.
  - **Expected:**
    - The cycles up to the first half are each a quarter long.
    - The first half and the cycles after it are half a year long.
    - Each block is as long as its dates on the axis.
    - In the lane below, **Harbor 3** has a yellow dot before its name and spans the cycle after next quarter's to the cycle after the first half, such as **27.2** to **28.1**.
    - A yellow **Moved** box is after its name.
    - A diamond is under the right end of **Harbor 3**.
    - In a third lane, a faded **Harbor 3** after a green dot spans next quarter's cycle to the first half, such as **27.1** to **27.3**.
  - **Notes:**

- [ ] `A150` Hover over **Harbor 1**'s span, scrolling the timeline left to it if needed.
  - **Expected:** A tooltip names **Harbor 1**, its cycles and the day it ships, such as **Harbor 1: 26.1 to 26.2, ships 2026-06-30.**
  - **Notes:**

- [ ] `84D7` Read **Patches**' cycles lane.
  - **Expected:**
    - Each four-week cycle is a block as long as its dates on the axis.
    - Each is named inside only when its name fits.
  - **Notes:**

- [ ] `2FD6` Hover over one of **Patches**' cycles.
  - **Expected:** A tooltip shows its name and dates, such as **P24.3: 2026-11-02 to 2026-11-29**.
  - **Notes:**

- [ ] `A8FF` Read **Patches**' name on the left of the timeline.
  - **Expected:**
    - A yellow dot is before **Patches**.
    - A **Retired** box is after it, centred on the same line as **Patches**.
  - **Notes:**

- [ ] `6CC2` Choose **Drafts applied** in the Draft menu.
  - **Expected:**
    - **Harbor 3** still spans the cycle after next quarter's to the cycle after the first half, such as **27.2** to **28.1**, with a yellow dot before its name.
    - A yellow **Moved** box is after its name.
    - **Platform** has no third lane, and no faded **Harbor 3**.
  - **Notes:**

- [ ] `FAE7` Choose **Live only** in the Draft menu.
  - **Expected:**
    - **Harbor 3** spans next quarter's cycle to the first half, such as **27.1** to **27.3**, with a green dot before its name.
    - **Harbor 4** is not on the timeline.
    - No release on the timeline has a yellow dot.
  - **Notes:**

- [ ] `278F` Choose **Drafts & Live** in the Draft menu.
  - **Expected:** The faded **Harbor 3** is back in **Platform**'s third lane.
  - **Notes:**

#### REL-19: The Timeline Zooms In and Out

**Account:** Team Member, `team.member@fathom.test`, the same as REL-18.

**Preconditions:** Signed in with this account. Run after REL-18. **Releases** page open, with the timeline at **Year**.

- [ ] `060D` Select **All**.
  - **Expected:**
    - The whole timeline fits across, from the earliest cycle of any schedule to the end of the last, such as 2025 to the end of 2028, with no scrolling sideways.
    - The **−** button is greyed out.
  - **Notes:**

- [ ] `FC03` Select **Quarter**.
  - **Expected:**
    - The axis's top row names quarters, such as **Q1 2027**.
    - Its second row names months, such as **Jan**.
    - The red **Today** line crosses the timeline at today's date on the axis.
  - **Notes:**

- [ ] `D3F1` Select **Month**.
  - **Expected:**
    - The axis's top row names months, such as **Jan 2027**.
    - Its second row names each week by its Monday, such as **Nov 9**, or, where that does not fit, just the day of the month, such as **9**.
    - The red **Today** line crosses the timeline at today's date on the axis.
  - **Notes:**

- [ ] `82FE` Select **Year**.
  - **Expected:** **Year** is highlighted.
  - **Notes:**

- [ ] `5DB7` Reload the page.
  - **Expected:** The **Releases** page shows again, with **Year** still highlighted.
  - **Notes:**

#### REL-20: The Strip Follows the Timeline

**Account:** Team Member, `team.member@fathom.test`, the same as REL-19.

**Preconditions:** Signed in with this account. Run after REL-19. **Releases** page open, with the timeline at **Year**.

- [ ] `C9C3` Select **Quarter**.
  - **Expected:**
    - Under the zoom buttons, the strip shows a box for each quarter of the timeline, such as **Q1 2027**, from its first quarter to its last.
    - **‹** is before the strip, and **›** and **Today** are after it.
    - The quarters in view on the timeline are tinted blue, and the others are not.
    - This quarter's box is underlined in red and its name in bold.
  - **Notes:**

- [ ] `7A96` Select the box for the quarter after next in the strip, such as **Q2 2027**.
  - **Expected:**
    - The timeline scrolls so that quarter starts about a sixth of the way across, with the end of the quarter before it in sight.
    - The tint moves to the quarters in view: the one before, that quarter, and those after it.
    - That quarter's box is filled blue, with its name in white.
  - **Notes:**

- [ ] `528C` Select **›**.
  - **Expected:**
    - The timeline scrolls on by one quarter, so the next quarter starts about a sixth of the way across.
    - The tint moves with it.
    - The next quarter's box is filled blue, and no other box is.
  - **Notes:**

- [ ] `FC26` Select **‹**.
  - **Expected:** The timeline scrolls back by one quarter, so the quarter chosen in step `7A96` starts about a sixth of the way across again.
  - **Notes:**

- [ ] `D68B` Scroll the timeline sideways to its start, by dragging its scroll bar to the left.
  - **Expected:**
    - The tint moves as the timeline scrolls, over the quarters in view.
    - No quarter's box is filled blue.
    - At the start, **‹** is greyed out.
  - **Notes:**

- [ ] `040D` Select **Today**.
  - **Expected:**
    - The red **Today** line is back about a sixth of the way across the timeline.
    - The tint covers this quarter and the quarters in view after it.
  - **Notes:**

- [ ] `8CAA` Select **‹**.
  - **Expected:**
    - The timeline scrolls back a little, so this quarter starts about a sixth of the way across.
    - The tint moves with it.
  - **Notes:**

- [ ] `77FB` Press Tab.
  - **Expected:**
    - Focus is on the first tinted quarter's box.
    - The box has a focus ring.
  - **Notes:**

- [ ] `35C1` Press the right arrow key.
  - **Expected:**
    - Focus moves to the next quarter's box.
    - The timeline does not scroll.
  - **Notes:**

- [ ] `5A49` Press Enter.
  - **Expected:**
    - The timeline scrolls so that quarter starts about a sixth of the way across.
    - That quarter's box is filled blue.
  - **Notes:**

- [ ] `F77A` Press End.
  - **Expected:**
    - Focus moves to the last quarter's box in the strip.
    - The timeline does not scroll.
  - **Notes:**

- [ ] `4635` Press Enter.
  - **Expected:**
    - The timeline scrolls to its end.
    - The last quarter's box is filled blue.
    - The box has a focus ring.
    - **›** is greyed out.
  - **Notes:**

- [ ] `3A9F` Press the left arrow key.
  - **Expected:** Focus moves to the box before the last.
  - **Notes:**

- [ ] `F139` Press Enter.
  - **Expected:**
    - The timeline does not scroll.
    - The box before the last is filled blue, and the last is not.
  - **Notes:**

- [ ] `12EA` Press Tab.
  - **Expected:** Focus moves past the other quarters to **Today**.
  - **Notes:**

- [ ] `4A47` Select **All**.
  - **Expected:**
    - Every quarter's box is tinted.
    - **‹** and **›** are greyed out.
    - A box too narrow for its name shows only its quarter, such as **Q1**, or no name.
  - **Notes:**

- [ ] `5A51` Select **Year**.
  - **Expected:** **Year** is highlighted.
  - **Notes:**

#### REL-21: A Release's Own Ship Day Is Marked on the Timeline

Not run for now: releases are made and changed on the Releases tab, which is still to come.

#### REL-22: A Release's Colour Is Chosen in Its Dialog

Not run for now: releases are made and changed on the Releases tab, which is still to come.

### Part 5: Changing One Cycle's Length

#### REL-23: A Cycle's New Length Moves the Cycles and Releases After It

**Account:** Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`, changed from REL-20. Step `6FE2` signs in as another account, and step `B6FF` as the Workforce Administrator.

**Preconditions:** Run after REL-20. Run Restore the Seed Data. Signed in with this account.

- [ ] `11A6` Run Discard the Unpublished Changes.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `6FE2` Sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Project Manager**.
  - **Notes:**

- [ ] `F216` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The schedules table shows **Platform**.
    - **Platform** has no grey lock in its slot.
  - **Notes:**

- [ ] `39A5` Select the **⋯** at the right of the first cell of the row for **Platform**, then **Approve…**.
  - **Expected:** A dialog titled "Approve 3 drafts?" opens.
  - **Notes:**

- [ ] `A102` Select **Approve**.
  - **Expected:**
    - A notification says "Approved 3 drafts."
    - **Platform** has no dot in the table.
  - **Notes:**

- [ ] `B6FF` Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Operations Manager**.
  - **Notes:**

- [ ] `196D` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The schedules table shows **Platform**, with no dot in its slot.
    - **Platform** has no grey lock in its slot.
  - **Notes:**

- [ ] `B1AB` Select **Platform** in the table.
  - **Expected:** The side panel opens, headed **Platform**.
  - **Notes:**

- [ ] `9A23` In the side panel's **Cycles** table, select the pencil in the **Duration** cell of next quarter's cycle, such as **27.1**.
  - **Expected:** A menu offers **This cycle only…** and **This and later cycles…**.
  - **Notes:**

- [ ] `1DD2` Select **This cycle only…**.
  - **Expected:**
    - A dialog titled **Change the length of** that cycle opens, such as "Change the length of 27.1".
    - **Length** reads **3**, followed by **months**.
    - The cycle's dates are under its label.
    - Under **Later cycles**, **Move with it** is selected.
    - **Keep their dates** is offered.
    - **New dates** lists that cycle and the next one, each a quarter long, and the first half, half a year long, such as **27.1**, **2027-01-01 to 2027-03-31**; **27.2**, **2027-04-01 to 2027-06-30**; and **27.3**, **2027-07-01 to 2027-12-31**.
  - **Notes:**

- [ ] `E427` Replace **3** in **Length** with `2`.
  - **Expected:**
    - **New dates** lists the cycle two months long, then the next a quarter and the first half half a year, such as **27.1**, **2027-01-01 to 2027-02-28**; **27.2**, **2027-03-01 to 2027-05-31**; and **27.3**, **2027-06-01 to 2027-11-30**.
    - The changed cycle starts on the first day of next quarter, such as **27.1** on **2027-01-01**.
    - Each next cycle starts the day after the one before it ends.
    - Under **Releases that move**: **Harbor 3** and **Harbor 4**.
    - Under **Features that move**: **Data Retention Controls** and **Report Builder**.
    - Below them, a line for each release that moves says the day it now ships, such as "Harbor 3 ships 2028-05-31." and "Harbor 4 ships 2028-11-30."
  - **Notes:**

- [ ] `CDF0` Select **Change length**.
  - **Expected:**
    - The dialog closes.
    - A notification says "Drafted the new length."
    - In the **Cycles** table, the changed cycle has a hollow yellow dot before its name, and its **Duration** reads "2 months".
    - The cycles after it have a hollow yellow dot before their names.
    - The first half runs on its new dates, such as **27.3** from **Jun 1, 2027** to **Nov 30, 2027**.
  - **Notes:**

- [ ] `4CBE` Run Publish.
  - **Expected:** The dots before the changed cycle and the cycles after it are solid yellow.
  - **Notes:**

#### REL-24: Approving One Draft of a New Length Approves Them All

**Account:** Project Manager, `project.manager@fathom.test`, changed from REL-23.

**Preconditions:** Signed in with this account. Run after REL-23.

- [ ] `A722` Select the **Drafts** page in the left-hand menu.
  - **Expected:** Among the drafts is the draft of **the cycles of Platform from** the changed cycle's first day, such as **the cycles of Platform from 2027-01-01**.
  - **Notes:**

- [ ] `1913` Tick the entry for **the cycles of Platform from** the changed cycle's first day.
  - **Expected:** The button at the top right reads **Approve 1 draft…**.
  - **Notes:**

- [ ] `81A4` Select **Approve 1 draft…**.
  - **Expected:**
    - A dialog titled "Approve 7 drafts?" opens.
    - It says "Also approves the drafts these depend on:", and lists:
      - **the cycles of Platform from** the next cycle's new first day, such as **the cycles of Platform from 2027-03-01**.
      - **the cycles of Platform from** the first half's new first day, such as **the cycles of Platform from 2027-06-01**.
      - **the release Harbor 3 in Platform**.
      - **the release Harbor 4 in Platform**.
      - **the feature Data Retention Controls**.
      - **the feature Report Builder**.
  - **Notes:**

- [ ] `3A60` Select **Approve**.
  - **Expected:** A notification says "Approved 7 drafts."
  - **Notes:**

- [ ] `E604` Select the **Releases** page in the left-hand menu, then **Platform** in the table.
  - **Expected:**
    - No cycle in the side panel's **Cycles** table has a dot.
    - The first half still runs on its new dates, such as **27.3** from **Jun 1, 2027** to **Nov 30, 2027**.
  - **Notes:**

#### REL-25: Later Cycles Can Keep Their Dates

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from REL-24.

**Preconditions:** Run after REL-24. Signed in with this account. **Releases** page open from the left-hand menu, with **Patches** selected in the table.

- [ ] `B25E` Select the **⋯** at the right of the first cell of the row for **Patches**, then **Discard draft**.
  - **Expected:**
    - A notification says "Discarded the draft."
    - **Patches** has no **Retired** box, in the table or the side panel.
  - **Notes:**

- [ ] `9490` In the side panel's **Cycles** table, select the pencil in the **Duration** cell of the later patch release's last cycle, the cycle after the current one, such as **P24.4**.
  - **Expected:** A menu offers **This cycle only…** and **This and later cycles…**.
  - **Notes:**

- [ ] `3DF6` Select **This cycle only…**.
  - **Expected:** A dialog titled **Change the length of** that cycle opens.
  - **Notes:**

- [ ] `045F` Replace **4** in **Length** with `2`.
  - **Expected:** **Length** reads **2**, followed by **weeks**.
  - **Notes:**

- [ ] `B0CC` Select **Keep their dates**.
  - **Expected:**
    - **New dates** lists that cycle two weeks long, then a cycle from the next day to the end of the cycle after it, six weeks long, then the cycle after that, four weeks long, such as **P24.4**, **2026-11-30 to 2026-12-13**; **P25.1**, **2026-12-14 to 2027-01-24**; and **P25.2**, **2027-01-25 to 2027-02-21**.
    - Below it, the dialog says the later patch release ships on that cycle's new last day, such as "Patch December ships 2026-12-13."
  - **Notes:**

- [ ] `58F4` Select **Change length**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] `CD05` Run Publish.
  - **Expected:**
    - In the **Cycles** table, the changed cycle and the cycle after it have a yellow dot before their names.
    - The changed cycle's **Duration** reads "2 weeks", and the next cycle's "6 weeks".
    - The cycle after those still reads "4 weeks", with no dot.
    - In the table, the **Release date** of **Patches** is the changed cycle's new last day, such as **Dec 13, 2026**.
  - **Notes:**

#### REL-26: Discarding One Draft of a New Length Discards Them All

Not run for now: a draft of a schedule's cycles has no **Discard draft** on the Releases page.

### Part 6: Release Notes

#### REL-27: A Release's Note Is Read and Written Beside Its Schedule

Not run for now: releases are made and changed on the Releases tab, which is still to come.

### Part 7: The Schedules Table

#### REL-28: Schedules Are Found, Opened and Grouped in the Table

**Account:** Team Member, `team.member@fathom.test`, changed from REL-25.

**Preconditions:** Signed in with this account. Run after REL-25, or on its own. **Releases** page open from the left-hand menu.

- [ ] `DCE3` Run Restore the Seed Data.
  - **Expected:** After the page reloads, **Platform** and **Patches** are among the schedules in the table.
  - **Notes:**

- [ ] `7314` Press Cmd+F on a Mac, or Ctrl+F elsewhere.
  - **Expected:** The cursor is in the search field at the left of the bar above the timeline.
  - **Notes:**

- [ ] `17A8` Type `patch`.
  - **Expected:**
    - The schedules table shows **Patches** alone.
    - The timeline shows **Patches** alone.
  - **Notes:**

- [ ] `93B7` Press Esc.
  - **Expected:**
    - The search field is empty.
    - The schedules table and the timeline show **Platform**, **Patches** and **Field Apps** again.
  - **Notes:**

- [ ] `39AF` Select **Platform** in the table.
  - **Expected:**
    - The side panel opens on **Platform**, beside the timeline and the schedules table.
    - **Platform** in the side panel's heading has the focus.
  - **Notes:**

- [ ] `B372` Press Esc.
  - **Expected:**
    - The side panel closes.
    - **Platform**'s first cell, holding its name, is selected in the schedules table.
  - **Notes:**

- [ ] `E45B` Select **Group by: None**, then **Status** under **Group by**.
  - **Expected:**
    - The **Group by** button reads "Group by: Status".
    - A **Current** heading is over the schedules, with how many it holds.
  - **Notes:**

- [ ] `8D0D` Reload the page.
  - **Expected:** The schedules table is still grouped by status, under the **Current** heading.
  - **Notes:**

#### REL-29: A Schedule Ends on Its Last Day

**Account:** Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`, changed from REL-28.

**Preconditions:** Signed in with this account. Run after REL-28. **Releases** page open from the left-hand menu.

- [ ] `3F07` Run Discard the Unpublished Changes.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `C6A8` Select **Platform** in the table.
  - **Expected:**
    - The side panel opens, headed **Platform**, with no grey lock.
    - Under **Details**, **Schedule ends** reads "No end date".
  - **Notes:**

- [ ] `096D` Point at the **Schedule ends** row, then select its pencil.
  - **Expected:**
    - A dialog titled **Change when Platform ends** opens.
    - Its one field, **Schedule ends**, reads "No end date" in grey.
    - Under **Schedule ends**, a line reads "Its last cycle ends on this day."
  - **Notes:**

- [ ] `0C94` Type the day two years from today in **Schedule ends**, such as `20281107`.
  - **Expected:**
    - Under **Last cycles**, the last row is a half-year cycle cut short to end on that day, such as **28.2** with **2028-07-01 to 2028-11-07**.
    - The line above it says how many cycles there are in all, such as "9 cycles in all".
  - **Notes:**

- [ ] `E61F` Select **Save**.
  - **Expected:**
    - The dialog closes.
    - The panel's heading shows a hollow yellow dot before **Platform**.
    - **Schedule ends** reads that day, such as **Nov 7, 2028**, after a hollow yellow dot.
    - The last row of **Cycles** is the cut cycle, such as **28.2** from **Jul 1, 2028** to **Nov 7, 2028**.
  - **Notes:**

- [ ] `9A3B` On the timeline, select **All**, then read the end of **Platform**'s cycle lane.
  - **Expected:**
    - The lane stops at that day, with a short upright grey line at its end.
    - **Patches**' lane has no such line.
  - **Notes:**

- [ ] `E1D0` Select the **⋯** at the right of the first cell of the row for **Platform**, then **Discard draft**.
  - **Expected:**
    - **Schedule ends** reads "No end date" again.
    - On the timeline, **Platform**'s lane has no upright line at its end.
  - **Notes:**

#### REL-30: Schedules Group by Status

Covered by [REL-28](#rel-28-schedules-are-found-opened-and-grouped-in-the-table), which groups the schedules by status.

### Part 8: The Schedules Tab

#### REL-31: The Schedules Tab Shows Each Schedule Now

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from REL-30.

**Preconditions:** Restore the Seed Data run, then signed in with this account.

- [ ] `5B30` Select the **Releases** page in the left-hand menu.
  - **Expected:** The tabs **Releases**, **Cycles** and **Schedules** are beside the **Releases** heading, and **Releases** is chosen.
  - **Notes:**

- [ ] `C61E` Select the **Schedules** tab.
  - **Expected:**
    - **Schedules** is chosen, and the button at the top right reads **New schedule**.
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
    - **Next release** shows the same square and name as the table's row.
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

- [ ] `6EBD` Select **Hide later cycles**.
  - **Expected:** The section is as it first was: "Earlier cycles" folded, then the current cycle and the next five, then "Later cycles".
  - **Notes:**

#### REL-33: A Schedule Is Changed Only While Nobody Holds It and It Isn't Retiring

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account REL-32 ended with.

**Preconditions:** **Releases** page open on the **Schedules** tab.

- [ ] `DBFB` Select 'Platform' in the table.
  - **Expected:** A grey lock comes before 'Platform' in the side panel's heading.
  - **Notes:**

- [ ] `5E8B` Point at the lock.
  - **Expected:** Its tip reads "Being changed by Second Engineering Operations Manager".
  - **Notes:**

- [ ] `CE3B` Point at the **Schedule ends** row.
  - **Expected:** No pencil shows.
  - **Notes:**

- [ ] `96B0` Select **⋯** at the right of the first cell of the row for 'Platform'.
  - **Expected:** The menu offers neither **Retire** nor **Restore**.
  - **Notes:**

- [ ] `F35D` Select 'Patches' in the table.
  - **Expected:** The side panel shows 'Patches', with a **Retired** box after its name and no lock.
  - **Notes:**

- [ ] `F044` Point at the **Schedule ends** row.
  - **Expected:** No pencil shows.
  - **Notes:**

- [ ] `2C38` Select **⋯** at the right of the first cell of the row for 'Patches'.
  - **Expected:** The menu offers **Restore**.
  - **Notes:**

#### REL-34: A Schedule Is Changed From Its Details

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account REL-33 ended with.

**Preconditions:** **Releases** page open on the **Schedules** tab.

- [ ] `CFF8` Select 'Field Apps' in the table.
  - **Expected:** The side panel shows 'Field Apps', with no lock and no **Retired** box.
  - **Notes:**

- [ ] `FB54` Point at the **Schedule ends** row.
  - **Expected:** A pencil shows at the row's right.
  - **Notes:**

- [ ] `731E` Select the pencil.
  - **Expected:**
    - A dialog titled "Change when Field Apps ends" opens.
    - Its **Schedule ends** field reads "No end date" in grey, with the line "Its last cycle ends on this day." under it.
  - **Notes:**

- [ ] `C617` Type a day in the middle of the cycle after the current one, as the **Cycles** table shows it, as its digits, such as `20261215`.
  - **Expected:**
    - Under the field, how many cycles there are in all, such as "3 cycles in all", then a table of the last cycles.
    - The last of them keeps its name, starts on its own first day, and ends on the day typed.
  - **Notes:**

- [ ] `AF4E` Select **Cancel**.
  - **Expected:** The dialog closes, and **Schedule ends** still reads "No end date".
  - **Notes:**

- [ ] `889D` Select the pencil in the **Duration** cell of the cycle after the current one, in the **Cycles** section.
  - **Expected:** A menu offers **This cycle only…** and **This and later cycles…**.
  - **Notes:**

- [ ] `20EC` Select **This and later cycles…**.
  - **Expected:**
    - A dialog titled "Change the length or names of Field Apps's cycles" opens.
    - Its start is the cycle chosen, its length `6` and unit **Months**, and its naming as **Name pattern** shows it.
  - **Notes:**

- [ ] `4E9F` Select **Cancel**.
  - **Expected:** The dialog closes, and nothing in the panel has changed.
  - **Notes:**

#### REL-35: A Role That Can't Change Schedules Sees No Pencils

**Account:** Team Member, `team.member@fathom.test`, changed from REL-34.

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

- [ ] `E4E4` Select **⋯** at the right of the first cell of the row for 'Field Apps'.
  - **Expected:** The menu offers neither **Retire** nor **Restore**.
  - **Notes:**

#### REL-36: Each Tab's Timeline Draws What Its Table Lists

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from REL-35.

**Preconditions:** Signed in with this account. **Releases** page open on the **Releases** tab, with no side panel open, and **Year** chosen on the timeline.

- [ ] `0651` Read the releases of 'Platform' on the timeline.
  - **Expected:**
    - Each release is a strip of its colour along its cycles, with its diamond under its end.
    - Under the strips, 'Platform''s cycles are drawn faint, each a different shade from the one before.
    - Above each strip wide enough for it: a dot, if it has a draft, then a small square of its colour, then its name.
  - **Notes:**

- [ ] `EB18` Read the releases of 'Patches' on the timeline.
  - **Expected:** The strips too short for their names show no dot, square or name above them.
  - **Notes:**

- [ ] `7B4D` Select the **Schedules** tab.
  - **Expected:**
    - On the timeline, each schedule's row shows its cycles as blocks, each a different shade from the one before.
    - The cycles that have ended are fainter than the current one and those after it.
    - No releases are drawn.
  - **Notes:**

- [ ] `2E93` Select the details button at the right of the first cell of the row for 'Field Apps'.
  - **Expected:** The side panel opens, headed 'Field Apps'.
  - **Notes:**

- [ ] `9F18` Select the pencil at the right of the **Schedule ends** row.
  - **Expected:** A dialog titled "Change when Field Apps ends" opens.
  - **Notes:**

- [ ] `A5C2` Type 30 September three years after this year in **Schedule ends**, as its digits, such as `20290930`.
  - **Expected:** The last cycle in the table under the field ends on the day typed.
  - **Notes:**

- [ ] `4D7E` Select **Save**.
  - **Expected:** The dialog closes, and **Schedule ends** in the side panel reads that day, such as "Sep 30, 2029".
  - **Notes:**

- [ ] `5E7C` Select **All** at the top right of the timeline.
  - **Expected:**
    - At the right end of 'Field Apps''s row, its cycles stop at that day, with a short upright grey line there.
    - After the line, it reads "Ends" and the day, such as "Ends Sep 30, 2029".
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes.

### Part 9: The Releases Tab

#### REL-37: The Releases Tab Shows Each Release

**Account:** Product Manager, `product.manager@fathom.test`, changed from REL-36.

**Preconditions:** Restore the Seed Data run, then signed in with this account.

- [ ] `F2C3` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - **Releases** is the tab chosen, and the button at the top right reads **New release**.
    - The table's columns are, in order: **Release**, **Schedule**, **Ships on**, **Cycles**, **Features** and **Status**.
    - The rows are under the headings 'Platform', 'Patches' and 'Field Apps'.
  - **Notes:**

- [ ] `C42A` Read the rows under 'Field Apps'.
  - **Expected:**
    - 'Lantern 1', 'Lantern 2' and 'Lantern 3' are listed, in that order, unless 'Lantern 1' has shipped.
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
  - **Expected:** It offers "Show shipped (2)".
  - **Notes:**

- [ ] `B630` Select **Show shipped**.
  - **Expected:**
    - 'Harbor 1' is listed under 'Platform', and **Status** reads "Shipped".
    - Under 'Patches', the release that has shipped is listed too, and **Status** reads "Shipped".
    - 'Harbor 1' is drawn on the timeline above the table.
  - **Notes:**

- [ ] `DC03` Choose **None** in the **Group by** menu.
  - **Expected:** The rows are under no heading, and **Cycles** names only the cycles, such as "27.2 to 28.1", with no schedule's name before them.
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

- [ ] `7E5C` Select the button at the right of the **Note** row.
  - **Expected:** The note opens in a panel of its own beside the release's details.
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
  - **Expected:** It offers 'Platform', and not 'Patches'.
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

- [ ] `EA8F` Select **Save**.
  - **Expected:**
    - The dialog closes, and 'Fictional Harbor' is listed under 'Platform', with a hollow dot in its slot.
    - Its details are open beside the table.
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes.

#### REL-40: A Role That Can't Change Releases Sees No Pencils

**Account:** Team Member, `team.member@fathom.test`, changed from REL-39.

**Preconditions:** Signed in with this account. **Releases** page open on the **Releases** tab.

- [ ] `89A3` Select the details button at the right of the first cell of the row for 'Harbor 2 LTS'.
  - **Expected:** Its details open beside the table.
  - **Notes:**

- [ ] `4205` Point at the **Ships on** row.
  - **Expected:** No pencil shows.
  - **Notes:**

### Part 10: The Cycles Tab

#### REL-41: The Cycles Tab Lists Every Schedule's Cycles

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from REL-40.

**Preconditions:** Restore the Seed Data run, then signed in with this account. **Releases** page open.

- [ ] `4BA7` Select the **Cycles** tab.
  - **Expected:**
    - **Cycles** is chosen, and there is no button at the top right.
    - The table's columns are, in order: **Cycle**, **Schedule**, **Starts**, **Ends**, **Current**, **Release** and **Features**.
    - The rows are under the headings 'Platform', 'Patches' and 'Field Apps'.
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

**Account:** Team Member, `team.member@fathom.test`, changed from REL-42.

**Preconditions:** Signed in with this account. **Releases** page open on the **Cycles** tab.

- [ ] `8F1F` Select the details button at the right of the first cell of the first row under 'Field Apps'.
  - **Expected:** The side panel opens, headed "Field Apps:" and the cycle's name.
  - **Notes:**

- [ ] `7423` Point at the **Duration** row.
  - **Expected:** No pencil shows.
  - **Notes:**

#### REL-44: The Cycles Timeline Names Each Cycle and Marks Today's

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from REL-43.

**Preconditions:** Signed in with this account. **Releases** page open on the **Cycles** tab, with no side panel open, and **Year** chosen on the timeline.

- [ ] `7EAF` Read the row for 'Field Apps' on the timeline.
  - **Expected:**
    - Each cycle is a block with its name inside it, as **Cycle** reads it in the table.
    - The first block is the cycle whose **Current** reads "Current" in the table.
  - **Notes:**

- [ ] `8973` Point at the first block in the row for 'Field Apps'.
  - **Expected:** Its tip reads the cycle's name, its first and last days, then ", current".
  - **Notes:**

- [ ] `202F` Point at the diamond after the end of the first block.
  - **Expected:** Its tip reads "Lantern 2 ships" and its day.
  - **Notes:**

- [ ] `AD62` Select **Show past cycles** in the **Views** menu.
  - **Expected:** The row for 'Field Apps' starts with two more blocks, before the one whose tip ends ", current".
  - **Notes:**

#### REL-45: Each Tab Names the Features of Its Records

**Account:** Product Manager, `product.manager@fathom.test`, changed from REL-44.

**Preconditions:** Signed in with this account. **Releases** page open on the **Releases** tab, with no side panel open.

- [ ] `3F83` Point at the **Features** cell of the row for 'Harbor 2 LTS'.
  - **Expected:**
    - The cell reads "Bulk Import, Offline Sync, Single Sign-On Setup, Usage Alerts", cut short where it doesn't fit.
    - Its tip names the same four features, one to a line.
  - **Notes:**

- [ ] `4D31` Select the details button at the right of the first cell of the row for 'Lantern 2'.
  - **Expected:**
    - The **Features** row lists 'Barcode Scanning', 'Offline Forms', 'Parts Lookup', 'Signature Capture' and 'Site Diary', one to a line, then **Show all (7)**.
    - **Show on Features** and **Show on the Board** follow.
  - **Notes:**

- [ ] `34D2` Select **Show all (7)**.
  - **Expected:** 'Timesheet Sync' and 'Weather Alerts' follow 'Site Diary', then **Show less**.
  - **Notes:**

- [ ] `F073` Select 'Parts Lookup'.
  - **Expected:** The **Features** page opens, with the details of 'Parts Lookup' beside the table.
  - **Notes:**

- [ ] `92EB` Select **Releases** in the left-hand menu.
  - **Expected:** The **Releases** tab shows, with no side panel open.
  - **Notes:**

- [ ] `07D9` Select the details button at the right of the first cell of the row for 'Harbor 2 LTS'.
  - **Expected:** The **Features** row lists 'Bulk Import', 'Offline Sync', 'Single Sign-On Setup' and 'Usage Alerts', one to a line.
  - **Notes:**

- [ ] `671F` Select **Show on Features**.
  - **Expected:**
    - The **Features** page opens with a **Release** filter on.
    - The table lists 'Bulk Import', 'Offline Sync', 'Single Sign-On Setup' and 'Usage Alerts', and no other feature.
  - **Notes:**

- [ ] `9B5F` Select **Releases** in the left-hand menu.
  - **Expected:** The **Releases** tab shows, with no side panel open.
  - **Notes:**

- [ ] `B62F` Select the details button at the right of the first cell of the row for 'Harbor 2 LTS'.
  - **Expected:** The release's details open beside the table.
  - **Notes:**

- [ ] `C274` Select **Show on the Board**.
  - **Expected:**
    - The **Features** page opens on its board for 'Platform', with a **Release** filter on.
    - Its cards are 'Bulk Import', 'Offline Sync', 'Single Sign-On Setup' and 'Usage Alerts', and no other.
  - **Notes:**

- [ ] `43EF` Select **Releases** in the left-hand menu.
  - **Expected:** The **Releases** tab shows, with no side panel open.
  - **Notes:**

- [ ] `0492` Select the **Cycles** tab.
  - **Expected:** Under 'Platform', the **Features** cell of the row whose **Current** reads "Current" reads "Offline Sync, Usage Alerts".
  - **Notes:**

- [ ] `2C6B` Select the **Schedules** tab.
  - **Expected:**
    - **Features this cycle** reads "Offline Sync, Usage Alerts" in the row for 'Platform'.
    - It is blank in the row for 'Patches'.
  - **Notes:**

#### REL-46: A Record's Details Link the Records They Name

**Account:** Product Manager, `product.manager@fathom.test`, the account REL-45 ended with.

**Preconditions:** Signed in with this account. **Releases** page open from the left-hand menu, on the **Releases** tab, with no side panel open.

- [ ] `FAB7` Select the details button at the right of the first cell of the row for 'Harbor 2 LTS'.
  - **Expected:**
    - The **Cycles** row lists the release's two cycles, one to a line, each underlined as a link.
    - The **Schedule** row reads 'Platform', underlined as a link.
    - Under the release's name, its key reads "#RELEASE-" and a number.
  - **Notes:**

- [ ] `8210` Select the second cycle in the **Cycles** row.
  - **Expected:** The **Cycles** tab shows, with that cycle's details beside the table.
  - **Notes:**

- [ ] `E2AA` Select 'Harbor 2 LTS' in the **Release** row.
  - **Expected:** The **Releases** tab shows, with the details of 'Harbor 2 LTS' beside the table.
  - **Notes:**

- [ ] `9191` Select 'Platform' in the **Schedule** row.
  - **Expected:** The **Schedules** tab shows, with the details of 'Platform' beside the table.
  - **Notes:**

- [ ] `E50C` Select the cycle in the **Current cycle** row.
  - **Expected:**
    - The **Cycles** tab shows, with that cycle's details beside the table.
    - Its **Current** row reads "Current".
  - **Notes:**

#### REL-47: A Schedule Shows Its Releases and Its Cycles

**Account:** Product Manager, `product.manager@fathom.test`, the account REL-46 ended with.

**Preconditions:** Signed in with this account. **Releases** page open on the **Schedules** tab, with the details of 'Platform' beside the table.

- [ ] `C4C8` Select **Show its cycles**.
  - **Expected:**
    - The **Cycles** tab shows.
    - The only heading over its rows is 'Platform'.
  - **Notes:**

- [ ] `3D3D` Select the **Schedules** tab.
  - **Expected:** The table of schedules shows, with no side panel open.
  - **Notes:**

- [ ] `EE04` Select the details button at the right of the first cell of the row for 'Platform'.
  - **Expected:** The details of 'Platform' open beside the table.
  - **Notes:**

- [ ] `9C98` Select **Show its releases**.
  - **Expected:**
    - The **Releases** tab shows.
    - The only heading over its rows is 'Platform'.
  - **Notes:**

#### REL-48: The Timeline's Marks Open Their Records

**Account:** Product Manager, `product.manager@fathom.test`, the account REL-47 ended with.

**Preconditions:** Signed in with this account. **Releases** page open from the left-hand menu, on the **Releases** tab, with no side panel open.

- [ ] `BB2C` Select the span of 'Harbor 3' on the timeline.
  - **Expected:** The details of 'Harbor 3' open beside the table.
  - **Notes:**

- [ ] `3981` Select the name 'Field Apps' at the left of the timeline.
  - **Expected:** The **Schedules** tab shows, with the details of 'Field Apps' beside the table.
  - **Notes:**

- [ ] `11C5` Select the block that today's red line crosses in the row for 'Platform' on the timeline.
  - **Expected:**
    - The **Cycles** tab shows, with that cycle's details beside the table.
    - Its **Current** row reads "Current".
  - **Notes:**

- [ ] `E850` Select **Releases** in the left-hand menu.
  - **Expected:** The **Releases** tab shows, with no side panel open.
  - **Notes:**

- [ ] `1EAC` Press Tab until the span of 'Harbor 3' on the timeline has focus.
  - **Expected:** A ring shows around the span.
  - **Notes:**

- [ ] `57F2` Press Enter.
  - **Expected:** The details of 'Harbor 3' open beside the table.
  - **Notes:**
