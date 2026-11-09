---
title: "Manual Test: Drafts of People, Lists and Columns"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-08"
---

# Manual Test: Drafts of People, Lists and Columns

## Scope

Verifies how drafts of people, columns, lists, choices, and choice orders are shown on the People, Lists and Drafts pages, and what a Workforce Administrator, an Engineering Director and a Project Manager can do with them, including drafts that use drafts of another kind, and that nobody approves drafts they changed unless their role grants it, as [Roles](../product/roles.md#what-each-role-can-do) sets out, shown here with a release's draft.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1 and R2).

## Test Accounts

R1 creates these accounts, with every other development account, so they exist once R1 has run. They share one password, which R1 prints when it finishes. Each account must hold its role as Fathom starts it: if any role has been changed on the **Roles** page, reset the database (R2) before the first test case, since restoring the seed data (R1) does not put roles back.

- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It holds the Workforce Administrator role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Engineering Director account:** `engineering.director@fathom.test`, shown in Fathom as **Engineering Director**. It holds the Engineering Director role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Project Manager account:** `project.manager@fathom.test`, shown in Fathom as **Project Manager**. It holds the Project Manager role, as [Roles](../product/roles.md#starting-roles) sets out.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at `https://localhost:8443`, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R1: Restore the Seed Data

Use after R0, before the first test case, and wherever a test case says so. Fathom keeps running. This removes the seed data and every draft of it, including drafts made during the test, then adds the seed data again; it keeps accounts and anything else added by hand. It cannot restore the seed data once its drafts have been approved, as in DRAFT-20, DRAFT-21 and DRAFT-24; use R2 then.

1. In the second terminal, run:

   ```sh
   pnpm db:reseed
   ```

2. Confirm that the last line printed gives the shared password, with no error above it.
3. Reload the browser page.

### R2: Reset the Database

Use only where a test case says so. This deletes every account and record in the development database, including anything added by hand. Ask the owner before running it on a database others use.

1. Stop Fathom: press Ctrl+C in the first terminal.
2. In the second terminal, run:

   ```sh
   pnpm db:reset && pnpm db:seed
   ```

3. Confirm that the last line printed gives the shared password, with no error above it.
4. Start Fathom again (R0).
5. Sign in again with the account the test case names.

## Terms

- **Mark:** a coloured dot followed by a word, such as a yellow dot and **Draft**, shown beside a record's name or under a column's name.
- **Draft menu:** the menu that opens from the **Draft** button above a table, next to the search box.
- **Column menu:** the menu that opens when you select a column's name in the People table's header.
- **⋯ menu:** the menu that opens from a **⋯** button, at the end of a row, or beside a list's name at the top of its panel.

## Test Cases

Run the test cases in order. Start with R0, then R1. Check each step whose expected result you see, and write anything else under its notes.

### DRAFT-01: Column Drafts Are Marked in the People Table

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] **Step 1.** Look at the **Grade** column header.
  - **Expected:** The column is tinted blue. Under its name is a yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 2.** Look at the column to the right of **Grade**.
  - **Expected:** A light green column named **Level**, with a green dot and **Live** under its name, shows each person's current level.
  - **Notes:**

- [ ] **Step 3.** Look at the **Role on team** column header.
  - **Expected:** The name is struck through, with a yellow dot and **Draft: removed** under it.
  - **Notes:**

- [ ] **Step 4.** Look at the last two column headers.
  - **Expected:** **Previous site**, with a red dot and **Rejected** under it, then **Skills**, with a yellow dot and **Draft: added** under it.
  - **Notes:**

### DRAFT-02: A Workforce Administrator Can Discard Column Drafts but Not Approve Them

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DRAFT-01.

**Preconditions:** As DRAFT-01.

- [ ] **Step 1.** Select the **Grade** column name to open its column menu.
  - **Expected:** Under **Grade** and a divider, a yellow dot and **Draft** heads two lines: **Name** from **Level** to **Grade**, by Engineering Operations Manager; **Required** from **No** to **Yes**, by Second Engineering Operations Manager.
  - **Notes:**

- [ ] **Step 2.** Look at the actions in the menu.
  - **Expected:** **Discard draft** is among them. **Approve…** and **Reject…** are not.
  - **Notes:**

- [ ] **Step 3.** Press Esc. Select the **Draft** button above the table.
  - **Expected:** The Draft menu has a **Show** section and a **Filter** section.
  - **Notes:**

- [ ] **Step 4.** Select the **Show** heading in the menu.
  - **Expected:** The menu closes.
  - **Notes:**

### DRAFT-03: Drafts Applied Shows the People Table as It Will Be

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DRAFT-02.

**Preconditions:** As DRAFT-01.

- [ ] **Step 1.** Open the Draft menu, and select **Drafts applied**.
  - **Expected:** The columns are Name, ID, Position, Site, Grade, Onboarding, State, Start, Expected, End, Manager, Manager?, Manager since, Team, Team name, Skills. No row or column has a green dot and **Live**.
  - **Notes:**

- [ ] **Step 2.** Select **Drafts beside live**.
  - **Expected:** The light green **Level** column, with a green dot and **Live**, is back to the right of **Grade**.
  - **Notes:**

### DRAFT-04: Live Only Shows the People Table as It Is Now

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DRAFT-03.

**Preconditions:** As DRAFT-01.

- [ ] **Step 1.** Open the Draft menu, and select **Live only**.
  - **Expected:** The columns are Name, ID, Position, Site, Level, Role on team, Onboarding, State, Start, Expected, End, Manager, Manager?, Manager since, Team, Team name. No column or row has a mark.
  - **Notes:**

- [ ] **Step 2.** Open the Draft menu.
  - **Expected:** The filter section is headed **Filter (needs drafts shown)**, and its choices are greyed out.
  - **Notes:**

- [ ] **Step 3.** Select **Drafts beside live**.
  - **Expected:** The light green **Level** column, with a green dot and **Live**, is back to the right of **Grade**.
  - **Notes:**

### DRAFT-05: A Rejected Column Draft Offers Nothing to Decide

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from DRAFT-04.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Select the **Previous site** column name to open its column menu.
  - **Expected:** Under a red dot and **Rejected**, it shows **Reason: Fictional reason: a previous site is not needed yet.** It has no **Approve…** or **Reject…**.
  - **Notes:**

### DRAFT-07: A Rejected Person's Draft Offers Nothing to Decide

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-05.

**Preconditions:** As DRAFT-05.

- [ ] **Step 1.** Open the Draft menu, and under **Filter** select **Rejected**.
  - **Expected:** Two people are shown, each with a red dot and **Rejected**: **우아현** (Employee ID E10004), with a light green **Live** row under her, and **Ophélie Roussel** (Employee ID E10152).
  - **Notes:**

- [ ] **Step 2.** Press Esc. Open the Draft menu, and select **Rejected** again.
  - **Expected:** All people are shown again.
  - **Notes:**

### DRAFT-08: List Drafts Are Marked on the Lists Page

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-07.

**Preconditions:** Signed in with this account. **Lists** page open from the left-hand menu.

- [ ] **Step 1.** Read the mark beside each list's name.
  - **Expected:** Certifications: **Draft: removed**, with the name struck through. Languages: **Draft: retired**. Levels: **Draft: reordered**. Positions: **Draft**. Roles on teams: **Draft**. Sites: **Draft**. Skills: **Draft: added**. Each has a yellow dot. Hiring states has no mark.
  - **Notes:**

- [ ] **Step 2.** Look at the row under each list.
  - **Expected:** Each list except Certifications and Skills has a light green row under it with a green dot and **Live**.
  - **Notes:**

- [ ] **Step 3.** Read the Choices column of the **Positions** row with the yellow dot.
  - **Expected:** **(6)** Engineering Manager, Employee, Manager, Software Engineer, Test Engineer, SDET, and **Architect** struck through.
  - **Notes:**

### DRAFT-09: A New Order That Depends on a Rejected Choice Cannot Be Approved

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-08.

**Preconditions:** As DRAFT-08.

- [ ] **Step 1.** Select **Sites** in the row with the yellow dot.
  - **Expected:** A panel opens with **Sites** at the top and a yellow dot and **Draft: reordered** under it. **Harbourside** is the first choice, with a red dot and **Rejected**. **Northmere Labs** has a yellow dot and **Draft**, with a light green row under it reading **Northmere**, with a green dot and **Live**.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button beside **Sites** at the top of the panel.
  - **Expected:** The menu shows **Sites**, a divider, a yellow dot and **Draft: reordered**, and **Reordered by Engineering Operations Manager**. **Approve…** is greyed out, with **Waiting for a rejected draft to be resubmitted** under it. **Reject…** can be selected.
  - **Notes:**

- [ ] **Step 3.** Press Esc, then close the panel with the **×** button at its top right.
  - **Expected:** The menu and the panel close.
  - **Notes:**

### DRAFT-10: Rejected List Drafts Offer Nothing to Decide

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-09.

**Preconditions:** As DRAFT-08.

- [ ] **Step 1.** Select **Positions** in the row with the yellow dot.
  - **Expected:** A panel opens with **Positions** at the top and two red dots, each with **Rejected**, under it. **Architect** is struck through, with a yellow dot and **Draft: removed**.
  - **Notes:**

- [ ] **Step 2.** Close the panel.
  - **Expected:** The panel closes.
  - **Notes:**

### DRAFT-11: Drafts Applied Shows the Lists as They Will Be

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-10.

**Preconditions:** As DRAFT-08.

- [ ] **Step 1.** Open the Draft menu, and select **Drafts applied**.
  - **Expected:** The count beside the search box reads **9 lists**. Certifications and Languages are not in the table. No row has a green dot and **Live**.
  - **Notes:**

- [ ] **Step 2.** Select **Drafts beside live**.
  - **Expected:** The table is as in DRAFT-08.
  - **Notes:**

### DRAFT-12: The Drafts Page Describes New Orders

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-11.

**Preconditions:** Signed in with this account. **Drafts** page open from the left-hand menu.

- [ ] **Step 1.** Type **new order** in the search box.
  - **Expected:** Three entries are shown: **drafted a new order for Levels**, **drafted a new order for Positions** and **drafted a new order for Sites**.
  - **Notes:**

- [ ] **Step 2.** Read the **Sites** entry.
  - **Expected:** It reads **From Kestrel Bay, Northmere, Ashgrove, Corran Quay to Harbourside, Kestrel Bay, Northmere Labs, Ashgrove, Corran Quay**. Its checkbox is greyed out, with **Waiting for a rejected draft to be resubmitted** under it.
  - **Notes:**

- [ ] **Step 3.** Clear the search box.
  - **Expected:** All drafts are shown again.
  - **Notes:**

### DRAFT-13: Rejected Drafts Cannot Be Selected on the Drafts Page

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-12.

**Preconditions:** As DRAFT-12.

- [ ] **Step 1.** Type **Rejected** in the search box.
  - **Expected:** Six entries are shown, each with a red dot and **Rejected** and its reason: the column Previous site, the list Positions, the new order for Positions, the choice Harbourside in Sites, 우아현, and Ophélie Roussel.
  - **Notes:**

- [ ] **Step 2.** Try to select the checkbox of each entry.
  - **Expected:** None can be selected.
  - **Notes:**

- [ ] **Step 3.** Clear the search box.
  - **Expected:** All drafts are shown again.
  - **Notes:**

### DRAFT-15: Unpublished Changes Are Seen Only by the Person Who Made Them

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-13. Step 4 signs in as another account.

**Preconditions:** R1. Signed in with this account. **People** page open.

- [ ] **Step 1.** Look at the top bar, beside your name.
  - **Expected:** It shows **Publish 3 changes**, with a **⋯** button beside it.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button beside **Publish 3 changes**.
  - **Expected:** The menu shows **Your unpublished changes**, a divider, **Only you see these until you publish them.**, then **Added** the choice Laptop in Equipment, **Added** the list Equipment and **Changed** Mariana Metz, then **Discard all…**.
  - **Notes:**

- [ ] **Step 3.** Press Esc. Type **Mariana Metz** in the search box above the table.
  - **Expected:** Her row has a hollow yellow dot and **Draft**, with no **Unpublished** mark. Her **Site** cell is yellow.
  - **Notes:**

- [ ] **Step 4.** Sign in as the Engineering Director, `engineering.director@fathom.test`, open **People**, and type **Mariana Metz** in the search box.
  - **Expected:** Her row has a grey dot and **Being changed**, and no **Draft** mark, and her **Site** cell is not yellow. The top bar shows no **Publish** button.
  - **Notes:**

### DRAFT-16: A Record Someone Else Is Changing Is Held

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-15.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Type **Viktoria Holmberg** in the search box above the table.
  - **Expected:** Her row has a yellow dot and **Draft**, and a grey dot and **Being changed**.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button at the end of her row.
  - **Expected:** The menu says **Being changed by Second Engineering Operations Manager. It can be changed once they publish or discard their changes.** It has no **Discard draft** or **Remove person**.
  - **Notes:**

### DRAFT-17: Changing a Published Draft Keeps Others Seeing It as Published

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DRAFT-16. Step 2 signs in as another account.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Type **E10002** in the search box. Select that person's **ID** cell, type **E20002**, and press Enter.
  - **Expected:** The cell reads **E20002** and is yellow. The row has a hollow yellow dot and **Draft**, with no **Unpublished** mark. The top bar shows **Publish 4 changes**.
  - **Notes:**

- [ ] **Step 2.** Sign in as the Engineering Director, `engineering.director@fathom.test`, open **People**, and type **E10002** in the search box.
  - **Expected:** The row still reads **E10002**, with a yellow dot and **Draft**, and a grey dot and **Being changed**.
  - **Notes:**

### DRAFT-18: Publishing Shows the Changes to Everyone

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-17. Step 3 signs in as another account.

**Preconditions:** DRAFT-17 done. Signed in with this account. **People** page open.

- [ ] **Step 1.** Select **Publish 4 changes** in the top bar: the three changes the seed data holds, and the one from DRAFT-17.
  - **Expected:** A notice reads **Published 4 changes.** The **Publish** button is gone from the top bar.
  - **Notes:**

- [ ] **Step 2.** Type **Mariana Metz** in the search box.
  - **Expected:** Her row has a solid yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 3.** Sign in as the Engineering Director, `engineering.director@fathom.test`, open **People**, and type **Mariana Metz** in the search box.
  - **Expected:** Her row has a yellow dot and **Draft**, and her **Site** cell is yellow.
  - **Notes:**

**Afterwards:** R1.

### DRAFT-19: Discard All Removes Every Unpublished Change

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-18.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] **Step 1.** Select the **⋯** button beside **Publish 3 changes**, then **Discard all…**.
  - **Expected:** A dialog titled **Discard 3 changes?** says **Your unpublished changes are deleted. This cannot be undone.**
  - **Notes:**

