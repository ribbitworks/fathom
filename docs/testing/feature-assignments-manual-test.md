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

- [ ] `25EE` Select the **Feature assignments** page in the left-hand menu.
  - **Expected:**
    - The page is headed **Feature assignments**.
    - Above the table, in order: the mode switch, with **Teams** chosen, a search box, a **Draft** button, **Metrics**, and **Group by: Manager**.
    - The table has a **Person** column on the left and a column for each month.
  - **Notes:**

- [ ] `428B` Look at the month headings without scrolling.
  - **Expected:** The current month is the first month beside the **Person** column.
  - **Notes:**

### FA-02: Names and Months Stay in View

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-01.

**Preconditions:** **Feature assignments** open.

- [ ] `ACD0` Scroll the table sideways.
  - **Expected:**
    - The **Person** column stays on the left.
    - Nothing shows through it.
  - **Notes:**

- [ ] `9CE0` Scroll the table down.
  - **Expected:**
    - The month headings stay at the top.
    - Nothing shows through them.
  - **Notes:**

### FA-03: Labels Name Each Team in Its Colour

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-02.

**Preconditions:** **Feature assignments** open, with the current month in view.

- [ ] `E780` Look at the labels in the current month's column.
  - **Expected:** Each label names a feature team, in its colour:
    - **Mobile apps** orange
    - **Payments core** teal
    - **Search** indigo
    - **Platform reliability**, which has no colour, neutral
  - **Notes:**

- [ ] `18C9` Hold the pointer over a label.
  - **Expected:** After a moment, a tooltip shows the team's whole name.
  - **Notes:**

### FA-04: The Table Reads Well in Light and Dark Mode

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-03.

**Preconditions:** **Feature assignments** open.

- [ ] `A95E` Select **Light** in the Appearance menu.
  - **Expected:** The labels, headings, group names and shaded cells are easy to read.
  - **Notes:**

- [ ] `67CB` Select **Dark** in the Appearance menu.
  - **Expected:** The labels, headings, group names and shaded cells are easy to read.
  - **Notes:**

### FA-05: Rows Group by Manager, Feature Team or Not at All

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-04.

**Preconditions:** **Feature assignments** open.

- [ ] `6A68` Select **Feature team** in the Group by menu.
  - **Expected:**
    - The rows are grouped under the feature teams in order of name, then **No feature team**.
    - Someone on two teams is listed under both.
  - **Notes:**

- [ ] `2E42` Reload the page.
  - **Expected:**
    - **Group by: Feature team** still shows.
    - The table opens at the current month again.
  - **Notes:**

- [ ] `441A` Select **None** in the Group by menu.
  - **Expected:**
    - There are no group names.
    - Everyone is listed once, by name.
  - **Notes:**

### FA-06: Search Finds Teams in Any Month

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-05.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `40E2` Type **Search** in the search box.
  - **Expected:**
    - Only people with a **Search** label in some month are listed.
    - The count of rows above the table goes down.
  - **Notes:**

### FA-07: A Month Can Be Filtered by Team

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-06.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `CE15` Open the column menu of the current month.
  - **Expected:** The menu offers **Filter…**.
  - **Notes:**

- [ ] `8DB4` Select **Filter…**.
  - **Expected:** A list of the feature teams opens.
  - **Notes:**

- [ ] `D6AF` Select **Payments core**.
  - **Expected:** Only people on **Payments core** that month are listed.
  - **Notes:**

- [ ] `621A` Press Esc.
  - **Expected:** A filter pill above the table names the month and the team.
  - **Notes:**

### FA-08: People Can Be Filtered by Name

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-07.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `745A` Open the **Person** column menu.
  - **Expected:** The menu offers **Filter…**.
  - **Notes:**

- [ ] `0BE1` Select **Filter…**.
  - **Expected:** A box for the name opens.
  - **Notes:**

- [ ] `12F2` Type the first few letters of the name in the first row of the table.
  - **Expected:** Only people whose names contain those letters are listed.
  - **Notes:**

### FA-09: Metrics Count People

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-08.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `61E9` Select **Metrics**.
  - **Expected:**
    - The Metrics panel opens.
    - It offers the months to break down by.
    - It gives the number of people.
  - **Notes:**

