---
title: "Manual Test: Org Chart"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/org-chart*", "apps/server/src/data/org-chart.ts", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-05"
---

# Manual Test: Org Chart

## Scope

Verifies the **Org chart** page: who sees it, the levels it opens on and the levels chosen, each person's card, hiding and showing reports, finding a person, one team shown alone, panning and zooming, opening People from a card and coming back, that it shows only today's approved reporting lines and current people, and the mark on a manager who has left.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser with a mouse or trackpad.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1).

## Test Accounts

R1 creates these accounts, with every other development account, so they exist once R1 has run. They share one password, which R1 prints when it finishes.

- **People Manager account:** `engineering.manager@fathom.test`, shown in Fathom as **Engineering Manager**. It sees people, with their Restricted details, such as their dates, and cannot change them.
- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It can change people, and its changes are drafts; it cannot approve them.
- **Resource Planner account:** `resource.planner@fathom.test`, shown in Fathom as **Resource Planner**. It sees people without their Restricted details, and cannot change them.
- **Team Member account:** `team.member@fathom.test`, shown in Fathom as **Team Member**. It sees the plan, but not people.

## Common Procedures

### R0: Start Fathom

1. In the first terminal, run:

   ```sh
   pnpm dev
   ```

2. Confirm that the browser opens Fathom at `https://localhost:8443`, showing the **Sign in** page or the page last open.
3. Leave the terminal running for the whole test.

### R1: Restore the Seed Data

Use after R0, before the first test case, and wherever a test case says so. Fathom keeps running. This removes the seed data and every draft of it, including drafts made during the test, then adds the seed data again; it keeps accounts and anything else added by hand.

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

- **Card:** the box for one person on the chart, showing their name, their position under it, and, for a manager whose team has a name, the team's name under that.
- **Chart:** the large panel under the **Org chart** heading that holds the cards.
- **Finder:** the box reading **Find a person** at the top left of the page, above the chart.
- **Mark:** a coloured dot followed by a word, such as a red dot and **Left**, shown beside a person's name.
- **Publish button:** the button in the top bar, beside your name, that reads **Publish** followed by a number of changes.
- **Search for:** on the People page, type the person's name in the search box above the People table, so only their row is shown.

## Test Cases

Run the test cases in order. Start with R0, then R1. Check each step whose expected result you see, and write anything else under its notes.

### ORG-01: Only Users Who See People See the Org Chart

**Preconditions:** Signed in (P1) as `team.member@fathom.test`.

- [ ] **Step 1.** Read the left-hand menu.
  - **Expected:** There is no **Org chart** item.
  - **Notes:**

- [ ] **Step 2.** In the address bar, go to `https://localhost:8443/org-chart`.
  - **Expected:** The page reads **There is no page at this address.**
  - **Notes:**

- [ ] **Step 3.** Sign out (P2), and sign in (P1) as `engineering.manager@fathom.test`. Read the **People** section of the left-hand menu.
  - **Expected:** **Org chart** comes straight after **People**.
  - **Notes:**

- [ ] **Step 4.** Select **Org chart**.
  - **Expected:** The page's heading reads **Org chart**. The top bar reads **People / Org chart**. Above the chart are the finder on the left, and **Show levels**, **+**, **−** and **Fit to screen** on the right.
  - **Notes:**

### ORG-02: The Chart Opens on the Top Two Levels

**Preconditions:** Signed in (P1) as `engineering.manager@fathom.test`. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** Read the card at the top of the chart.
  - **Expected:** It reads **Silje Holm-Schrøder**, with **Manager** under the name and **Platform team** under that, and ends with **Hide reports**.
  - **Notes:**

- [ ] **Step 2.** Read the cards under it.
  - **Expected:** Seven cards, each joined to **Silje Holm-Schrøder** by a line. Four are in a column under her card's left edge, from the top: **Blaise Gislason**, **Cleora Jerde**, **Jedidiah Funk** and **Tanushree Patel-Singh**. The other three are in a row to the right of that column: **Lorenza Thiel**, **Viktoria Holmberg** and **武井 聡**. There is nothing below the row.
  - **Notes:**

