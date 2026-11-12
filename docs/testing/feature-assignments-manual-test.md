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

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

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
  - **Expected:**
    - A card names **Search and discovery**, with a yellow dot before it.
    - The lead and the members stacked under that card are the same people as noted in step 1.
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

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. **Light** selected in the Appearance menu. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch; it shows today.

- [ ] **Step 1.** Select the left arrow, left of the timeline above the chart, once.
  - **Expected:**
    - The **Date** box shows the first day of last month.
    - The text below the timeline ends **Changes take effect from this date.**
  - **Notes:**

- [ ] **Step 2.** Select the Feature teams button, then **Payments core**. Note the first name in the **Members** row that is not the one in **Feature lead**: the leaver.
  - **Expected:**
    - The team panel opens, titled **Payments core**.
    - Its members are listed in the **Members** row.
  - **Notes:**

- [ ] **Step 3.** Select the change button in the **Members** row.
  - **Expected:** A list of people opens under the row, with the cursor in a box above it.
  - **Notes:**

- [ ] **Step 4.** Press the Down arrow key until a person without a tick is highlighted.
  - **Expected:** A person without a tick is on a light grey background.
  - **Notes:**

- [ ] **Step 5.** Press Enter. Note the person's name: the joiner.
  - **Expected:** The joiner has a tick.
  - **Notes:**

- [ ] **Step 6.** Press Enter.
  - **Expected:** The joiner is in the list of members, with a hollow yellow dot before their name.
  - **Notes:**

- [ ] **Step 7.** Select the change button in the **Members** row.
  - **Expected:** A list of people opens under the row, with the cursor in a box above it.
  - **Notes:**

- [ ] **Step 8.** Type the leaver's name, and press Enter.
  - **Expected:** The leaver has no tick.
  - **Notes:**

- [ ] **Step 9.** Press Enter.
  - **Expected:** The leaver's name is still in the list of members, with a hollow yellow dot before it, struck through.
  - **Notes:**

- [ ] **Step 10.** Select the **Feature assignments** page in the left-hand menu.
  - **Expected:** The **Feature assignments** page opens.
  - **Notes:**

- [ ] **Step 11.** Select **None** in the Group by menu.
  - **Expected:** There are no group names.
  - **Notes:**

- [ ] **Step 12.** Type the joiner's name in the search box.
  - **Expected:**
    - The joiner's row is tinted faint yellow.
    - A light green Live row is under it.
  - **Notes:**

- [ ] **Step 13.** Look along the joiner's row, from two months ago to the right.
  - **Expected:**
    - The cell two months ago holds the same labels as the Live row's cell under it.
    - The labels in the cell two months ago have no dot.
    - From last month on, each cell holds a **Payments core** label with a hollow yellow dot inside it, before the name, beside any other labels.
  - **Notes:**

- [ ] **Step 14.** Look along the light green row under it.
  - **Expected:**
    - Its cells hold no **Payments core** label.
    - Any other labels are in their colours.
  - **Notes:**

- [ ] **Step 15.** Empty the search box.
  - **Expected:** Every person is listed.
  - **Notes:**

- [ ] **Step 16.** Type the leaver's name in the search box.
  - **Expected:**
    - From last month on, the leaver's cells hold a **Payments core** label with a hollow yellow dot inside it.
    - The label's name is struck through.
  - **Notes:**

- [ ] **Step 17.** Select **Dark** in the Appearance menu.
  - **Expected:**
    - The tinted row, the dots in the labels and the struck-through label are easy to make out.
    - Every label is easy to read.
  - **Notes:**

- [ ] **Step 18.** Select **Light** in the Appearance menu.
  - **Expected:**
    - The tinted row, the dots in the labels and the struck-through label are easy to make out.
    - Every label is easy to read.
  - **Notes:**

### FA-15: The Draft Menu Shows Drafts or Leaves Them Out

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-14.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu and the leaver's name from FA-14 in the search box, after FA-14.

- [ ] **Step 1.** Open the Draft menu and select **Live only**.
  - **Expected:**
    - The leaver's row has no tint.
    - The leaver's labels have no dots.
    - No light green row is under the leaver's row.
    - **Payments core** is in every month it was in before FA-14.
    - Nothing is struck through.
  - **Notes:**

