---
title: "Manual Test: Person Details"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/person-panel*", "apps/web/src/person-change.ts", "apps/web/src/people-grid.tsx", "apps/web/src/org-chart-page.tsx", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-11"
---

# Manual Test: Person Details

## Scope

Verifies a person's or planned hire's details in the side panel beside the org chart and People: what it shows of them, moving to another person, drafted values beside live ones and following the Draft menu, the red **Left** box on someone who has left, opening and closing it with the mouse and the keyboard, how it reads in light and dark mode, resized, and in a narrow window, changing their details there, beside People and the org chart, being asked before a changed note is discarded, and adding a person or planned hire from **New**.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A mouse or trackpad.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Engineering Manager:** `engineering.manager@fathom.test`
- **Resource Planner:** `resource.planner@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the Appearance menu, marks and the Draft menu. This test adds:

- **Details panel:** the panel that slides out on the right of the org chart or the **People** table, headed with a person's or planned hire's name, with the sections **Reporting**, **Details** and **Columns**, each a list of labels on the left and values on the right, and an **×** at its top right.
- **New:** the button at the top right of the **People** page, which opens the details panel to add a person or planned hire.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### DETAILS-01: A Person's Details Open Beside the Org Chart

**Account:** Engineering Manager, `engineering.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Light** chosen in the Appearance menu. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** On the card at the top of the chart, select the name **Silje Holm-Schrøder**.
  - **Expected:**
    - The details panel slides out on the right, headed **Silje Holm-Schrøder**.
    - **Engineering Manager** is under the heading, and the link **Show in People** under that.
    - The chart narrows to make room.
    - Her card, with a blue ring around it, stays in the middle of the space left beside the panel.
  - **Notes:**

- [ ] **Step 2.** Read the **Reporting** section.
  - **Expected:**
    - **Manager** reads **No manager**.
    - **Team name** reads **Platform team**, after a small teal dot.
    - **Direct reports** lists the people under her on the org chart, from **Blaise Gislason** to **武井 聡**, among them:
      - **Tanushree Patel-Singh**
      - **Simone Jean**, with a yellow dot before her name
      - **Chatura Abbott**, who has not started yet, followed in grey by **Starts** and a day after today
    - **Marceau Leroux** is not listed.
  - **Notes:**

- [ ] **Step 3.** Read the **Details** and **Columns** sections, scrolling the panel if needed.
  - **Expected:**
    - **Details** shows:
      - **ID** **E10007**
      - **Position** **Engineering Manager**
      - **State** **Hired**
      - **Start** a date
      - no **End**
      - **Manager?** **Yes**
    - **Columns** shows:
      - **Grade** **M1**
      - **Site** **Ashgrove**
      - **Role on team** **Design Authority**
  - **Notes:**

- [ ] **Step 4.** Select **Tanushree Patel-Singh** under **Direct reports**.
  - **Expected:**
    - The panel now shows **Tanushree Patel-Singh**.
    - **Onboarding** under **Columns** shows, in order:
      - the heading **First weeks**
      - a checklist of four steps with only **Laptop and accounts ready** ticked, and the buddy's name **Elly Gunther** in bold
      - **On track** in teal
      - a line ending with the link **onboarding guide**
  - **Notes:**

- [ ] **Step 5.** Go back with the browser's back button.
  - **Expected:** The panel shows **Silje Holm-Schrøder** again.
  - **Notes:**

- [ ] **Step 6.** Select the **×** at the top right of the panel.
  - **Expected:**
    - The panel slides away.
    - The chart fills the page again.
  - **Notes:**

### DETAILS-02: A Drafted Value Shows Beside the Live One

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as DETAILS-01.

**Preconditions:** **Org chart** page open, as DETAILS-01 ends.

- [ ] **Step 1.** Select the name on the card for **Simone Jean**, under **Silje Holm-Schrøder**.
  - **Expected:**
    - The details panel shows **Simone Jean**.
    - **Software Engineer** is under the heading.
  - **Notes:**

- [ ] **Step 2.** Read **Manager** in the **Reporting** section.
  - **Expected:**
    - It reads **Silje Holm-Schrøder**, a link.
    - A yellow dot is before **Silje Holm-Schrøder**.
    - Under it, a green dot, then **Viktoria Holmberg** in grey, then a red **Left** box.
  - **Notes:**

- [ ] **Step 3.** Read **Team** in the same section.
  - **Expected:**
    - It reads **Platform team**, with a yellow dot before it.
    - Under it, a green dot, then **Search team** in grey.
  - **Notes:**

