---
title: "Manual Test: Capacity's Feature Teams"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/capacity-feature-teams*", "apps/web/src/team-months*", "apps/web/src/team-labels*", "apps/server/src/data/feature-team-held-changes.ts", "apps/server/src/data/feature-team-month-cells.ts", "apps/server/src/data/feature-team-undo.ts", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/capacity.md"]
last_updated: "2026-11-27"
---

# Manual Test: Capacity's Feature Teams

## Scope

Verifies the **Feature teams** tab of the **Capacity** page:

- How the table of feature teams by month looks, and moving through it with the strip of quarters under the buttons above it.
- Grouping its rows, counting them in **Metrics**, and keeping it to the people on a feature team in any month.
- Planned hires on a feature team, under it on this tab and on **Allocations**, and changing a planned hire's months from the month it's expected.
- How it agrees with the **Org chart** on a chosen month.
- How drafts made on the **Org chart** show in it.
- Changing a month's teams in it and finding the change on the **Org chart**.
- Moving around it from the keyboard.

The seeded feature teams are listed in [Development Setup](../design/development-setup.md#fictional-data).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Engineering Manager:** `engineering.manager@fathom.test`
- **Executive:** `executive@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as a page's tabs, the Group by menu, the Draft menu and the team list.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### FA-01: The Page Opens at the Current Month

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account.

- [ ] `25EE` Select the **Capacity** page in the left-hand menu, then the **Feature teams** tab.
  - **Expected:**
    - The page is headed **Capacity**, with **Feature teams** chosen in its tabs.
    - Above the table, in order: a search box, **Feature teams**, the Draft menu's button reading **Drafts & Live**, **Metrics**, **Group by** and **Views**.
    - The rows show as one list, with no group names.
    - Under the buttons, the strip of quarters, with **‹** before it, and **›** and **Today** after it.
    - The table has a **Person** column on the left and a column for each month, with a line between each column.
  - **Notes:**

- [ ] `428B` Look at the month headings without scrolling.
  - **Expected:**
    - The current month is the second month beside the **Person** column, after last month.
    - Its heading is underlined in red.
  - **Notes:**

- [ ] `B7C1` Look at the strip of quarters.
  - **Expected:**
    - Its first quarter is the one holding the month a year before the current one, and its last the one holding the month eleven months after it, each named with its year, such as "Q4 2025".
    - The quarter holding the current month is underlined in red.
    - The quarters whose months are on screen in the table are shaded light blue.
  - **Notes:**

### FA-02: Names and Months Stay in View

Covered by [FA-13](#fa-13-the-table-works-from-the-keyboard).

### FA-03: Each Team Is Named After Its Colour

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-01.

**Preconditions:** **Capacity** open, with the **Feature teams** tab chosen, with the current month in view.

- [ ] `E780` Look at the teams in the current month's column.
  - **Expected:**
    - Each team's name follows a small square in its colour, such as 'Mobile apps' orange and 'Payments core' teal.
    - No name is in a coloured box.
    - 'Platform reliability', which has no colour, has no square.
  - **Notes:**

### FA-04: The Table Reads Well in Light and Dark Mode

Covered by the [Dark Mode](dark-mode-manual-test.md) manual test.

### FA-05: Rows Group by Manager, Feature Team or Not at All

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-03.

**Preconditions:** **Capacity** open, with the **Feature teams** tab chosen, and the Group by menu's button reading **Group by**, with no grouping.

- [ ] `077D` Select **Manager** in the Group by menu.
  - **Expected:**
    - The button reads **Group by: Manager**.
    - The rows are grouped under managers.
  - **Notes:**

- [ ] `6A68` Select **Feature team** in the Group by menu.
  - **Expected:**
    - The rows are grouped under the feature teams in order of name, then **No feature team**.
    - Someone on two teams is listed under both.
  - **Notes:**

- [ ] `D26B` Select **Clear grouping** in the Group by menu.
  - **Expected:**
    - The button reads **Group by**, naming no grouping.
    - There are no group names.
    - Everyone is listed once, by name.
  - **Notes:**

### FA-06: Search Finds Teams in Any Month

Proved by the shared grid's automated tests, in `apps/web/src/people-page-search.test.tsx` and `apps/web/src/capacity-feature-teams.test.tsx`.

### FA-07: A Month Can Be Filtered by Team

Proved by the shared grid's automated tests, in `apps/web/src/people-page-search.test.tsx`.

### FA-08: People Can Be Filtered by Name

Proved by the shared grid's automated tests of column filters, in `apps/web/src/people-page-filters.test.tsx`.

### FA-09: Metrics Count People

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-05.

**Preconditions:** **Capacity** open, with the **Feature teams** tab chosen, no grouping, nothing in the search box and no filters.

- [ ] `61E9` Select **Metrics**.
  - **Expected:**
    - The Metrics panel opens.
    - It offers the months to break down by.
    - It gives the number of people and the number of planned hires, such as "141 people and 10 planned hires".
  - **Notes:**

**Afterwards:** Select **Metrics** again to close the panel.

### FA-10: The Table Agrees With the Org Chart

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-09.

**Preconditions:** **Capacity** open, with the **Feature teams** tab chosen, **Feature team** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `BA7E` Under the **Search** group, note the people with 'Search' in the column for the month before the current one.
  - **Expected:** The people are listed under the **Search** group.
  - **Notes:**

- [ ] `0B62` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The **Org chart** page opens.
  - **Notes:**

- [ ] `BED2` Choose **Feature teams** in the teams switch.
  - **Expected:** The chart shows feature teams.
  - **Notes:**

- [ ] `6D7D` Select the left arrow beside the timeline once.
  - **Expected:**
    - A card names 'Search and discovery', with a yellow dot before it.
    - The lead and the members stacked under that card are the people noted in step `BA7E`.
  - **Notes:**

### FA-11: Months Outside Someone's Employment Are Shaded

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-10.

**Preconditions:** **Capacity** open, with the **Feature teams** tab chosen, no grouping, nothing in the search box and no filters.

- [ ] `7B9F` Scroll sideways and down through the table.
  - **Expected:**
    - Some people have shaded cells at the start or end of their row, for the months before they started or after they left.
    - Shaded cells name no team.
  - **Notes:**

### FA-12: A Role Without Personal Details Has No Feature Teams

Covered by [CAP-14](capacity-manual-test.md#cap-14-a-role-that-sees-no-tab-has-no-capacity-page).

### FA-13: The Table Works From the Keyboard

**Account:** Executive, `executive@fathom.test`, changed from FA-11.

**Preconditions:** Signed in with this account. Select the **Capacity** page in the left-hand menu, then the **Feature teams** tab.

- [ ] `39EC` Select a cell in the current month's column that names a team.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `0A8A` Press the Right arrow key until the table scrolls sideways.
  - **Expected:**
    - The outline moves one cell right at each press, and the table scrolls to keep it in view.
    - The **Person** column stays on the left, with nothing showing through it.
  - **Notes:**

- [ ] `4E12` Press the Down arrow key until the table scrolls down.
  - **Expected:**
    - The outline moves one cell down at each press, and the table scrolls to keep it in view.
    - The month headings stay at the top, with nothing showing through them.
  - **Notes:**

- [ ] `648D` Press Enter.
  - **Expected:** No box for editing opens in the cell.
  - **Notes:**

### FA-14: A Draft Shows From the Month It Takes Effect

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FA-13.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch; it shows today.

- [ ] `8E7F` Select the left arrow, left of the timeline above the chart, once.
  - **Expected:** The **Date** box shows the first day of last month.
  - **Notes:**

- [ ] `6B75` Select the Feature teams button, then 'Payments core'.
  - **Expected:**
    - The team panel opens, titled 'Payments core'.
    - 'Christiano Schweisfurth' is in the **Members** row.
  - **Notes:**

- [ ] `F4A2` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `5DFE` Type `Christiano`, and press Enter.
  - **Expected:** 'Christiano Schweisfurth' has no tick.
  - **Notes:**

- [ ] `F1A6` Press Enter.
  - **Expected:**
    - 'Christiano Schweisfurth' is still in the list of members.
    - A hollow yellow dot is before his name.
    - His name is struck through.
  - **Notes:**

- [ ] `A33A` Select the **Capacity** page in the left-hand menu, then the **Feature teams** tab.
  - **Expected:** **Feature teams** is chosen in the **Capacity** page's tabs.
  - **Notes:**

- [ ] `CC85` Search for `Christiano`.
  - **Expected:**
    - The row of 'Christiano Schweisfurth' is tinted faint yellow.
    - A light green Live row is under it.
    - In the tinted row, the cell two months ago names 'Payments core' with no dot.
    - From last month on, the cells name 'Payments core' after a hollow yellow dot.
    - Those names are struck through.
    - In the light green row, from last month on, each 'Payments core' has a green dot before its square.
  - **Notes:**

### FA-15: The Draft Menu Shows Drafts or Leaves Them Out

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FA-14.

**Preconditions:** After FA-14: **Capacity** open, with the **Feature teams** tab chosen, no grouping and `Christiano` in the search box.

- [ ] `278A` Open the Draft menu and select **Live only**.
  - **Expected:**
    - The row of 'Christiano Schweisfurth' has no tint.
    - No light green row is under it.
    - From last month on, each 'Payments core' has a green dot before its square.
    - Their teams before last month have no dot.
    - Nothing is struck through.
  - **Notes:**

- [ ] `B7E1` Hold the pointer over the green dot before one of those 'Payments core' names.
  - **Expected:** After a moment, a tooltip reads "Live. A change isn't published yet."
  - **Notes:**

- [ ] `AD18` Open the Draft menu and select **Drafts applied**.
  - **Expected:**
    - From last month on, the cells don't name 'Payments core'.
    - There is no light green row.
  - **Notes:**

- [ ] `18D3` Open the Draft menu and select **Drafts & Live**.
  - **Expected:**
    - The row is tinted faint yellow again.
    - A light green Live row is under it.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FA-16: A Month's Teams Change From That Month On

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from FA-15.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. Select the **Capacity** page in the left-hand menu, then the **Feature teams** tab, with no grouping and no filters.

- [ ] `EBE4` Search for `Delbert`.
  - **Expected:** Only the row of 'Delbert Heidenreich' is listed, naming no team in any month.
  - **Notes:**

- [ ] `45D0` Select the cell of 'Delbert Heidenreich' two months after the current month.
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
    - The row is tinted faint yellow.
    - A light green Live row is under it.
    - The cells before the one selected name no team.
    - From the cell selected on, each cell names 'Payments core' after a hollow yellow dot.
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
    - 'Delbert Heidenreich' is in the **Members** row.
    - A hollow yellow dot is before his name.
    - After his name, in grey, "from" and the first day of the month two months after the current one, such as "from Jan 1, 2027".
  - **Notes:**

### FA-17: The Current Month Changes From Today

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-16.

**Preconditions:** Select the **Capacity** page in the left-hand menu, then the **Feature teams** tab, with no grouping, nothing in the search box and no filters.

- [ ] `5AF9` Select a cell in the current month's column that names one team, 'Payments core', in a row with no tint.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `8E9A` Press Delete.
  - **Expected:**
    - The row is tinted faint yellow.
    - In the cell and every cell to its right, 'Payments core' has a hollow yellow dot before its square.
    - Those names are struck through.
  - **Notes:**

- [ ] `2F9C` Press Cmd+Z, or Ctrl+Z outside a Mac.
  - **Expected:**
    - The row has no tint.
    - In the cell and every cell to its right, 'Payments core' has no dot.
    - Those names are not struck through.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FA-18: A Change the Draft Can't Hold Is Explained

Proved by automated tests in `apps/server/src/feature-teams-months.test.ts`.

### FA-19: The Strip of Quarters Moves the Table

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-17.

**Preconditions:** **Capacity** open, with the **Feature teams** tab chosen.

- [ ] `0F6B` Select the strip's first quarter.
  - **Expected:**
    - The quarter's first month is the first month beside the **Person** column.
    - The quarter is filled in blue.
  - **Notes:**

- [ ] `91D4` Select **Today**.
  - **Expected:** The current month is the second month beside the **Person** column, after last month.
  - **Notes:**

- [ ] `D461` Press Shift+Tab until a quarter in the strip has a blue outline.
  - **Expected:** The outline is on the quarter holding the current month.
  - **Notes:**

- [ ] `2B5C` Press the Right arrow key.
  - **Expected:** The outline moves to the next quarter, and the table doesn't move.
  - **Notes:**

- [ ] `7E31` Press Enter.
  - **Expected:** That quarter's first month is the second month beside the **Person** column, after the month before it.
  - **Notes:**

### FA-20: The Table Kept to a Feature Team in Any Month

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-19.

**Preconditions:** **Capacity** open, with the **Feature teams** tab chosen, no grouping, nothing in the search box and no filters.

- [ ] `65F5` Select **Feature teams**, the button after the search box.
  - **Expected:** A list opens under the button: every feature team, each with a tick box, then **No feature team** and **Not empty**.
  - **Notes:**

- [ ] `FFCD` Tick **Mobile apps**.
  - **Expected:**
    - The table lists only rows with **Mobile apps** in some month, whichever months are in view.
    - A pill after the buttons reads "Feature team: Mobile apps".
    - The rows' cells still show their other teams too.
  - **Notes:**

- [ ] `700D` Press Esc.
  - **Expected:** The list closes, and the **Feature teams** button has a dot after its name.
  - **Notes:**

- [ ] `17F0` Select the **×** on the "Feature team: Mobile apps" pill.
  - **Expected:** The table lists every row again, and the button's dot is gone.
  - **Notes:**

### FA-21: A Planned Hire's Row Names Its Feature Team

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-20.

**Preconditions:** **Capacity** open, with the **Feature teams** tab chosen, **Feature team** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `F4AE` Type `Data engineer` in the search box.
  - **Expected:**
    - One row shows, 'Data engineer', under the **Field tools** group.
    - From last month on, each of its cells names 'Field tools', after a small square in the team's colour.
    - Its cells before last month are shaded and empty.
  - **Notes:**

- [ ] `0BDD` Clear the search box, and type `Engineering Manager, TBD`.
  - **Expected:**
    - One row shows, "Engineering Manager, TBD-" and a number, in grey italics, under the **Field tools** group.
    - Its cells name 'Field tools' from the month three months after the current one on, and are empty before it.
  - **Notes:**

- [ ] `BD20` Select the **Allocations** tab, with **Feature team** still chosen in the Group by menu and the search box as it is.
  - **Expected:**
    - "Engineering Manager, TBD-" and its number show under the **Field tools** group, with cells from the month three months after the current one on.
    - It also shows under **No feature team**, where its cells from the current month until the month three months after it read "Not allocated" in red.
  - **Notes:**

**Afterwards:** Clear the search box, and select the **Feature teams** tab.

### FA-22: A Planned Hire's Months Are Changed From the Month It's Expected

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as FA-21.

**Preconditions:** Run Restore the Seed Data. **Capacity** open, with the **Feature teams** tab chosen, nothing chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `B7C1` Type `Platform engineer` in the search box.
  - **Expected:**
    - One row shows, 'Platform engineer'.
    - Its cells before the month six months after the current one are shaded.
  - **Notes:**

- [ ] `62E9` Select its cell in the month before the first one not shaded, and press Enter.
  - **Expected:**
    - No list of teams opens, and the cell keeps its blue outline.
    - A tip reads "Can't join before" and the month of the first cell not shaded.
  - **Notes:**

- [ ] `A0D8` Select its cell in the first month not shaded, press Enter, type `Pay`, then press Tab.
  - **Expected:**
    - That cell and each later one name 'Payments core', after a hollow dot.
    - The shaded cells stay empty.
    - The **Publish** button reads "Publish 1 change".
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes, and clear the search box.
