---
title: "Manual Test: Acceptance, Setting Up Fathom"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/db/migrations/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/testing/acceptance/acceptance-team-accounts-manual-test.md", "docs/help/setting-up-fathom.md", "docs/product/roles.md"]
last_updated: "2026-11-23"
---

# Manual Test: Acceptance, Setting Up Fathom

## Scope

Verifies the first two rounds of setting up a brand-new Fathom as [Setting Up Fathom](../../help/setting-up-fathom.md) describes, on the installation [The Team's Accounts](acceptance-team-accounts-manual-test.md) readied. The Workforce Administrator pastes the positions and a list of sites in from files, adds a column, a schedule with its cycles and the working time, and the Project Manager approves them. The Workforce Administrator then adds one person by hand and pastes in the rest, fixing the two rows Fathom refuses, and the Project Manager approves them. Each signs in for the first time on the way.

## Test Environment

What [The Team's Accounts](acceptance-team-accounts-manual-test.md) left, run straight after it:

- Fathom running on its installation, at `https://localhost:10443`, with the **Sign in** page showing in a browser window at least 1,440 pixels wide.
- The password list, open in a plain text editor.
- This test's files, in `docs/testing/acceptance/data/` in the clone: `positions.tsv`, `sites.tsv` and `people.tsv`. Each starts with a line naming its columns, which is never copied, and separates its columns with tabs.

## Test Accounts

[The Team's Accounts](acceptance-team-accounts-manual-test.md) made these:

- **Workforce Administrator:** `ines.harrow@fathom.test`, shown in Fathom as `Ines Harrow`, whose new password is `fictional ines password`
- **Project Manager:** `tomas.reed@fathom.test`, shown in Fathom as `Tomas Reed`, whose new password is `fictional tomas password`

## Common Procedures

This test uses [Change a Generated Password](../manual-test-basics.md#change-a-generated-password) and [Publish](../manual-test-basics.md#publish). [Start Again](../manual-test-basics.md#start-again) removes the installation, for a fresh run from [Installing Fathom](acceptance-installing-fathom-manual-test.md).

## Terms

[Manual Test Basics](../manual-test-basics.md#terms) defines the terms every test uses, such as marks, a row's slot, the Publish button and the tick box. This test adds:

- **Copy the rows of a file:** open the file named in the text editor, select every line but the first, and copy them.
- **Typed dates:** unlike the Basics' dates, this test's steps type dates as digits with no separators, such as `20270101`.
- **Next year:** the year after the current one. Its first cycles are named by its last two digits and their number, such as "27.1" for the first in 2027; the examples after "such as" are for a run in 2026.
- **Empty row:** the row at the end of a table or a list's panel, with blank cells, where a new record or choice is typed or pasted.

## Test Cases

Run the test cases in order, in about 30 minutes, straight after [The Team's Accounts](acceptance-team-accounts-manual-test.md). Check each step whose expected result you see, and write anything else under its notes. [Reporting Lines](acceptance-reporting-lines-manual-test.md) follows on from the last test case.

### SETUP-01: The Workforce Administrator Signs In for the First Time

**Account:** Workforce Administrator, `ines.harrow@fathom.test`, changed from TEAM-05 in [The Team's Accounts](acceptance-team-accounts-manual-test.md); the first test case.

**Preconditions:** [The Team's Accounts](acceptance-team-accounts-manual-test.md) run just before. **Sign in** page showing.

- [ ] `793D` Sign in as the Workforce Administrator, `ines.harrow@fathom.test`, with the password beside it in the password list.
  - **Expected:** A page headed **Change password** shows, with no left-hand menu.
  - **Notes:**

- [ ] `41C4` Run Change a Generated Password, with the new password `fictional ines password`.
  - **Expected:**
    - Fathom opens on the **Overview**.
    - The top bar's right end shows `Ines Harrow`.
  - **Notes:**

- [ ] `4BE3` Select the **People** page in the left-hand menu.
  - **Expected:**
    - The table has its column names and only the empty row.
    - The count above the table reads "0 people on" and today's date, such as "0 people on Nov 20, 2026".
  - **Notes:**

### SETUP-02: The Positions Are Pasted In

**Account:** Workforce Administrator, `ines.harrow@fathom.test`, the same as SETUP-01.

**Preconditions:** SETUP-01 done.

- [ ] `F7A4` Select the **Lists** page in the left-hand menu.
  - **Expected:** **Positions** and **Hiring states** are among the lists, each with a grey **Built in** box.
  - **Notes:**

- [ ] `D201` Select **Positions**.
  - **Expected:**
    - The panel opens with **Positions** at the top.
    - Its choices are **Employee** and **Manager**.
    - An empty row is under them.
  - **Notes:**

- [ ] `02AA` Copy the rows of `positions.tsv`.
  - **Expected:** Four lines are selected in the text editor, from `Software Engineer` to `Engineering Director`.
  - **Notes:**

- [ ] `665F` In Fathom, select the empty row's **Name** box.
  - **Expected:** The cursor is in the box.
  - **Notes:**

- [ ] `48B5` Paste.
  - **Expected:**
    - Four rows are added under **Manager**, in the order of the file: `Software Engineer`, `Test Engineer`, `Engineering Manager` and `Engineering Director`.
    - Each has its description from the file.
    - Each has a hollow yellow dot in its slot.
  - **Notes:**

### SETUP-03: A List of Sites Is Made and Pasted In

**Account:** Workforce Administrator, `ines.harrow@fathom.test`, the same as SETUP-02.

**Preconditions:** SETUP-02 done. **Lists** page open.

- [ ] `3F4F` Select **New list**.
  - **Expected:**
    - A dialog titled "New list" opens.
    - It has **Name**, **Description (optional)** and **Class**.
  - **Notes:**

- [ ] `17A6` Type `Sites` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `56C9` Leave **General** chosen under **Class**, and select **Create list**.
  - **Expected:**
    - The dialog closes.
    - The panel opens with `Sites` at the top, and only an empty row.
  - **Notes:**

- [ ] `672F` Copy the rows of `sites.tsv`.
  - **Expected:** Two lines are selected in the text editor, `Harbourside` and `Northmere`.
  - **Notes:**

- [ ] `628C` In Fathom, select the empty row's **Name** box.
  - **Expected:** The cursor is in the box.
  - **Notes:**

- [ ] `0F1C` Paste.
  - **Expected:** `Harbourside` and `Northmere` are listed, each with its description and a hollow yellow dot in its slot.
  - **Notes:**

### SETUP-04: A Column Uses the New List

**Account:** Workforce Administrator, `ines.harrow@fathom.test`, the same as SETUP-03.

**Preconditions:** SETUP-03 done.

- [ ] `5DBC` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens, with only the empty row.
  - **Notes:**

- [ ] `A7E9` Select **New column**.
  - **Expected:**
    - A dialog titled "New column" opens.
    - **Type** reads "Choice from a list".
  - **Notes:**

- [ ] `7DC8` Type `Site` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `DD49` Choose **Sites (new)** in **List**.
  - **Expected:** **List** reads "Sites (new)".
  - **Notes:**

- [ ] `DFB9` Select **Add column**.
  - **Expected:**
    - The dialog closes.
    - The table has a **Site** column, with a hollow yellow dot before its name.
  - **Notes:**

### SETUP-05: A Schedule Is Set Up With Its Cycles

**Account:** Workforce Administrator, `ines.harrow@fathom.test`, the same as SETUP-04.

**Preconditions:** SETUP-04 done.

- [ ] `6D23` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The **Releases** tab is chosen beside the heading, and reads "No releases yet."
    - There is no button at the top right.
  - **Notes:**

- [ ] `24A4` Select the **Schedules** tab.
  - **Expected:**
    - The tab reads "No schedules yet."
    - A **New schedule** button is at the top right.
  - **Notes:**

- [ ] `8D10` Select **New schedule**.
  - **Expected:** A dialog titled "New schedule" opens.
  - **Notes:**

- [ ] `74A1` Type `Fictional Mainline` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `AB34` Select **Add schedule**.
  - **Expected:**
    - A notification says "Drafted the new schedule."
    - The side panel is headed with a hollow yellow dot before `Fictional Mainline`.
    - "None" is under **Cycles**.
  - **Notes:**

- [ ] `466C` In the side panel, select the pencil at the right of the **Name pattern** row.
  - **Expected:** A dialog titled "Set up cycles for Fictional Mainline" opens.
  - **Notes:**

- [ ] `96B2` Type the first day of next year in **First cycle starts**, such as `20270101`, leaving **Each cycle lasts** at `3`, **Months**, and **Names** at `{YY}.{N}`.
  - **Expected:**
    - Under **First cycles**, the first row reads next year's first cycle and its dates, January 1 to March 31, such as "27.1", "2027-01-01 to 2027-03-31".
    - The second row reads its second cycle, April 1 to June 30, such as "27.2", "2027-04-01 to 2027-06-30".
    - The third row reads its third cycle, July 1 to September 30, such as "27.3", "2027-07-01 to 2027-09-30".
  - **Notes:**

- [ ] `06B8` Select **Set up cycles**.
  - **Expected:**
    - A notification says "Drafted the cycles."
    - **Name pattern** reads `{YY}.{N}`, and **Cycle length** "3 months".
    - The first row under **Cycles** is next year's first cycle, such as "27.1", starting on January 1 and ending on March 31.
  - **Notes:**

### SETUP-06: The Working Time Is Set

**Account:** Workforce Administrator, `ines.harrow@fathom.test`, the same as SETUP-05.

**Preconditions:** SETUP-05 done.

- [ ] `6FE1` Select the **Capacity** page in the left-hand menu, then the **Settings** tab.
  - **Expected:** Under **Working time**, the rows read, from the top:
    - **Hours a day**: "8"
    - **Working days a week**: "5"
    - **Working days a month**: "20"
  - **Notes:**

- [ ] `B89A` Select "8" beside **Hours a day**.
  - **Expected:** A field in place of "8" holds "8", with the focus in it.
  - **Notes:**

- [ ] `6B27` Replace the value with `7`, and press Enter.
  - **Expected:**
    - **Hours a day** reads "7" after a hollow yellow dot.
    - Under it, "8" follows a green dot.
  - **Notes:**

### SETUP-07: The First Round Is Published

**Account:** Workforce Administrator, `ines.harrow@fathom.test`, the same as SETUP-06.

**Preconditions:** SETUP-06 done.

- [ ] `7F64` Run Publish.
  - **Expected:** The Publish button, which read **Publish 11 changes**, is gone.
  - **Notes:**

### SETUP-08: The Project Manager Signs In for the First Time

**Account:** Project Manager, `tomas.reed@fathom.test`, changed from SETUP-07. The first step signs out the Workforce Administrator.

**Preconditions:** SETUP-07 done.

- [ ] `090F` Sign out from the account menu.
  - **Expected:** The **Sign in** page shows.
  - **Notes:**

- [ ] `ED3E` Sign in as the Project Manager, `tomas.reed@fathom.test`, with the password beside it in the password list.
  - **Expected:** A page headed **Change password** shows, with no left-hand menu.
  - **Notes:**

- [ ] `931F` Run Change a Generated Password, with the new password `fictional tomas password`.
  - **Expected:**
    - Fathom opens on the **Overview**.
    - The top bar's right end shows `Tomas Reed`.
  - **Notes:**

### SETUP-09: The Project Manager Approves the First Round

**Account:** Project Manager, `tomas.reed@fathom.test`, the same as SETUP-08.

**Preconditions:** SETUP-08 done.

- [ ] `DC83` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **To decide** is chosen beside the page's title.
    - Eleven rows are shown, each with a tick box, whose **Record** reads:
      - `Software Engineer in Positions`, `Test Engineer in Positions`, `Engineering Manager in Positions`, `Engineering Director in Positions`, `Harbourside in Sites` and `Northmere in Sites`, each with **Type** "Choice"
      - `Sites`, with **Type** "List"
      - `Site`, with **Type** "Column"
      - `Fictional Mainline`, with **Type** "Schedule"
      - `Fictional Mainline from` and the first day of next year, such as "Fictional Mainline from Jan 1, 2027", with **Type** "Cycles"
      - "Planning settings", with **Type** "Planning settings"
    - Each row's **Made by** reads "Ines Harrow as Workforce Administrator".
  - **Notes:**

- [ ] `91DD` Tick the tick box before **Record** in the table's header.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 11 drafts…**.
  - **Notes:**

- [ ] `A18F` Select **Approve 11 drafts…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 11 drafts?" opens.
  - **Notes:**

- [ ] `0EA5` Select **Approve** in the dialog.
  - **Expected:**
    - A notification says "Approved 11 drafts."
    - The table reads "No drafts".
  - **Notes:**

### SETUP-10: One Person Is Added by Hand

**Account:** Workforce Administrator, `ines.harrow@fathom.test`, changed from SETUP-09.

**Preconditions:** SETUP-09 done.

- [ ] `D066` Sign out from the account menu, and sign in as the Workforce Administrator, `ines.harrow@fathom.test`, with the password `fictional ines password`.
  - **Expected:** The top bar's right end shows `Ines Harrow`.
  - **Notes:**

- [ ] `EA9C` Select the **People** page in the left-hand menu.
  - **Expected:**
    - The **People** page opens, with only the empty row.
    - **Site** has no dot before its name.
  - **Notes:**

- [ ] `641B` Select **New person** at the top right of the page.
  - **Expected:** The details panel opens, headed **New person**.
  - **Notes:**

- [ ] `FD98` Select the change button beside **State**, and choose **Hired**.
  - **Expected:** **State** reads "Hired".
  - **Notes:**

- [ ] `CFE2` Type `Odile Brandt` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `A8CA` Type `EMP-100` in **ID**.
  - **Expected:** **ID** shows what was typed.
  - **Notes:**

- [ ] `0F03` Choose **Engineering Director** in **Position** from its change button.
  - **Expected:** **Position** reads "Engineering Director".
  - **Notes:**

- [ ] `B335` Select **Add**.
  - **Expected:**
    - The panel shows `Odile Brandt`.
    - Her row reads `EMP-100` in **ID**, "Engineering Director" in **Position** and "Hired" in **State**.
    - Her row has a hollow yellow dot in its slot.
    - The count reads "1 person".
  - **Notes:**

- [ ] `E216` Click once in the **Manager?** cell of `Odile Brandt`.
  - **Expected:** Her box is checked.
  - **Notes:**

### SETUP-11: The Rest Are Pasted In, and Two Refused Rows Are Fixed

**Account:** Workforce Administrator, `ines.harrow@fathom.test`, the same as SETUP-10.

**Preconditions:** SETUP-10 done. **People** page open.

- [ ] `8E48` Copy the rows of `people.tsv`.
  - **Expected:** Six lines are selected in the text editor, from `Ada Quill` to `Freya Holt`.
  - **Notes:**

- [ ] `ED3F` In Fathom, select the **Name** cell of the empty row.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `30FC` Paste.
  - **Expected:**
    - Six rows are shown under `Odile Brandt`, one for each line, none of them with a dot.
    - Under the row of `Ada Quill`, red text reads "Manager?: use Yes or No", and her **Manager?** box is clear.
    - Under the row of `Dara Finch`, red text reads "No Position called Sofware Engineer", and her **Position** cell is empty.
    - `Bram Oakes` reads "Software Engineer" in **Position**, with capitals.
    - The count still reads "1 person".
  - **Notes:**

- [ ] `257F` Click once in the **Manager?** cell of `Ada Quill`.
  - **Expected:**
    - Her box is checked.
    - The red text under her row is gone.
  - **Notes:**

- [ ] `BDF7` Press Enter.
  - **Expected:**
    - The red text under the row of `Dara Finch` still shows.
    - The count still reads "1 person".
  - **Notes:**

- [ ] `C9F0` Select the **Position** cell of `Dara Finch`, type `Soft`, choose **Software Engineer**, and press Enter.
  - **Expected:**
    - No red text shows.
    - Each of the six rows has a hollow yellow dot in its slot.
    - `Dara Finch` reads "Software Engineer" in **Position**.
    - Each of the seven rows reads "Hired" in **State**, and only `Odile Brandt` and `Ada Quill` have **Manager?** checked.
    - The count reads "7 people on" and today's date.
  - **Notes:**

- [ ] `F17C` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

### SETUP-12: The Project Manager Approves the People

**Account:** Project Manager, `tomas.reed@fathom.test`, changed from SETUP-11.

**Preconditions:** SETUP-11 done.

- [ ] `B353` Sign out from the account menu, and sign in as the Project Manager, `tomas.reed@fathom.test`, with the password `fictional tomas password`.
  - **Expected:** The top bar's right end shows `Tomas Reed`.
  - **Notes:**

- [ ] `3DFA` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **To decide** is chosen beside the page's title.
    - Seven rows are shown, one for each person added in SETUP-10 and SETUP-11, each with **Type** "Person".
  - **Notes:**

- [ ] `614A` Tick the tick box before **Record** in the table's header.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 7 drafts…**.
  - **Notes:**

- [ ] `02E0` Select **Approve 7 drafts…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 7 drafts?" opens.
  - **Notes:**

- [ ] `2FD2` Select **Approve** in the dialog.
  - **Expected:**
    - A notification says "Approved 7 drafts."
    - The table reads "No drafts".
  - **Notes:**

**Afterwards:** Run [Reporting Lines](acceptance-reporting-lines-manual-test.md) next, on this installation. To stop here instead, run [Start Again](../manual-test-basics.md#start-again).