### DETAILS-03: The Details Follow the Draft Menu

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as DETAILS-02.

**Preconditions:** **Org chart** page open, with **Simone Jean** in the details panel, as DETAILS-02 ends.

- [ ] **Step 1.** Select **Draft** above the chart, then **Drafts applied**.
  - **Expected:** The Draft menu stays open, with a tick before **Drafts applied**.
  - **Notes:**

- [ ] **Step 2.** Press Esc.
  - **Expected:**
    - The Draft menu closes.
    - In the panel, **Manager** reads **Silje Holm-Schrøder**, with a yellow dot before it.
    - Nothing is under **Silje Holm-Schrøder**.
    - No value has a green dot.
  - **Notes:**

- [ ] **Step 3.** Select **Draft**, then **Live only**.
  - **Expected:** The Draft menu stays open, with a tick before **Live only**.
  - **Notes:**

- [ ] **Step 4.** Press Esc.
  - **Expected:**
    - The Draft menu closes.
    - In the panel, **Manager** reads **Viktoria Holmberg**, with a green dot before it.
    - A red **Left** box follows **Viktoria Holmberg**.
    - **Team** reads **Search team**, with a green dot before it.
    - No value has a yellow dot.
  - **Notes:**

- [ ] **Step 5.** Select **Draft**, then **Drafts beside live**.
  - **Expected:** The Draft menu stays open, with a tick before **Drafts beside live**.
  - **Notes:**

- [ ] **Step 6.** Press Esc.
  - **Expected:**
    - The Draft menu closes.
    - In the panel, **Manager** reads **Silje Holm-Schrøder**, with a yellow dot before it again.
    - **Viktoria Holmberg** is under it.
  - **Notes:**

### DETAILS-04: Someone Who Has Left Is Marked

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as DETAILS-03.

**Preconditions:** **Org chart** page open, as DETAILS-03 ends.

- [ ] **Step 1.** Select the name on the card for **Viktoria Holmberg**.
  - **Expected:**
    - The details panel shows **Viktoria Holmberg**.
    - Her position is under the heading, then a red **Left** box.
    - **End** under **Details** shows a date before today.
  - **Notes:**

### DETAILS-05: A Person's Details Open Beside People

**Account:** Resource Planner, `resource.planner@fathom.test`, changed from DETAILS-04.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] **Step 1.** In the search box above the table, type **E10026**.
  - **Expected:** Only the row for **Lorenza Thiel** shows.
  - **Notes:**

- [ ] **Step 2.** Point at her row, without selecting anything.
  - **Expected:** A small button, an arrow pointing out of a box, appears at the right of her **Name** cell.
  - **Notes:**

- [ ] **Step 3.** Point away from the row.
  - **Expected:** The arrow button is hidden again.
  - **Notes:**

- [ ] **Step 4.** Point at her row again.
  - **Expected:** The arrow button appears again at the right of her **Name** cell.
  - **Notes:**

- [ ] **Step 5.** Put the pointer on the arrow button, and press the mouse button without letting go.
  - **Expected:** The arrow button stays under the pointer.
  - **Notes:**

- [ ] **Step 6.** Let go of the mouse button.
  - **Expected:**
    - The details panel slides out on the right, headed **Lorenza Thiel**, with the link **Show on org chart** under her position.
    - The table narrows to make room.
    - **Details** shows no **Start** or **End**.
    - **Reporting** shows no **Manager assigned**.
  - **Notes:**

- [ ] **Step 7.** Select **Show on org chart**.
  - **Expected:**
    - The **Org chart** page opens.
    - The finder reads **Lorenza Thiel**.
    - Her card has a blue ring around it.
  - **Notes:**

### DETAILS-06: The Details Open and Close From the Keyboard

**Account:** Resource Planner, `resource.planner@fathom.test`, the same as DETAILS-05.

**Preconditions:** **People** page open from the left-hand menu, searched for **E10026**.

- [ ] **Step 1.** Select the **Name** cell of **Lorenza Thiel**'s row.
  - **Expected:** Her **Name** cell is selected.
  - **Notes:**

- [ ] **Step 2.** Press Shift+F10.
  - **Expected:** Her menu opens, offering **Show details**.
  - **Notes:**

- [ ] **Step 3.** Press the down arrow until **Show details** is highlighted.
  - **Expected:** **Show details** is highlighted.
  - **Notes:**