- [ ] **Step 2.** Select **Discard**.
  - **Expected:** A notice reads **Discarded 3 changes.** The **Publish** button is gone from the top bar.
  - **Notes:**

### DRAFT-20: All Waiting Drafts Can Be Approved From the Drafts Page

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from DRAFT-19.

**Preconditions:** R2. Signed in with this account. **Drafts** page open.

- [ ] **Step 1.** Select **Select all waiting**.
  - **Expected:** The button at the top right reads **Approve 19 drafts**. The **Sites** new order entry, and the **Viktoria Holmberg** entry, are not selected.
  - **Notes:**

- [ ] **Step 2.** Select **Approve 19 drafts**, then **Approve** in the dialog titled **Approve 19 drafts?**.
  - **Expected:** The dialog closes, and a notice reads **Approved 19 drafts.**
  - **Notes:**

### DRAFT-21: A Resubmitted Choice Is Approved With the New Order That Depends on It

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-20. Step 2 signs in as another account.

**Preconditions:** R2. Signed in with this account.

- [ ] **Step 1.** Open **Lists**, then **Sites**. Select the **⋯** button at the end of the **Harbourside** row, then **Resubmit**.
  - **Expected:** **Harbourside** has a yellow dot and **Draft: added**.
  - **Notes:**

- [ ] **Step 2.** Sign in as the Engineering Director, `engineering.director@fathom.test`. Open **Lists**, then **Sites**. Select the **⋯** button beside **Sites** at the top of the panel, then **Approve…**.
  - **Expected:** A dialog titled **Approve 2 drafts?** opens. Under **Also approves the drafts these depend on:** it lists *the choice Harbourside in Sites*.
  - **Notes:**

