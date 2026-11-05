---
title: "Manual Test: Release Streams, Cycles and Releases"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/product/decisions.md"]
last_updated: "2026-11-04"
---

# Manual Test: Release Streams, Cycles and Releases

## Scope

Verifies the Releases page: how release streams, their cycles and their releases are shown, in the table, the side panel and the timeline, what a Workforce Administrator, a Project Planner and an Approver can do with them, and how their drafts are published, approved, rejected, resubmitted and discarded.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place and the [Fictional Seed Data](../design/development-setup.md#fictional-seed-data) added.
- Roles as Fathom starts them: no change made to what any role grants in this clone's database. [R2](#r2-start-from-an-empty-database) puts them back.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom ([R0](#r0-start-fathom)), the second the data commands ([R1](#r1-restore-the-seed-data) and [R2](#r2-start-from-an-empty-database)).

## Test Accounts

[R2](#r2-start-from-an-empty-database) creates these accounts, with every other development account, and prints the one password they share. Fathom shows each account by the name in bold, in the top right corner once signed in. Product Manager and Project Manager are different accounts.

- **Engineering Operations Manager:** `engineering.operations.manager@fathom.test`, a Workforce Administrator. It adds, renames and retires release streams and changes their cycles; its changes are drafts. It cannot make releases or approve drafts.
- **Product Manager:** `product.manager@fathom.test`, a Project Planner. It makes and changes releases; its changes are drafts. It cannot change release streams or approve drafts.
- **Project Manager:** `project.manager@fathom.test`, a Project Planner and an Approver. In this test it approves and rejects drafts.
- **Team Member:** `team.member@fathom.test`, a Viewer. It sees release streams, cycles and releases, and cannot change them.

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

- **Mark:** a coloured dot followed by a word, such as a yellow dot and **Draft**, shown after a record's name. A hollow dot means the change is still unpublished.
- **Streams table:** the table on the Releases page, with a row for each release stream and the columns **Name**, **Cycles now** and **Releases**. Selecting a row opens the stream in the side panel.
- **Side panel:** the panel beside the streams table for the selected stream, which the table narrows to make room for, headed with its name, with the sections **Cycle schedule**, **Releases** and **Cycles**. Its close button, an **×**, is at its top right, and dragging its left edge resizes it.
- **Timeline:** the section headed **Timeline** below the streams table, with **Today**, **−** and **+** buttons and the zoom buttons **All**, **Year**, **6 months**, **Quarter**, **Month**, **Week** and **Days** at its top right. It has a row for each stream that is not retired, named on the left, with a lane of the stream's cycles above a lane of its releases, under an axis of two rows of dates. Hovering over a cycle or a release shows its name and dates.
- **⋯ menu:** the menu that opens from a **⋯** button: beside the side panel's close button for the stream itself, when it has a draft, or at the end of a row in the side panel for that change of cycles or release.

## Test Cases

Run the test cases in order. Start with [R0](#r0-start-fathom), then [R2](#r2-start-from-an-empty-database). Part 1 starts from an empty database; REL-10 adds the seed data for Part 2; Part 3 changes what Parts 1 and 2 left; REL-25 restores the seed data for Part 4. Tick each step whose expected result you see, and write anything else under its notes. To run the test again, start again from [R2](#r2-start-from-an-empty-database).

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

- [ ] **Step 3.** Select **New release stream** again and type `testing stream`.
  - **Expected:** The **Name** box says **Already used**.
  - **Notes:**

- [ ] **Step 4.** Select **Cancel**.
  - **Expected:** The dialog closes, and the table still has only the **Testing Stream** row.
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
  - **Expected:** The dialog closes, and a notification says **Drafted the cycles.** Under **Cycle schedule**, a row reads **From 2027-01-04**, then **Every 2 weeks, named Sprint {#}** with a hollow yellow dot and **Draft: added**, and below it **Cycles until** and a day two years after today, with a **Change…** button under it. Below **Releases**, a **Cycles** section, its count in brackets, lists the cycles from **Sprint 1** on. In the table, the **Cycles now** column of **Testing Stream** reads **Every 2 weeks, named Sprint {#}**.
  - **Notes:**

- [ ] **Step 5.** Publish ([P3](#p3-publish)).
  - **Expected:** The marks after **Testing Stream** and after its cycles' row are now solid yellow dots with **Draft: added**.
  - **Notes:**

#### REL-04: The Engineering Operations Manager Cannot Make Releases

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. Run after REL-03. **Testing Stream** open in the side panel.

- [ ] **Step 1.** Look under **Releases** in the side panel.
  - **Expected:** **No releases yet.**, and no **New release…** button.
  - **Notes:**

#### REL-05: The Product Manager Makes a Release From a Stream's Cycles

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `product.manager@fathom.test`, shown as **Product Manager**. Run after REL-04. **Releases** page open from the left-hand menu.

- [ ] **Step 1.** Look at the top right of the page, then select **Testing Stream** in the table.
  - **Expected:** There is no **New release stream** button. The side panel opens on **Testing Stream**, with a yellow dot and **Draft: added**, and no **Rename** or **Retire** buttons.
  - **Notes:**

- [ ] **Step 2.** Select **New release…** under **Releases** in the side panel.
  - **Expected:** A dialog titled **New release in Testing Stream** opens, with **Name**, **First cycle**, **Last cycle** and an empty **Ships on**.
  - **Notes:**

- [ ] **Step 3.** Type `Testing Release` in **Name**, choose **Sprint 1 (2027-01-04 to 2027-01-17)** as the first cycle and **Sprint 2 (2027-01-18 to 2027-01-31)** as the last.
  - **Expected:** Under **Ships on**, the dialog reads **Leave empty to ship at the end of its last cycle, on 2027-01-31**.
  - **Notes:**

- [ ] **Step 4.** Select **Make release**.
  - **Expected:** A notification says **Drafted the new release.** Under **Releases** in the side panel, a row reads **Testing Release** with a hollow yellow dot and **Draft: added**, then **Sprint 1 to Sprint 2 · ships 2027-01-31**. In the table, the **Releases** column of **Testing Stream** reads **(1) Testing Release**.
  - **Notes:**

- [ ] **Step 5.** Publish ([P3](#p3-publish)).
  - **Expected:** The mark after **Testing Release** is now a solid yellow dot with **Draft: added**.
  - **Notes:**

#### REL-06: The Drafts Page Lists Drafts of Streams, Cycles and Releases

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `project.manager@fathom.test`, shown as **Project Manager**. Run after REL-05. **Drafts** page open from the left-hand menu.

- [ ] **Step 1.** Read the entries on the page.
  - **Expected:** Three entries are shown: **Product Manager drafted adding the release Testing Release in Testing Stream**, **Engineering Operations Manager drafted adding the cycles of Testing Stream from 2027-01-04**, and **Engineering Operations Manager drafted adding the release stream Testing Stream**.
  - **Notes:**

#### REL-07: A New Stream Is Rejected Only With the Drafts That Use It

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `project.manager@fathom.test`, shown as **Project Manager**. Run after REL-06. **Releases** page open from the left-hand menu, with **Testing Stream** selected in the table.

- [ ] **Step 1.** Select the **⋯** button beside the close button at the top of the side panel.
  - **Expected:** The menu shows **Testing Stream**, a yellow dot and **Draft: added**, **Added by Engineering Operations Manager**, then **Approve…** and **Reject…**.
  - **Notes:**

- [ ] **Step 2.** Select **Reject…**.
  - **Expected:** A dialog titled **Reject 3 drafts?** says **Also rejects the drafts that use these:**, listing **the cycles of Testing Stream from 2027-01-04** and **the release Testing Release in Testing Stream**, with a **Reason** box.
  - **Notes:**

- [ ] **Step 3.** Select **Cancel**.
  - **Expected:** The dialog closes, and the marks on **Testing Stream**, its cycles and **Testing Release** are unchanged.
  - **Notes:**

#### REL-08: Approving a Release Approves the Stream and Cycles It Depends On

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `project.manager@fathom.test`, shown as **Project Manager**. Run after REL-07. **Testing Stream** open in the side panel.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Testing Release** row, then **Approve…**.
  - **Expected:** A dialog titled **Approve 3 drafts?** says **Also approves the drafts these depend on:**, listing **the release stream Testing Stream** and **the cycles of Testing Stream from 2027-01-04**.
  - **Notes:**

- [ ] **Step 2.** Select **Approve**.
  - **Expected:** A notification says **Approved 3 drafts.** **Testing Stream**, its cycles' row and **Testing Release** no longer have marks, in the table or the side panel.
  - **Notes:**

#### REL-09: Discarding a New Stream Discards What Was Added to It

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. Run after REL-08. **Releases** page open from the left-hand menu.

- [ ] **Step 1.** Select **New release stream**, type `Discarded Stream`, and select **Add stream**. In the side panel, select **Set up cycles…**, type `2027-01-01` in **First cycle starts**, and select **Set up cycles**.
  - **Expected:** The side panel shows **Discarded Stream** with a hollow yellow dot and **Draft: added**, and a row **From 2027-01-01**, **Every 3 months, named {YY}.{N}**, with the same mark.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button beside the close button at the top of the side panel, then **Discard draft**.
  - **Expected:** A notification says **Discarded the draft.**, the side panel closes, and the table has only the **Testing Stream** row.
  - **Notes:**

- [ ] **Step 3.** Look at the top bar.
  - **Expected:** There is no **Publish** button.
  - **Notes:**

### Part 2: With the Seed Data

#### REL-10: The Seed Data Adds Two Release Streams

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `team.member@fathom.test`, shown as **Team Member**. Run after REL-09. **Releases** page open from the left-hand menu.

- [ ] **Step 1.** Run [R1](#r1-restore-the-seed-data).
  - **Expected:** [R1](#r1-restore-the-seed-data) finishes with no error. After the page reloads, the table shows **Testing Stream**, **Platform** and **Patches**, in that order, with no marks, and there is no **New release stream** button.
  - **Notes:**

- [ ] **Step 2.** Read the **Platform** row, each column in order: **Name**, **Cycles now**, **Releases**.
  - **Expected:** **Platform**, **Every 3 months, named {YY}.{N}**, or, from 2027-07-01, **Every 6 months, named {YY}.{N}**, **(3) Harbor 1, Harbor 2, Harbor 3**.
  - **Notes:**

- [ ] **Step 3.** Select **Platform** and read the rows under **Cycle schedule** in the side panel.
  - **Expected:** **From 2026-01-01**, **Every 3 months, named {YY}.{N}**, then **From 2027-07-01**, **Every 6 months, named {YY}.{N}**. Below them, **Cycles until 2029-12-31**. Neither row has a **⋯** button, and there is no **Change…** button.
  - **Notes:**

- [ ] **Step 4.** Read the rows under **Releases** in the side panel.
  - **Expected:** **Harbor 1**, **26.1 to 26.2 · ships 2026-06-30**; **Harbor 2**, **26.3 to 26.4 · ships 2026-12-31**; **Harbor 3**, **27.1 to 27.3 · ships 2027-12-31**. No row has a **⋯** button, and there is no **New release…** button.
  - **Notes:**

#### REL-11: Cycles Show the Months They Span

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `team.member@fathom.test`, shown as **Team Member**. Run after REL-10. **Releases** page open.

- [ ] **Step 1.** Select **Patches** in the table, then scroll the side panel down to **Cycles**.
  - **Expected:** A table with the columns **Name**, **Starts**, **Ends**, **Release**, **Months**.
  - **Notes:**

- [ ] **Step 2.** Read the first row, each column in order.
  - **Expected:** **P26.1**, **2026-09-07**, **2026-10-04**, nothing under **Release**, **Sep 2026 80%, Oct 13%**.
  - **Notes:**

- [ ] **Step 3.** Read the second row.
  - **Expected:** **P26.2**, **2026-10-05**, **2026-11-01**, **Patch October**, **Oct 2026 87%, Nov 3%**.
  - **Notes:**

- [ ] **Step 4.** Read the section's heading, then scroll to the last row and read its **Name** and **Starts** columns.
  - **Expected:** **Cycles (26)**. The last row is **P28.9**, starting **2028-08-07**, the last cycle to start on or before the stream's **Cycles until** day, **2028-08-31**.
  - **Notes:**

#### REL-12: Cycles Change Only From the Start of a Cycle

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. Run after REL-11. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** In the side panel, select **Change…** under **Cycle schedule**, then **Length or names from a date…**.
  - **Expected:** The menu offers **End date…** and **Length or names from a date…**. A dialog titled **Change the length or names of Platform's cycles** opens, with **From the start of** and the text **Cycles before it keep their names and dates**.
  - **Notes:**

- [ ] **Step 2.** Open the **From the start of** list.
  - **Expected:** Every choice is a day followed by a cycle's name in brackets, such as **2026-04-01 (26.2)** and **2028-01-01 (28.1)**. No other days are offered.
  - **Notes:**

- [ ] **Step 3.** Choose **2028-01-01 (28.1)**, change **Each cycle lasts** to `12`, and select **Change cycles**.
  - **Expected:** A third row, **From 2028-01-01**, **Every 12 months, named {YY}.{N}**, appears with a hollow yellow dot and **Draft: added**.
  - **Notes:**

- [ ] **Step 4.** Select the **⋯** button at the end of that row, then **Discard draft**.
  - **Expected:** A notification says **Discarded the draft.**, and the row is gone.
  - **Notes:**

#### REL-13: A Change of Cycles That Would Break a Release Is Refused

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. Run after REL-12. **Platform** open in the side panel.

- [ ] **Step 1.** Select the **⋯** button at the end of the **From 2026-01-01** row, then **Change…**.
  - **Expected:** A dialog titled **Cycles from 2026-01-01** opens, with **First cycle starts** set to **2026-01-01**.
  - **Notes:**

- [ ] **Step 2.** Change **Each cycle lasts** to `2` and select **Save**.
  - **Expected:** The dialog stays open, with the message **The release Harbor 1 would no longer start and end with cycles of its stream; change it first**.
  - **Notes:**

- [ ] **Step 3.** Select **Cancel**.
  - **Expected:** The dialog closes, and the row still reads **Every 3 months, named {YY}.{N}**, with no mark.
  - **Notes:**

#### REL-14: A Release Is Offered Only Cycles No Other Release Includes

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `product.manager@fathom.test`, shown as **Product Manager**. Run after REL-13. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Select **New release…** under **Releases** in the side panel.
  - **Expected:** A dialog titled **New release in Platform** opens.
  - **Notes:**

- [ ] **Step 2.** Open the **First cycle** list.
  - **Expected:** The first choice is **28.1 (2028-01-01 to 2028-06-30)**. No cycle that **Harbor 1**, **Harbor 2** or **Harbor 3** includes, such as **27.3**, is offered.
  - **Notes:**

- [ ] **Step 3.** Select **Cancel**.
  - **Expected:** The dialog closes, and the releases under **Releases** are unchanged.
  - **Notes:**

### Part 3: Changing What Is Already There

#### REL-15: A Stream Is Renamed by a Draft

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. Run after REL-14. **Releases** page open from the left-hand menu, with **Testing Stream** selected in the table.

- [ ] **Step 1.** Select **Rename** at the top of the side panel.
  - **Expected:** A dialog titled **Rename Testing Stream** opens, with **Testing Stream** in the **Name** box.
  - **Notes:**

- [ ] **Step 2.** Replace the name with `Tested Stream` and select **Save**.
  - **Expected:** A notification says **Drafted the new name.** The side panel and the table both show **Tested Stream**, with a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 3.** Select the **⋯** button beside the close button at the top of the side panel.
  - **Expected:** The menu shows **Tested Stream**, a hollow yellow dot and **Draft**, **Changed by Engineering Operations Manager**, **Only you see these changes until you publish them.**, and **Discard draft**.
  - **Notes:**

- [ ] **Step 4.** Select **Discard draft**.
  - **Expected:** A notification says **Discarded the draft.** The side panel and the table show **Testing Stream** again, with no mark.
  - **Notes:**

#### REL-16: A Stream Is Retired by a Draft

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. Run after REL-15. **Releases** page open, with **Patches** selected in the table.

- [ ] **Step 1.** Select **Retire** at the top of the side panel.
  - **Expected:** A notification says **Drafted retiring Patches.** The side panel shows **Retired** in grey, then a hollow yellow dot and **Draft: retired**, and its button now reads **Restore**. In the table, **Patches** is under a **Retired** heading, with the same yellow mark.
  - **Notes:**

- [ ] **Step 2.** Publish ([P3](#p3-publish)).
  - **Expected:** The yellow mark is now a solid dot with **Draft: retired**.
  - **Notes:**

#### REL-17: Approving a Retired Stream Stops New Releases in It

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `project.manager@fathom.test`, shown as **Project Manager**. Run after REL-16. **Releases** page open from the left-hand menu, with **Patches** selected in the table.

- [ ] **Step 1.** Select the **⋯** button beside the close button at the top of the side panel, then **Approve…**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 2.** Select **Approve**.
  - **Expected:** A notification says **Approved 1 draft.** **Patches** stays under **Retired** in the table, with no yellow mark, and the side panel shows only **Retired** in grey.
  - **Notes:**

- [ ] **Step 3.** Look under **Releases** in the side panel.
  - **Expected:** **Patch October** and **Patch December** are listed, and there is no **New release…** button.
  - **Notes:**

#### REL-18: A Retired Stream Is Restored by a Draft

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. Run after REL-17. **Releases** page open from the left-hand menu, with **Patches** selected in the table.

- [ ] **Step 1.** Select **Restore** at the top of the side panel.
  - **Expected:** A notification says **Drafted restoring Patches.** The side panel shows a hollow yellow dot and **Draft: restored**, and its button now reads **Retire**. In the table, **Patches** is no longer under **Retired**.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button beside the close button, then **Discard draft**.
  - **Expected:** A notification says **Discarded the draft.** **Patches** is back under **Retired**, with no yellow mark.
  - **Notes:**

#### REL-19: A Release Is Changed by a Draft

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `product.manager@fathom.test`, shown as **Product Manager**. Run after REL-18. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor 3** row, then **Change…**.
  - **Expected:** A dialog titled **Change Harbor 3** opens, with **Harbor 3** in **Name**, **27.1 (2027-01-01 to 2027-03-31)** as the first cycle, and **27.3 (2027-07-01 to 2027-12-31)** as the last.
  - **Notes:**

- [ ] **Step 2.** Replace the name with `Harbor Three` and select **Save**.
  - **Expected:** A notification says **Drafted the change to the release.** The row reads **Harbor Three**, with a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 3.** Publish ([P3](#p3-publish)).
  - **Expected:** The mark after **Harbor Three** is now a solid yellow dot with **Draft**.
  - **Notes:**

#### REL-20: A Rejected Draft Says Why It Was Rejected

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `project.manager@fathom.test`, shown as **Project Manager**. Run after REL-19. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor Three** row, then **Reject…**.
  - **Expected:** A dialog titled **Reject 1 draft?** opens, with a **Reason** box.
  - **Notes:**

- [ ] **Step 2.** Type `Keep the old name` and select **Reject**.
  - **Expected:** A notification says **Rejected 1 draft.** The row shows a red dot and **Rejected**.
  - **Notes:**

#### REL-21: A Rejected Draft Can Be Resubmitted

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `product.manager@fathom.test`, shown as **Product Manager**. Run after REL-20. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor Three** row.
  - **Expected:** Under **Harbor Three**, the menu offers **Change…** and **Remove**, then shows a red dot and **Rejected**, **Reason: Keep the old name** and **Changed by Product Manager**, then offers **Resubmit** and **Discard draft**.
  - **Notes:**

- [ ] **Step 2.** Select **Resubmit**.
  - **Expected:** A notification says **Resubmitted the draft.** The row shows a yellow dot and **Draft** again.
  - **Notes:**

#### REL-22: A Release Is Removed by a Draft

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `product.manager@fathom.test`, shown as **Product Manager**. Run after REL-21. **Platform** open in the side panel.

- [ ] **Step 1.** Under **Releases**, select the **⋯** button at the end of the **Harbor 1** row, then **Remove**.
  - **Expected:** A notification says **Drafted removing Harbor 1.** The **Harbor 1** row is struck through, with a hollow yellow dot and **Draft: removed**.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button at the end of the **Harbor 1** row.
  - **Expected:** The menu offers **Discard draft**, and neither **Change…** nor **Remove**.
  - **Notes:**

- [ ] **Step 3.** Select **Discard draft**.
  - **Expected:** A notification says **Discarded the draft.** **Harbor 1** is no longer struck through and has no mark.
  - **Notes:**

#### REL-23: A Stream's Cycles Are Made Until a Later Day

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. Run after REL-22. **Platform** open in the side panel.

- [ ] **Step 1.** Under **Cycle schedule**, select **Change…** below **Cycles until 2029-12-31**, then **End date…**.
  - **Expected:** A dialog titled **Change when Platform's cycles end** opens, with **2029-12-31** in **Cycles until**. Below it, **11 cycles in all, as now**, then **Last cycles**: **28.2** with **2028-07-01 to 2028-12-31**, **29.1** with **2029-01-01 to 2029-06-30**, and **29.2** with **2029-07-01 to 2029-12-31**.
  - **Notes:**

- [ ] **Step 2.** Replace the day with `20270630`.
  - **Expected:** The box shows **2027-06-30** and says **A release includes the cycle from 2027-07-01; choose that day or later**, since **Harbor 3** ends with the cycle that starts on 2027-07-01.
  - **Notes:**

- [ ] **Step 3.** Replace the day with `20301231`.
  - **Expected:** **13 cycles in all, 2 more than now**, and **Last cycles** ends with **30.2**, **2030-07-01 to 2030-12-31**.
  - **Notes:**

- [ ] **Step 4.** Select **Save**.
  - **Expected:** A notification says **Drafted the change to the cycles.** The panel's heading shows a hollow yellow dot and **Draft**, **Cycles until 2030-12-31**, and the **Cycles** section reads **Cycles (13)**, its last row **30.2** from **2030-07-01**.
  - **Notes:**

- [ ] **Step 5.** Select the **⋯** button in the panel's heading, then **Discard draft**.
  - **Expected:** A notification says **Discarded the draft.** **Cycles until 2029-12-31** again, and **Cycles (11)**.
  - **Notes:**

#### REL-24: A Release Ships on a Day of Its Own

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `product.manager@fathom.test`, shown as **Product Manager**. Run after REL-23. **Platform** open in the side panel.

- [ ] **Step 1.** Under **Releases**, select the **⋯** button at the end of the **Harbor 2** row, then **Change…**.
  - **Expected:** A dialog titled **Change Harbor 2** opens, with an empty **Ships on** and, under it, **Leave empty to ship at the end of its last cycle, on 2026-12-31**.
  - **Notes:**

- [ ] **Step 2.** Type `20260630` in **Ships on**, then select **Save**.
  - **Expected:** The dialog stays open, and **Ships on** says **A release cannot ship before its first cycle starts**, since **26.3** starts on 2026-07-01.
  - **Notes:**

- [ ] **Step 3.** Replace the day with `20270131`.
  - **Expected:** Under **Ships on**, the dialog reads **Ships 31 days after 26.4 ends**.
  - **Notes:**

- [ ] **Step 4.** Select **Save**.
  - **Expected:** A notification says **Drafted the change to the release.** The **Harbor 2** row has a hollow yellow dot and **Draft**, and reads **26.3 to 26.4 · ships 2027-01-31**, then, in bold, **31 days after 26.4 ends**. The **Cycles** section is unchanged: **27.1** still starts on **2027-01-01**.
  - **Notes:**

- [ ] **Step 5.** Select the **⋯** button at the end of the **Harbor 2** row, then **Discard draft**.
  - **Expected:** A notification says **Discarded the draft.** The row reads **26.3 to 26.4 · ships 2026-12-31** again, with nothing after the date.
  - **Notes:**

### Part 4: The Timeline

#### REL-25: The Timeline Shows Every Current Stream

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `team.member@fathom.test`, shown as **Team Member**. Run after REL-24. **Releases** page open from the left-hand menu.

- [ ] **Step 1.** Run [R1](#r1-restore-the-seed-data).
  - **Expected:** [R1](#r1-restore-the-seed-data) finishes with no error. After the page reloads, the streams table shows **Testing Stream**, **Platform** and **Patches**, none under **Retired**.
  - **Notes:**

- [ ] **Step 2.** Scroll below the streams table to the timeline, and select **Year**.
  - **Expected:** **Year** is highlighted. The timeline has three rows, named **Testing Stream**, **Platform** and **Patches**. The axis's top row names years, such as **2027**, and its second row half years, such as **Jan to Jun 27** and **Jul to Dec 27**. A red line, labelled **Today** in a row of its own above the axis, crosses every row, about a sixth of the way across the timeline.
  - **Notes:**

- [ ] **Step 3.** Read **Platform**'s two lanes.
  - **Expected:** The cycles **27.1** and **27.2** are each a quarter long, and **27.3** and the cycles after it half a year long, each block as long as its dates on the axis. In the lane below, **Harbor 3** spans **27.1** to **27.3**, with a diamond at its right end.
  - **Notes:**

- [ ] **Step 4.** Hover over **Harbor 1**'s span, scrolling the timeline left to it if needed.
  - **Expected:** A tooltip reads **Harbor 1: 26.1 to 26.2, ships 2026-06-30**.
  - **Notes:**

- [ ] **Step 5.** Read **Patches**' cycles lane.
  - **Expected:** Each four-week cycle is a block as long as its dates on the axis, named inside only when its name fits. Hovering over one shows its name and dates, such as **P26.3: 2026-11-02 to 2026-11-29**.
  - **Notes:**

#### REL-26: The Timeline Zooms In and Out

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `team.member@fathom.test`, shown as **Team Member**. Run after REL-25. **Releases** page open, scrolled to the timeline, at **Year**.

- [ ] **Step 1.** Select **All**.
  - **Expected:** The whole timeline fits across, from 2026 to 2030, with no scrolling sideways, and the **−** button is greyed out.
  - **Notes:**

- [ ] **Step 2.** Select **+**.
  - **Expected:** The timeline widens and can be scrolled sideways again, no zoom button is highlighted, and **−** can be selected again.
  - **Notes:**

- [ ] **Step 3.** Select **Quarter**, then **Month**.
  - **Expected:** At **Quarter**, the axis's top row names quarters, such as **Q1 2027**, and its second row months, such as **Jan**. At **Month**, the top row names months, such as **Jan 2027**, and the second row each week by its Monday, such as **Nov 9**, or, where that does not fit, just the day of the month, such as **9**. The red **Today** line stays where it was across the timeline at each zoom.
  - **Notes:**

- [ ] **Step 4.** Select **Week**, then **Days**.
  - **Expected:** At **Week**, the second row names each week by its Monday, such as **Nov 9**, with short unlabelled marks for the days along its bottom. At **Days**, it names each day, such as **Mon 9**.
  - **Notes:**

- [ ] **Step 5.** Scroll the timeline sideways away from today, then select **Today**.
  - **Expected:** The timeline scrolls back so the **Today** line is about a sixth of the way across.
  - **Notes:**

- [ ] **Step 6.** Reload the page and scroll to the timeline.
  - **Expected:** **Days** is still highlighted, with the **Today** line about a sixth of the way across.
  - **Notes:**

- [ ] **Step 7.** Select **Year**.
  - **Expected:** **Year** is highlighted, as REL-25 left it.
  - **Notes:**

#### REL-27: A Release's Own Ship Day Is Marked on the Timeline

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `product.manager@fathom.test`, shown as **Product Manager**. Run after REL-26. **Releases** page open from the left-hand menu, with **Platform** selected in the table.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor 2** row, then **Change…**. Type `20270131` in **Ships on**, and select **Save**.
  - **Expected:** A notification says **Drafted the change to the release.**
  - **Notes:**

- [ ] **Step 2.** Close the side panel, scroll to the timeline, select **6 months**, and find **Harbor 2** in **Platform**'s releases lane.
  - **Expected:** **Harbor 2**'s span, across **26.3** and **26.4**, has a dashed edge. A dashed line runs on from its right end, past the start of **Harbor 3**, to a diamond about a month later, at the end of January 2027.
  - **Notes:**

- [ ] **Step 3.** Hover over **Harbor 2**'s span.
  - **Expected:** A tooltip reads **Harbor 2, Draft: 26.3 to 26.4, ships 2027-01-31**.
  - **Notes:**

- [ ] **Step 4.** Select **Platform** in the table, then, in the side panel, the **⋯** button at the end of the **Harbor 2** row, then **Discard draft**.
  - **Expected:** A notification says **Discarded the draft.** On the timeline, **Harbor 2**'s span has a solid edge, with its diamond at its right end and no dashed line.
  - **Notes:**

#### REL-28: A Retired Stream Is Left Off the Timeline

**Preconditions:** Signed in ([P1](#p1-sign-in)) as `engineering.operations.manager@fathom.test`, shown as **Engineering Operations Manager**. Run after REL-27. **Releases** page open from the left-hand menu, with **Patches** selected in the table.

- [ ] **Step 1.** In the side panel, select **Retire**.
  - **Expected:** A notification says **Drafted retiring Patches.** The timeline has two rows, **Testing Stream** and **Platform**, and no **Patches** row.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button beside the side panel's close button, then **Discard draft**.
  - **Expected:** A notification says **Discarded the draft.** The timeline's **Patches** row is back, after **Platform**.
  - **Notes:**
