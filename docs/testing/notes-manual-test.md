---
title: "Manual Test: Note Columns on People"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/shared/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/product/decisions.md"]
last_updated: "2026-11-11"
---

# Manual Test: Note Columns on People

## Scope

Verifies what only a person can judge of Note columns on the People table: how the note's side panel looks, slides and resizes, writing a note with the toolbar, how headings and checkboxes look, switching between the editor and Markdown, pasting from another app, colours in light and dark mode, the keyboard and focus, the panel's place beside the Metrics panel, and the journey from writing a note to reading it, approving it, and finding it in the change history.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A word processor or web page to copy formatted text from.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**
- **Engineering Director:** `engineering.director@fathom.test`
- **Resource Planner:** `resource.planner@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data) and [Publish](manual-test-basics.md#publish).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the Appearance menu, searching for a person and the column menu. This test adds:

- **Background cell:** the cell in a person's row under the **Background** column, which NOTE-01 adds at the right end of the People table; scroll right to reach it.
- **Panel:** the side panel that opens beside the table from a **Background** cell, headed **Background**.
- **Toolbar:** the row of buttons under the text in the panel's editor, for headings 1 to 3, bold, italic, strikethrough, code, colour, bullet list, checkbox list, link, and removing a link.

## Test Cases

Run the test cases in order, in about 30 minutes. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out. To run the test again, delete the **Background** column first from its column menu, and approve the deletion.

### NOTE-01: A Note Column Is Added

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case. Step 2 signs in as another account.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] **Step 1.** Select **New column**. Type `Background` in **Name**, choose **Note** in **Type**, leave **General** chosen, select **Add column**, then run Publish.
  - **Expected:** A **Background** column is at the end of the table, with a yellow dot before its name.
  - **Notes:**

- [ ] **Step 2.** Sign in as the Engineering Director, `engineering.director@fathom.test`. Open the **Drafts** page from the left-hand menu and approve the **Background** column.
  - **Expected:** A notice reads **Approved 1 draft.**
  - **Notes:**

### NOTE-02: A Note Is Written in Its Panel

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from NOTE-01.

**Preconditions:** Signed in with this account. Run after NOTE-01. **People** page open, with **Max Munk** searched for.

- [ ] **Step 1.** Select Max Munk's **Background** cell.
  - **Expected:**
    - The panel slides in smoothly from the right over the table, which then has room beside it, with no jump.
    - It is headed **Background**, with **Note**, **Editor** and **Markdown** at the top, and **Editor** chosen.
    - The note's text is under them, and the toolbar under the text.
    - **Clear**, **Cancel** and **Save** are at the bottom.
  - **Notes:**

- [ ] **Step 2.** Drag the panel's left edge to the left, then to the right.
  - **Expected:**
    - The panel widens and narrows.
    - The table beside it stays usable.
  - **Notes:**

- [ ] **Step 3.** Type `Joined from the platform team`. Make `Joined` bold and `platform` teal from the toolbar. Press Enter, start a bullet list, and type `Mentor: Lilian`, Enter, `Speaks Japanese`. Make `Lilian` a link to `wiki.example.test/lilian` with the toolbar's link button. Then click in `Lilian`, press the link button again, and change the text to show to `Lilian Lang`.
  - **Expected:**
    - Each format shows as soon as it is applied.
    - The toolbar's buttons are clear about what they do.
    - The link button opens a form under the button, with **Address** and **Text to show**.
  - **Notes:**

- [ ] **Step 4.** Press Enter twice to leave the list, type `Plans`, and make it heading 2. Press Enter, start a checkbox list, and type `Meet the team`, Enter, `Set goals`. Tick the box before **Meet the team**.
  - **Expected:**
    - **Plans** reads as a heading.
    - The checkboxes line up with their text.
  - **Notes:**

- [ ] **Step 5.** Select **Note**, **Markdown**, then **Editor**, a few times, then **Note**, and click the link.
  - **Expected:**
    - The text starts in the same place in every view, so nothing jumps.
    - The note reads the same each time.
    - On **Note**, the link reads **Lilian Lang** and opens the wiki page in a new tab.
  - **Notes:**

- [ ] **Step 6.** Select **Save**.
  - **Expected:**
    - The panel slides out smoothly to the right over the table, which is already full width, with no jump.
    - The cell shows the note's words on one line, cut short where they do not fit.
    - A hollow yellow dot is before the cell's words.
  - **Notes:**

- [ ] **Step 7.** Select Max Munk's **Background** cell again, then **Editor**. Type a space and `again` at the end of `Set goals`, then press Cmd+Z on a Mac, or Ctrl+Z otherwise.
  - **Expected:**
    - Only the space and **again** go, leaving **Set goals**.
    - The rest of the note is as saved.
  - **Notes:**

- [ ] **Step 8.** Select **Cancel**.
  - **Expected:**
    - The panel closes.
    - The cell still shows the note's words.
    - The hollow yellow dot is still before them.
  - **Notes:**

### NOTE-03: Text Is Pasted From Another App

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as NOTE-02.

**Preconditions:** Signed in with this account. Run after NOTE-02. **People** page open, with **Lilian Lang** searched for.

- [ ] **Step 1.** In a word processor or web page, copy a passage holding a heading, bold text, highlighted text, a numbered list, a table, and an image. Select Lilian Lang's **Background** cell and paste it into the editor.
  - **Expected:**
    - The heading and bold stay.
    - Highlighting and the image are gone.
    - The numbered list becomes a bullet list.
    - What is left reads sensibly.
  - **Notes:**

- [ ] **Step 2.** Select **Clear**, then **Cancel**.
  - **Expected:**
    - The note empties, and the panel stays open until **Cancel**.
    - Lilian Lang's cell is still empty.
  - **Notes:**

### NOTE-04: Notes Read Well and Work From the Keyboard

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as NOTE-03.

**Preconditions:** Signed in with this account. Run after NOTE-03. **Light** chosen in the Appearance menu. **People** page open, with **Max Munk** searched for.

- [ ] **Step 1.** Using only the keyboard, move to Max Munk's **Background** cell and press Enter.
  - **Expected:**
    - The panel opens on **Note**.
    - Tab reaches **Note**, **Editor** and **Markdown**, and the arrow keys choose **Editor**.
    - Tab then puts the cursor in the note, ready to type.
  - **Notes:**

- [ ] **Step 2.** Look at the note.
  - **Expected:**
    - **platform** is teal.
    - The heading, bullets, link and checkboxes are easy to read against the panel.
  - **Notes:**

- [ ] **Step 3.** Choose **Dark** in the Appearance menu.
  - **Expected:**
    - **platform** is still teal.
    - The heading, bullets, link and checkboxes are easy to read against the dark panel.
  - **Notes:**

- [ ] **Step 4.** Choose **Light** in the Appearance menu.
  - **Expected:** The panel returns to its light colours.
  - **Notes:**

- [ ] **Step 5.** Press Tab until **Cancel** has focus, and press Enter.
  - **Expected:**
    - Focus is visible on each control on the way.
    - Once the panel closes, focus is back on Max Munk's **Background** cell.
  - **Notes:**

- [ ] **Step 6.** Select **Metrics** above the table, then Max Munk's **Background** cell. Drag the edge between the two panels up and down, then close the note with its close button and open it again.
  - **Expected:**
    - The panels keep their width as the note opens and closes.
    - The note shows above the Metrics panel on **Note**, with a close button and no **Clear**, **Cancel** or **Save**.
    - Each panel is easy to read and scrolls on its own, and the edge shares the height between them.
    - The note shrinks away as it closes and grows back as it opens, with Metrics moving smoothly to make room.
  - **Notes:**

- [ ] **Step 7.** Clear the search, select Lilian Lang's **Background** cell, then its close button, then the Metrics panel's close button.
  - **Expected:**
    - Lilian Lang's empty note replaces Max Munk's, open in **Editor**.
    - Once it closes, the Metrics panel fills the place again.
    - Once that closes, the table fills the page.
  - **Notes:**

- [ ] **Step 8.** Turn on reduced motion in the computer's accessibility settings. Open Max Munk's **Background** cell, then close it with its close button. Turn reduced motion off again.
  - **Expected:** The panel appears and goes at once, without sliding.
  - **Notes:**

- [ ] **Step 9.** Make the browser window as narrow as a phone's screen. Open Max Munk's **Background** cell, press Tab several times, then close it with its close button and widen the window again.
  - **Expected:**
    - The panel covers the table.
    - Focus stays within it until it closes.
  - **Notes:**

### NOTE-05: A Note Is Read, Approved, and Recorded

**Account:** Resource Planner, `resource.planner@fathom.test`, changed from NOTE-04. Step 2 signs in as another account.

**Preconditions:** Run after NOTE-04. Run Publish as the Workforce Administrator, then sign in with this account. **People** page open, with **Max Munk** searched for.

- [ ] **Step 1.** Select Max Munk's **Background** cell.
  - **Expected:**
    - The panel shows the note as it reads, with a close button.
    - Nothing in it changes the note.
  - **Notes:**

- [ ] **Step 2.** Press Esc. Sign in as the Engineering Director, `engineering.director@fathom.test`, open the **Drafts** page from the left-hand menu, and approve Max Munk's draft. Then open **Change history**.
  - **Expected:**
    - The draft and the history show the note's words without formatting.
    - Both read clearly.
  - **Notes:**