- [ ] **Step 3.** Select **Approve**.
  - **Expected:** **Harbourside** is the first choice, with no mark. The **Draft: reordered** mark under **Sites** is gone.
  - **Notes:**

**Afterwards:** R2.

### DRAFT-22: Drafts That Others Use Cannot Be Discarded

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-21.

**Preconditions:** R2 done after DRAFT-21. Signed in with this account. **Lists** page open.

- [ ] **Step 1.** Select **Skills** in the row with the yellow dot.
  - **Expected:** A panel opens. **Rust** and **TypeScript** each have a yellow dot and **Draft: added**.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button at the end of the **Rust** row, then **Discard draft**.
  - **Expected:** A red notice reads **This choice can't be discarded while other drafts depend on it. Discard those drafts, or change them so they no longer use it, then try again.**. **Rust** still has a yellow dot and **Draft: added**.
  - **Notes:**

### DRAFT-23: A New List Is Rejected Only With the Drafts That Use It

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from DRAFT-22.

**Preconditions:** As DRAFT-22, signed in with this account instead. **Lists** page open.

- [ ] **Step 1.** Select **Skills** in the row with the yellow dot, then the **⋯** button beside **Skills** at the top of the panel, then **Reject…**.
  - **Expected:** A dialog titled **Reject 5 drafts?** opens. Under **Also rejects the drafts that use these:** it lists *Silje Holm-Schrøder*, *the column Skills*, *the choice Rust in Skills* and *the choice TypeScript in Skills*. It has a **Reason** box.
  - **Notes:**

