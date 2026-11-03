---
title: "Manual Test: Drafts of People, Lists and Columns"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-02"
---

# Manual Test: Drafts of People, Lists and Columns

## Scope

Verifies how drafts of people, columns, lists, choices, and column and choice orders are shown on the People, Lists and Drafts pages, and what a Workforce Administrator and an Approver can do with them.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1 and R2).

## Test Accounts

R1 creates these accounts, with every other development account, so they exist once R1 has run. They share one password, which R1 prints when it finishes.

- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It can change people, lists and columns, and its changes are drafts; it cannot approve them.
- **Approver account:** `engineering.director@fathom.test`, shown in Fathom as **Engineering Director**. It can approve and reject drafts; it cannot change people, lists or columns.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at `https://localhost:8443`, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R1: Restore the Seed Data

Use after R0, before the first test case, and wherever a test case says so. Fathom keeps running. This removes the seed data and every draft of it, including drafts made during the test, then adds the seed data again; it keeps accounts and anything else added by hand. It cannot restore the seed data once its drafts have been approved, as in DRAFT-26 and DRAFT-27; use R2 then.

1. In the second terminal, run:

   ```sh
   pnpm db:unseed && pnpm db:seed
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
5. Sign in again (P1).

### P1: Sign In

1. If someone is signed in, sign out first (P2).
2. On the **Sign in** page, enter the account's email address and the shared password.
3. Select **Sign in**.

### P2: Sign Out

1. Select the account button at the top right, which shows the account's name.
2. Select **Sign out**.

## Terms

- **Mark:** a coloured dot followed by a word, such as a yellow dot and **Draft**, shown beside a record's name or under a column's name.
- **Draft menu:** the menu that opens from the **Draft** button above a table, next to the search box.
- **Column menu:** the menu that opens when you select a column's name in the People table's header.
- **⋯ menu:** the menu that opens from a **⋯** button, at the end of a row, or beside a list's name at the top of its panel.

## Test Cases

Run the test cases in order. Start with R0, then R1. Tick each step whose expected result you see, and write anything else under its notes.

### DRAFT-01: Column Drafts Are Marked in the People Table

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **People** page open from the left-hand menu.

- [ ] **Step 1.** Look at the **Grade** column header.
  - **Expected:** The column is tinted blue. Under its name are two marks: a yellow dot and **Draft**, and a yellow dot and **Draft: moved**.
  - **Notes:**

- [ ] **Step 2.** Look at the column to the right of **Grade**.
  - **Expected:** A light green column named **Level**, with a green dot and **Live** under its name, shows each person's current level.
  - **Notes:**

- [ ] **Step 3.** Look at the **Role on team** column header.
  - **Expected:** The name is struck through, with a yellow dot and **Draft: removed** under it.
  - **Notes:**

- [ ] **Step 4.** Look at the last column header.
  - **Expected:** It is **Previous site**, with a red dot and **Rejected** under it.
  - **Notes:**

- [ ] **Step 5.** Read the column headers from left to right.
  - **Expected:** Name, Employee ID, Grade, Level, Site, Position, Role on team, Start, End, Previous site.
  - **Notes:**

### DRAFT-02: A Workforce Administrator Can Discard Column Drafts but Not Approve Them

**Preconditions:** As DRAFT-01.

- [ ] **Step 1.** Select the **Grade** column name to open its column menu.
  - **Expected:** Under **Grade** and a divider, a yellow dot and **Draft** heads three lines: **Name** from **Level** to **Grade**, by Engineering Operations Manager; **Required** from **No** to **Yes**, by Second Engineering Operations Manager; **Moved** by Engineering Operations Manager.
  - **Notes:**

- [ ] **Step 2.** Look at the actions in the menu.
  - **Expected:** **Discard draft** and **Discard new order** are among them. **Approve…** and **Reject…** are not.
  - **Notes:**

- [ ] **Step 3.** Press Esc. Select the **Draft** button above the table.
  - **Expected:** The Draft menu has a **Show** section, a **Filter** section, and a **Reordered by Engineering Operations Manager** section with only **Discard new order**.
  - **Notes:**

- [ ] **Step 4.** Select the **Show** heading in the menu.
  - **Expected:** The menu closes.
  - **Notes:**

### DRAFT-03: Drafts Applied Shows the People Table as It Will Be

**Preconditions:** As DRAFT-01.

- [ ] **Step 1.** In the Draft menu, select **Drafts applied**.
  - **Expected:** The columns are Name, Employee ID, Grade, Site, Position, Start, End. No row or column has a green dot and **Live**.
  - **Notes:**

- [ ] **Step 2.** Open the Draft menu.
  - **Expected:** Under **Filter**, **Rejected** is greyed out and cannot be selected.
  - **Notes:**

- [ ] **Step 3.** Select **Drafts beside live**.
  - **Expected:** The columns are as in DRAFT-01, step 5.
  - **Notes:**

### DRAFT-04: Live Only Shows the People Table as It Is Now

**Preconditions:** As DRAFT-01.

- [ ] **Step 1.** In the Draft menu, select **Live only**.
  - **Expected:** The columns are Name, Employee ID, Site, Position, Level, Role on team, Start, End. No column or row has a mark.
  - **Notes:**

- [ ] **Step 2.** Open the Draft menu.
  - **Expected:** The filter section is headed **Filter (needs drafts shown)**, and its choices are greyed out.
  - **Notes:**

- [ ] **Step 3.** Select **Drafts beside live**.
  - **Expected:** The columns are as in DRAFT-01, step 5.
  - **Notes:**

### DRAFT-05: A Rejected Column Draft Offers Nothing to Decide

**Preconditions:** Signed in (P1) as `engineering.director@fathom.test`. **People** page open.

- [ ] **Step 1.** Select the **Previous site** column name to open its column menu.
  - **Expected:** Under a red dot and **Rejected**, it shows **Reason: Fictional reason: a previous site is not needed yet.** It has no **Approve…** or **Reject…**.
  - **Notes:**

### DRAFT-06: A Moved Column Is Decided Together With Its New Order

**Preconditions:** As DRAFT-05.

- [ ] **Step 1.** Open the **Grade** column menu.
  - **Expected:** It has the three lines from DRAFT-02, step 1, then one **Approve…** and one **Reject…**.
  - **Notes:**

- [ ] **Step 2.** Select **Approve…**.
  - **Expected:** A dialog titled **Approve 2 drafts?** opens. Under **These drafts are approved together:** it lists *the column Grade* and *the new order for People's columns*.
  - **Notes:**

- [ ] **Step 3.** Select **Cancel**.
  - **Expected:** The dialog closes. **Grade** still has its yellow **Draft** mark.
  - **Notes:**

- [ ] **Step 4.** Open the **Grade** column menu, and select **Reject…**.
  - **Expected:** A dialog titled **Reject 2 drafts?** opens. Under **These drafts are rejected together:** it lists the same two drafts, and it has a **Reason** box.
  - **Notes:**

- [ ] **Step 5.** Select **Cancel**.
  - **Expected:** The dialog closes. **Grade** still has its yellow **Draft** mark.
  - **Notes:**

### DRAFT-07: The New Column Order Can Be Approved on Its Own

**Preconditions:** As DRAFT-05.

- [ ] **Step 1.** Open the Draft menu.
  - **Expected:** It has a **Reordered by Engineering Operations Manager** section with **Approve new order…** and **Reject new order…**.
  - **Notes:**

- [ ] **Step 2.** Select **Approve new order…**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 3.** Select **Cancel**.
  - **Expected:** The dialog closes. **Grade** still has its **Draft: moved** mark.
  - **Notes:**

### DRAFT-08: All Waiting Drafts on People Can Be Approved at Once

**Preconditions:** As DRAFT-05.

- [ ] **Step 1.** Open the Draft menu.
  - **Expected:** Under **Waiting drafts** it offers **Approve 6 drafts…** and **Reject 6 drafts…**.
  - **Notes:**

- [ ] **Step 2.** Select **Approve 6 drafts…**.
  - **Expected:** A dialog titled **Approve 6 drafts?** opens, with only **Approving cannot be undone.** above its buttons.
  - **Notes:**

- [ ] **Step 3.** Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

### DRAFT-09: A Rejected Person's Draft Offers Nothing to Decide

**Preconditions:** As DRAFT-05.

- [ ] **Step 1.** In the Draft menu, under **Filter**, select **Rejected**.
  - **Expected:** Two people are shown, each with a red dot and **Rejected**: **우아현** (Employee ID E10004), with a light green **Live** row under her, and **Ophélie Roussel** (Employee ID E10152).
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button at the end of the **우아현** row.
  - **Expected:** Under a red dot and **Rejected**, the menu shows **Reason: Fictional reason: this waits for the next planning review.** It has no **Approve…** or **Reject…**.
  - **Notes:**

- [ ] **Step 3.** Press Esc. In the Draft menu, select **Rejected** again.
  - **Expected:** All people are shown again.
  - **Notes:**

### DRAFT-10: List Drafts Are Marked on the Lists Page

**Preconditions:** Signed in (P1) as `engineering.director@fathom.test`. **Lists** page open from the left-hand menu.

- [ ] **Step 1.** Read the mark beside each list's name.
  - **Expected:** Certifications: **Draft: removed**, with the name struck through. Languages: **Draft: retired**. Levels: **Draft: reordered**. Positions: **Draft**. Roles on teams: **Draft**. Sites: **Draft**. Skills: **Draft: added**. Each has a yellow dot.
  - **Notes:**

- [ ] **Step 2.** Look at the row under each list.
  - **Expected:** Each list except Certifications and Skills has a light green row under it with a green dot and **Live**.
  - **Notes:**

- [ ] **Step 3.** Read the Choices column of the **Positions** row with the yellow dot.
  - **Expected:** **(4)** Manager, Software Engineer, Test Engineer, SDET, and **Architect** struck through.
  - **Notes:**

### DRAFT-11: Approving All Skips a Draft That Depends on a Rejected Draft

**Preconditions:** As DRAFT-10.

- [ ] **Step 1.** Open the Draft menu.
  - **Expected:** Under **Waiting drafts** it offers **Approve 11 drafts…** and **Reject 11 drafts…**.
  - **Notes:**

- [ ] **Step 2.** Select **Approve 11 drafts…**.
  - **Expected:** A dialog titled **Approve 10 drafts?** opens. It says **1 draft is skipped because it depends on a rejected draft.**
  - **Notes:**

- [ ] **Step 3.** Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

### DRAFT-12: A New Order That Depends on a Rejected Choice Cannot Be Approved

**Preconditions:** As DRAFT-10.

- [ ] **Step 1.** Select **Sites** in the row with the yellow dot.
  - **Expected:** A panel opens with **Sites** at the top and a yellow dot and **Draft: reordered** under it. **Harbourside** is the first choice, with a red dot and **Rejected**. **Northmere Labs** has a yellow dot and **Draft**, with a light green row under it reading **Northmere**, with a green dot and **Live**.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button beside **Sites** at the top of the panel.
  - **Expected:** The menu shows **Sites**, a divider, a yellow dot and **Draft: reordered**, and **Reordered by Engineering Operations Manager**. **Approve…** is greyed out, with **Waiting for a rejected draft to be resubmitted** under it. **Reject…** can be selected.
  - **Notes:**

- [ ] **Step 3.** Press Esc.
  - **Expected:** The menu closes. The panel stays open.
  - **Notes:**

### DRAFT-13: A Rejected Choice Offers Nothing to Decide

**Preconditions:** As DRAFT-12, with the **Sites** panel open.

- [ ] **Step 1.** Select the **⋯** button at the end of the **Harbourside** row.
  - **Expected:** Under a red dot and **Rejected**, the menu shows **Reason: Fictional reason: leave Positions and Sites as they are until both are reviewed.** and **Added** by Engineering Operations Manager. It has no **Approve…** or **Reject…**.
  - **Notes:**

- [ ] **Step 2.** Press Esc, then close the panel with the **×** button at its top right.
  - **Expected:** The panel closes.
  - **Notes:**

### DRAFT-14: Rejected List Drafts Offer Nothing to Decide

**Preconditions:** As DRAFT-10.

- [ ] **Step 1.** Select **Positions** in the row with the yellow dot.
  - **Expected:** A panel opens with **Positions** at the top and two red dots, each with **Rejected**, under it. **Architect** is struck through, with a yellow dot and **Draft: removed**.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button beside **Positions** at the top of the panel.
  - **Expected:** The menu has two sections. Each starts with a red dot and **Rejected**, then **Reason: Fictional reason: leave Positions and Sites as they are until both are reviewed.** The first then says **Changed by Engineering Operations Manager**, the second **Reordered by Engineering Operations Manager**. There is no **Approve…** or **Reject…**.
  - **Notes:**

- [ ] **Step 3.** Press Esc. Select the **⋯** button at the end of the **Architect** row.
  - **Expected:** The menu has **Approve…** and **Reject…**.
  - **Notes:**

- [ ] **Step 4.** Press Esc, then close the panel.
  - **Expected:** The panel closes.
  - **Notes:**

### DRAFT-15: A Choice Drafted to Be Retired Stays in Place

**Preconditions:** As DRAFT-10.

- [ ] **Step 1.** Select **Roles on teams** in the row with the yellow dot.
  - **Expected:** A panel opens. **Design Authority** is among the choices, with a yellow dot and **Draft: retired**, and a light green row under it with a green dot and **Live**.
  - **Notes:**

- [ ] **Step 2.** Close the panel.
  - **Expected:** The panel closes.
  - **Notes:**

### DRAFT-16: Drafts Applied Shows the Lists as They Will Be

**Preconditions:** As DRAFT-10.

- [ ] **Step 1.** In the Draft menu, select **Drafts applied**.
  - **Expected:** The count beside the search box reads **6 lists**. Certifications and Languages are not in the table. No row has a green dot and **Live**.
  - **Notes:**

- [ ] **Step 2.** Read the **Positions** and **Sites** rows.
  - **Expected:** Positions: **Draft**, **(4)** Software Engineer, Test Engineer, SDET, Manager. Sites: **Draft**, **(4)** Kestrel Bay, Northmere Labs, Ashgrove, Corran Quay.
  - **Notes:**

- [ ] **Step 3.** Select **Show retired (1)** under the table.
  - **Expected:** Languages appears under **Retired**, with a yellow dot and **Draft: retired**.
  - **Notes:**

- [ ] **Step 4.** Open the Draft menu.
  - **Expected:** It reads **9 of 11 waiting drafts shown**, with **Approve 9 drafts…** and **Reject 9 drafts…**.
  - **Notes:**

- [ ] **Step 5.** Select **Drafts beside live**.
  - **Expected:** The table is as in DRAFT-10.
  - **Notes:**

### DRAFT-17: The Drafts Page Describes New Orders

**Preconditions:** Signed in (P1) as `engineering.director@fathom.test`. **Drafts** page open from the left-hand menu.

- [ ] **Step 1.** Type **new order** in the search box.
  - **Expected:** Four entries are shown, ending **drafted a new order for People's columns**, **drafted a new order for Levels**, **drafted a new order for Positions** and **drafted a new order for Sites**.
  - **Notes:**

- [ ] **Step 2.** Read the **People's columns** entry.
  - **Expected:** It reads **From Name, Employee ID, Site, Position, Level, Role on team, Start, End to Name, Employee ID, Grade, Site, Position, Role on team, Start, End, Previous site**.
  - **Notes:**

- [ ] **Step 3.** Read the **Sites** entry.
  - **Expected:** It reads **From Kestrel Bay, Northmere, Ashgrove, Corran Quay to Harbourside, Kestrel Bay, Northmere Labs, Ashgrove, Corran Quay**. Its checkbox is greyed out, with **Waiting for a rejected draft to be resubmitted** under it.
  - **Notes:**

- [ ] **Step 4.** Clear the search box.
  - **Expected:** All drafts are shown again.
  - **Notes:**

### DRAFT-18: Rejected Drafts Cannot Be Selected on the Drafts Page

**Preconditions:** As DRAFT-17.

- [ ] **Step 1.** Type **Rejected** in the search box.
  - **Expected:** Six entries are shown, each with a red dot and **Rejected** and its reason: the column Previous site, the list Positions, the new order for Positions, the choice Harbourside in Sites, 우아현, and Ophélie Roussel.
  - **Notes:**

- [ ] **Step 2.** Try to select the checkbox of each entry.
  - **Expected:** None can be selected.
  - **Notes:**

- [ ] **Step 3.** Clear the search box.
  - **Expected:** All drafts are shown again.
  - **Notes:**

### DRAFT-19: A Workforce Administrator Can Discard the New Column Order

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **People** page open.

- [ ] **Step 1.** In the Draft menu, select **Discard new order**.
  - **Expected:** The columns are Name, Employee ID, Site, Position, Grade, Level, Role on team, Start, End, Previous site. **Grade** has a yellow dot and **Draft**, without **Draft: moved**.
  - **Notes:**

- [ ] **Step 2.** Open the **Drafts** page, and type **new order for People** in the search box.
  - **Expected:** The page says **No drafts match the search.**
  - **Notes:**

- [ ] **Step 3.** Look at the top bar, beside your name.
  - **Expected:** It shows **Publish 4 changes**: the three changes the seed data holds, and this one.
  - **Notes:**

### DRAFT-20: A Workforce Administrator Can Discard a List's New Order

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **Lists** page open.

- [ ] **Step 1.** Select **Levels** in the row with the yellow dot.
  - **Expected:** A panel opens with a yellow dot and **Draft: reordered** under **Levels**.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button beside **Levels** at the top of the panel, then **Discard new order**.
  - **Expected:** The **Draft: reordered** mark disappears. **Co-op** is the last choice.
  - **Notes:**

- [ ] **Step 3.** Close the panel.
  - **Expected:** The **Levels** row has no mark, and no light green **Live** row under it.
  - **Notes:**

### DRAFT-21: Unpublished Changes Are Seen Only by the Person Who Made Them

**Preconditions:** R1. Signed in (P1) as `engineering.operations.manager@fathom.test`. **People** page open.

- [ ] **Step 1.** Look at the top bar, beside your name.
  - **Expected:** It shows **Publish 3 changes**, with a **⋯** button beside it.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button beside **Publish 3 changes**.
  - **Expected:** The menu shows **Your unpublished changes**, a divider, **Only you see these until you publish them.**, then **Added** the choice Laptop in Equipment, **Added** the list Equipment and **Changed** Mariana Metz, then **Discard all…**.
  - **Notes:**

- [ ] **Step 3.** Press Esc. Type **Mariana Metz** in the search box above the table.
  - **Expected:** Her row has a yellow dot and **Draft**, and a hollow yellow dot and **Unpublished**. Her **Site** cell is yellow.
  - **Notes:**

- [ ] **Step 4.** Select the **⋯** button at the end of her row.
  - **Expected:** The menu says **Only you see these changes until you publish them.**
  - **Notes:**

- [ ] **Step 5.** Press Esc. Sign in (P1) as `engineering.director@fathom.test`, open **People**, and type **Mariana Metz** in the search box.
  - **Expected:** Her row has a grey dot and **Being changed**, and no **Draft** mark, and her **Site** cell is not yellow. The top bar shows no **Publish** button.
  - **Notes:**

- [ ] **Step 6.** Open **Lists**.
  - **Expected:** There is no **Equipment** list.
  - **Notes:**

### DRAFT-22: A Record Someone Else Is Changing Is Held

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **People** page open.

- [ ] **Step 1.** Type **Viktoria Holmberg** in the search box above the table.
  - **Expected:** Her row has a yellow dot and **Draft**, and a grey dot and **Being changed**.
  - **Notes:**

- [ ] **Step 2.** Select the **⋯** button at the end of her row.
  - **Expected:** The menu says **Being changed by Second Engineering Operations Manager. It can be changed once they publish or discard their changes.** It has no **Discard draft** or **Remove person**.
  - **Notes:**

- [ ] **Step 3.** Press Esc. Double-click her **Site** cell.
  - **Expected:** Nothing can be typed into it.
  - **Notes:**

- [ ] **Step 4.** Sign in (P1) as `engineering.director@fathom.test`, open **People**, type **Viktoria Holmberg** in the search box, and select the **⋯** button at the end of her row.
  - **Expected:** The menu shows the same **Being changed by Second Engineering Operations Manager…** note, and has no **Approve draft** or **Reject draft…**.
  - **Notes:**

### DRAFT-23: Changing a Published Draft Keeps Others Seeing It as Published

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **People** page open.

- [ ] **Step 1.** Type **E10002** in the search box. Select that person's **Employee ID** cell, type **E20002**, and press Enter.
  - **Expected:** The cell reads **E20002** and is yellow. The row has a yellow dot and **Draft**, and a hollow yellow dot and **Unpublished**. The top bar shows **Publish 4 changes**.
  - **Notes:**

- [ ] **Step 2.** Sign in (P1) as `engineering.director@fathom.test`, open **People**, and type **E10002** in the search box.
  - **Expected:** The row still reads **E10002**, with a yellow dot and **Draft**, and a grey dot and **Being changed**.
  - **Notes:**

- [ ] **Step 3.** Select the **⋯** button at the end of the row.
  - **Expected:** The menu says **Being changed by Engineering Operations Manager. It can be changed once they publish or discard their changes.** It has no **Approve draft** or **Reject draft…**.
  - **Notes:**

### DRAFT-24: Publishing Shows the Changes to Everyone

**Preconditions:** DRAFT-23 done. Signed in (P1) as `engineering.operations.manager@fathom.test`. **People** page open.

- [ ] **Step 1.** Select **Publish 4 changes** in the top bar: the three changes the seed data holds, and the one from DRAFT-23.
  - **Expected:** A notice reads **Published 4 changes.** The **Publish** button is gone from the top bar.
  - **Notes:**

- [ ] **Step 2.** Type **Mariana Metz** in the search box.
  - **Expected:** Her row has a yellow dot and **Draft**, with no **Unpublished** mark.
  - **Notes:**

- [ ] **Step 3.** Sign in (P1) as `engineering.director@fathom.test`, open **People**, and type **Mariana Metz** in the search box.
  - **Expected:** Her row has a yellow dot and **Draft**, and her **Site** cell is yellow.
  - **Notes:**

- [ ] **Step 4.** Open **Lists**.
  - **Expected:** **Equipment** is in the table, with a yellow dot and **Draft: added**.
  - **Notes:**

**Afterwards:** R1.

### DRAFT-25: Discard All Removes Every Unpublished Change

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **People** page open.

- [ ] **Step 1.** Select the **⋯** button beside **Publish 3 changes**, then **Discard all…**.
  - **Expected:** A dialog titled **Discard 3 changes?** says **Your unpublished changes are deleted. This cannot be undone.**
  - **Notes:**

- [ ] **Step 2.** Select **Cancel**.
  - **Expected:** The dialog closes. The top bar still shows **Publish 3 changes**.
  - **Notes:**

- [ ] **Step 3.** Select the **⋯** button beside **Publish 3 changes**, then **Discard all…**, then **Discard**.
  - **Expected:** A notice reads **Discarded 3 changes.** The **Publish** button is gone from the top bar.
  - **Notes:**

- [ ] **Step 4.** Type **Mariana Metz** in the search box.
  - **Expected:** Her row has no mark.
  - **Notes:**

- [ ] **Step 5.** Open **Lists**.
  - **Expected:** There is no **Equipment** list.
  - **Notes:**

### DRAFT-26: All Waiting Drafts Can Be Approved From the Drafts Page

**Preconditions:** R2. Signed in (P1) as `engineering.director@fathom.test`. **Drafts** page open.

- [ ] **Step 1.** Select **Select all waiting**.
  - **Expected:** The button at the top right reads **Approve 16 drafts**. The **Sites** new order entry, and the **Viktoria Holmberg** entry, are not selected.
  - **Notes:**

- [ ] **Step 2.** Select **Approve 16 drafts**.
  - **Expected:** A dialog titled **Approve 16 drafts?** opens.
  - **Notes:**

- [ ] **Step 3.** Select **Approve**.
  - **Expected:** The dialog closes, and a notice reads **Approved 16 drafts.**
  - **Notes:**

- [ ] **Step 4.** Open the **People** page.
  - **Expected:** The columns are Name, Employee ID, Grade, Site, Position, Start, End, Previous site. Of the column headers, only **Previous site** has a mark: a red dot and **Rejected**.
  - **Notes:**

- [ ] **Step 5.** Open the **Lists** page.
  - **Expected:** **Sites** has a yellow dot and **Draft: reordered**. **Positions** has a red dot and **Rejected**. No other list has a mark.
  - **Notes:**

### DRAFT-27: A Resubmitted Choice Is Approved With the New Order That Depends on It

**Preconditions:** R2. Signed out (P2).

- [ ] **Step 1.** Sign in (P1) as `engineering.operations.manager@fathom.test`. Open **Lists**, then **Sites**. Select the **⋯** button at the end of the **Harbourside** row, then **Resubmit**.
  - **Expected:** **Harbourside** has a yellow dot and **Draft: added**.
  - **Notes:**

- [ ] **Step 2.** Sign in (P1) as `engineering.director@fathom.test`. Open **Lists**, then **Sites**. Select the **⋯** button beside **Sites** at the top of the panel.
  - **Expected:** **Approve…** can be selected, with no waiting message under it.
  - **Notes:**

- [ ] **Step 3.** Select **Approve…**.
  - **Expected:** A dialog titled **Approve 2 drafts?** opens. It says **Includes 1 related draft.**
  - **Notes:**

- [ ] **Step 4.** Select **Approve**.
  - **Expected:** **Harbourside** is the first choice, with no mark. The **Draft: reordered** mark under **Sites** is gone.
  - **Notes:**

**Afterwards:** R2.
