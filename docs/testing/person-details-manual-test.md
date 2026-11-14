---
title: "Manual Test: Person Details"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/person-panel*", "apps/web/src/person-change.ts", "apps/web/src/people-grid.tsx", "apps/web/src/org-chart-page.tsx", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-14"
---

# Manual Test: Person Details

## Scope

Verifies a person's or planned hire's details in the side panel beside the org chart and People: what it shows of them, moving to another person, drafted values beside live ones and following the Draft menu, the red **Left** box on someone who has left, opening and closing it with the mouse and the keyboard, how it reads, resized, and in a narrow window, changing their details there, beside People and the org chart, being asked before a changed note is discarded, and adding a person or planned hire from **New person**.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Engineering Manager:** `engineering.manager@fathom.test`
- **Feature Lead:** `feature.lead@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks and the Draft menu. This test adds:

- **Details panel:** the panel that slides out on the right of the org chart or the **People** table, headed with a person's or planned hire's name, with the sections **Reporting**, **Details** and **Columns**, each a list of labels on the left and values on the right, and an **×** at its top right.
- **New:** the button at the top right of the **People** page, which opens the details panel to add a person or planned hire.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### DETAILS-01: A Person's Details Open Beside the Org Chart

**Account:** Engineering Manager, `engineering.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Org chart** page open from the left-hand menu.

- [ ] `CD7A` On the card at the top of the chart, select the name 'Silje Holm-Schrøder'.
  - **Expected:**
    - The details panel slides out on the right, headed 'Silje Holm-Schrøder'.
    - 'Engineering Manager' is under the heading.
    - The link **Show in People** is under that.
    - The chart narrows to make room.
    - Her card stays in the middle of the space left beside the panel.
    - Her card has a blue ring around it.
  - **Notes:**

- [ ] `6ACE` Read the **Reporting** section.
  - **Expected:**
    - **Manager** reads "No manager".
    - **Team name** reads 'Platform team', after a small teal dot.
    - **Direct reports** lists the people under her on the org chart, from 'Blaise Gislason' to '武井 聡', among them:
      - 'Tanushree Patel-Singh'
      - 'Simone Jean', with a yellow dot before her name
      - 'Chatura Abbott', who has not started yet, followed in grey by "Starts" and a day after today
    - 'Marceau Leroux' is not listed.
  - **Notes:**

- [ ] `D196` Read the **Details** and **Columns** sections, scrolling the panel if needed.
  - **Expected:**
    - **Details** shows:
      - **ID** 'E10007'
      - **Position** 'Engineering Manager'
      - **State** "Hired"
      - **Start** a date
      - no **End**
      - **Manager?** "Yes"
    - **Columns** shows:
      - **Grade** 'M1'
      - **Site** 'Ashgrove'
      - **Role on team** 'Design Authority'
  - **Notes:**

- [ ] `D843` Select 'Tanushree Patel-Singh' under **Direct reports**.
  - **Expected:**
    - The panel now shows 'Tanushree Patel-Singh'.
    - **Onboarding** under **Columns** shows, in order:
      - the heading "First weeks"
      - a checklist of four steps with only "Laptop and accounts ready" ticked, and the buddy's name 'Elly Gunther' in bold
      - "On track" in teal
      - a line ending with the link "onboarding guide"
  - **Notes:**

- [ ] `F702` Go back with the browser's back button.
  - **Expected:** The panel shows 'Silje Holm-Schrøder' again.
  - **Notes:**

- [ ] `63E2` Select the **×** at the top right of the panel.
  - **Expected:**
    - The panel slides away.
    - The chart fills the page again.
  - **Notes:**

### DETAILS-02: A Drafted Value Shows Beside the Live One

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as DETAILS-01.

**Preconditions:** **Org chart** page open, as DETAILS-01 ends.

- [ ] `4A59` Select the name on the card for 'Simone Jean', under 'Silje Holm-Schrøder'.
  - **Expected:**
    - The details panel shows 'Simone Jean'.
    - 'Software Engineer' is under the heading.
  - **Notes:**

