---
title: "Manual Test: Release Streams, Cycles and Releases"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/product/decisions.md"]
last_updated: "2026-11-07"
---

# Manual Test: Release Streams, Cycles and Releases

## Scope

Verifies the Releases page: how release streams, their cycles and their releases are shown, in the table, the side panel and the timeline, what a Workforce Administrator, a Product Manager and a Project Manager can do with them, including changing one cycle's length and writing a release's note, and how their drafts are published, approved, rejected, resubmitted and discarded.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place and the [Fictional Seed Data](../design/development-setup.md#fictional-seed-data) added.
- Roles as Fathom starts them: no change made to what any role grants in this clone's database. [R2](#r2-start-from-an-empty-database) puts them back.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom ([R0](#r0-start-fathom)), the second the data commands ([R1](#r1-restore-the-seed-data) and [R2](#r2-start-from-an-empty-database)).

## Test Accounts

[R2](#r2-start-from-an-empty-database) creates these accounts, with every other development account, and prints the one password they share. Fathom shows each account by the name in bold, in the top right corner once signed in. Product Manager and Project Manager are different accounts.

- **Engineering Operations Manager:** `engineering.operations.manager@fathom.test`, holding the Workforce Administrator role. It adds, renames and retires release streams and changes their cycles; its changes are drafts. It cannot make releases or approve drafts.
- **Product Manager:** `product.manager@fathom.test`, holding the Product Manager role. It makes and changes releases; its changes are drafts. It cannot change release streams or approve drafts of releases.
- **Project Manager:** `project.manager@fathom.test`, holding the Project Manager role, which changes the plan and approves drafts. In this test it approves and rejects drafts.
- **Team Member:** `team.member@fathom.test`, holding the Team Member role. It sees release streams, cycles and releases, and cannot change them.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at the address `pnpm dev` prints, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R1: Restore the Seed Data

Use wherever a test case says so. Fathom keeps running. This removes the seed data and every draft of it, including drafts made during the test, then adds the seed data again; it keeps accounts and anything else added by hand, such as a release stream added during the test.

1. In the second terminal, run:

   ```sh
   pnpm db:unseed && pnpm db:seed
   ```

2. Confirm that the last line printed gives the shared password, with no error above it.
3. Reload the browser page.

### R2: Start From an Empty Database

Use only where a test case says so. This deletes every account and record in the development database, including anything added by hand, and adds back only the development accounts, with no other data. Ask the owner before running it on a database others use.

1. Stop Fathom: press Ctrl+C in the first terminal.
2. In the second terminal, run:

   ```sh
   pnpm db:reset && pnpm db:seed:accounts
   ```

3. Confirm that the last line printed gives the shared password, with no error above it.
4. Start Fathom again ([R0](#r0-start-fathom)).

### P1: Sign In

1. If someone is signed in, sign out first ([P2](#p2-sign-out)).
2. On the **Sign in** page, enter the account's email address and the shared password.
3. Select **Sign in**.

### P2: Sign Out

1. Select the account button at the top right, which shows the account's name.
2. Select **Sign out**.

### P3: Publish

1. Select the **Publish** button in the top bar, followed by the number of changes waiting, such as **Publish 4 changes**.
2. Confirm that a notification says **Published**, and that the button is gone.

## Terms

- **Appearance menu:** the choices **System**, **Light** and **Dark** under **Appearance**, in the menu that opens from your name and initials at the top right of every page.
- **Seeded dates:** the seed data is dated from the day it is added, as the [Fictional Seed Data](../design/development-setup.md#fictional-seed-data) sets out, so its cycles and releases move with today, and the steps name them by where they fall. **This quarter** is the quarter today is in, and **the first half** is Platform's first half-year cycle, three quarters after this quarter. A cycle's name is the year it ends in and its number in that year, such as **26.4** or **P26.3**. The examples after "such as" are as the seed data is when added on 7 November 2026.
- **Mark:** a coloured dot followed by a word, such as a yellow dot and **Draft**, shown after a record's name. A hollow dot means the change is still unpublished.
- **Streams table:** the table on the Releases page, with a row for each release stream and the columns **Stream**, **Cycle schedule** and **Releases**. Selecting a row opens the stream in the side panel.
- **Side panel:** the panel beside the streams table for the selected stream, which the table narrows to make room for, headed with its name, with the sections **Cycle schedule**, **Releases** and **Cycles**. Its close button, an **×**, is at its top right, and dragging its left edge resizes it.
- **Timeline:** the section headed **Timeline** below the streams table, with **Today**, **−** and **+** buttons and the zoom buttons **All**, **Year**, **6 months**, **Quarter**, **Month**, **Week** and **Days** at its top right. It has a row for each stream that is not retired, named on the left, with a lane of the stream's cycles above a lane of its releases, under an axis of two rows of dates. Hovering over a cycle or a release shows its name and dates.
- **⋯ menu:** the menu that opens from a **⋯** button: beside the side panel's close button for the stream itself, when it has a draft, at the end of a row in the side panel for that change of cycles or release, or at the end of a row of the **Cycles** table for that cycle.

## Test Cases

Run the test cases in order. Start with [R0](#r0-start-fathom), then [R2](#r2-start-from-an-empty-database). Part 1 starts from an empty database; REL-06 adds the seed data for Part 2; Part 3 changes what Parts 1 and 2 left; REL-18 restores the seed data for Part 4, and REL-22 restores it again for Part 5, which Part 6 follows. Check each step whose expected result you see, and write anything else under its notes. To run the test again, start again from [R2](#r2-start-from-an-empty-database).

### Part 1: From an Empty Database

#### REL-01: An Organization Starts With No Release Streams

**Preconditions:** [R2](#r2-start-from-an-empty-database) run, then signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**.

- [ ] **Step 1.** In the left-hand menu, under **Plan**, select **Releases**.
  - **Expected:** The **Releases** page opens with no table. It reads **No release streams yet.**, and a **New release stream** button is at the top right.
  - **Notes:**

#### REL-02: The Engineering Operations Manager Drafts a New Release Stream

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. Run after REL-01. **Releases** page open.

- [ ] **Step 1.** Select **New release stream** at the top right of the page.
  - **Expected:** A dialog titled **New release stream** opens, with a **Name** box.
  - **Notes:**

- [ ] **Step 2.** Type `Testing Stream` and select **Add stream**.
  - **Expected:** The dialog closes, and a notification says **Drafted the new release stream.** The streams table shows one row, **Testing Stream**, with a hollow yellow dot and **Draft: added**. The side panel opens on the right, headed **Testing Stream** with the same mark, with **No cycles yet.** under **Cycle schedule** and **No releases yet.** under **Releases**.
  - **Notes:**

#### REL-03: A New Stream's Cycles Show Their Names Before They Are Saved

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. Run after REL-02. **Testing Stream** open in the side panel.

- [ ] **Step 1.** In the side panel, select **Set up cycles…** under **Cycle schedule**.
  - **Expected:** A dialog titled **Set up cycles for Testing Stream** opens, with an empty **First cycle starts** box showing **2027-01-01** in grey, **Each cycle lasts** set to **3**, **Months** selected, and **Names** set to **{YY}.{N}**.
  - **Notes:**

- [ ] **Step 2.** Type `20270104` in **First cycle starts**, change **Each cycle lasts** to `2`, and select **Weeks**.
  - **Expected:** The box shows **2027-01-04**. Below **Names**, under **First cycles**, three lines: **27.1** with **2027-01-04 to 2027-01-17**, **27.2** with **2027-01-18 to 2027-01-31**, and **27.3** with **2027-02-01 to 2027-02-14**.
  - **Notes:**

- [ ] **Step 3.** Replace **Names** with `Sprint {#}`.
  - **Expected:** The three lines under **First cycles** now start with **Sprint 1**, **Sprint 2** and **Sprint 3**.
  - **Notes:**

- [ ] **Step 4.** Select **Set up cycles**.
  - **Expected:** The dialog closes, and a notification says **Drafted the cycles.** Under **Cycle schedule**, a row reads **From 2027-01-04**, then **Every 2 weeks, named Sprint {#}** with a hollow yellow dot and **Draft: added**, and below it **Planned to** and a day two years after today, with a **Change…** button under it. Below **Releases**, a **Cycles** section, its count in brackets, lists the cycles from **Sprint 1** on. In the table, the **Cycle schedule** column of **Testing Stream** reads **Every 2 weeks, named Sprint {#}**.
  - **Notes:**

- [ ] **Step 5.** Publish ([P3](#p3-publish)).
  - **Expected:** The marks after **Testing Stream** and after its cycles' row are now solid yellow dots with **Draft: added**.
  - **Notes:**

#### REL-04: The Product Manager Makes a Release From a Stream's Cycles

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `product.manager@fathom.test`, shown as **Product Manager**. Run after REL-03. **Releases** page open from the left-hand menu.

- [ ] **Step 1.** Select **Testing Stream** in the table, then **New release…** under **Releases** in the side panel.
  - **Expected:** A dialog titled **New release in Testing Stream** opens, with **Name**, **First cycle**, **Last cycle** and an empty **Ships on**.
  - **Notes:**

- [ ] **Step 2.** Type `Testing Release` in **Name**, choose **Sprint 1 (2027-01-04 to 2027-01-17)** as the first cycle and **Sprint 2 (2027-01-18 to 2027-01-31)** as the last.
  - **Expected:** Under **Ships on**, the dialog reads **Leave empty to ship at the end of its last cycle, on 2027-01-31**.
  - **Notes:**

- [ ] **Step 3.** Select **Make release**.
  - **Expected:** A notification says **Drafted the new release.** Under **Releases** in the side panel, a row reads **Testing Release** with a hollow yellow dot and **Draft: added**, then **Sprint 1 to Sprint 2 · ships 2027-01-31**. In the table, the **Releases** column of **Testing Stream** reads **(1) Testing Release**.
  - **Notes:**

- [ ] **Step 4.** Publish ([P3](#p3-publish)).
  - **Expected:** The mark after **Testing Release** is now a solid yellow dot with **Draft: added**.
  - **Notes:**

#### REL-05: Approving a Release Approves the Stream and Cycles It Depends On

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `project.manager@fathom.test`, shown as **Project Manager**. Run after REL-04. **Testing Stream** open in the side panel.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Testing Release** row, then **Approve…**.
  - **Expected:** A dialog titled **Approve 3 drafts?** says **Also approves the drafts these depend on:**, listing **the release stream Testing Stream** and **the cycles of Testing Stream from 2027-01-04**.
  - **Notes:**

- [ ] **Step 2.** Select **Approve**.
  - **Expected:** A notification says **Approved 3 drafts.** **Testing Stream**, its cycles' row and **Testing Release** no longer have marks, in the table or the side panel.
  - **Notes:**

### Part 2: With the Seed Data

#### REL-06: The Seed Data Adds Two Release Streams

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `team.member@fathom.test`, shown as **Team Member**. Run after REL-05. **Releases** page open from the left-hand menu.

- [ ] **Step 1.** Run [R1](#r1-restore-the-seed-data).
  - **Expected:** [R1](#r1-restore-the-seed-data) finishes with no error. After the page reloads, the table shows **Testing Stream**, **Platform** and **Patches**, in that order, with no marks, and there is no **New release stream** button.
  - **Notes:**

- [ ] **Step 2.** Read the rows under **Releases** in the side panel.
  - **Expected:** **Harbor 1**, from the cycle three quarters ago to the one two quarters ago, shipping on the last day of the second, such as **26.1 to 26.2 · ships 2026-06-30**; **Harbor 2**, from last quarter's cycle to this quarter's, shipping on the last day of this quarter, such as **26.3 to 26.4 · ships 2026-12-31**; **Harbor 3**, from next quarter's cycle to the first half, shipping on its last day, such as **27.1 to 27.3 · ships 2027-12-31** (see [Seeded dates](#terms)). A small square before each name is blue for **Harbor 1** and **Harbor 3**, and purple for **Harbor 2**. **Harbor 2**'s name is underlined, and the others' are not. No row has a **⋯** button, and there is no **New release…** button.
  - **Notes:**

#### REL-07: Cycles Show the Months They Span

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `team.member@fathom.test`, shown as **Team Member**. Run after REL-06. **Releases** page open.

- [ ] **Step 1.** Select **Patches** in the table, then scroll the side panel down to **Cycles**.
  - **Expected:** A table with the columns **Name**, **Starts**, **Ends**, **Release**, **Months**.
  - **Notes:**

- [ ] **Step 2.** Read the first row, each column in order.
  - **Expected:** The first cycle's name, then the Monday eight weeks before this week's Monday, then the Sunday four weeks later, nothing under **Release**, and the share of each month it spans, such as **P26.1**, **2026-09-07**, **2026-10-04**, **Sep 2026 80%, Oct 13%**.
  - **Notes:**

#### REL-08: Cycles Change Only From the Start of a Cycle

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. Run after REL-07. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** In the side panel, select **Change…** under **Cycle schedule**, then **Length or names from a date…**.
  - **Expected:** The menu offers **Planned to…** and **Length or names from a date…**. A dialog titled **Change the length or names of Platform's cycles** opens, with **From the start of** and the text **Cycles before it keep their names and dates**.
  - **Notes:**

- [ ] **Step 2.** Choose the half-year cycle after the first half, such as **2028-01-01 (28.1)**, change **Each cycle lasts** to `12`, and select **Change cycles**.
  - **Expected:** A third row, **From** that cycle's first day, then **Every 12 months, named {YY}.{N}**, such as **From 2028-01-01**, appears with a hollow yellow dot and **Draft: added**.
  - **Notes:**

- [ ] **Step 3.** Select the **⋯** button at the end of that row, then **Discard draft**.
  - **Expected:** A notification says **Discarded the draft.**, and the row is gone.
  - **Notes:**

### Part 3: Changing What Is Already There

#### REL-09: A Stream Is Renamed by a Draft

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. Run after REL-08. **Releases** page open from the left-hand menu, with **Testing Stream** selected in the table.

- [ ] **Step 1.** Select **Rename** at the top of the side panel.
  - **Expected:** A dialog titled **Rename Testing Stream** opens, with **Testing Stream** in the **Name** box.
  - **Notes:**

- [ ] **Step 2.** Replace the name with `Tested Stream` and select **Save**.
  - **Expected:** A notification says **Drafted the new name.** The side panel and the table both show **Tested Stream**, with a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 3.** Select **Discard draft**.
  - **Expected:** A notification says **Discarded the draft.** The side panel and the table show **Testing Stream** again, with no mark.
  - **Notes:**

#### REL-10: A Stream Is Retired by a Draft

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. Run after REL-09. **Releases** page open, with **Patches** selected in the table.

- [ ] **Step 1.** Select **Retire** at the top of the side panel.
  - **Expected:** A notification says **Drafted retiring Patches.** The side panel shows **Retired** in grey, then a hollow yellow dot and **Draft: retired**, and its button now reads **Restore**. In the table, **Patches** is under a **Retired** heading, with the same yellow mark.
  - **Notes:**

- [ ] **Step 2.** Publish ([P3](#p3-publish)).
  - **Expected:** The yellow mark is now a solid dot with **Draft: retired**.
  - **Notes:**

#### REL-11: Approving a Retired Stream Stops New Releases in It

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `project.manager@fathom.test`, shown as **Project Manager**. Run after REL-10. **Releases** page open from the left-hand menu, with **Patches** selected in the table.

- [ ] **Step 1.** Select the **⋯** button beside the close button at the top of the side panel, then **Approve…**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 2.** Select **Approve**.
  - **Expected:** A notification says **Approved 1 draft.** **Patches** stays under **Retired** in the table, with no yellow mark, and the side panel shows only **Retired** in grey.
  - **Notes:**

- [ ] **Step 3.** Look under **Releases** in the side panel.
  - **Expected:** Both patch releases are listed, such as **Patch November** and **Patch December**, and there is no **New release…** button.
  - **Notes:**

#### REL-12: A Release Is Changed by a Draft

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `product.manager@fathom.test`, shown as **Product Manager**. Run after REL-11. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor 3** row, then **Change…**.
  - **Expected:** A dialog titled **Change Harbor 3** opens, with **Harbor 3** in **Name**, next quarter's cycle as the first cycle, and the first half as the last, such as **27.1 (2027-01-01 to 2027-03-31)** and **27.3 (2027-07-01 to 2027-12-31)**.
  - **Notes:**

- [ ] **Step 2.** Replace the name with `Harbor Three` and select **Save**.
  - **Expected:** A notification says **Drafted the change to the release.** The row reads **Harbor Three**, with a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 3.** Publish ([P3](#p3-publish)).
  - **Expected:** The mark after **Harbor Three** is now a solid yellow dot with **Draft**.
  - **Notes:**

#### REL-13: A Rejected Draft Says Why It Was Rejected

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `project.manager@fathom.test`, shown as **Project Manager**. Run after REL-12. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor Three** row, then **Reject…**.
  - **Expected:** A dialog titled **Reject 1 draft?** opens, with a **Reason** box.
  - **Notes:**

- [ ] **Step 2.** Type `Keep the old name` and select **Reject**.
  - **Expected:** A notification says **Rejected 1 draft.** The row shows a red dot and **Rejected**.
  - **Notes:**

#### REL-14: A Rejected Draft Can Be Resubmitted

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `product.manager@fathom.test`, shown as **Product Manager**. Run after REL-13. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor Three** row.
  - **Expected:** Under **Harbor Three**, the menu offers **Change…** and **Remove**, then shows a red dot and **Rejected**, **Reason: Keep the old name** and **Changed by Product Manager**, then offers **Resubmit** and **Discard draft**.
  - **Notes:**

- [ ] **Step 2.** Select **Resubmit**.
  - **Expected:** A notification says **Resubmitted the draft.** The row shows a yellow dot and **Draft** again.
  - **Notes:**

#### REL-15: A Release Is Removed by a Draft

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `product.manager@fathom.test`, shown as **Product Manager**. Run after REL-14. **Platform** open in the side panel.

- [ ] **Step 1.** Under **Releases**, select the **⋯** button at the end of the **Harbor 1** row, then **Remove**.
  - **Expected:** A notification says **Drafted removing Harbor 1.** The **Harbor 1** row is struck through, with a hollow yellow dot and **Draft: removed**.
  - **Notes:**

- [ ] **Step 2.** Select **Discard draft**.
  - **Expected:** A notification says **Discarded the draft.** **Harbor 1** is no longer struck through and has no mark.
  - **Notes:**

#### REL-16: A Stream's Cycles Are Made Until a Later Day

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. Run after REL-15. **Platform** open in the side panel.

- [ ] **Step 1.** Under **Cycle schedule**, select **Change…** below **Planned to**, followed by 31 December three years after this year, such as **Planned to 2029-12-31**, then **Planned to…**.
  - **Expected:** A dialog titled **Change how far Platform is planned** opens, with that day in **Planned to**. Below it, as many cycles in all as the **Cycles** heading counts, followed by **as now**, such as **11 cycles in all, as now**, then **Last cycles**: the last three half-year cycles, the last starting on or before that day, such as **28.2** with **2028-07-01 to 2028-12-31**, **29.1** with **2029-01-01 to 2029-06-30**, and **29.2** with **2029-07-01 to 2029-12-31**.
  - **Notes:**

- [ ] **Step 2.** Replace the day with the same day a year later, such as `20301231`, and select **Save**.
  - **Expected:** A notification says **Drafted the change to the cycles.** The panel's heading shows a hollow yellow dot and **Draft**, **Planned to** the new day, and the **Cycles** heading counts two more cycles, its last row a half-year cycle starting in the new day's year, such as **Planned to 2030-12-31**, **Cycles (13)** and **30.2** from **2030-07-01**.
  - **Notes:**

- [ ] **Step 3.** Select the **⋯** button in the panel's heading, then **Discard draft**.
  - **Expected:** A notification says **Discarded the draft.** **Planned to** and the **Cycles** heading read as before Step 2.
  - **Notes:**

#### REL-17: A Release Ships on a Day of Its Own

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `product.manager@fathom.test`, shown as **Product Manager**. Run after REL-16. **Platform** open in the side panel.

- [ ] **Step 1.** Under **Releases**, select the **⋯** button at the end of the **Harbor 2** row, then **Change…**.
  - **Expected:** A dialog titled **Change Harbor 2** opens, with an empty **Ships on** and, under it, **Leave empty to ship at the end of its last cycle, on** the last day of this quarter, such as **2026-12-31**.
  - **Notes:**

- [ ] **Step 2.** Type the day 31 days after this quarter ends, such as `20270131`, in **Ships on**, and select **Save**.
  - **Expected:** A notification says **Drafted the change to the release.** The **Harbor 2** row has a hollow yellow dot and **Draft**, and reads its cycles and that day, then, in bold, **31 days after** this quarter's cycle **ends**, such as **26.3 to 26.4 · ships 2027-01-31** and **31 days after 26.4 ends**. The **Cycles** section is unchanged: next quarter's cycle still starts the day after this quarter ends.
  - **Notes:**

- [ ] **Step 3.** Select the **⋯** button at the end of the **Harbor 2** row, then **Discard draft**.
  - **Expected:** A notification says **Discarded the draft.** The row reads as in Step 1, shipping on the last day of this quarter, with nothing after the date.
  - **Notes:**

### Part 4: The Timeline

#### REL-18: The Timeline Shows Every Current Stream

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `team.member@fathom.test`, shown as **Team Member**. Run after REL-17. **Releases** page open from the left-hand menu.

- [ ] **Step 1.** Run [R1](#r1-restore-the-seed-data).
  - **Expected:** [R1](#r1-restore-the-seed-data) finishes with no error. After the page reloads, the streams table shows **Testing Stream**, **Platform** and **Patches**, none under **Retired**.
  - **Notes:**

- [ ] **Step 2.** Scroll below the streams table to the timeline, and select **Year**.
  - **Expected:** **Year** is highlighted. The timeline has three rows, named **Testing Stream**, **Platform** and **Patches**. The axis's top row names years, such as **2027**, and its second row half years, such as **Jan to Jun 27** and **Jul to Dec 27**. A red line, labelled **Today** in a row of its own above the axis, crosses every row, about a sixth of the way across the timeline.
  - **Notes:**

- [ ] **Step 3.** Read **Platform**'s two lanes.
  - **Expected:** The cycles up to the first half are each a quarter long, and the first half and the cycles after it half a year long, each block as long as its dates on the axis. In the lane below, **Harbor 3** spans next quarter's cycle to the first half, such as **27.1** to **27.3**, with a diamond at its right end.
  - **Notes:**

- [ ] **Step 4.** Hover over **Harbor 1**'s span, scrolling the timeline left to it if needed.
  - **Expected:** A tooltip names **Harbor 1**, its cycles and the day it ships, as its row in the side panel does, such as **Harbor 1: 26.1 to 26.2, ships 2026-06-30**.
  - **Notes:**

- [ ] **Step 5.** Read **Patches**' cycles lane.
  - **Expected:** Each four-week cycle is a block as long as its dates on the axis, named inside only when its name fits. Hovering over one shows its name and dates, such as **P26.3: 2026-11-02 to 2026-11-29**.
  - **Notes:**

#### REL-19: The Timeline Zooms In and Out

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `team.member@fathom.test`, shown as **Team Member**. Run after REL-18. **Releases** page open, scrolled to the timeline, at **Year**.

- [ ] **Step 1.** Select **All**.
  - **Expected:** The whole timeline fits across, from the earliest cycle of any stream to the end of the last, such as 2026 to 2030, with no scrolling sideways, and the **−** button is greyed out.
  - **Notes:**

- [ ] **Step 2.** Select **Quarter**, then **Month**.
  - **Expected:** At **Quarter**, the axis's top row names quarters, such as **Q1 2027**, and its second row months, such as **Jan**. At **Month**, the top row names months, such as **Jan 2027**, and the second row each week by its Monday, such as **Nov 9**, or, where that does not fit, just the day of the month, such as **9**. The red **Today** line stays where it was across the timeline at each zoom.
  - **Notes:**

- [ ] **Step 3.** Select **Year**.
  - **Expected:** **Year** is highlighted, as REL-18 left it.
  - **Notes:**

- [ ] **Step 4.** Reload the page and scroll to the timeline.
  - **Expected:** **Year** is still highlighted.
  - **Notes:**

#### REL-20: A Release's Own Ship Day Is Marked on the Timeline

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `product.manager@fathom.test`, shown as **Product Manager**. Run after REL-19. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor 2** row, then **Change…**. Type the day 31 days after this quarter ends, such as `20270131`, in **Ships on**, and select **Save**.
  - **Expected:** A notification says **Drafted the change to the release.**
  - **Notes:**

- [ ] **Step 2.** Close the side panel, scroll to the timeline, select **6 months**, and find **Harbor 2** in **Platform**'s releases lane.
  - **Expected:** **Harbor 2**'s span, across last quarter's and this quarter's cycles, such as **26.3** and **26.4**, has a dashed edge. A dashed line runs on from its right end, past the start of **Harbor 3**, to a diamond about a month later, on the day typed.
  - **Notes:**

- [ ] **Step 3.** Select **Platform** in the table, then, in the side panel, the **⋯** button at the end of the **Harbor 2** row, then **Discard draft**.
  - **Expected:** A notification says **Discarded the draft.** On the timeline, **Harbor 2**'s span has a solid edge, with its diamond at its right end and no dashed line.
  - **Notes:**

#### REL-21: A Release's Colour Is Chosen in Its Dialog

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `product.manager@fathom.test`, shown as **Product Manager**. Run after REL-20. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Close the side panel, scroll to the timeline, select **Year**, and find **Platform**'s and **Patches**' releases lanes, scrolling the timeline left if **Harbor 1** is not wholly in view.
  - **Expected:** **Harbor 1** and **Harbor 3** are blue, **Harbor 2** is purple, the later patch release, such as **Patch December**, is orange, and the earlier, such as **Patch November**, is blue. Each diamond is the colour of its span, and each name is in the page's usual text colour.
  - **Notes:**

- [ ] **Step 2.** Select **Platform** in the table, then, in the side panel, the **⋯** button at the end of the **Harbor 1** row, then **Change…**.
  - **Expected:** A dialog titled **Change Harbor 1** opens. Its last field, **Colour**, reads **Sea (default)**, with a blue square before it and **How the release is drawn on the timeline** under its label.
  - **Notes:**

- [ ] **Step 3.** Open **Colour**.
  - **Expected:** The list offers **Sea (default)**, then **Indigo**, **Violet**, **Grape**, **Pink**, **Red**, **Orange**, **Yellow**, **Lime**, **Green** and **Teal**, each with a square of its colour.
  - **Notes:**

- [ ] **Step 4.** Select **Teal**, then **Save**.
  - **Expected:** A notification says **Drafted the change to the release.** The **Harbor 1** row has a hollow yellow dot and **Draft**, and its square is teal. On the timeline, **Harbor 1**'s span is teal, with a dashed edge.
  - **Notes:**

- [ ] **Step 5.** Publish ([P3](#p3-publish)), then sign in as `project.manager@fathom.test` ([P1](#p1-sign-in)) and open **Drafts** from the left-hand menu.
  - **Expected:** The draft of **the release Harbor 1 in Platform** lists **Colour from Sea to Teal**.
  - **Notes:**

- [ ] **Step 6.** Approve the draft, then open **Releases** from the left-hand menu.
  - **Expected:** **Harbor 1**'s span on the timeline is teal, with a solid edge.
  - **Notes:**

### Part 5: Changing One Cycle's Length

#### REL-22: A Cycle's New Length Moves the Cycles and Releases After It

**Preconditions:** Run after REL-21. Restore the seed data ([R1](#r1-restore-the-seed-data)). Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** In the side panel's **Cycles** table, select the **⋯** button at the end of next quarter's cycle, such as **27.1**, then **Change length…**.
  - **Expected:** A dialog titled **Change the length of** that cycle opens. **Length** reads **3**, followed by **months**, with the cycle's dates under its label. Under **Later cycles**, **Move with it** is selected, and **Keep their dates** is offered. **New dates** lists that cycle, the next one and the first half, with their dates as now, such as **27.1**, **2027-01-01 to 2027-03-31**; **27.2**, **2027-04-01 to 2027-06-30**; and **27.3**, **2027-07-01 to 2027-12-31**.
  - **Notes:**

- [ ] **Step 2.** Replace **3** in **Length** with `2`.
  - **Expected:** The red line is gone. **New dates** lists the cycle two months long, then the next a quarter and the first half half a year, each starting a month earlier than before, such as **27.1**, **2027-01-01 to 2027-02-28**; **27.2**, **2027-03-01 to 2027-05-31**; and **27.3**, **2027-06-01 to 2027-11-30**. Below it, the dialog says **Harbor 3 moves with its cycles.** and **Harbor 3 ships** on the first half's new last day, such as **Harbor 3 ships 2027-11-30.**
  - **Notes:**

- [ ] **Step 3.** Select **Change length**.
  - **Expected:** A notification says **Drafted the new length.** Under **Cycle schedule**, a row **From** the changed cycle's first day, **Every 2 months, named {YY}.{N}**, and a row **From** the next cycle's new first day, **Every 3 months, named {YY}.{N}**, each have a hollow yellow dot and **Draft: added**, and the first half's row, now **From** a month earlier, **Every 6 months, named {YY}.{N}**, has a hollow yellow dot and **Draft**, such as **From 2027-01-01**, **From 2027-03-01** and **From 2027-06-01**. The **Harbor 3** row has a hollow yellow dot and **Draft**, and ships on the first half's new last day, such as **27.1 to 27.3 · ships 2027-11-30**. In the **Cycles** table, the first half runs on its new dates, such as **27.3** from **2027-06-01** to **2027-11-30**.
  - **Notes:**

- [ ] **Step 4.** Publish ([P3](#p3-publish)).
  - **Expected:** The dots on the three rows of the cycle schedule and on **Harbor 3** are filled.
  - **Notes:**

#### REL-23: Approving One Draft of a New Length Approves Them All

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `project.manager@fathom.test`, shown as **Project Manager**. Run after REL-22. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Under **Releases**, select the **⋯** button at the end of the **Harbor 3** row, then **Approve…**.
  - **Expected:** A dialog titled **Approve 4 drafts?** says **Also approves the drafts these depend on:**, listing **the cycles of Platform from** each of the three days in REL-22 Step 3, such as **the cycles of Platform from 2027-01-01**, **the cycles of Platform from 2027-03-01** and **the cycles of Platform from 2027-06-01**.
  - **Notes:**

- [ ] **Step 2.** Select **Approve**.
  - **Expected:** A notification says **Approved 4 drafts.** No row under **Cycle schedule** or **Releases** has a mark, and **Harbor 3** still reads as in REL-22 Step 3.
  - **Notes:**

#### REL-24: Later Cycles Can Keep Their Dates

**Preconditions:** Run after REL-23. Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. **Releases** page open from the left-hand menu, with **Patches** selected in the table.

- [ ] **Step 1.** In the **Cycles** table, select the **⋯** button at the end of the later patch release's last cycle, the fourth cycle, such as **P26.4**, then **Change length…**. Replace **4** in **Length** with `2`, and select **Keep their dates**.
  - **Expected:** **Length** is followed by **weeks**. **New dates** lists that cycle two weeks long, then a cycle from the next day to the end of the cycle after it, six weeks long, then the cycle after that as now, such as **P26.4**, **2026-11-30 to 2026-12-13**; **P27.1**, **2026-12-14 to 2027-01-24**; and **P27.2**, **2027-01-25 to 2027-02-21**. Below it, the dialog says the later patch release ships on that cycle's new last day, such as **Patch December ships 2026-12-13.**
  - **Notes:**

- [ ] **Step 2.** Select **Change length**, then publish ([P3](#p3-publish)).
  - **Expected:** A notification says **Drafted the new length.** Under **Cycle schedule**, a row **From** each of the three cycles' first days, such as **From 2026-11-30**, **From 2026-12-14** and **From 2027-01-25**, has a yellow dot and **Draft: added**. The later patch release has no mark, and ships on the changed cycle's new last day, since it has no Ships on day of its own, such as **Patch December**, **P26.3 to P26.4 · ships 2026-12-13**.
  - **Notes:**

#### REL-25: Discarding One Draft of a New Length Discards Them All

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. Run after REL-24. **Releases** page open from the left-hand menu, with **Patches** selected in the table.

- [ ] **Step 1.** Select the **⋯** button at the end of the second of the three rows REL-24 added, such as **From 2026-12-14**, then **Discard draft**, and publish ([P3](#p3-publish)).
  - **Expected:** A notification says **Discarded the draft.** The cycle schedule has only its first row, and the fourth cycle is four weeks long again, such as **P26.4** from **2026-11-30** to **2026-12-27**.
  - **Notes:**

### Part 6: Release Notes

#### REL-26: A Release's Note Is Read and Written Beside Its Stream

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `product.manager@fathom.test`, shown as **Product Manager**. Run after REL-25. **Light** chosen in the Appearance menu. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Select **Harbor 2**'s underlined name.
  - **Expected:** A panel titled **Harbor 2** opens above the stream's panel, showing the note as it reads: two headings, a bullet list with **every** in bold, a checklist with its first box ticked, red text, and a link.
  - **Notes:**

- [ ] **Step 2.** Choose **Dark** in the Appearance menu.
  - **Expected:** Both panels read well in dark mode.
  - **Notes:**

- [ ] **Step 3.** Choose **Light** in the Appearance menu.
  - **Expected:** Both panels return to their light colours.
  - **Notes:**

- [ ] **Step 4.** Select **Editor**, type a few words at the end, and select **Save**.
  - **Expected:** A notification says **Drafted the note on Harbor 2.** The note's panel closes, and **Harbor 2** is marked **Draft**.
  - **Notes:**
