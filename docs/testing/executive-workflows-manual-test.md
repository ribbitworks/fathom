---
title: "Manual Test: Executive Workflows"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/help/working-as-an-executive.md", "docs/product/roles.md"]
last_updated: "2026-11-27"
---

# Manual Test: Executive Workflows

## Scope

Verifies the workflows of [Working as an Executive](../help/working-as-an-executive.md) on the seed data, without changing any record:

- Reading the plan on Features and on the Releases timeline, live only or with drafts.
- Seeing who is on each feature team and what each person works on, on Capacity.
- The role the Overview says the Executive is acting as, and its link to Releases.
- Looking at people on the org chart, on another date and in Metrics.
- Seeing people, accounts, roles and settings without changing them.
- Following what changed in the change history and the access history.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with a browser window at least 1,440 pixels wide.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Executive:** `executive@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Reset the Database](manual-test-basics.md#reset-the-database).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses. This test adds:

- **Date box:** the box labelled **Date** between the **Org chart** heading and the chart, before the left arrow, timeline, right arrow and **Today**.

## Test Cases

Run the test cases in order, in about 25 minutes. Start with Start Fathom, then Reset the Database. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### EXECUTIVE-01: An Executive Reads the Plan

**Account:** Executive, `executive@fathom.test`; the first test case.

**Preconditions:** Reset the Database run. Signed in with this account.

- [ ] `4CE3` Look at the page and the left-hand menu.
  - **Expected:**
    - The **Overview** page is open.
    - The **Plan** section shows **Overview**, **Projects**, **Features**, **Activities** and **Releases**.
    - The **People** section shows **People**, **Org chart** and **Capacity**.
    - The **Administration** section shows **Accounts**, **Roles**, **Application settings**, **Lists** and **Planning settings**.
    - The **History** section shows **Drafts**, **Change history** and **Access history**.
    - The menu shows the **Help** section.
  - **Notes:**

- [ ] `E06A` Look at the **Overview** page.
  - **Expected:** It reads "Acting as Executive".
  - **Notes:**

- [ ] `B76D` Select **See What's Planned**, under **Plan**.
  - **Expected:** Its tasks show under it, among them **See When Each Release Ships**, with a **Releases** link beside it.
  - **Notes:**

- [ ] `B1CD` Select the **Releases** link beside **See When Each Release Ships**.
  - **Expected:**
    - The **Releases** page opens on its **Releases** tab.
    - The table under the timeline has a **Ships on** column, with a day in each row.
    - There is no **New release** button.
  - **Notes:**

- [ ] `0CAA` Select **All** on the timeline.
  - **Expected:**
    - Each schedule's lane shows from its first cycle to its last without scrolling.
    - Each release has a diamond on the day it ships.
  - **Notes:**

- [ ] `6E61` Hover over the span of 'Lantern 2' on the timeline.
  - **Expected:** A tooltip names 'Lantern 2', its cycles and the day it ships.
  - **Notes:**

- [ ] `83E6` Open the Draft menu above the timeline, and choose **Live only**.
  - **Expected:**
    - 'Harbor 4' is not on the timeline.
    - No release on the timeline has a yellow dot.
  - **Notes:**

- [ ] `175B` Choose **Drafts & Live** in the Draft menu.
  - **Expected:** 'Harbor 4' is on the timeline again, with a yellow dot.
  - **Notes:**

- [ ] `A08C` Select the **Schedules** tab.
  - **Expected:** There is no **New schedule** button.
  - **Notes:**

- [ ] `7DFE` Select the details button at the right of the first cell of the row for 'Platform'.
  - **Expected:**
    - The side panel's heading reads 'Platform'.
    - Its **Schedule ends** row has no change button.
  - **Notes:**

- [ ] `7C20` Close the side panel.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] `3A6C` Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] `1BAD` Select **Group by** above the table, then **Release**.
  - **Expected:**
    - The headings are, from top to bottom, **Platform: Harbor 1**, **Platform: Harbor 2 LTS**, **Platform: Harbor 3**, **Field Apps: Lantern 1**, **Field Apps: Lantern 2**, **Platform: Not released yet**, **Field Apps: Not released yet** and **Later**.
    - Each of the five 'Harbor' and 'Lantern' headings is followed by a comma, "ships" and a date.
    - There is no **New feature** button.
  - **Notes:**

### EXECUTIVE-02: An Executive Looks at People

**Account:** Executive, `executive@fathom.test`, the same as EXECUTIVE-01.

**Preconditions:** None beyond EXECUTIVE-01.

- [ ] `8E72` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens, with the **Date** box showing today.
  - **Notes:**

- [ ] `8CA6` In the finder, type `Gloria`, and select 'Gloria Armas Guardado'.
  - **Expected:** The card for 'Gloria Armas Guardado' is in the middle of the panel, with a blue ring around it.
  - **Notes:**

- [ ] `94DD` Select the left arrow once.
  - **Expected:**
    - The **Date** box shows the first day of last month.
    - There is no **Draft** button above the chart.
  - **Notes:**

- [ ] `C80C` Select **Today**.
  - **Expected:** The **Date** box shows today's date.
  - **Notes:**

- [ ] `DA7A` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `E326` Select **Metrics** above the table.
  - **Expected:**
    - The **Metrics** panel opens beside the table.
    - **Break down by** reads "Choose a column".
  - **Notes:**

- [ ] `BE0F` Set **Break down by** to **Position**.
  - **Expected:** A row for each position, such as 'Software Engineer', gives its count.
  - **Notes:**

**Afterwards:** Open the **Views** menu above the table and select **Clear view**.

### EXECUTIVE-03: An Executive Sees People and Administration Without Changing Them

**Account:** Executive, `executive@fathom.test`, the same as EXECUTIVE-02.

**Preconditions:** Signed in with this account.

- [ ] `98E3` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `78A5` Search for `Data engineer`.
  - **Expected:**
    - The row of the planned hire 'Data engineer' is shown, reading "Approved to hire" in **State**.
    - Its **Start** is a date before today, such as "15 Oct 2026".
    - The table has **Start** and **End** columns.
    - The table has **Compensation band** and **Performance rating** columns.
    - There is no **New person** and no **New column** button.
  - **Notes:**

- [ ] `CAC5` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **All drafts** is the only tab beside the page's title, and is chosen.
    - The table lists drafts, and no row has a tick box.
    - No buttons at the right of the page's heading.
  - **Notes:**

- [ ] `4B61` Select the **Accounts** page in the left-hand menu.
  - **Expected:**
    - Every account is in the table, with its **Roles** and **Status**.
    - There is no **New account** button.
  - **Notes:**

- [ ] `DF6E` Select the **Roles** page in the left-hand menu.
  - **Expected:**
    - Each role's row has a **View** button.
    - There is no **New role** button.
  - **Notes:**

- [ ] `464F` Select **View** in the **Executive** row.
  - **Expected:**
    - A dialog titled "Executive" opens, with the grid at its left.
    - Its only button at the bottom is **Close**.
  - **Notes:**

- [ ] `013D` Select **Close**.
  - **Expected:** The dialog closes.
  - **Notes:**

- [ ] `F170` Select the **Application settings** page in the left-hand menu.
  - **Expected:**
    - **Time zone** reads **America/Vancouver**.
    - **Password requirements** and **Generated passwords** are shown.
    - There is no **Save** button.
  - **Notes:**

### EXECUTIVE-04: An Executive Follows What Changed

**Account:** Executive, `executive@fathom.test`, the same as EXECUTIVE-03.

**Preconditions:** None beyond EXECUTIVE-03.

- [ ] `853A` Select the **Change history** page in the left-hand menu.
  - **Expected:** The entries are listed, newest first.
  - **Notes:**

- [ ] `327C` Type `Simone Jean` in the **Search** box.
  - **Expected:** Only entries naming 'Simone Jean' are listed, the newest by "Engineering Operations Manager".
  - **Notes:**

- [ ] `EDAE` Select the **Access history** page in the left-hand menu.
  - **Expected:** The entries are listed, newest first, such as one that "created the account for" an account.
  - **Notes:**

- [ ] `C8FD` Type `Team Member` in the **Search** box.
  - **Expected:** The entries listed include one that says "created the account for" 'Team Member', ending in a grey **Worth checking** box.
  - **Notes:**

### EXECUTIVE-05: An Executive Keeps a View

Removed: keeping a view is checked in [VIEW-01](saved-views-manual-test.md#view-01-a-personal-view-is-kept-to-its-maker) in Saved Views.

### EXECUTIVE-06: An Executive Sees Who Works on What

**Account:** Executive, `executive@fathom.test`, the same as EXECUTIVE-04.

**Preconditions:** None beyond EXECUTIVE-04.

- [ ] `7C77` Select the **Capacity** page in the left-hand menu, then the **Feature teams** tab.
  - **Expected:**
    - **Feature teams** is chosen in the tabs.
    - Each row is a person, and each column a month.
    - The cells show feature teams, each name after a small square in its team's colour.
  - **Notes:**

- [ ] `B9F7` Select **Feature team** in the Group by menu.
  - **Expected:**
    - **Group by: Feature team** shows.
    - A group heading names each feature team, such as 'Mobile apps' and 'Payments core', with its members under it.
  - **Notes:**

- [ ] `19C9` Select the **Allocations** tab.
  - **Expected:**
    - **Allocations** is chosen in the tabs.
    - **Group by** shows, naming no grouping.
    - The cells list features or activities, each with its percentage, such as "50%".
  - **Notes:**

- [ ] `78DA` Type `Blaise Gislason` in the search box.
  - **Expected:**
    - The row of 'Blaise Gislason' is listed, and no other person's.
    - In the current month's cell, one line names 'Warranty support' with "100%" at the right, and another names 'Depot rollout' with "25%".
    - The cell's last line reads "Over", red and bold, with how far over a whole month at the right, such as "+25%".
  - **Notes:**

**Afterwards:** Empty the search box.
