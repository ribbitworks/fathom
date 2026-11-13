---
title: "Manual Test: Drafts of People, Lists and Columns"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-13"
---

# Manual Test: Drafts of People, Lists and Columns

## Scope

Verifies how drafts of people, columns, lists, choices, and choice orders are shown on the People, Lists and Drafts pages, and what a Workforce Administrator, an Engineering Director and a Project Manager can do with them, including drafts that use drafts of another kind, and that nobody approves drafts they changed unless their role grants it, as [Roles](../product/roles.md#what-each-role-can-do) sets out, shown here with a release's draft.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**
- **Engineering Director:** `engineering.director@fathom.test`
- **Project Manager:** `project.manager@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data) and [Reset the Database](manual-test-basics.md#reset-the-database).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms this test uses.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### DRAFT-01: Column Drafts Are Marked in the People Table

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] **Step 1.** Look at the **Grade** column header.
  - **Expected:**
    - A yellow dot before **Grade**
    - Under it, a green dot before **Level**
    - The column tinted faint yellow
  - **Notes:**

- [ ] **Step 2.** Look at the **Role on team** column header.
  - **Expected:** A yellow dot, then **Role on team** struck through.
  - **Notes:**

- [ ] **Step 3.** Look at the last two column headers.
  - **Expected:**
    - A red dot in a ring before **Previous site**
    - A yellow dot before **Skills**
  - **Notes:**

### DRAFT-02: A Workforce Administrator Can Discard Column Drafts but Not Approve Them

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DRAFT-01.

**Preconditions:** As DRAFT-01.

- [ ] **Step 1.** Select the **Grade** column name to open its column menu.
  - **Expected:** Under **Grade** and a divider, a yellow dot and **Draft** heads two lines:
    - **Name** from **Level** to **Grade**, by Engineering Operations Manager
    - **Required** from **No** to **Yes**, by Second Engineering Operations Manager
  - **Notes:**

- [ ] **Step 2.** Look at the actions in the menu.
  - **Expected:**
    - **Discard draft** is among them.
    - **Approve…** and **Reject…** are not.
  - **Notes:**

- [ ] **Step 3.** Press Esc.
  - **Expected:** The column menu closes.
  - **Notes:**

- [ ] **Step 4.** Select the **Draft** button above the table.
  - **Expected:** The Draft menu has a **Show** section and a **Filter** section.
  - **Notes:**

- [ ] **Step 5.** Select the **Show** heading in the menu.
  - **Expected:** The menu closes.
  - **Notes:**

### DRAFT-03: Drafts Applied Shows the People Table as It Will Be

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DRAFT-02.

**Preconditions:** As DRAFT-01.

- [ ] **Step 1.** Open the Draft menu, and select **Drafts applied**.
  - **Expected:** The columns are, from the left:
    - Name
    - ID
    - Position
    - Site
    - Grade
    - Onboarding
    - State
    - Start
    - Expected
    - End
    - Manager
    - Manager?
    - Manager assigned
    - Team
    - Team name
    - Skills
  - **Notes:**

- [ ] **Step 2.** Select **Drafts beside live**.
  - **Expected:** **Role on team** and **Previous site** are among the columns again.
  - **Notes:**

### DRAFT-04: Live Only Shows the People Table as It Is Now

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DRAFT-03.

**Preconditions:** As DRAFT-01.

- [ ] **Step 1.** Open the Draft menu, and select **Live only**.
  - **Expected:** The columns are, from the left:
    - Name
    - ID
    - Position
    - Site
    - Level
    - Role on team
    - Onboarding
    - State
    - Start
    - Expected
    - End
    - Manager
    - Manager?
    - Manager assigned
    - Team
    - Team name
  - **Notes:**

- [ ] **Step 2.** Look at the filter section of the Draft menu, which stays open.
  - **Expected:**
    - The filter section is headed **Filter (needs drafts shown)**.
    - Its choices are greyed out.
  - **Notes:**

- [ ] **Step 3.** Select **Drafts beside live**.
  - **Expected:** **Grade**, **Previous site** and **Skills** are among the columns again.
  - **Notes:**

### DRAFT-05: A Rejected Column Draft Offers Nothing to Decide

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from DRAFT-04.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Select the **Previous site** column name to open its column menu.
  - **Expected:**
    - A red dot in a ring, then **Rejected**
    - Under them, **Reason: Fictional reason: a previous site is not needed yet.**
    - No **Approve…** and no **Reject…**
  - **Notes:**

### DRAFT-07: A Rejected Person's Draft Offers Nothing to Decide

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-05.

**Preconditions:** As DRAFT-05.

- [ ] **Step 1.** Open the Draft menu, and under **Filter** select **Rejected**.
  - **Expected:**
    - Two people are shown.
    - **우아현** (Employee ID E10004), with a red dot in a ring before her **Position**
    - A light green Live row under 우아현's row
    - **Ophélie Roussel** (Employee ID E10152), with a red dot in a ring in her row's slot
  - **Notes:**

- [ ] **Step 2.** Press Esc.
  - **Expected:** The Draft menu closes.
  - **Notes:**

- [ ] **Step 3.** Open the Draft menu, and select **Rejected** again.
  - **Expected:** All people are shown again.
  - **Notes:**

### DRAFT-08: The Lists Page Shows Which Lists Have Drafts

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-07.

**Preconditions:** Signed in with this account. **Lists** page open from the left-hand menu.

- [ ] **Step 1.** Read each list's row.
  - **Expected:**
    - **Certifications** struck through
    - **Languages**, then a yellow **Retired** box
    - A yellow dot in each of the rows of Levels, Positions, Roles on teams, Sites and Skills
    - No dot in the row of Hiring states
  - **Notes:**

- [ ] **Step 2.** Look at the row under each list.
  - **Expected:** Each list except Certifications and Skills has a light green Live row under it.
  - **Notes:**

- [ ] **Step 3.** Read the Choices column of the **Positions** row, not its Live row.
  - **Expected:** **(6)** Engineering Manager, Employee, Manager, Software Engineer, Test Engineer, SDET, and **Architect** struck through.
  - **Notes:**

### DRAFT-09: A New Order That Depends on a Rejected Choice Cannot Be Approved

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-08.

**Preconditions:** As DRAFT-08.

- [ ] **Step 1.** Select **Sites** in its row, not its Live row.
  - **Expected:**
    - A panel opens with **Sites** at the top.
    - **Harbourside** is the first choice.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button beside **Sites** at the top of the panel.
  - **Expected:**
    - The menu shows **Sites**, a divider, a yellow dot and **Draft: reordered**, and **Reordered by Engineering Operations Manager**.
    - **Approve…** is greyed out.
    - **Waiting for a rejected draft to be resubmitted** is under it.
    - **Reject…** can be selected.
  - **Notes:**

- [ ] **Step 3.** Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] **Step 4.** Close the panel with the **×** button at its top right.
  - **Expected:** The panel closes.
  - **Notes:**

### DRAFT-10: Rejected List Drafts Offer Nothing to Decide

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-09.

**Preconditions:** As DRAFT-08.

- [ ] **Step 1.** Select **Positions** in its row, not its Live row.
  - **Expected:**
    - A panel opens with **Positions** at the top.
    - A red dot in a ring is before the description under it.
    - One choice has a red dot in a ring before it.
    - That choice has no box.
    - **Architect**: a yellow dot, then its name struck through.
  - **Notes:**

- [ ] **Step 2.** Close the panel.
  - **Expected:** The panel closes.
  - **Notes:**

### DRAFT-11: Drafts Applied Shows the Lists as They Will Be

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-10.

**Preconditions:** As DRAFT-08.

- [ ] **Step 1.** Open the Draft menu, and select **Drafts applied**.
  - **Expected:**
    - The count beside the search box reads **12 lists**.
    - Certifications and Languages are not in the table.
    - No Live rows.
    - No green dots.
  - **Notes:**

- [ ] **Step 2.** Select **Drafts beside live**.
  - **Expected:** **Certifications** and **Languages** are in the table again.
  - **Notes:**

### DRAFT-12: The Drafts Page Describes New Orders

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-11.

**Preconditions:** Signed in with this account. **Drafts** page open from the left-hand menu.

- [ ] **Step 1.** Type **new order** in the search box.
  - **Expected:** Three entries are shown:
    - **drafted a new order for Levels**
    - **drafted a new order for Positions**
    - **drafted a new order for Sites**
  - **Notes:**

- [ ] **Step 2.** Read the **Sites** entry.
  - **Expected:**
    - It names the order **Kestrel Bay, Northmere, Ashgrove, Corran Quay**.
    - After it, it names the new order **Harbourside, Kestrel Bay, Northmere Labs, Ashgrove, Corran Quay**.
    - Its checkbox is greyed out.
    - **Waiting for a rejected draft to be resubmitted** is under it.
  - **Notes:**

- [ ] **Step 3.** Clear the search box.
  - **Expected:** All drafts are shown again.
  - **Notes:**

### DRAFT-13: Rejected Drafts Cannot Be Selected on the Drafts Page

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-12.

**Preconditions:** As DRAFT-12.

- [ ] **Step 1.** Type **Rejected** in the search box.
  - **Expected:** Eight entries are shown, each starting with a red dot in a ring, with **Reason:** and its reason under it:
    - the column Previous site
    - the list Positions
    - the new order for Positions
    - the choice Harbourside in Sites
    - 우아현
    - Ophélie Roussel
    - the project Transit Displays Phase 2
    - a release in Patches, its colour changed
  - **Notes:**

- [ ] **Step 2.** Try to select the checkbox of each entry.
  - **Expected:** None can be selected.
  - **Notes:**

- [ ] **Step 3.** Clear the search box.
  - **Expected:** All drafts are shown again.
  - **Notes:**

### DRAFT-15: Unpublished Changes Are Seen Only by the Person Who Made Them

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-13. Step 5 signs in as another account.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account. **People** page open.

- [ ] **Step 1.** Look at the top bar, beside the account's name.
  - **Expected:**
    - It shows **Publish 3 changes**.
    - A **⋯** button is beside it.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button beside **Publish 3 changes**.
  - **Expected:** The menu shows, in order:
    - **Unpublished changes**, then a divider.
    - **Nobody else sees these changes until they're published.**
    - **Added** the choice Laptop in Equipment.
    - **Added** the list Equipment.
    - **Changed** Mariana Metz.
    - **Discard all…**.
  - **Notes:**

- [ ] **Step 3.** Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] **Step 4.** Type **Mariana Metz** in the search box above the table.
  - **Expected:** In her row:
    - Nothing in the slot
    - A hollow yellow dot before the new **Site**
    - The **Site** cell yellow
  - **Notes:**

- [ ] **Step 5.** Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Director**.
  - **Notes:**

- [ ] **Step 6.** Select the **People** page in the left-hand menu.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] **Step 7.** Type **Mariana Metz** in the search box.
  - **Expected:**
    - Her row has the grey lock in its slot.
    - Her **Site** has no dot before it.
    - Her **Site** cell is not yellow.
    - The top bar shows no **Publish** button.
  - **Notes:**

### DRAFT-16: A Record Someone Else Is Changing Is Held

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-15.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Type **Viktoria Holmberg** in the search box above the table.
  - **Expected:** In her row:
    - The grey lock in the slot
    - A yellow dot before each value her published draft changes
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button at the end of her row.
  - **Expected:**
    - The menu says **Being changed by Second Engineering Operations Manager. It can be changed once they publish or discard their changes.**
    - It has no **Discard draft** or **Remove person**.
  - **Notes:**

### DRAFT-17: Changing a Published Draft Keeps Others Seeing It as Published

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DRAFT-16. Step 3 signs in as another account.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Type **E10002** in the search box.
  - **Expected:** The table shows the row whose **ID** is **E10002**.
  - **Notes:**

- [ ] **Step 2.** Select that person's **ID** cell, type **E20002**, and press Enter.
  - **Expected:**
    - The cell reads **E20002**.
    - A hollow yellow dot is before it.
    - The cell is yellow.
    - The top bar shows **Publish 4 changes**.
  - **Notes:**

- [ ] **Step 3.** Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Director**.
  - **Notes:**

- [ ] **Step 4.** Select the **People** page in the left-hand menu.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] **Step 5.** Type **E10002** in the search box.
  - **Expected:**
    - The row still reads **E10002**.
    - No dot before **E10002**.
    - The grey lock is in the row's slot.
  - **Notes:**

### DRAFT-18: Publishing Shows the Changes to Everyone

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-17. Step 3 signs in as another account.

**Preconditions:** DRAFT-17 done. Signed in with this account. **People** page open.

- [ ] **Step 1.** Select **Publish 4 changes** in the top bar.
  - **Expected:**
    - A notice reads **Published 4 changes.**
    - The **Publish** button is gone from the top bar.
  - **Notes:**

- [ ] **Step 2.** Type **Mariana Metz** in the search box.
  - **Expected:** A solid yellow dot before her new **Site**.
  - **Notes:**

- [ ] **Step 3.** Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Director**.
  - **Notes:**

- [ ] **Step 4.** Select the **People** page in the left-hand menu.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] **Step 5.** Type **Mariana Metz** in the search box.
  - **Expected:**
    - A yellow dot before her new **Site**
    - The **Site** cell yellow
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### DRAFT-19: Discard All Removes Every Unpublished Change

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-18.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Select the **⋯** button beside **Publish 3 changes**, then **Discard all…**.
  - **Expected:**
    - A dialog titled **Discard 3 changes?** opens.
    - It says **This cannot be undone.**
  - **Notes:**

- [ ] **Step 2.** Select **Discard**.
  - **Expected:**
    - A notice reads **Discarded 3 changes.**
    - The **Publish** button is gone from the top bar.
  - **Notes:**

### DRAFT-20: All Waiting Drafts Can Be Approved From the Drafts Page

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from DRAFT-19.

**Preconditions:** Run Reset the Database first. Signed in with this account. **Drafts** page open.

- [ ] **Step 1.** Select **Select all waiting**.
  - **Expected:**
    - The button at the top right starts **Approve 32 drafts**.
    - The **Sites** new order entry is not selected.
    - The **Viktoria Holmberg** entry is not selected.
  - **Notes:**

- [ ] **Step 2.** Select **Approve 32 drafts**.
  - **Expected:** A dialog titled **Approve 32 drafts?** opens.
  - **Notes:**

- [ ] **Step 3.** Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notice reads **Approved 32 drafts.**
  - **Notes:**

### DRAFT-21: A Resubmitted Choice Is Approved With the New Order That Depends on It

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-20. Step 4 signs in as another account.

**Preconditions:** Run Reset the Database first. Signed in with this account.

- [ ] **Step 1.** Select the **Lists** page in the left-hand menu.
  - **Expected:** The table of lists shows.
  - **Notes:**

- [ ] **Step 2.** Select **Sites**.
  - **Expected:** A panel opens with **Sites** at the top.
  - **Notes:**

- [ ] **Step 3.** Select the **⋯** button at the end of the **Harbourside** row, then **Resubmit**.
  - **Expected:** **Harbourside** has a yellow dot in its slot.
  - **Notes:**

- [ ] **Step 4.** Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Director**.
  - **Notes:**

- [ ] **Step 5.** Select the **Lists** page in the left-hand menu.
  - **Expected:** The table of lists shows.
  - **Notes:**

- [ ] **Step 6.** Select **Sites**.
  - **Expected:** A panel opens with **Sites** at the top.
  - **Notes:**

- [ ] **Step 7.** Select the **⋯** button beside **Sites** at the top of the panel, then **Approve…**.
  - **Expected:**
    - A dialog titled **Approve 2 drafts?** opens.
    - Under **Also approves the drafts these depend on:** it lists *the choice Harbourside in Sites*.
  - **Notes:**

- [ ] **Step 8.** Select **Approve**.
  - **Expected:**
    - **Harbourside** is the first choice.
    - **Harbourside** has no dot and no box.
  - **Notes:**

**Afterwards:** Run Reset the Database.

### DRAFT-22: Drafts That Others Use Cannot Be Discarded

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-21.

**Preconditions:** Reset the Database run after DRAFT-21. Signed in with this account. **Lists** page open.

- [ ] **Step 1.** Select **Skills**.
  - **Expected:**
    - A panel opens.
    - **Rust** has a yellow dot in its slot.
    - **TypeScript** has a yellow dot in its slot.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button at the end of the **Rust** row, then **Discard draft**.
  - **Expected:**
    - A red notice reads **This choice can't be discarded while other drafts depend on it. Discard those drafts, or change them so they no longer use it, then try again.**
    - **Rust** still has a yellow dot in its slot.
  - **Notes:**

### DRAFT-23: A New List Is Rejected Only With the Drafts That Use It

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from DRAFT-22.

**Preconditions:** As DRAFT-22, signed in with this account instead. **Lists** page open.

- [ ] **Step 1.** Select **Skills**.
  - **Expected:** A panel opens with **Skills** at the top.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button beside **Skills** at the top of the panel, then **Reject…**.
  - **Expected:**
    - A dialog titled **Reject 5 drafts?** opens.
    - Under **Also rejects the drafts that use these:** it lists *Silje Holm-Schrøder*, *the column Skills*, *the choice Rust in Skills* and *the choice TypeScript in Skills*.
    - It has a **Reason** box.
  - **Notes:**

- [ ] **Step 3.** Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] **Step 4.** Close the panel.
  - **Expected:**
    - The panel closes.
    - **Skills** still has a yellow dot in its slot.
  - **Notes:**

### DRAFT-24: A Person's Draft Is Approved With the New List, Column and Choice It Uses

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-23.

**Preconditions:** As DRAFT-23. **Drafts** page open.

- [ ] **Step 1.** Type **Silje Skills** in the search box.
  - **Expected:** One entry is shown: **Engineering Operations Manager drafted changes to Silje Holm-Schrøder: Skills set to Rust**.
  - **Notes:**

- [ ] **Step 2.** Select the entry's checkbox.
  - **Expected:** The entry's checkbox is ticked.
  - **Notes:**

- [ ] **Step 3.** Select the button at the top right that starts **Approve**.
  - **Expected:**
    - A dialog titled **Approve 4 drafts?** opens.
    - Under **Also approves the drafts these depend on:** it lists *the column Skills*, *the list Skills* and *the choice Rust in Skills*.
  - **Notes:**

- [ ] **Step 4.** Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notice reads **Approved 4 drafts.**
    - The page says **No drafts match the search.**
  - **Notes:**

**Afterwards:** Run Reset the Database.

### DRAFT-25: Drafts This Account Changed Need Another Approver

**Account:** Project Manager, `project.manager@fathom.test`, changed from DRAFT-24. Step 9 signs in as another account.

**Preconditions:** Run Reset the Database first. Signed in with this account. **Releases** page open from the left-hand menu, with **Platform** selected in the streams table.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor 1** row, then **Change…**.
  - **Expected:**
    - A dialog titled **Change Harbor 1** opens.
    - **Name** holds **Harbor 1**.
  - **Notes:**

- [ ] **Step 2.** Replace the name with `Harbor One`.
  - **Expected:** **Name** holds **Harbor One**.
  - **Notes:**

- [ ] **Step 3.** Select **Save**.
  - **Expected:**
    - The dialog closes.
    - A hollow yellow dot before **Harbor One**.
    - The top bar shows **Publish 2 changes**.
  - **Notes:**

- [ ] **Step 4.** Select **Publish 2 changes** in the top bar.
  - **Expected:** The top bar no longer offers to publish.
  - **Notes:**

- [ ] **Step 5.** Select the **⋯** button at the end of the **Harbor One** row.
  - **Expected:**
    - **Approve…** is greyed out.
    - **Changed by this account, so another approver must approve it** is under it, easy to read.
    - **Reject…** is not greyed out.
  - **Notes:**

- [ ] **Step 6.** Press Escape.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] **Step 7.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** An entry names **Harbor One**, drafted by **Project Manager**.
  - **Notes:**

- [ ] **Step 8.** Select that entry's checkbox.
  - **Expected:**
    - **Approve 1 draft** is greyed out.
    - **Reject…** is not greyed out.
    - A line under them says another approver must approve it.
  - **Notes:**

- [ ] **Step 9.** Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Director**.
  - **Notes:**

- [ ] **Step 10.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** An entry names **Harbor One**.
  - **Notes:**

- [ ] **Step 11.** Select the **Harbor One** entry's checkbox.
  - **Expected:** The entry's checkbox is ticked.
  - **Notes:**

- [ ] **Step 12.** Select **Approve 1 draft**.
  - **Expected:**
    - A dialog opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] **Step 13.** Select **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 1 draft.**
  - **Notes:**

**Afterwards:** Run Reset the Database.

### DRAFT-26: A Row With a Draft Ends With One Menu Button

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-25.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] **Step 1.** In the search box above the table, type **Simone Jean**.
  - **Expected:**
    - Her row is tinted faint yellow.
    - A yellow dot before her **Manager**.
    - A light green Live row is under it.
  - **Notes:**

- [ ] **Step 2.** Scroll the table all the way to the right, and read the end of that row.
  - **Expected:**
    - The row ends with one **⋯** button.
    - Nothing is beside it.
  - **Notes:**
