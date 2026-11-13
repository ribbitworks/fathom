---
title: "Manual Test: Dark Mode"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/design/visual-design.md", "docs/design/conventions.md", "docs/design/development-setup.md"]
last_updated: "2026-11-13"
---

# Manual Test: Dark Mode

## Scope

Verifies that Fathom keeps the appearance chosen in each browser and follows the computer's on **System**, and that every page, with its main panels, dialogs and menus, its draft marks and its class words, reads well in dark mode: words easy to read, marks and tints easy to see and tell apart, and nothing left light. It is the one manual test that checks dark mode, as [Testing Standards § Manual Tests](../standards/testing.md#manual-tests) sets out.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with a browser window at least 1,440 pixels wide, and the computer's appearance set to light before the first test case.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Superuser:** `superuser@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Feature Lead:** `feature.lead@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms this test uses, such as the Appearance menu, marks, slots and Live rows. This test adds:

- **Computer's appearance:** the light or dark setting of the computer itself, such as **Appearance** in macOS System Settings, or the colour mode in Windows Settings.
- **Easy to read:** words stand out clearly from what is behind them, with nothing too faint, and no part of the screen is left light.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### DARK-01: Each Browser Keeps Its Appearance and Follows the Computer on System

**Account:** Superuser, `superuser@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Light** chosen in the Appearance menu. **People** page open from the left-hand menu.

- [ ] `EEF1` Press Tab until the account button in the top bar has focus, and press Enter.
  - **Expected:**
    - Under **Appearance** are **System**, **Light** and **Dark**.
    - The tick is beside **Light** only.
    - The first item in the menu has focus.
  - **Notes:**

- [ ] `B4C6` Press the Down arrow key until **Dark** has focus, and press Enter.
  - **Expected:**
    - The menu closes.
    - The whole page turns dark at once: the left-hand menu, the table and the top bar.
  - **Notes:**

- [ ] `ADA0` Reload the page.
  - **Expected:**
    - The page opens dark.
    - In the account menu, the tick is beside **Dark**.
  - **Notes:**

- [ ] `2A0F` Sign out.
  - **Expected:** The **Sign in** page is dark.
  - **Notes:**

- [ ] `1B7A` Sign in as the Superuser, `superuser@fathom.test`.
  - **Expected:** The page is dark.
  - **Notes:**

- [ ] `E94C` Choose **System** in the Appearance menu.
  - **Expected:**
    - The page turns light, as the computer is set.
    - In the account menu, the tick is beside **System** only.
  - **Notes:**

- [ ] `FECD` Set the computer's appearance to dark.
  - **Expected:** Fathom turns dark with it.
  - **Notes:**

- [ ] `C349` Set the computer's appearance to light.
  - **Expected:** Fathom turns light again.
  - **Notes:**

- [ ] `DBAE` Choose **Light** in the Appearance menu, and reload the page.
  - **Expected:**
    - The page stays light.
    - In the account menu, the tick is beside **Light** only.
  - **Notes:**

- [ ] `A8A1` Choose **Dark** in the Appearance menu.
  - **Expected:** The page turns dark.
  - **Notes:**

### DARK-02: The People Table and Its Marks

**Account:** Superuser, `superuser@fathom.test`, the same as DARK-01.

**Preconditions:** **Dark** chosen in the Appearance menu. **People** page open from the left-hand menu.

- [ ] `0B98` Type `Vianney Rousseau` in the search box.
  - **Expected:**
    - The yellow dot in the row's slot is easy to see.
    - The faintly yellow row is told apart from the page.
    - Every value in the row is easy to read.
  - **Notes:**

- [ ] `A2D6` Type `Ophélie Roussel` in the search box.
  - **Expected:**
    - The red dot's ring is easy to see.
    - The faintly red row is told apart from the page.
    - Every value in the row is easy to read.
  - **Notes:**

- [ ] `061E` Type `西尾 亮` in the search box.
  - **Expected:**
    - The yellow dots and green dots are easy to see.
    - The semibold values are easy to read.
    - The light green Live row is told apart from the row above it.
    - Every value in the Live row is easy to read.
  - **Notes:**

- [ ] `E2C9` Type `우아현` in the search box.
  - **Expected:** The red **Left** box and its word are easy to read.
  - **Notes:**

- [ ] `8A53` Type `Viktoria Holmberg` in the search box.
  - **Expected:** The grey lock is easy to see.
  - **Notes:**

- [ ] `95C2` Clear the search box.
  - **Expected:** Every person and planned hire is listed.
  - **Notes:**

- [ ] `A566` Scroll the table to the bottom.
  - **Expected:** These are all easy to read and tell apart:
    - the grey names of the planned hires
    - the faint yellow rows of drafted hires
    - the faint red row of 'Payments tester'
    - the light green Live rows under the drafted hires
  - **Notes:**

- [ ] `5D3B` Scroll the table back to the top.
  - **Expected:** The table's first rows show.
  - **Notes:**

- [ ] `62E5` Open the **ID** column menu, and select **Freeze up to this column**.
  - **Expected:** A line is at the right edge of **ID**.
  - **Notes:**

- [ ] `D031` Scroll the table sideways to the right.
  - **Expected:**
    - The frozen columns are dark.
    - Nothing from the columns underneath shows through.
    - The line and the shadow beside the frozen columns are easy to see.
  - **Notes:**

- [ ] `FE74` Scroll the table back to the left.
  - **Expected:** **Name** is the first column.
  - **Notes:**

- [ ] `13E6` Open the **ID** column menu, and select **Unfreeze columns**.
  - **Expected:** No line is at the right edge of **ID**.
  - **Notes:**

- [ ] `D665` Point at the right edge of the **Site** column's name.
  - **Expected:** The blue line on the edge is easy to see.
  - **Notes:**

- [ ] `47D6` Drag that edge to the right by about the width of the column.
  - **Expected:** **Site** widens with the pointer.
  - **Notes:**

- [ ] `F9C9` Open the Views menu.
  - **Expected:**
    - The menu shows **Widths: Site**, with an **×**.
    - **Widths: Site** is set apart from the items around it.
    - **Widths: Site** and its **×** are easy to read.
  - **Notes:**

- [ ] `AD42` Select **Widths: Site**.
  - **Expected:** **Site** goes back to its width.
  - **Notes:**

### DARK-03: People's Panels, Dialogs and Menus

**Account:** Superuser, `superuser@fathom.test`, the same as DARK-02.

**Preconditions:** **Dark** chosen in the Appearance menu. **People** page open from the left-hand menu.

- [ ] `EFE1` Type `Simone Jean` in the search box.
  - **Expected:** Only the row of 'Simone Jean' and its Live row show.
  - **Notes:**

- [ ] `13FF` Select the details button in the row of 'Simone Jean', not its Live row.
  - **Expected:**
    - In the **Manager** row, the yellow dot before 'Silje Holm-Schrøder' and the green dot before 'Viktoria Holmberg' are easy to see.
    - The red **Left** box is easy to read.
    - Every label, value, link and change button in the side panel is easy to read.
  - **Notes:**

- [ ] `D167` Select the change button beside **Grade**.
  - **Expected:** The list of grades is easy to read.
  - **Notes:**

- [ ] `23E5` Press Esc.
  - **Expected:** The list closes.
  - **Notes:**

- [ ] `DB97` Close the side panel with the **×** at its top right.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] `C831` Type `Tanushree Patel-Singh` in the search box.
  - **Expected:** Only the row of 'Tanushree Patel-Singh' shows.
  - **Notes:**

- [ ] `D71A` Scroll the table to the right until her **Onboarding** cell shows.
  - **Expected:** Her **Onboarding** cell is in view.
  - **Notes:**

- [ ] `A853` Select her **Onboarding** cell, and press Enter.
  - **Expected:**
    - A panel opens with her note.
    - "On track" is teal.
    - The heading, checklist, link and words are easy to read against the dark panel.
  - **Notes:**

- [ ] `577E` Close the note's panel with the **×** at its top right.
  - **Expected:** The panel closes.
  - **Notes:**

- [ ] `2D10` Type `REQ-2047` in the search box.
  - **Expected:** The row's **Fill** button is easy to read.
  - **Notes:**

- [ ] `3EF0` Select **Fill**.
  - **Expected:** These are all easy to read:
    - the panel's **New person** and **Existing person** choice
    - the panel's fields
  - **Notes:**

- [ ] `010A` Type `Fictional name` in **Name**.
  - **Expected:** **Name** holds `Fictional name`.
  - **Notes:**

- [ ] `BDD9` Select **Cancel**.
  - **Expected:**
    - A dialog titled "Stop filling this planned hire?" opens.
    - Its words and buttons are easy to read.
  - **Notes:**

- [ ] `6EA5` Select **Discard**.
  - **Expected:** The panel shows the hire's details.
  - **Notes:**

- [ ] `ADF0` Clear the search box.
  - **Expected:** Every person and planned hire is listed.
  - **Notes:**

- [ ] `F11A` Select **New**.
  - **Expected:** The side panel opens, headed **New person**.
  - **Notes:**

- [ ] `844A` Type `2027-06-30` in **End**, and press Tab.
  - **Expected:** **End** holds `2027-06-30`.
  - **Notes:**

- [ ] `899B` Select the change button beside **State**, and choose **Request to hire**.
  - **Expected:**
    - The heading reads **New planned hire**.
    - Under **State**, a grey line reads "End was cleared, since a planned hire doesn't have it."
    - The grey line is easy to read.
  - **Notes:**

- [ ] `ED36` Select the change button beside **Position**, and choose 'SDET'.
  - **Expected:** **Position** reads 'SDET'.
  - **Notes:**

- [ ] `9C4F` Type `REQ-4100` in **ID**, and press Tab.
  - **Expected:**
    - The **Name** box shows "SDET, REQ-4100" in grey.
    - The grey words are easy to read.
    - Every label, value, box and button in the panel is easy to read.
  - **Notes:**

- [ ] `FBAE` Select **Cancel**.
  - **Expected:**
    - A dialog titled "Discard the new planned hire?" opens.
    - Its words and buttons are easy to read.
  - **Notes:**

- [ ] `1A9F` Select **Discard**.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] `F16F` Open the **Site** column menu, and select **Edit column**.
  - **Expected:** The checkboxes, their labels and the words under them in the dialog are easy to read.
  - **Notes:**

- [ ] `7E5B` Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] `BCAA` Open the Views menu.
  - **Expected:**
    - **My views** and **Shared views** read as headings.
    - The headings and names are easy to read.
  - **Notes:**

- [ ] `7B5A` Select **Save view…**.
  - **Expected:** The dialog and its checkbox are easy to read.
  - **Notes:**

- [ ] `A466` Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] `219B` Select **Metrics** above the table.
  - **Expected:** The Metrics panel opens on the right.
  - **Notes:**

- [ ] `D222` Set **Break down by** to **Position**.
  - **Expected:** The panel's title, count line and figures are easy to read.
  - **Notes:**

- [ ] `6F4C` Press Esc.
  - **Expected:** The Metrics panel closes.
  - **Notes:**

- [ ] `108D` Select the Export button, then **CSV file**.
  - **Expected:**
    - A dialog titled "Export Confidential and Personal data?" opens.
    - Its words, **Confidential** and **Personal** included, read clearly on its dark background.
  - **Notes:**

- [ ] `6C08` Press Esc.
  - **Expected:** The dialog closes, and nothing is exported.
  - **Notes:**

### DARK-04: The Org Chart

**Account:** Superuser, `superuser@fathom.test`, the same as DARK-03.

**Preconditions:** **Dark** chosen in the Appearance menu. **Org chart** page open from the left-hand menu, with **Reporting teams** chosen in the teams switch.

- [ ] `5A9E` Look at the date row and the timeline above the chart.
  - **Expected:**
    - The date row is easy to read.
    - The timeline's month labels overlap neither each other nor the chart.
  - **Notes:**

- [ ] `53B9` Type `Simone` in the finder.
  - **Expected:** 'Simone Jean' is in the finder's list.
  - **Notes:**

- [ ] `38CD` Choose 'Simone Jean' in the finder's list.
  - **Expected:**
    - Her faintly yellow card is easy to tell apart from the untinted cards.
    - Every word on it is easy to read.
  - **Notes:**

- [ ] `55E6` On the card for 'Viktoria Holmberg', select **Show 3 reports**.
  - **Expected:**
    - The faded light green card of 'Simone Jean', with a dashed edge, is easy to tell apart from the untinted cards.
    - Every word on the card for '우아현' is easy to read.
  - **Notes:**

- [ ] `24A5` On the card for 'Lorenza Thiel', select **Show 8 reports**.
  - **Expected:** Her eight reports' cards show under her.
  - **Notes:**

- [ ] `FFC5` On the card for 'Atmananda Ganaka', select **Show 9 reports**.
  - **Expected:**
    - The team bands, dots and lines are teal and grape.
    - Each is easy to tell apart from the card behind it.
  - **Notes:**

- [ ] `52FF` Type `TBD-3` in the finder.
  - **Expected:** 'TBD-3' is in the finder's list.
  - **Notes:**

- [ ] `9C06` Choose 'TBD-3' in the finder's list.
  - **Expected:** The dashed edges and the grey boxes of the planned hires' cards are easy to see on the dark cards.
  - **Notes:**

- [ ] `2A6B` Choose **Feature teams** in the teams switch.
  - **Expected:** The bands, team names and positions are all easy to read on the dark cards.
  - **Notes:**

- [ ] `9A5C` Select the Feature teams button, then 'Payments core'.
  - **Expected:** The team panel's labels, values and change buttons are easy to read.
  - **Notes:**

- [ ] `A3B2` Select the change button in the **Feature lead** row.
  - **Expected:** **None** and the line under it are easy to see.
  - **Notes:**

- [ ] `F744` Point at the first person after the line.
  - **Expected:**
    - The person pointed at is on a dark grey background.
    - Their name and the line under it are easy to read.
  - **Notes:**

- [ ] `884A` Press Esc.
  - **Expected:** The list closes.
  - **Notes:**

- [ ] `87C9` Close the team panel with the **×** at its top right.
  - **Expected:** The panel closes, and nothing is changed.
  - **Notes:**

### DARK-05: Feature Assignments

**Account:** Superuser, `superuser@fathom.test`, the same as DARK-04.

**Preconditions:** **Dark** chosen in the Appearance menu. **Feature assignments** page open from the left-hand menu.

- [ ] `7B1E` Look at the table.
  - **Expected:** The labels, headings, group names and shaded cells are easy to read.
  - **Notes:**

- [ ] `F473` Type `Priscille Adam` in the search box.
  - **Expected:**
    - Her row's tint is easy to make out.
    - In the current month's column, the dot before her struck-through 'Mobile apps' label is easy to see.
    - Every label is easy to read.
  - **Notes:**

- [ ] `AC5E` Clear the search box.
  - **Expected:** Every person is listed.
  - **Notes:**

### DARK-06: The Plan Pages

**Account:** Superuser, `superuser@fathom.test`, the same as DARK-05.

**Preconditions:** **Dark** chosen in the Appearance menu.

- [ ] `6FDC` Select the **Overview** page in the left-hand menu.
  - **Expected:** Every word and figure on the page is easy to read.
  - **Notes:**

- [ ] `EDE6` Select the **Features** page in the left-hand menu.
  - **Expected:**
    - Every word is easy to read.
    - The group headings are clearly set apart from the rows.
    - Each line between rows, above and below the group headings too, is one thin line running straight across the whole table.
    - The numbers in **Effort** are easy to read.
  - **Notes:**

- [ ] `619B` Find the row 'Offline Sync', and look at its **Projects** and **Proposals** cells.
  - **Expected:**
    - The grey IDs are easy to read.
    - They are clearly lighter than the names.
  - **Notes:**

- [ ] `DC94` Point at the **Projects** cell of 'Offline Sync'.
  - **Expected:** The tip is easy to read.
  - **Notes:**

- [ ] `2FBD` Open the column menu of **Effort**.
  - **Expected:** The column menu is easy to read.
  - **Notes:**

- [ ] `4E40` Press Esc.
  - **Expected:** The column menu closes.
  - **Notes:**

- [ ] `3BDB` Select **Show details** in the **⋯** menu of 'Offline Sync'.
  - **Expected:**
    - The section headings are easy to read.
    - They stand apart from the rows under them.
  - **Notes:**

- [ ] `AFE9` Close the side panel with the **×** at its top right.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] `C7D7` Select **New feature**.
  - **Expected:** The **New feature** panel opens beside the table.
  - **Notes:**

- [ ] `56C3` Select the pencil button in the **Notes** row.
  - **Expected:**
    - A second panel opens, titled "Notes for New feature".
    - Both panels are easy to read.
  - **Notes:**

- [ ] `0EB1` Close the **Notes for New feature** panel with the **×** at its top right.
  - **Expected:** The **Notes for New feature** panel closes.
  - **Notes:**

- [ ] `D5C3` Select **Cancel** in the **New feature** panel.
  - **Expected:** The panel closes.
  - **Notes:**

- [ ] `37DA` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** tab is chosen.
  - **Notes:**

- [ ] `9D69` Select **Show details** in the **⋯** menu of the first project.
  - **Expected:** The text, marks and tabs on the page and side panel are easy to read.
  - **Notes:**

- [ ] `D78F` Close the side panel with the **×** at its top right.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] `AFC0` Select the **Milestones** tab.
  - **Expected:** The text, the tabs and the ticked **Customer delivery** boxes are easy to read.
  - **Notes:**

- [ ] `A49F` Select the **Releases** page in the left-hand menu.
  - **Expected:** The page is titled **Releases**.
  - **Notes:**

- [ ] `89F3` Select **Quarter** among the timeline's zoom buttons.
  - **Expected:**
    - The strip's names are easy to read.
    - The tint and this quarter's underline are clear against the dark page.
  - **Notes:**

- [ ] `36A8` Select 'Platform' in the streams table.
  - **Expected:** The panel of 'Platform' opens.
  - **Notes:**

- [ ] `EC95` Select the underlined name 'Harbor 2' in the panel.
  - **Expected:**
    - A panel titled 'Harbor 2' opens above the stream's panel.
    - The note's headings, bullets, checklist, red text and link are easy to read.
    - Both panels read well.
  - **Notes:**

### DARK-07: The Other Pages

**Account:** Superuser, `superuser@fathom.test`, the same as DARK-06.

**Preconditions:** **Dark** chosen in the Appearance menu.

- [ ] `D46F` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The page is titled **Drafts**.
  - **Notes:**

- [ ] `63F6` Type `Ophélie Roussel` in the search box.
  - **Expected:**
    - The red dot's ring before the entry is easy to see.
    - The **Reason:** line under it is easy to read.
  - **Notes:**

- [ ] `4D57` Type `Viktoria Holmberg` in the search box.
  - **Expected:** The yellow dot and the grey lock before the entry are easy to see.
  - **Notes:**

- [ ] `AC4B` Select the **Lists** page in the left-hand menu.
  - **Expected:** The page is titled **Lists**.
  - **Notes:**

- [ ] `0E1F` Type `Sites` in the search box.
  - **Expected:** The row of 'Sites' and its Live row show.
  - **Notes:**

- [ ] `B984` Select 'Sites' in its row, not its Live row.
  - **Expected:**
    - The red dot's ring in the slot of 'Harbourside' is easy to see.
    - The yellow dots and the light green Live row under 'Northmere Labs' are easy to see.
    - Every value in the panel is easy to read.
  - **Notes:**

- [ ] `D1A7` Select the **Capacity** page in the left-hand menu.
  - **Expected:**
    - The mode switch reads **People** and **Settings**, with **People** chosen.
    - The switch, the headings and the names are easy to read.
  - **Notes:**

- [ ] `D5E4` Choose **None** in the Group by menu.
  - **Expected:** In the current month's column, these are easy to read and to tell apart:
    - the feature names
    - the percentages
    - the red, bold "Over" lines and the grey "Under" lines
  - **Notes:**

- [ ] `8CC8` Choose **Feature team** in the Group by menu.
  - **Expected:** The rows are grouped by feature team.
  - **Notes:**

- [ ] `6D09` Scroll the table to the bottom.
  - **Expected:** The total rows, headed **Total, PM**, and the **Organization, PM** row at the foot are easy to read and to tell apart from the rows above them.
  - **Notes:**

- [ ] `04E5` Select **Settings** in the mode switch.
  - **Expected:**
    - The headings and values are easy to read.
    - The labels are dimmed beside their values.
  - **Notes:**

- [ ] `EA6B` Select the **Accounts** page in the left-hand menu.
  - **Expected:** The page is titled **Accounts**.
  - **Notes:**

- [ ] `A557` Type `super` in the search box.
  - **Expected:**
    - The page has a dark ground, and every word is easy to read.
    - The **×** in the search box is easy to see.
    - The "This account" badge is sea-blue and easy to read.
    - **Active** is green.
  - **Notes:**

- [ ] `F493` Select the **Roles** page in the left-hand menu.
  - **Expected:**
    - Every word is easy to read.
    - Wherever **Personal** or **Confidential** is in a description, it is bold, **Personal** in orange and **Confidential** in red, each easy to read.
  - **Notes:**

- [ ] `7A65` Select the **Settings** page in the left-hand menu.
  - **Expected:** Every heading, label and value is easy to read.
  - **Notes:**

- [ ] `602A` Select the **Data classes** page in the left-hand menu.
  - **Expected:**
    - The page and the grey boxes are easy to read.
    - Each lock lines up with its word.
  - **Notes:**

- [ ] `A8E0` Select the **Change history** page in the left-hand menu.
  - **Expected:** The entries are easy to read.
  - **Notes:**

- [ ] `FB85` Select the **Access history** page in the left-hand menu.
  - **Expected:** The entries and their yellow dots are easy to read.
  - **Notes:**

- [ ] `9C10` Select the **Roles** page under **Help** in the left-hand menu.
  - **Expected:** Every word and mark is easy to read.
  - **Notes:**

- [ ] `1FAD` Select the **Drafts** page under **Help** in the left-hand menu.
  - **Expected:** Every word and mark is easy to read.
  - **Notes:**

- [ ] `E5EF` Select **About Fathom** under **Help** in the left-hand menu.
  - **Expected:** The box that opens is easy to read.
  - **Notes:**

- [ ] `7BF4` Close the box.
  - **Expected:** The box closes.
  - **Notes:**

### DARK-08: Other Accounts' Marks and Menus

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DARK-07. Step `6A94` signs in as another account.

**Preconditions:** Signed in as the Superuser, as DARK-07 ends; the first step signs in as this account. **Dark** chosen in the Appearance menu.

- [ ] `00B7` Sign out, and sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** The page is dark.
  - **Notes:**

- [ ] `4A37` Select the **People** page in the left-hand menu.
  - **Expected:** The table of people shows.
  - **Notes:**

- [ ] `09ED` Type `Mariana Metz` in the search box.
  - **Expected:** The hollow yellow dot before her new **Site** is easy to see.
  - **Notes:**

- [ ] `6A94` Sign out, and sign in as the Feature Lead, `feature.lead@fathom.test`.
  - **Expected:** The page is dark.
  - **Notes:**

- [ ] `B62F` Open the account menu.
  - **Expected:** The role menu's ticks and role names are easy to read.
  - **Notes:**

- [ ] `40B0` Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

**Afterwards:** Choose **Light** in the Appearance menu.
