---
title: "Manual Test: Editing Roles"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/roles*.ts*", "apps/web/src/accounts-page.tsx", "apps/web/src/settings-page.tsx", "apps/server/src/data/settings.ts", "apps/server/src/data/role-administration.ts", "apps/server/src/routes/roles.ts", "packages/shared/src/access.ts", "packages/shared/src/roles.ts"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-11"
---

# Manual Test: Editing Roles

## Scope

Verifies the Roles page: who sees it, the list of roles, the dialog that sets what a role grants with its summary in plain English and its marks on what is not built yet, the confirmation of what a change does to the accounts holding a role, restoring a starting role's template, the note when a starting role's grants change, copying and creating roles, giving an account a role made later, the refusals, and the access history entries that changes leave. It also verifies the Settings page, where the Administrator changes Fathom's time zone.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Administrator:** `fathom.administrator@fathom.test`, shown in Fathom as **Fathom Administrator**
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**
- **Project Manager:** `project.manager@fathom.test`
- **Team Member:** `team.member@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Reset the Database](manual-test-basics.md#reset-the-database) and [Open a Role](manual-test-basics.md#open-a-role).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the left-hand menu and the account menu. This test adds:

- **Summary:** the panel on the right of the role dialog, headed **Pages its holders see**, **Can** and **Cannot**.
- **Tier colours:** the word **Personal** in bold orange and the word **Confidential** in bold red.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Check each step whose expected result you see, and write anything else under its notes.

### ROLE-01: Only Those Who May See Roles See the Roles Page

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case. Step 2 signs in as another account.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Look at the left-hand menu.
  - **Expected:** There is no **Administration** section and no **Roles** page.
  - **Notes:**

- [ ] **Step 2.** Sign out, and sign in as the Administrator, `fathom.administrator@fathom.test`.
  - **Expected:** The left-hand menu shows **Accounts**, **Roles** and **Settings**.
  - **Notes:**

### ROLE-02: The Roles Page Lists Every Role

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as the account ROLE-01 ended with.

**Preconditions:** Signed in with this account. **Roles** page open from the left-hand menu.

- [ ] **Step 1.** Read the **Role** and **Accounts** columns from top to bottom.
  - **Expected:**
    - The **Role** and **Accounts** columns read, from top to bottom:
      - Administrator 1
      - Engineering Director 1
      - Engineering Manager 2
      - Executive 1
      - Feature Lead 1
      - Product Manager 1
      - Project Manager 1
      - Resource Planner 1
      - Superuser 1
      - Team Member 1
      - Workforce Administrator 2
    - Each row ends with **Edit** and **Copy** buttons.
    - **New role** is at the top right.
  - **Notes:**

- [ ] **Step 2.** Read the **What it is for** column.
  - **Expected:**
    - Engineering Manager reads **Edits the plan and allocations, sees people, with everyone's Personal details and the hiring plan, and proposes feature teams.**
    - Wherever **Personal** or **Confidential** appears, it is in its tier colour, in light and dark mode alike.
  - **Notes:**

### ROLE-03: The Dialog Shows What a Role Grants

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-02.

**Preconditions:** Signed in with this account. **Roles** page open from the left-hand menu.

- [ ] **Step 1.** Open the **Project Manager** role, as Open a Role describes.
  - **Expected:** A dialog titled **Edit Project Manager** shows **Name**, **What it is for**, and the grid, with these boxes ticked:
    - **Plan:** **View**, greyed, **Approve** and **Edit**
    - **Features and releases:** **View**, greyed, **Approve** and **Edit**
    - **Allocations:** **View** and **Approve**
    - **People:** **View** and **Approve**
    - **Feature teams:** **View** and **Approve**
    - **Hiring plan:** **View** and **Approve**
    - **Configuration:** **View** and **Approve**
    - **Classify data** and **Their own drafts** have no box under **View**
  - **Notes:**

- [ ] **Step 2.** Read the summary.
  - **Expected:** The summary reads:
    - **Pages its holders see:** Overview, Projects, Features, Releases, People, Org chart, Feature assignments, Drafts, Capacity, Lists and Change history.
    - **Can:** a line for each ticked box, such as seeing the plan, approving drafts of features and releases, and seeing feature teams.
    - **Cannot** includes **Cannot change allocations.** and **Cannot change feature teams.**
    - **Cannot** also includes, with the tier colours: **Personal details are hidden wherever they appear, and people who haven't started yet aren't listed.** and **Confidential data is hidden wherever it appears.**
    - **Cannot** does not include **The People page does not appear.**
  - **Notes:**

- [ ] **Step 3.** Look at the foot of the dialog.
  - **Expected:**
    - **Restore template** is on the left, turned off.
    - **Cancel** and **Save** are on the right.
  - **Notes:**

### ROLE-04: Editing an Area Brings Viewing It

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-03.

**Preconditions:** Signed in with this account. **Roles** page open, with the **Edit Project Manager** dialog still open, unsaved, as ROLE-03 left it.

- [ ] **Step 1.** Tick **Edit** on the **Configuration** row.
  - **Expected:**
    - **View** on the **Configuration** row stays ticked.
    - It becomes greyed, and cannot be unticked.
  - **Notes:**

- [ ] **Step 2.** Untick **Edit** on the **Configuration** row.
  - **Expected:** **View** on the **Configuration** row is ticked and can be unticked again.
  - **Notes:**

### ROLE-05: The Summary Shows Each Change

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-04.

**Preconditions:** Signed in with this account. **Roles** page open, with the **Edit Project Manager** dialog still open, unsaved, as ROLE-04 left it.

- [ ] **Step 1.** Untick **View** on the **People** row, and watch the summary.
  - **Expected:**
    - **People** under **Pages its holders see**, and the sentence about seeing people under **Can**, are struck through in red and fade away over about three seconds, then go.
    - Under **Cannot**, **The People page does not appear.** appears in bold teal, turning to plain text after about three seconds.
    - A yellow box at the top of the summary reads **View Hiring plan does nothing without View People.**
  - **Notes:**

- [ ] **Step 2.** Tick **View** on the **People** row again.
  - **Expected:**
    - The lines taken out in Step 1 come back in bold teal.
    - **The People page does not appear.** is struck through in red and fades away.
    - The yellow box goes.
  - **Notes:**

- [ ] **Step 3.** Untick **View** on the **Hiring plan** row.
  - **Expected:**
    - The sentence about seeing the hiring plan under **Can** is struck through in red and fades away.
    - Under **Cannot**, **Planned hires appear only as placeholders.** appears in bold teal.
  - **Notes:**

- [ ] **Step 4.** Select **Cancel**, then open the **Project Manager** role again, as Open a Role describes.
  - **Expected:** The dialog shows the boxes as in ROLE-03 Step 1; nothing was saved.
  - **Notes:**

### ROLE-06: A Change Is Confirmed Before It Is Saved

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-05. Steps 4 and 5 sign in as other accounts.

**Preconditions:** Signed in with this account. **Roles** page open, with the **Edit Project Manager** dialog still open, unsaved, as ROLE-05 left it.

- [ ] **Step 1.** Tick **View** on the **Administration** row, and select **Save**.
  - **Expected:**
    - The dialog says **This change affects 1 account.**
    - It lists **Project Manager**, with its email address.
    - Under **Gains**: a line for each of the **Accounts**, **Roles**, **Settings** and **Access history** pages, and a sentence about seeing accounts, roles, settings and the access history.
    - **Back** is on the left, **Cancel** and **Save changes** on the right.
  - **Notes:**

- [ ] **Step 2.** Select **Back**.
  - **Expected:** The grid shows again, with **View** on **Administration** still ticked.
  - **Notes:**

- [ ] **Step 3.** Select **Save**, then **Save changes**.
  - **Expected:**
    - The dialog closes.
    - A green banner says **The role has been changed.**
    - The **Project Manager** row is unchanged in the list.
  - **Notes:**

- [ ] **Step 4.** Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The left-hand menu shows **Accounts**, **Roles** and **Settings** in the **Administration** section, and **Access history** in the **History** section.
  - **Notes:**

- [ ] **Step 5.** Sign out, and sign in as the Administrator, `fathom.administrator@fathom.test`. Select the **Access history** page in the left-hand menu.
  - **Expected:** The latest entry says Fathom Administrator **changed the role** Project Manager, granting View Administration, and is marked as worth checking.
  - **Notes:**

### ROLE-07: Restoring a Starting Role's Template

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as the account ROLE-06 ended with.

**Preconditions:** Signed in with this account, after ROLE-06. **Roles** page open from the left-hand menu.

- [ ] **Step 1.** Open the **Project Manager** role, as Open a Role describes.
  - **Expected:** **Restore template** is turned on, since the role no longer matches its template.
  - **Notes:**

- [ ] **Step 2.** Select **Restore template**.
  - **Expected:**
    - **View** on **Access history** is unticked.
    - The summary changes to match.
    - **Restore template** is turned off.
    - Nothing is saved yet.
  - **Notes:**

- [ ] **Step 3.** Select **Save**, then **Save changes**.
  - **Expected:**
    - The confirmation lists the same account, under **Loses** with **The Access history page no longer appears.**
    - Once saved, the green banner says **The role has been changed.**
  - **Notes:**

### ROLE-08: A Starting Role's Summary Goes When What It Grants Changes

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-07.

**Preconditions:** **Roles** page open.

- [ ] **Step 1.** Open the **Executive** role, as Open a Role describes, and tick **Edit** on the **Plan** row.
  - **Expected:**
    - **What it is for** is empty, with a line under it reading **What the role grants changed, so its old summary is gone.**
    - **Restore template** is turned on.
  - **Notes:**

- [ ] **Step 2.** Untick **Edit** on the **Plan** row.
  - **Expected:** **What it is for** reads as it did before, and the line under it is gone.
  - **Notes:**

- [ ] **Step 3.** Tick **Edit** on the **Plan** row, then select **Restore template**.
  - **Expected:**
    - **What it is for** reads **Sees the plan, people, with their Personal and Confidential data and the hiring plan, configuration, accounts, roles, settings, and both histories, without changing them.**
    - **Edit** on **Plan** is unticked.
    - **Restore template** is turned off.
  - **Notes:**

- [ ] **Step 4.** Select **Cancel**.
  - **Expected:** The dialog closes, and the **Executive** row's **What it is for** is unchanged.
  - **Notes:**

### ROLE-09: Copying a Role

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-08.

**Preconditions:** **Roles** page open, signed in with this account.

- [ ] **Step 1.** Select **Copy** in the **Team Member** row.
  - **Expected:**
    - A dialog titled **Copy Team Member**, with the name **Copy of Team Member** and Team Member's description.
    - The same boxes are ticked as Team Member: **View** on **Plan**, **Features and releases**, **Allocations**, **People** and **Feature teams**.
    - There is no **Restore template** button, and the main button is **Create role**.
  - **Notes:**

- [ ] **Step 2.** Select **Create role**.
  - **Expected:**
    - The dialog closes.
    - A green banner says **The role has been created.**
    - **Copy of Team Member** is in the list with 0 accounts.
  - **Notes:**

- [ ] **Step 3.** Open **Copy of Team Member**, as Open a Role describes, tick **View** on **Configuration**, and select **Save**.
  - **Expected:**
    - The dialog closes with **The role has been changed.**, with no confirmation, since no account holds the role.
    - There is no **Restore template** button.
  - **Notes:**

- [ ] **Step 4.** Select the **Access history** page in the left-hand menu.
  - **Expected:**
    - The entry before the latest says **created the role** Copy of Team Member, granting View Plan, View Features and releases, View Allocations, View People, View Feature teams.
    - The latest says **changed the role** Copy of Team Member, granting View Configuration.
  - **Notes:**

### ROLE-10: Giving an Account a Role Made Later

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-09. Step 7 signs in as another account.

**Preconditions:** Signed in with this account, after ROLE-09.

- [ ] **Step 1.** Select the **Accounts** page in the left-hand menu, and read the **Roles** column.
  - **Expected:**
    - **Team Member** row: **Team Member**
    - **Product Manager** row: **Product Manager**
    - **Feature Lead** row: **Feature Lead (default)** and **Engineering Manager**
    - **Fathom Administrator** row: **Administrator**
  - **Notes:**

- [ ] **Step 2.** Select **Edit** in the **Team Member** row.
  - **Expected:**
    - A dialog titled **Edit Team Member**, with **Name**, **Email address**, and **Roles**.
    - **Roles** lists every role in the order of the **Roles** page, **Copy of Team Member** among them, each with a tick box and its description under its name.
    - Only **Team Member** is ticked.
  - **Notes:**

- [ ] **Step 3.** Tick **Copy of Team Member**, and untick **Team Member**.
  - **Expected:** Only **Copy of Team Member** is ticked.
  - **Notes:**

- [ ] **Step 4.** Select **Save**.
  - **Expected:**
    - The dialog closes.
    - A green banner says **Saved the account for Team Member.**
    - The **Team Member** row shows **Copy of Team Member** in **Roles**.
  - **Notes:**

- [ ] **Step 5.** Select the **Roles** page in the left-hand menu.
  - **Expected:** **Copy of Team Member** has 1 account and **Team Member** has 0.
  - **Notes:**

- [ ] **Step 6.** Select the **Access history** page in the left-hand menu.
  - **Expected:** The latest entry says Fathom Administrator **changed the role of** Team Member: from Team Member to Copy of Team Member, and is marked as worth checking.
  - **Notes:**

- [ ] **Step 7.** Sign out, and sign in as the Team Member, `team.member@fathom.test`.
  - **Expected:** The left-hand menu shows **Lists** in the **People** section, which Team Member alone doesn't.
  - **Notes:**

- [ ] **Step 8.** Select the **Roles** page under **Help** in the left-hand menu.
  - **Expected:**
    - The first row is **Copy of Team Member**, with a sea-blue check before its name, and its description beside it.
    - No other row has a check.
  - **Notes:**

### ROLE-11: Names Must Differ

**Account:** Administrator, `fathom.administrator@fathom.test`, changed from ROLE-10.

**Preconditions:** **Roles** page open, signed in with this account.

- [ ] **Step 1.** Select **New role**.
  - **Expected:**
    - A dialog titled **New role**, with an empty name, no description, and nothing ticked.
    - **Pages its holders see** says **None, apart from Help.**
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

### ROLE-12: Nobody Can Lock Everyone Out

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-11.

**Preconditions:** **Roles** page open, signed in with this account.

- [ ] **Step 1.** Open the **Superuser** role, as Open a Role describes, untick **Edit** on **Roles**, and select **Save**.
  - **Expected:**
    - The confirmation says **This change affects 1 account.**
    - It lists **Superuser**, under **Loses** with **The Roles page no longer appears.**
  - **Notes:**

- [ ] **Step 2.** Select **Save changes**.
  - **Expected:** The dialog closes and a green banner says **The role has been changed.**, since the Administrator role still edits roles.
  - **Notes:**

- [ ] **Step 3.** Open the **Administrator** role, as Open a Role describes, untick **Edit** on **Roles**, and select **Save**.
  - **Expected:**
    - The confirmation says **This change affects 1 account.**
    - It lists **Fathom Administrator**, marked **(this account)**, under **Loses** with **The Roles page no longer appears.**
  - **Notes:**

- [ ] **Step 4.** Select **Save changes**.
  - **Expected:** A red box says **Some active account must keep Edit Administration**, and the dialog stays open.
  - **Notes:**

- [ ] **Step 5.** Select **Cancel**, and open the **Administrator** role again, as Open a Role describes.
  - **Expected:** **Edit** on **Roles** is still ticked; nothing changed.
  - **Notes:**

### ROLE-13: Changing Fathom's Time Zone

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-12.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select the **Settings** page in the left-hand menu.
  - **Expected:**
    - **Time zone** is set to **America/Vancouver**.
    - Under it, the day and time there, such as **It is Thursday, November 5, 2026 at 6:06 AM there.**, matching a clock in Vancouver.
    - **Save** is turned off.
  - **Notes:**

- [ ] **Step 2.** Type `Kolkata` in **Time zone**, and choose the time zone for India from the list.
  - **Expected:**
    - The line under it shows the day and time in India, matching a clock there.
    - **Save** is turned on.
  - **Notes:**

- [ ] **Step 3.** Select **Save**.
  - **Expected:**
    - A green banner says **Fathom's time zone is now** followed by the time zone chosen.
    - **Save** is turned off again.
  - **Notes:**

- [ ] **Step 4.** Select the **Access history** page in the left-hand menu.
  - **Expected:** The newest entry says **Fathom Administrator changed Fathom's time zone: from America/Vancouver to** the time zone chosen.
  - **Notes:**

- [ ] **Step 5.** Open **Settings** again, choose **America/Vancouver**, and select **Save**.
  - **Expected:** A green banner says **Fathom's time zone is now America/Vancouver.**
  - **Notes:**

### ROLE-14: Put Every Role Back

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as the account ROLE-13 ended with. Step 1 signs in again after the reset.

**Preconditions:** All the test cases above run.

- [ ] **Step 1.** Run Reset the Database, sign in as the Administrator, `fathom.administrator@fathom.test`, and select the **Roles** page in the left-hand menu.
  - **Expected:** The **Roles** page lists the roles as in ROLE-02, with no **Copy of Team Member**.
  - **Notes:**