- [ ] **Step 2.** Select **Cancel**, then close the panel.
  - **Expected:** The dialog and the panel close. **Skills** still has a yellow dot and **Draft: added**.
  - **Notes:**

### DRAFT-24: A Person's Draft Is Approved With the New List, Column and Choice It Uses

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as DRAFT-23.

**Preconditions:** As DRAFT-23. **Drafts** page open.

- [ ] **Step 1.** Type **Silje Skills** in the search box.
  - **Expected:** One entry is shown: **Engineering Operations Manager drafted changes to Silje Holm-Schrøder: Skills set to Rust**.
  - **Notes:**

- [ ] **Step 2.** Select the entry's checkbox, then **Approve**.
  - **Expected:** A dialog titled **Approve 4 drafts?** opens. Under **Also approves the drafts these depend on:** it lists *the column Skills*, *the list Skills* and *the choice Rust in Skills*.
  - **Notes:**

- [ ] **Step 3.** Select **Approve**.
  - **Expected:** The dialog closes, and a notice reads **Approved 4 drafts.** The page says **No drafts match the search.**
  - **Notes:**

**Afterwards:** R2.

### DRAFT-25: Drafts This Account Changed Need Another Approver

**Account:** Project Manager, `project.manager@fathom.test`, changed from DRAFT-24. Step 7 signs in as another account.

