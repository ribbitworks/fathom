---
title: "Manual Test: Built-in Lists and Lists with Meanings"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/db/migrations/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-05"
---

# Manual Test: Built-in Lists and Lists with Meanings

## Scope

Verifies the Lists page's built-in lists, Positions and Hiring states: their mark, the dialog that cannot retire or delete them or change their visibility, each hiring state's meaning, giving new choices a meaning, and the rules that keep a choice offered for every meaning, when drafting and when approving.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R2).

## Test Accounts

R2 creates these accounts, with every other development account. They share one password, which R2 prints when it finishes. Every account holds its roles as Fathom starts them.

- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It can change lists, and its changes are drafts; it cannot approve them.
- **Approver account:** `engineering.director@fathom.test`, shown in Fathom as **Engineering Director**. It can approve and reject drafts.

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

### P1: Sign In

1. If someone is signed in, sign out first (P2).
2. On the **Sign in** page, enter the account's email address and the shared password.
3. Select **Sign in**.

### P2: Sign Out

1. Select the account button at the top right, which shows the account's name.
2. Select **Sign out**.

## Terms

- **Panel:** the area that opens beside the table of lists when you select a list's name, showing the list's choices.
- **Empty row:** the last row of the panel's choices, starting with a **+**, where new choices are typed.
- **Meaning menu:** the drop-down at the end of a choice's row while it is being edited, and at the end of the empty row.
- **⋯ menu:** the menu that opens from the **⋯** button at the end of a choice's row.
- **Publish button:** the button in the top bar, beside your name, that reads **Publish** followed by a number of changes.

## Test Cases

Run the test cases in order. Start with R2. Check each step whose expected result you see, and write anything else under its notes.

### LIST-01: Built-in Lists Are Marked

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **Lists** page open from the left-hand menu.

- [ ] **Step 1.** Read the **Name** column of the **Hiring states** and **Positions** rows.
  - **Expected:** Each name has a grey **Built in** label beside it. No other list has one.
  - **Notes:**

- [ ] **Step 2.** Read the **Choices** column of the **Positions** row.
  - **Expected:** It starts with **Employee, Manager**.
  - **Notes:**

- [ ] **Step 3.** Select **Positions**.
  - **Expected:** The panel opens with **Positions** at the top and **Built in** beside it. Under the choices, in grey, it reads **Every person and planned hire has one of these positions.** and, on the next line, **Keep at least one.**
  - **Notes:**

- [ ] **Step 4.** Select **Hiring states**.
  - **Expected:** The panel opens with **Hiring states** at the top and **Built in** beside it. No description is shown under the name. Under the choices, in grey, it reads three lines: **Proposed: the request to hire is not yet approved.**, **Open: the request to hire is approved.** and **Keep at least one choice for each.**
  - **Notes:**

### LIST-02: A Built-in List Cannot Be Retired or Deleted, and Keeps Its Visibility

**Preconditions:** As LIST-01, with the **Hiring states** panel open.

- [ ] **Step 1.** Select **Edit list** at the top of the panel.
  - **Expected:** A dialog titled **Edit list** opens. Under **Visible to**, **Confidential** is selected and every choice is greyed out, with **Visible to whoever can see the column that uses this list** under them. There is no **Retire list** or **Delete list** button.
  - **Notes:**

- [ ] **Step 2.** Select **Cancel**.
  - **Expected:** The dialog closes.
  - **Notes:**

### LIST-03: Each Hiring State Shows Its Meaning

**Preconditions:** As LIST-02.

- [ ] **Step 1.** Read each choice's row in the panel.
  - **Expected:** **Request to hire** shows **Proposed** at the end of its row. **Approved to hire** shows **Open** at the end of its row.
  - **Notes:**

- [ ] **Step 2.** Read the meaning menu at the end of the empty row.
  - **Expected:** It reads **Proposed**.
  - **Notes:**

### LIST-04: A New Choice Takes the Meaning Chosen

**Preconditions:** As LIST-02.

- [ ] **Step 1.** In the empty row's meaning menu, choose **Open**. Type **Fictional Interviewing** in the empty row's **Name** box and press Enter.
  - **Expected:** A row **Fictional Interviewing** appears above the empty row, with a hollow yellow dot and **Draft: added**, and **Open** at the end of the row. The empty row is empty again and its meaning menu still reads **Open**.
  - **Notes:**

- [ ] **Step 2.** Type **Fictional Budgeted** in the empty row's **Name** box, then select the heading **Hiring states** at the top of the panel.
  - **Expected:** A row **Fictional Budgeted** appears, with a hollow yellow dot and **Draft: added**, and **Open** at the end of the row.
  - **Notes:**

- [ ] **Step 3.** Select the **⋯** button at the end of the **Fictional Budgeted** row, then select **Remove**.
  - **Expected:** The **Fictional Budgeted** row is gone.
  - **Notes:**

### LIST-05: The Last Choice for a Meaning Is Kept

**Preconditions:** As LIST-04.

- [ ] **Step 1.** Select the **⋯** button at the end of the **Request to hire** row.
  - **Expected:** **Retire** and **Remove** are greyed out, with **Needed for Proposed** under them.
  - **Notes:**

- [ ] **Step 2.** Press Esc. Select the word **Proposed** at the end of the **Request to hire** row.
  - **Expected:** The row opens for editing with the cursor in its name. The meaning menu reads **Proposed** and is greyed out, with **Needed for Proposed** under it.
  - **Notes:**

- [ ] **Step 3.** Press Esc.
  - **Expected:** The row closes, unchanged.
  - **Notes:**

### LIST-06: A Choice Can Be Retired When Another Has the Same Meaning

**Preconditions:** As LIST-05.

- [ ] **Step 1.** Select the **⋯** button at the end of the **Approved to hire** row.
  - **Expected:** **Retire** and **Remove** can be selected.
  - **Notes:**

- [ ] **Step 2.** Select **Retire**.
  - **Expected:** The **Approved to hire** row stays where it is, with a hollow yellow dot and **Draft: retired**.
  - **Notes:**

- [ ] **Step 3.** Select the Publish button.
  - **Expected:** A notice says the changes were published. The Publish button is gone from the top bar.
  - **Notes:**

### LIST-07: Approving Cannot Leave a Meaning With No Choice

**Preconditions:** LIST-06 done. Signed in (P1) as `engineering.director@fathom.test`. **Lists** page open, with the **Hiring states** panel open.

- [ ] **Step 1.** Select the **⋯** button at the end of the **Approved to hire** row, then select **Approve…**.
  - **Expected:** A dialog titled **Approve 1 draft?** opens.
  - **Notes:**

- [ ] **Step 2.** Select **Approve**.
  - **Expected:** The dialog stays open and reads **This would leave Hiring states with no choice that means Open.**
  - **Notes:**

- [ ] **Step 3.** Select **Cancel**.
  - **Expected:** The dialog closes. The **Approved to hire** row still has a yellow dot and **Draft: retired**.
  - **Notes:**

- [ ] **Step 4.** Reset the database (R2).
  - **Expected:** The last line printed gives the shared password, with no error above it.
  - **Notes:**
