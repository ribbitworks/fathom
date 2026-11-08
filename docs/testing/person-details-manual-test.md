---
title: "Manual Test: Person Details"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/person-panel*", "apps/web/src/person-change.ts", "apps/web/src/people-grid.tsx", "apps/web/src/org-chart-page.tsx", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-07"
---

# Manual Test: Person Details

## Scope

Verifies a person's details in the side panel beside the org chart and People: what it shows of them, moving to another person, drafted values beside live ones and following the Draft menu, the mark on someone who has left, opening and closing it with the mouse and the keyboard, how it reads in light and dark mode, resized, and in a narrow window, and changing their details there, beside People and the org chart.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser with a mouse or trackpad.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1).

## Test Accounts

R1 creates these accounts, with every other development account, so they exist once R1 has run. They share one password, which R1 prints when it finishes.

- **Engineering Manager account:** `engineering.manager@fathom.test`, shown in Fathom as **Engineering Manager**. It sees people, with their Restricted details, such as their dates, and cannot change them.
- **Resource Planner account:** `resource.planner@fathom.test`, shown in Fathom as **Resource Planner**. It sees people without their Restricted details, and cannot change them.
- **Engineering Operations Manager account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It sees people, with their Restricted details, and changes them.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at `https://localhost:8443`, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R1: Restore the Seed Data

Use after R0, before the first test case. Fathom keeps running. This removes the seed data and every draft of it, then adds the seed data again; it keeps accounts and anything else added by hand.

1. In the second terminal, run:

   ```sh
   pnpm db:unseed && pnpm db:seed
   ```

2. Confirm that the last line printed gives the shared password, with no error above it.
3. Reload the browser page.

### P1: Sign In

1. If someone is signed in, sign out first (P2).
2. On the **Sign in** page, enter the account's email address and the shared password.
3. Select **Sign in**.

### P2: Sign Out

1. Select the account button at the top right, which shows the account's name.
2. Select **Sign out**.

## Terms

- **Appearance menu:** the choices **System**, **Light** and **Dark** under **Appearance**, in the menu that opens from your name and initials at the top right of every page.
- **Details panel:** the panel that slides out on the right of the org chart or the **People** table, headed with a person's name, with the sections **Reporting**, **Details** and **Columns**, each a list of labels on the left and values on the right, and an **×** at its top right.
- **Change button:** a small pencil at the right of a value in the details panel, shown to accounts that may change people.
- **Mark:** a coloured dot followed by a word, such as a yellow dot and **Draft**, shown after a name or a value.
- **Draft menu:** the menu opened by the **Draft** button above the chart or the table.

## Test Cases

Run the test cases in order. Start with R0, then R1. Check each step whose expected result you see, and write anything else under its notes.

### DETAILS-01: A Person's Details Open Beside the Org Chart

**Account:** Engineering Manager, `engineering.manager@fathom.test`; the first test case.

**Preconditions:** Signed in (P1). **Light** chosen in the Appearance menu. **Org chart** page open from the left-hand menu.

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

**Preconditions:** Signed in (P1). **People** page open from the left-hand menu.

- [ ] **Step 1.** In the search box above the table, type **E10026**.
  - **Expected:** Only the row for **Lorenza Thiel** shows.
  - **Notes:**

- [ ] **Step 2.** Point at her row, without selecting anything.
  - **Expected:** A small button, an arrow pointing out of a box, appears at the right of her **Name** cell. Pointing away from the row hides it again.
  - **Notes:**

- [ ] **Step 3.** Point at her row again, and select that button.
  - **Expected:** The details panel slides out on the right, headed **Lorenza Thiel**, with the link **Show on org chart** under her position, and the table narrows to make room. **Details** shows no **Start** or **End**, and **Reporting** shows no **Manager since**.
  - **Notes:**

- [ ] **Step 4.** Select **Show on org chart**.
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

**Account:** Engineering Operations Manager, `engineering.operations.manager@fathom.test`, changed from DETAILS-07.

**Preconditions:** Signed in (P1). **Light** chosen in the Appearance menu. **People** page open from the left-hand menu, searched for **E10026**, with **Lorenza Thiel**'s details open beside the table.

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

**Account:** Engineering Operations Manager, `engineering.operations.manager@fathom.test`, the same as DETAILS-08.

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

- [ ] **Step 4.** Type **Laptop ready** in the note, then select the name on the card for **Silje Holm-Schrøder**.
  - **Expected:** The details above now show **Silje Holm-Schrøder**. The note panel below stays, still headed **Onboarding for Lorenza Thiel** and holding **Laptop ready**.
  - **Notes:**

- [ ] **Step 5.** Select **Cancel** in the note panel.
  - **Expected:** The note panel closes, and Silje's details fill the side.
  - **Notes:**

- [ ] **Step 6.** Select **Tanushree Patel-Singh** under **Direct reports**, then the change button beside **Onboarding**, then, without changing the note, select **Silje Holm-Schrøder** beside **Manager**.
  - **Expected:** Tanushree's note opens under her details, headed **Onboarding for Tanushree Patel-Singh** and showing her checklist; once Silje is chosen, the details show Silje and the note panel closes.
  - **Notes:**

- [ ] **Step 7.** Select **Lorenza Thiel** under **Direct reports**, then run R1.
  - **Expected:** After the reload, her details show no **Draft** mark, and **Team name** reads **None**.
  - **Notes:**
