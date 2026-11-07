---
title: "Manual Test: Org Chart"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/org-chart*", "apps/server/src/data/org-chart.ts", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-07"
---

# Manual Test: Org Chart

## Scope

Verifies the **Org chart** page: the levels it opens on, each person's card, showing reports, finding a person or team, one team shown alone, teams' colours and choosing them, naming teams, panning and zooming, opening People from a card and coming back, the mark on a manager who has left, and drafts drawn beside the chart, applied to it, or left out with the Draft menu.

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser with a mouse or trackpad.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1).

## Test Accounts

R1 creates these accounts, with every other development account, so they exist once R1 has run. They share one password, which R1 prints when it finishes.

- **Engineering Manager account:** `engineering.manager@fathom.test`, shown in Fathom as **Engineering Manager**. It sees people, with their Restricted details, such as their dates, and cannot change them, but chooses teams' colours.
- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It can change people, and its changes are drafts; it cannot approve them.
- **Resource Planner account:** `resource.planner@fathom.test`, shown in Fathom as **Resource Planner**. It sees people without their Restricted details, and cannot change them.

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

- **Appearance menu:** the choices **System**, **Light** and **Dark** under **Appearance**, in the menu that opens from your name and initials at the top right of every page.
- **Card:** the box for one person on the chart, showing their name, their position under it, and, for a manager whose team has a name, the team's name under that.
- **Band:** the strip of colour along the top edge of a card.
- **Chart:** the large panel under the **Org chart** heading that holds the cards.
- **Finder:** the box reading **Find a person or team** at the top left of the page, above the chart.
- **Mark:** a coloured dot followed by a word, such as a red dot and **Left**, shown beside a person's name.
- **Draft menu:** the menu opened by the **Draft** button just right of the finder.
- **Publish button:** the button in the top bar, beside your name, that reads **Publish** followed by a number of changes.

## Test Cases

Run the test cases in order. Start with R0, then R1. Check each step whose expected result you see, and write anything else under its notes.

### ORG-01: The Org Chart Page Opens

**Preconditions:** Signed in (P1) as `engineering.manager@fathom.test`.

- [ ] **Step 1.** Select **Org chart** in the **People** section of the left-hand menu.
  - **Expected:** The page's heading reads **Org chart**. The top bar reads **People / Org chart**. Above the chart are the finder, **Draft** and **Teams** on the left, and **Show levels**, **+**, **−** and **Fit to screen** on the right.
  - **Notes:**

### ORG-02: The Chart Opens on the Top Two Levels

**Preconditions:** Signed in (P1) as `engineering.manager@fathom.test`. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** Read the card at the top of the chart.
  - **Expected:** It reads **Silje Holm-Schrøder**, with **Manager** under the name and **Platform team** under that, and ends with **Hide 8 reports**.
  - **Notes:**

- [ ] **Step 2.** Read the cards under it.
  - **Expected:** Eight cards, each joined to **Silje Holm-Schrøder** by a line. Five are in a column under her card's left edge, from the top: **Blaise Gislason**, **Cleora Jerde**, **Jedidiah Funk**, **Simone Jean** and **Tanushree Patel-Singh**. The other three are in a row to the right of that column: **Lorenza Thiel**, **Viktoria Holmberg** and **武井 聡**. There is nothing below the row.
  - **Notes:**

- [ ] **Step 3.** Read the card for **Viktoria Holmberg**.
  - **Expected:** A red dot and **Left** follow the name. Its position reads **Manager**, with **Search team** under it.
  - **Notes:**

### ORG-03: A Manager's Reports and All Levels Are Shown

**Preconditions:** As ORG-02.

- [ ] **Step 1.** On the card for **Lorenza Thiel**, select **Show 7 reports**.
  - **Expected:** Seven cards appear under **Lorenza Thiel**, each joined to her by a line: six in a column under her card's left edge, from **Candice Swift** to **Valéry Caron**, and **Atmananda Ganaka** to the right of them. The button now reads **Hide 7 reports**.
  - **Notes:**

