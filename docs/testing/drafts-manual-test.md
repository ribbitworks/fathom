---
title: "Manual Test: Drafts of People, Lists and Columns"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-17"
---

# Manual Test: Drafts of People, Lists and Columns

## Scope

Verifies how drafts of people, columns, lists, choices, and choice orders are shown on the People, Lists and Drafts pages, and what a Workforce Administrator, an Engineering Director and a Project Manager can do with them, including drafts that use drafts of another kind, and that nobody approves drafts they changed unless their role grants it, as [Roles](../product/roles.md#what-each-role-can-do) sets out, shown here with a release's draft.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
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

- [ ] `23A9` Look at the **Grade** column header.
  - **Expected:**
    - A yellow dot before **Grade**
    - Under it, a green dot before **Level**
    - The column tinted faint yellow
  - **Notes:**

- [ ] `F31B` Look at the **Role on team** column header.
  - **Expected:** A yellow dot, then **Role on team** struck through.
  - **Notes:**

- [ ] `3D34` Look at the last two column headers.
  - **Expected:**
    - A red dot in a ring before **Previous site**
    - A yellow dot before **Skills**
  - **Notes:**

### DRAFT-02: A Workforce Administrator Can Discard Column Drafts but Not Approve Them

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DRAFT-01.

**Preconditions:** As DRAFT-01.

- [ ] `5E7E` Select the **Grade** column name to open its column menu.
  - **Expected:** Under **Grade** and a divider, a yellow dot and **Draft** heads two lines:
    - "Name from Level to Grade, by Engineering Operations Manager"
    - "Required from No to Yes, by Second Engineering Operations Manager"
  - **Notes:**

- [ ] `4D46` Look at the actions in the menu.
  - **Expected:**
    - **Discard draft** is among them.
    - **Approve…** and **Reject…** are not.
  - **Notes:**

- [ ] `FB5D` Press Esc.
  - **Expected:** The column menu closes.
  - **Notes:**

- [ ] `A0E3` Select the **Draft** button above the table.
  - **Expected:** The Draft menu has a **Show** section and a **Filter** section.
  - **Notes:**

- [ ] `448F` Select the **Show** heading in the menu.
  - **Expected:** The menu closes.
  - **Notes:**

### DRAFT-03: Drafts Applied Shows the People Table as It Will Be

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DRAFT-02.

**Preconditions:** As DRAFT-01.

- [ ] `87F2` Open the Draft menu, and select **Drafts applied**.
  - **Expected:** The columns are, from the left:
    - **Name**
    - **ID**
    - **Position**
    - **Site**
    - **Grade**
    - **Onboarding**
    - **Work pattern**
    - **Compensation band**
    - **Performance rating**
    - **State**
    - **Start**
    - **Expected**
    - **End**
    - **Manager**
    - **Manager?**
    - **Manager assigned**
    - **Team**
    - **Team name**
    - **Skills**
  - **Notes:**

- [ ] `EE9B` Select **Drafts & Live**.
  - **Expected:** **Role on team** and **Previous site** are among the columns again.
  - **Notes:**

### DRAFT-04: Live Only Shows the People Table as It Is Now

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DRAFT-03.

**Preconditions:** As DRAFT-01.

- [ ] `F453` Open the Draft menu, and select **Live only**.
  - **Expected:** The columns are, from the left:
    - **Name**
    - **ID**
    - **Position**
    - **Site**
    - **Level**
    - **Role on team**
    - **Onboarding**
    - **Work pattern**
    - **Compensation band**
    - **Performance rating**
    - **State**
    - **Start**
    - **Expected**
    - **End**
    - **Manager**
    - **Manager?**
    - **Manager assigned**
    - **Team**
    - **Team name**
  - **Notes:**

- [ ] `054F` Look at the filter section of the Draft menu, which stays open.
  - **Expected:**
    - The filter section is headed **Filter (needs drafts shown)**.
    - Its choices are greyed out.
  - **Notes:**

- [ ] `332F` Select **Drafts & Live**.
  - **Expected:** **Grade**, **Previous site** and **Skills** are among the columns again.
  - **Notes:**

### DRAFT-05: A Rejected Column Draft Offers Nothing to Decide

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from DRAFT-04.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] `67D6` Select the **Previous site** column name to open its column menu.
  - **Expected:**
    - A red dot in a ring, then **Rejected**
    - Under them, **Reason:** 'Fictional reason: a previous site is not needed yet.'
    - No **Approve…** and no **Reject…**
  - **Notes:**