### FA-10: The Table Agrees With the Org Chart

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-09.

**Preconditions:** **Feature assignments** open, with **Feature team** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `BA7E` Under the **Search** group, note the people with a **Search** label in the column for the month before the current one.
  - **Expected:** The people are listed under the **Search** group.
  - **Notes:**

- [ ] `0B62` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The **Org chart** page opens.
  - **Notes:**

- [ ] `BED2` Select **Feature teams** in the switch at the top right.
  - **Expected:** The chart shows feature teams.
  - **Notes:**

- [ ] `6D7D` Select the left arrow beside the timeline once.
  - **Expected:**
    - A card names **Search and discovery**.
    - A yellow dot is before it.
    - The lead and the members stacked under that card are the same people as noted in step `BA7E`.
  - **Notes:**

### FA-11: Months Outside Someone's Employment Are Shaded

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-10.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `7B9F` Scroll sideways and down through the table.
  - **Expected:**
    - Some people have shaded cells at the start or end of their row, for the months before they started or after they left.
    - Shaded cells hold no labels.
  - **Notes:**

### FA-12: A Role Without Personal Details Is Told Why

**Account:** Team Member, `team.member@fathom.test`, changed from FA-11.

**Preconditions:** Signed in with this account.

- [ ] `7C7A` Select the **Feature assignments** page in the left-hand menu.
  - **Expected:**
    - Under the **Feature assignments** heading, a line in grey reads **Feature assignments needs Personal access.**
    - There is no table.
    - There is no **Teams** and **Allocations** switch.
    - There is no **Draft** button.
  - **Notes:**

### FA-13: The Table Works From the Keyboard

**Account:** Executive, `executive@fathom.test`, changed from FA-12.

**Preconditions:** Signed in with this account. **Feature assignments** open from the left-hand menu.

- [ ] `39EC` Select a cell in the current month's column that holds a label.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `0A8A` Press the right arrow key.
  - **Expected:**
    - The outline moves one cell right.
    - The table scrolls to keep it in view.
    - The **Person** column stays in place.
  - **Notes:**

- [ ] `4E12` Press the down arrow key.
  - **Expected:**
    - The outline moves one cell down.
    - The table scrolls to keep it in view.
    - The month headings stay in place.
  - **Notes:**

- [ ] `648D` Press Enter.
  - **Expected:** No box for editing opens in the cell.
  - **Notes:**

- [ ] `D646` Type a letter.
  - **Expected:** Nothing is typed or changed in the cell.
  - **Notes:**

### FA-14: A Draft Shows From the Month It Takes Effect

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FA-13.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. **Light** selected in the Appearance menu. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch; it shows today.

- [ ] `8E7F` Select the left arrow, left of the timeline above the chart, once.
  - **Expected:**
    - The **Date** box shows the first day of last month.
    - The text below the timeline ends **Changes take effect from this date.**
  - **Notes:**

- [ ] `6B75` Select the Feature teams button, then **Payments core**. Note the first name in the **Members** row that is not the one in **Feature lead**: the leaver.
  - **Expected:**
    - The team panel opens, titled **Payments core**.
    - Its members are listed in the **Members** row.
  - **Notes:**

- [ ] `F4A2` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `EA55` Press the Down arrow key until a person without a tick is highlighted.
  - **Expected:** A person without a tick is on a light grey background.
  - **Notes:**

- [ ] `4C34` Press Enter. Note the person's name: the joiner.
  - **Expected:** The joiner has a tick.
  - **Notes:**

- [ ] `B284` Press Enter.
  - **Expected:**
    - The joiner is in the list of members.
    - A hollow yellow dot is before their name.
  - **Notes:**

- [ ] `02BC` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `5DFE` Type the leaver's name, and press Enter.
  - **Expected:** The leaver has no tick.
  - **Notes:**

- [ ] `F1A6` Press Enter.
  - **Expected:**
    - The leaver's name is still in the list of members.
    - A hollow yellow dot is before it.
    - The leaver's name is struck through.
  - **Notes:**

- [ ] `A33A` Select the **Feature assignments** page in the left-hand menu.
  - **Expected:** The **Feature assignments** page opens.
  - **Notes:**

- [ ] `60E4` Select **None** in the Group by menu.
  - **Expected:** There are no group names.
  - **Notes:**

