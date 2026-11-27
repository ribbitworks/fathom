---
title: "Manual Test: Text Columns"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/data/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-27"
---

# Manual Test: Text Columns

## Scope

Verifies what only a person can judge of a Text column on the People table: how a long text reads cut short in its cell and whole in the person's details, and that a screen reader reading a drafted cell far down the table stays at that cell.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out. TXT-03 also needs Safari on a Mac, with VoiceOver.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Reset the Database](manual-test-basics.md#reset-the-database).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the column menu. This test adds:

- **Directions cell:** a cell in the **Directions** column, which TXT-01 adds at the right end of the People table; scroll right to reach it.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### TXT-01: A Text Column Is Added

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `5E2A` Select **New column**, type `Directions` in **Name**, choose **Text** in **Type**, then select **Add column**.
  - **Expected:**
    - The dialog closes.
    - A **Directions** column is at the right end of the table, with a hollow yellow dot before its name.
    - Each of its cells is empty.
  - **Notes:**

### TXT-02: A Long Text Reads Well in the Cell and the Details

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as TXT-01.

**Preconditions:** As TXT-01, with the **Directions** column added.

- [ ] `B47D` Select the first row's Directions cell, type `Take the east stairs to the fourth floor, then the second door on the left past the kitchen`, then press Enter.
  - **Expected:**
    - The cell shows the text on one line, cut short where the column ends, with a hollow yellow dot before it.
    - The row is no taller than the rows around it.
    - The table doesn't scroll further right than its last column.
  - **Notes:**

- [ ] `0C93` Select the details button over the first row's **Name** cell.
  - **Expected:**
    - The details open beside the table.
    - Under **Columns**, **Directions** shows the whole text typed in `B47D`, ending with `past the kitchen`, none of it cut short.
  - **Notes:**

### TXT-03: A Screen Reader Stays at a Drafted Cell Far Down the Table

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as TXT-02.

**Preconditions:** As TXT-02, in Safari, with the first row's **Directions** holding the text TXT-02 saved. **People** page open from the left-hand menu.

- [ ] `3D5C` Scroll the table down to its last row, select that row's Directions cell, type `Lift to the roof`, then press Enter.
  - **Expected:** The cell shows `Lift to the roof` with a hollow yellow dot before it.
  - **Notes:**

- [ ] `9B17` Turn VoiceOver on with Cmd+F5, then select the same cell again.
  - **Expected:**
    - VoiceOver reads the cell's text, then that it is a draft.
    - The table stays scrolled to its last rows; it doesn't jump to its top.
  - **Notes:**

- [ ] `C42E` Press Ctrl+Option+Left arrow.
  - **Expected:** VoiceOver moves to the cell before it in the row, and the table stays where it was.
  - **Notes:**

- [ ] `6E09` Select the details button over the last row's **Name** cell, then, under **Columns**, move VoiceOver to **Directions**' value with Ctrl+Option+Right arrow.
  - **Expected:**
    - VoiceOver reads `Lift to the roof`, then that it is a draft.
    - The details stay scrolled to **Directions**; they don't jump to their top.
  - **Notes:**

- [ ] `A8F2` Turn VoiceOver off with Cmd+F5.
  - **Expected:** VoiceOver stops reading.
  - **Notes:**