- [ ] **Step 2.** Select **Show levels**, then **All levels**, then **Fit to screen**.
  - **Expected:** The whole organization fits in the panel, its cards too small to read, reaching down further than across. No card ends with a **Show** button.
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

- [ ] **Step 4.** Select the **×** at the right of the finder, type **Billing**, and select **Billing team**, which has **Led by Joaquin Rice** under it.
  - **Expected:** The finder reads **Joaquin Rice**. His card is in the middle of the panel, with a blue ring around it, and his reports' cards are shown under it, his card ending with **Hide 4 reports**.
  - **Notes:**

### ORG-05: The Chart Pans and Zooms

**Preconditions:** As ORG-02.

- [ ] **Step 1.** Hold the mouse button down on an empty part of the chart and drag to the left.
  - **Expected:** The cards move to the left with the pointer.
  - **Notes:**

- [ ] **Step 2.** With the pointer over the chart, scroll the mouse wheel, or move two fingers on the trackpad, up and then down.
  - **Expected:** The chart zooms in and out around the pointer.
  - **Notes:**

### ORG-06: A Card Opens the Person on People, and Leads Back

**Preconditions:** As ORG-02.

- [ ] **Step 1.** On the card for **Lorenza Thiel**, select the name.
  - **Expected:** The **People** page opens. Its search box reads **E10026**, and only the row for **Lorenza Thiel** is shown. **Back to org chart** is above the **People** heading.
  - **Notes:**

- [ ] **Step 2.** Select **Back to org chart**.
  - **Expected:** The **Org chart** page opens. The finder reads **Lorenza Thiel**, and her card is in the middle of the panel, with a blue ring around it.
  - **Notes:**

### ORG-07: One Team Is Shown Alone

**Preconditions:** As ORG-02.

- [ ] **Step 1.** Point at the small org chart button at the top right of the card for **Lorenza Thiel**.
  - **Expected:** A tip reads **Show only this team**. The cards for **Tanushree Patel-Singh** and the others with no reports have no such button.
  - **Notes:**

- [ ] **Step 2.** Select the button.
  - **Expected:** **Lorenza Thiel** is at the top of the chart, with her seven reports under her. **Silje Holm-Schrøder** is not shown. To the right of the heading, the page reads **You're seeing only the team of Lorenza Thiel.**, with **Show everyone** beside it. Her card has no org chart button.
  - **Notes:**

- [ ] **Step 3.** Select **Show everyone**.
  - **Expected:** **Silje Holm-Schrøder** is at the top of the chart again, and the line above the chart is gone.
  - **Notes:**

- [ ] **Step 4.** Go back with the browser's back button.
  - **Expected:** Only the team of **Lorenza Thiel** is shown again.
  - **Notes:**

### ORG-08: Only Readers Who See Restricted Details Are Told a Manager Has Left

**Preconditions:** Signed in (P1) as `resource.planner@fathom.test`. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** Read the top of the chart.
  - **Expected:** Two cards are at the top, side by side, with no line between them: **Silje Holm-Schrøder**, ending with **Hide 6 reports**, and **Viktoria Holmberg**.
  - **Notes:**

- [ ] **Step 2.** Read the card for **Viktoria Holmberg**.
  - **Expected:** It shows the name and **Search team** after a yellow dot, with no position, no red dot and no **Left** after the name, and no org chart button, and ends with **Hide 3 reports**. **Simone Jean**, **우아현** and **西尾 亮** are in a column under it, each joined to it by a line.
  - **Notes:**

### ORG-09: Each Team Is Drawn in Its Colour, Reaching Down to Teams With None

**Preconditions:** As ORG-02. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Read the card for **Silje Holm-Schrøder**.
  - **Expected:** A small teal dot comes before **Platform team**. The card has no band.
  - **Notes:**

- [ ] **Step 2.** Read the eight cards under her, and the lines to them.
  - **Expected:** Each card has a teal band, and each line from her card is teal.
  - **Notes:**

