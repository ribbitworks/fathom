---
title: "Manual Test: Release Streams, Cycles and Releases"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/product/decisions.md"]
last_updated: "2026-11-11"
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
- **Streams table:** the table on the Releases page, with a row for each release stream and the columns **Stream**, **Cycle schedule** and **Releases**. Selecting a row opens the stream in the side panel.
- **Side panel on Releases:** the panel beside the streams table for the selected stream, which the table narrows to make room for, with the sections **Cycle schedule**, **Releases** and **Cycles**. Dragging its left edge resizes it.
- **Timeline:** the section headed **Timeline** below the streams table, with **Today**, **−** and **+** buttons and the zoom buttons **All**, **Year**, **6 months**, **Quarter**, **Month**, **Week** and **Days** at its top right. It has a row for each stream that is not retired, named on the left, with a lane of the stream's cycles above a lane of its releases, under an axis of two rows of dates. Hovering over a cycle or a release shows its name and dates.
- **⋯ menu on Releases:** a **⋯** button beside the side panel's close button acts on the stream itself, when it has a draft; one at the end of a row in the side panel acts on that change of cycles or release; one at the end of a row of the **Cycles** table acts on that cycle.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Start From an Empty Database. Part 1 starts from an empty database; REL-06 adds the seed data for Part 2; Part 3 changes what Parts 1 and 2 left; REL-18 restores the seed data for Part 4, and REL-22 restores it again for Part 5, which Part 6 follows. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out. To run the test again, start again from Start From an Empty Database.

### Part 1: From an Empty Database

#### REL-01: An Organization Starts With No Release Streams

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Start From an Empty Database run, then signed in with this account.

- [ ] **Step 1.** Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The **Releases** page opens with no table.
    - It reads **No release streams yet.**, and a **New release stream** button is at the top right.
  - **Notes:**

#### REL-02: The Engineering Operations Manager Drafts a New Release Stream

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as REL-01.

**Preconditions:** Signed in with this account. Run after REL-01. **Releases** page open.

- [ ] **Step 1.** Select **New release stream** at the top right of the page.
  - **Expected:** A dialog titled **New release stream** opens, with a **Name** box.
  - **Notes:**

- [ ] **Step 2.** Type `Testing Stream` and select **Add stream**.
  - **Expected:**
    - The dialog closes.
    - The streams table shows one row, **Testing Stream**, with a hollow yellow dot in its slot.
    - The side panel opens on the right, headed by a hollow yellow dot and **Testing Stream**, with **No cycles yet.** under **Cycle schedule** and **No releases yet.** under **Releases**.
  - **Notes:**

#### REL-03: A New Stream's Cycles Show Their Names Before They Are Saved

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as REL-02.

**Preconditions:** Signed in with this account. Run after REL-02. **Testing Stream** open in the side panel.

- [ ] **Step 1.** In the side panel, select **Set up cycles…** under **Cycle schedule**.
  - **Expected:** A dialog titled **Set up cycles for Testing Stream** opens, with:
    - an empty **First cycle starts** box showing **2027-01-01** in grey
    - **Each cycle lasts** set to **3**, with **Months** selected
    - **Names** set to **{YY}.{N}**
  - **Notes:**

- [ ] **Step 2.** Type `20270104` in **First cycle starts**, change **Each cycle lasts** to `2`, and select **Weeks**.
  - **Expected:**
    - The box shows **2027-01-04**.
    - Below **Names**, under **First cycles**, three lines: **27.1** with **2027-01-04 to 2027-01-17**, **27.2** with **2027-01-18 to 2027-01-31**, and **27.3** with **2027-02-01 to 2027-02-14**.
  - **Notes:**

- [ ] **Step 3.** Replace **Names** with `Sprint {#}`.
  - **Expected:** The three lines under **First cycles** now start with **Sprint 1**, **Sprint 2** and **Sprint 3**.
  - **Notes:**

