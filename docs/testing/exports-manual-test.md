---
title: "Manual Test: Exports"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**"]
dependencies: ["docs/standards/testing.md", "docs/design/visual-design.md", "docs/product/decisions.md"]
last_updated: "2026-11-14"
---

# Manual Test: Exports

## Scope

Verifies what only a person can judge of exporting a table: the Export menu, the question asked before exporting Personal data, and how a saved file reads when opened in a spreadsheet.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, and a spreadsheet application, such as Excel, Numbers or LibreOffice Calc, to open the files saved.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Engineering Director:** `engineering.director@fathom.test`, who sees Personal and Confidential data
- **Administrator:** `fathom.administrator@fathom.test`, shown in Fathom as "Fathom Administrator", who sees the access history
- **Product Manager:** `product.manager@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses. This test adds:

- **Export button:** the button showing an arrow pointing down onto a line, at the right of the page's heading, before the page's main button, such as **New person**. Pointing at it shows **Export**.
- **Save dialog:** the browser's own dialog asking where to save a file. Chrome and Edge always open it for an export; Safari and Firefox open it only when their settings ask before each download, and otherwise save to the Downloads folder. Safari may first ask "Do you want to allow downloads on "localhost"?"; select **Allow**.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out. Run EXP-01 in Chrome or Edge, and EXP-02 in Safari or Firefox where one is at hand.

### EXP-01: Exporting Personal and Confidential Data Asks First and Is Recorded

**Account:** Engineering Director, `engineering.director@fathom.test`; the first test case. Step `D942` signs in as another account.

**Preconditions:** Signed in with this account, in Chrome or Edge. **People** page open from the left-hand menu.

- [ ] `80D3` Select the Export button.
  - **Expected:** A menu opens listing **CSV file** and **TSV file**.
  - **Notes:**

- [ ] `BA09` Choose **CSV file**.
  - **Expected:**
    - A dialog titled "Export Confidential and Personal data?" opens.
    - It reads "This file holds Confidential data (Hiring plan) and Personal data (", the columns holding Personal data, including **Start** and **End**, then ")."
    - **Confidential** is in red and **Personal** in orange, both in semibold, and the column names are in semibold.
    - It offers **Cancel** and **Export**.
  - **Notes:**

- [ ] `C4A6` Press Esc.
  - **Expected:** The dialog closes, and no Save dialog opens.
  - **Notes:**

- [ ] `3D75` Choose **CSV file** from the Export button's menu.
  - **Expected:** The same dialog opens.
  - **Notes:**

- [ ] `F3D0` Select **Export**.
  - **Expected:** The Save dialog opens, with the name `fathom_people_engineering-director_drafts-and-live_` and today's date, such as `fathom_people_engineering-director_drafts-and-live_2027-03-31.csv`.
  - **Notes:**

- [ ] `65AA` Select **Save** in the Save dialog.
  - **Expected:** The export dialog closes, and the file is saved where chosen.
  - **Notes:**

- [ ] `24E9` Open the file in the spreadsheet application.
  - **Expected:**
    - The first row holds the column headings: **Row**, **Change**, then the People table's columns, in the order it shows them.
    - '西尾 亮', who has a draft, is on two rows: the first with "Draft" in **Row** and "Changed" in **Change**, the second with "Live" in **Row**.
    - A person without a draft is on one row, with **Row** and **Change** empty.
    - Names in other scripts, such as '西尾 亮', read as they do in Fathom.
    - Start and End dates read as digits, such as "2027-03-31", or as the spreadsheet shows dates.
    - Each Onboarding note is in one cell, its lines kept.
  - **Notes:**

- [ ] `D942` Sign out, and sign in as the Administrator, `fathom.administrator@fathom.test`.
  - **Expected:** Fathom opens for the Administrator.
  - **Notes:**

- [ ] `55F5` Select the **Access history** page in the left-hand menu.
  - **Expected:**
    - The newest entry reads "Fathom Administrator (`fathom.administrator@fathom.test`) signed in: as Administrator".
    - The entry under it reads "Engineering Director (`engineering.director@fathom.test`) exported People with Confidential data (Hiring plan) and Personal data (", the columns holding Personal data, including **Start** and **End**, then ")".
  - **Notes:**

### EXP-02: Exporting General Data Saves at Once

**Account:** Product Manager, `product.manager@fathom.test`, changed from EXP-01.

**Preconditions:** Signed in with this account. **Features** page open from the left-hand menu.

- [ ] `C2BF` Choose **TSV file** from the Export button's menu.
  - **Expected:**
    - No question from Fathom opens.
    - The browser saves a file named `fathom_features_product-manager_drafts-and-live_` and today's date, such as `fathom_features_product-manager_drafts-and-live_2027-03-31.tsv`, or first opens the Save dialog with that name.
  - **Notes:**

- [ ] `73A6` Open the file in the spreadsheet application.
  - **Expected:**
    - Each column is in a column of its own, headed as on the Features table, after **Row** and **Change**, with **Effort** followed by its unit, such as **Effort (h)**.
    - Effort cells hold numbers alone, without a unit.
    - Cells naming several customers or projects list them separated by `;`.
    - **Notes** cells hold the notes' words without formatting.
  - **Notes:**

### EXP-03: Live Only Says What Waits

**Account:** Product Manager, `product.manager@fathom.test`, the same as EXP-02.

**Preconditions:** **Features** page open from the left-hand menu.

- [ ] `84E6` Choose **Live only** in the Draft menu.
  - **Expected:** The table shows no draft rows.
  - **Notes:**

- [ ] `626C` Choose **CSV file** from the Export button's menu.
  - **Expected:** The browser saves a file named `fathom_features_product-manager_` and today's date, without `drafts`, or first opens the Save dialog with that name.
  - **Notes:**

- [ ] `6DE4` Open the file in the spreadsheet application.
  - **Expected:**
    - Every row has "Live" in **Row**.
    - A feature with a green dot on the table has words in **Change**, such as "A change is waiting for approval."
  - **Notes:**