- [ ] `A07A` Read **Manager** in the **Reporting** section.
  - **Expected:**
    - It reads 'Silje Holm-Schrøder', a link.
    - A yellow dot is before 'Silje Holm-Schrøder'.
    - Under it, a green dot, then 'Viktoria Holmberg' in grey, then a red **Left** box.
  - **Notes:**

- [ ] `E2A5` Read **Team** in the same section.
  - **Expected:**
    - It reads 'Platform team'.
    - A yellow dot is before it.
    - Under it, a green dot, then 'Search team' in grey.
  - **Notes:**

### DETAILS-03: The Details Follow the Draft Menu

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as DETAILS-02.

**Preconditions:** **Org chart** page open, with 'Simone Jean' in the details panel, as DETAILS-02 ends.

- [ ] `02A9` Select **Draft** above the chart, then **Drafts applied**.
  - **Expected:**
    - The Draft menu stays open.
    - A tick is before **Drafts applied**.
  - **Notes:**

- [ ] `C971` Press Esc.
  - **Expected:**
    - The Draft menu closes.
    - In the panel, **Manager** reads 'Silje Holm-Schrøder'.
    - A yellow dot is before it.
    - Nothing is under 'Silje Holm-Schrøder'.
    - No value has a green dot.
  - **Notes:**

- [ ] `492F` Select **Draft**, then **Live only**.
  - **Expected:**
    - The Draft menu stays open.
    - A tick is before **Live only**.
  - **Notes:**

- [ ] `E0EE` Press Esc.
  - **Expected:**
    - The Draft menu closes.
    - In the panel, **Manager** reads 'Viktoria Holmberg'.
    - A green dot is before it.
    - A red **Left** box follows 'Viktoria Holmberg'.
    - **Team** reads 'Search team'.
    - A green dot is before it.
    - No value has a yellow dot.
  - **Notes:**

- [ ] `5A62` Select **Draft**, then **Drafts & Live**.
  - **Expected:**
    - The Draft menu stays open.
    - A tick is before **Drafts & Live**.
  - **Notes:**

- [ ] `8FA4` Press Esc.
  - **Expected:**
    - The Draft menu closes.
    - In the panel, **Manager** reads 'Silje Holm-Schrøder'.
    - A yellow dot is before it.
    - 'Viktoria Holmberg' is under it.
  - **Notes:**

### DETAILS-04: Someone Who Has Left Is Marked

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as DETAILS-03.

**Preconditions:** **Org chart** page open, as DETAILS-03 ends.

- [ ] `A5A1` Select the name on the card for 'Viktoria Holmberg'.
  - **Expected:**
    - The details panel shows 'Viktoria Holmberg'.
    - Her position is under the heading, then a red **Left** box.
    - **End** under **Details** shows a date before today.
  - **Notes:**

### DETAILS-05: A Person's Details Open Beside People

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from DETAILS-04.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] `36F1` In the search box above the table, type `E10026`.
  - **Expected:** Only the row for 'Lorenza Thiel' shows.
  - **Notes:**

- [ ] `69F4` Point at her row, without selecting anything.
  - **Expected:**
    - Two small buttons appear at the right of her **Name** cell: a box with a line down its right side, then **⋯**.
    - Her name stays clear of the two buttons, not under them.
    - A **⋯** button is also at the end of her row.
  - **Notes:**

- [ ] `DCAD` Point away from the row.
  - **Expected:** The two buttons in her **Name** cell are hidden again.
  - **Notes:**

- [ ] `0EF4` Point at her row again, and select the **⋯** in her **Name** cell.
  - **Expected:**
    - A menu opens under it, headed 'Lorenza Thiel'.
    - **Show details** is its first item.
  - **Notes:**

- [ ] `7636` Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `3B96` Right-click her **Site** cell.
  - **Expected:**
    - The same menu opens beside the pointer, headed 'Lorenza Thiel'.
    - The browser's own menu does not open.
  - **Notes:**