### DRAFT-07: A Rejected Person's Draft Offers Nothing to Decide

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-05.

**Preconditions:** As DRAFT-05.

- [ ] `C680` Open the Draft menu, and under **Filter** select **Rejected**.
  - **Expected:**
    - Two people are shown.
    - '우아현' (Employee ID 'E10004'), with a red dot in a ring before her **Position**
    - A light green Live row under the row of '우아현'
    - 'Ophélie Roussel' (Employee ID 'E10152'), with a red dot in a ring in her row's slot
  - **Notes:**

- [ ] `9C68` Press Esc.
  - **Expected:** The Draft menu closes.
  - **Notes:**

- [ ] `9F80` Open the Draft menu, and select **Rejected** again.
  - **Expected:** All people are shown again.
  - **Notes:**

### DRAFT-08: The Lists Page Shows Which Lists Have Drafts

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-07.

**Preconditions:** Signed in with this account. **Lists** page open from the left-hand menu.

- [ ] `D033` Read each list's row.
  - **Expected:**
    - 'Certifications' struck through
    - 'Languages', then a yellow **Retired** box
    - A yellow dot in each of the rows of 'Levels', 'Positions', 'Roles on teams', 'Sites' and 'Skills'
    - No dot in the row of 'Hiring states'
  - **Notes:**

- [ ] `E91A` Look at the row under each list.
  - **Expected:** Each list except 'Certifications' and 'Skills' has a light green Live row under it.
  - **Notes:**

- [ ] `ADF8` Read the **Choices** column of the row of 'Positions', not its Live row.
  - **Expected:** "(6)", then 'Engineering Manager', 'Employee', 'Manager', 'Software Engineer', 'Test Engineer', 'SDET', and 'Architect' struck through.
  - **Notes:**

### DRAFT-09: A New Order That Depends on a Rejected Choice Cannot Be Approved

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-08.

**Preconditions:** As DRAFT-08.

- [ ] `7E3F` Select 'Sites' in its row, not its Live row.
  - **Expected:**
    - A panel opens with 'Sites' at the top.
    - 'Harbourside' is the first choice.
  - **Notes:**

- [ ] `C3B3` Select the **⋯** button beside 'Sites' at the top of the panel.
  - **Expected:**
    - The menu shows 'Sites', a divider, a yellow dot and "Draft: reordered", and "Reordered by Engineering Operations Manager".
    - **Approve…** is greyed out.
    - "Waiting for a rejected draft to be resubmitted" is under it.
    - **Reject…** can be selected.
  - **Notes:**

- [ ] `C796` Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `5C09` Close the panel with the **×** button at its top right.
  - **Expected:** The panel closes.
  - **Notes:**

### DRAFT-10: Rejected List Drafts Offer Nothing to Decide

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-09.

**Preconditions:** As DRAFT-08.

- [ ] `4C9E` Select 'Positions' in its row, not its Live row.
  - **Expected:**
    - A panel opens with 'Positions' at the top.
    - A red dot in a ring is before the description under it.
    - One choice has a red dot in a ring before it.
    - That choice has no box.
    - 'Architect': a yellow dot, then its name struck through.
  - **Notes:**

- [ ] `28E8` Close the panel.
  - **Expected:** The panel closes.
  - **Notes:**

### DRAFT-11: Drafts Applied Shows the Lists as They Will Be

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-10.

**Preconditions:** As DRAFT-08.

- [ ] `9A70` Open the Draft menu, and select **Drafts applied**.
  - **Expected:**
    - The count beside the search box reads "15 lists".
    - 'Certifications' and 'Languages' are not in the table.
    - No Live rows.
    - No green dots.
  - **Notes:**

