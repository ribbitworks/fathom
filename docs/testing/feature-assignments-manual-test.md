---
title: "Manual Test: Feature Assignments"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/feature-assignments-page*", "apps/web/src/team-months*", "apps/web/src/team-labels*", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-15"
---

# Manual Test: Feature Assignments

## Scope

Verifies the **Feature assignments** page: how the table of feature teams by month looks and scrolls, grouping its rows, searching and filtering it, how it agrees with the **Org chart** on a chosen month, how drafts made on the **Org chart** show in it, changing a month's teams in it and finding the change on the **Org chart**, the page left out of the menu for a role without Personal details, and moving around it from the keyboard. The seeded feature teams are listed in [Development Setup](../design/development-setup.md#fictional-data).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Engineering Manager:** `engineering.manager@fathom.test`
- **Engineering Director:** `engineering.director@fathom.test`
- **Executive:** `executive@fathom.test`
- **Team Member:** `team.member@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the Group by menu and the Publish button.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### FA-01: The Page Opens at the Current Month

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account.

- [ ] `25EE` Select the **Feature assignments** page in the left-hand menu.
  - **Expected:**
    - The page is headed **Feature assignments**.
    - Above the table, in order: a search box, a **Draft** button, **Metrics**, and **Group by: Manager**.
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
  - **Expected:**
    - Each label names a feature team, in the team's colour, such as 'Mobile apps' orange and 'Payments core' teal.
    - Labels of 'Platform reliability', which has no colour, are neutral.
  - **Notes:**

- [ ] `18C9` Hold the pointer over a label.
  - **Expected:** After a moment, a tooltip shows the team's whole name.
  - **Notes:**

### FA-04: The Table Reads Well in Light and Dark Mode

Covered by the [Dark Mode](dark-mode-manual-test.md) manual test.

### FA-05: Rows Group by Manager, Feature Team or Not at All

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-03.

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

- [ ] `A46D` Select **Group by: Feature team**.
  - **Expected:**
    - The menu has no **Then by** label.
    - It ends with **Clear grouping**, set apart from the choices.
  - **Notes:**

- [ ] `D26B` Select **Clear grouping**.
  - **Expected:**
    - **Group by: Manager** shows.
    - The rows are grouped under managers.
  - **Notes:**

- [ ] `441A` Select **None** in the Group by menu.
  - **Expected:**
    - There are no group names.
    - Everyone is listed once, by name.
  - **Notes:**

### FA-06: Search Finds Teams in Any Month

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-05.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `40E2` Type `Search` in the search box.
  - **Expected:**
    - Only people with a 'Search' label in some month are listed.
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

- [ ] `D6AF` Select 'Payments core'.
  - **Expected:** Only people on 'Payments core' that month are listed.
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

- [ ] `BA7E` Under the **Search** group, note the people with a 'Search' label in the column for the month before the current one.
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
    - A card names 'Search and discovery'.
    - A yellow dot is before it.
    - The lead and the members stacked under that card are the same people as noted in step `BA7E`.
  - **Notes:**

### FA-11: Months Outside Someone's Employment Are Shaded

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-10.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `7B9F` Scroll sideways and down through the table.
  - **Expected:**
    - Some people have shaded cells at the start or end of their row, for the months before they started or after they left, such as 'Melinda Zemlak' and '선예빈'.
    - Shaded cells hold no labels.
  - **Notes:**

### FA-12: A Role Without Personal Details Has No Feature Assignments Page

**Account:** Team Member, `team.member@fathom.test`, changed from FA-11.

**Preconditions:** Signed in with this account.

- [ ] `8352` Look at the **People** section of the left-hand menu.
  - **Expected:**
    - It shows **People** and **Org chart**.
    - There is no **Feature assignments**.
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

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch; it shows today.

- [ ] `8E7F` Select the left arrow, left of the timeline above the chart, once.
  - **Expected:**
    - The **Date** box shows the first day of last month.
    - The text below the timeline ends "Changes take effect from this date."
  - **Notes:**

- [ ] `6B75` Select the Feature teams button, then 'Payments core'. Note the first name in the **Members** row that is not the one in **Feature lead**: the leaver.
  - **Expected:**
    - The team panel opens, titled 'Payments core'.
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
    - The cell two months ago holds no 'Payments core' label.
    - The labels in the cell two months ago have no dot.
    - From last month on, each cell holds a 'Payments core' label, beside any other labels.
    - Each of those 'Payments core' labels has a hollow yellow dot inside it, before the name.
  - **Notes:**

- [ ] `868D` Look along the light green row under it.
  - **Expected:**
    - Its cells hold no 'Payments core' label.
    - Any other labels are in their colours.
  - **Notes:**

- [ ] `2B72` Empty the search box.
  - **Expected:** Every person is listed.
  - **Notes:**

- [ ] `CC85` Type the leaver's name in the search box.
  - **Expected:**
    - From last month on, the cells of the leaver hold a 'Payments core' label with a hollow yellow dot inside it.
    - The name in the label is struck through.
    - In the light green row under it, from last month on, each 'Payments core' label has a green dot inside it, before the name.
  - **Notes:**

### FA-15: The Draft Menu Shows Drafts or Leaves Them Out

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-14.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu and the leaver's name from FA-14 in the search box, after FA-14.

- [ ] `278A` Open the Draft menu and select **Live only**.
  - **Expected:**
    - The row of the leaver has no tint.
    - No light green row is under the row of the leaver.
    - The cells of the leaver hold a 'Payments core' label in every month they held one before FA-14, from the earliest such month on.
    - From last month on, each 'Payments core' label has a green dot inside it, before the name.
    - Their labels before last month have no dot.
    - Nothing is struck through.
  - **Notes:**

- [ ] `B7E1` Hold the pointer over the green dot in one of those 'Payments core' labels.
  - **Expected:** After a moment, a tooltip reads "Live. A change isn't published yet."
  - **Notes:**

- [ ] `AD18` Open the Draft menu and select **Drafts applied**.
  - **Expected:**
    - From last month on, the leaver's cells hold no 'Payments core' label.
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

- [ ] `18D3` Open the Draft menu and select **Drafts & Live**.
  - **Expected:**
    - The joiner and the leaver are both listed under **Payments core**.
    - The joiner's 'Payments core' labels from last month on have a hollow yellow dot inside them.
    - The leaver's 'Payments core' labels from last month on have a hollow yellow dot inside them.
    - The leaver's name is struck through.
    - Each of their rows has a light green Live row under it.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FA-16: A Month's Teams Change From That Month On

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from FA-15.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. Select the **Feature assignments** page in the left-hand menu, with nothing in the search box and no filters.

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
    - From the cell selected on, each cell holds a 'Payments core' label with a hollow yellow dot inside it, before the name.
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
    - From the cell selected on, each cell holds a 'Payments core' label with a hollow yellow dot inside it.
  - **Notes:**

- [ ] `D42A` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The **Org chart** page opens.
  - **Notes:**

- [ ] `530C` Choose **Feature teams** in the teams switch.
  - **Expected:** The chart shows feature teams.
  - **Notes:**

- [ ] `9ACF` Select the Feature teams button, then 'Payments core'.
  - **Expected:**
    - The team panel opens, titled 'Payments core'.
    - The person is in the **Members** row.
    - A hollow yellow dot is before the person's name.
    - After the name, in grey, "from" and the first day of the month two months after the current one, such as "from Jan 1, 2027".
  - **Notes:**

### FA-17: The Current Month Changes From Today

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-16.

**Preconditions:** **Feature assignments** open, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `5AF9` Select a cell in the current month's column that holds one label, 'Payments core', in a row with no tint.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `8E9A` Press Delete.
  - **Expected:**
    - The row is tinted faint yellow.
    - In the cell and every cell to its right, the 'Payments core' label has a hollow yellow dot inside it.
    - The label's name is struck through.
  - **Notes:**

- [ ] `2F9C` Press Cmd+Z, or Ctrl+Z outside a Mac.
  - **Expected:**
    - The row has no tint.
    - In the cell and every cell to its right, the 'Payments core' label has no dot.
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
    - 'Payments core' is shown as chosen.
  - **Notes:**

- [ ] `562D` Type `Pay`, and press Enter.
  - **Expected:** 'Payments core' is no longer shown as chosen.
  - **Notes:**

- [ ] `822C` Select the person's name with the mouse.
  - **Expected:**
    - Fathom refuses the change, saying that the draft of 'Payments core' already changes the person from another month, and to approve or discard that draft first.
    - The cell still holds the 'Payments core' label.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.