- [ ] `AAB1` Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `7C3E` Point at her row again.
  - **Expected:** The two buttons appear again at the right of her **Name** cell.
  - **Notes:**

- [ ] `E607` Put the pointer on the box button, and press the mouse button without letting go.
  - **Expected:** The box button stays under the pointer.
  - **Notes:**

- [ ] `39EF` Let go of the mouse button.
  - **Expected:**
    - The details panel slides out on the right, headed 'Lorenza Thiel'.
    - The link **Show on org chart** is under her position.
    - The table narrows to make room.
    - **Details** shows no **Start** or **End**.
    - **Reporting** shows no **Manager assigned**.
  - **Notes:**

- [ ] `8CF6` Select **Show on org chart**.
  - **Expected:**
    - The **Org chart** page opens.
    - The finder reads 'Lorenza Thiel'.
    - Her card has a blue ring around it.
  - **Notes:**

### DETAILS-06: The Details Open and Close From the Keyboard

**Account:** Feature Lead, `feature.lead@fathom.test`, the same as DETAILS-05.

**Preconditions:** **People** page open from the left-hand menu, searched for `E10026`.

- [ ] `C56B` Select the **Name** cell of the row of 'Lorenza Thiel'.
  - **Expected:** Her **Name** cell is selected.
  - **Notes:**

- [ ] `14E0` Press Shift+F10.
  - **Expected:** Her menu opens, offering **Show details**.
  - **Notes:**

- [ ] `4D89` Press the down arrow until **Show details** is highlighted.
  - **Expected:** **Show details** is highlighted.
  - **Notes:**

- [ ] `42DB` Press Enter.
  - **Expected:**
    - The details panel opens, headed 'Lorenza Thiel'.
    - Focus is on her name at the top of the panel.
  - **Notes:**

- [ ] `0A79` Press Esc.
  - **Expected:**
    - The panel closes.
    - The table fills the page again.
    - Focus is back on her **Name** cell.
  - **Notes:**

### DETAILS-07: The Details Read Well, Resized, and in a Narrow Window

**Account:** Feature Lead, `feature.lead@fathom.test`, the same as DETAILS-06.

**Preconditions:** **People** page open, searched for `E10026`, with the details of 'Lorenza Thiel' open beside the table.

- [ ] `75FE` Read the panel.
  - **Expected:**
    - Labels are in grey on the left and values on the right.
    - Each row is ruled off from the next.
    - Every word is easy to read.
  - **Notes:**

- [ ] `4D64` Drag the panel's left edge to the left.
  - **Expected:**
    - The panel widens.
    - The table beside it narrows to match.
  - **Notes:**

- [ ] `6F1D` Drag the panel's left edge to the right, until the panel is narrow.
  - **Expected:**
    - The panel narrows.
    - The table beside it widens to match.
    - Once the panel is narrow, each label sits over its value, instead of a column of labels beside the values.
    - The names under **Direct reports** line up on the left.
  - **Notes:**

- [ ] `F525` Select **Metrics** above the table.
  - **Expected:**
    - The **Metrics** panel opens under the details panel.
    - The two panels share the height.
    - Lorenza's details stay open.
  - **Notes:**

- [ ] `135C` Drag the edge between the two panels up.
  - **Expected:**
    - The details panel gets shorter.
    - The **Metrics** panel gets taller.
  - **Notes:**

- [ ] `FD29` Drag the edge between the two panels down.
  - **Expected:**
    - The details panel gets taller.
    - The **Metrics** panel gets shorter.
    - Lorenza's details stay open.
  - **Notes:**

- [ ] `7B5D` Make the browser window as narrow as it goes.
  - **Expected:**
    - The panel covers the whole window.
    - Each label is above its value.
    - Nothing is cut off or overlapping.
  - **Notes:**

