---
title: "Manual Test: Feature Assignments"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/feature-assignments-page*", "apps/web/src/team-months*", "apps/web/src/team-labels*", "apps/web/src/allocation-months*", "apps/web/src/allocation-lines*", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-11"
---

# Manual Test: Feature Assignments

## Scope

Verifies the **Feature assignments** page: how the table of feature teams by month looks and scrolls in light and dark mode, how the table of allocations by month reads, with its over- and under-allocated months, planned hires, and the capacity totals of each group and of the organization, grouping its rows, searching and filtering it, how it agrees with the **Org chart** on a chosen month, how drafts made on the **Org chart** show in it, changing a month's teams in it and finding the change on the **Org chart**, the line a role without Personal details sees in its place, and moving around it from the keyboard. The seeded feature teams and allocations are listed in [Development Setup](../design/development-setup.md#fictional-seed-data).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A mouse or trackpad, and a keyboard.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**
- **Engineering Manager:** `engineering.manager@fathom.test`
- **Engineering Director:** `engineering.director@fathom.test`
- **Executive:** `executive@fathom.test`
- **Team Member:** `team.member@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the Mode switch, the Group by menu and the Publish button. This test adds:

- **Total row:** in **Allocations**, a row in bold at the end of each group, headed **Total** in the **Person** column, and one at the foot of the table, headed **Organization**.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Tick each step whose expected result is seen, and write anything else under its notes.

### FA-01: The Page Opens at the Current Month

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account.

- [ ] **Step 1.** Select the **Feature assignments** page in the left-hand menu.
  - **Expected:**
    - The page is headed **Feature assignments**.
    - Above the table, in order: the mode switch, with **Teams** chosen, a search box, a **Draft** button, **Metrics**, and **Group by: Manager**.
    - The table has a **Person** column on the left and a column for each month.
  - **Notes:**

- [ ] **Step 2.** Look at the month headings without scrolling.
  - **Expected:** The current month is the first month beside the **Person** column.
  - **Notes:**

### FA-02: Names and Months Stay in View

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-01.

**Preconditions:** **Feature assignments** open.

- [ ] **Step 1.** Scroll the table sideways.
  - **Expected:** The **Person** column stays on the left, with nothing showing through it.
  - **Notes:**

- [ ] **Step 2.** Scroll the table down.
  - **Expected:** The month headings stay at the top, with nothing showing through them.
  - **Notes:**

### FA-03: Labels Name Each Team in Its Colour

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-02.

**Preconditions:** **Feature assignments** open, with the current month in view.

- [ ] **Step 1.** Look at the labels in the current month's column.
  - **Expected:** Each label names a feature team, in its colour:
    - **Mobile apps** orange
    - **Payments core** teal
    - **Search** indigo
    - **Platform reliability**, which has no colour, neutral
  - **Notes:**

- [ ] **Step 2.** Hold the pointer over a label.
  - **Expected:** After a moment, a tooltip shows the team's whole name.
  - **Notes:**

### FA-04: The Table Reads Well in Light and Dark Mode

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-03.

**Preconditions:** **Feature assignments** open.

- [ ] **Step 1.** Select **Light** in the Appearance menu.
  - **Expected:** The labels, headings, group names and shaded cells are easy to read.
  - **Notes:**

- [ ] **Step 2.** Select **Dark** in the Appearance menu.
  - **Expected:** The labels, headings, group names and shaded cells are easy to read.
  - **Notes:**

### FA-05: Rows Group by Manager, Feature Team or Not at All

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-04.

**Preconditions:** **Feature assignments** open.

- [ ] **Step 1.** Select **Feature team** in the Group by menu.
  - **Expected:**
    - The rows are grouped under the feature teams in order of name, then **No feature team**.
    - Someone on two teams is listed under both.
  - **Notes:**

- [ ] **Step 2.** Reload the page.
  - **Expected:**
    - **Group by: Feature team** still shows.
    - The table opens at the current month again.
  - **Notes:**

- [ ] **Step 3.** Select **None** in the Group by menu.
  - **Expected:**
    - There are no group names.
    - Everyone is listed once, by name.
  - **Notes:**

### FA-06: Search Finds Teams in Any Month

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-05.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Type **Search** in the search box.
  - **Expected:**
    - Only people with a **Search** label in some month are listed.
    - The count of rows above the table goes down.
  - **Notes:**

### FA-07: A Month Can Be Filtered by Team

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-06.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Open the column menu of the current month.
  - **Expected:** The menu offers **Filter…**.
  - **Notes:**

- [ ] **Step 2.** Select **Filter…**.
  - **Expected:** A list of the feature teams opens.
  - **Notes:**

- [ ] **Step 3.** Select **Payments core**.
  - **Expected:** Only people on **Payments core** that month are listed.
  - **Notes:**

- [ ] **Step 4.** Press Esc.
  - **Expected:** A filter pill above the table names the month and the team.
  - **Notes:**

### FA-08: People Can Be Filtered by Name

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-07.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Open the **Person** column menu.
  - **Expected:** The menu offers **Filter…**.
  - **Notes:**

- [ ] **Step 2.** Select **Filter…**.
  - **Expected:** A box for the name opens.
  - **Notes:**

- [ ] **Step 3.** Type the first few letters of the name in the first row of the table.
  - **Expected:** Only people whose names contain those letters are listed.
  - **Notes:**

### FA-09: Metrics Count People

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-08.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Select **Metrics**.
  - **Expected:**
    - The Metrics panel opens.
    - It offers the months to break down by.
    - It gives the number of people.
  - **Notes:**

### FA-10: The Table Agrees With the Org Chart

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-09.

**Preconditions:** **Feature assignments** open, with **Feature team** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Under the **Search** group, note the people with a **Search** label in the column for the month before the current one.
  - **Expected:** The people are listed under the **Search** group.
  - **Notes:**

- [ ] **Step 2.** Select the **Org chart** page in the left-hand menu.
  - **Expected:** The **Org chart** page opens.
  - **Notes:**

- [ ] **Step 3.** Select **Feature teams** in the switch at the top right.
  - **Expected:** The chart shows feature teams.
  - **Notes:**

- [ ] **Step 4.** Select the left arrow beside the timeline once.
  - **Expected:** The team led by the card that names **Search**, the lead and the members stacked under that card, are the same people as noted in step 1.
  - **Notes:**

### FA-11: Months Outside Someone's Employment Are Shaded

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-10.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Scroll sideways and down through the table.
  - **Expected:**
    - Some people have shaded cells at the start or end of their row, for the months before they started or after they left.
    - Shaded cells hold no labels.
  - **Notes:**

### FA-12: A Role Without Personal Details Is Told Why

**Account:** Team Member, `team.member@fathom.test`, changed from FA-11.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select the **Feature assignments** page in the left-hand menu.
  - **Expected:**
    - Under the **Feature assignments** heading, a line in grey reads **Feature assignments needs Personal access.**
    - There is no table, no **Teams** and **Allocations** switch, and no **Draft** button.
  - **Notes:**

### FA-13: The Table Works From the Keyboard

**Account:** Executive, `executive@fathom.test`, changed from FA-12.

**Preconditions:** Signed in with this account. **Feature assignments** open from the left-hand menu.

- [ ] **Step 1.** Select a cell in the current month's column that holds a label.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] **Step 2.** Press the right arrow key.
  - **Expected:**
    - The outline moves one cell right.
    - The table scrolls to keep it in view, with the **Person** column staying in place.
  - **Notes:**

- [ ] **Step 3.** Press the down arrow key.
  - **Expected:**
    - The outline moves one cell down.
    - The table scrolls to keep it in view, with the month headings staying in place.
  - **Notes:**

- [ ] **Step 4.** Press Enter.
  - **Expected:** No box for editing opens in the cell.
  - **Notes:**

- [ ] **Step 5.** Type a letter.
  - **Expected:** Nothing is typed or changed in the cell.
  - **Notes:**

### FA-14: A Draft Shows From the Month It Takes Effect

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FA-13.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. **Light** selected in the Appearance menu. **Org chart** open, with **Feature teams** chosen in the switch at the top right, showing today.

- [ ] **Step 1.** Select the left arrow, left of the timeline above the chart, once.
  - **Expected:**
    - The **Date** box shows the first day of last month.
    - The text below the timeline ends **Changes take effect from this date.**
  - **Notes:**

- [ ] **Step 2.** Select the Feature teams button, then **Platform reliability**.
  - **Expected:**
    - The team panel opens with **Team** reading **Platform reliability**.
    - Its members are listed.
  - **Notes:**

- [ ] **Step 3.** Open **Add member** and choose the first person listed. Note their name: the joiner.
  - **Expected:** The joiner is listed among the members with a hollow yellow dot and **Draft**.
  - **Notes:**

- [ ] **Step 4.** Select the **×** at the right of the first member listed before step 3. Note their name: the leaver.
  - **Expected:** A line reading the leaver's name and **leaving** is shown under the members, marked **Live**.
  - **Notes:**

- [ ] **Step 5.** Select the **Feature assignments** page in the left-hand menu. Select **None** in the Group by menu, and type the joiner's name in the search box.
  - **Expected:**
    - The joiner's row is tinted blue, with a hollow yellow dot and **Draft** beside their name.
    - A light green row under it is marked **Live**.
  - **Notes:**

- [ ] **Step 6.** Look along the joiner's tinted row, from two months ago to the right.
  - **Expected:**
    - The cell two months ago holds the same labels as the light green row under it, and is not yellow.
    - From last month on, each cell is yellow and holds a **Platform reliability** label with a hollow yellow dot inside it, beside any other labels.
  - **Notes:**

- [ ] **Step 7.** Look along the light green row under it.
  - **Expected:**
    - Its cells hold no **Platform reliability** label.
    - Any other labels are in their colours.
  - **Notes:**

- [ ] **Step 8.** Empty the search box and type the leaver's name.
  - **Expected:**
    - From last month on, the leaver's cells are yellow.
    - The **Platform reliability** label in them is struck through.
  - **Notes:**

- [ ] **Step 9.** Select **Dark** in the Appearance menu, then **Light**.
  - **Expected:**
    - In both modes, the yellow cells, the dots in the labels and the struck-through label are easy to make out.
    - Every label is easy to read.
  - **Notes:**

### FA-15: The Draft Menu Shows Drafts or Leaves Them Out

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-14.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu and the leaver's name from FA-14 in the search box, after FA-14.

- [ ] **Step 1.** Open the Draft menu and select **Live only**.
  - **Expected:**
    - The leaver's row has no mark, no yellow cells and no light green row.
    - **Platform reliability** is in every month it was in before FA-14, with nothing struck through.
  - **Notes:**

- [ ] **Step 2.** Open the Draft menu and select **Drafts applied**.
  - **Expected:**
    - From last month on, the leaver's cells hold no **Platform reliability** label.
    - There is no light green row.
  - **Notes:**

- [ ] **Step 3.** Empty the search box. Select **Feature team** in the Group by menu, and scroll to the **Platform reliability** group.
  - **Expected:** The joiner is listed under **Platform reliability**.
  - **Notes:**

- [ ] **Step 4.** Open the Draft menu and select **Live only**.
  - **Expected:**
    - The leaver is listed under **Platform reliability**.
    - The joiner is not.
  - **Notes:**

- [ ] **Step 5.** Open the Draft menu and select **Drafts beside live**.
  - **Expected:**
    - The joiner and the leaver are both listed under **Platform reliability**.
    - The yellow cells, the struck-through label and the light green rows show as in FA-14.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FA-16: A Month's Teams Change From That Month On

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from FA-15.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. **Light** selected in the Appearance menu. **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Note the name in the first row of the table: the person. Type it in the search box.
  - **Expected:** Only the person's row is listed.
  - **Notes:**

- [ ] **Step 2.** Select the person's cell two months after the current month, and press Enter.
  - **Expected:** The team list opens, with the teams already in the cell shown as chosen.
  - **Notes:**

- [ ] **Step 3.** Type the first letters of a team that is not in the cell, and note its name: the new team. Press Tab.
  - **Expected:**
    - The team list closes.
    - The person's row is tinted blue, with a hollow yellow dot and **Draft** beside their name.
    - A light green row under it is marked **Live**.
    - The cells before the one selected are not yellow.
    - From the cell selected on, each cell is yellow and holds the new team's label with a hollow yellow dot inside it.
  - **Notes:**

- [ ] **Step 4.** Press Cmd+Z, or Ctrl+Z outside a Mac.
  - **Expected:**
    - The person's row is as it was in step 1.
    - It has no **Draft** mark and no yellow cells.
  - **Notes:**

- [ ] **Step 5.** Repeat steps 2 and 3, choosing the same new team.
  - **Expected:** The row shows the change as in step 3.
  - **Notes:**

- [ ] **Step 6.** Select the **Org chart** page in the left-hand menu, select **Feature teams** in the switch at the top right, then select the Feature teams button and the new team.
  - **Expected:**
    - The team panel opens for the new team.
    - The person is listed among the members with a hollow yellow dot and **Draft**.
  - **Notes:**

### FA-17: The Current Month Changes From Today

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-16.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Select a cell in the current month's column that holds one label, in a row with no **Draft** mark, and press Delete.
  - **Expected:**
    - The cell and every cell to its right are yellow.
    - The label in them is struck through.
  - **Notes:**

- [ ] **Step 2.** Press Cmd+Z, or Ctrl+Z outside a Mac.
  - **Expected:** The row is as it was before step 1.
  - **Notes:**

### FA-18: A Change the Draft Can't Hold Is Explained

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-17.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu and the person's name from FA-16 in the search box, after FA-16.

- [ ] **Step 1.** Select the person's cell four months after the current month, and press Enter. Type the first letters of the new team from FA-16 and press Enter to take it out, then select the person's name with the mouse.
  - **Expected:**
    - Fathom refuses the change, saying that the draft of the new team already changes the person from another month, and to approve or discard that draft first.
    - The cell still holds the new team's label.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FA-19: Allocations Show Each Feature With Its Percentage

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-18.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. **Light** selected in the Appearance menu. **Feature assignments** open, with **Feature team** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Select **Allocations** in the mode switch.
  - **Expected:**
    - The table opens at the current month again, still grouped by **Feature team**.
    - Under the **Payments core** group, cells list features, each on a line of its own with its percentage at the right, such as **50%**.
  - **Notes:**

- [ ] **Step 2.** Hold the pointer over a feature's name in a cell.
  - **Expected:** After a moment, a tooltip shows the feature's whole name.
  - **Notes:**

- [ ] **Step 3.** Under the **Payments core** group, find the first cell in the current month's column that lists two features.
  - **Expected:** Under the two features, set off by a thin line above it, a last line gives the two percentages added up, at the right.
  - **Notes:**

- [ ] **Step 4.** Reload the page.
  - **Expected:**
    - **Allocations** is still chosen in the mode switch.
    - **Group by: Feature team** still shows.
  - **Notes:**

- [ ] **Step 5.** Select **Teams** in the mode switch.
  - **Expected:**
    - The cells show feature teams as labels again.
    - The rows are still grouped by **Feature team**.
  - **Notes:**

### FA-20: Over- and Under-Allocated Months Stand Out

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-19.

**Preconditions:** **Feature assignments** open, with **Allocations** chosen in the mode switch, **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** In the current month's column, find a cell whose last line reads **Over**, and one whose last line reads **Under**.
  - **Expected:**
    - **Over** and its percentage are red and bold.
    - **Under** and its percentage are grey.
  - **Notes:**

- [ ] **Step 2.** Select **Dark** in the Appearance menu, then **Light**.
  - **Expected:** In both modes, these are easy to read and to tell apart:
    - the feature names
    - the percentages
    - the **Over** and **Under** lines
  - **Notes:**

### FA-21: Planned Hires Have Rows of Their Own

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-20.

**Preconditions:** **Feature assignments** open, with **Allocations** chosen in the mode switch, **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Select the **People** page in the left-hand menu, type **Payments tester** in the search box, and note the month in the row's **Expected** column.
  - **Expected:**
    - One row is listed, named **Payments tester**.
    - **Expected** holds a month.
  - **Notes:**

- [ ] **Step 2.** Select the **Feature assignments** page in the left-hand menu, and type **Payments tester** in the search box.
  - **Expected:**
    - One row is listed, named **Payments tester**.
    - **Allocations** is still chosen in the mode switch.
  - **Notes:**

- [ ] **Step 3.** Look along the row from 12 months ago to the right.
  - **Expected:**
    - The cells before the month noted in step 1 are empty.
    - From that month on, cells list a feature with **100%**.
  - **Notes:**

- [ ] **Step 4.** Empty the search box. Select **Feature team** in the Group by menu, and type **TBD** in the search box.
  - **Expected:**
    - Planned hires with no name and a temporary ID are listed by their position and ID, such as **SDET, TBD-** and a number, in grey.
    - They are under **No feature team**.
  - **Notes:**

- [ ] **Step 5.** Empty the search box and select **Teams** in the mode switch. Type **Payments tester** in the search box.
  - **Expected:** No rows are listed.
  - **Notes:**

### FA-22: Each Group and the Organization Total Their Capacity

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-21.

**Preconditions:** **Light** selected in the Appearance menu. **Feature assignments** open, with **Allocations** chosen in the mode switch, **Feature team** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Scroll down to the end of the **Payments core** group.
  - **Expected:**
    - The group ends with a total row.
    - Each of its month cells reads two numbers, such as **7.5 of 9**, with a percentage under it, such as **83.3%**, in bold.
  - **Notes:**

- [ ] **Step 2.** Look at the foot of the table, then scroll the table down and sideways.
  - **Expected:**
    - A total row headed **Organization** stays at the foot of the table as the rows scroll under it, with nothing showing through it.
    - **Organization** stays on the left while the months scroll sideways.
  - **Notes:**

- [ ] **Step 3.** Select **Dark** in the Appearance menu, then **Light**.
  - **Expected:** In both modes the total rows are easy to read and to tell apart from the rows above them.
  - **Notes:**

- [ ] **Step 4.** Select **None** in the Group by menu.
  - **Expected:**
    - No group ends with a total row.
    - The **Organization** row is still at the foot.
  - **Notes:**

### FA-23: The Totals Count Only the Rows Shown

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-22.

**Preconditions:** **Feature assignments** open, with **Allocations** chosen in the mode switch, **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Select **Metrics**.
  - **Expected:** The Metrics panel gives a number of people and a number of planned hires, such as **150 people and 8 planned hires**.
  - **Notes:**

- [ ] **Step 2.** Close the Metrics panel, and type **Payments tester** in the search box.
  - **Expected:**
    - One row is listed, named **Payments tester**.
    - In the **Organization** row, the cells before the month its allocations start are empty.
    - From that month on, each reads **1 of 1** and **100%**.
  - **Notes:**

### FA-24: Someone Who Left a Team Has a Row for Each Part

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-23.

**Preconditions:** **Feature assignments** open, with **Allocations** chosen in the mode switch, **Feature team** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Select **Teams** in the mode switch. Under the **Mobile apps** group, find the person whose **Mobile apps** labels stop before the current month, and note their name and the last month with the label.
  - **Expected:** One person under **Mobile apps** has no **Mobile apps** label in the current month.
  - **Notes:**

- [ ] **Step 2.** Select **Allocations** in the mode switch, and type the name noted in step 1 in the search box.
  - **Expected:**
    - The person has a row under **Mobile apps** and a row under another group, or **No feature team**, each followed by a total row.
    - The total row under **Mobile apps** has figures only in the months the person was on **Mobile apps**, up to the month noted.
    - The other total row has figures only in the months before and after those.
    - Each figure reads **0 of 1** and **0%**.
  - **Notes:**

### FA-25: Someone Has a Row Under Each Manager They Reported To

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FA-24. Step 3 signs in as another account, and step 4 signs in as this one again.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. **People** open from the left-hand menu.

- [ ] **Step 1.** Type **Samuel Richter** in the search box. Select the row's **Manager** cell, press Enter, type **Max**, and choose **Max Munk**. Select the row's **Manager assigned** cell, type the first day of the current month as digits alone, such as `20261101` in November 2026, and press Enter.
  - **Expected:**
    - The **Manager** cell reads **Max Munk**, in yellow.
    - The **Manager assigned** cell reads the date typed, in yellow.
  - **Notes:**

- [ ] **Step 2.** Select the Publish button.
  - **Expected:**
    - A notice starts **Published**.
    - The Publish button is gone from the top bar.
  - **Notes:**

- [ ] **Step 3.** Sign in as the Engineering Director, `engineering.director@fathom.test`. Select the **Drafts** page in the left-hand menu and type **Samuel Richter** in the search box. Select the entry's checkbox, then **Approve 1 draft**, and **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] **Step 4.** Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`. Select the **Feature assignments** page in the left-hand menu, **Allocations** in the mode switch and **Manager** in the Group by menu, and type **Samuel Richter** in the search box.
  - **Expected:**
    - Samuel Richter has a row under **Atmananda Ganaka** whose cells are empty from the current month on.
    - He has a row under **Max Munk** whose cells are empty before the current month.
    - Each group ends with a total row.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.