- [ ] `242E` Select **Drafts & Live**.
  - **Expected:** 'Certifications' and 'Languages' are in the table again.
  - **Notes:**

### DRAFT-12: The Drafts Table Shows a New Order and Why It Waits

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-11.

**Preconditions:** Signed in with this account. **Drafts** page open from the left-hand menu, with **All drafts** chosen beside the page's title.

- [ ] `25CB` Read the table's column names, from left to right.
  - **Expected:**
    - No tick box comes before **Record**.
    - Then **Change**, **State**, **What changes**, **Type**, **Area**, **Made by**, **Drafted** and **Reason**.
  - **Notes:**

- [ ] `54D6` Search for `Order of choices`.
  - **Expected:** Three rows are shown, whose **Record** reads 'Levels', 'Positions' and 'Sites'.
  - **Notes:**

- [ ] `F9BD` Read the row of 'Sites', from left to right.
  - **Expected:**
    - A yellow dot, then 'Sites', then a grey box reading "Waits on a rejected draft".
    - **Change** reads "Reordered".
    - **State** reads "Waiting".
    - **What changes** starts **Order** from 'Kestrel Bay', 'Northmere', 'Ashgrove', 'Corran Quay' to 'Harbourside', 'Kestrel Bay', 'Northmere Labs', 'Ashgrove', 'Corran Quay'.
    - **Type** reads "Order of choices".
    - **Area** reads "Configuration".
    - **Made by** reads "Engineering Operations Manager".
    - **Reason** is empty.
  - **Notes:**

- [ ] `B9B9` Clear the search box.
  - **Expected:** All drafts are shown again.
  - **Notes:**

### DRAFT-13: Rejected Drafts Are Listed Under All Drafts, Not To Decide

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-12.

**Preconditions:** As DRAFT-12.

- [ ] `485D` In the **State** column's menu, filter by **Rejected** alone.
  - **Expected:**
    - Each row shown starts with a red dot in a ring.
    - Each row's **State** reads "Rejected".
    - Each row's **Reason** holds its reason.
    - Nine rows are shown, whose **Record** reads 'Ophélie Roussel', '우아현', 'Payments tester', 'Positions' twice ('List' and 'Order of choices' under **Type**), 'Harbourside in Sites', 'Previous site', 'P-1984 Transit Displays Phase 2' and 'Patch January in Patches', in any order.
  - **Notes:**

- [ ] `C969` Select **To decide** beside the page's title.
  - **Expected:** The table reads "No matching drafts".
  - **Notes:**

- [ ] `1B99` Open the Views menu, and select **Clear view**.
  - **Expected:** All drafts are shown again.
  - **Notes:**

### DRAFT-15: Unpublished Changes Are Seen Only by the Person Who Made Them

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-13. Step `8F00` signs in as another account.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account. **People** page open.

- [ ] `AC61` Look at the top bar, beside the account's name.
  - **Expected:**
    - It shows **Publish 3 changes**.
    - A **⋯** button is beside it.
  - **Notes:**

- [ ] `3DBD` Select the **⋯** button beside **Publish 3 changes**.
  - **Expected:** The menu shows, in order:
    - "Unpublished changes", then a divider.
    - "Nobody else sees these changes until they're published."
    - "Added" the choice 'Laptop' in 'Equipment'.
    - "Added" the list 'Equipment'.
    - "Changed" 'Mariana Metz'.
    - **Discard all…**.
  - **Notes:**

- [ ] `61B5` Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `D8C1` Type `Mariana Metz` in the search box above the table.
  - **Expected:** In her row:
    - Nothing in the slot
    - A hollow yellow dot before the new **Site**
    - The **Site** cell yellow
  - **Notes:**

- [ ] `8F00` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `D858` Select the **People** page in the left-hand menu.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] `40D2` Type `Mariana Metz` in the search box.
  - **Expected:**
    - Her row has the grey lock in its slot.
    - Her **Site** has no dot before it.
    - Her **Site** cell is not yellow.
    - The top bar shows no **Publish** button.
  - **Notes:**

### DRAFT-16: A Record Someone Else Is Changing Is Held

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-15.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] `E97E` Type `Viktoria Holmberg` in the search box above the table.
  - **Expected:** In her row:
    - The grey lock in the slot
    - A yellow dot before each value her published draft changes
  - **Notes:**