- [ ] `C52E` Restore the window to its earlier width.
  - **Expected:** The panel is beside the table again.
  - **Notes:**

### DETAILS-08: Changing a Person's Details Beside People

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DETAILS-07.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu, searched for `E10026`, with the details of 'Lorenza Thiel' open beside the table.

- [ ] `AC8F` Read the panel, with the pointer away from it.
  - **Expected:**
    - No value shows a change button.
    - **Details** starts with **Name** 'Lorenza Thiel'.
    - **Manager?** shows a ticked checkbox and "Yes".
  - **Notes:**

- [ ] `C23D` Point at the **Site** row, which reads 'Corran Quay'.
  - **Expected:**
    - The row is shaded grey.
    - A change button, a pencil, shows at the right of 'Corran Quay'.
  - **Notes:**

- [ ] `7540` Point at the **Team** row.
  - **Expected:**
    - The row is not shaded.
    - No change button shows.
  - **Notes:**

- [ ] `4FF9` Select the label **Site**, whose value reads 'Corran Quay'.
  - **Expected:** A list of sites opens in place of the value.
  - **Notes:**

- [ ] `B146` Press Esc.
  - **Expected:** **Site** reads 'Corran Quay' again.
  - **Notes:**

- [ ] `228A` Point at the **Site** row, and select the change button beside 'Corran Quay'.
  - **Expected:** A list of sites opens in place of the value.
  - **Notes:**

- [ ] `069B` Select 'Kestrel Bay'.
  - **Expected:**
    - **Site** reads 'Kestrel Bay'.
    - A hollow yellow dot is before it.
    - Under it, a green dot, then 'Corran Quay' in grey.
    - Her **Site** cell in the table reads 'Kestrel Bay' too.
    - Focus is on the change button beside **Site**.
    - No notification shows.
  - **Notes:**

- [ ] `3E0E` Press Cmd+Z on a Mac, or Ctrl+Z otherwise.
  - **Expected:**
    - **Site** in the panel reads 'Corran Quay' again.
    - **Site** in the panel has no dot.
    - Her **Site** cell in the table reads 'Corran Quay' again.
    - Her **Site** cell has no dot.
  - **Notes:**

- [ ] `BC50` Select the word **None** beside **Team name**.
  - **Expected:** A box to type in opens in place of **None**.
  - **Notes:**

- [ ] `73E5` Type `Harbour team`, and press Enter.
  - **Expected:**
    - **Team name** reads `Harbour team`.
    - A hollow yellow dot is before it.
    - Under it, a green dot, then "None" in grey.
  - **Notes:**

- [ ] `213B` Select the change button beside **End**.
  - **Expected:** A box to type a date in opens beside **End**.
  - **Notes:**

- [ ] `0F54` Type `2014-01-01`, and press Enter.
  - **Expected:**
    - The field stays open, outlined in red.
    - "The end date cannot be before the start date" shows in red under it.
  - **Notes:**

- [ ] `4F10` Press Esc.
  - **Expected:**
    - The field closes.
    - **End** shows no date.
    - The red line has gone.
    - The panel stays open.
  - **Notes:**

- [ ] `B042` Press Shift+Tab until the change button beside **Position** has focus.
  - **Expected:** The change button beside **Position** shows the focus outline.
  - **Notes:**

- [ ] `F89B` Press Enter.
  - **Expected:** A list of positions opens.
  - **Notes:**

- [ ] `BE66` Press the down arrow until 'SDET' is highlighted.
  - **Expected:** 'SDET' is highlighted in the list.
  - **Notes:**

- [ ] `790F` Press Enter.
  - **Expected:**
    - The list closes.
    - **Position** reads 'SDET'.
    - A hollow yellow dot is before it.
    - 'SDET' under the heading at the top of the panel follows it.
  - **Notes:**

- [ ] `85EE` Select the change button beside **Grade**.
  - **Expected:** A list of grades opens.
  - **Notes:**

