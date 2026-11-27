---
title: "Manual Test: Editing Roles"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/roles*.ts*", "apps/web/src/accounts-page.tsx", "apps/web/src/settings-page.tsx", "apps/server/src/data/settings.ts", "apps/server/src/data/role-administration.ts", "apps/server/src/routes/roles.ts", "packages/shared/src/access.ts", "packages/shared/src/roles.ts"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/administration.md"]
last_updated: "2026-11-27"
---

# Manual Test: Editing Roles

## Scope

Verifies the Roles page:

- Who sees it, and the list of roles.
- The dialog that sets what a role grants with its summary in plain English.
- The boxes turned off without what they need.
- The confirmation of what a change does to the accounts holding a role.
- Restoring a starting role's template, and resetting the boxes.
- Copying and creating roles, and giving an account a role made later.

It also verifies the Application settings page, where the Administrator changes Fathom's time zone. The refusals and the access history's wording are proved by automated tests; ROLE-06 checks one entry on screen.

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
- **Class mark:** as [Manual Test Basics](manual-test-basics.md#terms) sets out, here before the word **Personal** or **Confidential** in a line of the summary.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### ROLE-01: Only Those Who May See Roles See the Roles Page

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case. Step `CCFB` signs in as another account.

**Preconditions:** Signed in with this account.

- [ ] `777D` Look at the left-hand menu.
  - **Expected:** The **Administration** section shows only **Lists**, **Planning settings** and **Data classes**, with no **Roles** page.
  - **Notes:**

- [ ] `CCFB` Sign out, and sign in as the Administrator, `fathom.administrator@fathom.test`.
  - **Expected:** The left-hand menu shows **Accounts**, **Roles** and **Application settings**.
  - **Notes:**

### ROLE-02: The Roles Page Lists Every Role

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as the account ROLE-01 ended with.

**Preconditions:** Signed in with this account. **Roles** page open from the left-hand menu.

- [ ] `D783` Read the **Role** and **Accounts** columns from top to bottom.
  - **Expected:**
    - The **Role** and **Accounts** columns read, from top to bottom:
      - **Administrator** 2
      - **Engineering Director** 2
      - **Engineering Manager** 3
      - **Executive** 2
      - **Feature Lead** 2
      - **Product Manager** 2
      - **Project Manager** 2
      - **Superuser** 1
      - **Team Member** 2
      - **Workforce Administrator** 3
    - Each row ends with **Edit** and **Copy** buttons.
    - **New role** is at the top right.
  - **Notes:**

- [ ] `DE52` Read the **Description** column.
  - **Expected:**
    - **Engineering Manager** reads "Edits the plan and allocations, sees people, with everyone's Personal and Confidential data, the hiring plan, and configuration, and edits feature teams and which team each feature has."
    - **Personal** and **Confidential** are in the same plain text as the rest of the description, with no class mark.
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
    - **Confidential:** **View** ticked
    - **Classify data**, below the grid, is unticked, with "Updates data classification of details, lists, and columns." under it.
    - **Approve own drafts** is unticked, with "Approves drafts they changed themselves, in the areas they approve, which otherwise need another approver." under it.
  - **Notes:**

- [ ] `3DFA` Read the summary.
  - **Expected:**
    - **Sees:** **Projects**, **Features**, **Activities**, **Releases**, **People**, **People on other dates**, **People on future dates**, **Org chart**, **Org chart on other dates**, **Org chart on future dates**, **Capacity**, **Feature teams**, **Feature teams grouped by manager**, **Allocations grouped by manager**, **Allocations**, **Lists**, **Planning settings**, **Drafts** and **Change history**.
    - **Doesn't see:** **Accounts**, **Roles**, **Application settings**, **Data classes** and **Access history**.
    - **Can:** a line for each ticked box, such as seeing the plan, approving drafts of features and releases, and seeing feature teams.
    - **Cannot** includes "Cannot change allocations.", "Cannot change feature teams or which team a feature has.", "Cannot reclassify data." and "Cannot approve their own drafted changes."
    - **Cannot** also includes "Cannot change Confidential data.", with the class mark before **Confidential**.
    - **Cannot** includes neither "Personal details are hidden wherever they appear, and people who haven't started yet aren't listed." nor "Confidential data is hidden wherever it appears."
  - **Notes:**

- [ ] `E12E` Look at the foot of the dialog.
  - **Expected:**
    - **Restore template**, **Reset**, **Cancel** and **Save** are on the right, in that order.
    - **Restore template** and **Reset** are turned off.
  - **Notes:**

### ROLE-04: Editing an Area Brings Viewing It

Proved by automated tests in `apps/web/src/roles-page-permissions.test.tsx`.

### ROLE-05: Unticking a Box Takes Away What Needs It, and Reset Puts It Back

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-03.

**Preconditions:** Signed in with this account. **Roles** page open, with the **Edit Project Manager** dialog still open, unsaved, as ROLE-03 left it.

- [ ] `D477` Untick **View** on the **People** row.
  - **Expected:**
    - **Approve** on **People**, **View** and **Approve** on **Feature teams** and **Hiring plan**, **View** on **Personal** and **Confidential**, and **Classify data** are unticked and greyed.
    - Under **Sees**, **People**, **People on other dates**, **People on future dates**, **Org chart**, **Org chart on other dates**, **Org chart on future dates**, **Feature teams**, **Feature teams grouped by manager**, **Allocations grouped by manager** and **Allocations** are struck through in red.
    - Under **Doesn't see**, **People** and **Org chart** are in bold teal.
    - Under **Doesn't see**, these lines are in bold teal:
      - one starting "Allocations: needs View Feature teams, View People"
      - one starting "Allocations grouped by manager: needs View Feature teams, View People"
  - **Notes:**

- [ ] `5B86` Tick **View** on the **People** row again.
  - **Expected:**
    - **Approve** on **People**, **View** on **Feature teams**, **Hiring plan**, **Personal** and **Confidential** can be ticked again, and are unticked.
    - **People** and **Org chart** under **Sees** are in plain text again.
    - **People on other dates**, **People on future dates**, **Org chart on other dates**, **Org chart on future dates**, **Feature teams**, **Feature teams grouped by manager**, **Allocations grouped by manager** and **Allocations** under **Sees** are still struck through in red.
  - **Notes:**

- [ ] `7C42` Select **Reset**.
  - **Expected:**
    - The boxes are ticked as in ROLE-03 `45ED`.
    - No line in the summary is struck through or in bold teal.
    - **Reset** is turned off.
  - **Notes:**

### ROLE-06: A Change Is Confirmed Before It Is Saved

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-05. Steps `F3A0` and `78CA` sign in as other accounts.

**Preconditions:** Signed in with this account. **Roles** page open, with the **Edit Project Manager** dialog still open, unsaved, as ROLE-05 left it.

- [ ] `2662` Tick **View** on the **Administration** row.
  - **Expected:** Under **Sees**, **Accounts**, **Roles**, **Application settings** and **Access history** are in bold teal.
  - **Notes:**

- [ ] `60DE` Select **Save**.
  - **Expected:**
    - The dialog, still titled **Edit Project Manager**, says "This change affects 2 accounts."
    - It lists **Project Manager** and **Superuser**, each with its email address.
    - Under **Gains** for each: a line for each of the **Accounts**, **Roles**, **Application settings** and **Access history** pages, and a sentence about seeing accounts, roles, settings and the access history.
    - **Cancel** and **Save changes** are on the right, and there is no **Back** button.
  - **Notes:**

- [ ] `C2FC` Select **Save changes**.
  - **Expected:**
    - The dialog closes.
    - A notification says "The role has been changed."
    - The **Project Manager** row is unchanged in the list, its **Description** included.
  - **Notes:**

- [ ] `F3A0` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The left-hand menu shows **Accounts**, **Roles** and **Application settings** in the **Administration** section, and **Access history** in the **History** section.
  - **Notes:**

- [ ] `78CA` Sign out, and sign in as the Administrator, `fathom.administrator@fathom.test`.
  - **Expected:** The left-hand menu shows **Access history** in the **History** section.
  - **Notes:**

- [ ] `1D13` Select the **Access history** page in the left-hand menu.
  - **Expected:**
    - The latest entry says "Fathom Administrator" "changed the role" **Project Manager**, granting View Administration
    - It ends in a grey **Worth checking** box
  - **Notes:**

### ROLE-07: Restoring a Starting Role's Template

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as the account ROLE-06 ended with.

**Preconditions:** Signed in with this account, after ROLE-06. **Roles** page open from the left-hand menu.

- [ ] `891B` Open the **Project Manager** role, as Open a Role describes.
  - **Expected:** **Restore template** is turned on.
  - **Notes:**

- [ ] `131F` Select **Restore template**.
  - **Expected:**
    - **View** on **Administration** is unticked.
    - The summary changes to match.
    - **Restore template** is turned off.
    - Nothing is saved yet.
  - **Notes:**

- [ ] `CCBE` Select **Save**.
  - **Expected:** The confirmation lists **Project Manager** and **Superuser**, each with "The Access history page no longer appears." among the lines under **Loses**.
  - **Notes:**

- [ ] `FE0E` Select **Save changes**.
  - **Expected:** A notification says "The role has been changed."
  - **Notes:**

### ROLE-08: A Role's Description Stays When What It Grants Changes

Proved by automated tests in `apps/web/src/roles-page.test.tsx`.

### ROLE-09: Copying a Role

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-07.

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
    - A notification says "The role has been created."
    - **Copy of Team Member** is in the list with 0 accounts.
  - **Notes:**

- [ ] `7805` Open **Copy of Team Member**, as Open a Role describes.
  - **Expected:** There is no **Restore template** button.
  - **Notes:**

- [ ] `E6AE` Tick **View** on the **Configuration** row.
  - **Expected:** Under **Sees**, **Lists** and **Planning settings** are in bold teal.
  - **Notes:**

- [ ] `1C6D` Select **Save**.
  - **Expected:**
    - The dialog closes, with no confirmation
    - A notification says "The role has been changed."
  - **Notes:**

### ROLE-10: Giving an Account a Role Made Later

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as ROLE-09. Step `4E87` signs in as another account.

**Preconditions:** Signed in with this account, after ROLE-09.

- [ ] `47A0` Select the **Accounts** page in the left-hand menu.
  - **Expected:** The **Accounts** page opens, with the "Team Member" row reading **Team Member** in **Roles**.
  - **Notes:**

- [ ] `6EA5` Select the details button at the right of the **Name** cell of "Team Member".
  - **Expected:** A side panel headed **Team Member** opens beside the table, with **Edit…** under its **Details** section.
  - **Notes:**

- [ ] `7B20` Select **Edit…** in the side panel.
  - **Expected:**
    - A dialog titled "Edit Team Member", with **Name**, **Email address**, and **Roles**.
    - **Roles** lists every role, **Copy of Team Member** among them, each with a tick box and its description under its name.
    - Only **Team Member** is ticked.
  - **Notes:**

- [ ] `74DF` Tick **Copy of Team Member**.
  - **Expected:**
    - **Copy of Team Member** and **Team Member** are ticked
    - **Default role** shows under the role list
  - **Notes:**

- [ ] `8170` Untick **Team Member**.
  - **Expected:**
    - Only **Copy of Team Member** is ticked
    - **Default role** is gone
  - **Notes:**

- [ ] `92D0` Select **Save**.
  - **Expected:**
    - The dialog closes.
    - A notification says "Saved the account for Team Member."
    - The "Team Member" row shows **Copy of Team Member** in **Roles**.
  - **Notes:**

- [ ] `826B` Select the **Roles** page in the left-hand menu.
  - **Expected:** **Copy of Team Member** has 1 account, and **Team Member** has 1, the Superuser.
  - **Notes:**

- [ ] `4E87` Sign out, and sign in as the Team Member, `team.member@fathom.test`.
  - **Expected:** The **Administration** section of the left-hand menu shows only **Lists** and **Planning settings**.
  - **Notes:**

### ROLE-11: Names Must Differ

Proved by automated tests in `apps/server/src/roles.test.ts` and `apps/web/src/roles-page-changes.test.tsx`.

### ROLE-12: Nobody Can Lock Everyone Out

**Account:** Administrator, `fathom.administrator@fathom.test`, changed from ROLE-10.

**Preconditions:** Signed in with this account. **Roles** page open from the left-hand menu.

- [ ] `9029` Open the **Superuser** role, as Open a Role describes.
  - **Expected:** A dialog titled **Edit Superuser** opens.
  - **Notes:**

- [ ] `6636` Untick **Edit** on the **Administration** row.
  - **Expected:** **Edit** on the **Administration** row is unticked.
  - **Notes:**

- [ ] `D693` Select **Save**.
  - **Expected:**
    - The confirmation says "This change affects 1 account."
    - It lists **Superuser**, with "Cannot manage accounts, roles, or settings." under **Loses**
  - **Notes:**

- [ ] `A5BD` Select **Save changes**.
  - **Expected:**
    - The dialog closes
    - A notification says "The role has been changed."
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

- [ ] `4CE5` Select the **Application settings** page in the left-hand menu.
  - **Expected:**
    - **Time zone** is set to **America/Vancouver**.
    - Under it, the day and time there, such as "It is Thursday, November 5, 2026 at 6:06 AM there.", matching a clock in Vancouver.
    - **Save** under **Time zone** is turned off.
  - **Notes:**

- [ ] `6AB9` Type `Kolkata` in **Time zone**, and choose the time zone for India from the list.
  - **Expected:**
    - The line under it shows the day and time in India, matching a clock there.
    - **Save** under **Time zone** is turned on.
  - **Notes:**

- [ ] `816F` Select **Save** under **Time zone**.
  - **Expected:**
    - A notification says "Fathom's time zone is now" followed by the time zone chosen.
    - **Save** is turned off again.
  - **Notes:**

### ROLE-14: Put Every Role Back

**Account:** Administrator, `fathom.administrator@fathom.test`, the same as the account ROLE-13 ended with. Step `4028` signs in again after the reset.

**Preconditions:** All the test cases above run.

- [ ] `4028` Run Reset the Database, signing in again as the Administrator, `fathom.administrator@fathom.test`.
  - **Expected:** Fathom opens, with the **Administration** section in the left-hand menu.
  - **Notes:**

- [ ] `C386` Select the **Roles** page in the left-hand menu.
  - **Expected:** The **Roles** page lists the roles as [Roles](../product/roles.md#starting-roles) sets out, and the Superuser role, with no **Copy of Team Member**.
  - **Notes:**