- [ ] `B5C4` Select the **⋯** button at the end of her row.
  - **Expected:**
    - The menu says "Being changed by Second Engineering Operations Manager. It can be changed once they publish or discard their changes."
    - It has no **Discard draft** or **Remove person**.
  - **Notes:**

### DRAFT-17: Changing a Published Draft Keeps Others Seeing It as Published

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DRAFT-16. Step `A1FC` signs in as another account.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] `49A5` Type `E10002` in the search box.
  - **Expected:** The table shows the row whose **ID** is `E10002`.
  - **Notes:**

- [ ] `84D8` Select that person's **ID** cell, type `E20002`, and press Enter.
  - **Expected:**
    - The cell reads `E20002`.
    - A hollow yellow dot is before it.
    - The cell is yellow.
    - The top bar shows **Publish 4 changes**.
  - **Notes:**

- [ ] `A1FC` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `47E4` Select the **People** page in the left-hand menu.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] `4E79` Type `E10002` in the search box.
  - **Expected:**
    - The row still reads `E10002`.
    - No dot before `E10002`.
    - The grey lock is in the row's slot.
  - **Notes:**

### DRAFT-18: Publishing Shows the Changes to Everyone

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-17. Step `A2AB` signs in as another account.

**Preconditions:** DRAFT-17 done. Signed in with this account. **People** page open.

- [ ] `E65D` Select **Publish 4 changes** in the top bar.
  - **Expected:**
    - A notice reads "Published 4 changes."
    - The **Publish** button is gone from the top bar.
  - **Notes:**

- [ ] `FA4F` Type `Mariana Metz` in the search box.
  - **Expected:** A solid yellow dot before her new **Site**.
  - **Notes:**

- [ ] `A2AB` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `54CE` Select the **People** page in the left-hand menu.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] `450E` Type `Mariana Metz` in the search box.
  - **Expected:**
    - A yellow dot before her new **Site**
    - The **Site** cell yellow
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### DRAFT-19: Discard All Removes Every Unpublished Change

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-18.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] `711C` Select the **⋯** button beside **Publish 3 changes**, then **Discard all…**.
  - **Expected:**
    - A dialog titled "Discard 3 changes?" opens.
    - It says "This cannot be undone."
  - **Notes:**

- [ ] `AB77` Select **Discard**.
  - **Expected:**
    - A notice reads "Discarded 3 changes."
    - The **Publish** button is gone from the top bar.
  - **Notes:**

### DRAFT-20: All Waiting Drafts Can Be Approved From the Drafts Page

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from DRAFT-19.

**Preconditions:** Run Reset the Database first. Signed in with this account. **Drafts** page open.

- [ ] `EAC2` Read the page's heading.
  - **Expected:** No buttons at the right of the page's heading: no **Reject…** or **Approve…**.
  - **Notes:**

- [ ] `DDAC` Tick the tick box before **Record** in the table's header.
  - **Expected:**
    - At the right of the page's heading: **Reject…** and **Approve 32 drafts…**.
    - No row's **Record** reads 'Viktoria Holmberg'.
    - No row's **Type** reads "Order of choices" with **Record** 'Sites'.
  - **Notes:**

- [ ] `30E7` Select **Approve 32 drafts…**.
  - **Expected:** A dialog titled "Approve 32 drafts?" opens.
  - **Notes:**

- [ ] `EA4D` Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notice reads "Approved 32 drafts."
    - No buttons at the right of the page's heading.
  - **Notes:**

### DRAFT-21: A Resubmitted Choice Is Approved With the New Order That Depends on It

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-20. Step `71C1` signs in as another account.

**Preconditions:** Run Reset the Database first. Signed in with this account.

- [ ] `04CF` Select the **Lists** page in the left-hand menu.
  - **Expected:** The table of lists shows.
  - **Notes:**

- [ ] `DD9A` Select 'Sites'.
  - **Expected:** A panel opens with 'Sites' at the top.
  - **Notes:**

