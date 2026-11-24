---
title: "Manual Test: Acceptance, Planning Projects"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/testing/acceptance/acceptance-hiring-and-who-sees-what-manual-test.md", "docs/help/working-as-a-product-manager.md", "docs/help/projects.md", "docs/product/roles.md"]
last_updated: "2026-11-24"
---

# Manual Test: Acceptance, Planning Projects

## Scope

Verifies that a Product Manager starts the plan on a new Fathom, as [Working as a Product Manager](../../help/working-as-a-product-manager.md) describes:

- The customers and projects pasted in from files, fixing the one row Fathom refuses.
- A proposal, a project's customer and its milestones added by hand.

Nothing is published yet: [Planning Features and a Release](acceptance-planning-features-and-a-release-manual-test.md) adds the rest of the plan and publishes it all at once.

## Test Environment

What [Hiring and Who Sees What](acceptance-hiring-and-who-sees-what-manual-test.md) left, run straight after it:

- Fathom running on its installation, at `https://localhost:10443`, in a browser window at least 1,440 pixels wide.
- The password list, open in a plain text editor.
- This test's files, in `docs/testing/acceptance/data/` in the clone: `customers.tsv` and `projects.tsv`. Each starts with a line naming its columns, which is never copied, and separates its columns with tabs.

## Test Accounts

