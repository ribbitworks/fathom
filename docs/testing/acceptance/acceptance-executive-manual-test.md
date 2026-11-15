---
title: "Manual Test: Acceptance, Executive"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/help/working-as-an-executive.md", "docs/product/roles.md"]
last_updated: "2026-11-15"
---

# Manual Test: Acceptance, Executive

## Scope

Verifies the workflows of [Working as an Executive](../../help/working-as-an-executive.md) on the seed data: reading the plan on Features and on the Releases timeline, live only or with drafts, looking at people on the org chart and in Metrics, seeing people and administration without changing them, and following what changed in both histories, and keeping a view of People.

## Test Environment

As [Manual Test Basics](../manual-test-basics.md#test-environment) sets out, with a browser window at least 1,440 pixels wide.

## Test Accounts

As [Manual Test Basics](../manual-test-basics.md#test-accounts) sets out, this test uses:

- **Executive:** `executive@fathom.test`

## Common Procedures

This test uses [Start Fathom](../manual-test-basics.md#start-fathom) and [Reset the Database](../manual-test-basics.md#reset-the-database).

## Terms

[Manual Test Basics](../manual-test-basics.md#terms) defines the terms every test uses. This test adds:

- **Date box:** the box labelled **Date** between the **Org chart** heading and the chart, before the left arrow, timeline, right arrow and **Today**.

## Test Cases

Run the test cases in order, in about 20 minutes. Start with Start Fathom, then Reset the Database. Check each step whose expected result you see, and write anything else under its notes.

### EXECUTIVE-01: An Executive Reads the Plan

**Account:** Executive, `executive@fathom.test`; the first test case.

**Preconditions:** Reset the Database run. Signed in with this account.

- [ ] `4CE3` Look at the page and the left-hand menu.
  - **Expected:**
    - The **Overview** page is open.
    - The **Plan** section shows **Overview**, **Projects**, **Features** and **Releases**.
    - The **People** section shows **People**, **Org chart**, **Feature assignments**, **Drafts** and **Capacity**.
    - The **Administration** section shows **Accounts**, **Roles**, **Settings** and **Lists**.
    - The **History** section shows **Change history** and **Access history**.
    - The menu shows the **Help** section.
  - **Notes:**

- [ ] `723D` Select **Releases**.
  - **Expected:** The **Releases** page opens.
  - **Notes:**

- [ ] `7DFE` Select the details button at the right of the **Stream** cell of 'Platform'.
  - **Expected:**
    - There is no **New release stream** button.
    - There is no **New release…** button.
    - 'Harbor 1' has no **⋯** button at its end.
  - **Notes:**

- [ ] `7C20` Close the side panel.
  - **Expected:** The side panel closes.
  - **Notes:**

- [ ] `0CAA` Select **All** on the timeline.
  - **Expected:** Each stream's lane shows from its first cycle to its last without scrolling.
  - **Notes:**

- [ ] `6E61` Hover over the span of 'Harbor 1' on the timeline.
  - **Expected:** A tooltip names 'Harbor 1', its cycles and the day it ships.
  - **Notes:**

- [ ] `83E6` Open the Draft menu above the timeline, and choose **Live only**.
  - **Expected:**
    - 'Harbor 4' is not on the timeline.
    - No release on the timeline has a yellow dot.
  - **Notes:**

- [ ] `175B` Choose **Drafts & Live** in the Draft menu.
  - **Expected:** 'Harbor 4' is on the timeline again, with a yellow dot.
  - **Notes:**

- [ ] `3A6C` Select **Features**.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] `1BAD` Select **Group by: Cycle** above the table, then **Release** under **Group by**.
  - **Expected:**
    - The headings are, from top to bottom, **Platform: Harbor 1**, **Platform: Harbor 2 LTS**, **Platform: Harbor 3**, **Platform: Not released yet** and **Later**.
    - Each of the three 'Harbor' headings is followed by a comma, "ships" and a date.
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
    - The text below the row ends "Nothing can be changed on this date."
  - **Notes:**

- [ ] `C80C` Select **Today**.
  - **Expected:** The text below the row is gone.
  - **Notes:**

- [ ] `DA7A` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `E326` Select **Metrics** above the table.
  - **Expected:** **Break down by** reads "Choose a column".
  - **Notes:**

- [ ] `BE0F` Set **Break down by** to **Position**.
  - **Expected:** A row for each position, such as 'Software Engineer', gives its count.
  - **Notes:**

### EXECUTIVE-03: An Executive Sees People and Administration Without Changing Them

**Account:** Executive, `executive@fathom.test`, the same as EXECUTIVE-02.

**Preconditions:** Signed in with this account.

- [ ] `98E3` Select **People**.
  - **Expected:** The **People** page opens.
  - **Notes:**

- [ ] `4A2E` Search for `Chatura Abbott`.
  - **Expected:**
    - Her row is shown, with a date after today in **Start**.
    - The table has **Start** and **End** columns.
    - There is no **New person** and no **New column** button.
  - **Notes:**

- [ ] `CAC5` Select **Drafts**.
  - **Expected:**
    - Drafts are listed, with no checkboxes.
    - There is no **Select all waiting** or **Approve** button.
  - **Notes:**

- [ ] `4B61` Select **Accounts**.
  - **Expected:**
    - Every account is in the table with its roles.
    - There is no **New account** button.
    - There is no **Edit** button in any row.
  - **Notes:**

### EXECUTIVE-04: An Executive Follows What Changed

**Account:** Executive, `executive@fathom.test`, the same as EXECUTIVE-03.

**Preconditions:** None beyond EXECUTIVE-03.

- [ ] `853A` Select the **Change history** page in the left-hand menu.
  - **Expected:** The entries are listed, newest first.
  - **Notes:**

- [ ] `327C` Type `Simone Jean` in the search box.
  - **Expected:** Only entries naming 'Simone Jean' are listed, the newest by "Engineering Operations Manager".
  - **Notes:**

- [ ] `EDAE` Select the **Access history** page in the left-hand menu.
  - **Expected:** The entries are listed, newest first, such as one that "created the account for" an account.
  - **Notes:**

### EXECUTIVE-05: An Executive Keeps a View

**Account:** Executive, `executive@fathom.test`, the same as EXECUTIVE-04.

**Preconditions:** None beyond EXECUTIVE-04.

- [ ] `1D99` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page opens, with no view applied.
  - **Notes:**

- [ ] `DDED` Type `Lorenza` in the search box.
  - **Expected:** Only rows with `Lorenza` in a cell are listed.
  - **Notes:**

- [ ] `8CFC` Open the Views menu, and select **Save view…**.
  - **Expected:**
    - A dialog titled "Save view" shows **Name**.
    - Under **Includes**, it shows the search.
    - It offers no choice about sharing.
  - **Notes:**

- [ ] `35EB` Type `Fictional reading` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `93D9` Select **Save view**.
  - **Expected:**
    - The dialog closes.
    - The Views button reads `Fictional reading`.
  - **Notes:**

- [ ] `E7E9` Open the Views menu, and select **Delete view**.
  - **Expected:** A notice reads "Deleted the Fictional reading view."
  - **Notes:**
