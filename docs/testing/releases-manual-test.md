---
title: "Manual Test: Release Streams, Cycles and Releases"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/product/decisions.md"]
last_updated: "2026-11-14"
---

# Manual Test: Release Streams, Cycles and Releases

## Scope

Verifies the Releases page: how release streams, their cycles and their releases are shown, in the table, the side panel and the timeline, what a Workforce Administrator, a Product Manager and a Project Manager can do with them, including changing one cycle's length and writing a release's note, and how their drafts are published, approved, rejected, resubmitted and discarded.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out. If a role was changed, Start From an Empty Database puts it back, in place of Reset the Database.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**
- **Product Manager:** `product.manager@fathom.test`
- **Project Manager:** `project.manager@fathom.test`
- **Team Member:** `team.member@fathom.test`
- **Second Workforce Administrator:** `engineering.operations.manager.2@fathom.test`, shown in Fathom as **Second Engineering Operations Manager**

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Start From an Empty Database](manual-test-basics.md#start-from-an-empty-database), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data), [Publish](manual-test-basics.md#publish) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the Appearance menu, marks and the Publish button. This test adds:

- **Seeded dates in this test:** **This quarter** is the quarter today is in, and **the first half** is Platform's first half-year cycle, three quarters after this quarter. Patches' cycles are named such as **P24.3**. The examples after "such as" are as the seed data is when added on 7 November 2026.
- **Streams table:** the table on the Releases page, under the timeline, with a row for each release stream and the columns **Stream**, **Cycle schedule**, **Releases**, **Next release** and **Planned to**. Its rows are under a **Current** heading, and, while retired streams are shown, a **Retired** heading. The search field, the Draft menu, **Metrics**, **Group by** and **Views** are in the bar above the timeline; while any stream is retired, **Show retired** and how many are retired is first in the **Views** menu.
- **Selecting a stream in the table:** selecting the details button at the right of the stream's **Stream** cell, which opens the stream in the side panel.
- **Side panel on Releases:** the panel beside the timeline and the streams table for the selected stream, which they narrow to make room for, with the sections **Cycle schedule**, **Releases** and **Cycles**. Dragging its left edge resizes it.
- **Timeline:** the section headed **Timeline** above the streams table, with **−** and **+** buttons and the zoom buttons **All**, **Year**, **6 months**, **Quarter**, **Month**, **Week** and **Days** at its top right, and the strip under them. It has a row for each stream that is not retired, named on the left, with a lane of the stream's cycles above a lane of its releases, under an axis of two rows of dates. Hovering over a cycle or a release shows its name and dates.
- **Strip:** the row between the timeline's zoom buttons and its rows: **‹**, a box for each quarter of the timeline, **›**, and **Today** while today is on the timeline.
- **⋯ menu on Releases:** a **⋯** button beside the side panel's close button acts on the stream itself, when it has a draft; one at the end of a row in the side panel acts on that change of cycles or release; one at the end of a row of the **Cycles** table acts on that cycle.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Start From an Empty Database. Part 1 starts from an empty database; REL-06 adds the seed data for Part 2; Part 3 changes what Parts 1 and 2 left; REL-18 restores the seed data for Part 4, and REL-23 restores it again for Part 5, which Part 6 follows. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out. To run the test again, start again from Start From an Empty Database.

### Part 1: From an Empty Database

#### REL-01: A New Fathom Starts With No Release Streams

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Start From an Empty Database run, then signed in with this account.

- [ ] `575D` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The **Releases** page opens.
    - There is no table.
    - It reads **No release streams yet.**
    - A **New release stream** button is at the top right.
  - **Notes:**

#### REL-02: The Engineering Operations Manager Drafts a New Release Stream

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as REL-01.

**Preconditions:** Signed in with this account. Run after REL-01. **Releases** page open.

- [ ] `BE80` Select **New release stream** at the top right of the page.
  - **Expected:**
    - A dialog titled **New release stream** opens.
    - It has a **Name** box.
  - **Notes:**

- [ ] `B5F3` Type `Testing Stream` in **Name**.
  - **Expected:** The **Name** box holds **Testing Stream**.
  - **Notes:**

- [ ] `DEC9` Select **Add stream**.
  - **Expected:**
    - The dialog closes.
    - The streams table shows one row, **Testing Stream**.
    - The row has a hollow yellow dot in its slot.
    - The side panel opens on the right, headed by a hollow yellow dot and **Testing Stream**.
    - **None** is under **Cycle schedule**.
    - **None** is under **Releases**.
  - **Notes:**

#### REL-03: A New Stream's Cycles Show Their Names Before They Are Saved

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as REL-02.

**Preconditions:** Signed in with this account. Run after REL-02. **Testing Stream** open in the side panel.

- [ ] `4A29` In the side panel, select **Set up cycles…** under **Cycle schedule**.
  - **Expected:**
    - A dialog titled **Set up cycles for Testing Stream** opens.
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
    - Under **Cycle schedule**, a row reads **From Jan 4, 2027**, then **Every 2 weeks, named Sprint {#}**.
    - The row has a hollow yellow dot in its slot.
    - Below it are **Cycles until** and a day two years after today.
    - A **Change…** button is under them.
    - Below **Releases** is a **Cycles** section, its count in brackets.
    - It lists the cycles from **Sprint 1** on.
    - In the table, the **Cycle schedule** column of **Testing Stream** reads **Every 2 weeks, named Sprint {#}**.
  - **Notes:**

- [ ] `7D69` Run Publish.
  - **Expected:** The dots before **Testing Stream** and its cycles' row are now solid yellow.
  - **Notes:**

#### REL-04: The Product Manager Makes a Release From a Stream's Cycles

**Account:** Product Manager, `product.manager@fathom.test`, changed from REL-03.

**Preconditions:** Signed in with this account. Run after REL-03. **Releases** page open from the left-hand menu.

- [ ] `EF30` Select **Testing Stream** in the table.
  - **Expected:** The side panel opens, headed **Testing Stream**.
  - **Notes:**

- [ ] `5D68` Select **New release…** under **Releases** in the side panel.
  - **Expected:**
    - A dialog titled **New release in Testing Stream** opens.
    - It has **Name**, **First cycle**, **Last cycle** and **Ships on**.
    - **Ships on** is empty.
  - **Notes:**

- [ ] `5AAC` Type `Testing Release` in **Name**.
  - **Expected:** The **Name** box holds **Testing Release**.
  - **Notes:**

- [ ] `2C25` Choose **Sprint 1 (2027-01-04 to 2027-01-17)** in **First cycle**.
  - **Expected:** **First cycle** reads **Sprint 1 (2027-01-04 to 2027-01-17)**.
  - **Notes:**

- [ ] `D84E` Choose **Sprint 2 (2027-01-18 to 2027-01-31)** in **Last cycle**.
  - **Expected:** Under **Ships on**, the dialog reads **Leave empty to ship at the end of its last cycle, on 2027-01-31**.
  - **Notes:**

- [ ] `DDC5` Select **Make release**.
  - **Expected:**
    - Under **Releases** in the side panel, a row reads **Testing Release**, then **Sprint 1 to Sprint 2 · ships Jan 31, 2027**.
    - The row has a hollow yellow dot in its slot.
    - In the table, the **Releases** column of **Testing Stream** reads **(1) Testing Release**.
  - **Notes:**

- [ ] `B93D` Run Publish.
  - **Expected:** The dot before **Testing Release** is now solid yellow.
  - **Notes:**

#### REL-05: Approving a Release Approves the Stream and Cycles It Depends On

**Account:** Project Manager, `project.manager@fathom.test`, changed from REL-04.

**Preconditions:** Signed in with this account. Run after REL-04. **Testing Stream** open in the side panel.

- [ ] `83E2` Under **Releases** in the side panel, select the **⋯** button at the end of the **Testing Release** row, then **Approve…**.
  - **Expected:**
    - A dialog titled **Approve 3 drafts?** opens.
    - It says **Also approves the drafts these depend on:**, and lists:
      - **the release stream Testing Stream**.
      - **the cycles of Testing Stream from 2027-01-04**.
  - **Notes:**

- [ ] `A9B9` Select **Approve**.
  - **Expected:**
    - A notification says **Approved 3 drafts.**
    - **Testing Stream**, its cycles' row and **Testing Release** no longer have dots, in the table or the side panel.
  - **Notes:**

### Part 2: With the Seed Data

#### REL-06: The Seed Data Adds Two Release Streams

**Account:** Team Member, `team.member@fathom.test`, changed from REL-05.

**Preconditions:** Signed in with this account. Run after REL-05. **Releases** page open from the left-hand menu.

- [ ] `9A9D` Run Restore the Seed Data.
  - **Expected:**
    - Restore the Seed Data finishes with no error.
    - After the page reloads, the table shows a **Current** heading, then **Testing Stream**, **Platform** and **Patches**, in that order.
    - **Testing Stream** has no dot.
    - **Platform** has a grey lock in its slot.
    - **Patches** has a yellow dot in its slot.
    - The yellow **Retired** box follows its name.
    - There is no **New release stream** button.
  - **Notes:**

- [ ] `17E3` Select **Platform** in the table.
  - **Expected:**
    - The side panel opens, headed by the grey lock and **Platform**.
    - Under **Releases**, the rows read, from the top (see [Seeded dates](#terms)):
      - **Harbor 1**, with a blue square before it, from the cycle three quarters ago to the one two quarters ago, shipping on the last day of the second, such as **26.1 to 26.2 · ships Jun 30, 2026**, with no dot and no **⋯** button
      - **Harbor 2 LTS**, its name underlined, with a yellow dot before its teal square, from last quarter's cycle to this quarter's, shipping on the last day of this quarter, such as **26.3 to 26.4 · ships Dec 31, 2026**
      - under it, a Live row: a green dot before a purple square and **Harbor 2**
      - **Harbor 3**, with a yellow dot in its slot, a blue square and the yellow **Moved** box, then a yellow dot before cycles one later than in its Live row
      - under it, a Live row: a green dot in its slot, and **Harbor 3** from next quarter's cycle to the first half, shipping on its last day, such as **27.1 to 27.3 · ships Dec 31, 2027**
      - **Harbor 4**, with a yellow dot in its slot
    - There is no **New release…** button.
  - **Notes:**

#### REL-07: Cycles Show the Months They Span

**Account:** Team Member, `team.member@fathom.test`, the same as REL-06.

**Preconditions:** Signed in with this account. Run after REL-06. **Releases** page open.

- [ ] `37FF` Select **Patches** in the table.
  - **Expected:** The side panel opens on **Patches**.
  - **Notes:**

- [ ] `403B` Scroll the side panel down to **Cycles**.
  - **Expected:** A table with the columns **Name**, **Starts**, **Ends**, **Release**, **Months**.
  - **Notes:**

- [ ] `4B79` Read the first row, each column in order.
  - **Expected:** The row reads, from left to right:
    - the first cycle's name, such as **P24.1**
    - the Monday eight weeks before this week's Monday, such as **2026-09-07**
    - the Sunday four weeks later, such as **2026-10-04**
    - nothing under **Release**
    - the share of each month it spans, such as **Sep 2026 80%, Oct 13%**
  - **Notes:**

#### REL-08: Cycles Change Only From the Start of a Cycle

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from REL-07.

**Preconditions:** Signed in with this account. Run after REL-07. **Releases** page open from the left-hand menu, with **Testing Stream** selected in the table.

- [ ] `F37F` In the side panel, select **Change…** under **Cycle schedule**.
  - **Expected:** The menu offers **Cycles until…**, **Ends…** and **Length or names from a date…**.
  - **Notes:**

- [ ] `80EC` Select **Length or names from a date…**.
  - **Expected:**
    - A dialog titled **Change the length or names of Testing Stream's cycles** opens.
    - It has **From the start of**.
    - It shows the text **Cycles before it keep their names and dates**.
  - **Notes:**

- [ ] `B1D3` Choose **2027-02-01 (Sprint 3)** in **From the start of**.
  - **Expected:** **From the start of** reads **2027-02-01 (Sprint 3)**.
  - **Notes:**

- [ ] `F3AA` Replace the number in **Each cycle lasts** with `4`.
  - **Expected:** **Each cycle lasts** reads **4**.
  - **Notes:**

- [ ] `81B0` Select **Change cycles**.
  - **Expected:**
    - A second row, **From Feb 1, 2027**, then **Every 4 weeks, named Sprint {#}**, appears.
    - It has a hollow yellow dot in its slot.
  - **Notes:**

- [ ] `FDA2` Select the **⋯** button at the end of that row, then **Discard draft**.
  - **Expected:**
    - A notification says **Discarded the draft.**
    - The row is gone.
  - **Notes:**

### Part 3: Changing What Is Already There

#### REL-09: A Stream Is Renamed by a Draft

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as REL-08.

**Preconditions:** Signed in with this account. Run after REL-08. **Releases** page open from the left-hand menu, with **Testing Stream** selected in the table.

- [ ] `130B` Select **Rename** at the top of the side panel.
  - **Expected:**
    - A dialog titled **Rename Testing Stream** opens.
    - The **Name** box holds **Testing Stream**.
  - **Notes:**

- [ ] `6D73` Replace the name with `Tested Stream`.
  - **Expected:** The **Name** box holds **Tested Stream**.
  - **Notes:**

- [ ] `7FFB` Select **Save**.
  - **Expected:**
    - The side panel shows a hollow yellow dot before **Tested Stream**.
    - The table shows a hollow yellow dot before **Tested Stream**.
  - **Notes:**

- [ ] `472A` Select **Discard draft**.
  - **Expected:**
    - The side panel and the table show **Testing Stream** again.
    - **Testing Stream** has no dot in either.
  - **Notes:**

#### REL-10: A Stream Is Retired by a Draft

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as REL-09.

**Preconditions:** Signed in with this account. Run after REL-09. **Releases** page open, with **Testing Stream** selected in the table.

- [ ] `050B` Select **Retire** at the top of the side panel.
  - **Expected:**
    - The side panel's heading shows a hollow yellow dot, **Testing Stream**, then the yellow **Retired** box.
    - The side panel's button now reads **Restore**.
    - In the table, **Testing Stream** is still the first stream under the **Current** heading.
    - It has a hollow yellow dot in its slot.
    - The yellow **Retired** box follows its name.
  - **Notes:**

- [ ] `0C4B` Select the **⋯** button beside the close button at the top of the side panel, then **Discard draft**.
  - **Expected:**
    - A notification says **Discarded the draft.**
    - **Testing Stream** has no dot.
    - **Testing Stream** has no **Retired** box.
    - The button reads **Retire** again.
  - **Notes:**

#### REL-11: Approving a Retired Stream Stops New Releases in It

**Account:** Project Manager, `project.manager@fathom.test`, changed from REL-10.

**Preconditions:** Signed in with this account. Run after REL-10. **Releases** page open from the left-hand menu, with **Patches** selected in the table.

- [ ] `30D8` Select the **⋯** button beside the close button at the top of the side panel, then **Approve…**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] `5D18` Select **Approve**.
  - **Expected:**
    - A notification says **Approved 1 draft.**
    - In the table, **Patches** is no longer listed.
    - A **Views** button is at the right of the bar above the timeline.
    - The side panel's heading shows **Patches**, then a grey **Retired** box.
  - **Notes:**

- [ ] `EB91` Select **Views**, then **Show retired (1)**.
  - **Expected:**
    - Under the **Current** heading are **Testing Stream** and **Platform**.
    - Under a **Retired** heading is **Patches**, with no dot.
  - **Notes:**

- [ ] `A5A4` Select **Views**.
  - **Expected:**
    - **Show retired (1)** is ticked.
    - **Clear view** is offered.
  - **Notes:**

- [ ] `9C3B` Reload the page.
  - **Expected:** **Patches** is still under the **Retired** heading.
  - **Notes:**

- [ ] `EEA9` Look under **Releases** in the side panel.
  - **Expected:**
    - Both patch releases are listed, such as **Patch November** and **Patch December**.
    - The later has a red dot in a ring before it.
    - There is no **New release…** button.
  - **Notes:**

#### REL-12: A Release Is Changed by a Draft

**Account:** Product Manager, `product.manager@fathom.test`, changed from REL-11.

**Preconditions:** Signed in with this account. Run after REL-11. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] `3F25` Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor 1** row, then **Change…**.
  - **Expected:**
    - A dialog titled **Change Harbor 1** opens.
    - **Name** holds **Harbor 1**.
    - The first cycle is the cycle three quarters ago, such as **26.1 (2026-01-01 to 2026-03-31)**.
    - The last cycle is the cycle two quarters ago, such as **26.2 (2026-04-01 to 2026-06-30)**.
  - **Notes:**

- [ ] `3CA7` Replace the name with `Harbor One`.
  - **Expected:** The **Name** box holds **Harbor One**.
  - **Notes:**

- [ ] `43E8` Select **Save**.
  - **Expected:**
    - The row reads **Harbor One**.
    - A hollow yellow dot is before its square.
  - **Notes:**

- [ ] `3E52` Run Publish.
  - **Expected:** The dot before **Harbor One** is now solid yellow.
  - **Notes:**

#### REL-13: A Rejected Draft Says Why It Was Rejected

**Account:** Project Manager, `project.manager@fathom.test`, changed from REL-12.

**Preconditions:** Signed in with this account. Run after REL-12. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] `E857` Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor One** row, then **Reject…**.
  - **Expected:**
    - A dialog titled **Reject 1 draft?** opens.
    - It has a **Reason** box.
  - **Notes:**

- [ ] `EC7D` Type `Keep the old name` in **Reason**.
  - **Expected:** The **Reason** box holds **Keep the old name**.
  - **Notes:**

- [ ] `784C` Select **Reject**.
  - **Expected:**
    - A notification says **Rejected 1 draft.**
    - The row shows a red dot in a ring before **Harbor One**'s square.
  - **Notes:**

#### REL-14: A Rejected Draft Can Be Resubmitted

**Account:** Product Manager, `product.manager@fathom.test`, changed from REL-13.

**Preconditions:** Signed in with this account. Run after REL-13. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] `331A` Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor One** row.
  - **Expected:**
    - Under **Harbor One**, the menu offers **Change…** and **Remove**.
    - Then it shows:
      - A red dot in a ring and **Rejected**
      - **Reason: Keep the old name**
      - **Changed by Product Manager**
      - Then **Resubmit** and **Discard draft**
  - **Notes:**

- [ ] `6DE5` Select **Resubmit**.
  - **Expected:**
    - A notification says **Resubmitted the draft.**
    - The row shows a yellow dot before **Harbor One**'s square again.
  - **Notes:**

#### REL-15: A Release Is Removed by a Draft

**Account:** Product Manager, `product.manager@fathom.test`, the same as REL-14.

**Preconditions:** Signed in with this account. Run after REL-14. **Testing Stream** selected in the table.

- [ ] `C20C` Under **Releases**, select the **⋯** button at the end of the **Testing Release** row, then **Remove**.
  - **Expected:**
    - The **Testing Release** row has a hollow yellow dot in its slot.
    - The row is struck through.
  - **Notes:**

- [ ] `25FE` Read **Testing Stream**'s releases lane on the timeline.
  - **Expected:**
    - **Testing Release** is still there, struck through.
    - A hollow yellow dot is before its name.
  - **Notes:**

- [ ] `1DF3` Under **Releases** in the side panel, select **Discard draft** in the **Testing Release** row's **⋯** menu.
  - **Expected:**
    - A notification says **Discarded the draft.**
    - The **Testing Release** row is no longer struck through.
    - The **Testing Release** row has no dot.
    - On the timeline, **Testing Release** is not struck through.
    - On the timeline, **Testing Release** has no dot.
  - **Notes:**

#### REL-16: A Stream's Cycles Are Made Until a Later Day

**Account:** Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`, changed from REL-15. Step `A85C` signs in as another account.

**Preconditions:** Signed in with this account. Run after REL-15. **Releases** page open from the left-hand menu.

- [ ] `9F3F` Run Discard the Unpublished Changes.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `A85C` Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Operations Manager**.
  - **Notes:**

- [ ] `CC73` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The streams table shows **Platform**.
    - **Platform** has no grey lock in its slot.
  - **Notes:**

- [ ] `3A26` Select **Platform** in the table.
  - **Expected:**
    - The side panel opens, headed **Platform**.
    - There is no grey lock.
  - **Notes:**

- [ ] `3D69` Under **Cycle schedule**, select the **Change…** button below the line **Cycles until** and 31 December three years after this year, such as **Cycles until Dec 31, 2029**, then **Cycles until…** in its menu.
  - **Expected:**
    - A dialog titled **Change how far ahead Platform's cycles are made** opens.
    - **Cycles until** holds that day.
    - Below it, a line counts as many cycles in all as the **Cycles** heading counts, followed by **as now**, such as **11 cycles in all, as now**.
    - Under **Last cycles** are the last three half-year cycles, the last starting on or before that day, such as **28.2** with **2028-07-01 to 2028-12-31**, **29.1** with **2029-01-01 to 2029-06-30**, and **29.2** with **2029-07-01 to 2029-12-31**.
  - **Notes:**

- [ ] `1B32` Replace the day with the same day a year later, such as `20301231`.
  - **Expected:** **Cycles until** holds the new day, such as **2030-12-31**.
  - **Notes:**

- [ ] `B32E` Select **Save**.
  - **Expected:**
    - The panel's heading shows a hollow yellow dot before **Platform**.
    - **Cycles until** reads the new day, such as **Cycles until Dec 31, 2030**.
    - The **Cycles** heading counts two more cycles, such as **Cycles (13)**.
    - Its last row is a half-year cycle starting in the new day's year, such as **30.2** from **Jul 1, 2030**.
  - **Notes:**

- [ ] `AAA0` Select the **⋯** button in the panel's heading, then **Discard draft**.
  - **Expected:**
    - **Cycles until** reads 31 December three years after this year, such as **Cycles until Dec 31, 2029**.
    - The **Cycles** heading counts the cycles up to that day, such as **Cycles (11)**.
  - **Notes:**

#### REL-17: A Release Ships on a Day of Its Own

**Account:** Product Manager, `product.manager@fathom.test`, changed from REL-16.

**Preconditions:** Signed in with this account. Run after REL-16. **Releases** page open from the left-hand menu, with **Testing Stream** selected in the table.

- [ ] `DC88` Under **Releases**, select the **⋯** button at the end of the **Testing Release** row, then **Change…**.
  - **Expected:**
    - A dialog titled **Change Testing Release** opens.
    - **Ships on** is empty.
    - Under it, **Leave empty to ship at the end of its last cycle, on 2027-01-31**.
  - **Notes:**

- [ ] `DED5` Type `20270303` in **Ships on**.
  - **Expected:** **Ships on** shows **2027-03-03**.
  - **Notes:**

- [ ] `C5B2` Select **Save**.
  - **Expected:**
    - The **Testing Release** row has a hollow yellow dot before **Sprint 1 to Sprint 2 · ships Mar 3, 2027**.
    - After it, in bold, the row reads **31 days after Sprint 2 ends**.
    - In the **Cycles** section, **Sprint 3** still starts on **Feb 1, 2027**.
  - **Notes:**

- [ ] `5D17` Select the **⋯** button at the end of the **Testing Release** row, then **Discard draft**.
  - **Expected:**
    - A notification says **Discarded the draft.**
    - The row reads **Sprint 1 to Sprint 2 · ships Jan 31, 2027**.
    - Nothing follows the date.
  - **Notes:**

### Part 4: The Timeline

#### REL-18: The Timeline Shows Every Current Stream

**Account:** Team Member, `team.member@fathom.test`, changed from REL-17.

**Preconditions:** Signed in with this account. Run after REL-17. **Releases** page open from the left-hand menu.

- [ ] `6CDB` Run Restore the Seed Data.
  - **Expected:**
    - Restore the Seed Data finishes with no error.
    - After the page reloads, the streams table shows **Testing Stream**, **Platform** and **Patches** under the **Current** heading.
    - There is no **Retired** heading, and no **Views** button in the bar.
    - The **Timeline** heading shows above the streams table, with the zoom buttons at its top right.
  - **Notes:**

- [ ] `56D9` Select **Year**.
  - **Expected:**
    - **Year** is highlighted.
    - The timeline has three rows, named **Testing Stream**, **Platform** and **Patches**.
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
    - The whole timeline fits across, from the earliest cycle of any stream to the end of the last, such as 2026 to 2030, with no scrolling sideways.
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

**Account:** Product Manager, `product.manager@fathom.test`, changed from REL-20.

**Preconditions:** Signed in with this account. Run after REL-20. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] `752C` In the side panel's **Cycles** table, find the row of last quarter's cycle, the one after **Harbor 1**'s last, such as **26.3**.
  - **Expected:** Its **Ends** shows a day, such as **Sep 30, 2026**. Write that day down.
  - **Notes:**

- [ ] `EBEE` Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor 1** row, then **Change…**.
  - **Expected:** A dialog titled **Change Harbor 1** opens.
  - **Notes:**

- [ ] `004F` Type the day written down in step `752C` in **Ships on**, as its digits, such as `20260930`.
  - **Expected:** **Ships on** shows that day, such as **2026-09-30**.
  - **Notes:**

- [ ] `C4FC` Select **Save**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] `23DD` Close the side panel.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] `EFE7` Select **6 months**.
  - **Expected:** **6 months** is highlighted.
  - **Notes:**

- [ ] `CAEE` Find **Harbor 1** in **Platform**'s releases lane, scrolling the timeline left to it.
  - **Expected:**
    - **Harbor 1**'s span, across the cycles three and two quarters ago, such as **26.1** and **26.2**, has a hollow yellow dot before its name.
    - Under the span, a dashed line runs from its right end, under the next release, to a diamond a quarter later, on the day typed.
    - In a lane under **Platform**'s releases, a faded **Harbor 1** after a green dot has its diamond under its right end.
  - **Notes:**

- [ ] `8BD8` Select **Platform** in the table.
  - **Expected:** The side panel opens, headed **Platform**.
  - **Notes:**

- [ ] `9D42` In the side panel, select the **⋯** button at the end of the **Harbor 1** row, then **Discard draft**.
  - **Expected:**
    - A notification says **Discarded the draft.**
    - On the timeline, **Harbor 1**'s span has no dot before its name.
    - Its diamond is under its right end.
    - There is no dashed line.
    - The faded **Harbor 1** is gone.
  - **Notes:**

#### REL-22: A Release's Colour Is Chosen in Its Dialog

**Account:** Product Manager, `product.manager@fathom.test`, the same as REL-21. Step `004B` signs in as another account.

**Preconditions:** Signed in with this account. Run after REL-21. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] `8A38` Close the side panel.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] `A5E5` Select **Year**.
  - **Expected:** **Year** is highlighted.
  - **Notes:**

- [ ] `F2EF` Find **Platform**'s releases lane, scrolling the timeline left if **Harbor 1** is not wholly in view.
  - **Expected:**
    - **Harbor 1** and **Harbor 3** are blue.
    - **Harbor 2 LTS** is teal.
    - Each diamond is the colour of its span.
    - Each name is in the page's usual text colour.
  - **Notes:**

- [ ] `1D69` Select **Platform** in the table.
  - **Expected:** The side panel opens, headed **Platform**.
  - **Notes:**

- [ ] `962F` In the side panel, select the **⋯** button at the end of the **Harbor 1** row, then **Change…**.
  - **Expected:**
    - A dialog titled **Change Harbor 1** opens.
    - Its last field, **Colour**, reads **Sea (default)**.
    - A blue square is before **Sea (default)**.
    - **How the release is drawn on the timeline** is under its label.
  - **Notes:**

- [ ] `2CB3` Open **Colour**.
  - **Expected:**
    - The list offers **Sea (default)**, then **Indigo**, **Violet**, **Grape**, **Pink**, **Red**, **Orange**, **Yellow**, **Lime**, **Green** and **Teal**.
    - Each has a square of its colour.
  - **Notes:**

- [ ] `50B5` Select **Teal**.
  - **Expected:**
    - **Colour** reads **Teal**.
    - A teal square is before it.
  - **Notes:**

- [ ] `CE70` Select **Save**.
  - **Expected:**
    - The **Harbor 1** row has a hollow yellow dot before its square.
    - The square is teal.
    - On the timeline, **Harbor 1**'s span is teal.
    - The span has a hollow yellow dot before its name.
  - **Notes:**

- [ ] `D4FC` Run Publish.
  - **Expected:** The dot before **Harbor 1**'s square is now solid yellow.
  - **Notes:**

- [ ] `004B` Sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Project Manager**.
  - **Notes:**

- [ ] `4A39` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The draft of **the release Harbor 1 in Platform** lists **Colour from Sea to Teal**.
  - **Notes:**

- [ ] `DC38` Tick the entry for **the release Harbor 1 in Platform**.
  - **Expected:** The button at the top right reads **Approve 1 draft…**.
  - **Notes:**

- [ ] `BF5D` Select **Approve 1 draft…**.
  - **Expected:**
    - A dialog headed **Approve 1 draft?** opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] `7B68` Select **Approve** in the dialog.
  - **Expected:** A notification says **Approved 1 draft.**
  - **Notes:**

- [ ] `2C9B` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - **Harbor 1**'s span on the timeline is teal.
    - The span has no dot before its name.
  - **Notes:**

### Part 5: Changing One Cycle's Length

#### REL-23: A Cycle's New Length Moves the Cycles and Releases After It

**Account:** Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`, changed from REL-22. Step `9D01` signs in as another account, and step `B6FF` as the Workforce Administrator.

**Preconditions:** Run after REL-22. Run Restore the Seed Data. Signed in with this account.

- [ ] `11A6` Run Discard the Unpublished Changes.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `9D01` Sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Product Manager**.
  - **Notes:**

- [ ] `F216` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The streams table shows **Platform**.
    - **Platform** has no grey lock in its slot.
  - **Notes:**

- [ ] `3F63` Select **Platform** in the table.
  - **Expected:** The side panel opens, headed **Platform**.
  - **Notes:**

- [ ] `F31C` Under **Releases**, select the **⋯** button at the end of the **Harbor 2 LTS** row, then **Discard draft**.
  - **Expected:**
    - The row reads **Harbor 2**.
    - It has no dot.
  - **Notes:**

- [ ] `844A` Select the **⋯** button at the end of the **Harbor 3** row, then **Discard draft**.
  - **Expected:**
    - **Harbor 3** has no dot.
    - **Harbor 3** has no **Moved** box.
  - **Notes:**

- [ ] `D78C` Select the **⋯** button at the end of the **Harbor 4** row, then **Discard draft**.
  - **Expected:** **Harbor 4** is gone.
  - **Notes:**

- [ ] `B6FF` Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Operations Manager**.
  - **Notes:**

- [ ] `196D` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The streams table shows **Platform**, with no dot in its slot.
    - **Platform** has no grey lock in its slot.
  - **Notes:**

- [ ] `B1AB` Select **Platform** in the table.
  - **Expected:** The side panel opens, headed **Platform**.
  - **Notes:**

- [ ] `19CE` In the side panel's **Cycles** table, select the **⋯** button at the end of next quarter's cycle, such as **27.1**, then **Change length…**.
  - **Expected:**
    - A dialog titled **Change the length of** that cycle opens.
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
    - Below it, the dialog says that **Harbor 3**, **Data Retention Controls** and **Report Builder** move with their cycles.
    - It says **Harbor 3 ships** on the first half's new last day, such as **Harbor 3 ships 2027-11-30.**
  - **Notes:**

- [ ] `CDF0` Select **Change length**.
  - **Expected:**
    - Under **Cycle schedule**, a row reads **From** the changed cycle's first day, **Every 2 months, named {YY}.{N}**, such as **From 2027-01-01**.
    - It has a hollow yellow dot in its slot.
    - A row reads **From** the next cycle's new first day, **Every 3 months, named {YY}.{N}**, such as **From 2027-03-01**.
    - It has a hollow yellow dot in its slot.
    - The first half's row reads **From** the first half's new first day, **Every 6 months, named {YY}.{N}**, such as **From 2027-06-01**.
    - It has a hollow yellow dot before its new day.
    - The **Harbor 3** row has a hollow yellow dot before its cycles.
    - It ships on the first half's new last day, such as **27.1 to 27.3 · ships 2027-11-30**.
    - In the **Cycles** table, the first half runs on its new dates, such as **27.3** from **2027-06-01** to **2027-11-30**.
  - **Notes:**

- [ ] `4CBE` Run Publish.
  - **Expected:** The dots on the three rows of the cycle schedule and on **Harbor 3** are solid yellow.
  - **Notes:**

#### REL-24: Approving One Draft of a New Length Approves Them All

**Account:** Project Manager, `project.manager@fathom.test`, changed from REL-23.

**Preconditions:** Signed in with this account. Run after REL-23. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] `6F59` Under **Releases**, select the **⋯** button at the end of the **Harbor 3** row, then **Approve…**.
  - **Expected:**
    - A dialog titled **Approve 6 drafts?** opens.
    - It says **Also approves the drafts these depend on:**, and lists:
      - **the cycles of Platform from** the changed cycle's first day, such as **the cycles of Platform from 2027-01-01**.
      - **the cycles of Platform from** the next cycle's new first day, such as **the cycles of Platform from 2027-03-01**.
      - **the cycles of Platform from** the first half's new first day, such as **the cycles of Platform from 2027-06-01**.
      - **the feature Data Retention Controls**.
      - **the feature Report Builder**.
  - **Notes:**

- [ ] `3A60` Select **Approve**.
  - **Expected:**
    - A notification says **Approved 6 drafts.**
    - No row under **Cycle schedule** or **Releases** has a dot.
    - **Harbor 3** still ships on the first half's new last day, such as **27.1 to 27.3 · ships 2027-11-30**.
  - **Notes:**

#### REL-25: Later Cycles Can Keep Their Dates

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from REL-24.

**Preconditions:** Run after REL-24. Signed in with this account. **Releases** page open from the left-hand menu, with **Patches** selected in the table.

- [ ] `1D3D` In the **Cycles** table, select the **⋯** button at the end of the later patch release's last cycle, the fourth cycle, such as **P24.4**, then **Change length…**.
  - **Expected:** A dialog titled **Change the length of** that cycle opens.
  - **Notes:**

- [ ] `045F` Replace **4** in **Length** with `2`.
  - **Expected:** **Length** reads **2**, followed by **weeks**.
  - **Notes:**

- [ ] `B0CC` Select **Keep their dates**.
  - **Expected:**
    - **New dates** lists that cycle two weeks long, then a cycle from the next day to the end of the cycle after it, six weeks long, then the cycle after that, four weeks long, such as **P24.4**, **2026-11-30 to 2026-12-13**; **P25.1**, **2026-12-14 to 2027-01-24**; and **P25.2**, **2027-01-25 to 2027-02-21**.
    - Below it, the dialog says the later patch release ships on that cycle's new last day, such as **Patch December ships 2026-12-13.**
  - **Notes:**

- [ ] `58F4` Select **Change length**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] `CD05` Run Publish.
  - **Expected:**
    - Under **Cycle schedule**, there is a row **From** each of the three cycles' first days, such as **From 2026-11-30**, **From 2026-12-14** and **From 2027-01-25**.
    - Each of these rows has a yellow dot in its slot.
    - The later patch release has only the red dot in a ring before its name.
    - It ships on the changed cycle's new last day, such as **Patch December**, **P24.3 to P24.4 · ships 2026-12-13**.
  - **Notes:**

