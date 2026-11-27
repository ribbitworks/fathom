---
title: "Manual Test: Team Member Workflows"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/help/working-as-a-team-member.md", "docs/product/roles.md"]
last_updated: "2026-11-27"
---

# Manual Test: Team Member Workflows

## Scope

Verifies the workflows of [Working as a Team Member](../help/working-as-a-team-member.md) on the seed data, without changing any record:

- The role the Overview says the Team Member is acting as, and its link to the org chart.
- Finding a person on the org chart, and opening their details there and on People.
- Seeing what each cycle and release holds on Features, and when each release ships on the Releases timeline.
- Looking at a project's details and its milestones.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with a browser window at least 1,440 pixels wide.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses the Team Member, `team.member@fathom.test`.

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Reset the Database](manual-test-basics.md#reset-the-database).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the left-hand menu, the Overview and its jobs, marks, the lock, the Group by menu, the details button, the side panel, the finder, the teams switch and the card.

## Test Cases

Run the test cases in order, in about 20 minutes. Start with Start Fathom, then Reset the Database. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### MEMBER-01: A Team Member Finds Someone on the Org Chart

**Account:** Team Member, `team.member@fathom.test`; the first test case.

**Preconditions:** Reset the Database run. Signed out.

- [ ] `11C1` Sign in as the Team Member, `team.member@fathom.test`.
  - **Expected:**
    - The **Overview** page opens.
    - It reads "Acting as Team Member".
  - **Notes:**

- [ ] `E5D8` Select the **Org chart** link beside **Find Someone**.
  - **Expected:**
    - The **Org chart** page opens.
    - The chart shows each person's name, position, and the team they lead.
  - **Notes:**

- [ ] `62C8` Select the name on the card for 'Lorenza Thiel'.
  - **Expected:**
    - The details panel slides out on the right, headed 'Lorenza Thiel'.
    - The panel shows no change buttons.
  - **Notes:**

- [ ] `BB88` Select the **Show only this team** button at the top right of the card for 'Lorenza Thiel'.
  - **Expected:**
    - 'Lorenza Thiel' is at the top of the chart.
    - Her reports are under her.
    - To the right of the heading, the page reads "Only the team of Lorenza Thiel is shown."
    - **Show everyone** is beside it.
  - **Notes:**

- [ ] `1DBB` Select **Show everyone**.
  - **Expected:**
    - 'Silje Holm-Schrøder' is at the top of the chart.
    - The line "Only the team of Lorenza Thiel is shown." is gone.
  - **Notes:**

- [ ] `C68D` Choose **Feature teams** in the teams switch.
  - **Expected:**
    - The chart shows the feature teams of the [Fictional Data](../design/development-setup.md#fictional-data) side by side, each first card naming its team.
    - 'Search and discovery' has a yellow dot before its name.
    - 'Platform reliability' has a grey lock before its name.
    - There is no date row between the finder and the chart.
  - **Notes:**

- [ ] `DAD8` Choose **Reporting teams** in the teams switch.
  - **Expected:**
    - The chart shows managers' teams.
    - There is no date row between the finder and the chart.
  - **Notes:**

- [ ] `67F5` In the finder, type `Gloria`, and select 'Gloria Armas Guardado'.
  - **Expected:**
    - The chart moves until the card for 'Gloria Armas Guardado' is in the middle of the panel.
    - A blue ring is around the card.
  - **Notes:**

- [ ] `0A0C` Select the name on the card for 'Gloria Armas Guardado'.
  - **Expected:**
    - The details panel is headed 'Gloria Armas Guardado'.
    - The link **Show in People** is under the position.
  - **Notes:**

- [ ] `B8D1` Select **Show in People**.
  - **Expected:**
    - The **People** page opens.
    - Only the row of 'Gloria Armas Guardado' is listed.
  - **Notes:**

### MEMBER-02: A Team Member Sees What's Planned Without Changing It

**Account:** Team Member, `team.member@fathom.test`, the same as MEMBER-01.

**Preconditions:** None beyond MEMBER-01.

- [ ] `83BF` Look at the left-hand menu.
  - **Expected:**
    - The **Plan** section shows **Overview**, **Projects**, **Features**, **Activities** and **Releases**.
    - The **People** section shows **People** and **Org chart**.
    - There is no **Capacity**.
    - The **History** section shows **Drafts** and **Change history**.
    - The menu shows the **Help** section.
  - **Notes:**

- [ ] `8C54` Select **Features**.
  - **Expected:**
    - The table lists the features in one list.
    - There is no **New feature** button.
    - There is no empty row at the table's end.
  - **Notes:**

- [ ] `7DB7` Double-click the **Status** cell of any row.
  - **Expected:** The cell does not open for editing.
  - **Notes:**

- [ ] `B3B1` Select **Group by** above the table, then **Release**.
  - **Expected:**
    - The release headings, such as **Platform: Harbor 1**, are each followed by a comma, "ships" and a date.
    - The last heading is **Later**.
  - **Notes:**

- [ ] `3A3B` Select **Group by: Release**, then **Cycle** under **Group by**.
  - **Expected:**
    - The headings name the cycles, such as **Platform: 27.1**.
    - The last heading is **Later**.
  - **Notes:**

- [ ] `5D0B` Select **Releases**.
  - **Expected:**
    - The **Releases** page opens on its **Releases** tab.
    - The table under the timeline has a **Ships on** column, with a day in each row.
    - There is no **New release** button.
  - **Notes:**

- [ ] `DB21` Select **All** on the timeline.
  - **Expected:**
    - Each schedule's lane shows from its first cycle to its last without scrolling.
    - Each release has a diamond on the day it ships.
  - **Notes:**

- [ ] `E851` Hover over the span of 'Lantern 2' on the timeline.
  - **Expected:** A tooltip names 'Lantern 2', its cycles and the day it ships.
  - **Notes:**

- [ ] `AC69` Select the **Schedules** tab.
  - **Expected:** There is no **New schedule** button.
  - **Notes:**

- [ ] `9A61` Select the details button at the right of the first cell of the row for 'Platform'.
  - **Expected:**
    - The side panel's heading reads 'Platform'.
    - Its **Schedule ends** row has no change button.
  - **Notes:**

- [ ] `60D5` Select the **×** at the top right of the side panel.
  - **Expected:** The side panel closes.
  - **Notes:**

### MEMBER-03: A Team Member Looks at a Project

**Account:** Team Member, `team.member@fathom.test`, the same as MEMBER-02.

**Preconditions:** None beyond MEMBER-02.

- [ ] `A99A` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** tab is chosen.
  - **Notes:**

- [ ] `A78B` Select the details button at the right of the **Name** cell of 'Crane Control'.
  - **Expected:**
    - The side panel is headed 'Crane Control'.
    - Under **Milestones** are 'Kickoff', 'Factory test' and 'First crane live', each with its date.
    - 'Second crane live' and 'Final handover' are there too, each with a yellow dot before it.
    - The panel shows no change buttons.
  - **Notes:**

- [ ] `60C5` Open the **⋯** menu of 'Crane Control' in the table, and select **Show on Milestones**.
  - **Expected:**
    - The **Milestones** tab opens, showing only the milestones of 'Crane Control'.
    - A pill above the table reads "Project: P-2001 Crane Control".
  - **Notes:**

### MEMBER-04: A Personal View Keeps Frozen Columns, Widths and Column Order

Proved by automated tests in `apps/web/src/people-page-saved-views.test.tsx`.
