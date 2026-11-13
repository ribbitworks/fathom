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
- **Feature Lead:** `feature.lead@fathom.test`

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

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case. Step `5AE9` signs in as another account.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `11E2` Select **New column**.
  - **Expected:** The **New column** dialog opens.
  - **Notes:**

- [ ] `FA17` Type `Background` in **Name**.
  - **Expected:** **Name** holds **Background**.
  - **Notes:**

- [ ] `F5E6` Choose **Note** in **Type**.
  - **Expected:**
    - **Type** reads **Note**.
    - **General** is still chosen.
  - **Notes:**

- [ ] `CDDE` Select **Add column**.
  - **Expected:**
    - The dialog closes.
    - A **Background** column is at the end of the table.
    - A hollow yellow dot is before its name.
  - **Notes:**

- [ ] `3A7D` Run Publish.
  - **Expected:** The **Background** column at the end of the table has a yellow dot before its name.
  - **Notes:**

- [ ] `5AE9` Sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Director**.
  - **Notes:**

- [ ] `EC0B` Select the **Drafts** page in the left-hand menu.
  - **Expected:** The **Drafts** page lists the **Background** column.
  - **Notes:**

- [ ] `5BDF` Approve the **Background** column.
  - **Expected:** A notice reads **Approved 1 draft.**
  - **Notes:**

### NOTE-02: A Note Is Written in Its Panel

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from NOTE-01.

**Preconditions:** Signed in with this account. Run after NOTE-01. **People** page open, with **Max Munk** searched for.

- [ ] `33CD` Select Max Munk's **Background** cell.
  - **Expected:**
    - The panel slides in smoothly from the right over the table, with no jump.
    - The table then has room beside it.
    - It is headed **Background**.
    - **Note**, **Editor** and **Markdown** are at the top.
    - **Editor** is chosen.
    - The note's text is under them.
    - The toolbar is under the text.
    - **Clear**, **Cancel** and **Save** are at the bottom.
  - **Notes:**

- [ ] `F5E4` Drag the panel's left edge to the left.
  - **Expected:**
    - The panel widens.
    - The table beside it stays usable.
  - **Notes:**

- [ ] `A5A7` Drag the panel's left edge to the right.
  - **Expected:**
    - The panel narrows.
    - The table beside it stays usable.
  - **Notes:**

- [ ] `88B3` Type `Joined from the platform team`.
  - **Expected:** The note reads **Joined from the platform team**.
  - **Notes:**

- [ ] `97F0` Double-click `Joined`.
  - **Expected:** **Joined** is highlighted.
  - **Notes:**

- [ ] `7AA3` Select the bold button in the toolbar.
  - **Expected:**
    - **Joined** shows in bold at once.
    - The toolbar's buttons are clear about what they do.
  - **Notes:**

- [ ] `B281` Double-click `platform`.
  - **Expected:** **platform** is highlighted.
  - **Notes:**

- [ ] `1A05` Select the colour button in the toolbar, then **Teal**.
  - **Expected:** **platform** shows in teal at once.
  - **Notes:**

- [ ] `6FEE` Click at the end of the line, after `team`.
  - **Expected:** The cursor is after **team**.
  - **Notes:**

- [ ] `33AB` Press Enter.
  - **Expected:** A new line starts under the first.
  - **Notes:**

- [ ] `710F` Select the bullet list button in the toolbar.
  - **Expected:** A bullet shows at once at the start of the line.
  - **Notes:**

- [ ] `9AB5` Type `Mentor: Lilian`, and press Enter.
  - **Expected:** A second bullet starts under **Mentor: Lilian**.
  - **Notes:**

- [ ] `F2B8` Type `Speaks Japanese`.
  - **Expected:** The second bullet reads **Speaks Japanese**.
  - **Notes:**

- [ ] `7F87` Double-click `Lilian`.
  - **Expected:** **Lilian** is highlighted.
  - **Notes:**

- [ ] `EA8F` Select the link button in the toolbar.
  - **Expected:**
    - A form opens under the button.
    - It has **Address** and **Text to show**.
  - **Notes:**

- [ ] `325E` Type `wiki.example.test/lilian` in **Address**, and press Enter.
  - **Expected:** **Lilian** shows as a link at once.
  - **Notes:**

