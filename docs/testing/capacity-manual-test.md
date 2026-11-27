---
title: "Manual Test: Capacity"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/capacity.md"]
last_updated: "2026-11-26"
---

# Manual Test: Capacity

## Scope

Verifies the Capacity page's tabs, switching between them, and its link to the planning settings, which have their own [Planning Settings](planning-settings-manual-test.md) test:

- Allocations, the table of allocations by month:
  - Its over- and under-allocated months, planned hires, and the capacity totals of each group and of everyone.
  - Rows for someone who changed team or manager.
  - Grouping by what each is allocated to: each feature's and activity's heading with its hours, its Allocated row, and no load marks on its rows.
  - The page left out of the menu for a role that sees no tab.
  - The count of people and planned hires, the same on Feature teams and Allocations, in the month the grid was moved to.
  - The rows kept to those over or under from the Views menu, and the rows kept to what someone is allocated to in any month.
- Feature teams, which has its own [Capacity's Feature Teams](capacity-feature-teams-manual-test.md) test.

The seeded allocations are listed in [Development Setup](../design/development-setup.md#fictional-data).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**.
- **Engineering Manager:** `engineering.manager@fathom.test`.
- **Engineering Director:** `engineering.director@fathom.test`.
- **Team Member:** `team.member@fathom.test`.

## Common Procedures

[Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data), [Reset the Database](manual-test-basics.md#reset-the-database) and [Publish](manual-test-basics.md#publish), from Manual Test Basics.

## Terms

As [Manual Test Basics](manual-test-basics.md#terms) sets out, such as a page's tabs, and:

- **Total row:** in **Allocations**, a row in bold at the end of each group, headed **Total, person-months** in the **Person** column, and one at the foot of the table, headed **Organization, person-months**.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### CAP-01: The Settings Read Only

Moved to [Planning Settings](planning-settings-manual-test.md#pset-01-the-settings-read-only).

### CAP-02: A Change Drafted, Undone and Published

Moved to [Planning Settings](planning-settings-manual-test.md#pset-02-a-change-drafted-undone-and-published).

### CAP-03: A Value Refused

Moved to [Planning Settings](planning-settings-manual-test.md#pset-03-a-value-refused).

### CAP-04: Months of Ramp-Up Added and Removed

Moved to [Planning Settings](planning-settings-manual-test.md#pset-07-months-of-ramp-up-added-and-removed).

### CAP-05: The Change in the Change History

Moved to [Planning Settings](planning-settings-manual-test.md#pset-08-the-change-in-the-change-history).

### CAP-06: Each Tab for a Role That Sees Them All

**Account:** Engineering Manager, `engineering.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account.

- [ ] `D8F5` Select the **Capacity** page in the left-hand menu, then the **Allocations** tab.
  - **Expected:**
    - Just after the heading, on the same line, the tabs read **Feature teams** and **Allocations**.
    - **Allocations** is chosen in the tabs.
    - At the right of the heading, on the same line, is a **Planning settings** link, with no outline.
    - Above the table, in order: a search box, a **Draft** button, **Metrics**, and **Group by**.
    - Under them, the strip of quarters, with **‹** before it, and **›** and **Today** after it.
    - The current month is the second month beside the **Person** column, after last month, and its heading is underlined in red.
  - **Notes:**

- [ ] `F7F1` Select **Planning settings** at the right of the heading.
  - **Expected:**
    - The page is headed **Planning settings**.
    - The planning settings show under **Working time**, **Forecasts** and **Ramp-up for new starters**.
    - No row has a change button.
  - **Notes:**

- [ ] `6E10` Press the browser's Back button.
  - **Expected:** The page is headed **Capacity**, with **Allocations** chosen in the tabs.
  - **Notes:**

### CAP-07: Allocations Shows Each Feature With Its Percentage

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as CAP-06.

**Preconditions:** **Capacity** open, with the **Allocations** tab chosen, **Feature team** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `8FAB` Scroll down to the 'Payments core' group.
  - **Expected:** Under the 'Payments core' group, cells list features and any activities, each on a line of its own with its percentage at the right, such as "50%".
  - **Notes:**

- [ ] `ABC9` Hold the pointer over a feature's name in a cell.
  - **Expected:** After a moment, a tooltip shows the feature's whole name.
  - **Notes:**

- [ ] `61EC` Under the 'Payments core' group, find the first cell in the current month's column that lists two features and no "Over" or "Under".
  - **Expected:**
    - Each feature's name follows a small square in its feature team's colour.
    - The two percentages add up to 100%.
    - No line follows the two features.
  - **Notes:**

### CAP-08: Over- and Under-Allocated Months Stand Out

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as CAP-07.

**Preconditions:** **Capacity** open, with the **Allocations** tab chosen, **None** chosen in the Group by menu, nothing in the search box, no filters, and neither **Over** nor **Under** ticked in the **Views** menu.

- [ ] `CBFE` In the current month's column, find a cell whose last line reads "Over", such as that of 'Silje Holm-Schrøder', and one whose last line reads "Under", such as that of 'Lorenza Thiel'.
  - **Expected:**
    - "Over" is red and bold, with how far over a whole month at the right, such as "+25%".
    - "Under" is red and bold, with how far under a whole month at the right, such as "−50%".
  - **Notes:**

- [ ] `5A0E` Hold the pointer over "Over".
  - **Expected:** After a moment, a tooltip shows "Total" and the month's percentages added up, such as "Total 150%".
  - **Notes:**

### CAP-09: Planned Hires Have Rows of Their Own

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as CAP-08.

**Preconditions:** **Capacity** open, with the **Allocations** tab chosen, **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `B36D` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `4CD5` Type `Payments tester` in the search box, and note the month in the **Expected** column of the row.
  - **Expected:**
    - One row is listed, named 'Payments tester'.
    - **Expected** holds a month.
  - **Notes:**

- [ ] `7C51` Select the **Capacity** page in the left-hand menu, then the **Allocations** tab.
  - **Expected:**
    - **Allocations** is chosen in the tabs.
    - **Group by** shows, naming no grouping.
  - **Notes:**

- [ ] `B241` Select **Feature team** in the Group by menu.
  - **Expected:** **Group by: Feature team** shows.
  - **Notes:**

- [ ] `AD30` Type `Payments tester` in the search box.
  - **Expected:** One row is listed, named 'Payments tester'.
  - **Notes:**

- [ ] `1F82` Look along the row from its first month to the right.
  - **Expected:**
    - The cells before the month noted in step `4CD5` are empty.
    - For six months from that month, cells list a feature with "100%".
    - The cells after those six months list no feature.
  - **Notes:**

- [ ] `CB11` Empty the search box.
  - **Expected:** Every row is listed again.
  - **Notes:**

- [ ] `D9A6` Type `TBD` in the search box.
  - **Expected:**
    - Planned hires with no name and a temporary ID are listed by their position and ID, such as "SDET, TBD-" and a number, in grey.
    - They are under **No feature team**.
  - **Notes:**

- [ ] `0D80` Empty the search box.
  - **Expected:** Every row is listed again.
  - **Notes:**

- [ ] `1623` Select the **Feature teams** tab.
  - **Expected:** The cells show feature teams, each name after a small square in its team's colour.
  - **Notes:**

- [ ] `EB18` Type `Payments tester` in the search box.
  - **Expected:**
    - One row is listed, named 'Payments tester'.
    - Its cells name no feature team.
    - The cells before the month noted in step `4CD5` are shaded.
  - **Notes:**

**Afterwards:** Empty the search box.

### CAP-10: Each Group and Everyone Total Their Capacity

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as CAP-09.

**Preconditions:** **Capacity** open, with the **Allocations** tab chosen, **Feature team** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `565B` Scroll down to the end of the 'Payments core' group.
  - **Expected:**
    - The group ends with a total row.
    - Each of its month cells reads two numbers, such as "4.25 of 5".
    - Under them is a percentage, such as "85%", in bold.
  - **Notes:**

- [ ] `7D6D` Scroll the table down.
  - **Expected:**
    - A total row headed **Organization, person-months** is at the foot of the table.
    - It stays there as the rows scroll under it.
    - Nothing shows through it.
  - **Notes:**

- [ ] `1E55` Scroll the table sideways.
  - **Expected:** **Organization, person-months** stays on the left while the months scroll sideways.
  - **Notes:**

- [ ] `F4F7` Select **None** in the Group by menu.
  - **Expected:**
    - No group ends with a total row.
    - The **Organization, person-months** row is still at the foot.
  - **Notes:**

### CAP-11: The Totals Count Only the Rows Shown

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as CAP-10.

**Preconditions:** **Capacity** open, with the **Allocations** tab chosen, **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `8DC9` Select **Metrics**.
  - **Expected:** The Metrics panel gives a number of people and a number of planned hires, such as "141 people and 10 planned hires".
  - **Notes:**

- [ ] `C877` Close the Metrics panel.
  - **Expected:** The Metrics panel closes.
  - **Notes:**

- [ ] `68AE` Type `Payments tester` in the search box.
  - **Expected:**
    - One row is listed, named 'Payments tester'.
    - In the **Organization, person-months** row, the cells before the month its allocations start are empty.
    - For six months from that month, each reads "1 of 1" and "100%".
    - After those six months, each reads "0 of 1" and "0%".
  - **Notes:**

- [ ] `9D78` Hold the pointer over the cell of the **Organization, person-months** row in the month the allocations of 'Payments tester' start.
  - **Expected:** After a moment, a tooltip reads "1 of 1 person-month allocated: 100%".
  - **Notes:**

**Afterwards:** Empty the search box.

### CAP-12: Someone Who Left a Team Has a Row for Each Part

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as CAP-11.

**Preconditions:** Signed in with this account.

- [ ] `C806` Select the **Capacity** page in the left-hand menu, then the **Feature teams** tab.
  - **Expected:**
    - The cells show feature teams, each name after a small square in its team's colour.
    - **Group by** shows, naming no grouping.
  - **Notes:**

- [ ] `0FFA` Select **Feature team** in the Group by menu.
  - **Expected:** **Group by: Feature team** shows.
  - **Notes:**

- [ ] `A582` Under the 'Mobile apps' group, find the person whose 'Mobile apps' labels stop before the current month, and note their name and the last month with the label.
  - **Expected:** One person under 'Mobile apps' has no 'Mobile apps' label in the current month.
  - **Notes:**

- [ ] `5122` Select the **Capacity** page in the left-hand menu, then the **Allocations** tab.
  - **Expected:**
    - **Allocations** is chosen in the tabs.
    - **Group by** shows, naming no grouping.
    - The cells list features, each with its percentage.
  - **Notes:**

- [ ] `243D` Select **Feature team** in the Group by menu.
  - **Expected:** **Group by: Feature team** shows.
  - **Notes:**

- [ ] `F18D` Type the name noted in step `A582` in the search box.
  - **Expected:**
    - The person has a row under 'Mobile apps' and a row under another group, or **No feature team**.
    - Each of those rows is followed by a total row.
    - The total row under 'Mobile apps' has figures only in the months the person was on 'Mobile apps', up to the month noted.
    - The other total row has figures only in the months before and after those.
    - In the months before the person's allocation starts, each figure reads "0 of 1" and "0%".
    - From that month on, each figure reads "1 of 1" and "100%".
  - **Notes:**

### CAP-13: Someone Has a Row Under Each Manager They Reported To

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from CAP-12. Step `7D63` signs in as another account, and step `981D` signs in as this one again.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. **People** open from the left-hand menu.

- [ ] `3B65` Type `Bilwa Iyer` in the search box.
  - **Expected:** Only the row of 'Bilwa Iyer' is listed.
  - **Notes:**

- [ ] `F866` Select the **Manager** cell of the row.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `A924` Press Enter.
  - **Expected:** A list of people opens under the cell.
  - **Notes:**

- [ ] `7B16` Type `Max`, and choose 'Max Munk'.
  - **Expected:**
    - The **Manager** cell reads 'Max Munk'.
    - A hollow yellow dot is before it.
  - **Notes:**

- [ ] `CEE4` Select the **Manager assigned** cell of the row.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `FC48` Type the first day of the current month as digits alone, such as `20261101` in November 2026, and press Enter.
  - **Expected:**
    - The **Manager assigned** cell reads the date typed.
    - A hollow yellow dot is before it.
  - **Notes:**

- [ ] `E0DF` Select the Publish button.
  - **Expected:**
    - A notification starts "Published".
    - The Publish button is gone from the top bar.
  - **Notes:**

- [ ] `7D63` Sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The right end of the top bar reads "Engineering Director".
  - **Notes:**

- [ ] `96FB` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `1E6F` Type `Bilwa Iyer` in the search box.
  - **Expected:** One row is listed, whose **Record** reads 'Bilwa Iyer'.
  - **Notes:**

- [ ] `C245` Tick that row's tick box.
  - **Expected:**
    - The tick box is ticked.
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `740B` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:**
    - A dialog opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] `923B` Select **Approve** in the dialog.
  - **Expected:** A notification reads "Approved 1 draft."
  - **Notes:**

- [ ] `981D` Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`.
  - **Expected:** The right end of the top bar reads "Engineering Operations Manager".
  - **Notes:**

- [ ] `1862` Select the **Capacity** page in the left-hand menu, then the **Allocations** tab.
  - **Expected:**
    - **Allocations** is chosen in the tabs.
    - **Group by** shows, naming no grouping.
  - **Notes:**

- [ ] `4CC8` Select **Manager** in the Group by menu.
  - **Expected:** **Group by: Manager** shows.
  - **Notes:**

- [ ] `11E3` Type `Bilwa Iyer` in the search box.
  - **Expected:**
    - 'Bilwa Iyer' has a row under 'Atmananda Ganaka' whose cell for last month lists 'Parts Lookup' with "100%", and whose cells are empty from the current month on.
    - 'Bilwa Iyer' has a row under 'Max Munk' whose cells are empty before the current month, and list 'Parts Lookup' with "100%" from the current month on.
    - Each group ends with a total row.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### CAP-14: A Role That Sees No Tab Has No Capacity Page

**Account:** Team Member, `team.member@fathom.test`, changed from CAP-13.

**Preconditions:** Signed in with this account.

- [ ] `3C47` Look at the **People** section of the left-hand menu.
  - **Expected:**
    - It shows **People** and **Org chart**.
    - There is no **Capacity**.
  - **Notes:**

### CAP-15: A Draft Approved, Then Followed on Features

Moved to [Planning Settings](planning-settings-manual-test.md#pset-09-a-draft-approved-then-followed-on-features).

### CAP-16: Both Grids Count the Same People, in the Month Gone To

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from CAP-14.

**Preconditions:** Signed in with this account. Select the **Capacity** page in the left-hand menu, then the **Feature teams** tab, with **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `C4E1` Look at the count after **Group by**, and note it.
  - **Expected:** It names the current month first, then counts people and planned hires, such as "Nov 2026: 40 people, 3 planned hires".
  - **Notes:**

- [ ] `0B7D` Select the **Allocations** tab.
  - **Expected:** The count after **Group by** is the one noted in step `C4E1`.
  - **Notes:**

- [ ] `9F25` Select the first quarter in the strip of quarters.
  - **Expected:**
    - The table scrolls to the start of that quarter.
    - The count starts with the quarter's first month, such as "Oct 2025:".
    - It counts no planned hires.
  - **Notes:**

- [ ] `6E3A` Select **Today**.
  - **Expected:** The count is the one noted in step `C4E1`.
  - **Notes:**

### CAP-17: Allocations Kept to Those Over or Under

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as CAP-16.

**Preconditions:** **Capacity** open, with the **Allocations** tab chosen, **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `B4E7` Open the **Views** menu.
  - **Expected:**
    - At its top, **Over** and **Under** are each followed by a number in brackets, such as "Over (4)".
    - Neither is ticked.
  - **Notes:**

- [ ] `D19A` Select **Over**.
  - **Expected:**
    - **Over** is ticked.
    - The table lists only rows with a cell reading "Over" in the current month or a later one, such as 'Blaise Gislason'.
  - **Notes:**

- [ ] `5C0F` Select **Under**.
  - **Expected:**
    - **Over** and **Under** are both ticked.
    - The table also lists rows with a cell reading "Under" or "Not allocated" from the current month on.
  - **Notes:**

- [ ] `E83B` Select **Over**.
  - **Expected:**
    - Only **Under** is ticked.
    - The table lists only rows with a cell reading "Under" or "Not allocated" from the current month on.
  - **Notes:**

- [ ] `7A62` Select **Under**.
  - **Expected:** Neither is ticked, and every row is listed again.
  - **Notes:**

### CAP-18: Allocations Kept to What Someone Is Allocated To in Any Month

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as CAP-17.

**Preconditions:** **Capacity** open, with the **Allocations** tab chosen, **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `CDAC` Select **Allocations**, the button after the search box.
  - **Expected:** A list opens under the button: a box to narrow it, then everything someone is allocated to, each with a tick box, then **Not allocated** and **Not empty**.
  - **Notes:**

- [ ] `9315` Tick the first item in the list, and note its name.
  - **Expected:**
    - The table lists only rows allocated to it in some month, whichever months are in view.
    - A pill after the buttons reads "Allocated to:" and its name.
    - A row's cells show everything it's allocated to, not only the one ticked.
  - **Notes:**

- [ ] `F73E` Untick the item noted in step `9315`.
  - **Expected:** The table lists every row again, and the pill is gone.
  - **Notes:**

- [ ] `3CE0` Tick **Not allocated**.
  - **Expected:** The table lists only rows allocated to nothing in any month, each reading "Not allocated" from the current month on, apart from shaded months.
  - **Notes:**

- [ ] `5293` Press Esc.
  - **Expected:** The list closes.
  - **Notes:**

- [ ] `AED6` Select the **×** on the "Allocated to: Not allocated" pill.
  - **Expected:** The table lists every row again.
  - **Notes:**

### CAP-19: Allocations Grouped by What Each Is Allocated To

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as CAP-18.

**Preconditions:** **Capacity** open, with the **Allocations** tab chosen, **None** chosen in the Group by menu, nothing in the search box and no filters.

- [ ] `144C` Select **Group by**, and choose **Allocated to**.
  - **Expected:**
    - Each feature or activity someone is allocated to is a heading, after its feature team's colour square, with its count of people.
    - An activity's heading names its project or release in brackets, such as "General (Crane Control)".
    - After the count, a heading of a feature with an estimate reads "· Effort" and its estimate in hours, "· Allocated" and its hours, and "· Remaining" and its hours, or "None" for a done or cancelled feature.
    - A heading of a feature with no estimate reads "· Allocated" and its hours alone.
    - The last heading is **Not allocated**.
  - **Notes:**

- [ ] `8E98` Find a heading whose Remaining has a minus sign.
  - **Expected:**
    - Its Remaining reads in red, such as "−6 h".
    - Every other figure in the heading is grey.
  - **Notes:**

- [ ] `1172` Look at the rows under a heading.
  - **Expected:**
    - Each row's months show that heading's feature alone, with its percentage.
    - No month reads "Over", "Under" or "Not allocated".
    - The group ends with a row named **Allocated**, reading the feature's hours each month, such as "48 h".
  - **Notes:**

- [ ] `48C3` Scroll the table sideways, keeping a long heading in view.
  - **Expected:** The heading reads whole; the frozen **Person** column's edge doesn't cross it.
  - **Notes:**

- [ ] `DBC0` Choose **None** in the Group by menu.
  - **Expected:**
    - The table is one list again, each row showing all of a person's features.
    - The total rows read "Total, person-months" and "Organization, person-months" again.
  - **Notes:**