- [ ] `1FAD` Select the **⋯** button at the end of the row of 'Harbourside', then **Resubmit**.
  - **Expected:** 'Harbourside' has a yellow dot in its slot.
  - **Notes:**

- [ ] `71C1` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `1A24` Select the **Lists** page in the left-hand menu.
  - **Expected:** The table of lists shows.
  - **Notes:**

- [ ] `EE37` Select 'Sites'.
  - **Expected:** A panel opens with 'Sites' at the top.
  - **Notes:**

- [ ] `2D66` Select the **⋯** button beside 'Sites' at the top of the panel, then **Approve…**.
  - **Expected:**
    - A dialog titled "Approve 2 drafts?" opens.
    - Under "Also approves the drafts these depend on:" it lists "the choice Harbourside in Sites".
  - **Notes:**

- [ ] `52C7` Select **Approve**.
  - **Expected:**
    - 'Harbourside' is the first choice.
    - 'Harbourside' has no dot and no box.
  - **Notes:**

**Afterwards:** Run Reset the Database.

### DRAFT-22: Drafts That Others Use Cannot Be Discarded

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-21.

**Preconditions:** Reset the Database run after DRAFT-21. Signed in with this account. **Lists** page open.

- [ ] `2F53` Select 'Skills'.
  - **Expected:**
    - A panel opens.
    - 'Rust' has a yellow dot in its slot.
    - 'TypeScript' has a yellow dot in its slot.
  - **Notes:**

- [ ] `CAE8` Select the **⋯** button at the end of the row of 'Rust', then **Discard draft**.
  - **Expected:**
    - A red notice reads "This choice can't be discarded while other drafts depend on it. Discard those drafts, or change them so they no longer use it, then try again."
    - 'Rust' still has a yellow dot in its slot.
  - **Notes:**

### DRAFT-23: A New List Is Rejected Only With the Drafts That Use It

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from DRAFT-22.

**Preconditions:** As DRAFT-22, signed in with this account instead. **Lists** page open.

- [ ] `DC93` Select 'Skills'.
  - **Expected:** A panel opens with 'Skills' at the top.
  - **Notes:**

- [ ] `33FA` Select the **⋯** button beside 'Skills' at the top of the panel, then **Reject…**.
  - **Expected:**
    - A dialog titled "Reject 5 drafts?" opens.
    - Under "Also rejects the drafts that use these:" it lists "Silje Holm-Schrøder", "the column Skills", "the choice Rust in Skills" and "the choice TypeScript in Skills".
    - It has a **Reason** box.
  - **Notes:**

- [ ] `3D12` Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] `9AAC` Close the panel.
  - **Expected:**
    - The panel closes.
    - 'Skills' still has a yellow dot in its slot.
  - **Notes:**

### DRAFT-24: A Person's Draft Is Approved With the New List, Column and Choice It Uses

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-23.

**Preconditions:** As DRAFT-23. **Drafts** page open.

- [ ] `6BF4` Search for `Silje Skills`.
  - **Expected:** One row is shown:
    - **Record** reads 'Silje Holm-Schrøder'.
    - **What changes** reads **Skills** set to `Rust`.
    - **Made by** reads "Engineering Operations Manager".
  - **Notes:**

- [ ] `BEC2` Tick that row's tick box.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `C3F3` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:**
    - A dialog titled "Approve 4 drafts?" opens.
    - Under "Also approves the drafts these depend on:" it lists "the column Skills", "the list Skills" and "the choice Rust in Skills".
  - **Notes:**

- [ ] `FB2C` Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notice reads "Approved 4 drafts."
    - The table reads "No matching drafts".
    - No buttons at the right of the page's heading.
  - **Notes:**

**Afterwards:** Run Reset the Database.

### DRAFT-25: Drafts This Account Changed Need Another Approver

**Account:** Project Manager, `project.manager@fathom.test`, changed from DRAFT-24. Step `B553` signs in as another account.

**Preconditions:** Run Reset the Database first. Signed in with this account. **Features** page open from the left-hand menu.

