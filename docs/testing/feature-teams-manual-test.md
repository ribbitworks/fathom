---
title: "Manual Test: Feature Teams"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/org-chart*", "apps/web/src/people-grid.tsx", "apps/web/src/feature-team*", "apps/web/src/choice-picker.tsx", "apps/server/src/data/feature-teams.ts", "apps/server/src/data/feature-team-rules.ts", "apps/server/src/data/feature-team-held-changes.ts", "apps/server/src/data/feature-team-sight.ts", "apps/server/src/data/feature-team-reads.ts", "apps/server/src/data/feature-team-records.ts", "apps/server/src/data/feature-team-decisions.ts", "apps/server/src/data/feature-team-undo.ts", "apps/server/src/data/feature-team-removals.ts", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/org-chart.md"]
last_updated: "2026-11-23"
---

# Manual Test: Feature Teams

## Scope

Verifies feature teams on the **Org chart** page: how each team is drawn under its lead, a team's panel, proposing, adding, renaming and removing teams as drafts with their marks on the chart and in the panel, what a reader who may not change teams sees, changing teams from another date, approving a team's draft on the Drafts page, using a team's panel from the keyboard, choices shown with their descriptions when picked, and each person's feature teams on the **People** page, grouped by team. The seeded feature teams are listed in [Development Setup](../design/development-setup.md#fictional-data).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Engineering Manager:** `engineering.manager@fathom.test`, which proposes and renames feature teams
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager", which also removes feature teams
- **Engineering Director:** `engineering.director@fathom.test`, which approves feature teams
- **Product Manager:** `product.manager@fathom.test`, which sees feature teams but does not change them
- **Second Workforce Administrator:** `engineering.operations.manager.2@fathom.test`, shown in Fathom as "Second Engineering Operations Manager"

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data), [Publish](manual-test-basics.md#publish) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms this test uses, among them the teams switch, the Feature teams button, the team panel, the change button, marks and the lock.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### FT-01: The Chart Draws Feature Teams Under Their Leads

**Account:** Product Manager, `product.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu.

- [ ] `0FC9` Choose **Feature teams** in the teams switch.
  - **Expected:**
    - The chart is drawn again with the feature teams side by side.
    - 'Mobile apps' is on the card of 'Sharda Varrier'.
    - 'Payments core' is on the card of 'Gilda Effertz'.
    - 'Search and discovery' is on the card of 'Lorenza Thiel'.
    - A yellow dot is before 'Search and discovery' on that card.
    - A card named 'Platform reliability' has the position "No feature lead".
    - A grey lock is before 'Platform reliability' on that card.
  - **Notes:**

- [ ] `5B0D` Look at the bands of the teams' cards.
  - **Expected:**
    - The cards of 'Mobile apps' have an orange band.
    - The cards of 'Payments core' have a teal band.
    - The cards of 'Search and discovery' have an indigo band.
    - The cards of 'Platform reliability' have none.
  - **Notes:**

- [ ] `474A` Type `Lorenza` in the box reading **Find a person or team** at the top left of the chart.
  - **Expected:** Under **People**, two entries read 'Lorenza Thiel':
    - one with 'Payments core' under it
    - one with 'Search and discovery' under it
  - **Notes:**

- [ ] `49C6` Look at the bottom of the card of 'Lorenza Thiel' that leads 'Search and discovery'.
  - **Expected:** It reads "Hide 3 members".
  - **Notes:**

- [ ] `E670` Click the card of 'Nicole Grüner', under 'Lorenza Thiel' in 'Search and discovery'.
  - **Expected:**
    - The details of 'Nicole Grüner' open beside the chart.
    - The **Reporting** section has one row, **Manager**.
    - Under it, a **Feature teams** section has one row, **Member of**.
    - **Member of** reads 'Search and discovery', followed by "Led by Lorenza Thiel" in grey.
  - **Notes:**

- [ ] `DB45` Close the details.
  - **Expected:** The details of 'Nicole Grüner' close.
  - **Notes:**

- [ ] `71A1` Click the card named 'Platform reliability'.
  - **Expected:**
    - The team panel opens beside the chart, titled 'Platform reliability'.
    - A grey lock is before the title.
    - Each row has its label in grey on the left and its value on the right, with a line under it.
    - A **Details** section has two rows:
      - **Name**, reading 'Platform reliability'.
      - **Colour**, reading "None".
    - A **Members** section has two rows:
      - **Feature lead**, reading "None".
      - **Members**, listing 'Bilwa Iyer', 'Fulcran Deschamps', 'Gloria Armas Guardado', 'Polly Smith', 'Thad Heidenreich' and 'Valéry Caron'.
    - No row has a change button.
    - There are no buttons at the panel's foot.
  - **Notes:**

- [ ] `FF44` Select the Feature teams button.
  - **Expected:**
    - The list holds the feature teams [Development Setup](../design/development-setup.md#fictional-data) lists, with 'Search and discovery' in place of 'Search'.
    - The list has no **New feature team**.
  - **Notes:**

- [ ] `8BA2` Choose 'Search and discovery'.
  - **Expected:**
    - The team panel is titled 'Search and discovery'.
    - **Name** has a yellow dot before 'Search and discovery'.
    - Under it, a green dot before 'Search'.
    - **Feature lead** reads 'Lorenza Thiel'.
    - **Members** lists 'Lorenza Thiel', 'Nicole Grüner', 'Yara Habel' and '杨治涛'.
  - **Notes:**

- [ ] `C3B1` Close the team panel.
  - **Expected:** The team panel closes.
  - **Notes:**

- [ ] `84ED` Select 'Payments core', the team name under the position of 'Gilda Effertz' on her card.
  - **Expected:**
    - The team panel slides in, titled 'Payments core'.
    - The card of 'Gilda Effertz' is fully in view, about halfway across the chart to the left of the panel.
    - **Colour** reads "Teal", after a teal dot.
    - **Feature lead** reads 'Gilda Effertz'.
  - **Notes:**

- [ ] `5ED3` Close the team panel.
  - **Expected:** The team panel closes.
  - **Notes:**

- [ ] `B796` Choose **Reporting teams** in the teams switch.
  - **Expected:** The chart shows managers and their reports.
  - **Notes:**

- [ ] `D867` Click the card of 'Lorenza Thiel'.
  - **Expected:**
    - The details of 'Lorenza Thiel' open beside the chart.
    - The **Reporting** section's rows read **Manager**, **Reporting team**, **Reporting team name** and **Direct reports**.
    - A **Feature teams** section has two rows:
      - **Leads**, reading 'Search and discovery'.
      - **Member of**, reading 'Payments core', followed by "Led by Gilda Effertz" in grey.
  - **Notes:**

- [ ] `D54D` Select 'Search and discovery' in the **Leads** row.
  - **Expected:**
    - The chart shows feature teams.
    - The team panel, titled 'Search and discovery', is under the details of 'Lorenza Thiel'.
  - **Notes:**

### FT-02: An Engineering Manager Proposes Members and a Lead

**Account:** Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`, changed from FT-01. Step `9F02` signs in as another account.

**Preconditions:** Signed in with this account.

- [ ] `80FB` Run Discard the Unpublished Changes.
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

- [ ] `9F02` Sign in as the Engineering Manager, `engineering.manager@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Manager".
  - **Notes:**

- [ ] `9CA3` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens.
  - **Notes:**

- [ ] `B377` Choose **Feature teams** in the teams switch.
  - **Expected:** The card named 'Platform reliability' has no grey lock.
  - **Notes:**

- [ ] `180D` Select the Feature teams button, then 'Platform reliability'.
  - **Expected:**
    - The team panel opens, titled 'Platform reliability'.
    - **Name**, **Colour**, **Feature lead** and **Members** each have a change button.
    - **Colour** reads "None".
    - **Feature lead** reads "None".
  - **Notes:**

- [ ] `5A69` Select the change button in the **Feature lead** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
    - Each person has their position and reporting team in grey under their name.
    - Pointed at, a person is on a light grey background.
    - Pointed at, their name and the line under it are easy to read.
  - **Notes:**

- [ ] `B682` Type `Polly`, and select 'Polly Smith'.
  - **Expected:**
    - **Feature lead** reads 'Polly Smith'.
    - A hollow yellow dot is before it.
    - Under it, "None" shows.
    - A green dot is before "None".
    - On the chart, the card reading 'Platform reliability' and "No feature lead" is gone.
    - The card of 'Polly Smith' is at the top of the team in its place.
    - 'Platform reliability' is under her position.
    - The team's members are under her card.
  - **Notes:**

- [ ] `CBFA` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `ACA3` Type `Rosendo`, and press Enter.
  - **Expected:** 'Rosendo Champlin' has a tick.
  - **Notes:**

- [ ] `DC41` Press Enter.
  - **Expected:**
    - **Members** lists 'Rosendo Champlin'.
    - A hollow yellow dot is before his name.
    - On the chart, a card for 'Rosendo Champlin' is under 'Polly Smith'.
    - That card has a hollow yellow dot before his name.
    - His card in 'Mobile apps' is still there.
  - **Notes:**

- [ ] `A506` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `4FE3` Type `Thad`, and press Enter.
  - **Expected:** 'Thad Heidenreich' has no tick.
  - **Notes:**

- [ ] `21BE` Press Enter.
  - **Expected:**
    - **Members** lists 'Bilwa Iyer', 'Fulcran Deschamps', 'Gloria Armas Guardado', 'Polly Smith', 'Rosendo Champlin', 'Thad Heidenreich' and 'Valéry Caron', in that order.
    - 'Rosendo Champlin' has a hollow yellow dot before his name.
    - 'Thad Heidenreich' has a hollow yellow dot before his name.
    - 'Thad Heidenreich' is struck through.
    - On the chart, his card under 'Polly Smith' has a hollow yellow dot before his name.
    - His name on that card is struck through.
  - **Notes:**

- [ ] `5C99` Run [Publish](manual-test-basics.md#publish).
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

### FT-03: A Workforce Administrator Adds, Renames and Removes

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FT-02.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch.

- [ ] `544D` Select the Feature teams button, then **New feature team**.
  - **Expected:**
    - A panel titled **New feature team** opens.
    - A **Details** section has a **Name** row with an empty box.
    - A **Members** section has the rows **Feature lead** and **Members**.
    - **Feature lead** and **Members** each have a change button.
    - **Cancel** and **Add** are at the foot.
  - **Notes:**

- [ ] `63E3` Type `Fictional data team` in the **Name** box.
  - **Expected:** The **Name** box holds `Fictional data team`.
  - **Notes:**

- [ ] `D0FD` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `0E24` Type `Branson`, and press Enter.
  - **Expected:** 'Branson O'Keefe' has a tick.
  - **Notes:**

- [ ] `116B` Type `Priscille`, and press Enter.
  - **Expected:** 'Priscille Adam' has a tick.
  - **Notes:**

- [ ] `E361` Press Enter.
  - **Expected:** **Members** lists 'Branson O'Keefe' and 'Priscille Adam', one to a line.
  - **Notes:**

- [ ] `D763` Select the change button in the **Feature lead** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `9D7E` Type `Branson`, and press Enter.
  - **Expected:** **Feature lead** reads 'Branson O'Keefe'.
  - **Notes:**

- [ ] `492D` Select **Add**.
  - **Expected:**
    - The panel's title is a hollow yellow dot, then `Fictional data team`.
    - On the chart, a card for 'Branson O'Keefe' is named `Fictional data team`.
    - The card of 'Priscille Adam' is under it.
  - **Notes:**

- [ ] `8F95` Select the change button in the **Name** row.
  - **Expected:**
    - A box holding `Fictional data team` opens in the **Name** row.
    - The box has an **×** at its right.
  - **Notes:**

- [ ] `C04C` Select the **×** at the right of the box.
  - **Expected:** The box is empty.
  - **Notes:**

- [ ] `3F8E` Type `Fictional analytics team`, and press Enter.
  - **Expected:**
    - The panel's title reads `Fictional analytics team`.
    - The **Name** row reads `Fictional analytics team`.
    - The card of 'Branson O'Keefe' is named `Fictional analytics team`.
  - **Notes:**

- [ ] `7CF8` Select the Feature teams button, then 'Payments core'.
  - **Expected:** The team panel is titled 'Payments core'.
  - **Notes:**

- [ ] `3A39` Select **Remove feature team** at the panel's foot.
  - **Expected:**
    - The panel's title is a hollow yellow dot, then 'Payments core'.
    - No row has a change button.
    - The foot has **Discard draft**.
    - The foot has no **Remove feature team**.
  - **Notes:**

- [ ] `9CE3` Select **Discard draft**.
  - **Expected:**
    - The panel's title, 'Payments core', has no dot.
    - The foot has **Remove feature team**.
    - The foot has no **Discard draft**.
  - **Notes:**

- [ ] `89BD` Run [Publish](manual-test-basics.md#publish).
  - **Expected:** The **Publish** button is gone.
  - **Notes:**

### FT-04: An Approver Approves a Team's Draft

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from FT-03.

**Preconditions:** Signed in with this account. Select the **Drafts** page in the left-hand menu; **To decide** is chosen beside the page's title.

- [ ] `A4F5` Type `Platform reliability` in the search box.
  - **Expected:**
    - One row is listed, whose **Record** reads 'Platform reliability' and **Type** "Feature team".
    - Its **What changes** sets **Feature lead** to "Polly Smith".
    - Its **What changes** changes **Members**:
      - from "Bilwa Iyer, Fulcran Deschamps, Gloria Armas Guardado, Polly Smith, Thad Heidenreich, Valéry Caron"
      - to "Bilwa Iyer, Fulcran Deschamps, Gloria Armas Guardado, Polly Smith, Rosendo Champlin, Valéry Caron"
    - Its **Made by** reads "Engineering Manager as Engineering Manager".
  - **Notes:**

- [ ] `B5F5` Tick that row's tick box.
  - **Expected:**
    - The tick box is ticked.
    - At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `897A` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:**
    - A dialog headed "Approve 1 draft?" opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] `638F` Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notice begins "Approved".
  - **Notes:**

- [ ] `EC96` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens.
  - **Notes:**

- [ ] `5A17` Choose **Feature teams** in the teams switch.
  - **Expected:**
    - The first card of 'Platform reliability' is that of 'Polly Smith'.
    - The cards of 'Bilwa Iyer' and 'Rosendo Champlin' are under it.
    - The cards of 'Bilwa Iyer' and 'Rosendo Champlin' have no dots.
    - No card for 'Thad Heidenreich' is in 'Platform reliability'.
  - **Notes:**

- [ ] `77CD` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **To decide** chosen beside the page's title.
  - **Notes:**

- [ ] `E97B` Clear the search box, and type `Fictional analytics team` in it.
  - **Expected:**
    - One row is listed, whose **Record** reads `Fictional analytics team` and **Change** "Added".
    - Its **What changes** gives **Feature lead** as "Branson O'Keefe".
    - Its **What changes** gives **Members** as "Branson O'Keefe, Priscille Adam".
  - **Notes:**

### FT-05: A Team's Panel Works From the Keyboard

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FT-04.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu, choose **Feature teams** in the teams switch, then select the Feature teams button, then 'Payments core'.

- [ ] `78FD` Click the panel's title, 'Payments core'.
  - **Expected:** The team panel is still open, titled 'Payments core'.
  - **Notes:**

- [ ] `ED8F` Press Tab until the panel's **×** has a visible outline.
  - **Expected:** The panel's **×** has a visible outline.
  - **Notes:**

- [ ] `71ED` Press Tab.
  - **Expected:** The outline is on the change button in the **Name** row.
  - **Notes:**

- [ ] `005B` Press Tab.
  - **Expected:** The outline is on the change button in the **Colour** row.
  - **Notes:**

- [ ] `E315` Press Tab.
  - **Expected:** The outline is on the change button in the **Feature lead** row.
  - **Notes:**

- [ ] `32BC` Press Tab.
  - **Expected:** The outline is on the change button in the **Members** row.
  - **Notes:**

- [ ] `637C` Press Enter.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `AB97` Type `Rosendo`, and press Enter.
  - **Expected:** 'Rosendo Champlin' has a tick.
  - **Notes:**

- [ ] `48F2` Press Enter.
  - **Expected:**
    - The list closes.
    - **Members** lists 'Rosendo Champlin'.
    - A hollow yellow dot is before his name.
    - The outline is on the change button in the **Members** row.
  - **Notes:**

- [ ] `5EC4` Press Tab until **Discard draft** has the outline.
  - **Expected:** **Discard draft** has a visible outline.
  - **Notes:**

- [ ] `01D7` Press Enter.
  - **Expected:**
    - 'Rosendo Champlin' is no longer listed.
    - No dot is in the panel.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FT-06: The Org Chart Moves Through Time

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FT-05.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch.

- [ ] `1C5A` Look at the row between the page's heading and the chart.
  - **Expected:**
    - A **Date** box shows today's date, written as year, month and day, such as "2026-11-11".
    - Beside it are a left arrow, a timeline marked with one month in each year, such as "Nov 2024" and "Nov 2025", and a right arrow.
    - A **Today** button is greyed out.
  - **Notes:**

- [ ] `CE78` Select the left arrow once.
  - **Expected:**
    - The **Date** box shows the first day of last month.
    - The chart redraws without the page going blank.
    - The **Draft** button is still above the chart.
  - **Notes:**

- [ ] `E122` Clear the **Date** box, and type the first day of the month seven months before the current one, as digits alone, such as `20260401` on a seed restored on 15 November 2026.
  - **Expected:**
    - The **Date** box shows the date typed.
    - 'Data pipeline' is on the card of 'Carmine Labadie'.
    - The card of 'Maribel Dare' is under 'Identity'.
    - No card of 'Maribel Dare' is under 'Integrations'.
  - **Notes:**

- [ ] `9D38` Select the Feature teams button, then 'Payments core'.
  - **Expected:**
    - **Feature lead** and **Members** have change buttons.
    - **Name** and **Colour** have none.
    - There is no **Remove feature team** button.
  - **Notes:**

- [ ] `E48C` Drag the timeline's handle well to the left, and let go.
  - **Expected:**
    - While dragging, a label shows the month under the handle.
    - The handle stays where it was let go.
    - The chart redraws once, showing only the teams with members or a draft that month, which may be none.
    - The **Date** box shows the first day of that month.
  - **Notes:**

- [ ] `FE54` Clear the **Date** box.
  - **Expected:** The **Date** box is empty.
  - **Notes:**

- [ ] `00C2` Type a date in the middle of a month in the **Date** box, as digits alone, such as `20250315`.
  - **Expected:** The timeline's handle is at March 2025.
  - **Notes:**

- [ ] `3AC6` Choose **Reporting teams** in the teams switch.
  - **Expected:**
    - The **Date** box still shows the date typed.
    - The chart shows managers and their reports.
  - **Notes:**

- [ ] `D028` Select **Today**.
  - **Expected:**
    - The text below the row is gone.
    - **Today** is greyed out.
    - The **Date** box shows today's date.
  - **Notes:**

### FT-07: Readers Without Personal Details Have No Other Date

**Account:** Product Manager, `product.manager@fathom.test`, changed from FT-06.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu; it shows reporting teams.

- [ ] `7FB0` Look at the area between the finder and the chart.
  - **Expected:** There is no date row.
  - **Notes:**

- [ ] `F46D` Select **Feature teams** in the teams switch.
  - **Expected:** There is still no date row.
  - **Notes:**

### FT-08: Changes Take Effect From the Date Shown

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FT-07.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch; it shows today.

- [ ] `8A8C` Select the right arrow once.
  - **Expected:**
    - The **Date** box shows the first day of next month.
    - The **Draft** button is above the chart.
  - **Notes:**

- [ ] `10CE` Select the Feature teams button, then 'Payments core'.
  - **Expected:** The team panel is titled 'Payments core'.
  - **Notes:**

- [ ] `26AA` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `41DD` Press the Down arrow key until a person without a tick is highlighted.
  - **Expected:** A person without a tick is on a light grey background.
  - **Notes:**

- [ ] `BF7C` Press Enter. Note the person's name: the joiner.
  - **Expected:** The joiner has a tick.
  - **Notes:**

- [ ] `E1AE` Press Enter.
  - **Expected:**
    - The joiner is in the list of members.
    - A hollow yellow dot is before their name.
    - No date is after their name.
    - A card for the joiner is under the team on the chart.
  - **Notes:**

- [ ] `F487` Select **Today**.
  - **Expected:**
    - The joiner is still in the team panel's list of members.
    - A hollow yellow dot is before their name.
    - After their name, in grey, "from" and the first day of next month, such as "from Dec 1, 2026".
  - **Notes:**

- [ ] `5F31` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page opens, with **Not published** chosen beside the page's title.
  - **Notes:**

- [ ] `B140` Type `Payments core` in the search box.
  - **Expected:** In the row whose **Record** reads 'Payments core', **What changes** gives **Joining and leaving dates** as the joiner and the first day of next month.
  - **Notes:**

- [ ] `7AFD` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens.
  - **Notes:**

- [ ] `757C` Choose **Feature teams** in the teams switch.
  - **Expected:** The chart shows feature teams.
  - **Notes:**

- [ ] `3A5B` Select the Feature teams button, then 'Payments core'.
  - **Expected:** The team panel is titled 'Payments core'.
  - **Notes:**

- [ ] `77F1` Select **Discard draft** at the panel's foot.
  - **Expected:**
    - No dot is in the panel.
    - The joiner is not in the list of members.
  - **Notes:**

### FT-09: An Earlier Date Is Read Only Without the Right to Change Dates

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from FT-08.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch; it shows today.

- [ ] `D54C` Select the left arrow once.
  - **Expected:** There is no **Draft** button above the chart.
  - **Notes:**

- [ ] `C6E3` Select the Feature teams button, then 'Payments core'.
  - **Expected:** No row in the team panel has a change button.
  - **Notes:**

- [ ] `1C45` Select the right arrow twice.
  - **Expected:**
    - The **Draft** button is above the chart.
    - In the team panel, **Feature lead** and **Members** have change buttons.
    - In the team panel, **Name** and **Colour** have none.
  - **Notes:**

- [ ] `EDF7` Select **Today**.
  - **Expected:** **Today** is greyed out.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### FT-10: Choices Show Their Descriptions

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FT-09.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. Select the **Org chart** page in the left-hand menu, choose **Feature teams** in the teams switch, then select the Feature teams button, then 'Payments core'.

- [ ] `06CA` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `9F85` Type `engineer`.
  - **Expected:** Every person listed has "Engineer" or "engineer" in the grey line under their name.
  - **Notes:**

- [ ] `210C` Press Esc.
  - **Expected:**
    - The list closes.
    - **Members** shows no dot and no struck-through name.
  - **Notes:**

- [ ] `15EF` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `F472` Scroll right to the **Site** column.
  - **Expected:** The **Site** column is in view.
  - **Notes:**

- [ ] `8BB8` Select any person's **Site** cell.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `1FCC` Press Enter.
  - **Expected:**
    - A list of sites opens under the cell.
    - 'Northmere Labs' has "The research site." in grey under it.
    - No other site has a grey line under it.
  - **Notes:**

- [ ] `942D` Type `research`.
  - **Expected:** 'Northmere Labs' is the only site listed.
  - **Notes:**

- [ ] `3D09` Press Esc.
  - **Expected:**
    - The list closes.
    - The cell has no dot.
  - **Notes:**

### FT-11: A Team's Lead Is Taken Away

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FT-10.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu, choose **Feature teams** in the teams switch, then select the Feature teams button, then 'Payments core'.

- [ ] `B9AB` Select the change button in the **Feature lead** row.
  - **Expected:**
    - The list's first option is **None**, with a line under it.
    - No option is highlighted.
  - **Notes:**

- [ ] `DA2A` Press the Down arrow key.
  - **Expected:** The first person after the line is on a light grey background.
  - **Notes:**

- [ ] `F016` Select **None**.
  - **Expected:**
    - **Feature lead** reads "None".
    - A hollow yellow dot is before it.
    - Under it, 'Gilda Effertz' shows.
    - A green dot is before 'Gilda Effertz'.
  - **Notes:**

- [ ] `B125` Select **Discard draft** at the panel's foot.
  - **Expected:**
    - **Feature lead** reads 'Gilda Effertz'.
    - **Feature lead** has no dot.
  - **Notes:**

### FT-12: People Names Each Person's Feature Teams

**Account:** Product Manager, `product.manager@fathom.test`, changed from FT-11.

**Preconditions:** Run Restore the Seed Data. Signed in with this account. Select the **People** page in the left-hand menu.

- [ ] `1B95` Type `Lorenza` in the search field above the table.
  - **Expected:**
    - One row shows, 'Lorenza Thiel'.
    - A **Feature teams** column follows the **Team** column.
    - Its cell reads "Payments core, Search".
    - The **Feature teams** cell shows no pencil.
  - **Notes:**

- [ ] `7B3F` Select the **Feature teams** cell, then press Enter.
  - **Expected:** No list of choices opens; the cell stays as it was.
  - **Notes:**

**Afterwards:** Open the **Views** menu above the table and select **Clear view**.

### FT-13: People Grouped by Feature Teams

**Account:** Product Manager, `product.manager@fathom.test`, the account FT-12 ended with.

**Preconditions:** Select the **People** page in the left-hand menu.

- [ ] `C5B9` Choose **Feature teams** in **Group by**.
  - **Expected:**
    - The button reads **Group by: Feature teams**.
    - The headings name the feature teams in order of name, from "Data pipeline" to "Search", then "No feature team".
    - Each heading shows how many rows are under it.
  - **Notes:**

- [ ] `DC77` Type `Lorenza` in the search field above the table.
  - **Expected:**
    - 'Lorenza Thiel' shows under "Payments core" and again under "Search".
    - Each of the two rows has a dimmed "+1" after the name.
  - **Notes:**

- [ ] `E9DE` Point at the "+1" in the row under "Payments core".
  - **Expected:** A tip reads "Also under Search".
  - **Notes:**

- [ ] `7128` Clear the search field, then type `Backend engineer 1`.
  - **Expected:**
    - One row shows, 'Backend engineer 1', under "No feature team".
    - Its **Feature teams** cell is empty.
  - **Notes:**