- [ ] `FC5C` Click in `Lilian`.
  - **Expected:** The cursor is in **Lilian**.
  - **Notes:**

- [ ] `E537` Select the link button in the toolbar.
  - **Expected:**
    - The form opens again under the button.
    - It has **Address** and **Text to show**.
  - **Notes:**

- [ ] `71D9` Replace the text in **Text to show** with `Lilian Lang`, and press Enter.
  - **Expected:** The link reads **Lilian Lang**.
  - **Notes:**

- [ ] `5C89` Click at the end of `Speaks Japanese`.
  - **Expected:** The cursor is after **Japanese**.
  - **Notes:**

- [ ] `BD0A` Press Enter twice.
  - **Expected:**
    - The list ends.
    - The cursor is on a line with no bullet.
  - **Notes:**

- [ ] `E955` Type `Plans`.
  - **Expected:** The line reads **Plans**.
  - **Notes:**

- [ ] `8A8E` Select the heading 2 button in the toolbar.
  - **Expected:** **Plans** reads as a heading at once.
  - **Notes:**

- [ ] `89D9` Press Enter.
  - **Expected:** A new line starts under **Plans**.
  - **Notes:**

- [ ] `FC0A` Select the checkbox list button in the toolbar.
  - **Expected:** A checkbox shows at once at the start of the line.
  - **Notes:**

- [ ] `47EF` Type `Meet the team`, and press Enter.
  - **Expected:** A second checkbox starts under **Meet the team**.
  - **Notes:**

- [ ] `F0B7` Type `Set goals`.
  - **Expected:** The second checkbox reads **Set goals**.
  - **Notes:**

- [ ] `493F` Tick the box before **Meet the team**.
  - **Expected:**
    - The box before **Meet the team** is ticked.
    - The checkboxes line up with their text.
  - **Notes:**

- [ ] `F125` Select **Note** at the top of the panel.
  - **Expected:**
    - The text starts in the same place in the panel, so nothing jumps.
    - The note reads, from the top:
      - **Joined from the platform team**, with **Joined** in bold and **platform** in teal
      - a bullet **Mentor: Lilian Lang**, with **Lilian Lang** a link
      - a bullet **Speaks Japanese**
      - the heading **Plans**
      - a ticked checkbox **Meet the team**
      - a checkbox **Set goals**
  - **Notes:**

- [ ] `C377` Select **Markdown**.
  - **Expected:**
    - The text starts in the same place in the panel, so nothing jumps.
    - The note shows as Markdown text, reading, from the top:
      - **Joined from the platform team**, with bold markup around **Joined** and colour markup around **platform**
      - a bullet **Mentor: Lilian Lang**, with link markup around **Lilian Lang**
      - a bullet **Speaks Japanese**
      - **Plans**, with heading markup before it
      - **Meet the team**, with checkbox markup before it marking it ticked
      - **Set goals**, with checkbox markup before it
  - **Notes:**

- [ ] `C74E` Select **Editor**.
  - **Expected:**
    - The text starts in the same place in the panel, so nothing jumps.
    - The note reads, from the top:
      - **Joined from the platform team**, with **Joined** in bold and **platform** in teal
      - a bullet **Mentor: Lilian Lang**, with **Lilian Lang** a link
      - a bullet **Speaks Japanese**
      - the heading **Plans**
      - a ticked checkbox **Meet the team**
      - a checkbox **Set goals**
  - **Notes:**

- [ ] `7AAC` Select **Note**.
  - **Expected:** The link reads **Lilian Lang**.
  - **Notes:**

- [ ] `D336` Click the link.
  - **Expected:** The wiki page opens in a new tab.
  - **Notes:**

- [ ] `5DF8` Back on the Fathom tab, select **Save**.
  - **Expected:**
    - The panel slides out smoothly to the right over the table, with no jump.
    - The table is already full width.
    - The cell shows the note's words on one line, cut short where they do not fit.
    - A hollow yellow dot is before the cell's words.
  - **Notes:**

- [ ] `65A7` Select Max Munk's **Background** cell again.
  - **Expected:**
    - The panel opens.
    - It shows the note, reading, from the top:
      - **Joined from the platform team**, with **Joined** in bold and **platform** in teal
      - a bullet **Mentor: Lilian Lang**, with **Lilian Lang** a link
      - a bullet **Speaks Japanese**
      - the heading **Plans**
      - a ticked checkbox **Meet the team**
      - a checkbox **Set goals**
  - **Notes:**