#### REL-26: Discarding One Draft of a New Length Discards Them All

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as REL-25.

**Preconditions:** Signed in with this account. Run after REL-25. **Releases** page open from the left-hand menu, with **Patches** selected in the table.

- [ ] `BC43` Select the **⋯** button at the end of the second of the three rows REL-25 added, such as **From 2026-12-14**, then **Discard draft**.
  - **Expected:** A notification says **Discarded the draft.**
  - **Notes:**

- [ ] `9B5E` Run Publish.
  - **Expected:**
    - The cycle schedule has only its first row.
    - The fourth cycle is four weeks long again, such as **P24.4** from **2026-11-30** to **2026-12-27**.
  - **Notes:**

### Part 6: Release Notes

#### REL-27: A Release's Note Is Read and Written Beside Its Stream

**Account:** Product Manager, `product.manager@fathom.test`, changed from REL-26.

**Preconditions:** Signed in with this account. Run after REL-26. **Light** chosen in the Appearance menu. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] `81AA` Select **Harbor 2**'s underlined name.
  - **Expected:**
    - A panel titled **Harbor 2** opens under the stream's panel.
    - It shows the note as it reads:
      - two headings
      - a bullet list with **every** in bold
      - a checklist with its first box ticked
      - red text
      - a link
  - **Notes:**

