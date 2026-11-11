---
title: "Manual Test: Org Chart"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/org-chart*", "apps/server/src/data/org-chart.ts", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-11"
---

# Manual Test: Org Chart

## Scope

Verifies the **Org chart** page: the levels it opens on, each person's card, showing reports, finding a person or team, one team shown alone, teams' colours and choosing them, naming teams, panning and zooming, showing a person's details beside the chart from a card, the mark on a manager who has left, drafts of managers, positions and team names drawn beside the chart, applied to it, or left out with the Draft menu, and changing a manager from an earlier date.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out, with:

- A mouse or trackpad.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Engineering Manager:** `engineering.manager@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**
- **Resource Planner:** `resource.planner@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the Appearance menu, marks and the Publish button. This test adds:

- **Date row:** the row between the page's heading and the chart, holding a **Date** box, a left arrow, a timeline, a right arrow and **Today**.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Check each step whose expected result you see, and write anything else under its notes.

### ORG-01: The Org Chart Page Opens

**Account:** Engineering Manager, `engineering.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account.

- [ ] **Step 1.** Select the **Org chart** page in the **People** section of the left-hand menu.
  - **Expected:** The page's heading reads **Org chart**. The top bar reads **People / Org chart**. Above the chart are the finder, **Draft** and **Teams** on the left, and **Show levels**, **+**, **−** and **Fit to screen** on the right.
  - **Notes:**

### ORG-02: The Chart Opens on the Top Two Levels

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ORG-01.

**Preconditions:** Signed in with this account. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** Read the card at the top left of the chart.
  - **Expected:** It reads **Silje Holm-Schrøder**, with **Manager** under the name and **Platform team** under that, and ends with **Hide 8 reports**. Two cards with dashed edges are beside it at the top: **TBD-3**, with **Engineering Manager** under it, and **REQ-2047**, with **Software Engineer** under it.
  - **Notes:**

- [ ] **Step 2.** Read the cards under it.
  - **Expected:** Eight cards, each joined to **Silje Holm-Schrøder** by a line. Five are in a column under her card's left edge, from the top: **Blaise Gislason**, **Cleora Jerde**, **Jedidiah Funk**, **Simone Jean** and **Tanushree Patel-Singh**. The other three are in a row to the right of that column: **Lorenza Thiel**, **Viktoria Holmberg** and **武井 聡**. There is nothing below the row.
  - **Notes:**

- [ ] **Step 3.** Read the card for **Viktoria Holmberg**.
  - **Expected:** A red dot and **Left** follow the name. Its position reads **Manager**, with **Search team** under it.
  - **Notes:**

### ORG-03: A Manager's Reports and All Levels Are Shown

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ORG-02.

**Preconditions:** As ORG-02.

- [ ] **Step 1.** On the card for **Lorenza Thiel**, select **Show 8 reports**.
  - **Expected:** Eight cards appear under **Lorenza Thiel**, each joined to her by a line: seven in a column under her card's left edge, from **Candice Swift** to **Valéry Caron**, then **REQ-2042**, with **SDET** under it and a dashed edge, and **Atmananda Ganaka** to the right of them. The button now reads **Hide 8 reports**.
  - **Notes:**

- [ ] **Step 2.** Select **Show levels**, then **All levels**, then **Fit to screen**.
  - **Expected:** The whole organization fits in the panel, its cards too small to read, reaching down further than across. No card ends with a **Show** button.
  - **Notes:**

### ORG-04: Finding a Person Brings Them to the Centre

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ORG-03.

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
  - **Expected:** The finder reads **Joaquin Rice**. His card is in the middle of the panel, with a blue ring around it, and his reports' cards are shown under it, his card ending with **Hide 5 reports**.
  - **Notes:**

### ORG-05: The Chart Pans and Zooms

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ORG-04.

**Preconditions:** As ORG-02.

- [ ] **Step 1.** Hold the mouse button down on an empty part of the chart and drag to the left.
  - **Expected:** The cards move to the left with the pointer.
  - **Notes:**

- [ ] **Step 2.** With the pointer over the chart, scroll the mouse wheel, or move two fingers on the trackpad, up and then down.
  - **Expected:** The chart zooms in and out around the pointer.
  - **Notes:**

### ORG-06: A Card Shows the Person's Details Beside the Chart

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ORG-05.

**Preconditions:** As ORG-02.

- [ ] **Step 1.** On the card for **Lorenza Thiel**, select the name.
  - **Expected:** A panel slides out on the right, headed **Lorenza Thiel**, and the chart narrows to make room. Her card, with a blue ring around it, stays in the middle of the space left beside the panel.
  - **Notes:**

- [ ] **Step 2.** Select the **×** at the top right of the panel.
  - **Expected:** The panel slides away, and the chart fills the page again, with her card still in the middle. The finder reads **Lorenza Thiel**.
  - **Notes:**

### ORG-07: One Team Is Shown Alone

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ORG-06.

**Preconditions:** As ORG-02.

- [ ] **Step 1.** Point at the small org chart button at the top right of the card for **Lorenza Thiel**.
  - **Expected:** A tip reads **Show only this team**. The cards for **Tanushree Patel-Singh** and the others with no reports have no such button.
  - **Notes:**

- [ ] **Step 2.** Select the button.
  - **Expected:** **Lorenza Thiel** is at the top of the chart, with her eight reports under her. **Silje Holm-Schrøder** is not shown. To the right of the heading, the page reads **Only the team of Lorenza Thiel is shown.**, with **Show everyone** beside it. Her card has no org chart button.
  - **Notes:**

- [ ] **Step 3.** Select **Show everyone**.
  - **Expected:** **Silje Holm-Schrøder** is at the top of the chart again, and the line above the chart is gone.
  - **Notes:**

- [ ] **Step 4.** Go back with the browser's back button.
  - **Expected:** Only the team of **Lorenza Thiel** is shown again.
  - **Notes:**

### ORG-08: Only Readers Who See Personal Details Are Told a Manager Has Left

**Account:** Resource Planner, `resource.planner@fathom.test`, changed from ORG-07.

**Preconditions:** Signed in with this account. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** Look at the area between the page's heading and the chart.
  - **Expected:**
    - A line in grey reads **Other dates need Personal access.**
    - There is no date control.
  - **Notes:**

- [ ] **Step 2.** Type `Viktoria` in **Find a person or team**, and choose **Viktoria Holmberg**.
  - **Expected:**
    - The chart centres on the card for **Viktoria Holmberg**, which shows her name, position and **Search team** after a yellow dot.
    - There is no red dot and no **Left** after the name.
    - The card is joined by a line to the manager above it, and ends with **Hide 3 reports**.
    - **Simone Jean**, **우아현** and **西尾 亮** are in a column under it, each joined to it by a line.
  - **Notes:**

### ORG-09: Each Team Is Drawn in Its Colour, Reaching Down to Teams With None

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from ORG-08.

**Preconditions:** As ORG-02. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Read the card for **Silje Holm-Schrøder**.
  - **Expected:** A small teal dot comes before **Platform team**. The card has no band.
  - **Notes:**

- [ ] **Step 2.** Read the eight cards under her, and the lines to them.
  - **Expected:** Each card has a teal band, and each line from her card is teal.
  - **Notes:**

- [ ] **Step 3.** On the card for **Lorenza Thiel**, select **Show 8 reports**.
  - **Expected:** Her card shows no team name. Her eight reports' cards have teal bands, and the lines to them are teal.
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

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ORG-09.

**Preconditions:** Signed in with this account. **Org chart** page open from the left-hand menu.

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

**Afterwards:** Run Restore the Seed Data.

### ORG-11: A Team Is Named on the Chart as a Draft

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as ORG-10.

**Preconditions:** Signed in with this account. **Org chart** page open from the left-hand menu.

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

**Afterwards:** Run Restore the Seed Data.

### ORG-12: A Person Drafted to Another Manager Is Drawn in Both Places

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from ORG-11.

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
  - **Expected:** Both are easy to tell apart from the untinted cards, and every word on them is easy to read.
  - **Notes:**

- [ ] **Step 5.** Choose **Dark** in the Appearance menu.
  - **Expected:** The two cards are still easy to tell apart from the untinted cards, and every word on them is easy to read.
  - **Notes:**

- [ ] **Step 6.** Choose **Light** in the Appearance menu.
  - **Expected:** The chart returns to its light colours.
  - **Notes:**

### ORG-13: A Drafted Team Name or Position Is Marked

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ORG-12.

**Preconditions:** As ORG-02.

- [ ] **Step 1.** In the finder, type **本間**, and select **本間 稔**.
  - **Expected:** The card for **本間 稔** is in the middle of the panel and tinted blue. **Observability team** is under the position, followed by a yellow dot and **Draft**, with no line under it.
  - **Notes:**

- [ ] **Step 2.** Select the **×** at the right of the finder, type **우아**, and select **우아현**.
  - **Expected:** The card for **우아현** is in the middle of the panel and tinted blue. **Test Engineer** is under the name, followed by a red dot and **Rejected**, and under that **Software Engineer**, in grey, followed by a green dot and **Live**. The card is taller than the card for **西尾 亮** under it, and nothing on it is cut off.
  - **Notes:**

- [ ] **Step 3.** Choose **Dark** in the Appearance menu.
  - **Expected:** Every word on the card for **우아현** is easy to read.
  - **Notes:**

- [ ] **Step 4.** Choose **Light** in the Appearance menu.
  - **Expected:** The chart returns to its light colours.
  - **Notes:**

### ORG-14: The Draft Menu Applies Drafts or Leaves Them Out

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ORG-13.

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

- [ ] **Step 7.** On the card for **Silje Holm-Schrøder**, select the name.
  - **Expected:** Her details slide out in a panel on the right. **Draft** still has a dot after it, her card still ends with **Hide 7 reports**, and **Simone Jean** is not under her in **Direct reports** in the panel.
  - **Notes:**

### ORG-15: Readers Who Do Not See Personal Details See No Drafted Manager

**Account:** Resource Planner, `resource.planner@fathom.test`, changed from ORG-14.

**Preconditions:** Signed in with this account, with **Resource Planner** on the account button at the top right. **Org chart** page open from the left-hand menu.

- [ ] **Step 1.** On the card for **Viktoria Holmberg**, read the column under it.
  - **Expected:** **Simone Jean**, **우아현** and **西尾 亮**. The card for **Simone Jean** is untinted and has no mark. No card on the chart is light green.
  - **Notes:**

### ORG-16: Planned Hires Are Placeholders, and a Planned Manager Heads Its Team

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from ORG-15.

**Preconditions:** Signed in with this account. **Org chart** page open from the left-hand menu. **Light** chosen in the Appearance menu.

- [ ] **Step 1.** Read the card for **TBD-3**, at the top of the chart.
  - **Expected:** The card has a grey dashed edge and no shadow. **TBD-3** is grey and in italics, with **Engineering Manager** under it. Under that, a hollow grey dot is followed by **Planned, expected** and this month, such as **Nov 2026**. It ends with **Hide 2 reports**.
  - **Notes:**

- [ ] **Step 2.** Read the two cards under it.
  - **Expected:** **Platform engineer**, with **Software Engineer** under the name, and **TBD-5**, in grey italics, with **SDET** under it, each with a dashed edge and joined to **TBD-3** by a line. **Platform engineer** reads **Planned, expected** and the month six months after the month Restore the Seed Data was run, such as **May 2027** for a run in November 2026.
  - **Notes:**

- [ ] **Step 3.** On the card for **TBD-3**, select the small org chart button at the top right.
  - **Expected:** **TBD-3** is at the top of the chart, with its two planned hires under it, and the page reads **Only the team of Engineering Manager, TBD-3 is shown.**
  - **Notes:**

- [ ] **Step 4.** Select **Show everyone**, then choose **Dark** in the Appearance menu.
  - **Expected:** The dashed edges and the hollow dots are easy to see on the dark cards.
  - **Notes:**

### ORG-17: A Manager Is Changed From an Earlier Date

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ORG-16.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. **Org chart** page open from the left-hand menu, showing today.

- [ ] **Step 1.** Select **Reporting teams** in the switch at the top right, then **Show levels**, then **All levels**. In the date row, select the left arrow once.
  - **Expected:** The chart shows managers and their reports. The **Date** box shows the first day of last month. Below the row, text reads **Showing** with that date, then **Changes take effect from this date.** **Draft** stays just right of the finder, and **Teams** is gone.
  - **Notes:**

- [ ] **Step 2.** In the finder, type `Candice`, select **Candice Swift**, then select the name on her card.
  - **Expected:** Her details slide out in a panel on the right. **Manager** reads **Lorenza Thiel** with a change button. **Manager assigned**, **Reporting team name**, and every value under **Details** and **Columns** have no change button, and **Manager?** reads **No** with no checkbox.
  - **Notes:**

- [ ] **Step 3.** Select the change button beside **Manager**, and choose **Max Munk**.
  - **Expected:** A notice offers **Undo**. In the panel, **Manager** reads **Max Munk**, followed by a yellow dot and **Draft**, and **Manager assigned** reads the first day of last month, such as **Oct 1, 2026**. On the chart, the card for **Candice Swift** is under **Max Munk**, tinted blue, with a yellow dot and **Draft** after the name and no date, and a light green copy marked **Live** is under **Lorenza Thiel**.
  - **Notes:**

- [ ] **Step 4.** Select **Today** in the date row.
  - **Expected:** The text below the row goes, and **Teams** is back. On the card for **Candice Swift** under **Max Munk**, her full name is followed by a yellow dot and **Draft**, and under **SDET** a grey line reads **From** and the first day of last month, such as **From Oct 1, 2026**. Nothing on the card is cut off.
  - **Notes:**

- [ ] **Step 5.** Select the left arrow twice.
  - **Expected:** The text below the row ends **Changes take effect from this date.** The card for **Candice Swift** is under **Lorenza Thiel**, untinted and with no mark, and there is no card for her under **Max Munk**.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.