- [ ] `F9CA` Select **Editor**.
  - **Expected:**
    - **Editor** is chosen.
    - The toolbar is under the text.
  - **Notes:**

- [ ] `33E2` Click at the end of `Set goals`.
  - **Expected:** The cursor is after **Set goals**.
  - **Notes:**

- [ ] `286F` Type a space and `again`.
  - **Expected:** The line reads **Set goals again**.
  - **Notes:**

- [ ] `9C4C` Press Cmd+Z on a Mac, or Ctrl+Z otherwise.
  - **Expected:**
    - Only the space and **again** go, leaving **Set goals**.
    - The rest of the note reads, from the top:
      - **Joined from the platform team**, with **Joined** in bold and **platform** in teal
      - a bullet **Mentor: Lilian Lang**, with **Lilian Lang** a link
      - a bullet **Speaks Japanese**
      - the heading **Plans**
      - a ticked checkbox **Meet the team**
  - **Notes:**

- [ ] `34B0` Select **Cancel**.
  - **Expected:**
    - The panel closes.
    - The cell still shows the note's words.
    - The hollow yellow dot is still before them.
  - **Notes:**

### NOTE-03: Text Is Pasted From Another App

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as NOTE-02.

**Preconditions:** Signed in with this account. Run after NOTE-02. **People** page open, with **Lilian Lang** searched for.

- [ ] `E291` In a word processor or web page, copy a passage holding a heading, bold text, highlighted text, a numbered list, a table, and an image.
  - **Expected:** The passage is highlighted in the other app.
  - **Notes:**

- [ ] `B3CA` Select Lilian Lang's **Background** cell.
  - **Expected:**
    - The panel opens.
    - It is headed **Background**.
    - **Editor** is chosen.
    - The note is empty.
  - **Notes:**

- [ ] `B005` Paste the passage into the editor.
  - **Expected:**
    - The heading and bold stay.
    - Highlighting and the image are gone.
    - The numbered list becomes a bullet list.
    - What is left reads sensibly.
  - **Notes:**

- [ ] `5FAC` Select **Clear**.
  - **Expected:**
    - The note empties.
    - The panel stays open.
  - **Notes:**

- [ ] `814A` Select **Cancel**.
  - **Expected:**
    - The panel closes.
    - Lilian Lang's cell is still empty.
  - **Notes:**

### NOTE-04: Notes Read Well and Work From the Keyboard

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as NOTE-03.

**Preconditions:** Signed in with this account. Run after NOTE-03. **Light** chosen in the Appearance menu. **People** page open, with **Max Munk** searched for.

- [ ] `EDAC` Using only the keyboard, move to Max Munk's **Background** cell.
  - **Expected:** The cell shows the focus outline.
  - **Notes:**

- [ ] `26D0` Press Enter.
  - **Expected:** The panel opens on **Note**.
  - **Notes:**

- [ ] `58D7` Press Tab until **Note** has focus.
  - **Expected:**
    - Tab reaches **Note**, **Editor** and **Markdown**.
    - Focus is on **Note**.
  - **Notes:**

- [ ] `BC3A` Press the Right arrow key.
  - **Expected:** **Editor** is chosen.
  - **Notes:**

- [ ] `D3FC` Press Tab.
  - **Expected:** The cursor is in the note, ready to type.
  - **Notes:**

- [ ] `4AA7` Look at the note.
  - **Expected:**
    - **platform** is teal.
    - The heading, bullets, link and checkboxes are easy to read against the panel.
  - **Notes:**

- [ ] `F332` Choose **Dark** in the Appearance menu.
  - **Expected:**
    - **platform** is still teal.
    - The heading, bullets, link and checkboxes are easy to read against the dark panel.
  - **Notes:**

- [ ] `DBD6` Choose **Light** in the Appearance menu.
  - **Expected:** The panel is light.
  - **Notes:**

- [ ] `E586` Press Tab until **Cancel** has focus.
  - **Expected:** Focus is visible on each control on the way.
  - **Notes:**

- [ ] `8D76` Press Enter.
  - **Expected:**
    - The panel closes.
    - Focus is back on Max Munk's **Background** cell.
  - **Notes:**

