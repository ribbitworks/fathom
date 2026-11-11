---
title: "Manual Test: Feature Teams"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/org-chart*", "apps/web/src/feature-team*", "apps/web/src/choice-picker.tsx", "apps/server/src/data/feature-teams.ts", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-11"
---

# Manual Test: Feature Teams

## Scope

Verifies feature teams on the **Org chart** page: how each team is drawn under its lead in light and dark mode, a team's panel, proposing, adding, renaming and removing teams as drafts with their marks on the chart and in the panel, what a reader who may not change teams sees, changing teams from another date, approving a team's draft on the Drafts page, using a team's panel from the keyboard, and choices shown with their descriptions when picked. The seeded feature teams are listed in [Development Setup](../design/development-setup.md#fictional-seed-data).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A mouse or trackpad, and a keyboard.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Engineering Manager:** `engineering.manager@fathom.test`, which proposes and renames feature teams
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**, which also removes feature teams
- **Engineering Director:** `engineering.director@fathom.test`, which approves feature teams
- **Resource Planner:** `resource.planner@fathom.test`, which sees feature teams but does not change them

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data) and [Publish](manual-test-basics.md#publish).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms this test uses, among them the teams switch, the Feature teams button, the team panel and the change button.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### FT-01: The Chart Draws Feature Teams Under Their Leads

**Account:** Resource Planner, `resource.planner@fathom.test`; the first test case.

**Preconditions:** **Light** chosen in the Appearance menu. Signed in with this account. Select the **Org chart** page in the left-hand menu.

- [ ] **Step 1.** Choose **Feature teams** in the teams switch.
  - **Expected:**
    - The chart is drawn again with four teams side by side.
    - **Mobile apps** is on Sharda Varrier's card.
    - **Payments core** is on Gilda Effertz's card.
    - **Search** is on Lorenza Thiel's card.
    - A card named **Platform reliability** has the position **No feature lead**.
    - The address bar ends with `view=feature-teams`.
  - **Notes:**

- [ ] **Step 2.** Look at the bands of the teams' cards.
  - **Expected:**
    - Mobile apps' cards have an orange band.
    - Payments core's cards have a teal band.
    - Search's cards have an indigo band.
    - Platform reliability's cards have none.
  - **Notes:**

- [ ] **Step 3.** Type `Lorenza` in the box reading **Find a person or team** at the top left of the chart.
  - **Expected:** Under **People**, two entries read **Lorenza Thiel**, one with **Payments core** under it and one with **Search**.
  - **Notes:**

- [ ] **Step 4.** Choose **Dark** in the Appearance menu, and look over the chart.
  - **Expected:** The bands, team names and positions are all easy to read on the dark cards.
  - **Notes:**

- [ ] **Step 5.** Choose **Light** in the Appearance menu, and look at the bottom of Lorenza Thiel's card that leads Search.
  - **Expected:** It reads **Hide 3 members**.
  - **Notes:**

- [ ] **Step 6.** Click Nicole Grüner's card, under Lorenza Thiel in Search.
  - **Expected:**
    - Nicole Grüner's details open beside the chart.
    - The **Reporting** section has one row, **Manager**.
    - Under it, a **Feature teams** section has one row, **Member of**, reading **Search**, followed by **Led by Lorenza Thiel** in grey.
  - **Notes:**

- [ ] **Step 7.** Close the details, and click the card named **Platform reliability**.
  - **Expected:**
    - The team panel opens beside the chart, titled **Platform reliability**.
    - Each row has its label in grey on the left and its value on the right, with a line under it.
    - A **Details** section has the rows **Name**, reading **Platform reliability**, and **Colour**, reading **None**.
    - A **Members** section has the rows **Feature lead**, reading **None**, and **Members**, listing **Bilwa Iyer**, **Polly Smith** and **Thad Heidenreich**.
    - No row has a change button, and there are no buttons at the panel's foot.
  - **Notes:**

- [ ] **Step 8.** Select the Feature teams button.
  - **Expected:** The list holds **Mobile apps**, **Payments core**, **Platform reliability** and **Search**, and no **New feature team**.
  - **Notes:**

- [ ] **Step 9.** Choose **Search**.
  - **Expected:**
    - The team panel is titled **Search**.
    - **Feature lead** reads **Lorenza Thiel**.
    - **Members** lists **Lorenza Thiel**, **Nicole Grüner**, **Yara Habel** and **杨治涛**.
  - **Notes:**

- [ ] **Step 10.** Close the team panel, and select **Payments core**, the team name under Gilda Effertz's position on her card.
  - **Expected:**
    - The team panel slides in, titled **Payments core**.
    - Gilda Effertz's card is fully in view, about halfway across the chart to the left of the panel.
    - **Colour** reads **Teal**, after a teal dot.
    - **Feature lead** reads **Gilda Effertz**.
  - **Notes:**

- [ ] **Step 11.** Close the team panel, and choose **Reporting teams** in the teams switch.
  - **Expected:** The chart shows managers and their reports.
  - **Notes:**

- [ ] **Step 12.** Click Lorenza Thiel's card.
  - **Expected:**
    - Lorenza Thiel's details open beside the chart.
    - The **Reporting** section's rows read **Manager**, **Reporting team**, **Reporting team name** and **Direct reports**.
    - A **Feature teams** section has two rows:
      - **Leads**, reading **Search**.
      - **Member of**, reading **Payments core**, followed by **Led by Gilda Effertz** in grey.
  - **Notes:**

- [ ] **Step 13.** Select **Search** in the **Leads** row.
  - **Expected:**
    - The chart shows feature teams.
    - The team panel, titled **Search**, is under Lorenza Thiel's details.
  - **Notes:**

### FT-02: An Engineering Manager Proposes Members and a Lead

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from FT-01.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch.

- [ ] **Step 1.** Select the Feature teams button, then **Platform reliability**.
  - **Expected:**
    - The team panel opens, titled **Platform reliability**.
    - **Name**, **Colour**, **Feature lead** and **Members** each have a change button.
    - **Colour** reads **None**.
    - **Feature lead** reads **None**.
  - **Notes:**

- [ ] **Step 2.** Select the change button in the **Feature lead** row.
  - **Expected:**
    - A list of people opens under the row, with the cursor in a box above it.
    - Each person has their position and reporting team in grey under their name.
    - Pointed at, a person is on a light grey background, and their name and the line under it are easy to read.
  - **Notes:**

- [ ] **Step 3.** Type `Polly`, and select **Polly Smith**.
  - **Expected:**
    - **Feature lead** reads **Polly Smith**, followed by a hollow yellow dot and **Draft**.
    - Under it, **None** is in grey, followed by a green dot and **Live**.
    - On the chart, the card reading **Platform reliability** and **No feature lead** is gone. Polly Smith's card is at the top of the team in its place, with **Platform reliability** under her position, and the team's members under her.
  - **Notes:**

- [ ] **Step 4.** Select the change button in the **Members** row, type `Rosendo`, press Enter to tick **Rosendo Champlin**, and press Enter again.
  - **Expected:**
    - **Members** lists **Rosendo Champlin**, with a hollow yellow dot before his name.
    - On the chart, a card for Rosendo Champlin is under Polly Smith, his name followed by a hollow yellow dot and **Draft**.
    - His card in Mobile apps is still there.
  - **Notes:**

- [ ] **Step 5.** Select the change button in the **Members** row, type `Thad`, press Enter to untick **Thad Heidenreich**, and press Enter again.
  - **Expected:**
    - **Members** lists **Bilwa Iyer**, **Polly Smith**, **Rosendo Champlin** and **Thad Heidenreich**, in that order.
    - **Rosendo Champlin** has a hollow yellow dot before his name.
    - **Thad Heidenreich** has a hollow yellow dot before his name, and is struck through.
    - On the chart, his card under Polly Smith is faded, with a green dot and **Live** after his name.
  - **Notes:**

- [ ] **Step 6.** Run [Publish](manual-test-basics.md#publish).
  - **Expected:** The Publish button is gone.
  - **Notes:**

### FT-03: A Workforce Administrator Adds, Renames and Removes

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FT-02.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch.

- [ ] **Step 1.** Select the Feature teams button, then **New feature team**.
  - **Expected:**
    - A panel titled **New feature team** opens.
    - A **Details** section has a **Name** row with an empty box.
    - A **Members** section has the rows **Feature lead** and **Members**, each with a change button.
    - **Cancel** and **Add** are at the foot.
  - **Notes:**

- [ ] **Step 2.** Type `Fictional data team` in the **Name** box.
  - **Expected:** The **Name** box holds **Fictional data team**.
  - **Notes:**

- [ ] **Step 3.** Select the change button in the **Members** row, type `Branson`, press Enter, type `Priscille`, press Enter, and press Enter again.
  - **Expected:** **Members** lists **Branson O'Keefe** and **Priscille Adam**, one to a line.
  - **Notes:**

- [ ] **Step 4.** Select the change button in the **Feature lead** row, type `Branson`, and press Enter.
  - **Expected:** **Feature lead** reads **Branson O'Keefe**.
  - **Notes:**

- [ ] **Step 5.** Select **Add**.
  - **Expected:**
    - The panel is titled **Fictional data team**, followed by a hollow yellow dot and **Draft: added**.
    - On the chart, a card for Branson O'Keefe is named **Fictional data team**, with Priscille Adam's card under it.
  - **Notes:**

- [ ] **Step 6.** Select the change button in the **Name** row, select the **×** at the right of the box, type `Fictional analytics team`, and press Enter.
  - **Expected:**
    - The panel's title reads **Fictional analytics team**.
    - The **Name** row reads **Fictional analytics team**.
    - Branson O'Keefe's card is named **Fictional analytics team**.
  - **Notes:**

- [ ] **Step 7.** Select the Feature teams button, then **Search**, then **Remove feature team** at the panel's foot.
  - **Expected:**
    - The panel's title, **Search**, is followed by a hollow yellow dot and **Draft: removed**.
    - No row has a change button.
    - The foot has **Discard draft**, and no **Remove feature team**.
  - **Notes:**

- [ ] **Step 8.** Select **Discard draft**.
  - **Expected:**
    - The panel's title, **Search**, has no draft mark.
    - The foot has **Remove feature team**, and no **Discard draft**.
  - **Notes:**

- [ ] **Step 9.** Run [Publish](manual-test-basics.md#publish).
  - **Expected:** The Publish button is gone.
  - **Notes:**

### FT-04: An Approver Approves a Team's Draft

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from FT-03.

**Preconditions:** Signed in with this account. Select the **Drafts** page in the left-hand menu.

- [ ] **Step 1.** Type `Platform reliability` in the search box.
  - **Expected:**
    - One entry is listed, **the feature team Platform reliability**.
    - Its **Feature lead** line sets it to **Polly Smith**.
    - Its **Members** line changes them from **Bilwa Iyer, Polly Smith, Thad Heidenreich** to **Bilwa Iyer, Polly Smith, Rosendo Champlin**.
    - Each line ends **by Engineering Manager**.
  - **Notes:**

- [ ] **Step 2.** Select the entry's checkbox, then **Approve**, and **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notice begins **Approved**.
  - **Notes:**

- [ ] **Step 3.** Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch.
  - **Expected:**
    - Platform reliability's first card is Polly Smith's.
    - Bilwa Iyer's and Rosendo Champlin's cards are under it, with no draft marks.
    - No card for Thad Heidenreich is in Platform reliability.
  - **Notes:**

- [ ] **Step 4.** Select the **Drafts** page in the left-hand menu, and type `Fictional analytics team` in the search box.
  - **Expected:**
    - One entry is listed, **the feature team Fictional analytics team**.
    - Its **Feature lead** line reads **Branson O'Keefe**.
    - Its **Members** line reads **Branson O'Keefe, Priscille Adam**.
  - **Notes:**

### FT-05: A Team's Panel Works From the Keyboard

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FT-04.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu, choose **Feature teams** in the teams switch, then select the Feature teams button, then **Search**.

- [ ] **Step 1.** Click the panel's title, **Search**, and press Tab until the change button in the **Members** row has a visible outline.
  - **Expected:** On the way, the outline is on the panel's **×**, then the change buttons of **Name**, **Colour** and **Feature lead**, in that order.
  - **Notes:**

- [ ] **Step 2.** Press Enter.
  - **Expected:** A list of people opens under the row, with the cursor in a box above it.
  - **Notes:**

- [ ] **Step 3.** Type `Rosendo`, press Enter, and press Enter again.
  - **Expected:**
    - The list closes.
    - **Members** lists **Rosendo Champlin**, with a hollow yellow dot before his name.
    - The outline is on the change button in the **Members** row.
  - **Notes:**

- [ ] **Step 4.** Press Tab until **Discard draft** has the outline, and press Enter.
  - **Expected:**
    - **Rosendo Champlin** is no longer listed.
    - No draft mark is in the panel.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FT-06: The Org Chart Moves Through Time

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FT-05.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch.

- [ ] **Step 1.** Look at the row between the page's heading and the chart.
  - **Expected:**
    - A **Date** box shows today's date, written as year, month and day, such as **2026-11-11**.
    - Beside it are a left arrow, a timeline marked with one month in each year, such as **Nov 2024** and **Nov 2025**, and a right arrow.
    - A **Today** button is greyed out.
  - **Notes:**

- [ ] **Step 2.** Select the left arrow once.
  - **Expected:**
    - The **Date** box shows the first day of last month.
    - Below the row, text reads **Showing** with that date, then **Changes take effect from this date.**
    - The chart redraws without the page going blank.
    - The **Draft** button is still above the chart.
  - **Notes:**

- [ ] **Step 3.** Select the Feature teams button, then any team.
  - **Expected:**
    - **Feature lead** and **Members** have change buttons.
    - **Name** and **Colour** have none.
    - There is no **Remove feature team** button.
  - **Notes:**

- [ ] **Step 4.** Drag the timeline's handle well to the left, and let go.
  - **Expected:**
    - While dragging, a label shows the month under the handle.
    - The handle stays where it was let go.
    - The chart redraws once, showing only the teams with members or a draft that month, which may be none.
    - The **Date** box shows the first day of that month.
  - **Notes:**

- [ ] **Step 5.** Clear the **Date** box, and type a date in the middle of a month, as digits alone, such as `20250315`.
  - **Expected:**
    - Below the row, text reads **Showing Mar 15, 2025. Changes take effect from this date.**
    - The timeline's handle is at March 2025.
  - **Notes:**

- [ ] **Step 6.** Choose **Reporting teams** in the teams switch.
  - **Expected:**
    - The **Date** box still shows the date typed.
    - The chart shows managers and their reports.
    - The text below the row still ends **Changes take effect from this date.**
  - **Notes:**

- [ ] **Step 7.** Select **Today**.
  - **Expected:**
    - The text below the row is gone.
    - **Today** is greyed out.
    - The **Date** box shows today's date.
  - **Notes:**

- [ ] **Step 8.** Choose **Dark** in the Appearance menu, then **Light**.
  - **Expected:**
    - In both, the date row is easy to read.
    - The timeline's month labels overlap neither each other nor the chart.
  - **Notes:**

### FT-07: Readers Without Personal Details Are Told Why There Is No Other Date

**Account:** Resource Planner, `resource.planner@fathom.test`, changed from FT-06.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu; it shows reporting teams.

- [ ] **Step 1.** Look at the area between the page's heading and the chart.
  - **Expected:**
    - A line in grey reads **Other dates need Personal access.**
    - There is no date control.
  - **Notes:**

- [ ] **Step 2.** Select **Feature teams** in the teams switch.
  - **Expected:** The same line is there, still with no date control.
  - **Notes:**

### FT-08: Changes Take Effect From the Date Shown

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FT-07.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch; it shows today.

- [ ] **Step 1.** Select the right arrow once.
  - **Expected:**
    - The **Date** box shows the first day of next month.
    - The text below the row ends **Changes take effect from this date.**
  - **Notes:**

- [ ] **Step 2.** Select the Feature teams button, then **Platform reliability**.
  - **Expected:** The team panel is titled **Platform reliability**.
  - **Notes:**

- [ ] **Step 3.** Select the change button in the **Members** row, press the Down arrow key until a person without a tick is highlighted, press Enter, and press Enter again. Note the person's name: the joiner.
  - **Expected:**
    - The joiner is in the list of members, with a hollow yellow dot before their name and no date after it.
    - A card for the joiner is under the team on the chart.
  - **Notes:**

- [ ] **Step 4.** Select **Today**.
  - **Expected:** The joiner is still in the team panel's list of members, with a hollow yellow dot before their name, followed in grey by **Draft, from** and the first day of next month, such as **Draft, from Dec 1, 2026**.
  - **Notes:**

- [ ] **Step 5.** Select the **Drafts** page in the left-hand menu, and type `Platform reliability` in the search box.
  - **Expected:** The entry's **Joining and leaving dates** line gives the joiner and the first day of next month.
  - **Notes:**

- [ ] **Step 6.** Select the **Org chart** page in the left-hand menu, choose **Feature teams** in the teams switch, then select the Feature teams button, then **Platform reliability**, then **Discard draft** at the panel's foot.
  - **Expected:**
    - No draft mark is in the panel.
    - The joiner is not in the list of members.
  - **Notes:**

### FT-09: An Earlier Date Is Read Only Without the Right to Change Dates

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from FT-08.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch; it shows today.

- [ ] **Step 1.** Select the left arrow once.
  - **Expected:**
    - The text below the row ends **Nothing can be changed on this date.**
    - There is no **Draft** button above the chart.
  - **Notes:**

- [ ] **Step 2.** Select the Feature teams button, then any team.
  - **Expected:** No row in the team panel has a change button.
  - **Notes:**

- [ ] **Step 3.** Select the right arrow twice.
  - **Expected:**
    - The text below the row ends **Changes take effect from this date.**
    - The **Draft** button is above the chart.
    - In the team panel, **Feature lead** and **Members** have change buttons, and **Name** and **Colour** have none.
  - **Notes:**

- [ ] **Step 4.** Select **Today**, then choose **Reporting teams** in the teams switch.
  - **Expected:**
    - The right arrow is greyed out.
    - A line in grey under the row reads **Future dates need Confidential access.**
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FT-10: Choices Show Their Descriptions

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FT-09.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. Select the **Org chart** page in the left-hand menu, choose **Feature teams** in the teams switch, then select the Feature teams button, then **Search**.

- [ ] **Step 1.** Select the change button in the **Members** row, and type `engineer`.
  - **Expected:** Every person listed has **Engineer** or **engineer** in the grey line under their name.
  - **Notes:**

- [ ] **Step 2.** Press Esc.
  - **Expected:** The list closes, and **Members** is as it was.
  - **Notes:**

- [ ] **Step 3.** Select the **People** page in the left-hand menu, scroll right to the **Site** column, select any person's **Site** cell, and press Enter.
  - **Expected:**
    - A list of sites opens under the cell.
    - **Northmere Labs** has **The research site.** in grey under it.
    - No other site has a grey line under it.
  - **Notes:**

- [ ] **Step 4.** Type `research`.
  - **Expected:** **Northmere Labs** is the only site listed.
  - **Notes:**

- [ ] **Step 5.** Press Esc.
  - **Expected:** The list closes, and the cell is as it was.
  - **Notes:**

### FT-11: A Team's Lead Is Taken Away

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FT-10.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu, choose **Feature teams** in the teams switch, then select the Feature teams button, then **Search**.

- [ ] **Step 1.** Select the change button in the **Feature lead** row.
  - **Expected:**
    - The list's first option is **None**, with a line under it.
    - No option is highlighted until the Down arrow key is pressed or an option is pointed at; then the first person after the line is on a light grey background.
  - **Notes:**

- [ ] **Step 2.** Select **None**.
  - **Expected:**
    - **Feature lead** reads **None**, followed by a hollow yellow dot and **Draft**.
    - Under it, **Lorenza Thiel** is in grey, followed by a green dot and **Live**.
  - **Notes:**

- [ ] **Step 3.** Select **Discard draft** at the panel's foot.
  - **Expected:** **Feature lead** reads **Lorenza Thiel**, with no draft mark.
  - **Notes:**

- [ ] **Step 4.** Choose **Dark** in the Appearance menu. Select the change button in the **Feature lead** row, and point at the first person after the line.
  - **Expected:**
    - The panel's labels, values and change buttons are easy to read.
    - **None** and the line under it are easy to see.
    - The person pointed at is on a dark grey background, and their name and the line under it are easy to read.
  - **Notes:**

- [ ] **Step 5.** Press Esc, and choose **Light** in the Appearance menu.
  - **Expected:** The list closes, and the panel returns to its light colours.
  - **Notes:**