- [ ] `DA41` Press Esc.
  - **Expected:**
    - The list closes.
    - **Grade** reads as it did.
  - **Notes:**

- [ ] `CCD6` Select **Draft** above the table, then **Live only**.
  - **Expected:**
    - The Draft menu stays open.
    - A tick is before **Live only**.
  - **Notes:**

- [ ] `A318` Press Esc.
  - **Expected:**
    - The Draft menu closes.
    - **Manager?** reads "Yes" with no checkbox.
  - **Notes:**

- [ ] `F8BF` Point at the **Site** row.
  - **Expected:**
    - The row is not shaded.
    - No change button shows.
  - **Notes:**

- [ ] `24A6` Select **Draft**, then **Drafts & Live**.
  - **Expected:**
    - The Draft menu stays open.
    - A tick is before **Drafts & Live**.
  - **Notes:**

- [ ] `CA4C` Press Esc.
  - **Expected:** The Draft menu closes.
  - **Notes:**

- [ ] `1FA1` Point at the **Site** row.
  - **Expected:** A change button shows at the right of its value.
  - **Notes:**

### DETAILS-09: Changing a Person's Details Beside the Org Chart

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DETAILS-08.

**Preconditions:** **Org chart** page open from the left-hand menu.

- [ ] `2DC2` In the finder above the chart, type `Lorenza Thiel`, and choose her in the list that opens.
  - **Expected:** The finder reads 'Lorenza Thiel'.
  - **Notes:**

- [ ] `DAD2` Select her name on her card.
  - **Expected:**
    - The details panel shows 'Lorenza Thiel'.
    - **Team name** reads `Harbour team`.
    - A hollow yellow dot is before it.
    - Her card shows `Harbour team` too.
  - **Notes:**

- [ ] `89CD` Select the change button beside **Team name**.
  - **Expected:** A box to type in opens, holding `Harbour team`.
  - **Notes:**

- [ ] `23C0` Replace the text with `Quayside team`, and press Enter.
  - **Expected:**
    - In the panel, **Team name** reads `Quayside team`.
    - A hollow yellow dot is before it.
    - Within a moment, her card shows `Quayside team` as well.
  - **Notes:**

- [ ] `2BA5` Select the change button beside **Onboarding**, under **Columns**.
  - **Expected:**
    - A second panel opens under her details, headed "Onboarding for Lorenza Thiel".
    - The second panel has **Clear**, **Cancel** and **Save** buttons.
    - Her details stay above it.
    - The two panels share the height.
  - **Notes:**

- [ ] `760D` Type `Laptop ready` in the note.
  - **Expected:** The note holds `Laptop ready`.
  - **Notes:**

- [ ] `22B6` Press Cmd+Z on a Mac, or Ctrl+Z otherwise.
  - **Expected:**
    - `Laptop ready` goes from the note.
    - **Team name** still reads `Quayside team`.
    - A hollow yellow dot is before it.
    - Her card still shows `Quayside team`.
  - **Notes:**

- [ ] `4E87` Type `Laptop ready` in the note.
  - **Expected:** The note holds `Laptop ready`.
  - **Notes:**

- [ ] `7F51` Select the name on the card for 'Silje Holm-Schrøder'.
  - **Expected:**
    - A box asks "Discard changes to the note?"
    - It offers **Keep writing** and **Discard**.
    - The details behind it still show 'Lorenza Thiel'.
  - **Notes:**

- [ ] `D790` Select **Keep writing**.
  - **Expected:**
    - The box closes.
    - The details still show 'Lorenza Thiel'.
    - The note panel still holds `Laptop ready`.
  - **Notes:**

- [ ] `F45F` Select the name on the card for 'Silje Holm-Schrøder' again.
  - **Expected:** The box asking "Discard changes to the note?" opens again.
  - **Notes:**

- [ ] `6ACD` Select **Discard**.
  - **Expected:**
    - The details show 'Silje Holm-Schrøder'.
    - The note panel has closed.
  - **Notes:**