**Preconditions:** R2. Signed in with this account. **Releases** page open from the left-hand menu, with **Platform** selected in the streams table.

- [ ] **Step 1.** Under **Releases** in the side panel, select the **⋯** button at the end of the **Harbor 3** row, then **Change…**.
  - **Expected:** A dialog titled **Change Harbor 3** opens, with **Harbor 3** in **Name**.
  - **Notes:**

- [ ] **Step 2.** Replace the name with `Harbor Three`, and select **Save**.
  - **Expected:** The dialog closes. **Harbor Three** is followed by a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 3.** Select **Publish 1 change** in the top bar.
  - **Expected:** The top bar no longer offers to publish.
  - **Notes:**

- [ ] **Step 4.** Select the **⋯** button at the end of the **Harbor Three** row.
  - **Expected:** **Approve…** is greyed out, with **Changed by this account, so another approver must approve it** under it, easy to read. **Reject…** is not greyed out.
  - **Notes:**

- [ ] **Step 5.** Press Escape, then select **Drafts** in the left-hand menu.
  - **Expected:** An entry names **Harbor Three**, drafted by **Project Manager**.
  - **Notes:**

- [ ] **Step 6.** Select that entry's checkbox.
  - **Expected:** **Approve 1 draft** is greyed out, and **Reject…** is not, with a line under them saying another approver must approve it.
  - **Notes:**

- [ ] **Step 7.** Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** Fathom opens.
  - **Notes:**

- [ ] **Step 8.** Select **Drafts** in the left-hand menu, select the **Harbor Three** entry's checkbox, then **Approve 1 draft**, then **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 1 draft.**
  - **Notes:**

**Afterwards:** R2.

### DRAFT-26: A Row With a Draft Ends With One Menu Button

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-25.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] **Step 1.** In the search box above the table, type **Simone Jean**.
  - **Expected:** Her row shows, tinted blue, with a yellow dot and **Draft** after her name, and a row in grey under it with a green dot and **Live**.
  - **Notes:**

- [ ] **Step 2.** Scroll the table all the way to the right, and read the end of that row.
  - **Expected:** The row ends with one **⋯** button, with nothing beside it.
  - **Notes:**