- [ ] **Step 3.** On the card for **Lorenza Thiel**, select **Show 7 reports**.
  - **Expected:** Her card shows no team name. Her seven reports' cards have teal bands, and the lines to them are teal.
  - **Notes:**

- [ ] **Step 4.** On the card for **Atmananda Ganaka**, select **Show 9 reports**.
  - **Expected:** His card has a teal band, and a small grape (purple) dot comes before **Payments team**. His nine reports' cards have grape bands, and the lines to them are grape.
  - **Notes:**

- [ ] **Step 5.** Choose **Dark** in the Appearance menu.
  - **Expected:** The bands, dots and lines keep their colours, each easy to tell apart from the card behind it.
  - **Notes:**

- [ ] **Step 6.** Choose **Light** in the Appearance menu.
  - **Expected:** The chart returns to its light colours, the bands, dots and lines unchanged.
  - **Notes:**

- [ ] **Step 7.** In the finder, type **Candice**, and select **Candice Swift**.
  - **Expected:** Her card has a blue ring around it, and its band is blue too while she is found.
  - **Notes:**

### ORG-10: A Team's Colour Is Chosen on the Chart, at Once

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** On the card for **Silje Holm-Schrøder**, select the small teal dot before **Platform team**.
  - **Expected:** A menu opens headed **Colour of Platform team**, listing **Indigo**, **Violet**, **Grape**, **Pink**, **Red**, **Orange**, **Yellow**, **Lime**, **Green** and **Teal**, each after a small dot of its colour, then **No colour**. **Teal** has a tick.
  - **Notes:**

- [ ] **Step 2.** Select **Grape**.
  - **Expected:** The menu closes. The dot before **Platform team** is grape (purple), and so are the bands of the eight cards under her and the lines to them. A notification reads **Platform team is now drawn in Grape.**, with **Undo**. The Publish button does not appear.
  - **Notes:**

- [ ] **Step 3.** Select **Undo**.
  - **Expected:** The dot, the bands and the lines are teal again.
  - **Notes:**

- [ ] **Step 4.** In the finder, type **Joaquin**, and select **Joaquin Rice**.
  - **Expected:** A small dashed circle comes before **Billing team** on his card.
  - **Notes:**

**Afterwards:** R1.

### ORG-11: A Team Is Named on the Chart as a Draft

**Preconditions:** Signed in (P1) as `engineering.operations.manager@fathom.test`. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** Read **Platform team** on the card for **Silje Holm-Schrøder**.
  - **Expected:** **Platform team** is underlined.
  - **Notes:**

- [ ] **Step 2.** On the card for **Silje Holm-Schrøder**, select **Platform team**.
  - **Expected:** A box opens under it with a field holding **Platform team** with an **×** at its end, and **Cancel** and **Save**.
  - **Notes:**

- [ ] **Step 3.** Replace the name with **Platform crew**, and select **Save**.
  - **Expected:** The box closes. A notification reads **Draft saved. The team's name becomes Platform crew once approved.** The Publish button reads **Publish 1**. The card is tinted blue and is taller. It reads **Platform crew** followed by a hollow yellow dot and **Draft**, and under that **Platform team**, in grey, followed by a green dot and **Live**.
  - **Notes:**

- [ ] **Step 4.** Select **Teams** beside the finder.
  - **Expected:** A **Teams** panel opens on the right, listing the named teams by name, each with a square button holding its colour dot, or a dashed circle where it has none, then **Led by** and its manager's name, then the unnamed ones, with no square button, each reading **Add a name**, among them the team led by **Lorenza Thiel**. **Platform crew** is followed by a hollow yellow dot and **Draft**, with **Platform team** under it, in grey, followed by a green dot and **Live**. **Observability team** has no square button and is followed by a yellow dot and **Draft**. The card for **Lorenza Thiel** shows no team.
  - **Notes:**

**Afterwards:** R1.

### ORG-12: A Person Drafted to Another Manager Is Drawn in Both Places