- [ ] `5C1A` In the row 'Scheduler API', select the **Name** cell, replace its text with `Scheduler Service`, then press Enter.
  - **Expected:**
    - The cell reads `Scheduler Service`, with a hollow yellow dot before it.
    - The top bar shows **Publish 1 change**.
  - **Notes:**

- [ ] `6E2B` Select **Publish 1 change** in the top bar.
  - **Expected:** The top bar no longer offers to publish.
  - **Notes:**

- [ ] `8A3F` Select the **⋯** button at the end of the row of `Scheduler Service`.
  - **Expected:**
    - **Approve…** is greyed out.
    - "Needs another approver" is under it, easy to read.
    - **Reject…** is not greyed out.
  - **Notes:**

- [ ] `3CBD` Press Escape.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `7DEE` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - A row's **Record** reads `Scheduler Service`.
    - After it, a grey box reads "Needs another approver".
    - Its **Made by** reads "Project Manager".
  - **Notes:**

- [ ] `4F66` Tick that row's tick box.
  - **Expected:**
    - At the right of the page's heading: "1 chosen draft needs another approver.", then **Reject…** and **Approve 1 draft…**.
    - **Approve 1 draft…** is greyed out.
    - **Reject…** is not greyed out.
  - **Notes:**

- [ ] `B553` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `9FAB` Select the **Drafts** page in the left-hand menu.
  - **Expected:** A row's **Record** reads `Scheduler Service`, with no box after it.
  - **Notes:**

- [ ] `9D15` Tick the tick box of the row of `Scheduler Service`.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `561B` Select **Approve 1 draft…**.
  - **Expected:**
    - A dialog opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] `E72D` Select **Approve** in the dialog.
  - **Expected:** A notice reads "Approved 1 draft."
  - **Notes:**

**Afterwards:** Run Reset the Database.

### DRAFT-26: A Row With a Draft Ends With One Menu Button

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-25.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `17CA` In the search box above the table, type `Simone Jean`.
  - **Expected:**
    - Her row is tinted faint yellow.
    - A yellow dot before her **Manager**.
    - A light green Live row is under it.
  - **Notes:**

- [ ] `CDD2` Scroll the table all the way to the right, and read the end of that row.
  - **Expected:**
    - The row ends with one **⋯** button.
    - Nothing is beside it.
  - **Notes:**

### DRAFT-27: Drafts Are Grouped and Counted by Area

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-26.

**Preconditions:** Run Reset the Database first. Signed in with this account. **Drafts** page open from the left-hand menu, with **All drafts** chosen beside the page's title.

- [ ] `3A91` In the Group by menu, select **Area**.
  - **Expected:**
    - The button reads **Group by: Area**.
    - Group headings read "People", "Planned hires", "Feature teams", "Configuration", "The plan or configuration", "Features and releases" and "The plan".
    - The heading "The plan or configuration" counts 1.
    - The heading "Features and releases" counts 6.
  - **Notes:**

- [ ] `E567` In the Group by menu, select **Made by** under **Then by**.
  - **Expected:**
    - The button reads **Group by: Area, then Made by**.
    - Under "The plan or configuration", one smaller, set-in heading reads "Engineering Operations Manager", counting 1.
    - Under "Features and releases", one smaller, set-in heading reads "Product Manager", counting 6.
  - **Notes:**

- [ ] `7C55` Select **Metrics**, then **Area** under **Break down by**.
  - **Expected:**
    - A **Metrics** panel opens beside the table.
    - Its table has the columns **Area**, **Drafts** and **Share**.
    - Its row "Features and releases" reads 6 under **Drafts**.
    - Its row "The plan or configuration" reads 1 under **Drafts**.
  - **Notes:**

**Afterwards:** Open the Views menu, and select **Clear view**.

### DRAFT-28: To Decide Shows Only the Drafts This Role Can Decide Now

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-27.

**Preconditions:** Signed in with this account. **Drafts** page open from the left-hand menu.

- [ ] `042E` Read the tabs beside the page's title.
  - **Expected:**
    - **To decide** comes first, chosen, followed by a dimmed 32.
    - **Not published** comes second, followed by a dimmed 0.
    - **All drafts** comes third.
  - **Notes:**