- [ ] `C1C8` Type the joiner's name in the search box.
  - **Expected:**
    - The joiner's row is tinted faint yellow.
    - A light green Live row is under it.
  - **Notes:**

- [ ] `38D9` Look along the joiner's row, from two months ago to the right.
  - **Expected:**
    - The cell two months ago holds no **Payments core** label.
    - The labels in the cell two months ago have no dot.
    - From last month on, each cell holds a **Payments core** label, beside any other labels.
    - Each of those **Payments core** labels has a hollow yellow dot inside it, before the name.
  - **Notes:**

- [ ] `868D` Look along the light green row under it.
  - **Expected:**
    - Its cells hold no **Payments core** label.
    - Any other labels are in their colours.
  - **Notes:**

- [ ] `2B72` Empty the search box.
  - **Expected:** Every person is listed.
  - **Notes:**

- [ ] `CC85` Type the leaver's name in the search box.
  - **Expected:**
    - From last month on, the leaver's cells hold a **Payments core** label with a hollow yellow dot inside it.
    - The label's name is struck through.
  - **Notes:**

- [ ] `F5E5` Select **Dark** in the Appearance menu.
  - **Expected:**
    - The tinted row, the dots in the labels and the struck-through label are easy to make out.
    - Every label is easy to read.
  - **Notes:**

- [ ] `54F4` Select **Light** in the Appearance menu.
  - **Expected:**
    - The tinted row, the dots in the labels and the struck-through label are easy to make out.
    - Every label is easy to read.
  - **Notes:**

### FA-15: The Draft Menu Shows Drafts or Leaves Them Out

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-14.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu and the leaver's name from FA-14 in the search box, after FA-14.

- [ ] `278A` Open the Draft menu and select **Live only**.
  - **Expected:**
    - The leaver's row has no tint.
    - The leaver's labels have no dots.
    - No light green row is under the leaver's row.
    - The leaver's cells hold a **Payments core** label in every month they held one before FA-14, from the earliest such month on.
    - Nothing is struck through.
  - **Notes:**

- [ ] `AD18` Open the Draft menu and select **Drafts applied**.
  - **Expected:**
    - From last month on, the leaver's cells hold no **Payments core** label.
    - There is no light green row.
  - **Notes:**

- [ ] `2BE2` Empty the search box.
  - **Expected:** Every person is listed.
  - **Notes:**

- [ ] `5C14` Select **Feature team** in the Group by menu.
  - **Expected:** The people are listed in groups, each named for a feature team.
  - **Notes:**

- [ ] `5ABA` Scroll to the **Payments core** group.
  - **Expected:** The joiner is listed under **Payments core**.
  - **Notes:**

- [ ] `A820` Open the Draft menu and select **Live only**.
  - **Expected:**
    - The leaver is listed under **Payments core**.
    - The joiner is not.
  - **Notes:**

- [ ] `18D3` Open the Draft menu and select **Drafts beside live**.
  - **Expected:**
    - The joiner and the leaver are both listed under **Payments core**.
    - The joiner's **Payments core** labels from last month on have a hollow yellow dot inside them.
    - The leaver's **Payments core** labels from last month on have a hollow yellow dot inside them.
    - The leaver's name is struck through.
    - Each of their rows has a light green Live row under it.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FA-16: A Month's Teams Change From That Month On

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from FA-15.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. **Light** selected in the Appearance menu. Select the **Feature assignments** page in the left-hand menu, with nothing in the search box and no filters.

- [ ] `FB0D` Select **Feature team** in the Group by menu.
  - **Expected:** The last group is **No feature team**.
  - **Notes:**

- [ ] `009D` Scroll to the **No feature team** group, and note the name in its first row: the person.
  - **Expected:** The **No feature team** group lists at least one person.
  - **Notes:**

- [ ] `6BFB` Select **None** in the Group by menu.
  - **Expected:** There are no group names.
  - **Notes:**

- [ ] `EBE4` Type the person's name in the search box.
  - **Expected:** Only the person's row is listed.
  - **Notes:**

- [ ] `45D0` Select the person's cell two months after the current month.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `EB7C` Press Enter.
  - **Expected:**
    - The team list opens.
    - No team is shown as chosen.
  - **Notes:**