- [ ] **Step 2.** Open the Draft menu and select **Drafts applied**.
  - **Expected:**
    - From last month on, the leaver's cells hold no **Payments core** label.
    - There is no light green row.
  - **Notes:**

- [ ] **Step 3.** Empty the search box.
  - **Expected:** Every person is listed.
  - **Notes:**

- [ ] **Step 4.** Select **Feature team** in the Group by menu.
  - **Expected:** The people are listed in groups, each named for a feature team.
  - **Notes:**

- [ ] **Step 5.** Scroll to the **Payments core** group.
  - **Expected:** The joiner is listed under **Payments core**.
  - **Notes:**

- [ ] **Step 6.** Open the Draft menu and select **Live only**.
  - **Expected:**
    - The leaver is listed under **Payments core**.
    - The joiner is not.
  - **Notes:**

- [ ] **Step 7.** Open the Draft menu and select **Drafts beside live**.
  - **Expected:**
    - The joiner and the leaver are both listed under **Payments core**.
    - The joiner's **Payments core** labels from last month on have a hollow yellow dot inside them.
    - The leaver's **Payments core** labels from last month on have a hollow yellow dot inside them, and their name is struck through.
    - Each of their rows has a light green Live row under it.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FA-16: A Month's Teams Change From That Month On

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from FA-15.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. **Light** selected in the Appearance menu. Select the **Feature assignments** page in the left-hand menu, with nothing in the search box and no filters.

- [ ] **Step 1.** Select **Feature team** in the Group by menu.
  - **Expected:** The last group is **No feature team**.
  - **Notes:**

- [ ] **Step 2.** Scroll to the **No feature team** group, and note the name in its first row: the person.
  - **Expected:** The **No feature team** group lists at least one person.
  - **Notes:**

- [ ] **Step 3.** Select **None** in the Group by menu.
  - **Expected:** There are no group names.
  - **Notes:**

- [ ] **Step 4.** Type the person's name in the search box.
  - **Expected:** Only the person's row is listed.
  - **Notes:**

- [ ] **Step 5.** Select the person's cell two months after the current month.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] **Step 6.** Press Enter.
  - **Expected:** The team list opens, with no team shown as chosen.
  - **Notes:**

- [ ] **Step 7.** Type `Pay`, then press Tab.
  - **Expected:**
    - The team list closes.
    - The person's row is tinted faint yellow.
    - A light green Live row is under it.
    - The cells before the one selected hold no label.
    - From the cell selected on, each cell holds a **Payments core** label with a hollow yellow dot inside it, before the name.
  - **Notes:**

- [ ] **Step 8.** Press Cmd+Z, or Ctrl+Z outside a Mac.
  - **Expected:**
    - The person's row has no tint.
    - No light green row is under it.
    - No cell holds a label.
  - **Notes:**

- [ ] **Step 9.** Select the person's cell two months after the current month.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] **Step 10.** Press Enter.
  - **Expected:** The team list opens.
  - **Notes:**

- [ ] **Step 11.** Type `Pay`, then press Tab.
  - **Expected:**
    - The person's row is tinted faint yellow.
    - A light green Live row is under it.
    - From the cell selected on, each cell holds a **Payments core** label with a hollow yellow dot inside it.
  - **Notes:**

- [ ] **Step 12.** Select the **Org chart** page in the left-hand menu.
  - **Expected:** The **Org chart** page opens.
  - **Notes:**

- [ ] **Step 13.** Choose **Feature teams** in the teams switch.
  - **Expected:** The chart shows feature teams.
  - **Notes:**

- [ ] **Step 14.** Select the Feature teams button, then **Payments core**.
  - **Expected:**
    - The team panel opens, titled **Payments core**.
    - The person is in the **Members** row.
    - A hollow yellow dot is before the person's name.
    - After the name, in grey, **from** and the first day of the month two months after the current one, such as **from Jan 1, 2027**.
  - **Notes:**

