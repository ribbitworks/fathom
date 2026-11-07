---
title: "Manual Test: Org Chart"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/org-chart*", "apps/server/src/data/org-chart.ts", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-06"
---

# Manual Test: Org Chart

## Scope

Verifies the **Org chart** page: who sees it, the levels it opens on and the levels chosen, each person's card, hiding and showing reports, finding a person, one team shown alone, teams' colours and choosing them, naming teams, panning and zooming, opening People from a card and coming back, that it shows only today's approved reporting lines and current people, and the mark on a manager who has left.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser with a mouse or trackpad.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1).

## Test Accounts

R1 creates these accounts, with every other development account, so they exist once R1 has run. They share one password, which R1 prints when it finishes.

- **Engineering Manager account:** `engineering.manager@fathom.test`, shown in Fathom as **Engineering Manager**. It sees people, with their Restricted details, such as their dates, and cannot change them, but chooses teams' colours.
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
- **Band:** the strip of colour along the top edge of a card.
- **Chart:** the large panel under the **Org chart** heading that holds the cards.
- **Finder:** the box reading **Find a person or team** at the top left of the page, above the chart.
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
  - **Expected:** The page's heading reads **Org chart**. The top bar reads **People / Org chart**. Above the chart are the finder and **Teams** on the left, and **Show levels**, **+**, **−** and **Fit to screen** on the right.
  - **Notes:**

### ORG-02: The Chart Opens on the Top Two Levels

**Preconditions:** Signed in (P1) as `engineering.manager@fathom.test`. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** Read the card at the top of the chart.
  - **Expected:** It reads **Silje Holm-Schrøder**, with **Manager** under the name and **Platform team** under that, and ends with **Hide 7 reports**.
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
  - **Expected:** Seven cards appear under **Lorenza Thiel**, each joined to her by a line: six in a column under her card's left edge, from **Candice Swift** to **Valéry Caron**, and **Atmananda Ganaka** to the right of them. The button now reads **Hide 7 reports**.
  - **Notes:**

- [ ] **Step 2.** On the card for **Lorenza Thiel**, select **Hide 7 reports**.
  - **Expected:** The seven cards under it go. The button reads **Show 7 reports** again.
  - **Notes:**

- [ ] **Step 3.** Select **Show levels**.
  - **Expected:** A menu opens with **1 level** to **9 levels**, then **All levels**.
  - **Notes:**

- [ ] **Step 4.** Select **All levels**, then **Fit to screen**.
  - **Expected:** The whole organization fits in the panel, its cards too small to read, reaching down further than across. No card ends with a **Show** button.
  - **Notes:**

- [ ] **Step 5.** Select **Show levels**, then **3 levels**.
  - **Expected:** The chart is fitted to the panel. **Lorenza Thiel** ends with **Hide 7 reports**, with her seven reports under her as in ORG-03 step 1, and **Atmananda Ganaka** ends with **Show 9 reports**.
  - **Notes:**

- [ ] **Step 6.** Select **Show levels**, then **1 level**.
  - **Expected:** Only the card for **Silje Holm-Schrøder** is left, ending with **Show 7 reports**.
  - **Notes:**

### ORG-04: Finding a Person Brings Them to the Centre

**Preconditions:** As ORG-02. Select **Show levels**, then **1 level**, first.

- [ ] **Step 1.** Select the finder, and type **Gloria**.
  - **Expected:** A list opens under the finder offering **Gloria Armas Guardado**, with **Software Engineer** under the name. An **×** is at the right of the finder, before the arrow.
  - **Notes:**

- [ ] **Step 2.** Select **Gloria Armas Guardado**.
  - **Expected:** The finder reads **Gloria Armas Guardado**. The chart opens out and moves until the card for **Gloria Armas Guardado** is in the middle of the panel, with a blue ring around it. The card shows **Software Engineer**, and a line joins it to the card for **Joaquin Rice** above, which shows **Billing team**.
  - **Notes:**

- [ ] **Step 3.** Select the finder, clear what it holds, and type **Zzz**.
  - **Expected:** The list reads **Nobody has that name**.
  - **Notes:**

- [ ] **Step 4.** Select the **×** at the right of the finder.
  - **Expected:** The finder is empty, showing **Find a person or team**, and the **×** is gone. No card has a blue ring.
  - **Notes:**

