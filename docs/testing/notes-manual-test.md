---
title: "Manual Test: Note Columns on People"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/shared/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/product/decisions.md"]
last_updated: "2026-11-07"
---

# Manual Test: Note Columns on People

## Scope

Verifies what only a person can judge of Note columns on the People table: how the note's side panel looks, slides and resizes, writing a note with the toolbar, how headings and checkboxes look, switching between the editor and Markdown, pasting from another app, colours in light and dark mode, the keyboard and focus, the panel's place beside the Metrics panel, and the journey from writing a note to reading it, approving it, and finding it in the change history.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser, and a word processor or web page to copy formatted text from.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1).

## Test Accounts

R1 creates these accounts, with every other development account, so they exist once R1 has run. They share one password, which R1 prints when it finishes.

- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It holds the Workforce Administrator role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Engineering Director account:** `engineering.director@fathom.test`, shown in Fathom as **Engineering Director**. It holds the Engineering Director role, as [Roles](../product/roles.md#starting-roles) sets out.
- **Resource Planner account:** `resource.planner@fathom.test`, shown in Fathom as **Resource Planner**. It holds the Resource Planner role, as [Roles](../product/roles.md#starting-roles) sets out.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at the address `pnpm dev` prints, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R1: Restore the Seed Data

Use after R0, before the first test case. Fathom keeps running. This removes the seed data and every draft of it, then adds the seed data again; it keeps accounts and anything else added by hand, such as a column added in an earlier run of this test.

1. In the second terminal, run:

   ```sh
   pnpm db:unseed && pnpm db:seed
   ```

2. Confirm that the last line printed gives the shared password, with no error above it.
3. Reload the browser page.

### P1: Publish

1. Select the **Publish** button in the top bar, followed by the number of changes waiting.
2. Confirm that a notification says **Published**, and that the button is gone.

## Terms

- **Appearance menu:** the choices **System**, **Light** and **Dark** under **Appearance**, in the menu that opens from your name and initials at the top right of every page.
- **Search for:** type the person's name in the search box above the People table, so only their row is shown.
- **Panel:** the side panel that opens beside the table from a **Background** cell, headed **Background**.
- **Toolbar:** the row of buttons under the text in the panel's editor, for headings 1 to 3, bold, italic, strikethrough, code, colour, bullet list, checkbox list, link, and removing a link.

## Test Cases

Run the test cases in order, in about 30 minutes. Start with R0, then R1. Check each step whose expected result you see, and write anything else under its notes. To run the test again, delete the **Background** column first from its column menu, and approve the deletion.

### NOTE-01: A Note Column Is Added

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case. Step 2 signs in as another account.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] **Step 1.** Select **New column**. Type `Background` in **Name**, choose **Note** in **Type**, leave **General** chosen, select **Add column**, then publish (P1).
  - **Expected:** A **Background** column is at the end of the table, its name marked **Draft: added**.
  - **Notes:**

- [ ] **Step 2.** Sign in as the Engineering Director, `engineering.director@fathom.test`. Open **Drafts** from the left-hand menu and approve the **Background** column.
  - **Expected:** A notification says the draft is approved.
  - **Notes:**

### NOTE-02: A Note Is Written in Its Panel

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from NOTE-01.

**Preconditions:** Signed in with this account. Run after NOTE-01. **People** page open, with **Max Munk** searched for.

- [ ] **Step 1.** Select Max Munk's **Background** cell.
  - **Expected:** The panel slides in smoothly from the right over the table, which then has room beside it, with no jump. It is headed **Background**, with **Note**, **Editor** and **Markdown** at the top, **Editor** chosen, the note's text under them, the toolbar under the text, and **Clear**, **Cancel** and **Save** at the bottom. It looks like the Metrics panel.
  - **Notes:**

- [ ] **Step 2.** Drag the panel's left edge to the left, then to the right.
  - **Expected:** The panel widens and narrows, and the table beside it stays usable.
  - **Notes:**

- [ ] **Step 3.** Type `Joined from the platform team`. Make `Joined` bold and `platform` teal from the toolbar. Press Enter, start a bullet list, and type `Mentor: Lilian`, Enter, `Speaks Japanese`. Make `Lilian` a link to `wiki.example.test/lilian` with the toolbar's link button. Then click in `Lilian`, press the link button again, and change the text to show to `Lilian Lang`.
  - **Expected:** Each format shows as you apply it, and the toolbar's buttons are clear about what they do. The link button opens the same form as a Web link cell's, under the button.
  - **Notes:**

- [ ] **Step 4.** Press Enter twice to leave the list, type `Plans`, and make it heading 2. Press Enter, start a checkbox list, and type `Meet the team`, Enter, `Set goals`. Tick the box before **Meet the team**.
  - **Expected:** **Plans** reads as a heading, and the checkboxes line up with their text.
  - **Notes:**

- [ ] **Step 5.** Select **Note**, **Markdown**, then **Editor**, a few times, then **Note**, and click the link.
  - **Expected:** The text starts in the same place in every view, so nothing jumps, and the note reads the same each time. On **Note**, the link reads **Lilian Lang** and opens the wiki page in a new tab.
  - **Notes:**

- [ ] **Step 6.** Select **Save**.
  - **Expected:** The panel slides out smoothly to the right over the table, which is already full width, with no jump. The cell shows the note's words on one line, cut short where they do not fit, and the row is marked **Draft**.
  - **Notes:**

### NOTE-03: Text Is Pasted From Another App

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as NOTE-02.

**Preconditions:** Signed in with this account. Run after NOTE-02. **People** page open, with **Lilian Lang** searched for.

- [ ] **Step 1.** In a word processor or web page, copy a passage holding a heading, bold text, highlighted text, a numbered list, a table, and an image. Select Lilian Lang's **Background** cell and paste it into the editor.
  - **Expected:** The heading and bold stay, highlighting and the image are gone, and the numbered list becomes a bullet list. What is left reads sensibly.
  - **Notes:**

- [ ] **Step 2.** Select **Clear**, then **Cancel**.
  - **Expected:** The note empties, the panel stays open until **Cancel**, and Lilian Lang's cell is still empty.
  - **Notes:**

### NOTE-04: Notes Read Well and Work From the Keyboard

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as NOTE-03.

**Preconditions:** Signed in with this account. Run after NOTE-03. **Light** chosen in the Appearance menu. **People** page open, with **Max Munk** searched for.

- [ ] **Step 1.** Using only the keyboard, move to Max Munk's **Background** cell and press Enter.
  - **Expected:** The panel opens on **Note**. Tab reaches **Note**, **Editor** and **Markdown**, the arrow keys choose **Editor**, and Tab then puts the cursor in the note, ready to type.
  - **Notes:**

- [ ] **Step 2.** Look at the note.
  - **Expected:** **platform** is teal, and the heading, bullets, link and checkboxes are easy to read against the panel.
  - **Notes:**

- [ ] **Step 3.** Choose **Dark** in the Appearance menu.
  - **Expected:** **platform** is still teal, and the heading, bullets, link and checkboxes are easy to read against the dark panel.
  - **Notes:**

- [ ] **Step 4.** Choose **Light** in the Appearance menu.
  - **Expected:** The panel returns to its light colours.
  - **Notes:**

- [ ] **Step 5.** Press Tab until **Cancel** has focus, and press Enter.
  - **Expected:** Focus is visible on each control on the way, and once the panel closes, focus is back on Max Munk's **Background** cell.
  - **Notes:**

- [ ] **Step 6.** Select **Metrics** above the table, then Max Munk's **Background** cell. Drag the edge between the two panels up and down, then close the note with its close button and open it again.
  - **Expected:** The panels keep their width as the note opens and closes. The note shows above the Metrics panel on **Note**, with a close button and no **Clear**, **Cancel** or **Save**, each panel easy to read and scrolling on its own, and the edge shares the height between them. The note shrinks away as it closes and grows back as it opens, with Metrics moving smoothly to make room.
  - **Notes:**

- [ ] **Step 7.** Clear the search, select Lilian Lang's **Background** cell, then its close button, then the Metrics panel's close button.
  - **Expected:** Lilian Lang's empty note replaces Max Munk's, open in **Editor**. Once it closes, the Metrics panel fills the place again, and once that closes, the table fills the page.
  - **Notes:**

- [ ] **Step 8.** Turn on reduced motion in the computer's accessibility settings. Open Max Munk's **Background** cell, then close it with its close button. Turn reduced motion off again.
  - **Expected:** The panel appears and goes at once, without sliding.
  - **Notes:**

- [ ] **Step 9.** Make the browser window as narrow as a phone's screen. Open Max Munk's **Background** cell, press Tab several times, then close it with its close button and widen the window again.
  - **Expected:** The panel covers the table, and focus stays within it until it closes.
  - **Notes:**

### NOTE-05: A Note Is Read, Approved, and Recorded

**Account:** Resource Planner, `resource.planner@fathom.test`, changed from NOTE-04. Step 2 signs in as another account.

**Preconditions:** Run after NOTE-04. Publish (P1) as the Workforce Administrator, then sign in with this account. **People** page open, with **Max Munk** searched for.

- [ ] **Step 1.** Select Max Munk's **Background** cell.
  - **Expected:** The panel shows the note as it reads, with a close button, and nothing to change it with.
  - **Notes:**

- [ ] **Step 2.** Press Esc. Sign in as the Engineering Director, `engineering.director@fathom.test`, open **Drafts** from the left-hand menu, and approve Max Munk's draft. Then open **Change history**.
  - **Expected:** The draft and the history show the note's words without formatting, and read clearly.
  - **Notes:**