[The Team's Accounts](acceptance-team-accounts-manual-test.md) made this account:

- **Product Manager:** `priya.lund@fathom.test`, shown in Fathom as `Priya Lund`, whose first sign-in is in this test, with the new password `fictional priya password`

## Common Procedures

This test uses [Change a Generated Password](../manual-test-basics.md#change-a-generated-password). [Start Again](../manual-test-basics.md#start-again) removes the installation, for a fresh run from [Installing Fathom](acceptance-installing-fathom-manual-test.md).

## Terms

[Manual Test Basics](../manual-test-basics.md#terms) defines the terms every test uses, such as marks, a row's slot, the side panel and the details button. This test adds:

- **Copy the rows of a file:** open the file named in the text editor, select every line but the first, and copy them.
- **Typed dates:** unlike the Basics' dates, this test's steps type dates as digits with no separators, such as `20300315`.
- **Empty row:** the row at the end of a table, with blank cells, where a new record is typed or pasted.

## Test Cases

Run the test cases in order, in about 25 minutes, straight after [Hiring and Who Sees What](acceptance-hiring-and-who-sees-what-manual-test.md). Check each step whose expected result you see, and write anything else under its notes. [Planning Features and a Release](acceptance-planning-features-and-a-release-manual-test.md) follows on from the last test case.

### PROJ-01: The Product Manager Signs In for the First Time

**Account:** Product Manager, `priya.lund@fathom.test`, changed from HIRING-05 in [Hiring and Who Sees What](acceptance-hiring-and-who-sees-what-manual-test.md); the first test case. The first step signs out the Engineering Director.

**Preconditions:** [Hiring and Who Sees What](acceptance-hiring-and-who-sees-what-manual-test.md) run just before.

- [ ] `E04B` Sign out from the account menu.
  - **Expected:** The **Sign in** page shows.
  - **Notes:**

- [ ] `D9FD` Sign in as the Product Manager, `priya.lund@fathom.test`, with the password beside it in the password list.
  - **Expected:** A page headed **Change password** shows, with no left-hand menu.
  - **Notes:**

- [ ] `1E96` Run Change a Generated Password, with the new password `fictional priya password`.
  - **Expected:**
    - Fathom opens on the **Overview**.
    - The top bar's right end shows `Priya Lund`.
  - **Notes:**

### PROJ-02: The Customers Are Pasted In

**Account:** Product Manager, `priya.lund@fathom.test`, the same as PROJ-01.

**Preconditions:** PROJ-01 done.

- [ ] `36C7` Select the **Projects** page in the left-hand menu.
  - **Expected:**
    - The **Projects** tab is chosen.
    - The table has only its empty row, and the count above it reads "0 projects".
  - **Notes:**

- [ ] `CAF4` Select the **Customers** tab.
  - **Expected:** The table has only its empty row.
  - **Notes:**

- [ ] `514D` Copy the rows of `customers.tsv`.
  - **Expected:** Three lines are selected in the text editor, from `Fictional Ferry Co-op` to `Fictional Pier Market`.
  - **Notes:**

- [ ] `BA79` In Fathom, select the **Name** cell of the empty row.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `CA7C` Paste.
  - **Expected:** `Fictional Ferry Co-op`, `Fictional Lighthouse Trust` and `Fictional Pier Market` are listed, each with a hollow yellow dot in its slot.
  - **Notes:**

### PROJ-03: The Projects Are Pasted In, and a Refused Row Is Fixed

**Account:** Product Manager, `priya.lund@fathom.test`, the same as PROJ-02.

**Preconditions:** PROJ-02 done.

- [ ] `BF5C` Select the **Projects** tab.
  - **Expected:** The table has only its empty row.
  - **Notes:**

- [ ] `F511` Copy the rows of `projects.tsv`.
  - **Expected:** Three lines are selected in the text editor, from `Fictional Lamp Room` to `Fictional Pier Lights`.
  - **Notes:**

- [ ] `F024` In Fathom, select the **Name** cell of the empty row.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `11BF` Paste.
  - **Expected:**
    - Three rows are shown, one for each line, none of them with a dot.
    - `Fictional Lamp Room` reads `FLR-1` in **Project ID** and `Ada Quill` in **Owner**.
    - `Fictional Tide Gauge` reads `FTG-1` in **Project ID** and `Dara Finch` in **Owner**.
    - Under the row of `Fictional Pier Lights`, red text reads "No Owner called Odile Brant", and its **Owner** cell is empty.
  - **Notes:**

- [ ] `0A67` Select the **Owner** cell of `Fictional Pier Lights`, type `Odile`, choose `Odile Brandt`, and press Enter.
  - **Expected:**
    - No red text shows.
    - The **Owner** cell of `Fictional Pier Lights` reads `Odile Brandt`.
    - Each of the three rows has a hollow yellow dot in its slot.
    - The count reads "3 projects".
  - **Notes:**

### PROJ-04: A Proposal Is Added by Hand

**Account:** Product Manager, `priya.lund@fathom.test`, the same as PROJ-03.

**Preconditions:** PROJ-03 done.

- [ ] `70EA` Select the **Proposals** tab.
  - **Expected:** The table has only its empty row.
  - **Notes:**

- [ ] `8EC4` Select **New proposal**.
  - **Expected:** The side panel opens, headed **New proposal**.
  - **Notes:**

- [ ] `95D8` Type `Fictional Harbour Bid` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `C86D` Select the change button in the **Customers** row, and pick `Fictional Lighthouse Trust`.
  - **Expected:** **Customers** shows `Fictional Lighthouse Trust`.
  - **Notes:**

- [ ] `487F` Select **Add**.
  - **Expected:**
    - The side panel is headed with a hollow yellow dot before `Fictional Harbour Bid`.
    - **Status** reads "Open".
  - **Notes:**

### PROJ-05: A Project Is Given Its Customer and Milestones

**Account:** Product Manager, `priya.lund@fathom.test`, the same as PROJ-04.

**Preconditions:** PROJ-04 done.

- [ ] `5B14` Select the **Projects** tab.
  - **Expected:** The three projects are listed.
  - **Notes:**

- [ ] `399B` Select the details button at the right of the **Name** cell of `Fictional Lamp Room`.
  - **Expected:**
    - The side panel is headed with a hollow yellow dot before `Fictional Lamp Room`.
    - Under **Milestones**, "None" and an **Add milestone** button.
  - **Notes:**

- [ ] `53B8` Select the change button in the **Customers** row, and pick `Fictional Ferry Co-op`.
  - **Expected:** **Customers** shows `Fictional Ferry Co-op`.
  - **Notes:**

- [ ] `94A7` Select **Add milestone**.
  - **Expected:** A dialog titled "New milestone" opens.
  - **Notes:**

- [ ] `F938` Type `Lamp trial` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `011F` Type `20300315` in **Date**.
  - **Expected:** **Date** shows the date typed.
  - **Notes:**

- [ ] `6DCE` Tick **Customer delivery**.
  - **Expected:** **Customer delivery** is ticked.
  - **Notes:**

- [ ] `C814` Select **Add milestone** in the dialog.
  - **Expected:**
    - Under **Milestones**, a hollow yellow dot before `Lamp trial`.
    - Under `Lamp trial`, the date for `2030-03-15` and ", customer delivery".
  - **Notes:**

- [ ] `45E2` Select **Add milestone**.
  - **Expected:** A dialog titled "New milestone" opens.
  - **Notes:**

- [ ] `6D01` Type `Lamps lit` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `25FE` Type `20300630` in **Date**.
  - **Expected:** **Date** shows the date typed.
  - **Notes:**

- [ ] `D763` Leave **Customer delivery** unticked, and select **Add milestone** in the dialog.
  - **Expected:**
    - `Lamps lit` is listed after `Lamp trial`.
    - **First milestone** shows March 15, 2030.
    - **Last milestone** shows June 30, 2030.
    - **Next delivery** shows March 15, 2030.
  - **Notes:**

**Afterwards:** Run [Planning Features and a Release](acceptance-planning-features-and-a-release-manual-test.md) next, staying signed in, without publishing. To stop here instead, run [Start Again](../manual-test-basics.md#start-again).
