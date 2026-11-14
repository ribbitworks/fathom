---
title: "Manual Test: Acceptance, Setting Up Fathom"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/db/migrations/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/help/setting-up-fathom.md", "docs/product/roles.md"]
last_updated: "2026-11-14"
---

# Manual Test: Acceptance, Setting Up Fathom

## Scope

Verifies that a Workforce Administrator can set up a brand-new Fathom as [Setting Up Fathom](../help/setting-up-fathom.md) describes, from an empty database. The Administrator makes the account and sets the time zone. The Workforce Administrator then adds the lists and a column, the people, their managers and team names, a release stream, the working time, and feature teams recorded from six months ago, each round approved before the next. A Team Member reads the organization that results. It is the first acceptance test; [Work Between Roles](acceptance-work-between-roles-manual-test.md) runs straight after it, on the organization it sets up.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A browser window at least 1,440 pixels wide.
- A plain text editor, for typing lines to copy and paste into a table.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Administrator:** `fathom.administrator@fathom.test`, shown in Fathom as "Fathom Administrator"
- **Project Manager:** `project.manager@fathom.test`
- **Engineering Director:** `engineering.director@fathom.test`
- **Team Member:** `team.member@fathom.test`

This test creates:

- **Planning lead account:** `fictional.planning.lead@fathom.test`, shown in Fathom as `Fictional Planning Lead`. SETUP-01 creates it with the Workforce Administrator role, and its password is the one SETUP-01 shows, until SETUP-02 changes it to `fictional password 3`.

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Start From an Empty Database](manual-test-basics.md#start-from-an-empty-database), [Reset the Database](manual-test-basics.md#reset-the-database) and [Publish](manual-test-basics.md#publish).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the account menu, marks, the Publish button, the finder, the teams switch and the team panel. This test adds:

- **Typed dates:** unlike the Basics' dates, this test's steps type dates as digits with no separators, such as `20270101`.
- **Months from today:** the steps name months by where they fall from the current month: **next month** is the one after it, **six months ago** the sixth month before it, and **three months from now** the third month after it. The steps type a month's first day as digits; the examples after "such as" are for a run in November 2026, such as `20260501` for the first day of six months ago.
- **Next year:** the year after the current one. Its first cycles are named by its last two digits and their number, such as "27.1" for the first in 2027; the examples after "such as" are for a run in 2026.
- **Empty row:** the row at the end of a table or a list's panel, with blank cells, where a new record or choice is typed or pasted.
- **Date box:** the box labelled **Date** between the **Org chart** heading and the chart, before the left arrow, timeline, right arrow and **Today**.

## Test Cases

Run the test cases in order, in about 30 minutes. Start with Start Fathom, then Start From an Empty Database. Check each step whose expected result you see, and write anything else under its notes. [Work Between Roles](acceptance-work-between-roles-manual-test.md) follows on from the last test case.

### SETUP-01: The Administrator Makes the Account and Sets the Time Zone

**Account:** Administrator, `fathom.administrator@fathom.test`; the first test case.

**Preconditions:** Start From an Empty Database run. Signed in with this account.

- [ ] `734C` Select the **Accounts** page in the left-hand menu.
  - **Expected:**
    - The table lists the development accounts, as [Development Setup](../design/development-setup.md#development-accounts) lists them, and no other.
    - The filter beside the search box reads "All 12", "Active 12" and "Deactivated 0".
  - **Notes:**

- [ ] `4B6E` Select **New account**.
  - **Expected:** A dialog titled "New account" opens.
  - **Notes:**

- [ ] `0EA3` Type `Fictional Planning Lead` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `B9C8` Type `fictional.planning.lead@fathom.test` in **Email address**.
  - **Expected:** **Email address** shows what was typed.
  - **Notes:**

- [ ] `EF4E` Under **Roles**, tick **Workforce Administrator**.
  - **Expected:**
    - **Workforce Administrator** is ticked.
    - **Default role** is under the roles.
  - **Notes:**

- [ ] `10F7` Untick **Team Member**.
  - **Expected:**
    - Only **Workforce Administrator** is ticked.
    - **Default role** is gone.
  - **Notes:**

- [ ] `769F` Select **Create account**.
  - **Expected:** The dialog is titled "Password for Fictional Planning Lead".
  - **Notes:**

- [ ] `D6BB` Select the eye button, and write the password down.
  - **Expected:** The eye button shows the password.
  - **Notes:**

- [ ] `2C7B` Select **Done**.
  - **Expected:**
    - A green banner says "Created the account for Fictional Planning Lead."
    - The row's **Roles** cell shows **Workforce Administrator**.
  - **Notes:**

- [ ] `22C7` Select the **Settings** page in the left-hand menu.
  - **Expected:**
    - **Time zone** reads "America/Vancouver".
    - Under it, "It is" and the time there.
  - **Notes:**

- [ ] `1B7E` Type `Los` in **Time zone**, and choose **America/Los_Angeles**.
  - **Expected:** **Time zone** reads "America/Los_Angeles".
  - **Notes:**

- [ ] `F2EC` Select **Save**.
  - **Expected:** A notification says "Fathom's time zone is now America/Los_Angeles."
  - **Notes:**

### SETUP-02: The Planning Lead Signs In for the First Time

**Account:** Workforce Administrator, `fictional.planning.lead@fathom.test`, shown in Fathom as `Fictional Planning Lead`, changed from SETUP-01.

**Preconditions:** SETUP-01 done.

- [ ] `5B98` Sign out, and sign in as `fictional.planning.lead@fathom.test`, with the password written down in SETUP-01.
  - **Expected:** A panel headed **Change password** says "Fathom generated this password. A new password is required to continue."
  - **Notes:**

- [ ] `D427` Enter the password written down in **Current password**.
  - **Expected:** **Current password** is filled in.
  - **Notes:**

- [ ] `B751` Enter `fictional password 3` in **New password**.
  - **Expected:** **New password** is filled in.
  - **Notes:**

- [ ] `FA62` Enter `fictional password 3` in **New password again**.
  - **Expected:** **New password again** is filled in.
  - **Notes:**

- [ ] `743B` Select **Change password**.
  - **Expected:**
    - A green banner says "The password has been changed, and every other session has been signed out."
    - Fathom opens with the left-hand menu.
  - **Notes:**

### SETUP-03: The Lists and a Column Are Added and Approved

**Account:** Workforce Administrator, `fictional.planning.lead@fathom.test`, shown in Fathom as `Fictional Planning Lead`, the same as SETUP-02. Step `E199` signs in as another account.

**Preconditions:** SETUP-02 done.

- [ ] `589D` Select the **People** page in the left-hand menu.
  - **Expected:**
    - The table has its column names and only the empty row.
    - The count above the table reads "0 people".
  - **Notes:**

- [ ] `9D63` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The page reads "Nobody is on the org chart yet."
  - **Notes:**

- [ ] `F312` Select the **Change history** page in the left-hand menu.
  - **Expected:** The page reads "No changes yet to data this account can see."
  - **Notes:**

- [ ] `AC44` Select the **Lists** page in the left-hand menu.
  - **Expected:** **Positions** and **Hiring states** are among the lists, each with a grey **Built in** box.
  - **Notes:**

- [ ] `529D` Select **Positions**.
  - **Expected:**
    - The panel opens with **Positions** at the top.
    - Its choices are **Employee** and **Manager**.
    - An empty row is under them.
  - **Notes:**

- [ ] `0AE7` Type `Software Engineer` in the empty row's **Name** box, and press Enter.
  - **Expected:** A row `Software Engineer` is above the empty row, with a hollow yellow dot in its slot.
  - **Notes:**

- [ ] `A97C` Select **Hiring states**.
  - **Expected:** Its choices are, from the top, each beside its meaning:
    - **Request to hire**, "Proposed"
    - **Approved to hire**, "Open"
    - **Hired**, "Hired"
    - **Left**, "Left"
  - **Notes:**

- [ ] `3FD4` Select **New list**.
  - **Expected:**
    - A dialog titled "New list" opens.
    - It has **Name**, **Description (optional)** and **Class**.
    - **Class** offers **General**, **Personal** and **Confidential**.
  - **Notes:**

- [ ] `EC4F` Type `Sites` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `2EE5` Leave **General** chosen under **Class**, and select **Create list**.
  - **Expected:**
    - The dialog closes.
    - The panel opens with `Sites` at the top.
    - The cursor is in the empty row's **Name** box.
  - **Notes:**

- [ ] `9EC0` Type `Harbourside`, and press Enter.
  - **Expected:**
    - A row `Harbourside` is added, with a hollow yellow dot in its slot.
    - The cursor is in the empty row's **Name** box again.
  - **Notes:**

- [ ] `0E1A` Type `Northmere`, and press Enter.
  - **Expected:** `Harbourside` and `Northmere` are listed, each with a hollow yellow dot in its slot.
  - **Notes:**

- [ ] `65A5` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `0C5D` Select **New column**.
  - **Expected:**
    - A dialog titled "New column" opens.
    - **Type** reads "Choice from a list".
  - **Notes:**

- [ ] `5BC8` Type `Site` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `66D2` Choose **Sites (new)** in **List**.
  - **Expected:** **List** reads "Sites (new)".
  - **Notes:**

- [ ] `3E18` Select **Add column**.
  - **Expected:**
    - The dialog closes.
    - A **Site** column is at the right end of the table.
    - A hollow yellow dot is before its name.
  - **Notes:**

- [ ] `D0C5` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `E199` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `E4BB` Select the **Drafts** page in the left-hand menu.
  - **Expected:** Five entries are shown, each with a checkbox, one each for:
    - the choices `Software Engineer`, `Harbourside` and `Northmere`
    - the list `Sites`
    - the column `Site`
  - **Notes:**

- [ ] `97E9` Tick **Select all waiting**.
  - **Expected:** A button reads **Approve 5 drafts…**.
  - **Notes:**

- [ ] `E55E` Select **Approve 5 drafts…**.
  - **Expected:** A dialog titled "Approve 5 drafts?" opens.
  - **Notes:**

- [ ] `29D0` Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads "Approved 5 drafts."
    - The page says "No drafts waiting for approval."
  - **Notes:**

### SETUP-04: People Are Pasted Into an Empty People Table and Approved

**Account:** Workforce Administrator, `fictional.planning.lead@fathom.test`, shown in Fathom as `Fictional Planning Lead`, changed from SETUP-03. Step `83E3` signs in as another account.

**Preconditions:** SETUP-03 done. Signed in with this account, with `fictional password 3`. In the text editor, seven lines, typed with the Tab key where shown:

- `Odile Brandt`, Tab, `EMP-100`, Tab, `Manager`, Tab, `Hired`
- `Ada Quill`, Tab, `EMP-101`, Tab, `Manager`, Tab, `Hired`
- `Bram Oakes`, Tab, `EMP-102`, Tab, `software engineer`, Tab, `Hired`
- `Cleo Marsh`, Tab, `EMP-103`, Tab, `Employee`, Tab, `Hired`
- `Dara Finch`, Tab, `EMP-104`, Tab, `Employee`, Tab, `Hired`
- `Emil Stone`, Tab, `EMP-105`, Tab, `Employee`, Tab, `Hired`
- `Freya Holt`, Tab, `EMP-106`, Tab, `Employee`, Tab, `Hired`

- [ ] `E567` Select the **People** page in the left-hand menu.
  - **Expected:**
    - The **People** page opens.
    - **Site** has no dot before its name.
  - **Notes:**

- [ ] `2C0F` Copy the seven lines from the text editor.
  - **Expected:** The seven lines are highlighted in the text editor.
  - **Notes:**

- [ ] `14CF` In Fathom, select the **Name** cell of the empty row.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `49C3` Paste.
  - **Expected:**
    - Seven rows are added, one for each line.
    - Each row has its ID.
    - `Bram Oakes` reads "Software Engineer" in **Position**, and each other row `Manager` or `Employee`.
    - Each row reads `Hired` in **State**.
    - Each row has a hollow yellow dot in its slot.
    - The count reads "7 people".
  - **Notes:**

- [ ] `E018` Click once in the **Manager?** cell of `Odile Brandt`.
  - **Expected:** Her box is checked.
  - **Notes:**

- [ ] `FB00` Click once in the **Manager?** cell of `Ada Quill`.
  - **Expected:**
    - Both boxes are checked.
    - The other rows' boxes stay clear.
  - **Notes:**

- [ ] `8F42` Select the **Site** cell of `Odile Brandt`, press Enter, choose `Harbourside`, and press Enter.
  - **Expected:** The cell reads `Harbourside`.
  - **Notes:**

- [ ] `2B67` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

- [ ] `83E3` Sign out, and sign in as the Project Manager, `project.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Project Manager".
  - **Notes:**

- [ ] `FE50` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] `A5E6` Tick **Select all waiting**.
  - **Expected:** A button reads **Approve 7 drafts…**.
  - **Notes:**

- [ ] `6FA2` Select **Approve 7 drafts…**.
  - **Expected:** A dialog titled "Approve 7 drafts?" opens.
  - **Notes:**

- [ ] `E674` Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads "Approved 7 drafts."
    - The page says "No drafts waiting for approval."
  - **Notes:**

### SETUP-05: Reporting Lines, Team Names and a Planned Hire Are Added

**Account:** Workforce Administrator, `fictional.planning.lead@fathom.test`, shown in Fathom as `Fictional Planning Lead`, changed from SETUP-04. Step `2E1D` signs in as another account.

**Preconditions:** SETUP-04 done. Signed in with this account. **People** page open.

- [ ] `C588` Select the **Manager** cell of `Bram Oakes`, press Enter, type `Ada`, and choose `Ada Quill`.
  - **Expected:**
    - The **Manager** cell reads `Ada Quill`, with a hollow yellow dot before it.
    - **Manager assigned** holds today's date.
  - **Notes:**

- [ ] `3BB2` Select the **Manager** cell of `Cleo Marsh`, press Enter, type `Ada`, and choose `Ada Quill`.
  - **Expected:** The **Manager** cell of `Cleo Marsh` reads `Ada Quill`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `B5C2` Select the **Manager** cell of `Freya Holt`, press Enter, type `Ada`, and choose `Ada Quill`.
  - **Expected:** The **Manager** cell of `Freya Holt` reads `Ada Quill`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `054C` Select the **Manager** cell of `Ada Quill`, press Enter, type `Odile`, and choose `Odile Brandt`.
  - **Expected:** The **Manager** cell of `Ada Quill` reads `Odile Brandt`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `3E56` Select the **Manager** cell of `Dara Finch`, press Enter, type `Odile`, and choose `Odile Brandt`.
  - **Expected:** The **Manager** cell of `Dara Finch` reads `Odile Brandt`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `CD87` Select the **Manager** cell of `Emil Stone`, press Enter, type `Odile`, and choose `Odile Brandt`.
  - **Expected:**
    - Each of the six rows reads its new manager, with a hollow yellow dot before it.
    - `Odile Brandt` has no manager.
  - **Notes:**

- [ ] `F715` Select the **Team name** cell of `Odile Brandt`, type `Keepers`, and press Enter.
  - **Expected:** The cell reads `Keepers`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `E52A` Select the **Team name** cell of `Ada Quill`, type `Lamp crew`, and press Enter.
  - **Expected:** The cell reads `Lamp crew`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `564E` Select **New person** at the top right of the page.
  - **Expected:** The details panel opens, headed **New person**.
  - **Notes:**

- [ ] `97D3` Select the change button beside **State**, and choose **Request to hire**.
  - **Expected:** **State** reads "Request to hire".
  - **Notes:**

- [ ] `7C2B` Type `Fictional tide engineer` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `15E7` Type `REQ-7001` in **ID**.
  - **Expected:** **ID** shows what was typed.
  - **Notes:**

- [ ] `970E` Type the first day of three months from now in **Start**, such as `20270201`.
  - **Expected:** **Start** shows the date typed.
  - **Notes:**

- [ ] `DC04` Choose **Employee** in **Position** from its change button.
  - **Expected:** **Position** reads "Employee".
  - **Notes:**

- [ ] `F63E` Choose `Ada Quill` in **Manager** from its change button.
  - **Expected:** **Manager** reads `Ada Quill`.
  - **Notes:**

- [ ] `35BF` Select **Add**.
  - **Expected:**
    - The panel shows `Fictional tide engineer`.
    - Its row reads "Request to hire" in **State** and `Ada Quill` in **Manager**.
    - Its row has a hollow yellow dot in its slot.
  - **Notes:**

- [ ] `71A5` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

- [ ] `2E1D` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `9A27` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] `5B3B` Tick **Select all waiting**.
  - **Expected:** A button reads **Approve 8 drafts…**.
  - **Notes:**

- [ ] `EEF7` Select **Approve 8 drafts…**.
  - **Expected:** A dialog titled "Approve 8 drafts?" opens.
  - **Notes:**

- [ ] `CC83` Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads "Approved 8 drafts."
    - The page says "No drafts waiting for approval."
  - **Notes:**

- [ ] `9D2E` Select the **People** page in the left-hand menu.
  - **Expected:**
    - No row has a dot.
    - **Team** reads `Lamp crew` for `Bram Oakes`, `Cleo Marsh`, `Freya Holt` and `Fictional tide engineer`.
    - **Team** reads `Keepers` for `Ada Quill`, `Dara Finch` and `Emil Stone`.
  - **Notes:**

### SETUP-06: A Release Stream Is Set Up With Its Cycles

**Account:** Workforce Administrator, `fictional.planning.lead@fathom.test`, shown in Fathom as `Fictional Planning Lead`, changed from SETUP-05.

**Preconditions:** SETUP-05 done. Signed in with this account.

- [ ] `C990` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The page reads "No release streams yet."
    - A **New release stream** button is at the top right.
  - **Notes:**

- [ ] `2A4A` Select **New release stream**.
  - **Expected:** A dialog titled "New release stream" opens.
  - **Notes:**

- [ ] `55CC` Type `Fictional Mainline` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `FD5B` Select **Add stream**.
  - **Expected:**
    - A notification says "Drafted the new release stream."
    - The side panel is headed with a hollow yellow dot before `Fictional Mainline`.
    - "No cycles yet." is under **Cycle schedule**.
    - "No releases yet." is under **Releases**.
  - **Notes:**

- [ ] `BC71` Select **Set up cycles…**.
  - **Expected:** A dialog titled "Set up cycles for Fictional Mainline" opens.
  - **Notes:**

- [ ] `46F8` Type the first day of next year in **First cycle starts**, such as `20270101`, leaving **Each cycle lasts** at `3`, **Months**, and **Names** at `{YY}.{N}`.
  - **Expected:**
    - Under **First cycles**, the first row reads next year's first cycle and its dates, January 1 to March 31, such as "27.1", "2027-01-01 to 2027-03-31".
    - The second row reads its second cycle, April 1 to June 30, such as "27.2", "2027-04-01 to 2027-06-30".
    - The third row reads its third cycle, July 1 to September 30, such as "27.3", "2027-07-01 to 2027-09-30".
  - **Notes:**

- [ ] `C0C7` Select **Set up cycles**.
  - **Expected:**
    - A notification says "Drafted the cycles."
    - Under **Cycle schedule**, a row reads "From" and the first day of next year, such as "From 2027-01-01", then "Every 3 months, named {YY}.{N}".
  - **Notes:**

### SETUP-07: The Working Time Is Set

**Account:** Workforce Administrator, `fictional.planning.lead@fathom.test`, shown in Fathom as `Fictional Planning Lead`, the same as SETUP-06.

**Preconditions:** SETUP-06 done.

- [ ] `B90F` Select the **Capacity** page in the left-hand menu.
  - **Expected:** The mode switch reads **People** and **Settings**.
  - **Notes:**

- [ ] `24D1` Select **Settings** in the mode switch.
  - **Expected:** Under **Working time**, the rows read, from the top:
    - **Hours a day**: "8"
    - **Working days a week**: "5"
    - **Working days a month**: "20"
  - **Notes:**

- [ ] `EE06` Select "8" beside **Hours a day**.
  - **Expected:**
    - A field in place of "8" holds "8".
    - The focus is in the field.
  - **Notes:**

- [ ] `22C8` Replace the value with `7`, and press Enter.
  - **Expected:**
    - **Hours a day** reads "7" after a hollow yellow mark.
    - Under it, "8" follows a green mark.
  - **Notes:**

### SETUP-08: Feature Teams Are Recorded From Six Months Ago and Approved

**Account:** Workforce Administrator, `fictional.planning.lead@fathom.test`, shown in Fathom as `Fictional Planning Lead`, the same as SETUP-07. Step `D62C` signs in as another account.

**Preconditions:** SETUP-07 done.

- [ ] `4B09` Select the **Feature assignments** page in the left-hand menu.
  - **Expected:** The page is headed **Feature assignments**.
  - **Notes:**

- [ ] `6ACD` Select **Feature team** in the Group by menu.
  - **Expected:**
    - Every person is listed under **No feature team**.
    - No cell in any month holds a label.
  - **Notes:**

- [ ] `3E43` Select the **Org chart** page in the left-hand menu.
  - **Expected:**
    - The chart opens.
    - The **Date** box shows today.
  - **Notes:**

- [ ] `3BD9` Choose **Feature teams** in the teams switch.
  - **Expected:** **Feature teams** is chosen in the teams switch.
  - **Notes:**

- [ ] `BEB3` Clear the **Date** box, type the first day of six months ago, such as `20260501`, and press Enter.
  - **Expected:** Below the date row, text reads "Showing" and that day, such as "Showing May 1, 2026.", then "Changes take effect from this date."
  - **Notes:**

- [ ] `9E28` Select the Feature teams button.
  - **Expected:**
    - The menu reads "No feature teams yet".
    - Under it is **New feature team**.
  - **Notes:**

- [ ] `1E9E` Select **New feature team**.
  - **Expected:**
    - A panel titled **New feature team** opens.
    - A **Details** section has a **Name** row with an empty box.
    - A **Members** section has the rows **Feature lead** and **Members**, each with a change button.
    - **Cancel** and **Add** are at the foot.
  - **Notes:**

- [ ] `8D60` Type `Tide team` in the **Name** box.
  - **Expected:** The **Name** box holds `Tide team`.
  - **Notes:**

- [ ] `57EB` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `717F` Type `Ada`, and press Enter.
  - **Expected:** `Ada Quill` has a tick.
  - **Notes:**

- [ ] `E415` Type `Bram`, and press Enter.
  - **Expected:** `Bram Oakes` has a tick.
  - **Notes:**

- [ ] `57BC` Type `Cleo`, and press Enter.
  - **Expected:** `Cleo Marsh` has a tick.
  - **Notes:**

- [ ] `F8BF` Press Enter.
  - **Expected:** **Members** lists `Ada Quill`, `Bram Oakes` and `Cleo Marsh`, one to a line.
  - **Notes:**

- [ ] `7F8A` Select **Add**.
  - **Expected:**
    - The panel is titled `Tide team`, with a hollow yellow dot before it.
    - **Members** lists `Ada Quill`, `Bram Oakes` and `Cleo Marsh`, each with a hollow yellow dot before the name.
    - No date is after any of the names.
    - On the chart, a card named `Tide team` reads "No feature lead".
  - **Notes:**

- [ ] `FF5B` Select the Feature teams button, then **New feature team**.
  - **Expected:** A panel titled **New feature team** opens.
  - **Notes:**

- [ ] `B4E2` Type `Harbour team` in the **Name** box.
  - **Expected:** The **Name** box holds `Harbour team`.
  - **Notes:**

- [ ] `4C0F` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `A2E3` Type `Dara`, and press Enter.
  - **Expected:** `Dara Finch` has a tick.
  - **Notes:**

- [ ] `E4B6` Type `Emil`, and press Enter.
  - **Expected:** `Emil Stone` has a tick.
  - **Notes:**

- [ ] `35EA` Press Enter.
  - **Expected:** **Members** lists `Dara Finch` and `Emil Stone`, one to a line.
  - **Notes:**

- [ ] `7E85` Select the change button in the **Feature lead** row, type `Dara`, and press Enter.
  - **Expected:** **Feature lead** reads `Dara Finch`.
  - **Notes:**

- [ ] `7A76` Select **Add**.
  - **Expected:**
    - The panel is titled `Harbour team`, with a hollow yellow dot before it.
    - **Feature lead** reads `Dara Finch`.
    - **Members** lists `Dara Finch` and `Emil Stone`.
  - **Notes:**

- [ ] `3F4A` Select the Feature teams button, then **New feature team**.
  - **Expected:** A panel titled **New feature team** opens.
  - **Notes:**

- [ ] `A034` Type `Beacon team` in the **Name** box.
  - **Expected:** The **Name** box holds `Beacon team`.
  - **Notes:**

- [ ] `8DAD` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `2B4C` Type `Cleo`.
  - **Expected:** `Cleo Marsh` is listed.
  - **Notes:**

- [ ] `0ADF` Press Enter.
  - **Expected:** `Cleo Marsh` has a tick.
  - **Notes:**

- [ ] `F2C3` Type `Freya`, and press Enter.
  - **Expected:** `Freya Holt` has a tick.
  - **Notes:**

- [ ] `3B47` Press Enter.
  - **Expected:** **Members** lists `Cleo Marsh` and `Freya Holt`, one to a line.
  - **Notes:**

- [ ] `5F40` Select **Add**.
  - **Expected:**
    - The panel is titled `Beacon team`, with a hollow yellow dot before it.
    - On the chart, a card for `Cleo Marsh` is under `Tide team`.
    - Another card for `Cleo Marsh` is under `Beacon team`.
  - **Notes:**

- [ ] `BE73` Select **Today**.
  - **Expected:**
    - The text below the row is gone.
    - `Tide team` has `Ada Quill`, `Bram Oakes` and `Cleo Marsh` under its card.
    - `Harbour team`'s first card is `Dara Finch`'s, with `Emil Stone` under it.
    - `Beacon team` has `Cleo Marsh` and `Freya Holt` under its card.
  - **Notes:**

- [ ] `0C64` Run Publish.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

- [ ] `D62C` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `BD9B` Select the **Drafts** page in the left-hand menu.
  - **Expected:** Six entries are shown, each with a checkbox, one each for:
    - the release stream `Fictional Mainline`
    - its cycles from the first day of next year, such as "2027-01-01"
    - the planning settings
    - the feature teams `Tide team`, `Harbour team` and `Beacon team`
  - **Notes:**

- [ ] `F842` Tick **Select all waiting**.
  - **Expected:** A button reads **Approve 6 drafts…**.
  - **Notes:**

- [ ] `30A0` Select **Approve 6 drafts…**.
  - **Expected:** A dialog titled "Approve 6 drafts?" opens.
  - **Notes:**

- [ ] `37C8` Select **Approve** in the dialog.
  - **Expected:**
    - A notice reads "Approved 6 drafts."
    - The page says "No drafts waiting for approval."
  - **Notes:**

### SETUP-09: A Team Member Reads the New Organization

**Account:** Team Member, `team.member@fathom.test`, changed from SETUP-08.

**Preconditions:** SETUP-08 done. Signed in with this account.

- [ ] `A9E9` Select the **Org chart** page in the left-hand menu.
  - **Expected:**
    - `Odile Brandt` is at the top, with `Manager` under the name and `Keepers` under that.
    - Her card ends with "Hide 3 reports".
    - `Dara Finch` and `Emil Stone` are in a column under her.
    - `Ada Quill`, with `Manager` under the name and `Lamp crew` under that, is to the right of that column.
    - Her card ends with "Show 4 reports".
  - **Notes:**

- [ ] `D6EE` On the card for `Ada Quill`, select **Show 4 reports**.
  - **Expected:**
    - `Bram Oakes`, `Cleo Marsh` and `Freya Holt` appear in a column under her.
    - After them is a card with a grey dashed edge for `Fictional tide engineer`.
    - On that card, "Employee" is under the name.
    - On that card, under "Employee", a grey box reads "Planned, expected" and the month three months from now.
  - **Notes:**

- [ ] `4DA1` Choose **Feature teams** in the teams switch.
  - **Expected:**
    - `Tide team`, `Harbour team` and `Beacon team` are drawn side by side.
    - There are no dots.
  - **Notes:**

- [ ] `863B` Select the Feature teams button.
  - **Expected:**
    - The menu lists `Beacon team`, `Harbour team` and `Tide team`.
    - It offers no **New feature team**.
  - **Notes:**

**Afterwards:** Run [Work Between Roles](acceptance-work-between-roles-manual-test.md) next, on this organization. To stop here instead, run Reset the Database.
