---
title: "Manual Test: Editing Roles"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/roles*.ts*", "apps/web/src/accounts-page.tsx", "apps/web/src/settings-page.tsx", "apps/server/src/data/settings.ts", "apps/server/src/data/role-administration.ts", "apps/server/src/routes/roles.ts", "packages/shared/src/access.ts", "packages/shared/src/roles.ts"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-13"
---

# Manual Test: Editing Roles

## Scope

Verifies the Roles page: who sees it, the list of roles, the dialog that sets what a role grants with its summary in plain English, the boxes turned off without what they need, the confirmation of what a change does to the accounts holding a role, restoring a starting role's template, resetting the boxes, copying and creating roles, giving an account a role made later, the refusals, and the access history entries that changes leave. It also verifies the Settings page, where the Administrator changes Fathom's time zone.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Administrator:** `fathom.administrator@fathom.test`, shown in Fathom as "Fathom Administrator"
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Project Manager:** `project.manager@fathom.test`
- **Team Member:** `team.member@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Reset the Database](manual-test-basics.md#reset-the-database) and [Open a Role](manual-test-basics.md#open-a-role).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the left-hand menu and the account menu. This test adds:

- **Summary:** the panel on the right of the role dialog, headed **Sees**, **Doesn't see**, **Can** and **Cannot**.
- **Tier colours:** the word **Personal** in bold orange and the word **Confidential** in bold red.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Check each step whose expected result you see, and write anything else under its notes.

### ROLE-01: Only Those Who May See Roles See the Roles Page

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case. Step `CCFB` signs in as another account.

**Preconditions:** Signed in with this account.

- [ ] `777D` Look at the left-hand menu.
  - **Expected:** There is no **Administration** section and no **Roles** page.
  - **Notes:**

- [ ] `CCFB` Sign out, and sign in as the Administrator, `fathom.administrator@fathom.test`.
  - **Expected:** The left-hand menu shows **Accounts**, **Roles** and **Settings**.
  - **Notes:**

### ROLE-02: The Roles Page Lists Every Role

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as the account ROLE-01 ended with.

**Preconditions:** Signed in with this account. **Roles** page open from the left-hand menu.

- [ ] `D783` Read the **Role** and **Accounts** columns from top to bottom.
  - **Expected:**
    - The **Role** and **Accounts** columns read, from top to bottom:
      - **Administrator** 1
      - **Engineering Director** 1
      - **Engineering Manager** 2
      - **Executive** 1
      - **Feature Lead** 1
      - **Product Manager** 1
      - **Project Manager** 1
      - **Superuser** 1
      - **Team Member** 1
      - **Workforce Administrator** 2
    - Each row ends with **Edit** and **Copy** buttons.
    - **New role** is at the top right.
  - **Notes:**

- [ ] `DE52` Read the **Description** column.
  - **Expected:**
    - **Engineering Manager** reads "Edits the plan and allocations, sees people, with everyone's Personal details, the hiring plan, and configuration, and proposes feature teams."
    - Wherever **Personal** or **Confidential** appears, it is in its tier colour.
  - **Notes:**

### ROLE-03: The Dialog Shows What a Role Grants

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-02.

**Preconditions:** Signed in with this account. **Roles** page open from the left-hand menu.

- [ ] `45ED` Open the **Project Manager** role, as Open a Role describes.
  - **Expected:**
    - A dialog titled **Edit Project Manager** shows **Name**, **Description**, and the grid.
    - **Plan:** **View**, greyed, **Approve** and **Edit** ticked
    - **Features and releases:** **View**, greyed, **Approve** and **Edit** ticked
    - **Allocations:** **View** and **Approve** ticked
    - **People:** **View** and **Approve** ticked
    - **Feature teams:** **View** and **Approve** ticked
    - **Hiring plan:** **View** and **Approve** ticked
    - **Configuration:** **View** and **Approve** ticked
    - **Administration:** nothing ticked
    - Under **Administration**, a **Data classification** heading runs across the grid.
    - **General:** **View** and **Edit** ticked and greyed, with no **Approve** box
    - **Personal:** **View** ticked
    - **Confidential:** nothing ticked
    - **Classify data**, below the grid, is unticked, with "Updates data classification of details, lists, and columns." under it.
    - **Approve own drafts** is unticked, with "Approves drafts they changed themselves, in the areas they approve, which otherwise need another approver." under it.
  - **Notes:**

- [ ] `3DFA` Read the summary.
  - **Expected:**
    - **Sees:** **Overview**, **Projects**, **Features**, **Releases**, **People**, **Org chart**, **Org chart on other dates**, **Feature assignments**, **Allocations**, **Drafts**, **Capacity**, **Lists** and **Change history**.
    - **Doesn't see:** "Org chart on future dates: needs Confidential (Future reorganizations)", "Feature assignments grouped by manager: needs Confidential (Future reorganizations)", **Accounts**, **Roles**, **Settings**, **Data classes** and **Access history**.
    - **Can:** a line for each ticked box, such as seeing the plan, approving drafts of features and releases, and seeing feature teams.
    - **Cannot** includes "Cannot change allocations.", "Cannot change feature teams.", "Cannot reclassify data." and "Cannot approve their own drafted changes."
    - **Cannot** also includes, in its tier colour, "Confidential data is hidden wherever it appears."
    - **Cannot** does not include "Personal details are hidden wherever they appear, and people who haven't started yet aren't listed."
  - **Notes:**

- [ ] `E12E` Look at the foot of the dialog.
  - **Expected:**
    - **Restore template**, **Reset**, **Cancel** and **Save** are on the right, in that order.
    - **Restore template** and **Reset** are turned off.
  - **Notes:**

### ROLE-04: Editing an Area Brings Viewing It

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-03.

**Preconditions:** Signed in with this account. **Roles** page open, with the **Edit Project Manager** dialog still open, unsaved, as ROLE-03 left it.

- [ ] `69FE` Tick **Edit** on the **Configuration** row.
  - **Expected:**
    - **View** on the **Configuration** row stays ticked.
    - It becomes greyed, and cannot be unticked.
  - **Notes:**

- [ ] `DAFA` Untick **Edit** on the **Configuration** row.
  - **Expected:** **View** on the **Configuration** row is ticked and can be unticked again.
  - **Notes:**

### ROLE-05: Unticking a Box Takes Away What Needs It, and Reset Puts It Back

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-04.

**Preconditions:** Signed in with this account. **Roles** page open, with the **Edit Project Manager** dialog still open, unsaved, as ROLE-04 left it.

- [ ] `D477` Untick **View** on the **People** row.
  - **Expected:**
    - **Approve** on **People**, **View** and **Approve** on **Feature teams** and **Hiring plan**, **View** on **Personal**, and **Classify data** are unticked and greyed.
    - Under **Sees**, **People**, **Org chart**, **Org chart on other dates** and **Feature assignments** are struck through in red.
    - Under **Doesn't see**, **People**, **Org chart** and **Feature assignments** are in bold teal.
    - Under **Doesn't see**, the two lines that need Confidential are struck through in red.
    - There is no yellow box.
  - **Notes:**

- [ ] `5B86` Tick **View** on the **People** row again.
  - **Expected:**
    - **Approve** on **People**, **View** on **Feature teams**, **Hiring plan** and **Personal** can be ticked again, and are unticked.
    - **People**, **Org chart** and **Org chart on other dates** under **Sees** are in plain text again.
    - **Feature assignments** under **Sees** is still struck through in red.
  - **Notes:**

- [ ] `7C42` Select **Reset**.
  - **Expected:**
    - The boxes are ticked as in ROLE-03 `45ED`.
    - No line in the summary is struck through or in bold teal.
    - **Reset** is turned off.
  - **Notes:**

- [ ] `A214` Select **Cancel**, then open the **Project Manager** role again, as Open a Role describes.
  - **Expected:** The dialog shows the boxes as in ROLE-03 `45ED`; nothing was saved.
  - **Notes:**

### ROLE-06: A Change Is Confirmed Before It Is Saved

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-05. Steps `F3A0` and `1D13` sign in as other accounts.

**Preconditions:** Signed in with this account. **Roles** page open, with the **Edit Project Manager** dialog still open, unsaved, as ROLE-05 left it.

- [ ] `60DE` Tick **View** on the **Administration** row, and select **Save**.
  - **Expected:**
    - The dialog says "This change affects 1 account."
    - It lists **Project Manager**, with its email address.
    - Under **Gains**: a line for each of the **Accounts**, **Roles**, **Settings** and **Access history** pages, and a sentence about seeing accounts, roles, settings and the access history.
    - **Cancel** and **Save changes** are on the right, and there is no **Back** button.
  - **Notes:**

- [ ] `346B` Select **Cancel**.
  - **Expected:**
    - The grid shows again, with **View** on **Administration** still ticked.
    - **Description** reads as it did when the dialog opened.
  - **Notes:**

- [ ] `C2FC` Select **Save**, then **Save changes**.
  - **Expected:**
    - The dialog closes.
    - A green banner says "The role has been changed."
    - The **Project Manager** row is unchanged in the list, its **Description** included.
  - **Notes:**

- [ ] `F3A0` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The left-hand menu shows **Accounts**, **Roles** and **Settings** in the **Administration** section, and **Access history** in the **History** section.
  - **Notes:**

- [ ] `1D13` Sign out, and sign in as the Administrator, `fathom.administrator@fathom.test`. Select the **Access history** page in the left-hand menu.
  - **Expected:** The latest entry says "Fathom Administrator" "changed the role" **Project Manager**, granting View Administration, and is marked as worth checking.
  - **Notes:**

### ROLE-07: Restoring a Starting Role's Template

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as the account ROLE-06 ended with.

**Preconditions:** Signed in with this account, after ROLE-06. **Roles** page open from the left-hand menu.

- [ ] `891B` Open the **Project Manager** role, as Open a Role describes.
  - **Expected:** **Restore template** is turned on, since the role no longer matches its template.
  - **Notes:**

- [ ] `131F` Select **Restore template**.
  - **Expected:**
    - **View** on **Access history** is unticked.
    - The summary changes to match.
    - **Restore template** is turned off.
    - Nothing is saved yet.
  - **Notes:**

- [ ] `FE0E` Select **Save**, then **Save changes**.
  - **Expected:**
    - The confirmation lists the same account, under **Loses** with "The Access history page no longer appears."
    - Once saved, the green banner says "The role has been changed."
  - **Notes:**

### ROLE-08: A Role's Description Stays When What It Grants Changes

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-07.

**Preconditions:** **Roles** page open.

- [ ] `EE3A` Open the **Executive** role, as Open a Role describes, and tick **Edit** on the **Plan** row.
  - **Expected:**
    - **Description** reads "Sees the plan, people, with their Personal and Confidential data and the hiring plan, configuration, accounts, roles, settings, and both histories, without changing them."
    - There is no line under **Description**.
    - **Restore template** and **Reset** are turned on.
  - **Notes:**

- [ ] `C776` Select **Reset**.
  - **Expected:**
    - **Edit** on **Plan** is unticked.
    - **Restore template** and **Reset** are turned off.
  - **Notes:**

- [ ] `F21E` Select **Cancel**.
  - **Expected:** The dialog closes, and the **Executive** row's **Description** is unchanged.
  - **Notes:**

### ROLE-09: Copying a Role

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-08.

**Preconditions:** **Roles** page open, signed in with this account.

- [ ] `1D6D` Select **Copy** in the **Team Member** row.
  - **Expected:**
    - A dialog titled **Copy Team Member**, with the name **Copy of Team Member** and Team Member's description.
    - The same boxes are ticked as Team Member: **View** on **Plan**, **Features and releases**, **Allocations**, **People** and **Feature teams**.
    - There is no **Restore template** button, and the main button is **Create role**.
  - **Notes:**

- [ ] `0D73` Select **Create role**.
  - **Expected:**
    - The dialog closes.
    - A green banner says "The role has been created."
    - **Copy of Team Member** is in the list with 0 accounts.
  - **Notes:**

- [ ] `1C6D` Open **Copy of Team Member**, as Open a Role describes, tick **View** on **Configuration**, and select **Save**.
  - **Expected:**
    - The dialog closes with "The role has been changed.", with no confirmation, since no account holds the role.
    - There is no **Restore template** button.
  - **Notes:**

- [ ] `7F08` Select the **Access history** page in the left-hand menu.
  - **Expected:**
    - The entry before the latest says "created the role" **Copy of Team Member**, granting View Plan, View Features and releases, View Allocations, View People, View Feature teams.
    - The latest says "changed the role" **Copy of Team Member**, granting View Configuration.
  - **Notes:**

### ROLE-10: Giving an Account a Role Made Later

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-09. Step `4E87` signs in as another account.

**Preconditions:** Signed in with this account, after ROLE-09.

- [ ] `47A0` Select the **Accounts** page in the left-hand menu, and read the **Roles** column.
  - **Expected:**
    - "Team Member" row: **Team Member**
    - "Product Manager" row: **Product Manager**
    - "Feature Lead" row: **Feature Lead (default)** and **Engineering Manager**
    - "Fathom Administrator" row: **Administrator**
  - **Notes:**

- [ ] `7B20` Select **Edit** in the "Team Member" row.
  - **Expected:**
    - A dialog titled "Edit Team Member", with **Name**, **Email address**, and **Roles**.
    - **Roles** lists every role in the order of the **Roles** page, **Copy of Team Member** among them, each with a tick box and its description under its name.
    - Only **Team Member** is ticked.
  - **Notes:**

- [ ] `74DF` Tick **Copy of Team Member**, and untick **Team Member**.
  - **Expected:** Only **Copy of Team Member** is ticked.
  - **Notes:**

- [ ] `92D0` Select **Save**.
  - **Expected:**
    - The dialog closes.
    - A green banner says "Saved the account for Team Member."
    - The "Team Member" row shows **Copy of Team Member** in **Roles**.
  - **Notes:**

- [ ] `826B` Select the **Roles** page in the left-hand menu.
  - **Expected:** **Copy of Team Member** has 1 account and **Team Member** has 0.
  - **Notes:**

- [ ] `46DE` Select the **Access history** page in the left-hand menu.
  - **Expected:** The latest entry says "Fathom Administrator" "changed the role of" "Team Member": from **Team Member** to **Copy of Team Member**, and is marked as worth checking.
  - **Notes:**

- [ ] `4E87` Sign out, and sign in as the Team Member, `team.member@fathom.test`.
  - **Expected:** The left-hand menu shows **Lists** in the **People** section, which Team Member alone doesn't.
  - **Notes:**

- [ ] `B83E` Select the **Roles** page under **Help** in the left-hand menu.
  - **Expected:**
    - The first row is **Copy of Team Member**, with a sea-blue check before its name, and its description beside it.
    - No other row has a check.
  - **Notes:**

### ROLE-11: Names Must Differ

**Account:** Administrator, `fathom.administrator@fathom.test`, changed from ROLE-10.

**Preconditions:** **Roles** page open, signed in with this account.

- [ ] `11D9` Select **New role**.
  - **Expected:**
    - A dialog titled **New role**, with an empty name, no description, and nothing ticked.
    - **Sees** reads "Nothing."
  - **Notes:**

- [ ] `CD73` Select **Create role** with the name empty.
  - **Expected:** "Enter a name for the role." shows under **Name**.
  - **Notes:**

- [ ] `D424` Enter `team member` as the name, and select **Create role**.
  - **Expected:** A red box in the dialog says "A role with that name already exists", and the dialog stays open.
  - **Notes:**

- [ ] `459D` Select **Cancel**.
  - **Expected:** The dialog closes, and no new role is in the list.
  - **Notes:**

### ROLE-12: Nobody Can Lock Everyone Out

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-11.

**Preconditions:** **Roles** page open, signed in with this account.

- [ ] `D693` Open the **Superuser** role, as Open a Role describes, untick **Edit** on **Administration**, and select **Save**.
  - **Expected:**
    - The confirmation says "This change affects 1 account."
    - It lists **Superuser**, under **Loses** with "The Roles page no longer appears."
  - **Notes:**

- [ ] `A5BD` Select **Save changes**.
  - **Expected:** The dialog closes and a green banner says "The role has been changed.", since the Administrator role still edits roles.
  - **Notes:**

- [ ] `67B0` Open the **Administrator** role, as Open a Role describes.
  - **Expected:** **Edit** on **Administration** is ticked and greyed, and cannot be unticked.
  - **Notes:**

- [ ] `F0AB` Select **Cancel**.
  - **Expected:** The dialog closes, and the **Administrator** row is unchanged.
  - **Notes:**

### ROLE-13: Changing Fathom's Time Zone

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-12.

**Preconditions:** Signed in with this account.

- [ ] `4CE5` Select the **Settings** page in the left-hand menu.
  - **Expected:**
    - **Time zone** is set to **America/Vancouver**.
    - Under it, the day and time there, such as "It is Thursday, November 5, 2026 at 6:06 AM there.", matching a clock in Vancouver.
    - **Save** is turned off.
  - **Notes:**

- [ ] `6AB9` Type `Kolkata` in **Time zone**, and choose the time zone for India from the list.
  - **Expected:**
    - The line under it shows the day and time in India, matching a clock there.
    - **Save** is turned on.
  - **Notes:**

- [ ] `816F` Select **Save**.
  - **Expected:**
    - A green banner says "Fathom's time zone is now" followed by the time zone chosen.
    - **Save** is turned off again.
  - **Notes:**

- [ ] `956B` Select the **Access history** page in the left-hand menu.
  - **Expected:** The newest entry says "Fathom Administrator changed Fathom's time zone: from America/Vancouver to" and the time zone chosen.
  - **Notes:**

- [ ] `69B4` Open **Settings** again, choose **America/Vancouver**, and select **Save**.
  - **Expected:** A green banner says "Fathom's time zone is now America/Vancouver."
  - **Notes:**

### ROLE-14: Put Every Role Back

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as the account ROLE-13 ended with. Step `C386` signs in again after the reset.

**Preconditions:** All the test cases above run.

- [ ] `C386` Run Reset the Database, sign in as the Administrator, `fathom.administrator@fathom.test`, and select the **Roles** page in the left-hand menu.
  - **Expected:** The **Roles** page lists the roles as in ROLE-02, with no **Copy of Team Member**.
  - **Notes:**
