---
title: "Manual Test: Remembered Views"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md"]
last_updated: "2026-11-20"
---

# Manual Test: Remembered Views

## Scope

Verifies that a page shows the view it last showed when it is opened again from the left-hand menu, in another browser too, with its tab and its Table or Board choice, and that a link naming a view, and Clear view, change what it shows next time.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A second browser, or a private window, for signing in to the same account a second time.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Feature Lead:** `feature.lead@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses. This test adds:

- **Main window:** the browser window the test starts in.
- **Second window:** the second browser or private window.
- **Table and Board switch:** the two-part switch reading **Table** and **Board** just after the **Features** heading.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### MEMO-01: A Page Shows Its Last View Again

**Account:** Feature Lead, `feature.lead@fathom.test`, the first account of this test.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account in the main window. Select the **People** page in the left-hand menu.

- [ ] `3B71` Type `Patel-Singh` in the search box above the table.
  - **Expected:** Only the row of 'Tanushree Patel-Singh' shows.
  - **Notes:**

- [ ] `9E04` Select the **Org chart** page in the left-hand menu, then the **People** page.
  - **Expected:**
    - The search box above the table holds `Patel-Singh`.
    - Only the row of 'Tanushree Patel-Singh' shows.
  - **Notes:**

- [ ] `C6A8` Select the **Projects** page in the left-hand menu, then the **Proposals** tab beside the **Projects** heading.
  - **Expected:** The **Proposals** tab is chosen, and its table shows.
  - **Notes:**

- [ ] `52DF` Select the **People** page in the left-hand menu, then the **Projects** page.
  - **Expected:** The **Proposals** tab is chosen, and its table shows.
  - **Notes:**

- [ ] `E1B9` Select the **Features** page in the left-hand menu, then **Board** in the Table and Board switch.
  - **Expected:** **Board** is chosen, and the features show as cards in columns.
  - **Notes:**

- [ ] `7A3C` Select the **People** page in the left-hand menu, then the **Features** page.
  - **Expected:** **Board** is chosen, and the features show as cards in columns.
  - **Notes:**

### MEMO-02: The Last View Follows the Account to Another Browser

**Account:** Feature Lead, `feature.lead@fathom.test`, the same account as MEMO-01.

**Preconditions:** MEMO-01 has been run.

- [ ] `D407` In the second window, sign in as Feature Lead, `feature.lead@fathom.test`, and select the **People** page in the left-hand menu.
  - **Expected:**
    - The search box above the table holds `Patel-Singh`.
    - Only the row of 'Tanushree Patel-Singh' shows.
  - **Notes:**

### MEMO-03: A Link Naming a View Wins, and Clear View Starts Afresh

**Account:** Feature Lead, `feature.lead@fathom.test`, the same account as MEMO-02.

**Preconditions:** MEMO-02 has been run. In the main window, select the **People** page in the left-hand menu; its search box holds `Patel-Singh`.

- [ ] `0F5E` In the main window, copy the whole address from the browser's address bar.
  - **Expected:** Nothing changes on the page.
  - **Notes:**

- [ ] `A86B` Open the **Views** menu above the table and select **Clear view**.
  - **Expected:**
    - The search box above the table is empty.
    - Every person's row shows.
  - **Notes:**

- [ ] `4C92` Select the **Org chart** page in the left-hand menu, then the **People** page.
  - **Expected:**
    - The search box above the table is empty.
    - Every person's row shows.
  - **Notes:**

- [ ] `B37E` Paste the copied address into the browser's address bar and press Enter.
  - **Expected:**
    - The search box above the table holds `Patel-Singh`.
    - Only the row of 'Tanushree Patel-Singh' shows.
  - **Notes:**

- [ ] `65F0` Select the **Org chart** page in the left-hand menu, then the **People** page.
  - **Expected:**
    - The search box above the table holds `Patel-Singh`.
    - Only the row of 'Tanushree Patel-Singh' shows.
  - **Notes:**

**Afterwards:** Open the **Views** menu above the table and select **Clear view**.