### FA-17: The Current Month Changes From Today

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-16.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Select a cell in the current month's column that holds one label, **Payments core**, in a row with no tint.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] **Step 2.** Press Delete.
  - **Expected:**
    - The row is tinted faint yellow.
    - In the cell and every cell to its right, the **Payments core** label has a hollow yellow dot inside it.
    - The label's name is struck through.
  - **Notes:**

- [ ] **Step 3.** Press Cmd+Z, or Ctrl+Z outside a Mac.
  - **Expected:** The row is as it was before step 2.
  - **Notes:**

### FA-18: A Change the Draft Can't Hold Is Explained

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-17.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu and the person's name from FA-16 in the search box, after FA-16.

- [ ] **Step 1.** Select the person's cell four months after the current month.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] **Step 2.** Press Enter.
  - **Expected:** The team list opens, with **Payments core** shown as chosen.
  - **Notes:**

- [ ] **Step 3.** Type `Pay`, and press Enter.
  - **Expected:** **Payments core** is no longer shown as chosen.
  - **Notes:**

- [ ] **Step 4.** Select the person's name with the mouse.
  - **Expected:**
    - Fathom refuses the change, saying that the draft of **Payments core** already changes the person from another month, and to approve or discard that draft first.
    - The cell still holds the **Payments core** label.
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
    - **Over** is red and bold.
    - **Under** is grey.
  - **Notes:**

- [ ] **Step 2.** Select **Dark** in the Appearance menu.
  - **Expected:** These are easy to read and to tell apart:
    - the feature names
    - the percentages
    - the **Over** and **Under** lines
  - **Notes:**

- [ ] **Step 3.** Select **Light** in the Appearance menu.
  - **Expected:** These are easy to read and to tell apart:
    - the feature names
    - the percentages
    - the **Over** and **Under** lines
  - **Notes:**

### FA-21: Planned Hires Have Rows of Their Own

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-20.

**Preconditions:** **Feature assignments** open, with **Allocations** chosen in the mode switch, **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] **Step 2.** Type **Payments tester** in the search box, and note the month in the row's **Expected** column.
  - **Expected:**
    - One row is listed, named **Payments tester**.
    - **Expected** holds a month.
  - **Notes:**

- [ ] **Step 3.** Select the **Feature assignments** page in the left-hand menu.
  - **Expected:** The **Feature assignments** page opens.
  - **Notes:**

- [ ] **Step 4.** Type **Payments tester** in the search box.
  - **Expected:**
    - One row is listed, named **Payments tester**.
    - **Allocations** is still chosen in the mode switch.
  - **Notes:**

- [ ] **Step 5.** Look along the row from 12 months ago to the right.
  - **Expected:**
    - The cells before the month noted in step 2 are empty.
    - From that month on, cells list a feature with **100%**.
  - **Notes:**

- [ ] **Step 6.** Empty the search box.
  - **Expected:** Every row is listed again.
  - **Notes:**

- [ ] **Step 7.** Select **Feature team** in the Group by menu.
  - **Expected:** **Group by: Feature team** shows.
  - **Notes:**

- [ ] **Step 8.** Type **TBD** in the search box.
  - **Expected:**
    - Planned hires with no name and a temporary ID are listed by their position and ID, such as **SDET, TBD-** and a number, in grey.
    - They are under **No feature team**.
  - **Notes:**

- [ ] **Step 9.** Empty the search box.
  - **Expected:** Every row is listed again.
  - **Notes:**

- [ ] **Step 10.** Select **Teams** in the mode switch.
  - **Expected:** The cells show feature teams as labels.
  - **Notes:**

- [ ] **Step 11.** Type **Payments tester** in the search box.
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

- [ ] **Step 2.** Scroll the table down.
  - **Expected:**
    - A total row headed **Organization** is at the foot of the table.
    - It stays there as the rows scroll under it, with nothing showing through it.
  - **Notes:**

- [ ] **Step 3.** Scroll the table sideways.
  - **Expected:** **Organization** stays on the left while the months scroll sideways.
  - **Notes:**

- [ ] **Step 4.** Select **Dark** in the Appearance menu.
  - **Expected:** The total rows are easy to read and to tell apart from the rows above them.
  - **Notes:**

- [ ] **Step 5.** Select **Light** in the Appearance menu.
  - **Expected:** The total rows are easy to read and to tell apart from the rows above them.
  - **Notes:**