**Preconditions:** As ORG-02. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Read the card for **Simone Jean**, in the column under **Silje Holm-Schrøder**.
  - **Expected:** The card is tinted blue. A yellow dot and **Draft** follow the name, and **Software Engineer** is under it.
  - **Notes:**

- [ ] **Step 2.** On the card for **Viktoria Holmberg**, select **Show 3 reports**.
  - **Expected:** Three cards appear in a column under her: **Simone Jean**, **우아현** and **西尾 亮**. The card for **Simone Jean** is faded and light green, with a dashed edge, its name in grey and followed by a green dot and **Live**, and the line to it is dashed and faded.
  - **Notes:**

- [ ] **Step 3.** Select the name on the light green card for **Simone Jean**.
  - **Expected:** Nothing opens, and the **Org chart** page stays as it was.
  - **Notes:**

- [ ] **Step 4.** Look at the tinted card under **Silje Holm-Schrøder** and the light green card under **Viktoria Holmberg**.
  - **Expected:** Both are easy to tell apart from the other cards, and every word on them is easy to read.
  - **Notes:**

- [ ] **Step 5.** Choose **Dark** in the Appearance menu.
  - **Expected:** The two cards are still easy to tell apart from the other cards, and every word on them is easy to read.
  - **Notes:**

- [ ] **Step 6.** Choose **Light** in the Appearance menu.
  - **Expected:** The chart returns to its light colours.
  - **Notes:**

### ORG-13: A Team Named in a Draft Is Marked

**Preconditions:** As ORG-02.

- [ ] **Step 1.** In the finder, type **本間**, and select **本間 稔**.
  - **Expected:** The card for **本間 稔** is in the middle of the panel and tinted blue. **Observability team** is under the position, followed by a yellow dot and **Draft**, with no line under it.
  - **Notes:**

### ORG-14: The Draft Menu Applies Drafts or Leaves Them Out

**Preconditions:** As ORG-02.

- [ ] **Step 1.** Select **Draft**.
  - **Expected:** A menu opens under **Show** with **Drafts beside live**, which has a tick, **Drafts applied** and **Live only**.
  - **Notes:**

- [ ] **Step 2.** Select **Drafts applied**, then press Esc.
  - **Expected:** A dot follows **Draft** on its button. The address bar ends with **show=drafts**. The card for **Simone Jean** under **Silje Holm-Schrøder** is no longer tinted and has no mark, and no card on the chart is light green.
  - **Notes:**

- [ ] **Step 3.** In the finder, type **Vianney**, and select **Vianney Rousseau**.
  - **Expected:** The card for **Vianney Rousseau**, with **Engineering Manager** under the name, is in the middle of the panel, with a blue ring around it and no line above it.
  - **Notes:**

- [ ] **Step 4.** Select the **×** at the right of the finder, and type **Ophélie**.
  - **Expected:** The list reads **Nobody has that name**.
  - **Notes:**

- [ ] **Step 5.** Select **Draft**, then **Live only**, then press Esc.
  - **Expected:** The card for **Silje Holm-Schrøder** ends with **Hide 7 reports**, and **Simone Jean** is not under her. No card is tinted, and no card shows **Draft** or **Live**.
  - **Notes:**

- [ ] **Step 6.** Read the buttons just right of the finder.
  - **Expected:** **Draft** is there, and **Teams** is not.
  - **Notes:**

- [ ] **Step 7.** On the card for **Silje Holm-Schrøder**, select the name, then select **Back to org chart** on the **People** page.
  - **Expected:** The **Org chart** page opens with a dot after **Draft**, and the card for **Silje Holm-Schrøder** ends with **Hide 7 reports**.
  - **Notes:**

### ORG-15: Readers Who Do Not See Restricted Details See No Drafted Manager

**Preconditions:** Signed in (P1) as `resource.planner@fathom.test`, with **Resource Planner** on the account button at the top right. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** On the card for **Viktoria Holmberg**, read the column under it.
  - **Expected:** **Simone Jean**, **우아현** and **西尾 亮**, each on an untinted card with no mark. No card on the chart is light green.
  - **Notes:**