- [ ] **Step 3.** Read the end of each card in the row.
  - **Expected:** **Lorenza Thiel** ends with **Show 7 reports**, **Viktoria Holmberg** with **Show 3 reports**, and **武井 聡** with **Show 8 reports**. The four cards in the column end with no button.
  - **Notes:**

- [ ] **Step 4.** Read the card for **Viktoria Holmberg**.
  - **Expected:** A red dot and **Left** follow the name. Its position reads **Manager**, with **Search team** under it.
  - **Notes:**

### ORG-03: A Manager's Reports Hide and Show

**Preconditions:** As ORG-02.

- [ ] **Step 1.** On the card for **Lorenza Thiel**, select **Show 7 reports**.
  - **Expected:** Seven cards appear under **Lorenza Thiel**, each joined to her by a line: six in a column under her card's left edge, from **Candice Swift** to **Valéry Caron**, and **Atmananda Ganaka** to the right of them. The button now reads **Hide reports**.
  - **Notes:**

- [ ] **Step 2.** On the card for **Lorenza Thiel**, select **Hide reports**.
  - **Expected:** The seven cards under it go. The button reads **Show 7 reports** again.
  - **Notes:**

- [ ] **Step 3.** Select **Show levels**.
  - **Expected:** A menu opens with **1 level** to **9 levels**, then **All levels**.
  - **Notes:**

- [ ] **Step 4.** Select **All levels**, then **Fit to screen**.
  - **Expected:** The whole organization fits in the panel, its cards too small to read, reaching down further than across. No card ends with a **Show** button.
  - **Notes:**

- [ ] **Step 5.** Select **Show levels**, then **3 levels**.
  - **Expected:** The chart is fitted to the panel. **Lorenza Thiel** ends with **Hide reports**, with her seven reports under her as in ORG-03 step 1, and **Atmananda Ganaka** ends with **Show 9 reports**.
  - **Notes:**

- [ ] **Step 6.** Select **Show levels**, then **1 level**.
  - **Expected:** Only the card for **Silje Holm-Schrøder** is left, ending with **Show 7 reports**.
  - **Notes:**

### ORG-04: Finding a Person Brings Them to the Centre

**Preconditions:** As ORG-02. Select **Show levels**, then **1 level**, first.

- [ ] **Step 1.** Select the finder, and type **Gloria**.
  - **Expected:** A list opens under the finder offering **Gloria Armas Guardado**, with **Software Engineer** under the name.
  - **Notes:**

- [ ] **Step 2.** Select **Gloria Armas Guardado**.
  - **Expected:** The finder reads **Gloria Armas Guardado**. The chart opens out and moves until the card for **Gloria Armas Guardado** is in the middle of the panel, with a blue ring around it. The card shows **Software Engineer**, and a line joins it to the card for **Joaquin Rice** above, which shows **Billing team**.
  - **Notes:**

- [ ] **Step 3.** Select the finder, clear what it holds, and type **Zzz**.
  - **Expected:** The list reads **Nobody has that name**.
  - **Notes:**

### ORG-05: The Chart Pans, Zooms, and Fits the Screen

**Preconditions:** As ORG-02.

- [ ] **Step 1.** Hold the mouse button down on an empty part of the chart and drag to the left.
  - **Expected:** The cards move to the left with the pointer.
  - **Notes:**

- [ ] **Step 2.** Select **+** twice.
  - **Expected:** The cards grow larger each time.
  - **Notes:**

- [ ] **Step 3.** Select **−** twice.
  - **Expected:** The cards grow smaller each time.
  - **Notes:**

- [ ] **Step 4.** With the pointer over the chart, scroll the mouse wheel, or move two fingers on the trackpad, up and then down.
  - **Expected:** The chart zooms in and out around the pointer.
  - **Notes:**

- [ ] **Step 5.** Select **Fit to screen**.
  - **Expected:** All eight cards are in view, centred in the panel.
  - **Notes:**

### ORG-06: A Card Opens the Person on People, and Leads Back

**Preconditions:** As ORG-02.

- [ ] **Step 1.** On the card for **Lorenza Thiel**, select the name.
  - **Expected:** The **People** page opens. Its search box reads **E10026**, and only the row for **Lorenza Thiel** is shown. **Back to org chart** is above the **People** heading.
  - **Notes:**

