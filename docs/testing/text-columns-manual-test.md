---
title: "Manual Test: Text Columns"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/data/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-26"
---

# Manual Test: Text Columns

## Scope

Verifies what only a person can judge of a Text column of several lines on the People table: how its text reads on one line in its cell, and whole in the person's details, where its box grows as lines are typed; and that a screen reader reading a drafted cell far down the table stays at that cell.

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

### TXT-01: A Text Column of Several Lines Is Added

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `5E2A` Select **New column**, type `Directions` in **Name**, choose **Text** in **Type**, tick **Several lines**, then select **Add column**.
  - **Expected:**
    - The dialog closes.
    - A **Directions** column is at the right end of the table, with a hollow yellow dot before its name.
    - Each of its cells is empty.
  - **Notes:**

### TXT-02: Several Lines Read Well in the Cell and the Details

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as TXT-01.

**Preconditions:** As TXT-01, with the **Directions** column added.

- [ ] `B47D` Select the first row's Directions cell, type `Take the east stairs to the fourth floor`, press Shift+Enter, type `Second door on the left`, then press Enter.
  - **Expected:**
    - The cell shows the text on one line, cut short where the column ends, with a hollow yellow dot before it.
    - The row is no taller than the rows around it.
  - **Notes:**

- [ ] `0C93` Select the details button over the first row's **Name** cell.
  - **Expected:**
    - The details open beside the table.
    - Under **Columns**, **Directions** shows `Take the east stairs to the fourth floor` on one line and `Second door on the left` on the next.
  - **Notes:**

- [ ] `E81F` Select the pencil beside **Directions**, press Ctrl+End, or Cmd+Down arrow on a Mac, then press Shift+Enter twice.
  - **Expected:**
    - The box grows a line taller with each new line, showing every line without a scroll bar.
    - The × at the box's right stays level with its first line.
  - **Notes:**

- [ ] `7A60` Press Esc.
  - **Expected:** The box closes, and **Directions** shows the two lines as before.
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