- [ ] `A90C` Choose **Dark** in the Appearance menu.
  - **Expected:** Both panels read well in dark mode.
  - **Notes:**

- [ ] `DA1F` Choose **Light** in the Appearance menu.
  - **Expected:** The panels are light.
  - **Notes:**

- [ ] `C2A8` Select **Editor**.
  - **Expected:** The note opens for editing.
  - **Notes:**

- [ ] `E879` Type a few words at the end of the note.
  - **Expected:** The words show at the end of the note.
  - **Notes:**

- [ ] `AAD0` Select **Save**.
  - **Expected:**
    - The note's panel closes.
    - The **Harbor 2** row has a hollow yellow dot in its slot.
  - **Notes:**

### Part 7: The Streams Table

#### REL-28: Streams Are Found, Opened and Grouped in the Table

**Account:** Team Member, `team.member@fathom.test`, changed from REL-27.

**Preconditions:** Signed in with this account. Run after REL-27, or on its own. **Releases** page open from the left-hand menu.

- [ ] `DCE3` Run Restore the Seed Data.
  - **Expected:** After the page reloads, **Platform** and **Patches** are among the streams under the **Current** heading.
  - **Notes:**

- [ ] `FAC3` Read **Platform**'s row in the streams table.
  - **Expected:**
    - **Cycle schedule** reads **Every 3 months, named {YY}.{N}**.
    - **Releases** reads **(4)**, then the names of its four releases.
    - **Next release** reads **Harbor 2 LTS**, then **ships** and the last day of this quarter, such as **Harbor 2 LTS, ships Dec 31, 2026**.
    - **Planned to** shows a day with a short month and its year.
  - **Notes:**