- [ ] **Step 4.** Press Enter.
  - **Expected:**
    - The details panel opens, headed **Lorenza Thiel**.
    - Focus is on her name at the top of the panel.
  - **Notes:**

- [ ] **Step 5.** Press Esc.
  - **Expected:**
    - The panel closes.
    - The table fills the page again.
    - Focus is back on her **Name** cell.
  - **Notes:**

### DETAILS-07: The Details Read Well in Both Modes, Resized, and in a Narrow Window

**Account:** Resource Planner, `resource.planner@fathom.test`, the same as DETAILS-06.

**Preconditions:** **People** page open, searched for **E10026**, with **Lorenza Thiel**'s details open beside the table. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Read the panel.
  - **Expected:**
    - Labels are in grey on the left and values on the right, each row ruled off from the next.
    - Every word is easy to read.
  - **Notes:**

- [ ] **Step 2.** Choose **Dark** in the Appearance menu.
  - **Expected:**
    - The page turns dark.
    - Every label, value, link and mark in the panel is still easy to read.
  - **Notes:**

- [ ] **Step 3.** Drag the panel's left edge to the left.
  - **Expected:**
    - The panel widens.
    - The table beside it narrows to match.
  - **Notes:**

- [ ] **Step 4.** Drag the panel's left edge to the right, until the panel is narrow.
  - **Expected:**
    - The panel narrows.
    - The table beside it widens to match.
    - Once the panel is narrow, each label sits over its value, instead of a column of labels beside the values.
    - The names under **Direct reports** line up on the left.
  - **Notes:**

- [ ] **Step 5.** Select **Metrics** above the table.
  - **Expected:**
    - The **Metrics** panel opens under the details panel, the two sharing the height.
    - Lorenza's details stay open.
  - **Notes:**

- [ ] **Step 6.** Drag the edge between the two panels up.
  - **Expected:** The edge moves the share between them: the details panel gets shorter and the **Metrics** panel taller.
  - **Notes:**

- [ ] **Step 7.** Drag the edge between the two panels down.
  - **Expected:**
    - The details panel gets taller and the **Metrics** panel shorter.
    - Lorenza's details stay open.
  - **Notes:**

- [ ] **Step 8.** Make the browser window as narrow as it goes.
  - **Expected:**
    - The panel covers the whole window, with each label above its value.
    - Nothing is cut off or overlapping.
  - **Notes:**

- [ ] **Step 9.** Restore the window to its earlier width.
  - **Expected:** The panel is beside the table again.
  - **Notes:**

- [ ] **Step 10.** Choose **Light** in the Appearance menu.
  - **Expected:** The page is light again.
  - **Notes:**

### DETAILS-08: Changing a Person's Details Beside People

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DETAILS-07.

**Preconditions:** Signed in with this account. **Light** chosen in the Appearance menu. **People** page open from the left-hand menu, searched for **E10026**, with **Lorenza Thiel**'s details open beside the table.

- [ ] **Step 1.** Read the panel.
  - **Expected:**
    - Every value under **Reporting**, **Details** and **Columns** has a change button at its right, except **Team** and **Direct reports**.
    - **Details** starts with **Name** **Lorenza Thiel**.
    - **Manager?** shows a ticked checkbox and **Yes** instead of a change button.
  - **Notes:**

- [ ] **Step 2.** Select the change button beside **Site**, which reads **Corran Quay**.
  - **Expected:** A list of sites opens in place of the value.
  - **Notes:**

- [ ] **Step 3.** Select **Kestrel Bay**.
  - **Expected:**
    - **Site** reads **Kestrel Bay**, with a hollow yellow dot before it.
    - Under it, a green dot, then **Corran Quay** in grey.
    - Her **Site** cell in the table reads **Kestrel Bay** too.
    - Focus is on the change button beside **Site**.
    - No notification shows.
  - **Notes:**

- [ ] **Step 4.** Press Cmd+Z on a Mac, or Ctrl+Z otherwise.
  - **Expected:**
    - **Site** in the panel reads **Corran Quay** again, with no dot.
    - Her **Site** cell in the table reads **Corran Quay** again, with no dot.
  - **Notes:**

- [ ] **Step 5.** Select the word **None** beside **Team name**.
  - **Expected:** A box to type in opens in place of **None**.
  - **Notes:**

- [ ] **Step 6.** Type **Harbour team**, and press Enter.
  - **Expected:**
    - **Team name** reads **Harbour team**, with a hollow yellow dot before it.
    - Under it, a green dot, then **None** in grey.
  - **Notes:**

