---
title: "Manual Test: Checkbox Columns"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/db/migrations/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-25"
---

# Manual Test: Checkbox Columns

## Scope

Verifies what only a person can judge of Checkbox columns on the People table: how an added column's boxes look beside **Manager?**'s.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Reset the Database](manual-test-basics.md#reset-the-database).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the column menu. This test adds:

- **First aider cell:** a cell in the **First aider** column, which CHK-01 adds at the right end of the People table; scroll right to reach it.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### CHK-01: A Checkbox Column Is Added

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `D6B8` Select **New column**, type `First aider` in **Name**, choose **Checkbox** in **Type**, then select **Add column**.
  - **Expected:**
    - The dialog closes.
    - A **First aider** column is at the right end of the table, with a hollow yellow dot before its name.
    - Each of its cells holds an empty box.
  - **Notes:**

### CHK-02: A Ticked Box Reads Well

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as CHK-01.

**Preconditions:** As CHK-01, with the **First aider** column added.

- [ ] `91F4` Select the first row's First aider cell.
  - **Expected:**
    - The box is ticked, with a hollow yellow dot before it.
    - It is the same size and colour as a ticked box in the **Manager?** column.
  - **Notes:**

- [ ] `C0F3` Press Space.
  - **Expected:** The first row's box is empty again.
  - **Notes:**