- [ ] `B481` Select 'Tanushree Patel-Singh' under **Direct reports**.
  - **Expected:** The details show 'Tanushree Patel-Singh'.
  - **Notes:**

- [ ] `D126` Select the change button beside **Onboarding**.
  - **Expected:**
    - Tanushree's note opens under her details, headed "Onboarding for Tanushree Patel-Singh".
    - The note shows her checklist.
  - **Notes:**

- [ ] `406C` Without changing the note, select 'Silje Holm-Schrøder' beside **Manager**.
  - **Expected:**
    - Nothing asks.
    - The details show Silje.
    - The note panel closes.
  - **Notes:**

- [ ] `3F4B` Select 'Lorenza Thiel' under **Direct reports**.
  - **Expected:** The details show 'Lorenza Thiel'.
  - **Notes:**

- [ ] `E566` Run Restore the Seed Data.
  - **Expected:**
    - After the reload, her details show no dot.
    - **Team name** reads "None".
  - **Notes:**

### DETAILS-10: A Planned Hire's Details Open Beside People

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DETAILS-09.

**Preconditions:** **People** page open from the left-hand menu.

- [ ] `51CD` In the search box above the table, type `TBD-3`.
  - **Expected:** Three rows show:
    - 'Engineering Manager, TBD-3', its name in grey italics
    - 'Platform engineer', with 'Engineering Manager, TBD-3' in **Manager**
    - 'SDET, TBD-5', with 'Engineering Manager, TBD-3' in **Manager**
  - **Notes:**

- [ ] `F91F` Select the details button in the row for 'Engineering Manager, TBD-3', the box with a line down its right side that shows at the right of its **Name** cell while the row is pointed at.
  - **Expected:**
    - The details panel opens, headed 'Engineering Manager, TBD-3'.
    - Under the heading, 'Engineering Manager', then a grey box reading **Planned, no date**.
    - There is no **Show on org chart** link.
  - **Notes:**

- [ ] `162C` Read the **Reporting** and **Details** sections.
  - **Expected:**
    - **Manager** reads "No manager".
    - **Direct reports** lists 'Platform engineer' and 'SDET, TBD-5'.
    - **Details** shows:
      - **ID** 'TBD-3'
      - **State** "Request to hire"
      - no **Expected**
      - no **End**
    - **Manager?** shows a ticked checkbox and "Yes".
  - **Notes:**

- [ ] `82AE` Point at the **Expected** row.
  - **Expected:** No change button shows.
  - **Notes:**

- [ ] `72F0` Select 'SDET, TBD-5' under **Direct reports**.
  - **Expected:**
    - The panel shows 'SDET, TBD-5'.
    - **Manager** reads 'Engineering Manager, TBD-3', as a link.
  - **Notes:**

- [ ] `E26F` Select the change button beside **Name**.
  - **Expected:** A box to type in opens beside **Name**.
  - **Notes:**

- [ ] `1DDD` Type `Fictional test lead`, and press Enter.
  - **Expected:**
    - **Name** reads `Fictional test lead`.
    - A hollow yellow dot is before it.
    - The heading reads `Fictional test lead`.
    - Its row in the table reads `Fictional test lead` too.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### DETAILS-11: A Person Is Added From New

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DETAILS-10.

**Preconditions:** **People** page open from the left-hand menu.

- [ ] `E8C4` Select **New person** at the top right of the page.
  - **Expected:**
    - The details panel opens, headed **New person**.
    - Its first row is **State**, reading "Hired".
    - **Name**, **ID**, **Start**, **End**, **Manager assigned** and **Team name** are empty boxes to type in.
    - **Manager?** is an empty checkbox.
    - **Cancel** and **Add** are at the foot of the panel.
  - **Notes:**

- [ ] `6EA7` Point at the **State** row.
  - **Expected:** A change button shows at the right of "Hired".
  - **Notes:**