- [ ] **Step 7.** Select the change button beside **End**.
  - **Expected:** A box to type a date in opens beside **End**.
  - **Notes:**

- [ ] **Step 8.** Type **2014-01-01**, and press Enter.
  - **Expected:**
    - The field stays open, outlined in red.
    - **The end date cannot be before the start date** shows in red under it.
  - **Notes:**

- [ ] **Step 9.** Press Esc.
  - **Expected:**
    - The field closes, and **End** shows no date.
    - The red line has gone.
    - The panel stays open.
  - **Notes:**

- [ ] **Step 10.** Press Shift+Tab until the change button beside **Position** has focus.
  - **Expected:** The change button beside **Position** shows the focus outline.
  - **Notes:**

- [ ] **Step 11.** Press Enter.
  - **Expected:** A list of positions opens.
  - **Notes:**

- [ ] **Step 12.** Press the down arrow until **SDET** is highlighted.
  - **Expected:** **SDET** is highlighted in the list.
  - **Notes:**

- [ ] **Step 13.** Press Enter.
  - **Expected:**
    - The list closes.
    - **Position** reads **SDET**, with a hollow yellow dot before it.
    - **SDET** under the heading at the top of the panel follows it.
  - **Notes:**

- [ ] **Step 14.** Choose **Dark** in the Appearance menu.
  - **Expected:** The page turns dark.
  - **Notes:**

- [ ] **Step 15.** Select the change button beside **Grade**.
  - **Expected:**
    - A list of grades opens.
    - The list of grades is easy to read on the dark page.
    - Every value, mark and change button in the panel is easy to read on the dark page.
  - **Notes:**

- [ ] **Step 16.** Press Esc.
  - **Expected:**
    - The list closes.
    - **Grade** reads as it did.
  - **Notes:**

- [ ] **Step 17.** Choose **Light** in the Appearance menu.
  - **Expected:** The page is light again.
  - **Notes:**

- [ ] **Step 18.** Select **Draft** above the table, then **Live only**.
  - **Expected:** The Draft menu stays open, with a tick before **Live only**.
  - **Notes:**

- [ ] **Step 19.** Press Esc.
  - **Expected:**
    - The Draft menu closes.
    - The panel shows no change buttons.
    - **Manager?** reads **Yes** with no checkbox.
  - **Notes:**

- [ ] **Step 20.** Select **Draft**, then **Drafts beside live**.
  - **Expected:** The Draft menu stays open, with a tick before **Drafts beside live**.
  - **Notes:**

- [ ] **Step 21.** Press Esc.
  - **Expected:**
    - The Draft menu closes.
    - The change buttons show again.
  - **Notes:**

### DETAILS-09: Changing a Person's Details Beside the Org Chart

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DETAILS-08.

**Preconditions:** **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** In the finder above the chart, type **Lorenza Thiel**, and choose her in the list that opens.
  - **Expected:** The finder reads **Lorenza Thiel**.
  - **Notes:**

- [ ] **Step 2.** Select her name on her card.
  - **Expected:**
    - The details panel shows **Lorenza Thiel**.
    - **Team name** reads **Harbour team**, with a hollow yellow dot before it.
    - Her card shows **Harbour team** too.
  - **Notes:**

- [ ] **Step 3.** Select the change button beside **Team name**.
  - **Expected:** A box to type in opens, holding **Harbour team**.
  - **Notes:**

- [ ] **Step 4.** Replace the text with **Quayside team**, and press Enter.
  - **Expected:**
    - In the panel, **Team name** reads **Quayside team**, with a hollow yellow dot before it.
    - Within a moment, her card shows **Quayside team** as well.
  - **Notes:**

- [ ] **Step 5.** Select the change button beside **Onboarding**, under **Columns**.
  - **Expected:**
    - A second panel opens under her details, headed **Onboarding for Lorenza Thiel**, with **Clear**, **Cancel** and **Save** buttons.
    - Her details stay above it, the two sharing the height.
  - **Notes:**

- [ ] **Step 6.** Type **Laptop ready** in the note.
  - **Expected:** The note holds **Laptop ready**.
  - **Notes:**

- [ ] **Step 7.** Press Cmd+Z on a Mac, or Ctrl+Z otherwise.
  - **Expected:**
    - **Laptop ready** goes from the note.
    - **Team name** still reads **Quayside team**, with a hollow yellow dot before it.
    - Her card still shows **Quayside team**.
  - **Notes:**

- [ ] **Step 8.** Type **Laptop ready** in the note.
  - **Expected:** The note holds **Laptop ready**.
  - **Notes:**