- [ ] **Step 5.** In the finder, type **Billing**.
  - **Expected:** The list offers **Billing team**, with **Led by Joaquin Rice** under it.
  - **Notes:**

- [ ] **Step 6.** Select **Billing team**.
  - **Expected:** The finder reads **Joaquin Rice**. His card is in the middle of the panel, with a blue ring around it, and his reports' cards are shown under it, his card ending with **Hide 4 reports**.
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
  - **Expected:** The list reads **Silje Holm-Schrøder is not in this team**, and the chart stays as it is.
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

- [ ] **Step 3.** Clear the finder, and type **Marceau**, for **Marceau Leroux**, who has left.
  - **Expected:** The list reads **Nobody has that name**.
  - **Notes:**

- [ ] **Step 4.** Clear the finder, and type **Josefin**, for **Josefin Ekström**, who has not started yet.
  - **Expected:** The list reads **Nobody has that name**.
  - **Notes:**

**Afterwards:** R1.

### ORG-09: Only Readers Who See Restricted Details Are Told a Manager Has Left

**Preconditions:** Signed in (P1) as `resource.planner@fathom.test`. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** Read the top of the chart.
  - **Expected:** Two cards are at the top, side by side, with no line between them: **Silje Holm-Schrøder**, ending with **Hide 6 reports**, and **Viktoria Holmberg**.
  - **Notes:**

- [ ] **Step 2.** Read the card for **Viktoria Holmberg**.
  - **Expected:** It shows the name and **Search team** after a yellow dot, with no position, no red dot and no **Left** after the name, and no org chart button, and ends with **Hide 3 reports**. **Simone Jean**, **우아현** and **西尾 亮** are in a column under it, each joined to it by a line.
  - **Notes:**

- [ ] **Step 3.** Select the name **Viktoria Holmberg**, then the middle of her card.
  - **Expected:** Nothing happens; the **Org chart** page stays open.
  - **Notes:**

- [ ] **Step 4.** Select the finder, and type **Viktoria**.
  - **Expected:** The list offers **Viktoria Holmberg**, with no position under the name.
  - **Notes:**

- [ ] **Step 5.** Select **Viktoria Holmberg**.
  - **Expected:** The finder reads **Viktoria Holmberg**, and her card is in the middle of the panel, with a blue ring around it. The address in the browser's address bar ends with `/org-chart`, with no person after it.
  - **Notes:**

### ORG-10: Each Team Is Drawn in Its Colour, Reaching Down to Teams With None

**Preconditions:** As ORG-02.

- [ ] **Step 1.** Read the card for **Silje Holm-Schrøder**.
  - **Expected:** A small teal dot comes before **Platform team**. The card has no band.
  - **Notes:**

- [ ] **Step 2.** Read the seven cards under her, and the lines to them.
  - **Expected:** Each card has a teal band, and each line from her card is teal.
  - **Notes:**

- [ ] **Step 3.** On the card for **Lorenza Thiel**, select **Show 7 reports**.
  - **Expected:** Her card shows no team name. Her seven reports' cards have teal bands, and the lines to them are teal.
  - **Notes:**

- [ ] **Step 4.** On the card for **Atmananda Ganaka**, select **Show 9 reports**.
  - **Expected:** His card has a teal band, and a small grape (purple) dot comes before **Payments team**. His nine reports' cards have grape bands, and the lines to them are grape.
  - **Notes:**

- [ ] **Step 5.** On the card for **Viktoria Holmberg**, select **Show 3 reports**.
  - **Expected:** A small yellow dot comes before **Search team**. Her three reports' cards have yellow bands, and the lines to them are yellow.
  - **Notes:**

- [ ] **Step 6.** On the card for **Lorenza Thiel**, select the small org chart button at the top right.
  - **Expected:** Only her team is shown. Her card has no band, and her seven reports' cards still have teal bands.
  - **Notes:**

- [ ] **Step 7.** Switch the computer's appearance setting between light and dark, which Fathom follows.
  - **Expected:** The bands, dots and lines keep their colours, each easy to tell apart from the card behind it.
  - **Notes:**

- [ ] **Step 8.** In the finder, type **Candice**, and select **Candice Swift**.
  - **Expected:** Her card has a blue ring around it, and its band is blue too while she is found.
  - **Notes:**