- [ ] `7314` Press Cmd+F on a Mac, or Ctrl+F elsewhere.
  - **Expected:** The cursor is in the search field at the left of the bar above the timeline.
  - **Notes:**

- [ ] `17A8` Type `patch`.
  - **Expected:**
    - The streams table shows **Patches** alone.
    - The timeline still shows **Platform** and **Patches**.
  - **Notes:**

- [ ] `93B7` Press Esc.
  - **Expected:**
    - The search field is empty.
    - The streams table shows **Platform** and **Patches** again.
  - **Notes:**

- [ ] `39AF` Select **Platform** in the table.
  - **Expected:**
    - The side panel opens on **Platform**, beside the timeline and the streams table.
    - **Platform** in the side panel's heading has the focus.
  - **Notes:**

- [ ] `B372` Press Esc.
  - **Expected:**
    - The side panel closes.
    - **Platform**'s **Stream** cell is selected in the streams table.
  - **Notes:**

- [ ] `38AD` Choose **Cycle schedule** in the **Group by** menu.
  - **Expected:**
    - The **Group by** button reads **Group by: Cycle schedule**.
    - Each cycle schedule heads the streams that have it, such as **Every 3 months, named {YY}.{N}** over **Platform**, with how many each holds.
  - **Notes:**

- [ ] `8D0D` Reload the page.
  - **Expected:** The streams table is still grouped by cycle schedule.
  - **Notes:**