- [ ] `E80E` Type `Fictional Newcomer` in **Name**, and press Tab.
  - **Expected:**
    - **Name** holds `Fictional Newcomer`.
    - Focus moves on from **Name**.
  - **Notes:**

- [ ] `7D73` Type `E10007` in **ID**, and press Tab.
  - **Expected:**
    - The **ID** box is outlined in red.
    - "Someone already has that ID" shows in red under it.
  - **Notes:**

- [ ] `54FB` Replace the ID with `E20001`, and press Tab.
  - **Expected:** The red line under **ID** has gone.
  - **Notes:**

- [ ] `25B0` Select **Add**.
  - **Expected:**
    - "Position needed" shows in red under **Position**.
    - "Grade needed" shows in red under **Grade**.
    - Focus is on the change button beside **Position**.
    - Nothing is added to the table.
  - **Notes:**

- [ ] `42D9` Select the change button beside **Position**, and choose 'Software Engineer' in the list that opens.
  - **Expected:** **Position** reads 'Software Engineer'.
  - **Notes:**

- [ ] `162B` Select the change button beside **Grade**, and choose 'P2' in the list that opens.
  - **Expected:** **Grade** reads 'P2'.
  - **Notes:**

- [ ] `6D1F` Select **Add**.
  - **Expected:**
    - The panel's heading: a hollow yellow dot, then `Fictional Newcomer`.
    - 'Software Engineer' is under the heading.
    - Change buttons show beside its values.
    - Her row is in the table.
    - Her row has a hollow yellow dot in its slot.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### DETAILS-12: State Decides Whether a Person or a Planned Hire Is Added

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DETAILS-11.

**Preconditions:** **People** page open from the left-hand menu.

- [ ] `AFE6` Select **New person**.
  - **Expected:** The details panel opens, headed **New person**.
  - **Notes:**

- [ ] `2D82` Type `Fictional Opening` in **Name**.
  - **Expected:** **Name** holds `Fictional Opening`.
  - **Notes:**

- [ ] `A798` Type `2027-06-30` in **End**, and press Tab.
  - **Expected:**
    - The panel is still headed **New person**.
    - **End** holds `2027-06-30`.
  - **Notes:**

- [ ] `D0F8` Select the change button beside **State**.
  - **Expected:** A list opens offering **Hired**, **Left**, **Request to hire** and **Approved to hire**.
  - **Notes:**

- [ ] `76FC` Choose **Request to hire**.
  - **Expected:**
    - The heading reads **New planned hire**.
    - Under **State**, a grey line reads "End was cleared, since a planned hire doesn't have it."
    - **Name** still holds `Fictional Opening`.
    - There is no **End**, **Manager assigned** or **Team name**.
  - **Notes:**

- [ ] `33E9` Select the **×** in the **Name** box.
  - **Expected:** The **Name** box is empty.
  - **Notes:**

- [ ] `5E8A` Select the change button beside **Position**, and choose 'SDET' in the list that opens.
  - **Expected:** **Position** reads 'SDET'.
  - **Notes:**

- [ ] `05F6` Type `REQ-4100` in **ID**, and press Tab.
  - **Expected:**
    - The **Name** box is empty.
    - The **Name** box shows "SDET, REQ-4100" in grey.
  - **Notes:**

- [ ] `4BD8` Select the **×** at the top right of the panel.
  - **Expected:**
    - A box asks "Discard the new planned hire?"
    - It offers **Keep adding** and **Discard**.
  - **Notes:**

- [ ] `95B4` Select **Keep adding**.
  - **Expected:**
    - The box closes.
    - The panel still shows **New planned hire**.
    - **Name** shows "SDET, REQ-4100" in grey.
  - **Notes:**

- [ ] `3EAB` Select **Cancel** at the foot of the panel.
  - **Expected:** The box asking "Discard the new planned hire?" opens again.
  - **Notes:**

- [ ] `E90C` Select **Discard**.
  - **Expected:**
    - The panel closes.
    - No row for `Fictional Opening` is in the table.
  - **Notes:**