- [ ] `A772` Type `Pay`, then press Tab.
  - **Expected:**
    - The team list closes.
    - The person's row is tinted faint yellow.
    - A light green Live row is under it.
    - The cells before the one selected hold no label.
    - From the cell selected on, each cell holds a **Payments core** label with a hollow yellow dot inside it, before the name.
  - **Notes:**

- [ ] `68BF` Press Cmd+Z, or Ctrl+Z outside a Mac.
  - **Expected:**
    - The person's row has no tint.
    - No light green row is under it.
    - No cell holds a label.
  - **Notes:**

- [ ] `1EA7` Select the person's cell two months after the current month.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `16C0` Press Enter.
  - **Expected:** The team list opens.
  - **Notes:**

- [ ] `086B` Type `Pay`, then press Tab.
  - **Expected:**
    - The person's row is tinted faint yellow.
    - A light green Live row is under it.
    - From the cell selected on, each cell holds a **Payments core** label with a hollow yellow dot inside it.
  - **Notes:**

- [ ] `D42A` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The **Org chart** page opens.
  - **Notes:**

- [ ] `530C` Choose **Feature teams** in the teams switch.
  - **Expected:** The chart shows feature teams.
  - **Notes:**

- [ ] `9ACF` Select the Feature teams button, then **Payments core**.
  - **Expected:**
    - The team panel opens, titled **Payments core**.
    - The person is in the **Members** row.
    - A hollow yellow dot is before the person's name.
    - After the name, in grey, **from** and the first day of the month two months after the current one, such as **from Jan 1, 2027**.
  - **Notes:**

### FA-17: The Current Month Changes From Today

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-16.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `5AF9` Select a cell in the current month's column that holds one label, **Payments core**, in a row with no tint.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `8E9A` Press Delete.
  - **Expected:**
    - The row is tinted faint yellow.
    - In the cell and every cell to its right, the **Payments core** label has a hollow yellow dot inside it.
    - The label's name is struck through.
  - **Notes:**

- [ ] `2F9C` Press Cmd+Z, or Ctrl+Z outside a Mac.
  - **Expected:**
    - The row has no tint.
    - In the cell and every cell to its right, the **Payments core** label has no dot.
    - The label's name is not struck through.
  - **Notes:**

### FA-18: A Change the Draft Can't Hold Is Explained

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-17.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu and the person's name from FA-16 in the search box, after FA-16.

- [ ] `9DE7` Select the person's cell four months after the current month.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `E664` Press Enter.
  - **Expected:**
    - The team list opens.
    - **Payments core** is shown as chosen.
  - **Notes:**

- [ ] `562D` Type `Pay`, and press Enter.
  - **Expected:** **Payments core** is no longer shown as chosen.
  - **Notes:**

- [ ] `822C` Select the person's name with the mouse.
  - **Expected:**
    - Fathom refuses the change, saying that the draft of **Payments core** already changes the person from another month, and to approve or discard that draft first.
    - The cell still holds the **Payments core** label.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FA-19: Allocations Show Each Feature With Its Percentage

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-18.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. **Light** selected in the Appearance menu. **Feature assignments** open, with **Feature team** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `F80D` Select **Allocations** in the mode switch.
  - **Expected:**
    - The table opens at the current month again.
    - The rows are still grouped by **Feature team**.
    - Under the **Payments core** group, cells list features, each on a line of its own with its percentage at the right, such as **50%**.
  - **Notes:**

- [ ] `ABC9` Hold the pointer over a feature's name in a cell.
  - **Expected:** After a moment, a tooltip shows the feature's whole name.
  - **Notes:**

- [ ] `61EC` Under the **Payments core** group, find the first cell in the current month's column that lists two features.
  - **Expected:**
    - Under the two features, a last line gives the two percentages added up, at the right.
    - A thin line above it sets it off.
  - **Notes:**

- [ ] `503E` Reload the page.
  - **Expected:**
    - **Allocations** is still chosen in the mode switch.
    - **Group by: Feature team** still shows.
  - **Notes:**

- [ ] `6F79` Select **Teams** in the mode switch.
  - **Expected:**
    - The cells show feature teams as labels again.
    - The rows are still grouped by **Feature team**.
  - **Notes:**

