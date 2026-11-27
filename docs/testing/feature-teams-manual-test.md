---
title: "Manual Test: Feature Teams"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/org-chart*", "apps/web/src/people-grid.tsx", "apps/web/src/feature-team*", "apps/web/src/choice-picker.tsx", "apps/server/src/data/feature-teams.ts", "apps/server/src/data/feature-team-days.ts", "apps/server/src/data/feature-team-rules.ts", "apps/server/src/data/feature-team-held-changes.ts", "apps/server/src/data/feature-team-sight.ts", "apps/server/src/data/feature-team-reads.ts", "apps/server/src/data/feature-team-records.ts", "apps/server/src/data/feature-team-decisions.ts", "apps/server/src/data/feature-team-undo.ts", "apps/server/src/data/feature-team-removals.ts", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/org-chart.md"]
last_updated: "2026-11-27"
---

# Manual Test: Feature Teams

## Scope

Verifies feature teams on the **Org chart** page:

- How each team is drawn under its lead, and a team's panel.
- What a reader who may not change teams sees: no change buttons and no **New feature team**.
- Proposing a lead, adding a team and removing one, as drafts, with their marks on the chart and in the panel.
- Planned hires on a team, as members and as its lead.
- Changing teams from another date.
- Approving a team's draft on the Drafts page.
- Using a team's panel from the keyboard.
- Each person's feature teams on the **People** page, grouped by team.