- [ ] `8D6D` Select **Metrics** above the table.
  - **Expected:** The Metrics panel opens.
  - **Notes:**

- [ ] `45BF` Select Max Munk's **Background** cell.
  - **Expected:**
    - The panels keep their width as the note opens.
    - The note grows in above the Metrics panel, with Metrics moving smoothly to make room.
    - The note shows on **Note**.
    - It has a close button.
    - It has no **Clear**, **Cancel** or **Save**.
    - Each panel is easy to read and scrolls on its own.
  - **Notes:**

- [ ] `070D` Drag the edge between the two panels up.
  - **Expected:**
    - The note gets shorter.
    - The Metrics panel gets taller.
  - **Notes:**

- [ ] `78BC` Drag the edge between the two panels down.
  - **Expected:**
    - The note gets taller.
    - The Metrics panel gets shorter.
  - **Notes:**

- [ ] `FCFB` Select the note's close button.
  - **Expected:**
    - The note shrinks away as it closes, with Metrics moving smoothly to make room.
    - The panels keep their width.
  - **Notes:**

- [ ] `902F` Select Max Munk's **Background** cell again.
  - **Expected:**
    - The note grows back as it opens, with Metrics moving smoothly to make room.
    - The panels keep their width.
  - **Notes:**

- [ ] `0FC4` Clear the search.
  - **Expected:** The table shows every row again.
  - **Notes:**

- [ ] `9C64` Select Lilian Lang's **Background** cell.
  - **Expected:**
    - Lilian Lang's empty note replaces Max Munk's.
    - It is open in **Editor**.
  - **Notes:**

- [ ] `3DF6` Select the note's close button.
  - **Expected:** The Metrics panel fills the height beside the table.
  - **Notes:**

- [ ] `56F7` Select the Metrics panel's close button.
  - **Expected:** The table fills the page.
  - **Notes:**

- [ ] `4F9A` Turn on reduced motion in the computer's accessibility settings.
  - **Expected:** Reduced motion is on in the accessibility settings.
  - **Notes:**

- [ ] `CFDC` Select Max Munk's **Background** cell.
  - **Expected:** The panel appears at once, without sliding.
  - **Notes:**

- [ ] `9B70` Select the panel's close button.
  - **Expected:** The panel goes at once, without sliding.
  - **Notes:**

- [ ] `A2F2` Turn reduced motion off again.
  - **Expected:** Reduced motion is off in the accessibility settings.
  - **Notes:**

- [ ] `4C0E` Make the browser window as narrow as a phone's screen.
  - **Expected:** The People page fits the narrow window.
  - **Notes:**

- [ ] `A1C3` Select Max Munk's **Background** cell.
  - **Expected:** The panel covers the table.
  - **Notes:**

- [ ] `E478` Press Tab several times.
  - **Expected:** Focus stays within the panel.
  - **Notes:**

- [ ] `93F8` Select the panel's close button.
  - **Expected:**
    - The panel closes.
    - The table shows.
  - **Notes:**

- [ ] `F789` Widen the window again.
  - **Expected:** The table fills the wider window.
  - **Notes:**

### NOTE-05: A Note Is Read, Approved, and Recorded

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from NOTE-04. Step `5F1D` signs in as another account.

**Preconditions:** Run after NOTE-04. Run Publish as the Workforce Administrator, then sign in with this account. **People** page open, with **Max Munk** searched for.

- [ ] `6A4B` Select Max Munk's **Background** cell.
  - **Expected:**
    - The panel shows the note as it reads.
    - It has a close button.
    - Nothing in it changes the note.
  - **Notes:**

- [ ] `2BBD` Press Esc.
  - **Expected:** The panel closes.
  - **Notes:**

- [ ] `5F1D` Sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads **Engineering Director**.
  - **Notes:**

- [ ] `726B` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - Max Munk's draft shows the note's words without formatting.
    - The words read clearly.
  - **Notes:**

- [ ] `760F` Approve Max Munk's draft.
  - **Expected:** A notice reads **Approved 1 draft.**
  - **Notes:**

- [ ] `C26D` Select the **Change history** page in the left-hand menu.
  - **Expected:**
    - The history shows the note's words without formatting.
    - The words read clearly.
  - **Notes:**