- [ ] **Step 9.** Select the name on the card for **Silje Holm-Schrøder**.
  - **Expected:**
    - A box asks **Discard changes to the note?**, with **Keep writing** and **Discard**.
    - The details behind it still show **Lorenza Thiel**.
  - **Notes:**

- [ ] **Step 10.** Select **Keep writing**.
  - **Expected:**
    - The box closes.
    - The details still show **Lorenza Thiel**.
    - The note panel still holds **Laptop ready**.
  - **Notes:**

- [ ] **Step 11.** Select the name on the card for **Silje Holm-Schrøder** again.
  - **Expected:** The box asking **Discard changes to the note?** opens again.
  - **Notes:**

- [ ] **Step 12.** Select **Discard**.
  - **Expected:**
    - The details show **Silje Holm-Schrøder**.
    - The note panel has closed.
  - **Notes:**

- [ ] **Step 13.** Select **Tanushree Patel-Singh** under **Direct reports**.
  - **Expected:** The details show **Tanushree Patel-Singh**.
  - **Notes:**

- [ ] **Step 14.** Select the change button beside **Onboarding**.
  - **Expected:** Tanushree's note opens under her details, headed **Onboarding for Tanushree Patel-Singh** and showing her checklist.
  - **Notes:**

- [ ] **Step 15.** Without changing the note, select **Silje Holm-Schrøder** beside **Manager**.
  - **Expected:**
    - Nothing asks.
    - The details show Silje.
    - The note panel closes.
  - **Notes:**

- [ ] **Step 16.** Select **Lorenza Thiel** under **Direct reports**.
  - **Expected:** The details show **Lorenza Thiel**.
  - **Notes:**

- [ ] **Step 17.** Run Restore the Seed Data.
  - **Expected:**
    - After the reload, her details show no dot.
    - **Team name** reads **None**.
  - **Notes:**

### DETAILS-10: A Planned Hire's Details Open Beside People

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DETAILS-09.

**Preconditions:** **People** page open from the left-hand menu. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** In the search box above the table, type **TBD-3**.
  - **Expected:** Three rows show:
    - **Engineering Manager, TBD-3**, its name in grey italics
    - **Platform engineer**, with **Engineering Manager, TBD-3** in **Manager**
    - **SDET, TBD-5**, with **Engineering Manager, TBD-3** in **Manager**
  - **Notes:**

- [ ] **Step 2.** Select the details button in the row for **Engineering Manager, TBD-3**, the arrow out of a box that shows at the right of its **Name** cell while the row is pointed at.
  - **Expected:**
    - The details panel opens, headed **Engineering Manager, TBD-3**.
    - Under the heading, **Engineering Manager**, then a grey box reading **Planned, expected** and this month, such as **Nov 2026**.
    - There is no **Show on org chart** link.
  - **Notes:**

- [ ] **Step 3.** Read the **Reporting** and **Details** sections.
  - **Expected:**
    - **Manager** reads **No manager**.
    - **Direct reports** lists **Platform engineer** and **SDET, TBD-5**.
    - **Details** shows:
      - **ID** **TBD-3**
      - **State** **Request to hire**
      - **Expected** **Nov 2026**
      - no **End**
    - **Manager?** shows a ticked checkbox and **Yes**.
    - Every other value has a change button, except **Team**, **Expected** and **Direct reports**.
  - **Notes:**

- [ ] **Step 4.** Select **SDET, TBD-5** under **Direct reports**.
  - **Expected:**
    - The panel shows **SDET, TBD-5**.
    - **Manager** reads **Engineering Manager, TBD-3**, as a link.
  - **Notes:**

- [ ] **Step 5.** Select the change button beside **Name**.
  - **Expected:** A box to type in opens beside **Name**.
  - **Notes:**

- [ ] **Step 6.** Type **Fictional test lead**, and press Enter.
  - **Expected:**
    - **Name** reads **Fictional test lead**, with a hollow yellow dot before it.
    - The heading reads **Fictional test lead**.
    - Its row in the table reads **Fictional test lead** too.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### DETAILS-11: A Person Is Added From New

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DETAILS-10.

**Preconditions:** **People** page open from the left-hand menu. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Select **New** at the top right of the page.
  - **Expected:**
    - The details panel opens, headed **New person**.
    - Its first row is **State**, reading **Hired**, with a change button.
    - **Name**, **ID**, **Start**, **End**, **Manager assigned** and **Team name** are empty boxes to type in.
    - **Manager?** is an empty checkbox.
    - The other values have change buttons.
    - **Cancel** and **Add** are at the foot of the panel.
  - **Notes:**