### ORG-11: A Team's Colour Is Chosen on the Chart, at Once

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** On the card for **Silje Holm-Schrøder**, select the small teal dot before **Platform team**.
  - **Expected:** A menu opens headed **Colour of Platform team**, listing **Indigo**, **Violet**, **Grape**, **Pink**, **Red**, **Orange**, **Yellow**, **Lime**, **Green** and **Teal**, each after a small dot of its colour, then **No colour**. **Teal** has a tick.
  - **Notes:**

- [ ] **Step 2.** Select **Grape**.
  - **Expected:** The menu closes. The dot before **Platform team** is grape (purple), and so are the bands of the seven cards under her and the lines to them. A notification reads **Platform team is now drawn in Grape.**, with **Undo**. The Publish button does not appear.
  - **Notes:**

- [ ] **Step 3.** Select **Undo**.
  - **Expected:** The dot, the bands and the lines are teal again.
  - **Notes:**

- [ ] **Step 4.** In the finder, type **Joaquin**, and select **Joaquin Rice**.
  - **Expected:** A small dashed circle comes before **Billing team** on his card.
  - **Notes:**

- [ ] **Step 5.** Select the dashed circle, then **Lime**.
  - **Expected:** The circle is now a lime dot, and the cards under **Joaquin Rice** have lime bands.
  - **Notes:**

- [ ] **Step 6.** Select the lime dot, then **No colour**.
  - **Expected:** The dashed circle is back, and the cards under **Joaquin Rice** no longer have lime bands.
  - **Notes:**

- [ ] **Step 7.** Read the card for **Lorenza Thiel**.
  - **Expected:** It shows no team name, and no dot or circle.
  - **Notes:**

- [ ] **Step 8.** Sign out (P2), and sign in (P1) as `engineering.manager@fathom.test`. Open **Org chart**, and select the teal dot before **Platform team**.
  - **Expected:** The menu opens as in step 1.
  - **Notes:**

- [ ] **Step 9.** Select **Grape**.
  - **Expected:** The team is drawn in grape, as in step 2, and the notification offers **Undo**.
  - **Notes:**

- [ ] **Step 10.** Select **Undo**.
  - **Expected:** The dot, the bands and the lines are teal again.
  - **Notes:**

**Afterwards:** R1.

### ORG-12: A Team Is Named on the Chart as a Draft

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** On the card for **Silje Holm-Schrøder**, select **Platform team**.
  - **Expected:** A box opens under it with a field holding **Platform team** with an **×** at its end, and **Cancel** and **Save**.
  - **Notes:**

- [ ] **Step 2.** Replace the name with **Platform crew**, and select **Save**.
  - **Expected:** The box closes. A notification reads **Draft saved. Platform crew shows on the chart once approved.** The card still reads **Platform team**, and the Publish button reads **Publish 1**.
  - **Notes:**

- [ ] **Step 3.** Select **Teams** beside the finder.
  - **Expected:** A **Teams** panel opens on the right, listing the named teams by name, each with a square button holding its colour dot, or a dashed circle where it has none, then **Led by** and its manager's name, then the unnamed ones, with no square button, each reading **Add a name**, among them the team led by **Lorenza Thiel**. The card for **Lorenza Thiel** shows no team.
  - **Notes:**

- [ ] **Step 4.** In the panel, select **Add a name** for the team led by **Lorenza Thiel**, type **Core team**, and press Enter.
  - **Expected:** A notification reads **Draft saved. Core team shows on the chart once approved.** The panel still reads **Add a name** for it, and the Publish button reads **Publish 2**.
  - **Notes:**

- [ ] **Step 5.** Close the panel. Select **Platform team** again, select the **×**, and select **Cancel**.
  - **Expected:** The **×** empties the field, which then shows the hint **Team name**, and disappears. **Cancel** closes the box, and no notification appears.
  - **Notes:**

- [ ] **Step 6.** Sign out (P2), and sign in (P1) as `engineering.manager@fathom.test`. Open **Org chart**, and select **Platform team** on the card for **Silje Holm-Schrøder**.
  - **Expected:** Nothing opens.
  - **Notes:**

- [ ] **Step 7.** Select **Teams**.
  - **Expected:** The panel lists only the named teams, each with its square colour button and its name as plain text, and no **Add a name**.
  - **Notes:**

**Afterwards:** R1.