- [ ] **Step 2.** Select **Back to org chart**.
  - **Expected:** The **Org chart** page opens. The finder reads **Lorenza Thiel**, and her card is in the middle of the panel, with a blue ring around it.
  - **Notes:**

- [ ] **Step 3.** On the card for **Silje Holm-Schrøder**, select the word **Manager** under the name.
  - **Expected:** The **People** page opens. Its search box reads **E10007**, and only the row for **Silje Holm-Schrøder** is shown.
  - **Notes:**

- [ ] **Step 4.** Go back with the browser's back button.
  - **Expected:** The **Org chart** page opens, with **Silje Holm-Schrøder** in the finder and a blue ring around her card.
  - **Notes:**

- [ ] **Step 5.** Select **People** in the left-hand menu.
  - **Expected:** There is no **Back to org chart** above the heading.
  - **Notes:**

### ORG-07: One Team Is Shown Alone

**Preconditions:** As ORG-02.

- [ ] **Step 1.** Point at the small org chart button at the top right of the card for **Lorenza Thiel**.
  - **Expected:** A tip reads **Show only this team**. The cards for **Tanushree Patel-Singh** and the others with no reports have no such button.
  - **Notes:**

- [ ] **Step 2.** Select the button.
  - **Expected:** **Lorenza Thiel** is at the top of the chart, with her seven reports under her. **Silje Holm-Schrøder** is not shown. To the right of the heading, the page reads **You're seeing only the team of Lorenza Thiel.**, with **Show everyone** beside it. Her card has no org chart button.
  - **Notes:**

- [ ] **Step 3.** Select the finder, and type **Silje**.
  - **Expected:** The list reads **Nobody has that name**.
  - **Notes:**

- [ ] **Step 4.** Select **Show everyone**.
  - **Expected:** **Silje Holm-Schrøder** is at the top of the chart again, and the line above the chart is gone.
  - **Notes:**

- [ ] **Step 5.** Go back with the browser's back button.
  - **Expected:** Only the team of **Lorenza Thiel** is shown again.
  - **Notes:**

### ORG-08: Only Current People and Approved Lines Are Shown

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **People** page open from the left-hand menu.

- [ ] **Step 1.** Search for **Lilian Lang**. Select the row's **Manager** cell, press Enter, type **Max**, and select **Max Munk**. Select the Publish button.
  - **Expected:** The row has a yellow dot and **Draft**, and its **Manager** cell reads **Max Munk**.
  - **Notes:**

- [ ] **Step 2.** Select **Org chart** in the left-hand menu. In the finder, type **Lilian**, and select **Lilian Lang**.
  - **Expected:** The card for **Lilian Lang** is in the middle of the chart, joined by a line to the card for **Van Wiza** above it, not **Max Munk**.
  - **Notes:**

- [ ] **Step 3.** Clear the finder, and type **Marceau**.
  - **Expected:** The list reads **Nobody has that name**.
  - **Notes:**

- [ ] **Step 4.** Clear the finder, and type **Josefin**.
  - **Expected:** The list reads **Nobody has that name**.
  - **Notes:**

**Afterwards:** R1.

### ORG-09: Only Readers Who See Restricted Details Are Told a Manager Has Left

**Preconditions:** Signed in (P1) as `resource.planner@fathom.test`. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** Read the top of the chart.
  - **Expected:** Two cards are at the top, side by side, with no line between them: **Silje Holm-Schrøder**, ending with **Hide reports**, and **Viktoria Holmberg**.
  - **Notes:**

- [ ] **Step 2.** Read the card for **Viktoria Holmberg**.
  - **Expected:** It shows the name and **Search team**, with no position, no dot and no **Left** after the name, and no org chart button, and ends with **Hide reports**. **Simone Jean**, **우아현** and **西尾 亮** are in a column under it, each joined to it by a line.
  - **Notes:**

- [ ] **Step 3.** Select the name **Viktoria Holmberg**, then the middle of her card.
  - **Expected:** Nothing happens; the **Org chart** page stays open.
  - **Notes:**

- [ ] **Step 4.** Select the finder, and type **Viktoria**.
  - **Expected:** The list reads **Nobody has that name**.
  - **Notes:**
