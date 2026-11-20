---
title: "Manual Test: Note Columns on People"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/shared/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-19"
---

# Manual Test: Note Columns on People

## Scope

Verifies what only a person can judge of Note columns on the People table: how the note's side panel looks, slides and resizes, writing a note with the toolbar, how headings, checkboxes and numbered lists look, switching between the editor and Markdown, pasting from another app, colours, the keyboard and focus, the panel's place beside the Metrics panel, the journey from writing a note to reading it, approving it, and finding it in the change history, filtering the rows that have a note, or any value in a choice column, a long note folded in a person's details and read in full on Releases, an open note, from a person's details or a cell, kept open on reload, Back and a shared link, and a panel under another maximized and restored.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A word processor or web page to copy formatted text from.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Engineering Director:** `engineering.director@fathom.test`
- **Feature Lead:** `feature.lead@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data) and [Publish](manual-test-basics.md#publish).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as searching for a person and the column menu. This test adds:

- **Background cell:** the cell in a person's row under the **Background** column, which NOTE-01 adds at the right end of the People table; scroll right to reach it.
- **Panel:** the side panel that opens beside the table from a **Background** cell, headed **Background**.
- **Toolbar:** the row of buttons above the text in the panel's editor, for headings 1 to 3, bold, italic, strikethrough, code, colour, bullet list, numbered list, checkbox list, link, and removing a link.
- **Maximize button:** the button showing four corners pointing out, before the close button at the top right of a panel under another, read aloud as Maximize and the panel's name. While the panel is maximized it shows four corners pointing in, read aloud as Restore: the **Restore button**.

## Test Cases

Run the test cases in order, in about 30 minutes. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out. To run the test again, delete the **Background** column first from its column menu, and approve the deletion.

### NOTE-01: A Note Column Is Added

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case. Step `5AE9` signs in as another account.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `11E2` Select **New column**.
  - **Expected:** The **New column** dialog opens.
  - **Notes:**

- [ ] `FA17` Type `Background` in **Name**.
  - **Expected:** **Name** holds `Background`.
  - **Notes:**

- [ ] `F5E6` Choose **Note** in **Type**.
  - **Expected:**
    - **Type** reads "Note".
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
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `EC0B` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **To decide** is chosen beside the page's title.
    - A row's **Record** reads `Background`, with **Type** "Column".
  - **Notes:**

- [ ] `D636` Tick the tick box of the row of `Background`.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `1083` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** A dialog opens, with an **Approve** button.
  - **Notes:**

- [ ] `5BDF` Select **Approve** in the dialog.
  - **Expected:** A notice reads "Approved 1 draft."
  - **Notes:**

### NOTE-02: A Note Is Written in Its Panel

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from NOTE-01.

**Preconditions:** Signed in with this account. Run after NOTE-01. **People** page open, with `Max Munk` searched for.

- [ ] `33CD` Select the **Background** cell of 'Max Munk'.
  - **Expected:**
    - The panel slides in smoothly from the right over the table, with no jump.
    - The table then has room beside it.
    - It is headed **Background**.
    - **Note**, **Editor** and **Markdown** are at the top.
    - **Editor** is chosen.
    - The toolbar is under them, then the note's text.
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
  - **Expected:** The note reads `Joined from the platform team`.
  - **Notes:**

- [ ] `97F0` Double-click `Joined`.
  - **Expected:** `Joined` is highlighted.
  - **Notes:**

- [ ] `7AA3` Select the bold button in the toolbar.
  - **Expected:**
    - `Joined` shows in bold at once.
    - The toolbar's buttons are clear about what they do.
  - **Notes:**

- [ ] `B281` Double-click `platform`.
  - **Expected:** `platform` is highlighted.
  - **Notes:**

- [ ] `1A05` Select the colour button in the toolbar, then **Teal**.
  - **Expected:** `platform` shows in teal at once.
  - **Notes:**

- [ ] `6FEE` Click at the end of the line, after `team`.
  - **Expected:** The cursor is after `team`.
  - **Notes:**

- [ ] `33AB` Press Enter.
  - **Expected:** A new line starts under the first.
  - **Notes:**

- [ ] `710F` Select the bullet list button in the toolbar.
  - **Expected:** A bullet shows at once at the start of the line.
  - **Notes:**

- [ ] `9AB5` Type `Mentor: Lilian`, and press Enter.
  - **Expected:** A second bullet starts under `Mentor: Lilian`.
  - **Notes:**

- [ ] `F2B8` Type `Speaks Japanese`.
  - **Expected:** The second bullet reads `Speaks Japanese`.
  - **Notes:**

- [ ] `7F87` Double-click `Lilian`.
  - **Expected:** `Lilian` is highlighted.
  - **Notes:**

- [ ] `EA8F` Select the link button in the toolbar.
  - **Expected:**
    - A form opens under the button.
    - It has **Address** and **Text to show**.
  - **Notes:**

- [ ] `325E` Type `wiki.example.test/lilian` in **Address**, and press Enter.
  - **Expected:** `Lilian` shows as a link at once.
  - **Notes:**

- [ ] `FC5C` Click in `Lilian`.
  - **Expected:** The cursor is in `Lilian`.
  - **Notes:**

- [ ] `E537` Select the link button in the toolbar.
  - **Expected:**
    - The form opens again under the button.
    - It has **Address** and **Text to show**.
  - **Notes:**

- [ ] `71D9` Replace the text in **Text to show** with `Lilian Lang`, and press Enter.
  - **Expected:** The link reads `Lilian Lang`.
  - **Notes:**

- [ ] `5C89` Click at the end of `Speaks Japanese`.
  - **Expected:** The cursor is after `Japanese`.
  - **Notes:**

- [ ] `BD0A` Press Enter twice.
  - **Expected:**
    - The list ends.
    - The cursor is on a line with no bullet.
  - **Notes:**

- [ ] `E955` Type `Plans`.
  - **Expected:** The line reads `Plans`.
  - **Notes:**

- [ ] `8A8E` Select the heading 2 button in the toolbar.
  - **Expected:** `Plans` reads as a heading at once.
  - **Notes:**

- [ ] `89D9` Press Enter.
  - **Expected:** A new line starts under `Plans`.
  - **Notes:**

- [ ] `FC0A` Select the checkbox list button in the toolbar.
  - **Expected:** A checkbox shows at once at the start of the line.
  - **Notes:**

- [ ] `47EF` Type `Meet the team`, and press Enter.
  - **Expected:** A second checkbox starts under `Meet the team`.
  - **Notes:**

- [ ] `F0B7` Type `Set goals`.
  - **Expected:** The second checkbox reads `Set goals`.
  - **Notes:**

- [ ] `493F` Tick the box before `Meet the team`.
  - **Expected:**
    - The box before `Meet the team` is ticked.
    - The checkboxes line up with their text.
  - **Notes:**

- [ ] `F125` Select **Note** at the top of the panel.
  - **Expected:**
    - The note reads, from the top:
      - `Joined from the platform team`, with `Joined` in bold and `platform` in teal
      - a bullet `Mentor: Lilian Lang`, with `Lilian Lang` a link
      - a bullet `Speaks Japanese`
      - the heading `Plans`
      - a ticked checkbox `Meet the team`
      - a checkbox `Set goals`
  - **Notes:**

- [ ] `C377` Select **Markdown**.
  - **Expected:**
    - The text starts in the same place in the panel, so nothing jumps.
    - The note shows as Markdown text, reading, from the top:
      - `Joined from the platform team`, with bold markup around `Joined` and colour markup around `platform`
      - a bullet `Mentor: Lilian Lang`, with link markup around `Lilian Lang`
      - a bullet `Speaks Japanese`
      - `Plans`, with heading markup before it
      - `Meet the team`, with checkbox markup before it marking it ticked
      - `Set goals`, with checkbox markup before it
  - **Notes:**

- [ ] `C74E` Select **Editor**.
  - **Expected:**
    - The note reads, from the top:
      - `Joined from the platform team`, with `Joined` in bold and `platform` in teal
      - a bullet `Mentor: Lilian Lang`, with `Lilian Lang` a link
      - a bullet `Speaks Japanese`
      - the heading `Plans`
      - a ticked checkbox `Meet the team`
      - a checkbox `Set goals`
  - **Notes:**

- [ ] `7AAC` Select **Note**.
  - **Expected:** The link reads `Lilian Lang`.
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

- [ ] `65A7` Select the **Background** cell of 'Max Munk' again.
  - **Expected:**
    - The panel opens.
    - It shows the note, reading, from the top:
      - `Joined from the platform team`, with `Joined` in bold and `platform` in teal
      - a bullet `Mentor: Lilian Lang`, with `Lilian Lang` a link
      - a bullet `Speaks Japanese`
      - the heading `Plans`
      - a ticked checkbox `Meet the team`
      - a checkbox `Set goals`
  - **Notes:**

- [ ] `F9CA` Select **Editor**.
  - **Expected:**
    - **Editor** is chosen.
    - The toolbar is above the text.
  - **Notes:**

- [ ] `33E2` Click at the end of `Set goals`.
  - **Expected:** The cursor is after `Set goals`.
  - **Notes:**

- [ ] `286F` Type a space and `again`.
  - **Expected:** The line reads `Set goals again`.
  - **Notes:**

- [ ] `9C4C` Press Cmd+Z on a Mac, or Ctrl+Z otherwise.
  - **Expected:**
    - Only the space and `again` go, leaving `Set goals`.
    - The rest of the note reads, from the top:
      - `Joined from the platform team`, with `Joined` in bold and `platform` in teal
      - a bullet `Mentor: Lilian Lang`, with `Lilian Lang` a link
      - a bullet `Speaks Japanese`
      - the heading `Plans`
      - a ticked checkbox `Meet the team`
  - **Notes:**

- [ ] `34B0` Select **Cancel**.
  - **Expected:**
    - The panel closes.
    - The cell still shows the note's words.
    - The hollow yellow dot is still before them.
  - **Notes:**

### NOTE-03: Text Is Pasted From Another App

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as NOTE-02.

**Preconditions:** Signed in with this account. Run after NOTE-02. **People** page open, with `Lilian Lang` searched for.

- [ ] `E291` In a word processor or web page, copy a passage holding a heading, bold text, highlighted text, a numbered list, a table, and an image.
  - **Expected:** The passage is highlighted in the other app.
  - **Notes:**

- [ ] `B3CA` Select the **Background** cell of 'Lilian Lang'.
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
    - The numbered list stays numbered, counting from 1.
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
    - The cell of 'Lilian Lang' is still empty.
  - **Notes:**

### NOTE-04: Notes Read Well and Work From the Keyboard

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as NOTE-03.

**Preconditions:** Signed in with this account. Run after NOTE-03. **People** page open, with `Max Munk` searched for.

- [ ] `EDAC` Using only the keyboard, move to the **Background** cell of 'Max Munk'.
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
    - `platform` is teal.
    - The heading, bullets, link and checkboxes are easy to read against the panel.
  - **Notes:**

- [ ] `E586` Press Tab until **Cancel** has focus.
  - **Expected:** Focus is visible on each control on the way.
  - **Notes:**

- [ ] `8D76` Press Enter.
  - **Expected:**
    - The panel closes.
    - Focus is back on the **Background** cell of 'Max Munk'.
  - **Notes:**

- [ ] `8D6D` Select **Metrics** above the table.
  - **Expected:** The Metrics panel opens.
  - **Notes:**

- [ ] `45BF` Select the **Background** cell of 'Max Munk'.
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

- [ ] `902F` Select the **Background** cell of 'Max Munk' again.
  - **Expected:**
    - The note grows back as it opens, with Metrics moving smoothly to make room.
    - The panels keep their width.
  - **Notes:**

- [ ] `0FC4` Clear the search.
  - **Expected:** The table shows every row again.
  - **Notes:**

- [ ] `9C64` Select the **Background** cell of 'Lilian Lang'.
  - **Expected:**
    - The empty note of 'Lilian Lang' replaces that of 'Max Munk'.
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

- [ ] `CFDC` Select the **Background** cell of 'Max Munk'.
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

- [ ] `A1C3` Select the **Background** cell of 'Max Munk'.
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

**Preconditions:** Run after NOTE-04. Run Publish as the Workforce Administrator, then sign in with this account. **People** page open, with `Max Munk` searched for.

- [ ] `6A4B` Select the **Background** cell of 'Max Munk'.
  - **Expected:**
    - The panel shows the note as it reads.
    - It has a close button.
    - Nothing in it changes the note.
  - **Notes:**

- [ ] `2BBD` Press Esc.
  - **Expected:** The panel closes.
  - **Notes:**

- [ ] `5F1D` Sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `726B` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **To decide** is chosen beside the page's title.
    - In the row whose **Record** reads 'Max Munk', **What changes** shows the note's words without formatting.
    - The words read clearly.
  - **Notes:**

- [ ] `3944` Tick the tick box of the row of 'Max Munk'.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `BA55` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** A dialog opens, with an **Approve** button.
  - **Notes:**

- [ ] `760F` Select **Approve** in the dialog.
  - **Expected:** A notice reads "Approved 1 draft."
  - **Notes:**

- [ ] `C26D` Select the **Change history** page in the left-hand menu.
  - **Expected:**
    - The history shows the note's words without formatting.
    - The words read clearly.
  - **Notes:**

### NOTE-06: Rows With a Note Are Filtered

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as NOTE-05.

**Preconditions:** Run after NOTE-05. Select the **People** page in the left-hand menu.

- [ ] `EB7E` Open the **Background** column menu, and select **Filter…**.
  - **Expected:** The filter opens beside the column's name, showing, from the top:
    - **Contains**
    - an **Empty** checkbox
    - a **Not empty** checkbox, in the same style
  - **Notes:**

- [ ] `10BD` Tick **Empty**.
  - **Expected:** Only people with no note in **Background** are listed.
  - **Notes:**

- [ ] `F1E0` Tick **Not empty**.
  - **Expected:**
    - **Not empty** is ticked.
    - **Empty** is no longer ticked.
    - 'Max Munk' is listed.
    - Every person listed has a note in **Background**.
  - **Notes:**

- [ ] `4D41` Press Esc.
  - **Expected:**
    - The filter closes.
    - A pill above the table reads "Background: Not empty".
  - **Notes:**

- [ ] `083E` Open the **Site** column menu, and select **Filter…**.
  - **Expected:** **Empty** and then **Not empty** follow the sites that are in use.
  - **Notes:**

- [ ] `06B8` Press Esc.
  - **Expected:** The filter closes.
  - **Notes:**

- [ ] `1BC7` Select **Clear all** above the table.
  - **Expected:**
    - The pill is gone.
    - Every person is listed again.
  - **Notes:**

### NOTE-07: A Long Note Folds in a Person's Details

**Account:** Engineering Director, `engineering.director@fathom.test`, the same as the account NOTE-06 ended with.

**Preconditions:** Signed in with this account. **People** page open, with `Jarrod Mante` searched for.

- [ ] `5EB4` Select **Show details** in the ⋯ menu of 'Jarrod Mante'.
  - **Expected:**
    - The side panel opens.
    - Under **Columns**, **Onboarding** shows the first lines of the note, starting with the heading **First weeks**.
    - The last lines shown fade out.
    - A **Show more** link is under the note.
  - **Notes:**

- [ ] `51FF` Select **Show more**.
  - **Expected:**
    - A panel headed **Onboarding** opens under the details.
    - **Note** is chosen at its top, and the whole note reads below, ending with the heading **Looking back** and its paragraph.
  - **Notes:**

- [ ] `AC5C` Select the close button of the **Onboarding** panel.
  - **Expected:** The **Onboarding** panel closes, and the details fill the height again.
  - **Notes:**

- [ ] `0362` Point at the **Onboarding** row in the details.
  - **Expected:** A button showing a box with its right side marked appears at the row's right.
  - **Notes:**

- [ ] `5AB7` Select that button.
  - **Expected:** The **Onboarding** panel opens under the details again, on **Note**.
  - **Notes:**

- [ ] `3BA2` Select the **Releases** page in the left-hand menu.
  - **Expected:** The **Releases** tab shows, with a row for 'Harbor 3' whose **Schedule** reads 'Platform'.
  - **Notes:**

- [ ] `7324` Select the details button at the right of the first cell of the row for 'Harbor 3'.
  - **Expected:** The side panel opens, headed 'Harbor 3', and its **Note** row starts with the heading **What Harbor 3 is for**.
  - **Notes:**

- [ ] `C9C4` Select the open button at the right of the **Note** row.
  - **Expected:**
    - A panel titled "Note for Harbor 3" opens beside the release's details.
    - It shows the whole note, starting with the heading **What Harbor 3 is for**.
  - **Notes:**

- [ ] `0C5E` Select **Editor** at the top of the **Note for Harbor 3** panel.
  - **Expected:** The toolbar is above the note's text.
  - **Notes:**

- [ ] `FAB9` Scroll the **Note for Harbor 3** panel to the middle of the note.
  - **Expected:** The toolbar stays in sight at the top, on a plain background, with no text showing through it.
  - **Notes:**

### NOTE-08: A Numbered List Holds Another List

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from NOTE-07.

**Preconditions:** Signed in with this account. **People** page open, with `Lilian Lang` searched for.

- [ ] `4E5F` Select the **Background** cell of 'Lilian Lang'.
  - **Expected:**
    - The panel opens.
    - **Editor** is chosen.
    - The note is empty.
  - **Notes:**

- [ ] `0D90` Select the numbered list button in the toolbar.
  - **Expected:** `1.` shows at once at the start of the line.
  - **Notes:**

- [ ] `2DAC` Type `Sign the contract`, and press Enter.
  - **Expected:** A line starting with `2.` starts under `Sign the contract`.
  - **Notes:**

- [ ] `2391` Press Tab.
  - **Expected:**
    - The line moves in, under `Sign the contract`.
    - It starts with `1.`.
  - **Notes:**

- [ ] `9EC1` Select the bullet list button in the toolbar.
  - **Expected:**
    - The line's `1.` becomes a bullet.
    - The line stays moved in.
  - **Notes:**

- [ ] `CD63` Type `Collect the laptop`, and press Enter twice.
  - **Expected:**
    - The cursor is on a line starting with `2.`.
    - The line is not moved in.
  - **Notes:**

- [ ] `DA29` Type `Meet the team`.
  - **Expected:** The line reads `2. Meet the team`.
  - **Notes:**

- [ ] `C6DD` Select **Note** at the top of the panel.
  - **Expected:**
    - The note reads, from the top:
      - `1. Sign the contract`
      - a bullet `Collect the laptop`, moved in under it
      - `2. Meet the team`
    - The numbers line up with their text, as the bullets do.
  - **Notes:**

- [ ] `ECF1` Select **Markdown**.
  - **Expected:**
    - The note shows as Markdown text, reading, from the top:
      - `1. Sign the contract`
      - `- Collect the laptop`, moved in
      - `2. Meet the team`
  - **Notes:**

- [ ] `BB5B` Select **Cancel**.
  - **Expected:**
    - A dialog asks "Discard changes to the note?".
    - It offers **Keep writing** and **Discard**.
  - **Notes:**

- [ ] `D2A8` Select **Discard**.
  - **Expected:**
    - The panel closes.
    - The cell of 'Lilian Lang' is still empty.
  - **Notes:**

### NOTE-09: An Open Note Stays Open on Reload, Back and a Link

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as NOTE-08. Step `9906` signs in as another account.

**Preconditions:** Signed in with this account. Run after NOTE-08. **People** page open, with `Max Munk` searched for.

- [ ] `1AF0` Select **Show details** in the ⋯ menu of 'Max Munk'.
  - **Expected:** The side panel opens, headed 'Max Munk'.
  - **Notes:**

- [ ] `4837` Select the open button at the right of the **Background** row in the details.
  - **Expected:**
    - A panel titled "Background for Max Munk" opens under the details.
    - **Note** is chosen at its top.
    - The note starts with `Joined from the platform team`.
  - **Notes:**

- [ ] `22C1` Reload the page.
  - **Expected:**
    - The details of 'Max Munk' are open.
    - The "Background for Max Munk" panel is open under them, on **Note**.
  - **Notes:**

- [ ] `BA41` Select **Editor** at the top of the "Background for Max Munk" panel.
  - **Expected:** The toolbar is above the note's text.
  - **Notes:**

- [ ] `C840` Click at the end of `Set goals`.
  - **Expected:** The cursor is after `Set goals`.
  - **Notes:**

- [ ] `4532` Type a space and `again`.
  - **Expected:** The line reads `Set goals again`.
  - **Notes:**

- [ ] `E694` Reload the page.
  - **Expected:**
    - The "Background for Max Munk" panel is open under the details, on **Note**.
    - The last checkbox reads `Set goals`.
  - **Notes:**

- [ ] `C1E6` Select the browser's Back button.
  - **Expected:**
    - The "Background for Max Munk" panel closes.
    - The details of 'Max Munk' stay open.
  - **Notes:**

- [ ] `205E` Select the browser's Forward button.
  - **Expected:** The "Background for Max Munk" panel opens under the details again, on **Note**.
  - **Notes:**

- [ ] `2EBE` Copy the web address from the browser's address bar.
  - **Expected:** Nothing in Fathom changes.
  - **Notes:**

- [ ] `9906` Sign in as the Feature Lead, `feature.lead@fathom.test`.
  - **Expected:** The top bar's right end reads "Feature Lead".
  - **Notes:**

- [ ] `5077` Paste the copied web address into the address bar, and press Enter.
  - **Expected:**
    - The **People** page shows, with the details of 'Max Munk' open.
    - The "Background for Max Munk" panel is open under them, showing the note as it reads.
    - The panel has no **Editor** or **Markdown**.
  - **Notes:**

- [ ] `34C2` Select the close button of the "Background for Max Munk" panel.
  - **Expected:**
    - The panel closes.
    - The details of 'Max Munk' stay open.
  - **Notes:**

- [ ] `36FD` Reload the page.
  - **Expected:**
    - The details of 'Max Munk' are open.
    - No "Background for Max Munk" panel is open.

### NOTE-10: A Panel Under Another Is Maximized

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from NOTE-09.

**Preconditions:** Signed in with this account. **People** page open, with `Jarrod Mante` searched for.

- [ ] `0BDC` Select **Show details** in the ⋯ menu of 'Jarrod Mante'.
  - **Expected:**
    - The side panel opens, headed 'Jarrod Mante'.
    - Its head has a close button, and no **Maximize button**.
  - **Notes:**

- [ ] `9113` Select the open button at the right of the **Onboarding** row in the details.
  - **Expected:**
    - A panel titled "Onboarding for Jarrod Mante" opens under the details.
    - Its head has a **Maximize button** before its close button.
  - **Notes:**

- [ ] `A0F5` Select the **Maximize button**.
  - **Expected:**
    - The "Onboarding for Jarrod Mante" panel fills the height beside the table.
    - The details of 'Jarrod Mante' are hidden.
    - The **Maximize button** is now the **Restore button**.
    - The panel keeps its width.
  - **Notes:**

- [ ] `4D0C` Press Enter.
  - **Expected:**
    - The details of 'Jarrod Mante' show again above the "Onboarding for Jarrod Mante" panel, each as tall as before.
    - The **Restore button** is the **Maximize button** again, and still has focus.
  - **Notes:**

- [ ] `8003` Select the **Maximize button**.
  - **Expected:** The "Onboarding for Jarrod Mante" panel fills the height beside the table.
  - **Notes:**

- [ ] `0BC4` Select **Metrics** above the table.
  - **Expected:**
    - The details of 'Jarrod Mante' grow back above the "Onboarding for Jarrod Mante" panel.
    - The Metrics panel opens under them.
    - The "Onboarding for Jarrod Mante" panel shows its **Maximize button** again.
  - **Notes:**

- [ ] `3D7B` Select the **Maximize button** of the Metrics panel.
  - **Expected:**
    - The Metrics panel fills the height beside the table.
    - The details of 'Jarrod Mante' and the "Onboarding for Jarrod Mante" panel are hidden.
  - **Notes:**

- [ ] `997D` Select the **Restore button** of the Metrics panel.
  - **Expected:** The details of 'Jarrod Mante' and the "Onboarding for Jarrod Mante" panel show again above the Metrics panel.
  - **Notes:**

- [ ] `1A68` Select the close button of the "Onboarding for Jarrod Mante" panel.
  - **Expected:**
    - The panel closes.
    - The details of 'Jarrod Mante' and the Metrics panel share the height beside the table.
  - **Notes:**

- [ ] `B699` Select the **Background** cell of 'Max Munk'.
  - **Expected:**
    - A panel headed **Background** opens under the details of 'Max Munk', showing the note as it reads.
    - The details of 'Max Munk' stay open.
  - **Notes:**

- [ ] `8090` Reload the page.
  - **Expected:**
    - The panel headed **Background** is open under the details of 'Max Munk' again, showing the note as it reads.
    - The details of 'Max Munk' stay open.
  - **Notes:**

- [ ] `A68E` Select the browser's Back button.
  - **Expected:**
    - The panel headed **Background** closes.
    - The details of 'Max Munk' stay open.
  - **Notes:**