- [ ] **Step 4.** Select **Set up cycles**.
  - **Expected:**
    - The dialog closes.
    - Under **Cycle schedule**, a row reads **From 2027-01-04**, then **Every 2 weeks, named Sprint {#}**, with a hollow yellow dot in its slot, and below it **Planned to** and a day two years after today, with a **Change…** button under it.
    - Below **Releases**, a **Cycles** section, its count in brackets, lists the cycles from **Sprint 1** on.
    - In the table, the **Cycle schedule** column of **Testing Stream** reads **Every 2 weeks, named Sprint {#}**.
  - **Notes:**

- [ ] **Step 5.** Run Publish.
  - **Expected:** The dots before **Testing Stream** and its cycles' row are now solid yellow.
  - **Notes:**

#### REL-04: The Product Manager Makes a Release From a Stream's Cycles

**Account:** Product Manager, `product.manager@fathom.test`, changed from REL-03.

**Preconditions:** Signed in with this account. Run after REL-03. **Releases** page open from the left-hand menu.

- [ ] **Step 1.** Select **Testing Stream** in the table, then **New release…** under **Releases** in the side panel.
  - **Expected:** A dialog titled **New release in Testing Stream** opens, with **Name**, **First cycle**, **Last cycle** and an empty **Ships on**.
  - **Notes:**

- [ ] **Step 2.** Type `Testing Release` in **Name**, choose **Sprint 1 (2027-01-04 to 2027-01-17)** as the first cycle and **Sprint 2 (2027-01-18 to 2027-01-31)** as the last.
  - **Expected:** Under **Ships on**, the dialog reads **Leave empty to ship at the end of its last cycle, on 2027-01-31**.
  - **Notes:**

- [ ] **Step 3.** Select **Make release**.
  - **Expected:**
    - Under **Releases** in the side panel, a row reads **Testing Release**, with a hollow yellow dot in its slot, then **Sprint 1 to Sprint 2 · ships 2027-01-31**.
    - In the table, the **Releases** column of **Testing Stream** reads **(1) Testing Release**.
  - **Notes:**

- [ ] **Step 4.** Run Publish.
  - **Expected:** The dot before **Testing Release** is now solid yellow.
  - **Notes:**

#### REL-05: Approving a Release Approves the Stream and Cycles It Depends On

**Account:** Project Manager, `project.manager@fathom.test`, changed from REL-04.

**Preconditions:** Signed in with this account. Run after REL-04. **Testing Stream** open in the side panel.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Testing Release** row, then **Approve…**.
  - **Expected:** A dialog titled **Approve 3 drafts?** says **Also approves the drafts these depend on:**, listing **the release stream Testing Stream** and **the cycles of Testing Stream from 2027-01-04**.
  - **Notes:**

- [ ] **Step 2.** Select **Approve**.
  - **Expected:**
    - A notification says **Approved 3 drafts.**
    - **Testing Stream**, its cycles' row and **Testing Release** no longer have dots, in the table or the side panel.
  - **Notes:**

### Part 2: With the Seed Data

#### REL-06: The Seed Data Adds Two Release Streams

**Account:** Team Member, `team.member@fathom.test`, changed from REL-05.

**Preconditions:** Signed in with this account. Run after REL-05. **Releases** page open from the left-hand menu.

- [ ] **Step 1.** Run Restore the Seed Data.
  - **Expected:**
    - Restore the Seed Data finishes with no error.
    - After the page reloads, the table shows **Testing Stream**, **Platform** and **Patches**, in that order.
    - **Testing Stream** has no dot.
    - **Platform** has a grey lock in its slot.
    - **Patches** has a yellow dot in its slot, then the yellow **Retired** box after its name.
    - There is no **New release stream** button.
  - **Notes:**

- [ ] **Step 2.** Select **Platform** in the table.
  - **Expected:**
    - The side panel opens, headed by the grey lock and **Platform**.
    - Under **Releases**, the rows read, from the top (see [Seeded dates](#terms)):
      - **Harbor 1**, with a blue square before it, from the cycle three quarters ago to the one two quarters ago, shipping on the last day of the second, such as **26.1 to 26.2 · ships 2026-06-30**, with no dot and no **⋯** button
      - **Harbor 2 LTS**, its name underlined, with a yellow dot before its teal square, from last quarter's cycle to this quarter's, shipping on the last day of this quarter, such as **26.3 to 26.4 · ships 2026-12-31**
      - under it, a Live row: a green dot before a purple square and **Harbor 2**
      - **Harbor 3**, with a yellow dot in its slot, a blue square and the yellow **Moved** box, then a yellow dot before cycles one later than in its Live row
      - under it, a Live row: a green dot in its slot, and **Harbor 3** from next quarter's cycle to the first half, shipping on its last day, such as **27.1 to 27.3 · ships 2027-12-31**
      - **Harbor 4**, with a yellow dot in its slot
    - There is no **New release…** button.
  - **Notes:**

#### REL-07: Cycles Show the Months They Span

**Account:** Team Member, `team.member@fathom.test`, the same as REL-06.

**Preconditions:** Signed in with this account. Run after REL-06. **Releases** page open.

- [ ] **Step 1.** Select **Patches** in the table, then scroll the side panel down to **Cycles**.
  - **Expected:** A table with the columns **Name**, **Starts**, **Ends**, **Release**, **Months**.
  - **Notes:**

- [ ] **Step 2.** Read the first row, each column in order.
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

- [ ] **Step 1.** In the side panel, select **Change…** under **Cycle schedule**, then **Length or names from a date…**.
  - **Expected:**
    - The menu offers **Planned to…** and **Length or names from a date…**.
    - A dialog titled **Change the length or names of Testing Stream's cycles** opens, with **From the start of** and the text **Cycles before it keep their names and dates**.
  - **Notes:**

- [ ] **Step 2.** Choose **2027-02-01 (Sprint 3)**, change **Each cycle lasts** to `4`, and select **Change cycles**.
  - **Expected:** A second row, **From 2027-02-01**, then **Every 4 weeks, named Sprint {#}**, appears with a hollow yellow dot in its slot.
  - **Notes:**

- [ ] **Step 3.** Select the **⋯** button at the end of that row, then **Discard draft**.
  - **Expected:**
    - A notification says **Discarded the draft.**
    - The row is gone.
  - **Notes:**

### Part 3: Changing What Is Already There

#### REL-09: A Stream Is Renamed by a Draft

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as REL-08.

**Preconditions:** Signed in with this account. Run after REL-08. **Releases** page open from the left-hand menu, with **Testing Stream** selected in the table.

- [ ] **Step 1.** Select **Rename** at the top of the side panel.
  - **Expected:** A dialog titled **Rename Testing Stream** opens, with **Testing Stream** in the **Name** box.
  - **Notes:**

- [ ] **Step 2.** Replace the name with `Tested Stream` and select **Save**.
  - **Expected:** The side panel and the table both show a hollow yellow dot before **Tested Stream**.
  - **Notes:**

- [ ] **Step 3.** Select **Discard draft**.
  - **Expected:** The side panel and the table show **Testing Stream** again, with no dot.
  - **Notes:**

#### REL-10: A Stream Is Retired by a Draft

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as REL-09.

**Preconditions:** Signed in with this account. Run after REL-09. **Releases** page open, with **Testing Stream** selected in the table.

- [ ] **Step 1.** Select **Retire** at the top of the side panel.
  - **Expected:**
    - The side panel's heading shows a hollow yellow dot, **Testing Stream**, then the yellow **Retired** box.
    - The side panel's button now reads **Restore**.
    - In the table, **Testing Stream** stays where it was, with a hollow yellow dot in its slot and the yellow **Retired** box after its name.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button beside the close button at the top of the side panel, then **Discard draft**.
  - **Expected:**
    - A notification says **Discarded the draft.**
    - **Testing Stream** has no dot and no **Retired** box.
    - The button reads **Retire** again.
  - **Notes:**

#### REL-11: Approving a Retired Stream Stops New Releases in It

**Account:** Project Manager, `project.manager@fathom.test`, changed from REL-10.

**Preconditions:** Signed in with this account. Run after REL-10. **Releases** page open from the left-hand menu, with **Patches** selected in the table.

- [ ] **Step 1.** Select the **⋯** button beside the close button at the top of the side panel, then **Approve…**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 2.** Select **Approve**.
  - **Expected:**
    - A notification says **Approved 1 draft.**
    - In the table, **Patches** is now under a **Retired** heading, with no dot.
    - The side panel's heading shows **Patches**, then **Retired** in grey.
  - **Notes:**

- [ ] **Step 3.** Look under **Releases** in the side panel.
  - **Expected:**
    - Both patch releases are listed, such as **Patch November** and **Patch December**.
    - The later has a red dot in a ring before it.
    - There is no **New release…** button.
  - **Notes:**

#### REL-12: A Release Is Changed by a Draft

**Account:** Product Manager, `product.manager@fathom.test`, changed from REL-11.

**Preconditions:** Signed in with this account. Run after REL-11. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor 1** row, then **Change…**.
  - **Expected:** A dialog titled **Change Harbor 1** opens, with:
    - **Harbor 1** in **Name**
    - the cycle three quarters ago as the first cycle, such as **26.1 (2026-01-01 to 2026-03-31)**
    - the cycle two quarters ago as the last cycle, such as **26.2 (2026-04-01 to 2026-06-30)**
  - **Notes:**

- [ ] **Step 2.** Replace the name with `Harbor One` and select **Save**.
  - **Expected:** The row reads **Harbor One**, with a hollow yellow dot before its square.
  - **Notes:**

- [ ] **Step 3.** Run Publish.
  - **Expected:** The dot before **Harbor One** is now solid yellow.
  - **Notes:**

#### REL-13: A Rejected Draft Says Why It Was Rejected

**Account:** Project Manager, `project.manager@fathom.test`, changed from REL-12.

**Preconditions:** Signed in with this account. Run after REL-12. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor One** row, then **Reject…**.
  - **Expected:** A dialog titled **Reject 1 draft?** opens, with a **Reason** box.
  - **Notes:**

- [ ] **Step 2.** Type `Keep the old name` and select **Reject**.
  - **Expected:**
    - A notification says **Rejected 1 draft.**
    - The row shows a red dot in a ring before **Harbor One**'s square.
  - **Notes:**

#### REL-14: A Rejected Draft Can Be Resubmitted

**Account:** Product Manager, `product.manager@fathom.test`, changed from REL-13.

**Preconditions:** Signed in with this account. Run after REL-13. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor One** row.
  - **Expected:** Under **Harbor One**, the menu offers **Change…** and **Remove**, then shows:
    - A red dot in a ring and **Rejected**
    - **Reason: Keep the old name**
    - **Changed by Product Manager**
    - Then **Resubmit** and **Discard draft**
  - **Notes:**

- [ ] **Step 2.** Select **Resubmit**.
  - **Expected:**
    - A notification says **Resubmitted the draft.**
    - The row shows a yellow dot before **Harbor One**'s square again.
  - **Notes:**

#### REL-15: A Release Is Removed by a Draft

**Account:** Product Manager, `product.manager@fathom.test`, the same as REL-14.

**Preconditions:** Signed in with this account. Run after REL-14. **Testing Stream** selected in the table.

- [ ] **Step 1.** Under **Releases**, select the **⋯** button at the end of the **Testing Release** row, then **Remove**.
  - **Expected:**
    - The **Testing Release** row has a hollow yellow dot in its slot.
    - The row is struck through.
  - **Notes:**

- [ ] **Step 2.** Select **Discard draft**.
  - **Expected:**
    - A notification says **Discarded the draft.**
    - **Testing Release** is no longer struck through.
    - **Testing Release** has no dot.
  - **Notes:**

#### REL-16: A Stream's Cycles Are Made Until a Later Day

**Account:** Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`, changed from REL-15. Step 2 signs in as another account.

**Preconditions:** Signed in with this account. Run after REL-15. **Releases** page open from the left-hand menu.

- [ ] **Step 1.** Run Discard the Unpublished Changes.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 2.** Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** Fathom opens.
  - **Notes:**

- [ ] **Step 3.** Select the **Releases** page in the left-hand menu.
  - **Expected:** The streams table shows **Platform**, with no grey lock in its slot.
  - **Notes:**

- [ ] **Step 4.** Select **Platform** in the table.
  - **Expected:** The side panel opens, headed **Platform**, with no grey lock.
  - **Notes:**

- [ ] **Step 5.** Under **Cycle schedule**, select **Change…** below **Planned to**, followed by 31 December three years after this year, such as **Planned to 2029-12-31**, then **Planned to…**.
  - **Expected:**
    - A dialog titled **Change how far Platform is planned** opens, with that day in **Planned to**.
    - Below it, a line counts as many cycles in all as the **Cycles** heading counts, followed by **as now**, such as **11 cycles in all, as now**.
    - Under **Last cycles** are the last three half-year cycles, the last starting on or before that day, such as **28.2** with **2028-07-01 to 2028-12-31**, **29.1** with **2029-01-01 to 2029-06-30**, and **29.2** with **2029-07-01 to 2029-12-31**.
  - **Notes:**

- [ ] **Step 6.** Replace the day with the same day a year later, such as `20301231`, and select **Save**.
  - **Expected:**
    - The panel's heading shows a hollow yellow dot before **Platform**.
    - **Planned to** reads the new day, such as **Planned to 2030-12-31**.
    - The **Cycles** heading counts two more cycles, such as **Cycles (13)**.
    - Its last row is a half-year cycle starting in the new day's year, such as **30.2** from **2030-07-01**.
  - **Notes:**

- [ ] **Step 7.** Select the **⋯** button in the panel's heading, then **Discard draft**.
  - **Expected:** **Planned to** and the **Cycles** heading read as before Step 6.
  - **Notes:**

#### REL-17: A Release Ships on a Day of Its Own

**Account:** Product Manager, `product.manager@fathom.test`, changed from REL-16.

**Preconditions:** Signed in with this account. Run after REL-16. **Releases** page open from the left-hand menu, with **Testing Stream** selected in the table.

- [ ] **Step 1.** Under **Releases**, select the **⋯** button at the end of the **Testing Release** row, then **Change…**.
  - **Expected:** A dialog titled **Change Testing Release** opens, with an empty **Ships on** and, under it, **Leave empty to ship at the end of its last cycle, on 2027-01-31**.
  - **Notes:**

- [ ] **Step 2.** Type `20270303` in **Ships on**, and select **Save**.
  - **Expected:**
    - The **Testing Release** row has a hollow yellow dot before **Sprint 1 to Sprint 2 · ships 2027-03-03**, then, in bold, **31 days after Sprint 2 ends**.
    - The **Cycles** section is unchanged: **Sprint 3** still starts on **2027-02-01**.
  - **Notes:**

- [ ] **Step 3.** Select the **⋯** button at the end of the **Testing Release** row, then **Discard draft**.
  - **Expected:**
    - A notification says **Discarded the draft.**
    - The row reads as in Step 1, shipping on **2027-01-31**, with nothing after the date.
  - **Notes:**

### Part 4: The Timeline

#### REL-18: The Timeline Shows Every Current Stream

**Account:** Team Member, `team.member@fathom.test`, changed from REL-17.

**Preconditions:** Signed in with this account. Run after REL-17. **Releases** page open from the left-hand menu.

- [ ] **Step 1.** Run Restore the Seed Data.
  - **Expected:**
    - Restore the Seed Data finishes with no error.
    - After the page reloads, the streams table shows **Testing Stream**, **Platform** and **Patches**, none under **Retired**.
  - **Notes:**

- [ ] **Step 2.** Scroll below the streams table to the timeline, and select **Year**.
  - **Expected:**
    - **Year** is highlighted.
    - The timeline has three rows, named **Testing Stream**, **Platform** and **Patches**.
    - The axis's top row names years, such as **2027**, and its second row half years, such as **Jan to Jun 27** and **Jul to Dec 27**.
    - A red line, labelled **Today** in a row of its own above the axis, crosses every row, about a sixth of the way across the timeline.
  - **Notes:**

- [ ] **Step 3.** Read **Platform**'s two lanes.
  - **Expected:**
    - The cycles up to the first half are each a quarter long, and the first half and the cycles after it half a year long, each block as long as its dates on the axis.
    - In the lane below, **Harbor 3** spans next quarter's cycle to the first half, such as **27.1** to **27.3**, with a diamond at its right end.
  - **Notes:**

- [ ] **Step 4.** Hover over **Harbor 1**'s span, scrolling the timeline left to it if needed.
  - **Expected:** A tooltip names **Harbor 1**, its cycles and the day it ships, as its row in the side panel does, such as **Harbor 1: 26.1 to 26.2, ships 2026-06-30**.
  - **Notes:**

- [ ] **Step 5.** Read **Patches**' cycles lane.
  - **Expected:**
    - Each four-week cycle is a block as long as its dates on the axis, named inside only when its name fits.
    - Hovering over one shows its name and dates, such as **P24.3: 2026-11-02 to 2026-11-29**.
  - **Notes:**

#### REL-19: The Timeline Zooms In and Out

**Account:** Team Member, `team.member@fathom.test`, the same as REL-18.

**Preconditions:** Signed in with this account. Run after REL-18. **Releases** page open, scrolled to the timeline, at **Year**.

- [ ] **Step 1.** Select **All**.
  - **Expected:**
    - The whole timeline fits across, from the earliest cycle of any stream to the end of the last, such as 2026 to 2030, with no scrolling sideways.
    - The **−** button is greyed out.
  - **Notes:**

- [ ] **Step 2.** Select **Quarter**, then **Month**.
  - **Expected:**
    - At **Quarter**, the axis's top row names quarters, such as **Q1 2027**, and its second row months, such as **Jan**.
    - At **Month**, the top row names months, such as **Jan 2027**, and the second row each week by its Monday, such as **Nov 9**, or, where that does not fit, just the day of the month, such as **9**.
    - The red **Today** line stays where it was across the timeline at each zoom.
  - **Notes:**

- [ ] **Step 3.** Select **Year**.
  - **Expected:** **Year** is highlighted, as REL-18 left it.
  - **Notes:**

- [ ] **Step 4.** Reload the page and scroll to the timeline.
  - **Expected:** **Year** is still highlighted.
  - **Notes:**

#### REL-20: A Release's Own Ship Day Is Marked on the Timeline

**Account:** Product Manager, `product.manager@fathom.test`, changed from REL-19.

**Preconditions:** Signed in with this account. Run after REL-19. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor 1** row, then **Change…**.
  - **Expected:** A dialog titled **Change Harbor 1** opens.
  - **Notes:**

- [ ] **Step 2.** Type the day 31 days after the cycle two quarters ago ends, such as `20260731`, in **Ships on**, and select **Save**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] **Step 3.** Close the side panel.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] **Step 4.** Scroll to the timeline, and select **6 months**.
  - **Expected:** **6 months** is highlighted.
  - **Notes:**

- [ ] **Step 5.** Find **Harbor 1** in **Platform**'s releases lane, scrolling the timeline left to it.
  - **Expected:**
    - **Harbor 1**'s span, across the cycles three and two quarters ago, such as **26.1** and **26.2**, has a dashed edge.
    - A dashed line runs on from its right end, past the start of the next release, to a diamond about a month later, on the day typed.
  - **Notes:**

- [ ] **Step 6.** Select **Platform** in the table.
  - **Expected:** The side panel opens, headed **Platform**.
  - **Notes:**

- [ ] **Step 7.** In the side panel, select the **⋯** button at the end of the **Harbor 1** row, then **Discard draft**.
  - **Expected:**
    - A notification says **Discarded the draft.**
    - On the timeline, **Harbor 1**'s span has a solid edge, with its diamond at its right end and no dashed line.
  - **Notes:**

#### REL-21: A Release's Colour Is Chosen in Its Dialog

**Account:** Product Manager, `product.manager@fathom.test`, the same as REL-20. Step 7 signs in as another account.

**Preconditions:** Signed in with this account. Run after REL-20. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Close the side panel.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] **Step 2.** Scroll to the timeline, and select **Year**.
  - **Expected:** **Year** is highlighted.
  - **Notes:**

- [ ] **Step 3.** Find **Platform**'s releases lane, scrolling the timeline left if **Harbor 1** is not wholly in view.
  - **Expected:**
    - **Harbor 1** and **Harbor 3** are blue, and **Harbor 2 LTS** is teal.
    - Each diamond is the colour of its span.
    - Each name is in the page's usual text colour.
  - **Notes:**

- [ ] **Step 4.** Select **Platform** in the table, then, in the side panel, the **⋯** button at the end of the **Harbor 1** row, then **Change…**.
  - **Expected:**
    - A dialog titled **Change Harbor 1** opens.
    - Its last field, **Colour**, reads **Sea (default)**, with a blue square before it and **How the release is drawn on the timeline** under its label.
  - **Notes:**

- [ ] **Step 5.** Open **Colour**.
  - **Expected:** The list offers **Sea (default)**, then **Indigo**, **Violet**, **Grape**, **Pink**, **Red**, **Orange**, **Yellow**, **Lime**, **Green** and **Teal**, each with a square of its colour.
  - **Notes:**

- [ ] **Step 6.** Select **Teal**, then **Save**.
  - **Expected:**
    - The **Harbor 1** row has a hollow yellow dot before its square, which is teal.
    - On the timeline, **Harbor 1**'s span is teal, with a dashed edge.
  - **Notes:**

- [ ] **Step 7.** Run Publish, then sign in as the Project Manager, `project.manager@fathom.test`, and open the **Drafts** page from the left-hand menu.
  - **Expected:** The draft of **the release Harbor 1 in Platform** lists **Colour from Sea to Teal**.
  - **Notes:**

- [ ] **Step 8.** Approve the draft, then open the **Releases** page from the left-hand menu.
  - **Expected:** **Harbor 1**'s span on the timeline is teal, with a solid edge.
  - **Notes:**

### Part 5: Changing One Cycle's Length

#### REL-22: A Cycle's New Length Moves the Cycles and Releases After It

**Account:** Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`, changed from REL-21. Step 2 signs in as another account, and step 8 as the Workforce Administrator.

**Preconditions:** Run after REL-21. Run Restore the Seed Data. Signed in with this account.

- [ ] **Step 1.** Run Discard the Unpublished Changes.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] **Step 2.** Sign in as the Product Manager, `product.manager@fathom.test`.
  - **Expected:** Fathom opens.
  - **Notes:**

- [ ] **Step 3.** Select the **Releases** page in the left-hand menu.
  - **Expected:** The streams table shows **Platform**, with no grey lock in its slot.
  - **Notes:**

- [ ] **Step 4.** Select **Platform** in the table.
  - **Expected:** The side panel opens, headed **Platform**.
  - **Notes:**

- [ ] **Step 5.** Under **Releases**, select the **⋯** button at the end of the **Harbor 2 LTS** row, then **Discard draft**.
  - **Expected:** The row reads **Harbor 2**, with no dot.
  - **Notes:**

- [ ] **Step 6.** Select the **⋯** button at the end of the **Harbor 3** row, then **Discard draft**.
  - **Expected:**
    - **Harbor 3** has no dot.
    - **Harbor 3** has no **Moved** box.
  - **Notes:**

- [ ] **Step 7.** Select the **⋯** button at the end of the **Harbor 4** row, then **Discard draft**.
  - **Expected:** **Harbor 4** is gone.
  - **Notes:**

- [ ] **Step 8.** Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** Fathom opens.
  - **Notes:**

- [ ] **Step 9.** Select the **Releases** page in the left-hand menu.
  - **Expected:** The streams table shows **Platform**, with no dot and no grey lock in its slot.
  - **Notes:**

- [ ] **Step 10.** Select **Platform** in the table.
  - **Expected:** The side panel opens, headed **Platform**.
  - **Notes:**

- [ ] **Step 11.** In the side panel's **Cycles** table, select the **⋯** button at the end of next quarter's cycle, such as **27.1**, then **Change length…**.
  - **Expected:**
    - A dialog titled **Change the length of** that cycle opens.
    - **Length** reads **3**, followed by **months**, with the cycle's dates under its label.
    - Under **Later cycles**, **Move with it** is selected, and **Keep their dates** is offered.
    - **New dates** lists that cycle, the next one and the first half, with their dates as now, such as **27.1**, **2027-01-01 to 2027-03-31**; **27.2**, **2027-04-01 to 2027-06-30**; and **27.3**, **2027-07-01 to 2027-12-31**.
  - **Notes:**

- [ ] **Step 12.** Replace **3** in **Length** with `2`.
  - **Expected:**
    - The red line is gone.
    - **New dates** lists the cycle two months long, then the next a quarter and the first half half a year, each starting a month earlier than before, such as **27.1**, **2027-01-01 to 2027-02-28**; **27.2**, **2027-03-01 to 2027-05-31**; and **27.3**, **2027-06-01 to 2027-11-30**.
    - Below it, the dialog says that **Harbor 3**, **Data Retention Controls** and **Report Builder** move with their cycles, and **Harbor 3 ships** on the first half's new last day, such as **Harbor 3 ships 2027-11-30.**
  - **Notes:**

- [ ] **Step 13.** Select **Change length**.
  - **Expected:**
    - Under **Cycle schedule**, a row **From** the changed cycle's first day, **Every 2 months, named {YY}.{N}**, and a row **From** the next cycle's new first day, **Every 3 months, named {YY}.{N}**, each have a hollow yellow dot in their slot.
    - The first half's row, now **From** a month earlier, **Every 6 months, named {YY}.{N}**, has a hollow yellow dot before its new day, such as **From 2027-01-01**, **From 2027-03-01** and **From 2027-06-01**.
    - The **Harbor 3** row has a hollow yellow dot before its cycles, and ships on the first half's new last day, such as **27.1 to 27.3 · ships 2027-11-30**.
    - In the **Cycles** table, the first half runs on its new dates, such as **27.3** from **2027-06-01** to **2027-11-30**.
  - **Notes:**

- [ ] **Step 14.** Run Publish.
  - **Expected:** The dots on the three rows of the cycle schedule and on **Harbor 3** are solid yellow.
  - **Notes:**

#### REL-23: Approving One Draft of a New Length Approves Them All

**Account:** Project Manager, `project.manager@fathom.test`, changed from REL-22.

**Preconditions:** Signed in with this account. Run after REL-22. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Under **Releases**, select the **⋯** button at the end of the **Harbor 3** row, then **Approve…**.
  - **Expected:** A dialog titled **Approve 6 drafts?** says **Also approves the drafts these depend on:**, listing **the cycles of Platform from** each of the three days in REL-22 Step 13, such as **the cycles of Platform from 2027-01-01**, **the cycles of Platform from 2027-03-01** and **the cycles of Platform from 2027-06-01**, with **the feature Data Retention Controls** and **the feature Report Builder**.
  - **Notes:**

- [ ] **Step 2.** Select **Approve**.
  - **Expected:**
    - A notification says **Approved 6 drafts.**
    - No row under **Cycle schedule** or **Releases** has a dot.
    - **Harbor 3** still reads as in REL-22 Step 13.
  - **Notes:**

#### REL-24: Later Cycles Can Keep Their Dates

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from REL-23.

**Preconditions:** Run after REL-23. Signed in with this account. **Releases** page open from the left-hand menu, with **Patches** selected in the table.

- [ ] **Step 1.** In the **Cycles** table, select the **⋯** button at the end of the later patch release's last cycle, the fourth cycle, such as **P24.4**, then **Change length…**. Replace **4** in **Length** with `2`, and select **Keep their dates**.
  - **Expected:**
    - **Length** is followed by **weeks**.
    - **New dates** lists that cycle two weeks long, then a cycle from the next day to the end of the cycle after it, six weeks long, then the cycle after that as now, such as **P24.4**, **2026-11-30 to 2026-12-13**; **P25.1**, **2026-12-14 to 2027-01-24**; and **P25.2**, **2027-01-25 to 2027-02-21**.
    - Below it, the dialog says the later patch release ships on that cycle's new last day, such as **Patch December ships 2026-12-13.**
  - **Notes:**

- [ ] **Step 2.** Select **Change length**, then run Publish.
  - **Expected:**
    - Under **Cycle schedule**, a row **From** each of the three cycles' first days, such as **From 2026-11-30**, **From 2026-12-14** and **From 2027-01-25**, has a yellow dot in its slot.
    - The later patch release keeps only the red dot in a ring before its name, and ships on the changed cycle's new last day, since it has no Ships on day of its own, such as **Patch December**, **P24.3 to P24.4 · ships 2026-12-13**.
  - **Notes:**

#### REL-25: Discarding One Draft of a New Length Discards Them All

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as REL-24.

**Preconditions:** Signed in with this account. Run after REL-24. **Releases** page open from the left-hand menu, with **Patches** selected in the table.

- [ ] **Step 1.** Select the **⋯** button at the end of the second of the three rows REL-24 added, such as **From 2026-12-14**, then **Discard draft**, and run Publish.
  - **Expected:**
    - A notification says **Discarded the draft.**
    - The cycle schedule has only its first row, and the fourth cycle is four weeks long again, such as **P24.4** from **2026-11-30** to **2026-12-27**.
  - **Notes:**

### Part 6: Release Notes

#### REL-26: A Release's Note Is Read and Written Beside Its Stream

**Account:** Product Manager, `product.manager@fathom.test`, changed from REL-25.

**Preconditions:** Signed in with this account. Run after REL-25. **Light** chosen in the Appearance menu. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Select **Harbor 2**'s underlined name.
  - **Expected:** A panel titled **Harbor 2** opens above the stream's panel, showing the note as it reads:
    - two headings
    - a bullet list with **every** in bold
    - a checklist with its first box ticked
    - red text
    - a link
  - **Notes:**

- [ ] **Step 2.** Choose **Dark** in the Appearance menu.
  - **Expected:** Both panels read well in dark mode.
  - **Notes:**

- [ ] **Step 3.** Choose **Light** in the Appearance menu.
  - **Expected:** Both panels return to their light colours.
  - **Notes:**

- [ ] **Step 4.** Select **Editor**, type a few words at the end, and select **Save**.
  - **Expected:**
    - The note's panel closes.
    - The **Harbor 2** row has a hollow yellow dot in its slot.
  - **Notes:**