- [ ] `57A5` Read the table.
  - **Expected:**
    - Beside the buttons above the table, the count reads "32 drafts".
    - No row's **State** reads "Rejected".
    - No row's **Record** reads 'Viktoria Holmberg'.
    - No row's **Type** reads "Order of choices" with **Record** 'Sites'.
  - **Notes:**

- [ ] `363B` Select the **Record** cell of the first row, away from its tick box.
  - **Expected:** The cell is outlined, and its row's tick box is not ticked.
  - **Notes:**

- [ ] `4528` Press Space.
  - **Expected:**
    - That row's tick box is ticked.
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
    - The **Record** cell still has focus.
  - **Notes:**

- [ ] `F554` Press Space again.
  - **Expected:**
    - That row's tick box is not ticked.
    - No buttons at the right of the page's heading.
  - **Notes:**

- [ ] `7B1B` Tick the tick box before **Record** in the table's header.
  - **Expected:**
    - Every row is ticked.
    - At the right of the page's heading: **Reject…** and **Approve 32 drafts…**.
  - **Notes:**

- [ ] `8AA9` Untick the tick box before **Record** in the table's header.
  - **Expected:**
    - No row is ticked.
    - No buttons at the right of the page's heading.
  - **Notes:**

### DRAFT-29: A Draft's Details Show What Comes With It and Lead to Its Record

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-28.

**Preconditions:** Run Reset the Database first. Signed in with this account. **Drafts** page open from the left-hand menu.

- [ ] `0A9E` Search for `Silje Skills`.
  - **Expected:** One row is shown, whose **Record** reads 'Silje Holm-Schrøder'.
  - **Notes:**

- [ ] `71D2` Point at that row, and select the details button that shows at the right of its **Record** cell.
  - **Expected:** A details panel opens beside the table:
    - Its title is a yellow dot, then 'Silje Holm-Schrøder'.
    - Under **Details**, **Change** reads "Changed".
    - **State** reads "Waiting".
    - **What changes** reads **Skills** set to `Rust`.
    - **Type** reads "Person".
    - **Area** reads "People".
    - **Made by** reads "Engineering Operations Manager".
    - **Drafted** reads today's date.
    - **Reason** reads "None".
    - Under **Approved with it**, **Drafts** reads "the column Skills", "the list Skills" and "the choice Rust in Skills", one to a line.
    - Under them come the buttons **Approve…** and **Reject…**, then the link **Show on People**.
  - **Notes:**

- [ ] `9BE7` Select **Show on People**.
  - **Expected:**
    - The **People** page opens.
    - The details of 'Silje Holm-Schrøder' are open beside the table.
  - **Notes:**

- [ ] `26F0` Select the browser's Back button.
  - **Expected:**
    - The **Drafts** page shows, with only the row of 'Silje Holm-Schrøder'.
    - Her draft's details are open beside the table.
  - **Notes:**

- [ ] `D29F` Clear the search box.
  - **Expected:**
    - The other drafts to decide are shown again.
    - The details of 'Silje Holm-Schrøder' stay open.
  - **Notes:**

- [ ] `B9A7` Select **All drafts** beside the page's title.
  - **Expected:** The details panel closes.
  - **Notes:**

- [ ] `53B1` Search for `Harbourside`.
  - **Expected:** A row's **Record** reads 'Harbourside in Sites', after a red dot in a ring.
  - **Notes:**

- [ ] `5374` Select the details button of that row.
  - **Expected:**
    - **State** reads "Rejected".
    - **Reason** reads "Fictional reason: leave Positions and Sites as they are until both are reviewed."
    - Under **Waiting on it**, **Draft** reads "the new order for Sites".
    - There are no **Approve…** or **Reject…** buttons.
    - A dimmed line reads "Back with Engineering Operations Manager to change and resubmit."
    - Under it comes the link **Show on Lists**.
  - **Notes:**

- [ ] `D238` Press Esc.
  - **Expected:**
    - The details panel closes.
    - The **Record** cell of 'Harbourside in Sites' has focus.
  - **Notes:**

### DRAFT-30: Not Published Shows One's Own Unpublished Changes

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-29.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account. **Drafts** page open from the left-hand menu.