- [ ] **Step 2.** Type **Fictional Newcomer** in **Name**, and press Tab.
  - **Expected:**
    - **Name** holds **Fictional Newcomer**.
    - Focus moves on from **Name**.
  - **Notes:**

- [ ] **Step 3.** Type **E10007** in **ID**, and press Tab.
  - **Expected:**
    - The **ID** box is outlined in red.
    - **Someone already has that ID** shows in red under it.
  - **Notes:**

- [ ] **Step 4.** Replace the ID with **E20001**, and press Tab.
  - **Expected:** The red line under **ID** has gone.
  - **Notes:**

- [ ] **Step 5.** Select **Add**.
  - **Expected:**
    - **Position needed** shows in red under **Position**.
    - **Grade needed** shows in red under **Grade**.
    - Focus is on the change button beside **Position**.
    - Nothing is added to the table.
  - **Notes:**

- [ ] **Step 6.** Select the change button beside **Position**, and choose **Software Engineer** in the list that opens.
  - **Expected:** **Position** reads **Software Engineer**.
  - **Notes:**

- [ ] **Step 7.** Select the change button beside **Grade**, and choose **P2** in the list that opens.
  - **Expected:** **Grade** reads **P2**.
  - **Notes:**

- [ ] **Step 8.** Select **Add**.
  - **Expected:**
    - The panel's heading: a hollow yellow dot, then **Fictional Newcomer**, with **Software Engineer** under it.
    - Change buttons show beside its values.
    - Her row is in the table, with a hollow yellow dot in its slot.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### DETAILS-12: State Decides Whether a Person or a Planned Hire Is Added

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DETAILS-11.

**Preconditions:** **People** page open from the left-hand menu. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Select **New**.
  - **Expected:** The details panel opens, headed **New person**.
  - **Notes:**

- [ ] **Step 2.** Type **Fictional Opening** in **Name**.
  - **Expected:** **Name** holds **Fictional Opening**.
  - **Notes:**

- [ ] **Step 3.** Type **2027-06-30** in **End**, and press Tab.
  - **Expected:**
    - The panel is still headed **New person**.
    - **End** holds **2027-06-30**.
  - **Notes:**

- [ ] **Step 4.** Select the change button beside **State**.
  - **Expected:** A list opens offering **Hired**, **Left**, **Request to hire** and **Approved to hire**.
  - **Notes:**

- [ ] **Step 5.** Choose **Request to hire**.
  - **Expected:**
    - The heading reads **New planned hire**.
    - Under **State**, a grey line reads **End was cleared, since a planned hire doesn't have it.**
    - **Name** still holds **Fictional Opening**.
    - There is no **End**, **Manager assigned** or **Team name**.
  - **Notes:**

- [ ] **Step 6.** Select the **×** in the **Name** box.
  - **Expected:** The **Name** box is empty.
  - **Notes:**

- [ ] **Step 7.** Select the change button beside **Position**, and choose **SDET** in the list that opens.
  - **Expected:** **Position** reads **SDET**.
  - **Notes:**

- [ ] **Step 8.** Type **REQ-4100** in **ID**, and press Tab.
  - **Expected:** The **Name** box is empty, showing **SDET, REQ-4100** in grey.
  - **Notes:**

- [ ] **Step 9.** Choose **Dark** in the Appearance menu, and read the panel.
  - **Expected:**
    - Every label, value, box and button in the panel is easy to read.
    - The grey line is easy to read.
  - **Notes:**

- [ ] **Step 10.** Choose **Light** in the Appearance menu.
  - **Expected:** The page is light again.
  - **Notes:**

- [ ] **Step 11.** Select the **×** at the top right of the panel.
  - **Expected:** A box asks **Discard the new planned hire?**, with **Keep adding** and **Discard**.
  - **Notes:**

- [ ] **Step 12.** Select **Keep adding**.
  - **Expected:**
    - The box closes.
    - The panel still shows **New planned hire**, with **SDET, REQ-4100** in grey in **Name**.
  - **Notes:**

- [ ] **Step 13.** Select **Cancel** at the foot of the panel.
  - **Expected:** The box asking **Discard the new planned hire?** opens again.
  - **Notes:**

- [ ] **Step 14.** Select **Discard**.
  - **Expected:**
    - The panel closes.
    - No row for **Fictional Opening** is in the table.
  - **Notes:**
