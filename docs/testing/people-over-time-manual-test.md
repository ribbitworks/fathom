---
title: "Manual Test: People Over Time"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/people-page.tsx", "apps/web/src/people-actions.ts", "apps/web/src/people-grid.tsx", "apps/web/src/person-panel.tsx", "apps/web/src/date-control.tsx", "apps/server/src/data/people.ts", "apps/server/src/data/people-reads.ts", "apps/server/src/data/people-table-reads.ts", "apps/server/src/data/person-fields.ts", "packages/seed/src/**", "packages/fixtures/src/**", "apps/web/src/person-timeline.tsx", "apps/web/src/record-timeline.tsx", "apps/server/src/data/person-timeline.ts"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/testing/org-chart-manual-test.md"]
last_updated: "2026-11-25"
---

# Manual Test: People Over Time

## Scope

Verifies reading the **People** page on another date: the date row above its table, who is listed on an earlier and a later date, planned hires on later dates, a person's details beside the table on that date, changing a manager from an earlier date in the table, a role that sees no other dates, and a person's timeline: its preview, its panel, a day chosen from it and closing it.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Engineering Manager:** `engineering.manager@fathom.test`
- **Engineering Director:** `engineering.director@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Feature Lead:** `feature.lead@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks and the Draft menu. This test adds:

- **Date row:** the row under the search box, above the table, holding a **Date** box, a left arrow, a timeline, a right arrow and **Today**.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### PEOPLE-TIME-01: People Opens on Today, With the Date Row

**Account:** Engineering Manager, `engineering.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `5CE0` Read the top of the page.
  - **Expected:**
    - The date row is under the search box and the buttons beside it, above the table.
    - The **Date** box holds today's date, such as `2026-11-14`.
    - **Today** is turned off.
    - No line of text is under the date row.
  - **Notes:**

### PEOPLE-TIME-02: An Earlier Date Lists Those Employed Then, and No Planned Hires

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as PEOPLE-TIME-01.

**Preconditions:** **People** page open, showing today.

- [ ] `E0A4` In the date row, select the left arrow once.
  - **Expected:**
    - The **Date** box shows the first day of last month, such as `2026-10-01`.
    - No **New person** button is at the top right.
    - The table shows without a loading spinner taking its place.
  - **Notes:**

- [ ] `E8A0` Type `Holmberg` in the search box.
  - **Expected:** One row shows, 'Viktoria Holmberg', whose **State** reads **Hired**.
  - **Notes:**

- [ ] `CF7F` Clear the search box, and type `Chatura`.
  - **Expected:** No row shows.
  - **Notes:**

- [ ] `282A` Clear the search box, and type `TBD`.
  - **Expected:** No row shows.
  - **Notes:**

- [ ] `B17C` Clear the search box.
  - **Expected:** Every row shown has the state **Hired** or **Left**.
  - **Notes:**

### PEOPLE-TIME-03: A Later Date Lists Every Planned Hire Not Yet Filled

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as PEOPLE-TIME-02.

**Preconditions:** **People** page open, showing the first day of last month.

- [ ] `F799` Select **Today** in the date row.
  - **Expected:** The **Date** box shows today's date.
  - **Notes:**

- [ ] `3B6E` Type `선예빈` in the search box.
  - **Expected:** One row shows, '선예빈', whose **End** holds a date still to come.
  - **Notes:**

- [ ] `4931` Clear the search box, and type `TBD`.
  - **Expected:** The planned hires with temporary IDs show, each starting **TBD-**.
  - **Notes:**

- [ ] `28E7` In the date row, select the right arrow three times.
  - **Expected:**
    - The **Date** box shows the first day of the month three months from now.
    - The same planned hires show as on today, whatever month each is expected.
  - **Notes:**

- [ ] `7DC5` Clear the search box, and type `Chatura`.
  - **Expected:** One row shows, 'Chatura Abbott', who has started by then.
  - **Notes:**

- [ ] `9D41` Clear the search box, and type `선예빈`.
  - **Expected:** No row shows.
  - **Notes:**

### PEOPLE-TIME-04: A Person's Details Follow the Date Shown

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as PEOPLE-TIME-03.

**Preconditions:** **People** page open, showing today.

- [ ] `4566` Type `Holmberg` in the search box.
  - **Expected:** One row shows, 'Viktoria Holmberg', whose **State** reads **Left**.
  - **Notes:**

- [ ] `DB5B` Select the details button in her row.
  - **Expected:**
    - Her details open beside the table.
    - A red **Left** box follows her position under her name.
  - **Notes:**

- [ ] `255C` In the date row, select the left arrow once.
  - **Expected:**
    - Her details stay open, without the panel shrinking and growing back.
    - The red **Left** box is gone from her details.
    - Her **End** under **Details** reads the same date as on today.
  - **Notes:**

- [ ] `9EFB` Select **Today** in the date row.
  - **Expected:** The red **Left** box is back in her details.
  - **Notes:**

- [ ] `84CB` In the date row, select the right arrow once.
  - **Expected:**
    - The table shows no row for her.
    - Her details read "Viktoria Holmberg isn't employed on" and the first day of next month, such as "Dec 1, 2026."
  - **Notes:**

- [ ] `0C0B` Select the **×** at the top right of the details.
  - **Expected:** The details close.
  - **Notes:**

### PEOPLE-TIME-05: A Manager Is Changed From an Earlier Date in the Table

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from PEOPLE-TIME-04.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. **People** page open from the left-hand menu, showing today.

- [ ] `44FA` In the date row, select the left arrow once.
  - **Expected:**
    - The **Date** box shows the first day of last month.
    - No **New person** or **New column** button is at the top right.
  - **Notes:**

- [ ] `C0C2` Type `Candice` in the search box.
  - **Expected:** One row shows, 'Candice Swift', whose **Manager** reads 'Lorenza Thiel'.
  - **Notes:**

- [ ] `0B36` Double-click her **Name** cell.
  - **Expected:** Nothing opens to type in.
  - **Notes:**

- [ ] `94A2` Select her **Manager** cell, press Enter, choose 'Max Munk', and press Enter.
  - **Expected:**
    - Her **Manager** reads 'Max Munk'.
    - A hollow yellow dot is before it.
    - Her **Manager assigned** reads the first day of last month, such as "Oct 1, 2026".
  - **Notes:**

- [ ] `C079` Select **Today** in the date row.
  - **Expected:**
    - Her **Manager** reads 'Max Munk', after a hollow yellow dot.
    - Her **Manager assigned** still reads the first day of last month.
  - **Notes:**

- [ ] `6C1C` In the date row, select the left arrow twice.
  - **Expected:** Her **Manager** reads 'Lorenza Thiel', with no dot.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### PEOPLE-TIME-06: A Role That Sees No Other Dates Has No Date Row

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from PEOPLE-TIME-05.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `BAB8` Read the top of the page.
  - **Expected:**
    - There is no date row.
    - Nothing says why it is missing.
    - The table starts right under the search box's row.
  - **Notes:**

### PEOPLE-TIME-07: A Person's Timeline

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from PEOPLE-TIME-06.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `D9D4` Select the name 'Carmine Labadie'.
  - **Expected:** His details open beside the table.
  - **Notes:**

- [ ] `1EA4` Scroll to the end of his details.
  - **Expected:** A **Timeline** section lists his latest change, then **Show timeline**.
  - **Notes:**

- [ ] `6160` Select **Show timeline**.
  - **Expected:**
    - The timeline opens under his details, with the cursor on its title.
    - A thin red line marked **Today** runs across it, with room above and below.
    - His days are listed newest first, each change on its own line, such as **Manager** and a name.
  - **Notes:**

- [ ] `4EC1` Select the date of the last day listed.
  - **Expected:**
    - The date row shows that day.
    - The day's row is marked, grey with a coloured bar at its left.
  - **Notes:**

- [ ] `FE5C` Select **Today** in the date row.
  - **Expected:** No row is marked.
  - **Notes:**

- [ ] `EAA2` Select the timeline's **×**.
  - **Expected:**
    - The timeline closes, and his details stay open.
    - The cursor is back on **Show timeline**.
  - **Notes:**