The seeded feature teams are listed in [Development Setup](../design/development-setup.md#fictional-data).

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Engineering Manager:** `engineering.manager@fathom.test`, which proposes changes to feature teams
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
    - The cards of 'Mobile apps' have an orange band.
    - The cards of 'Payments core' have a teal band.
    - The cards of 'Search and discovery' have an indigo band.
    - The cards of 'Platform reliability' have no band.
  - **Notes:**

- [ ] `71A1` Click the card named 'Platform reliability'.
  - **Expected:**
    - The team panel opens beside the chart, titled 'Platform reliability'.
    - The card named 'Platform reliability' is fully in view, to the left of the panel.
    - A grey lock is before the title.
    - A **Details** section has two rows:
      - **Name**, reading 'Platform reliability'.
      - **Colour**, reading "None".
    - A **Members** section has two rows:
      - **Feature lead**, reading "None".
      - **Members**, listing 'Bilwa Iyer', 'Fulcran Deschamps', 'Gloria Armas Guardado', 'Polly Smith', 'Thad Heidenreich' and 'Valéry Caron'.
    - No row has a change button.
    - There are no buttons under the **Members** section.
  - **Notes:**

- [ ] `8BA2` Select the Feature teams button, then 'Search and discovery'.
  - **Expected:**
    - The team panel is titled 'Search and discovery'.
    - **Name** has a yellow dot before 'Search and discovery'.
    - Under it, a green dot is before 'Search'.
    - **Feature lead** reads 'Lorenza Thiel'.
    - **Members** lists 'Lorenza Thiel', 'Nicole Grüner', 'Yara Habel' and '杨治涛'.
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
    - The team panel, titled 'Search and discovery', is open beside the chart.
  - **Notes:**

### FT-02: An Engineering Manager Proposes a Lead

**Account:** Second Workforce Administrator, `engineering.operations.manager.2@fathom.test`, changed from FT-01. Step `9F02` signs in as another account.

**Preconditions:** Signed in with this account.

- [ ] `80FB` Run Discard the Unpublished Changes.
  - **Expected:** The Publish button is gone.
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
  - **Notes:**

- [ ] `5A69` Select the change button in the **Feature lead** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
    - Each person has a grey line under their name: their position, then their reporting team's name, or "reports to" and their manager's name.
    - Pointed at, a person is on a light grey background, with their name and the line under it easy to read.
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

- [ ] `5C99` Run [Publish](manual-test-basics.md#publish).
  - **Expected:** The Publish button is gone.
  - **Notes:**

### FT-03: A Workforce Administrator Adds and Removes

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

- [ ] `D763` Select the change button in the **Feature lead** row.
  - **Expected:** A list of people opens under the row.
  - **Notes:**

- [ ] `9D7E` Type `Branson`, and press Enter.
  - **Expected:** **Feature lead** reads 'Branson O'Keefe'.
  - **Notes:**

- [ ] `492D` Select **Add**.
  - **Expected:**
    - The panel's title is a hollow yellow dot, then `Fictional data team`.
    - On the chart, a card for 'Branson O'Keefe' is named `Fictional data team`.
  - **Notes:**

- [ ] `7CF8` Select the Feature teams button, then 'Payments core'.
  - **Expected:** The team panel is titled 'Payments core'.
  - **Notes:**

- [ ] `3A39` Select **Remove feature team**, under the **Members** section.
  - **Expected:**
    - The panel's title is a hollow yellow dot, then 'Payments core'.
    - No row has a change button.
    - **Discard draft** is under the **Members** section.
    - **Remove feature team** is gone.
  - **Notes:**

- [ ] `9CE3` Select **Discard draft**.
  - **Expected:**
    - The panel's title, 'Payments core', has no dot.
    - **Remove feature team** is back.
    - **Discard draft** is gone.
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes.

### FT-04: An Approver Approves a Team's Draft

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from FT-03.

**Preconditions:** Signed in with this account. Select the **Drafts** page in the left-hand menu, then **To decide** beside the page's title.

- [ ] `A4F5` Search for `Platform reliability`.
  - **Expected:**
    - One row is listed, whose **Record** reads 'Platform reliability' and **Type** "Feature team".
    - Its **What changes** sets **Feature lead** to "Polly Smith".
    - Its **Made by** reads "Engineering Manager".
  - **Notes:**

- [ ] `B5F5` Tick that row's tick box.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `897A` Select **Approve 1 draft…**.
  - **Expected:** A dialog titled "Approve 1 draft?" opens, with an **Approve** button.
  - **Notes:**

- [ ] `638F` Select **Approve** in the dialog.
  - **Expected:**
    - The dialog closes.
    - A notification says "Approved 1 draft."
  - **Notes:**

- [ ] `EC96` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens.
  - **Notes:**

- [ ] `5A17` Choose **Feature teams** in the teams switch.
  - **Expected:**
    - The first card of 'Platform reliability' is that of 'Polly Smith'.
    - The cards of the team's other members are under it, with no dots.
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

- [ ] `32BC` Press Tab four times.
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

- [ ] `E122` Clear the **Date** box, and type the first day of the month seven months before the current one, as digits alone, such as `20260401` on a seed restored on 15 November 2026.
  - **Expected:**
    - The **Date** box shows the date typed.
    - 'Data pipeline' is on the card of 'Carmine Labadie'.
    - The card of 'Maribel Dare' is under 'Identity'.
    - No card of 'Maribel Dare' is under 'Integrations'.
  - **Notes:**

- [ ] `E48C` Drag the timeline's handle well to the left, and let go.
  - **Expected:**
    - While dragging, a label shows the month under the handle.
    - The handle stays where it was let go.
    - The chart redraws once, showing only the teams with members or a draft that month, which may be none.
    - The **Date** box shows the first day of that month.
  - **Notes:**

- [ ] `D028` Select **Today**.
  - **Expected:**
    - **Today** is greyed out.
    - The **Date** box shows today's date.
  - **Notes:**

### FT-07: Readers Without Personal Details Have No Other Date

Proved by automated tests in `apps/web/src/org-chart-page-feature-team-changes.test.tsx`.

### FT-08: Changes Take Effect From the Date Shown

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as FT-06.

**Preconditions:** Signed in with this account. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch; it shows today.

- [ ] `8A8C` Select the right arrow once.
  - **Expected:** The **Date** box shows the first day of next month.
  - **Notes:**

- [ ] `10CE` Select the Feature teams button, then 'Payments core'.
  - **Expected:** The team panel is titled 'Payments core'.
  - **Notes:**

- [ ] `26AA` Select the change button in the **Members** row.
  - **Expected:** A list of people opens under the row.
  - **Notes:**

- [ ] `4B7E` Type `Branson`, and press Enter.
  - **Expected:** 'Branson O'Keefe' has a tick.
  - **Notes:**

- [ ] `E1AE` Press Enter.
  - **Expected:**
    - 'Branson O'Keefe' is in the list of members.
    - A hollow yellow dot is before his name.
    - No date is after his name.
    - On the chart, a card for 'Branson O'Keefe' is under the team.
    - That card has a hollow yellow dot before his name.
  - **Notes:**

- [ ] `F487` Select **Today**.
  - **Expected:**
    - 'Branson O'Keefe' is still in the team panel's list of members.
    - A hollow yellow dot is before his name.
    - After his name, in grey, "from" and the first day of next month, such as "from Dec 1, 2026".
  - **Notes:**

- [ ] `77F1` Select **Discard draft**, under the **Members** section.
  - **Expected:**
    - No dot is in the panel.
    - 'Branson O'Keefe' is not in the list of members.
  - **Notes:**

### FT-09: An Earlier Date Is Read Only Without the Right to Change Dates

Proved by automated tests in `apps/web/src/org-chart-page-feature-team-changes.test.tsx` and `apps/web/src/feature-team-panel.test.tsx`.

### FT-10: Choices Show Their Descriptions

Proved by automated tests in `apps/web/src/choice-picker.test.tsx`.

### FT-11: A Team's Lead Is Taken Away

Proved by automated tests in `apps/web/src/choice-picker.test.tsx` and `apps/web/src/feature-team-panel.test.tsx`.

### FT-12: People Names Each Person's Feature Teams

Covered by [FT-13](#ft-13-people-grouped-by-feature-teams).

### FT-13: People Grouped by Feature Teams

**Account:** Product Manager, `product.manager@fathom.test`, changed from FT-08.

**Preconditions:** Run Restore the Seed Data. Signed in with this account. Select the **People** page in the left-hand menu.

- [ ] `C5B9` Choose **Feature teams** in the Group by menu.
  - **Expected:**
    - The button reads **Group by: Feature teams**.
    - The group headings name the feature teams in order of name, from "Data pipeline" to "Search", then "No feature team".
    - Each heading shows how many people and planned hires are under it, such as "4 people".
    - The "Field tools" heading reads a number of people, then ", 1 planned hire".
  - **Notes:**

- [ ] `DC77` Search for `Lorenza`.
  - **Expected:**
    - 'Lorenza Thiel' shows under "Payments core" and again under "Search".
    - Each of the two rows has a dimmed "+1" after the name.
    - A **Feature teams** column follows the **Team** column.
    - Its cells read "Payments core, Search", each name after a small square in its team's colour.
    - Pointed at, a **Feature teams** cell shows no pencil.
  - **Notes:**

- [ ] `E9DE` Point at the "+1" in the row under "Payments core".
  - **Expected:** A tip reads "Also under Search".
  - **Notes:**

- [ ] `7128` Search for `Backend engineer 1`.
  - **Expected:**
    - One row shows, 'Backend engineer 1', under "No feature team".
    - Its **Feature teams** cell is empty.
  - **Notes:**

- [ ] `30E0` Search for `REQ-2053`.
  - **Expected:**
    - One row shows, 'Data engineer', under "Field tools".
    - Its **Feature teams** cell reads 'Field tools'.
  - **Notes:**

**Afterwards:** Open the Views menu and select **Clear view**.

### FT-14: Planned Hires on a Feature Team

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FT-13.

**Preconditions:** Run Restore the Seed Data. Signed in with this account. Select the **Org chart** page in the left-hand menu, and choose **Feature teams** in the teams switch.

- [ ] `7464` Type `Data engineer` in the finder, and select the one planned hire it offers.
  - **Expected:**
    - The chart centres on a card with a grey dashed edge, under the card that names 'Field tools'.
    - It reads 'Data engineer', then 'Software Engineer'.
    - Under them, a grey box reads "Planned, expected" and the name of last month, such as "Planned, expected Oct 2026".
    - It is the last card under 'Field tools', after the people.
  - **Notes:**

- [ ] `ABCE` Select the Feature teams button, then 'Field tools'.
  - **Expected:**
    - The team panel opens, titled 'Field tools'.
    - **Members** lists people by name, then 'Data engineer' last.
    - 'Data engineer' is grey, followed by "#HIRE-" and a number, then, in grey, "from" and the first day of last month, such as "from Oct 1, 2026".
  - **Notes:**

- [ ] `B55C` Clear the **Date** box, and type the first day of the month three months after the current one, as digits alone, such as `20270201` on a seed restored on 26 November 2026.
  - **Expected:**
    - The **Date** box shows the date typed.
    - The team panel still shows 'Field tools'.
  - **Notes:**

- [ ] `A516` Read the **Feature lead** row of the team panel.
  - **Expected:**
    - It reads "Engineering Manager, TBD-" and a number, in grey italics.
    - After it are "#HIRE-" and another number, then, in grey, "from" and the date typed.
  - **Notes:**

- [ ] `131A` Read the **Members** row of the team panel.
  - **Expected:**
    - It lists people by name, then 'Data engineer', then "Engineering Manager, TBD-" and the same number.
    - Each of the last two is grey, followed by "#HIRE-" and a number, then, in grey, "from" and the day it joined: the first day of last month, then the date typed.
    - "Engineering Manager, TBD-" and its number are in grey italics.
  - **Notes:**

- [ ] `0C0A` Close the team panel, and find the card that names 'Field tools'.
  - **Expected:**
    - The card has a grey dashed edge.
    - It reads "TBD-" and the number, in grey italics, then 'Engineering Manager'.
    - Under them, in order: a grey box reading "Planned, no date"; a small square in the team's colour and 'Field tools'; then "Hide" and a number of members.
    - Nothing on the card overlaps the cards under it.
    - The cards under it include the people and 'Data engineer'.
  - **Notes:**

**Afterwards:** Select **Today**.
