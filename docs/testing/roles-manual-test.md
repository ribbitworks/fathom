---
title: "Manual Test: Editing Roles"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/roles*.ts*", "apps/web/src/accounts-page.tsx", "apps/web/src/settings-page.tsx", "apps/server/src/data/settings.ts", "apps/server/src/data/role-administration.ts", "apps/server/src/routes/roles.ts", "packages/shared/src/access.ts", "packages/shared/src/roles.ts"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-07"
---

# Manual Test: Editing Roles

## Scope

Verifies the Roles page: who sees it, the list of roles, the dialog that sets what a role grants with its summary in plain English and its marks on what is not built yet, the confirmation of what a change does to the accounts holding a role, restoring a starting role's template, copying and creating roles, giving an account a role made later, the refusals, and the access history entries that changes leave. It also verifies the Settings page, where the Administrator changes Fathom's time zone.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R2).

## Test Accounts

R2 creates these accounts, with every other development account, each holding one role, as [Development Setup](../design/development-setup.md#development-accounts) lists. They share one password, which R2 prints when it finishes. Every role is as Fathom starts it.

- **Administrator account:** `fathom.administrator@fathom.test`, shown in Fathom as **Fathom Administrator**. It holds the Administrator role, so it can manage accounts, edit roles, change Fathom's settings, and see the access history.
- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It holds the Workforce Administrator role, and cannot edit roles.
- **Project Manager account:** `project.manager@fathom.test`, shown in Fathom as **Project Manager**. It holds the Project Manager role.
- **Team Member account:** `team.member@fathom.test`, shown in Fathom as **Team Member**. It holds the Team Member role.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at the address the terminal prints, such as `https://localhost:8443`, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R2: Reset the Database

Use before the first test case and after the last, so every role is as Fathom starts it. This deletes every account and record in the development database, including anything added by hand, and puts every role back as Fathom starts it; restoring only the seed data does not. Ask the owner before running it on a database others use.

1. Stop Fathom: press Ctrl+C in the first terminal.
2. In the second terminal, run:

   ```sh
   pnpm db:reset && pnpm db:seed
   ```

3. Confirm that the last line printed gives the shared password, with no error above it.
4. Start Fathom again (R0).

### P1: Sign In

1. If someone is signed in, sign out first (P2).
2. On the **Sign in** page, enter the account's email address and the shared password.
3. Select **Sign in**.

### P2: Sign Out

1. Select the account button at the top right, which shows the account's name.
2. Select **Sign out**.

### P3: Open a Role

1. Select **Roles** under **Administration** in the left-hand menu.
2. Select **Edit** in the role's row.

## Terms

- **Summary:** the panel on the right of the role dialog, headed **Pages its holders see**, **Can** and **Cannot**.
- **Grid:** the table on the left of the role dialog, with an area in each row and the columns **View**, **Draft**, **Approve** and **Edit**.
- **Tier colours:** the word **Restricted** in bold orange and the word **Confidential** in bold red.

## Test Cases

Run the test cases in order. Start with R2. Check each step whose expected result you see, and write anything else under its notes.

### ROLE-01: Only Those Who May Edit Roles See the Roles Page

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`.

- [ ] **Step 1.** Look at the left-hand menu.
  - **Expected:** There is no **Administration** section and no **Roles** page.
  - **Notes:**

- [ ] **Step 2.** Change the browser's address to end in `/roles`, and press Enter.
  - **Expected:** The page says **There is no page at this address.**
  - **Notes:**

- [ ] **Step 3.** Sign out (P2), and sign in (P1) as `fathom.administrator@fathom.test`.
  - **Expected:** The left-hand menu shows **Accounts**, **Roles** and **Settings** under **Administration**.
  - **Notes:**

### ROLE-02: The Roles Page Lists Every Role

**Preconditions:** Signed in (P1) as `fathom.administrator@fathom.test`. **Roles** page open from the left-hand menu.

- [ ] **Step 1.** Read the **Role** and **Accounts** columns from top to bottom.
  - **Expected:** Administrator 1, Engineering Director 1, Engineering Manager 1, Executive 1, Planner 2, Project Manager 1, Resource Planner 1, Superuser 1, Team Member 1, Workforce Administrator 2. Each row ends with **Edit** and **Copy** buttons, and **New role** is at the top right.
  - **Notes:**

- [ ] **Step 2.** Read the **What it is for** column.
  - **Expected:** Engineering Manager reads **Edits the plan and allocations, sees people, including everyone's Restricted details, colours teams on the org chart, and proposes feature teams.** Wherever **Restricted** or **Confidential** appears, it is in its tier colour, in light and dark mode alike.
  - **Notes:**

### ROLE-03: The Dialog Shows What a Role Grants

**Preconditions:** As ROLE-02.

- [ ] **Step 1.** Open the **Project Manager** role (P3).
  - **Expected:** A dialog titled **Edit Project Manager** shows **Name**, **What it is for**, and the grid. The ticked boxes are **View** and **Edit** on **Plan**, with **View** greyed; **View** on **Allocations**; **View** on **Org chart**; **Approve** on **Feature teams**; **Draft** and **Approve** on **Drafts of every kind**; and **View** on **Configuration** and on **Change history**. Under the grid: **A greyed tick comes with another action on the same area, such as View with Edit.**
  - **Notes:**

- [ ] **Step 2.** Read the **Area** column, and the lines under the grid.
  - **Expected:** **Allocations** and **Feature teams** each carry a small grey **Not built yet** tag, and **Drafts of every kind** carries **Draft not built yet**. No other area is tagged. A line under the grid reads **Fathom doesn't have what is marked Not built yet. A role can grant it now, and it works once it is built.**
  - **Notes:**

- [ ] **Step 3.** Read the summary.
  - **Expected:** **Pages its holders see** lists Overview, Projects, Releases, Org chart, Drafts, Capacity, Lists and Change history, with Projects and Capacity tagged **Not built yet**. **Can** names seeing allocations, approving feature teams, and making drafts of changes to the plan and allocations, each tagged **Not built yet**, and seeing the plan, changing the plan, seeing the org chart, approving drafts, seeing configuration, and seeing the change history. Under **Cannot**, these lines are tagged **Not built yet**: **Cannot change allocations.**, **Cannot propose feature teams.**, and **Cannot change feature teams.** **Cannot** includes **The People page does not appear.** and **Restricted details are hidden wherever they appear, and only current staff are listed.**, with the tier colours.
  - **Notes:**

- [ ] **Step 4.** Look at the foot of the dialog.
  - **Expected:** **Restore template** on the left, turned off, and **Cancel** and **Save** on the right.
  - **Notes:**

### ROLE-04: Editing an Area Brings Viewing It

**Preconditions:** The **Project Manager** dialog open, as at the end of ROLE-03.

- [ ] **Step 1.** Tick **Edit** on the **Configuration** row.
  - **Expected:** **View** on the **Configuration** row stays ticked, becomes greyed, and cannot be unticked.
  - **Notes:**

- [ ] **Step 2.** Untick **Edit** on the **Configuration** row.
  - **Expected:** **View** on the **Configuration** row is ticked and can be unticked again.
  - **Notes:**

### ROLE-05: The Summary Shows Each Change

**Preconditions:** The **Project Manager** dialog open, as at the end of ROLE-04.

- [ ] **Step 1.** Tick **View** on the **People** row, and watch the summary.
  - **Expected:** **People** appears under **Pages its holders see**, and a sentence about seeing people appears under **Can**, each in bold teal, turning to plain text after about three seconds. Under **Cannot**, **The People page does not appear.** is struck through in red and fades away over about three seconds, then goes.
  - **Notes:**

- [ ] **Step 2.** Untick **View** on the **People** row.
  - **Expected:** The lines added in Step 1 are struck through in red and fade away; **The People page does not appear.** comes back in bold teal.
  - **Notes:**

- [ ] **Step 3.** Tick **View** on the **Restricted details** row, leaving **People** unticked.
  - **Expected:** A yellow box at the top of the summary reads **View Restricted details does nothing without View People.**
  - **Notes:**

- [ ] **Step 4.** Select **Cancel**, then open the **Project Manager** role again (P3).
  - **Expected:** The dialog shows the boxes as in ROLE-03 Step 1; nothing was saved.
  - **Notes:**

### ROLE-06: A Change Is Confirmed Before It Is Saved

**Preconditions:** The **Project Manager** dialog open, as at the end of ROLE-05.

- [ ] **Step 1.** Tick **View** on the **Access history** row, and select **Save**.
  - **Expected:** The dialog says **This change affects 1 account.** and lists **Project Manager**, with its email address, and under **Gains**: **Sees the Access history page.** and a sentence about seeing the access history. **Back** is on the left, **Cancel** and **Save changes** on the right.
  - **Notes:**

- [ ] **Step 2.** Select **Back**.
  - **Expected:** The grid shows again, with **View** on **Access history** still ticked.
  - **Notes:**

- [ ] **Step 3.** Select **Save**, then **Save changes**.
  - **Expected:** The dialog closes and a green banner says **The role has been changed.** The **Project Manager** row is unchanged in the list.
  - **Notes:**

- [ ] **Step 4.** Sign out (P2), and sign in (P1) as `project.manager@fathom.test`.
  - **Expected:** The left-hand menu shows **Access history** under **History**.
  - **Notes:**

- [ ] **Step 5.** Sign out (P2), and sign in (P1) as `fathom.administrator@fathom.test`. Select **Access history** in the left-hand menu.
  - **Expected:** The latest entry says Fathom Administrator **changed the role** Project Manager, granting View Access history, and is marked as worth checking.
  - **Notes:**

### ROLE-07: Restoring a Starting Role's Template

**Preconditions:** Signed in as `fathom.administrator@fathom.test`, after ROLE-06.

- [ ] **Step 1.** Open the **Project Manager** role (P3).
  - **Expected:** **Restore template** is turned on, since the role no longer matches its template.
  - **Notes:**

- [ ] **Step 2.** Select **Restore template**.
  - **Expected:** **View** on **Access history** is unticked, the summary changes to match, and **Restore template** is turned off. Nothing is saved yet.
  - **Notes:**

- [ ] **Step 3.** Select **Save**, then **Save changes**.
  - **Expected:** The confirmation lists the same account, under **Loses** with **The Access history page no longer appears.**; once saved, the green banner says **The role has been changed.**
  - **Notes:**

### ROLE-08: Copying a Role

**Preconditions:** **Roles** page open, signed in as `fathom.administrator@fathom.test`.

- [ ] **Step 1.** Select **Copy** in the **Team Member** row.
  - **Expected:** A dialog titled **Copy Team Member**, with the name **Copy of Team Member**, Team Member's description, and the same boxes ticked as Team Member: **View** on **Plan**, **Allocations**, **Org chart** and **Change history**. There is no **Restore template** button, and the main button is **Create role**.
  - **Notes:**

- [ ] **Step 2.** Select **Create role**.
  - **Expected:** The dialog closes, a green banner says **The role has been created.**, and **Copy of Team Member** is in the list with 0 accounts.
  - **Notes:**

- [ ] **Step 3.** Open **Copy of Team Member** (P3), tick **View** on **People**, and select **Save**.
  - **Expected:** The dialog closes with **The role has been changed.**, with no confirmation, since no account holds the role. There is no **Restore template** button.
  - **Notes:**

- [ ] **Step 4.** Select **Access history** in the left-hand menu.
  - **Expected:** The entry before the latest says **created the role** Copy of Team Member, granting View Plan, View Allocations, View Org chart, View Change history. The latest says **changed the role** Copy of Team Member, granting View People.
  - **Notes:**

### ROLE-09: Giving an Account a Role Made Later

**Preconditions:** Signed in as `fathom.administrator@fathom.test`, after ROLE-08.

- [ ] **Step 1.** Select **Accounts** under **Administration** in the left-hand menu, and read the **Role** column.
  - **Expected:** Each account shows one role: **Team Member** in the **Team Member** row, **Planner** in the **Product Manager** and **Feature Lead** rows, and **Administrator** in the **Fathom Administrator** row.
  - **Notes:**

- [ ] **Step 2.** Select **Edit** in the **Team Member** row.
  - **Expected:** A dialog titled **Edit Team Member**, with **Name**, **Email address**, and **Role**. **Role** lists every role in the order of the **Roles** page, **Copy of Team Member** among them, each with a round button and its description under its name. Only **Team Member** is chosen.
  - **Notes:**

- [ ] **Step 3.** Choose **Copy of Team Member**.
  - **Expected:** **Copy of Team Member** is chosen, and **Team Member** no longer is.
  - **Notes:**

- [ ] **Step 4.** Select **Save**.
  - **Expected:** The dialog closes, a green banner says **Saved the account for Team Member.**, and the **Team Member** row shows **Copy of Team Member** as its role.
  - **Notes:**

- [ ] **Step 5.** Select **Roles** under **Administration** in the left-hand menu.
  - **Expected:** **Copy of Team Member** has 1 account and **Team Member** has 0.
  - **Notes:**

- [ ] **Step 6.** Select **Access history** under **History** in the left-hand menu.
  - **Expected:** The latest entry says Fathom Administrator **changed the role of** Team Member: from Team Member to Copy of Team Member, and is marked as worth checking.
  - **Notes:**

- [ ] **Step 7.** Sign out (P2), and sign in (P1) as `team.member@fathom.test`.
  - **Expected:** The left-hand menu shows **People** and **Org chart** under **People**.
  - **Notes:**

- [ ] **Step 8.** Select **Roles** under **Help** in the left-hand menu.
  - **Expected:** The first row is **Copy of Team Member**, with a sea-blue check before its name, and its description beside it. No other row has a check.
  - **Notes:**

### ROLE-10: Names Must Differ

**Preconditions:** **Roles** page open, signed in (P1) as `fathom.administrator@fathom.test`.

- [ ] **Step 1.** Select **New role**.
  - **Expected:** A dialog titled **New role**, with an empty name, no description, and nothing ticked. **Pages its holders see** says **None, apart from Help.**
  - **Notes:**

- [ ] **Step 2.** Select **Create role** with the name empty.
  - **Expected:** **Enter a name for the role.** shows under **Name**.
  - **Notes:**

- [ ] **Step 3.** Enter `team member` as the name, and select **Create role**.
  - **Expected:** A red box in the dialog says **Another role already has that name; choose another**, and the dialog stays open.
  - **Notes:**

- [ ] **Step 4.** Select **Cancel**.
  - **Expected:** The dialog closes, and no new role is in the list.
  - **Notes:**

### ROLE-11: Nobody Can Lock Everyone Out

**Preconditions:** **Roles** page open, signed in as `fathom.administrator@fathom.test`.

- [ ] **Step 1.** Open the **Superuser** role (P3), untick **Edit** on **Roles**, and select **Save**.
  - **Expected:** The confirmation says **This change affects 1 account.** It lists **Superuser**, under **Loses** with **The Roles page no longer appears.**
  - **Notes:**

- [ ] **Step 2.** Select **Save changes**.
  - **Expected:** The dialog closes and a green banner says **The role has been changed.**, since the Administrator role still edits roles.
  - **Notes:**

- [ ] **Step 3.** Open the **Administrator** role (P3), untick **Edit** on **Roles**, and select **Save**.
  - **Expected:** The confirmation says **This change affects 1 account.** It lists **Fathom Administrator**, marked **(you)**, under **Loses** with **The Roles page no longer appears.**
  - **Notes:**

- [ ] **Step 4.** Select **Save changes**.
  - **Expected:** A red box says **Some active account must keep the permissions to manage accounts and to edit roles**, and the dialog stays open.
  - **Notes:**

- [ ] **Step 5.** Select **Cancel**, and open the **Administrator** role again (P3).
  - **Expected:** **Edit** on **Roles** is still ticked; nothing changed.
  - **Notes:**

### ROLE-12: Changing Fathom's Time Zone

**Preconditions:** Signed in (P1) as `fathom.administrator@fathom.test`.

- [ ] **Step 1.** Select **Settings** under **Administration** in the left-hand menu.
  - **Expected:** The **Settings** page shows **Time zone** set to **America/Vancouver**, with the day and time there under it, such as **It is Thursday, November 5, 2026 at 6:06 AM there.**, matching a clock in Vancouver. **Save** is turned off.
  - **Notes:**

- [ ] **Step 2.** Type `Kolkata` in **Time zone**, and choose the time zone for India from the list.
  - **Expected:** The line under it shows the day and time in India, matching a clock there, and **Save** is turned on.
  - **Notes:**

- [ ] **Step 3.** Select **Save**.
  - **Expected:** A green banner says **Fathom's time zone is now** followed by the time zone chosen, and **Save** is turned off again.
  - **Notes:**

- [ ] **Step 4.** Select **Access history** under **History** in the left-hand menu.
  - **Expected:** The newest entry says **Fathom Administrator changed Fathom's time zone: from America/Vancouver to** the time zone chosen.
  - **Notes:**

- [ ] **Step 5.** Open **Settings** again, choose **America/Vancouver**, and select **Save**.
  - **Expected:** A green banner says **Fathom's time zone is now America/Vancouver.**
  - **Notes:**

- [ ] **Step 6.** Sign out (P2), sign in (P1) as `engineering.operations.manager@fathom.test`, and change the browser's address to end in `/settings`.
  - **Expected:** The left-hand menu has no **Settings** page, and the page says **There is no page at this address.**
  - **Notes:**

### ROLE-13: Put Every Role Back

**Preconditions:** All the test cases above run.

- [ ] **Step 1.** Reset the database (R2).
  - **Expected:** The **Roles** page lists the roles as in ROLE-02, with no **Copy of Team Member**.
  - **Notes:**
