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

Verifies a person's or planned hire's details in the side panel beside the org chart and People: what it shows of them, moving to another person, drafted values beside live ones and following the Draft menu, the mark on someone who has left, opening and closing it with the mouse and the keyboard, how it reads in light and dark mode, resized, and in a narrow window, changing their details there, beside People and the org chart, being asked before a changed note is discarded, and adding a person or planned hire from **New**.

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

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Check each step whose expected result you see, and write anything else under its notes.

### DETAILS-01: A Person's Details Open Beside the Org Chart

**Account:** Engineering Manager, `engineering.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Light** chosen in the Appearance menu. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** On the card at the top of the chart, select the name **Silje Holm-Schrøder**.
  - **Expected:** The details panel slides out on the right, headed **Silje Holm-Schrøder**, with **Engineering Manager** under the heading and the link **Show in People** under that. The chart narrows to make room, and her card, with a blue ring around it, stays in the middle of the space left beside the panel.
  - **Notes:**

- [ ] **Step 2.** Read the **Reporting** section.
  - **Expected:** **Manager** reads **No manager**. **Team name** reads **Platform team**, after a small teal dot. **Direct reports** lists the people under her on the org chart, from **Blaise Gislason** to **武井 聡**, among them **Tanushree Patel-Singh**, and **Simone Jean** followed by a yellow dot and **Draft**, and **Chatura Abbott**, who has not started yet, followed in grey by **Starts** and a day after today. **Marceau Leroux** is not listed.
  - **Notes:**

- [ ] **Step 3.** Read the **Details** and **Columns** sections, scrolling the panel if needed.
  - **Expected:** **Details** shows **ID** **E10007**, **Position** **Engineering Manager**, **State** **Hired**, **Start** a date, no **End**, and **Manager?** **Yes**. **Columns** shows **Grade** **M1**, **Site** **Ashgrove** and **Role on team** **Design Authority**.
  - **Notes:**

- [ ] **Step 4.** Select **Tanushree Patel-Singh** under **Direct reports**, and read **Onboarding** under **Columns**.
  - **Expected:** The panel now shows **Tanushree Patel-Singh**. **Onboarding** shows the heading **First weeks**, then a checklist of four steps with only **Laptop and accounts ready** ticked and the buddy's name **Elly Gunther** in bold, then **On track** in teal, then a line ending with the link **onboarding guide**.
  - **Notes:**

- [ ] **Step 5.** Go back with the browser's back button.
  - **Expected:** The panel shows **Silje Holm-Schrøder** again.
  - **Notes:**

- [ ] **Step 6.** Select the **×** at the top right of the panel.
  - **Expected:** The panel slides away, and the chart fills the page again.
  - **Notes:**

### DETAILS-02: A Drafted Value Shows Beside the Live One

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as DETAILS-01.

**Preconditions:** **Org chart** page open, as DETAILS-01 ends.

- [ ] **Step 1.** Select the name on the card for **Simone Jean**, under **Silje Holm-Schrøder**.
  - **Expected:** The details panel shows **Simone Jean**, with **Software Engineer** under the heading.
  - **Notes:**

- [ ] **Step 2.** Read **Manager** in the **Reporting** section.
  - **Expected:** It reads **Silje Holm-Schrøder**, a link, followed by a yellow dot and **Draft**. Under it, in grey, **Viktoria Holmberg** is followed by a green dot and **Live**.
  - **Notes:**

- [ ] **Step 3.** Read **Team** in the same section.
  - **Expected:** It reads **Platform team**, followed by a yellow dot and **Draft**, with **Search team** under it, in grey, followed by a green dot and **Live**.
  - **Notes:**

### DETAILS-03: The Details Follow the Draft Menu

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as DETAILS-02.

**Preconditions:** **Org chart** page open, with **Simone Jean** in the details panel, as DETAILS-02 ends.

- [ ] **Step 1.** Select **Draft** above the chart, then **Drafts applied**, then press Esc.
  - **Expected:** In the panel, **Manager** reads **Silje Holm-Schrøder** with no mark and nothing under it, and no value has a green dot and **Live**.
  - **Notes:**

- [ ] **Step 2.** Select **Draft**, then **Live only**, then press Esc.
  - **Expected:** In the panel, **Manager** reads **Viktoria Holmberg**, and **Team** reads **Search team**, each with no mark.
  - **Notes:**

- [ ] **Step 3.** Select **Draft**, then **Drafts beside live**, then press Esc.
  - **Expected:** In the panel, **Manager** reads **Silje Holm-Schrøder** followed by a yellow dot and **Draft** again.
  - **Notes:**

### DETAILS-04: Someone Who Has Left Is Marked

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as DETAILS-03.

**Preconditions:** **Org chart** page open, as DETAILS-03 ends.

- [ ] **Step 1.** Select the name on the card for **Viktoria Holmberg**.
  - **Expected:** The details panel shows **Viktoria Holmberg**, with a red dot and **Left** after her position. **End** under **Details** shows a date before today.
  - **Notes:**

### DETAILS-05: A Person's Details Open Beside People

**Account:** Resource Planner, `resource.planner@fathom.test`, changed from DETAILS-04.

**Preconditions:** Signed in with this account. **People** page open from the left-hand menu.

- [ ] **Step 1.** In the search box above the table, type **E10026**.
  - **Expected:** Only the row for **Lorenza Thiel** shows.
  - **Notes:**

- [ ] **Step 2.** Point at her row, without selecting anything.
  - **Expected:** A small button, an arrow pointing out of a box, appears at the right of her **Name** cell. Pointing away from the row hides it again.
  - **Notes:**

- [ ] **Step 3.** Point at her row again, put the pointer on that arrow button, and press the mouse button without letting go.
  - **Expected:** The arrow button stays under the pointer.
  - **Notes:**

- [ ] **Step 4.** Let go of the mouse button.
  - **Expected:** The details panel slides out on the right, headed **Lorenza Thiel**, with the link **Show on org chart** under her position, and the table narrows to make room. **Details** shows no **Start** or **End**, and **Reporting** shows no **Manager assigned**.
  - **Notes:**

- [ ] **Step 5.** Select **Show on org chart**.
  - **Expected:** The **Org chart** page opens. The finder reads **Lorenza Thiel**, and her card has a blue ring around it.
  - **Notes:**

### DETAILS-06: The Details Open and Close From the Keyboard

**Account:** Resource Planner, `resource.planner@fathom.test`, the same as DETAILS-05.

**Preconditions:** **People** page open from the left-hand menu, searched for **E10026**.

- [ ] **Step 1.** Select the **Name** cell of **Lorenza Thiel**'s row, then press Shift+F10.
  - **Expected:** Her menu opens, offering **Show details**.
  - **Notes:**

- [ ] **Step 2.** Press the down arrow until **Show details** is highlighted, then press Enter.
  - **Expected:** The details panel opens, headed **Lorenza Thiel**, with focus on her name at the top of the panel.
  - **Notes:**

- [ ] **Step 3.** Press Esc.
  - **Expected:** The panel closes, the table fills the page again, and focus is back on her **Name** cell.
  - **Notes:**

### DETAILS-07: The Details Read Well in Both Modes, Resized, and in a Narrow Window

**Account:** Resource Planner, `resource.planner@fathom.test`, the same as DETAILS-06.

**Preconditions:** **People** page open, searched for **E10026**, with **Lorenza Thiel**'s details open beside the table. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Read the panel.
  - **Expected:** Labels are in grey on the left and values on the right, each row ruled off from the next, and every word is easy to read.
  - **Notes:**

- [ ] **Step 2.** Choose **Dark** in the Appearance menu.
  - **Expected:** The page turns dark, and every label, value, link and mark in the panel is still easy to read.
  - **Notes:**

- [ ] **Step 3.** Drag the panel's left edge to the left, then to the right.
  - **Expected:** The panel widens and narrows, and the table beside it narrows and widens to match. Once the panel is narrow, each label sits over its value, with the names under **Direct reports** lined up on the left, instead of a column of labels beside the values.
  - **Notes:**

- [ ] **Step 4.** Select **Metrics** above the table, then drag the edge between the two panels up and down.
  - **Expected:** The **Metrics** panel opens under the details panel, the two sharing the height, and the edge moves the share between them, as a note and **Metrics** do. Lorenza's details stay open.
  - **Notes:**

- [ ] **Step 5.** Make the browser window as narrow as it goes.
  - **Expected:** The panel covers the whole window, with each label above its value, and nothing cut off or overlapping.
  - **Notes:**

- [ ] **Step 6.** Restore the window, and choose **Light** in the Appearance menu.
  - **Expected:** The page is light again, with the panel beside the table.
  - **Notes:**

### DETAILS-08: Changing a Person's Details Beside People

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DETAILS-07.

**Preconditions:** Signed in with this account. **Light** chosen in the Appearance menu. **People** page open from the left-hand menu, searched for **E10026**, with **Lorenza Thiel**'s details open beside the table.

- [ ] **Step 1.** Read the panel.
  - **Expected:** Every value under **Reporting**, **Details** and **Columns** has a change button at its right, except **Team** and **Direct reports**. **Details** starts with **Name** **Lorenza Thiel**. **Manager?** shows a ticked checkbox and **Yes** instead of a change button.
  - **Notes:**

- [ ] **Step 2.** Select the change button beside **Site**, which reads **Corran Quay**.
  - **Expected:** A list of sites opens in place of the value, as it does in a **Site** cell of the table.
  - **Notes:**

- [ ] **Step 3.** Select **Kestrel Bay**.
  - **Expected:** **Site** reads **Kestrel Bay**, followed by a yellow dot and **Draft**, with **Corran Quay** under it, in grey, followed by a green dot and **Live**. Her **Site** cell in the table reads **Kestrel Bay** too, and focus is on the change button beside **Site**.
  - **Notes:**

- [ ] **Step 4.** Press Cmd+Z on a Mac, or Ctrl+Z otherwise.
  - **Expected:** **Site** reads **Corran Quay** again, with no mark, in the panel and the table.
  - **Notes:**

- [ ] **Step 5.** Select the word **None** beside **Team name**, type **Harbour team**, and press Enter.
  - **Expected:** **Team name** reads **Harbour team**, followed by a yellow dot and **Draft**, with **None** under it, in grey, followed by a green dot and **Live**.
  - **Notes:**

- [ ] **Step 6.** Select the change button beside **End**, type **2014-01-01**, and press Enter.
  - **Expected:** The field stays open, outlined in red, with **The end date cannot be before the start date** in red under it.
  - **Notes:**

- [ ] **Step 7.** Press Esc.
  - **Expected:** The field closes, **End** shows no date, the red line has gone, and the panel stays open.
  - **Notes:**

- [ ] **Step 8.** Press Shift+Tab until the change button beside **Position** has focus, then press Enter, choose **SDET** with the down arrow, and press Enter.
  - **Expected:** A list of positions opens, then closes. **Position** reads **SDET**, followed by a yellow dot and **Draft**, and **SDET** under the heading at the top of the panel follows it.
  - **Notes:**

- [ ] **Step 9.** Choose **Dark** in the Appearance menu, then select the change button beside **Grade**.
  - **Expected:** The list of grades and every value, mark and change button in the panel are easy to read on the dark page.
  - **Notes:**

- [ ] **Step 10.** Press Esc, then choose **Light** in the Appearance menu.
  - **Expected:** The list closes, **Grade** reads as it did, and the page is light again.
  - **Notes:**

- [ ] **Step 11.** Select **Draft** above the table, then **Live only**, then press Esc.
  - **Expected:** The panel shows no change buttons, and **Manager?** reads **Yes** with no checkbox.
  - **Notes:**

- [ ] **Step 12.** Select **Draft**, then **Drafts beside live**, then press Esc.
  - **Expected:** The change buttons show again.
  - **Notes:**

### DETAILS-09: Changing a Person's Details Beside the Org Chart

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DETAILS-08.

**Preconditions:** **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** In the finder above the chart, type **Lorenza Thiel**, choose her, then select her name on her card.
  - **Expected:** The details panel shows **Lorenza Thiel**, with **Team name** reading **Harbour team** and a yellow dot and **Draft**, as DETAILS-08 left it. Her card shows **Harbour team** too.
  - **Notes:**

- [ ] **Step 2.** Select the change button beside **Team name**, replace the text with **Quayside team**, and press Enter.
  - **Expected:** In the panel, **Team name** reads **Quayside team**, followed by a yellow dot and **Draft**, and, within a moment, her card shows **Quayside team** as well.
  - **Notes:**

- [ ] **Step 3.** Select the change button beside **Onboarding**, under **Columns**.
  - **Expected:** A second panel opens under her details, headed **Onboarding for Lorenza Thiel**, with **Clear**, **Cancel** and **Save** buttons, and her details stay above it, the two sharing the height.
  - **Notes:**

- [ ] **Step 4.** Type **Laptop ready** in the note, then press Cmd+Z on a Mac, or Ctrl+Z otherwise.
  - **Expected:** **Laptop ready** goes from the note. **Team name** still reads **Quayside team**, followed by a yellow dot and **Draft**, and her card still shows **Quayside team**.
  - **Notes:**

- [ ] **Step 5.** Type **Laptop ready** in the note, then select the name on the card for **Silje Holm-Schrøder**.
  - **Expected:** A box asks **Discard changes to the note?**, with **Keep writing** and **Discard**. The details behind it still show **Lorenza Thiel**.
  - **Notes:**

- [ ] **Step 6.** Select **Keep writing**.
  - **Expected:** The box closes. The details still show **Lorenza Thiel**, and the note panel still holds **Laptop ready**.
  - **Notes:**

- [ ] **Step 7.** Select the name on the card for **Silje Holm-Schrøder** again, then **Discard**.
  - **Expected:** The details show **Silje Holm-Schrøder**, and the note panel has closed.
  - **Notes:**

- [ ] **Step 8.** Select **Tanushree Patel-Singh** under **Direct reports**, then the change button beside **Onboarding**, then, without changing the note, select **Silje Holm-Schrøder** beside **Manager**.
  - **Expected:** Tanushree's note opens under her details, headed **Onboarding for Tanushree Patel-Singh** and showing her checklist; once Silje is chosen, nothing asks, the details show Silje, and the note panel closes.
  - **Notes:**

- [ ] **Step 9.** Select **Lorenza Thiel** under **Direct reports**, then run Restore the Seed Data.
  - **Expected:** After the reload, her details show no **Draft** mark, and **Team name** reads **None**.
  - **Notes:**

### DETAILS-10: A Planned Hire's Details Open Beside People

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DETAILS-09.

**Preconditions:** **People** page open from the left-hand menu. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** In the search box above the table, type **TBD-3**.
  - **Expected:** Three rows show: **Engineering Manager, TBD-3**, its name in grey italics, and **Platform engineer** and **SDET, TBD-5**, each with **Engineering Manager, TBD-3** in **Manager**.
  - **Notes:**

- [ ] **Step 2.** Point at the row for **Engineering Manager, TBD-3**, and select the arrow button at the right of its **Name** cell.
  - **Expected:** The details panel opens, headed **Engineering Manager, TBD-3**, with **Engineering Manager** under the heading, followed by a dot and **Planned, expected Nov 2026**. There is no **Show on org chart** link.
  - **Notes:**

- [ ] **Step 3.** Read the **Reporting** and **Details** sections.
  - **Expected:** **Manager** reads **No manager**, and **Direct reports** lists **Platform engineer** and **SDET, TBD-5**. **Details** shows **ID** **TBD-3**, **State** **Request to hire** and **Expected** **Nov 2026**, and has no **End**. **Manager?** shows a ticked checkbox and **Yes**. Every other value has a change button, except **Team**, **Expected** and **Direct reports**.
  - **Notes:**

- [ ] **Step 4.** Select **SDET, TBD-5** under **Direct reports**.
  - **Expected:** The panel shows **SDET, TBD-5**, and **Manager** reads **Engineering Manager, TBD-3**, as a link.
  - **Notes:**

- [ ] **Step 5.** Select the change button beside **Name**, type **Fictional test lead**, and press Enter.
  - **Expected:** **Name** reads **Fictional test lead**, followed by a yellow dot and **Draft**, and the heading reads **Fictional test lead**. Its row in the table reads **Fictional test lead** too.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### DETAILS-11: A Person Is Added From New

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DETAILS-10.

**Preconditions:** **People** page open from the left-hand menu. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Select **New** at the top right of the page.
  - **Expected:** The details panel opens, headed **New person**. Its first row is **State**, reading **Hired**, with a change button. **Name**, **ID**, **Start**, **End**, **Manager assigned** and **Team name** are empty boxes to type in, **Manager?** is an empty checkbox, and the other values have change buttons. **Cancel** and **Add** are at the foot of the panel.
  - **Notes:**

- [ ] **Step 2.** Type **Fictional Newcomer** in **Name**, press Tab, type **E10007** in **ID**, and press Tab.
  - **Expected:** The **ID** box is outlined in red, with **Someone already has that ID** in red under it.
  - **Notes:**

- [ ] **Step 3.** Replace the ID with **E20001**, press Tab, and select **Add**.
  - **Expected:** The red line under **ID** has gone. **Position needed** shows in red under **Position**, and **Grade needed** under **Grade**, and focus is on the change button beside **Position**. Nothing is added to the table.
  - **Notes:**

- [ ] **Step 4.** Select the change button beside **Position** and choose **Software Engineer**, then the change button beside **Grade** and choose **P2**, then select **Add**.
  - **Expected:** The panel shows **Fictional Newcomer**, with **Software Engineer** under the heading, followed by a hollow yellow dot and **Draft: added**, and change buttons beside its values. Her row is in the table with the same mark.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### DETAILS-12: State Decides Whether a Person or a Planned Hire Is Added

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DETAILS-11.

**Preconditions:** **People** page open from the left-hand menu. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Select **New**. Type **Fictional Opening** in **Name**, then type **2027-06-30** in **End** and press Tab.
  - **Expected:** The panel is headed **New person**, and **End** holds **2027-06-30**.
  - **Notes:**

- [ ] **Step 2.** Select the change button beside **State**.
  - **Expected:** A list opens offering **Hired**, **Left**, **Request to hire** and **Approved to hire**.
  - **Notes:**

- [ ] **Step 3.** Choose **Request to hire**.
  - **Expected:** The heading reads **New planned hire**. Under **State**, a grey line reads **End was cleared, since a planned hire doesn't have it.** **Name** still holds **Fictional Opening**, and there is no **End**, **Manager assigned** or **Team name**.
  - **Notes:**

- [ ] **Step 4.** Select the **×** in the **Name** box, choose **SDET** in **Position** from its change button, then type **REQ-4100** in **ID** and press Tab.
  - **Expected:** The **Name** box is empty, showing **SDET, REQ-4100** in grey.
  - **Notes:**

- [ ] **Step 5.** Choose **Dark** in the Appearance menu, and read the panel.
  - **Expected:** Every label, value, box and button in the panel, and the grey line, is easy to read.
  - **Notes:**

- [ ] **Step 6.** Choose **Light** in the Appearance menu, then select the **×** at the top right of the panel.
  - **Expected:** A box asks **Discard the new planned hire?**, with **Keep adding** and **Discard**.
  - **Notes:**

- [ ] **Step 7.** Select **Keep adding**.
  - **Expected:** The box closes, and the panel still shows **New planned hire**, with **SDET, REQ-4100** in grey in **Name**.
  - **Notes:**

- [ ] **Step 8.** Select **Cancel** at the foot of the panel, then **Discard**.
  - **Expected:** The panel closes, and no row for **Fictional Opening** is in the table.
  - **Notes:**
