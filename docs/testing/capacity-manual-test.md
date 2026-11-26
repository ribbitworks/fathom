---
title: "Manual Test: Capacity"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/capacity.md"]
last_updated: "2026-11-25"
---

# Manual Test: Capacity

## Scope

Verifies the Capacity page's tabs, and switching between them:

- Settings, which holds the planning settings:
  - How it reads for someone who may only see it.
  - Drafting a change and undoing it, and a value refused.
  - Adding and removing months of ramp-up.
  - The change in the change history.
  - Approving a draft and seeing the Effort column on Features follow it once approved.
- Allocations, the table of allocations by month:
  - Its over- and under-allocated months, planned hires, and the capacity totals of each group and of everyone.
  - Rows for someone who changed team or manager.
  - The page left out of the menu for a role that sees no tab.
  - The count of people and planned hires, the same on Feature teams and Allocations, in the month the grid was moved to.
  - The rows kept to those over or under from the Views menu, and the rows kept to what someone is allocated to in any month.
- Feature teams, which has its own [Capacity's Feature Teams](capacity-feature-teams-manual-test.md) test.

The seeded allocations are listed in [Development Setup](../design/development-setup.md#fictional-data).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Executive:** `executive@fathom.test`.
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**.
- **Engineering Manager:** `engineering.manager@fathom.test`.
- **Engineering Director:** `engineering.director@fathom.test`.
- **Team Member:** `team.member@fathom.test`.

## Common Procedures

[Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data), [Reset the Database](manual-test-basics.md#reset-the-database) and [Publish](manual-test-basics.md#publish), from Manual Test Basics. The planning settings are not part of the seed data, so Restore the Seed Data leaves them as they are.

## Terms

As [Manual Test Basics](manual-test-basics.md#terms) sets out, such as a page's tabs, and:

- **Change button:** as [Manual Test Basics](manual-test-basics.md#terms) sets out, here at the right of a setting's row.
- **× button:** the small × after the change button of a month of ramp-up, which removes that month.
- **Draft button:** the button above **Working time** on **Settings**, which opens a menu choosing how drafts show.
- **Row menu:** the ⋯ button at the right of a setting's row that a draft changes, which opens a menu of the whole draft of the settings and what can be done with it.
- **Total row:** in **Allocations**, a row in bold at the end of each group, headed **Total, person-months** in the **Person** column, and one at the foot of the table, headed **Organization, person-months**.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### CAP-01: The Settings Read Only

**Account:** Executive, `executive@fathom.test`; the first test case.

**Preconditions:** Signed in with this account.

- [ ] `E86E` Select the **Capacity** page in the left-hand menu.
  - **Expected:**
    - The page is headed **Capacity**.
    - Just after the heading, on the same line, the tabs read **Feature teams**, **Allocations** and **Settings**, with **Feature teams** chosen.
    - A table of people by month is under the heading.
  - **Notes:**

- [ ] `662D` Select the **Settings** tab.
  - **Expected:**
    - There is no table.
    - Under **Working time**, the rows read, from the top:
      - **Hours a day**: "8"
      - **Working days a week**: "5"
      - **Working days a month**: "20"
    - Under **Forecasts**, the rows read:
      - **Default focus**: "80%"
      - **Default buffer**: "0%"
    - Under **Ramp-up for new starters**, the rows read:
      - **Month 1**: "50%"
      - **Month 2**: "75%"
      - **From month 3**: "100%"
    - No row has a change button.
    - Above **Working time** is a **Draft** button.
    - There are no buttons under the rows.
  - **Notes:**

### CAP-02: A Change Drafted, Undone and Published

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from CAP-01.

**Preconditions:** Signed in with this account.

- [ ] `DCBC` Select the **Capacity** page in the left-hand menu.
  - **Expected:** The page is headed **Capacity**, with the tabs **Feature teams**, **Allocations** and **Settings**.
  - **Notes:**

- [ ] `F224` Select the **Settings** tab.
  - **Expected:**
    - Every row but **From month 3** has a change button at its right.
    - The rows **Month 1** and **Month 2** each have an × button after their change button.
    - Under the ramp-up rows is one outlined button, **Add month**.
  - **Notes:**

- [ ] `93FD` Press Tab until the change button of **Hours a day** has focus.
  - **Expected:** A focus ring shows around the change button of **Hours a day**.
  - **Notes:**

- [ ] `E7A7` Press Enter.
  - **Expected:**
    - A field in place of "8" holds "8".
    - The focus is in the field.
  - **Notes:**

- [ ] `08BD` Replace the value with `4`, and press Enter.
  - **Expected:**
    - **Hours a day** reads "4" after a hollow yellow dot.
    - Under it, "8" follows a green dot.
    - The change button of **Hours a day** has focus.
    - No notification shows.
    - The Publish button reads **Publish 1 change**.
  - **Notes:**

- [ ] `B912` Press Cmd+Z on a Mac, or Ctrl+Z elsewhere.
  - **Expected:**
    - **Hours a day** reads "8", with no mark and nothing under it.
    - The change button of **Hours a day** has focus.
  - **Notes:**

- [ ] `91E5` Press Enter.
  - **Expected:**
    - A field in place of "8" holds "8".
    - The focus is in the field.
  - **Notes:**

- [ ] `318F` Replace the value with `4`, and press Enter.
  - **Expected:** **Hours a day** reads "4" after a hollow yellow dot.
  - **Notes:**

- [ ] `E18C` Run Publish.
  - **Expected:** The mark before "4" beside **Hours a day** is filled yellow.
  - **Notes:**

### CAP-03: A Value Refused

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as CAP-02.

**Preconditions:** **Capacity** page open, with the **Settings** tab chosen.

- [ ] `B6C0` Select "80%" beside **Default focus**.
  - **Expected:**
    - A field in place of "80%" holds "80".
    - The focus is in the field.
  - **Notes:**

- [ ] `18AC` Replace the value with `0`, and press Enter.
  - **Expected:**
    - The field stays open.
    - It holds `0`.
    - It is outlined in red.
    - Under it, in red, reads "Default focus: use 1% to 100%".
  - **Notes:**

- [ ] `A0AE` Press Esc.
  - **Expected:**
    - **Default focus** reads "80%".
    - The red message is gone.
  - **Notes:**

### CAP-04: Months of Ramp-Up Added and Removed

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as CAP-03.

**Preconditions:** **Capacity** page open, with the **Settings** tab chosen.

- [ ] `5B9D` Select **Add month**.
  - **Expected:**
    - Under **Ramp-up for new starters**, the rows read, from the top:
      - **Month 1**: "50%"
      - **Month 2**: "75%"
      - **Month 3**: "100%" after a hollow yellow dot, with "No month 3" under it after a green dot
      - **From month 4**: "100%"
    - The change button of **Month 3** has focus.
    - **Month 3** has an × button after its change button.
  - **Notes:**

- [ ] `80C1` Press Enter.
  - **Expected:**
    - A field in place of "100%" beside **Month 3** holds "100".
    - The focus is in the field.
  - **Notes:**

- [ ] `3F77` Replace the value with `90`, and press Enter.
  - **Expected:** **Month 3** reads "90%" after a hollow yellow dot.
  - **Notes:**

- [ ] `2E12` Select the × button of **Month 3**.
  - **Expected:**
    - Under **Ramp-up for new starters**, the rows read, from the top:
      - **Month 1**: "50%"
      - **Month 2**: "75%"
      - **From month 3**: "100%"
    - The × button of **Month 2** has focus.
    - A notification at the top right reads "Removed month 3 of ramp-up."
    - It offers **Undo**.
  - **Notes:**

- [ ] `A79C` Select **Undo** in the notification.
  - **Expected:**
    - Under **Ramp-up for new starters**, the rows read, from the top:
      - **Month 1**: "50%"
      - **Month 2**: "75%"
      - **Month 3**: "90%" after a hollow yellow dot
      - **From month 4**: "100%"
  - **Notes:**

### CAP-05: The Change in the Change History

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as CAP-04.

**Preconditions:** None beyond CAP-04.

- [ ] `D295` Select the **Change history** page in the left-hand menu.
  - **Expected:**
    - The newest entry reads "Engineering Operations Manager drafted changes to the planning settings".
    - Its details read "Ramp-up from 50%, 75% to 50%, 75%, 90%".
  - **Notes:**

**Afterwards:** Run Reset the Database, to leave the planning settings as Fathom starts them.

### CAP-06: Each Tab for a Role That Sees Them All

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from CAP-05.

**Preconditions:** Reset the Database has been run, as CAP-05 ends. Signed in with this account.

- [ ] `D8F5` Select the **Capacity** page in the left-hand menu, then the **Allocations** tab.
  - **Expected:**
    - **Allocations** is chosen in the tabs.
    - Above the table, in order: a search box, a **Draft** button, **Metrics**, and **Group by**.
    - Under them, the strip of quarters, with **‹** before it, and **›** and **Today** after it.
    - The current month is the second month beside the **Person** column, after last month, and its heading is underlined in red.
  - **Notes:**

- [ ] `F7F1` Select the **Settings** tab.
  - **Expected:**
    - The planning settings show under **Working time**, **Forecasts** and **Ramp-up for new starters**.
    - No row has a change button.
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

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from CAP-14. Step `2C26` signs in as another account.

**Preconditions:** Signed in with this account. Reset the Database has been run, as CAP-05 ends. **Features** page open.

- [ ] `02DD` Open the column menu of **Effort**, and select **Person-days (8 hours)** under **Show in**.
  - **Expected:** 'Audit Export' reads "39.5 PD".
  - **Notes:**

- [ ] `E60D` Select the **Capacity** page in the left-hand menu.
  - **Expected:** The page is headed **Capacity**, with the tabs **Feature teams**, **Allocations** and **Settings**.
  - **Notes:**

- [ ] `887A` Select the **Settings** tab.
  - **Expected:** **Hours a day** reads "8".
  - **Notes:**

- [ ] `5DF7` Select "8" beside **Hours a day**.
  - **Expected:**
    - A field in place of "8" holds "8".
    - The focus is in the field.
  - **Notes:**

- [ ] `DA6A` Replace the value with `4`, and press Enter.
  - **Expected:** **Hours a day** reads "4" after a hollow yellow dot.
  - **Notes:**

- [ ] `6AB7` Run Publish.
  - **Expected:** The mark before "4" beside **Hours a day** is filled yellow.
  - **Notes:**

- [ ] `6D1E` Select the **Features** page in the left-hand menu, then open the column menu of **Effort**.
  - **Expected:**
    - Under **Show in**, **Person-days (8 hours)** is ticked.
    - **Person-weeks (8h / PD, 5 days / PW)** is under it.
    - 'Audit Export' still reads "39.5 PD".
  - **Notes:**

- [ ] `2C26` Sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The right end of the top bar reads "Engineering Director".
  - **Notes:**

- [ ] `C7B3` Select the **Capacity** page in the left-hand menu.
  - **Expected:** The page is headed **Capacity**, with the tabs **Feature teams**, **Allocations** and **Settings**.
  - **Notes:**

- [ ] `B2C3` Select the **Settings** tab.
  - **Expected:**
    - **Hours a day** reads "4" after a yellow dot.
    - Under it, "8" follows a green dot.
  - **Notes:**

- [ ] `7CF7` Select the row menu of **Hours a day**.
  - **Expected:**
    - A menu headed **Planning settings** opens.
    - Under the heading, a yellow dot and "Draft: changed".
    - Under that, "Hours a day from 8 to 4, by Engineering Operations Manager".
    - Then **Approve…**, **Reject…** and **Discard draft**.
    - No other row has a row menu.
  - **Notes:**

- [ ] `8FB0` Select **Approve…**.
  - **Expected:**
    - A dialog headed "Approve 1 draft?" opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] `77B6` Select **Approve**.
  - **Expected:**
    - The dialog closes.
    - A notification says "Approved 1 draft."
    - **Hours a day** reads "4", with no mark and nothing under it.
  - **Notes:**

- [ ] `3F90` Select the **Features** page in the left-hand menu, then open the column menu of **Effort**.
  - **Expected:**
    - Under **Show in**, **Person-days (4 hours)** is ticked.
    - 'Audit Export' reads "79 PD".
  - **Notes:**

**Afterwards:** Run Reset the Database, to leave the planning settings as Fathom starts them.

### CAP-16: Both Grids Count the Same People, in the Month Gone To

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from CAP-15.

**Preconditions:** Reset the Database has been run, as CAP-15 ends. Signed in with this account. Select the **Capacity** page in the left-hand menu, then the **Feature teams** tab, with **None** chosen in the Group by menu, nothing in the search box and no filters.

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