- [ ] **Step 6.** Select **None** in the Group by menu.
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

- [ ] **Step 2.** Close the Metrics panel.
  - **Expected:** The Metrics panel closes.
  - **Notes:**

- [ ] **Step 3.** Type **Payments tester** in the search box.
  - **Expected:**
    - One row is listed, named **Payments tester**.
    - In the **Organization** row, the cells before the month its allocations start are empty.
    - From that month on, each reads **1 of 1** and **100%**.
  - **Notes:**

### FA-24: Someone Who Left a Team Has a Row for Each Part

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-23.

**Preconditions:** **Feature assignments** open, with **Allocations** chosen in the mode switch, **Feature team** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] **Step 1.** Select **Teams** in the mode switch.
  - **Expected:** The cells show feature teams as labels.
  - **Notes:**

- [ ] **Step 2.** Under the **Mobile apps** group, find the person whose **Mobile apps** labels stop before the current month, and note their name and the last month with the label.
  - **Expected:** One person under **Mobile apps** has no **Mobile apps** label in the current month.
  - **Notes:**

- [ ] **Step 3.** Select **Allocations** in the mode switch.
  - **Expected:** The cells list features, each with its percentage.
  - **Notes:**

- [ ] **Step 4.** Type the name noted in step 2 in the search box.
  - **Expected:**
    - The person has a row under **Mobile apps** and a row under another group, or **No feature team**, each followed by a total row.
    - The total row under **Mobile apps** has figures only in the months the person was on **Mobile apps**, up to the month noted.
    - The other total row has figures only in the months before and after those.
    - Each figure reads **0 of 1** and **0%**.
  - **Notes:**

### FA-25: Someone Has a Row Under Each Manager They Reported To

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FA-24. Step 8 signs in as another account, and step 14 signs in as this one again.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. **People** open from the left-hand menu.

- [ ] **Step 1.** Type **Samuel Richter** in the search box.
  - **Expected:** Only Samuel Richter's row is listed.
  - **Notes:**

- [ ] **Step 2.** Select the row's **Manager** cell.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] **Step 3.** Press Enter.
  - **Expected:** A list of people opens under the cell.
  - **Notes:**

- [ ] **Step 4.** Type **Max**, and choose **Max Munk**.
  - **Expected:** The **Manager** cell reads **Max Munk**, with a hollow yellow dot before it.
  - **Notes:**

- [ ] **Step 5.** Select the row's **Manager assigned** cell.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] **Step 6.** Type the first day of the current month as digits alone, such as `20261101` in November 2026, and press Enter.
  - **Expected:** The **Manager assigned** cell reads the date typed, with a hollow yellow dot before it.
  - **Notes:**

- [ ] **Step 7.** Select the Publish button.
  - **Expected:**
    - A notice starts **Published**.
    - The Publish button is gone from the top bar.
  - **Notes:**

- [ ] **Step 8.** Sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Director**.
  - **Notes:**

- [ ] **Step 9.** Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] **Step 10.** Type **Samuel Richter** in the search box.
  - **Expected:** One entry is listed.
  - **Notes:**

- [ ] **Step 11.** Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] **Step 12.** Select **Approve 1 draft**.
  - **Expected:** A dialog opens with an **Approve** button.
  - **Notes:**

- [ ] **Step 13.** Select **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] **Step 14.** Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Operations Manager**.
  - **Notes:**

- [ ] **Step 15.** Select the **Feature assignments** page in the left-hand menu.
  - **Expected:** The **Feature assignments** page opens.
  - **Notes:**

- [ ] **Step 16.** Select **Allocations** in the mode switch.
  - **Expected:** The cells list features, each with its percentage.
  - **Notes:**

- [ ] **Step 17.** Select **Manager** in the Group by menu.
  - **Expected:** **Group by: Manager** shows.
  - **Notes:**

- [ ] **Step 18.** Type **Samuel Richter** in the search box.
  - **Expected:**
    - Samuel Richter has a row under **Atmananda Ganaka** whose cells are empty from the current month on.
    - He has a row under **Max Munk** whose cells are empty before the current month.
    - Each group ends with a total row.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.