### FA-20: Over- and Under-Allocated Months Stand Out

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-19.

**Preconditions:** **Feature assignments** open, with **Allocations** chosen in the mode switch, **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `CBFE` In the current month's column, find a cell whose last line reads **Over**, and one whose last line reads **Under**.
  - **Expected:**
    - **Over** is red and bold.
    - **Under** is grey.
  - **Notes:**

- [ ] `88C8` Select **Dark** in the Appearance menu.
  - **Expected:** These are easy to read and to tell apart:
    - the feature names
    - the percentages
    - the **Over** and **Under** lines
  - **Notes:**

- [ ] `C3D4` Select **Light** in the Appearance menu.
  - **Expected:** These are easy to read and to tell apart:
    - the feature names
    - the percentages
    - the **Over** and **Under** lines
  - **Notes:**

### FA-21: Planned Hires Have Rows of Their Own

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-20.

**Preconditions:** **Feature assignments** open, with **Allocations** chosen in the mode switch, **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `B36D` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `4CD5` Type **Payments tester** in the search box, and note the month in the row's **Expected** column.
  - **Expected:**
    - One row is listed, named **Payments tester**.
    - **Expected** holds a month.
  - **Notes:**

- [ ] `C8D1` Select the **Feature assignments** page in the left-hand menu.
  - **Expected:** The **Feature assignments** page opens.
  - **Notes:**

- [ ] `AD30` Type **Payments tester** in the search box.
  - **Expected:**
    - One row is listed, named **Payments tester**.
    - **Allocations** is still chosen in the mode switch.
  - **Notes:**

- [ ] `1F82` Look along the row from 12 months ago to the right.
  - **Expected:**
    - The cells before the month noted in step `4CD5` are empty.
    - From that month on, cells list a feature with **100%**.
  - **Notes:**

- [ ] `CB11` Empty the search box.
  - **Expected:** Every row is listed again.
  - **Notes:**

- [ ] `D731` Select **Feature team** in the Group by menu.
  - **Expected:** **Group by: Feature team** shows.
  - **Notes:**

- [ ] `D9A6` Type **TBD** in the search box.
  - **Expected:**
    - Planned hires with no name and a temporary ID are listed by their position and ID, such as **SDET, TBD-** and a number, in grey.
    - They are under **No feature team**.
  - **Notes:**

- [ ] `0D80` Empty the search box.
  - **Expected:** Every row is listed again.
  - **Notes:**

- [ ] `DF6A` Select **Teams** in the mode switch.
  - **Expected:** The cells show feature teams as labels.
  - **Notes:**

- [ ] `EB18` Type **Payments tester** in the search box.
  - **Expected:** No rows are listed.
  - **Notes:**

### FA-22: Each Group and the Organization Total Their Capacity

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-21.

**Preconditions:** **Light** selected in the Appearance menu. **Feature assignments** open, with **Allocations** chosen in the mode switch, **Feature team** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `565B` Scroll down to the end of the **Payments core** group.
  - **Expected:**
    - The group ends with a total row.
    - Each of its month cells reads two numbers, such as **7.5 of 9**.
    - Under them is a percentage, such as **83.3%**, in bold.
  - **Notes:**

- [ ] `7D6D` Scroll the table down.
  - **Expected:**
    - A total row headed **Organization** is at the foot of the table.
    - It stays there as the rows scroll under it.
    - Nothing shows through it.
  - **Notes:**

- [ ] `1E55` Scroll the table sideways.
  - **Expected:** **Organization** stays on the left while the months scroll sideways.
  - **Notes:**

- [ ] `9B19` Select **Dark** in the Appearance menu.
  - **Expected:** The total rows are easy to read and to tell apart from the rows above them.
  - **Notes:**

- [ ] `861C` Select **Light** in the Appearance menu.
  - **Expected:** The total rows are easy to read and to tell apart from the rows above them.
  - **Notes:**

- [ ] `F4F7` Select **None** in the Group by menu.
  - **Expected:**
    - No group ends with a total row.
    - The **Organization** row is still at the foot.
  - **Notes:**

### FA-23: The Totals Count Only the Rows Shown

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-22.