#### REL-29: A Stream Ends on Its Last Day

**Account:** Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`, changed from REL-28.

**Preconditions:** Signed in with this account. Run after REL-28. **Releases** page open from the left-hand menu.

- [ ] `3F07` Run Discard the Unpublished Changes.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `C6A8` Select **Platform** in the table.
  - **Expected:**
    - The side panel opens, headed **Platform**, with no grey lock.
    - Under **Cycle schedule**, below the cycle changes, a line reads **Cycles until** and 31 December three years after this year, such as **Cycles until Dec 31, 2029**.
    - A **Change…** button is under that line.
  - **Notes:**

- [ ] `5E2A` Select the **Change…** button under the **Cycles until** line, then **Ends…** in its menu.
  - **Expected:**
    - A dialog titled **Change when Platform ends** opens.
    - Its one field, **Ends**, is empty.
    - Under **Ends**, a line reads **The cycle holding this day ends on it**.
  - **Notes:**

- [ ] `0C94` Type 30 September three years after this year in **Ends**, such as `20290930`.
  - **Expected:**
    - Under **Last cycles**, the last row is a half-year cycle cut short to end on that day, such as **29.2** with **2029-07-01 to 2029-09-30**.
    - The line above it counts as many cycles in all as now, such as **11 cycles in all, as now**.
  - **Notes:**

- [ ] `E61F` Select **Save**.
  - **Expected:**
    - The dialog closes.
    - The panel's heading shows a hollow yellow dot before **Platform**.
    - Under **Cycle schedule**, the line below the cycle changes reads **Ends** and that day, such as **Ends Sep 30, 2029**.
    - The last row of **Cycles** is the cut cycle, such as **29.2** from **Jul 1, 2029** to **Sep 30, 2029**.
  - **Notes:**

- [ ] `9A3B` On the timeline, select **All**, then read the end of **Platform**'s cycle lane.
  - **Expected:**
    - The lane stops at that day, with a short upright grey line at its end.
    - **Patches**' lane has no such line.
  - **Notes:**

- [ ] `D48E` Select the **⋯** button in the panel's heading, then **Discard draft**.
  - **Expected:**
    - **Cycles until** reads 31 December three years after this year, such as **Cycles until Dec 31, 2029**.
    - On the timeline, **Platform**'s lane has no upright line at its end.
  - **Notes:**
