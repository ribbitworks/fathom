---
title: "Manual Test: Built-in Lists and Lists with Meanings"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/db/migrations/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-07"
---

# Manual Test: Built-in Lists and Lists with Meanings

## Scope

Verifies the Lists page's built-in lists, Positions and Hiring states: their mark, the line telling those who may change them that they are theirs to change, the switch that narrows the table to built-in or custom lists, changing their visibility, which sets who sees the Position column, each hiring state's meaning, giving new choices a meaning, and the rules that keep a choice offered for every meaning, when drafting and when approving.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R2).

## Test Accounts

R2 creates these accounts, with every other development account. They share one password, which R2 prints when it finishes. Every account holds its role as Fathom starts it.

- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It holds the Workforce Administrator role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Engineering Director account:** `engineering.director@fathom.test`, shown in Fathom as **Engineering Director**. It holds the Engineering Director role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Resource Planner account:** `resource.planner@fathom.test`, shown in Fathom as **Resource Planner**. It holds the Resource Planner role, as [Roles](../product/roles.md#starting-roles) sets out.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at the address the terminal prints, such as `https://localhost:8443`, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R2: Reset the Database

Use before the first test case and after the last, so every list and role is as Fathom starts it. This deletes every account and record in the development database, including anything added by hand, and puts every role back as Fathom starts it; restoring only the seed data does not. Ask the owner before running it on a database others use.

1. Stop Fathom: press Ctrl+C in the first terminal.
2. In the second terminal, run:

   ```sh
   pnpm db:reset && pnpm db:seed
   ```

3. Confirm that the last line printed gives the shared password, with no error above it.
4. Start Fathom again (R0).

## Terms

- **Panel:** the area that opens beside the table of lists when you select a list's name, showing the list's choices.
- **Empty row:** the last row of the panel's choices, starting with a **+**, where new choices are typed.
- **Meaning menu:** the drop-down at the end of a choice's row while it is being edited, and at the end of the empty row.
- **⋯ menu:** the menu that opens from the **⋯** button at the end of a choice's row.
- **Publish button:** the button in the top bar, beside your name, that reads **Publish** followed by a number of changes.

## Test Cases

Run the test cases in order. Start with R2. Check each step whose expected result you see, and write anything else under its notes.

### LIST-01: Built-in Lists Are Marked

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Lists** page open from the left-hand menu.

- [ ] **Step 1.** Read the **Name** column of the **Hiring states** and **Positions** rows.
  - **Expected:** Each name has a grey **Built in** label beside it. No other list has one.
  - **Notes:**

- [ ] **Step 2.** Select **Positions**.
  - **Expected:** The panel opens with **Positions** at the top and **Built in** beside it. Under the choices, in grey, it reads three lines: **Rename these, add your own, or retire any you don't use.**, **Every person and planned hire has one of these positions.** and **Keep at least one.**
  - **Notes:**

- [ ] **Step 3.** Select **Hiring states**.
  - **Expected:** The panel opens with **Hiring states** at the top and **Built in** beside it. No description is shown under the name. Under the choices, in grey, it reads four lines: **Rename these, add your own, or retire any you don't use.**, **Proposed: the request to hire is not yet approved.**, **Open: the request to hire is approved.** and **Keep at least one choice for each.**
  - **Notes:**

### LIST-02: Each Hiring State Shows Its Meaning

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as LIST-01.

**Preconditions:** As LIST-01, with the **Hiring states** panel open.

- [ ] **Step 1.** Read each choice's row in the panel.
  - **Expected:** **Request to hire** shows **Proposed** at the end of its row. **Approved to hire** shows **Open** at the end of its row.
  - **Notes:**

### LIST-03: A New Choice Takes the Meaning Chosen

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as LIST-02.

**Preconditions:** As LIST-01, with the **Hiring states** panel open.

- [ ] **Step 1.** In the empty row's meaning menu, choose **Open**. Type **Fictional Interviewing** in the empty row's **Name** box and press Enter.
  - **Expected:** A row **Fictional Interviewing** appears above the empty row, with a hollow yellow dot and **Draft: added**, and **Open** at the end of the row. The empty row is empty again and its meaning menu still reads **Open**.
  - **Notes:**

### LIST-04: The Last Choice for a Meaning Is Kept

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as LIST-03.

**Preconditions:** As LIST-03.

- [ ] **Step 1.** Select the **⋯** button at the end of the **Request to hire** row.
  - **Expected:** **Retire** and **Remove** are greyed out, with **Needed for Proposed** under them.
  - **Notes:**

### LIST-05: A Choice Can Be Retired When Another Has the Same Meaning

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as LIST-04.

**Preconditions:** As LIST-04.

- [ ] **Step 1.** Press Esc. Select the **⋯** button at the end of the **Approved to hire** row, then select **Retire**.
  - **Expected:** The **Approved to hire** row stays where it is, with a hollow yellow dot and **Draft: retired**.
  - **Notes:**

- [ ] **Step 2.** Select the Publish button.
  - **Expected:** A notice says the changes were published. The Publish button is gone from the top bar.
  - **Notes:**

### LIST-06: Approving Cannot Leave a Meaning With No Choice

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from LIST-05.

**Preconditions:** LIST-05 done. Signed in with this account. **Lists** page open, with the **Hiring states** panel open.

- [ ] **Step 1.** Select the **⋯** button at the end of the **Approved to hire** row, then select **Approve…**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 2.** Select **Approve**.
  - **Expected:** The dialog stays open and reads **This would leave Hiring states with no choice that means Open.**
  - **Notes:**

- [ ] **Step 3.** Select **Cancel**.
  - **Expected:** The dialog closes. The **Approved to hire** row still has a yellow dot and **Draft: retired**.
  - **Notes:**

### LIST-07: Positions' Visibility Sets Who Sees the Position Column

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from LIST-06. Steps 3, 4 and 5 sign in as other accounts.

**Preconditions:** LIST-06 done. Signed in with this account. **Lists** page open, with the **Positions** panel open.

- [ ] **Step 1.** Select **Edit list**. Under **Visible to**, select **Restricted**, then select **Save**.
  - **Expected:** The dialog closes. **Positions** has a hollow yellow dot beside its name.
  - **Notes:**

- [ ] **Step 2.** Select the Publish button.
  - **Expected:** A notice says the changes were published.
  - **Notes:**

- [ ] **Step 3.** Sign in as the Engineering Director, `engineering.director@fathom.test`. Open the **Lists** page and select **Positions**. Select the **⋯** button beside **Edit list**, then select **Approve…**, then **Approve**.
  - **Expected:** The dialog closes, and the dot beside **Positions** is gone.
  - **Notes:**

- [ ] **Step 4.** Sign in as the Resource Planner, `resource.planner@fathom.test`. Open the **People** page.
  - **Expected:** The table has no **Position** column.
  - **Notes:**

- [ ] **Step 5.** Sign in as the Workforce Administrator, `engineering.operations.manager@fathom.test`. Open the **People** page.
  - **Expected:** The table has a **Position** column, and **New person** can be selected.
  - **Notes:**

- [ ] **Step 6.** Reset the database (R2).
  - **Expected:** The last line printed gives the shared password, with no error above it.
  - **Notes:**

### LIST-08: The Lists Shown Can Be Narrowed to Built-in or Custom Ones

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as the account LIST-07 ended with.

**Preconditions:** LIST-07 done, so the database is as R2 leaves it. Signed in with this account. **Lists** page open from the left-hand menu, with no list's panel open.

- [ ] **Step 1.** In the switch beside **Search lists**, select **Built in**.
  - **Expected:** The table shows only **Hiring states** and **Positions**, and the count reads **2 of 9**.
  - **Notes:**