**Preconditions:** **Feature assignments** open, with **Allocations** chosen in the mode switch, **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `8DC9` Select **Metrics**.
  - **Expected:** The Metrics panel gives a number of people and a number of planned hires, such as **150 people and 8 planned hires**.
  - **Notes:**

- [ ] `C877` Close the Metrics panel.
  - **Expected:** The Metrics panel closes.
  - **Notes:**

- [ ] `68AE` Type **Payments tester** in the search box.
  - **Expected:**
    - One row is listed, named **Payments tester**.
    - In the **Organization** row, the cells before the month its allocations start are empty.
    - From that month on, each reads **1 of 1** and **100%**.
  - **Notes:**

### FA-24: Someone Who Left a Team Has a Row for Each Part

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-23.

**Preconditions:** **Feature assignments** open, with **Allocations** chosen in the mode switch, **Feature team** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `77F4` Select **Teams** in the mode switch.
  - **Expected:** The cells show feature teams as labels.
  - **Notes:**

- [ ] `A582` Under the **Mobile apps** group, find the person whose **Mobile apps** labels stop before the current month, and note their name and the last month with the label.
  - **Expected:** One person under **Mobile apps** has no **Mobile apps** label in the current month.
  - **Notes:**

- [ ] `A05E` Select **Allocations** in the mode switch.
  - **Expected:** The cells list features, each with its percentage.
  - **Notes:**

- [ ] `F18D` Type the name noted in step `A582` in the search box.
  - **Expected:**
    - The person has a row under **Mobile apps** and a row under another group, or **No feature team**.
    - Each of those rows is followed by a total row.
    - The total row under **Mobile apps** has figures only in the months the person was on **Mobile apps**, up to the month noted.
    - The other total row has figures only in the months before and after those.
    - Each figure reads **0 of 1** and **0%**.
  - **Notes:**

### FA-25: Someone Has a Row Under Each Manager They Reported To

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FA-24. Step `7D63` signs in as another account, and step `981D` signs in as this one again.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. **People** open from the left-hand menu.

- [ ] `3B65` Type **Samuel Richter** in the search box.
  - **Expected:** Only Samuel Richter's row is listed.
  - **Notes:**

- [ ] `F866` Select the row's **Manager** cell.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `A924` Press Enter.
  - **Expected:** A list of people opens under the cell.
  - **Notes:**

- [ ] `7B16` Type **Max**, and choose **Max Munk**.
  - **Expected:**
    - The **Manager** cell reads **Max Munk**.
    - A hollow yellow dot is before it.
  - **Notes:**

- [ ] `CEE4` Select the row's **Manager assigned** cell.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `FC48` Type the first day of the current month as digits alone, such as `20261101` in November 2026, and press Enter.
  - **Expected:**
    - The **Manager assigned** cell reads the date typed.
    - A hollow yellow dot is before it.
  - **Notes:**

- [ ] `E0DF` Select the Publish button.
  - **Expected:**
    - A notice starts **Published**.
    - The Publish button is gone from the top bar.
  - **Notes:**

- [ ] `7D63` Sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Director**.
  - **Notes:**

- [ ] `96FB` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens.
  - **Notes:**

- [ ] `1E6F` Type **Samuel Richter** in the search box.
  - **Expected:** One entry is listed.
  - **Notes:**

- [ ] `C245` Select the entry's checkbox.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `740B` Select **Approve 1 draft**.
  - **Expected:**
    - A dialog opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] `923B` Select **Approve** in the dialog.
  - **Expected:** A notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] `981D` Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Operations Manager**.
  - **Notes:**

- [ ] `6D33` Select the **Feature assignments** page in the left-hand menu.
  - **Expected:** The **Feature assignments** page opens.
  - **Notes:**

- [ ] `6BC6` Select **Allocations** in the mode switch.
  - **Expected:** The cells list features, each with its percentage.
  - **Notes:**

- [ ] `94C4` Select **Manager** in the Group by menu.
  - **Expected:** **Group by: Manager** shows.
  - **Notes:**

- [ ] `11E3` Type **Samuel Richter** in the search box.
  - **Expected:**
    - Samuel Richter has a row under **Atmananda Ganaka** whose cells are empty from the current month on.
    - He has a row under **Max Munk** whose cells are empty before the current month.
    - Each group ends with a total row.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.