- [ ] `A627` Read the tabs beside the page's title.
  - **Expected:**
    - **Not published** comes first, chosen, followed by a dimmed 3.
    - **All drafts** comes second.
    - There is no **To decide** tab.
  - **Notes:**

- [ ] `191C` Read the table.
  - **Expected:**
    - Three rows are shown, whose **Record** reads 'Laptop in Equipment', 'Equipment' and 'Mariana Metz', each after a hollow yellow dot.
    - Each row's **State** reads "Not published".
    - There is no **Made by** column.
  - **Notes:**

- [ ] `A6C5` Select the details button of the row of 'Mariana Metz'.
  - **Expected:**
    - The details panel has no **Made by** row.
    - There is no **Linked to** section.
    - A dimmed line reads "Nobody else sees these changes until they're published."
    - Under it comes the link **Show on People**.
  - **Notes:**

- [ ] `6CC0` Select the details button of the row of 'Equipment'.
  - **Expected:**
    - The details panel's title reads 'Equipment'.
    - Under **Linked to**, **Change** reads 'Laptop in Equipment', as a link.
  - **Notes:**

- [ ] `2043` Select the link 'Laptop in Equipment'.
  - **Expected:**
    - The details panel's title reads 'Laptop in Equipment'.
    - Under **Linked to**, **Change** reads 'Equipment', as a link.
  - **Notes:**

- [ ] `81E6` Select **All drafts**.
  - **Expected:**
    - The details panel closes.
    - No row's **Record** reads 'Mariana Metz' with **State** "Not published".
  - **Notes:**

### DRAFT-31: Changes That Depend on Each Other Are Published or Discarded Together

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account DRAFT-30 ended with.

**Preconditions:** DRAFT-30 done. **Drafts** page open, on **All drafts**.

- [ ] `238A` Select **Not published**.
  - **Expected:**
    - Each row starts with a tick box.
    - No buttons at the right of the page's heading.
  - **Notes:**

- [ ] `215A` Point at the tick box of the row of 'Equipment'.
  - **Expected:** A tip reads "Linked to the change to Laptop in Equipment".
  - **Notes:**

- [ ] `5F16` Tick the row of 'Equipment'.
  - **Expected:**
    - The rows of 'Equipment' and 'Laptop in Equipment' are both ticked.
    - At the right of the page's heading: **Discard 2 changes…** and **Publish 2 changes**.
  - **Notes:**

- [ ] `8219` Untick the row of 'Laptop in Equipment'.
  - **Expected:**
    - Neither row is ticked.
    - No buttons at the right of the page's heading.
  - **Notes:**

- [ ] `0837` Tick the row of 'Mariana Metz'.
  - **Expected:**
    - Only her row is ticked.
    - At the right of the page's heading: **Discard 1 change…** and **Publish 1 change**.
  - **Notes:**

- [ ] `6CE5` Select **Discard 1 change…**.
  - **Expected:**
    - A dialog titled "Discard 1 change?" opens.
    - It reads "The chosen change is discarded. This cannot be undone."
  - **Notes:**

- [ ] `56BF` Select **Cancel**.
  - **Expected:**
    - The dialog closes.
    - Her row is still ticked.
  - **Notes:**

- [ ] `BABE` Untick the row of 'Mariana Metz'.
  - **Expected:** No buttons at the right of the page's heading.
  - **Notes:**

- [ ] `1F4C` Tick the row of 'Laptop in Equipment'.
  - **Expected:**
    - The rows of 'Equipment' and 'Laptop in Equipment' are both ticked.
    - The buttons read **Discard 2 changes…** and **Publish 2 changes**.
  - **Notes:**

- [ ] `D3B5` Select **Publish 2 changes**.
  - **Expected:**
    - A notice reads "Published 2 changes."
    - The table shows one row, 'Mariana Metz'.
    - **Not published** is followed by a dimmed 1.
    - The top bar reads **Publish 1 change**.
  - **Notes:**

- [ ] `80E4` Select **All drafts**.
  - **Expected:** Rows for 'Equipment' and 'Laptop in Equipment' are listed, each after a solid yellow dot.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.
