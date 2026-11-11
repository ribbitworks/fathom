---
title: "Manual Test: Feature Teams"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/org-chart*", "apps/web/src/feature-team*", "apps/server/src/data/feature-teams.ts", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-10"
---

# Manual Test: Feature Teams

## Scope

Verifies feature teams on the **Org chart** page: switching the chart to feature teams, how each team is drawn under its lead in light and dark mode, a team's panel, proposing and editing teams as drafts with their marks on the chart and in the panel, what a reader who may not change teams sees, changing teams from another date on the chart, approving a team's draft on the Drafts page, and using a team's panel from the keyboard. The seeded feature teams are listed in [Development Setup](../design/development-setup.md#fictional-seed-data).

## Test Environment

- A clone of Fathom set up as [Development Setup](../design/development-setup.md) describes, with the `.dev/` folder in place.
- A desktop web browser with a mouse or trackpad, and a keyboard.
- Two terminals open at the repository root: the first runs Fathom (R0), the second the data commands (R1).

## Test Accounts

R1 creates these accounts, with every other development account, so they exist once R1 has run. They share one password, which R1 prints when it finishes.

- **Engineering Manager account:** `engineering.manager@fathom.test`, shown in Fathom as **Engineering Manager**. It holds the Engineering Manager role, which proposes feature teams, as [Roles](../product/roles.md#starting-roles) sets out.
- **Workforce Administrator account:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**. It holds the Workforce Administrator role, which edits feature teams.
- **Engineering Director account:** `engineering.director@fathom.test`, shown in Fathom as **Engineering Director**. It holds the Engineering Director role, which approves feature teams.
- **Resource Planner account:** `resource.planner@fathom.test`, shown in Fathom as **Resource Planner**. It holds the Resource Planner role, which sees feature teams but does not change them.

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
   pnpm db:reseed
   ```

2. Confirm that the last line printed gives the shared password, with no error above it.
3. Reload the browser page.

## Terms

- **Appearance menu:** the choices **System**, **Light** and **Dark** under **Appearance**, in the menu that opens from your name and initials at the top right of every page.
- **Teams switch:** the two-part switch reading **Reporting teams** and **Feature teams** at the top right of the **Org chart** page.
- **Card:** the box for one person on the chart, showing their name, their position under it, and, on a team's first card, the team's name under that.
- **Band:** the strip of colour along the top edge of a card.
- **Feature teams button:** the button reading **Feature teams** above the chart, at its right, once the chart shows feature teams.
- **Team panel:** the panel titled **Feature team** that opens to the right of the chart, with a **Team** drop-down at its top.
- **Mark:** a coloured dot followed by a word, such as a yellow dot and **Draft**.
- **Publish button:** the button in the top bar, beside your name, that reads **Publish** followed by a number of changes.

## Test Cases

Run the test cases in order. Start with R0, then R1. Check each step whose expected result you see, and write anything else under its notes.

### FT-01: The Chart Draws Feature Teams Under Their Leads

**Account:** Resource Planner, `resource.planner@fathom.test`; the first test case.

**Preconditions:** **Light** chosen in the Appearance menu. Signed in with this account. Select **Org chart** in the left-hand menu.

- [ ] **Step 1.** Choose **Feature teams** in the teams switch.
  - **Expected:** The chart is drawn again with four teams side by side. The first card of each names its team: **Mobile apps** on Sharda Varrier's card, **Payments core** on Gilda Effertz's, **Search** on Lorenza Thiel's, and a card named **Platform reliability** whose position reads **No feature lead**. The address bar now ends with `view=feature-teams`.
  - **Notes:**

- [ ] **Step 2.** Look at the bands of the teams' cards.
  - **Expected:** Mobile apps' cards have an orange band, Payments core's teal, and Search's indigo. Platform reliability's cards have none.
  - **Notes:**

- [ ] **Step 3.** Type **Lorenza** in the box reading **Find a person or team** at the top left of the chart.
  - **Expected:** Under **People**, two entries read **Lorenza Thiel**, one with **Payments core** under it and one with **Search**: her card under Gilda Effertz, and her card leading Search.
  - **Notes:**

- [ ] **Step 4.** Choose **Dark** in the Appearance menu, and look over the chart.
  - **Expected:** The bands, team names and positions are all easy to read on the dark cards.
  - **Notes:**

- [ ] **Step 5.** Choose **Light** in the Appearance menu. Look at the bottom of Lorenza Thiel's card that leads Search.
  - **Expected:** It reads **Hide 3 members**, not reports.
  - **Notes:**

- [ ] **Step 6.** Click Nicole Grüner's card, under Lorenza Thiel in Search.
  - **Expected:** Nicole Grüner's details open beside the chart. Under **Reporting**, only **Manager** is shown. Under it, a **Feature teams** section lists **Search**, with **Led by Lorenza Thiel** beside it.
  - **Notes:**

- [ ] **Step 7.** Close the details, and click the card named **Platform reliability**.
  - **Expected:** The team panel opens, titled **Feature team**, with **Team** reading Platform reliability and **Feature lead** None. There is no **Rename** button, no **Add member** box, and no **×** beside any member.
  - **Notes:**

- [ ] **Step 8.** Open the **Team** drop-down, and look at its choices, then choose **Search**.
  - **Expected:** The choices are the four teams, with no **New feature team…**. Once Search is chosen, the panel shows **Feature lead** Lorenza Thiel, and the members Lorenza Thiel (lead), Nicole Grüner, Yara Habel and 杨治涛.
  - **Notes:**

- [ ] **Step 9.** Close the panel, and select **Payments core**, the team name under Gilda Effertz's position on her card.
  - **Expected:** The team panel opens with **Team** reading Payments core and **Feature lead** Gilda Effertz. The team name on the card is a link, with no box to rename it.
  - **Notes:**

- [ ] **Step 10.** Close the panel, choose **Reporting teams** in the teams switch, and click Lorenza Thiel's card.
  - **Expected:** The chart shows managers' teams again, and Lorenza Thiel's details open beside it. Under **Reporting**, the rows read **Manager**, **Reporting team**, **Reporting team name** and **Direct reports**. A **Feature teams** section lists **Payments core**, **Led by Gilda Effertz**, and **Search**, **Lead**.
  - **Notes:**

- [ ] **Step 11.** Select **Search** in the **Feature teams** section.
  - **Expected:** The chart switches to feature teams, with the team panel showing Search beside Lorenza Thiel's details.
  - **Notes:**

### FT-02: An Engineering Manager Proposes Members and a Lead

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from FT-01.

**Preconditions:** Signed in with this account. **Org chart** open, with **Feature teams** chosen in the teams switch.

- [ ] **Step 1.** Select the Feature teams button, then **Platform reliability**.
  - **Expected:** The team panel opens with **Team** reading Platform reliability, **Feature lead** empty, reading **No lead**, and no **Rename** button.
  - **Notes:**

- [ ] **Step 2.** In **Feature lead**, choose **Polly Smith**.
  - **Expected:** A notice offers **Undo**. The panel shows a yellow dot and **Draft** under its title, and a line reading **None** under Feature lead, marked Live. On the chart, Platform reliability's first card is now Polly Smith's, named **Platform reliability**.
  - **Notes:**

- [ ] **Step 3.** In **Add member**, type **Rosendo**, and choose **Rosendo Champlin**.
  - **Expected:** Rosendo Champlin is listed among the members with a yellow dot and **Draft**. On the chart, a new card for Rosendo Champlin under Polly Smith is marked as drafted, while his card in Mobile apps stays.
  - **Notes:**

- [ ] **Step 4.** Select the **×** at the right of **Thad Heidenreich** in the members.
  - **Expected:** Thad Heidenreich is no longer listed as a member; a line reading **Thad Heidenreich, leaving** is shown under the members, marked Live. On the chart, his card under Polly Smith is drawn faded, marked **Live**.
  - **Notes:**

- [ ] **Step 5.** Select the Publish button.
  - **Expected:** A notice reads **Published** followed by the number of changes.
  - **Notes:**

### FT-03: A Workforce Administrator Adds, Renames and Removes

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FT-02.

**Preconditions:** Signed in with this account. **Org chart** open, with **Feature teams** chosen in the teams switch.

- [ ] **Step 1.** Select the Feature teams button, then **Search**. In the team panel, open **Team** and choose **New feature team…**.
  - **Expected:** A panel titled **New feature team** opens, with a **Name** box holding the cursor, and **Add feature team** greyed out until a name is typed.
  - **Notes:**

- [ ] **Step 2.** Type **Fictional data team** and press Enter.
  - **Expected:** A notice offers **Undo**. The panel's **Team** reads **Fictional data team**, marked with a yellow dot and **Draft**, and says **No members yet.** A card named **Fictional data team** with **No feature lead** appears on the chart.
  - **Notes:**

- [ ] **Step 3.** In **Add member**, choose **Branson O'Keefe**, then **Priscille Adam**. Choose **Branson O'Keefe** in **Feature lead**.
  - **Expected:** Both are listed as members, Branson O'Keefe with **(lead)**. On the chart, the team's first card is Branson O'Keefe's, named Fictional data team, with Priscille Adam under it.
  - **Notes:**

- [ ] **Step 4.** Select **Rename**, change the name to **Fictional analytics team**, and press Enter.
  - **Expected:** The panel's **Team** and the card's team name read **Fictional analytics team**.
  - **Notes:**

- [ ] **Step 5.** Select **Search** from the Feature teams button, then **Remove feature team**.
  - **Expected:** The panel marks Search with a yellow dot and **Draft**, and the **Remove feature team** button is gone.
  - **Notes:**

- [ ] **Step 6.** Select **Discard draft**.
  - **Expected:** The draft mark goes, and Search is shown as before.
  - **Notes:**

- [ ] **Step 7.** Select the Publish button.
  - **Expected:** A notice reads **Published** followed by the number of changes.
  - **Notes:**

### FT-04: An Approver Approves a Team's Draft

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from FT-03.

**Preconditions:** Signed in with this account. Select **Drafts** in the left-hand menu.

- [ ] **Step 1.** Type **Platform reliability** in the search box.
  - **Expected:** One entry, **the feature team Platform reliability**, with lines for **Feature lead** set to Polly Smith and **Members** from Bilwa Iyer, Polly Smith, Thad Heidenreich to Bilwa Iyer, Polly Smith, Rosendo Champlin, each by Engineering Manager.
  - **Notes:**

- [ ] **Step 2.** Select the entry's checkbox, then **Approve**, and **Approve** in the dialog.
  - **Expected:** The dialog closes, and a notice begins **Approved**.
  - **Notes:**

- [ ] **Step 3.** Select **Org chart** in the left-hand menu, and choose **Feature teams** in the teams switch.
  - **Expected:** Platform reliability is led by Polly Smith, with Bilwa Iyer and Rosendo Champlin under her and no draft marks. Thad Heidenreich is not on the team.
  - **Notes:**

- [ ] **Step 4.** Select **Drafts** in the left-hand menu. Clear the search box, and type **Fictional analytics team**.
  - **Expected:** One entry, **the feature team Fictional analytics team**, with lines for **Feature lead** Branson O'Keefe and **Members** Branson O'Keefe, Priscille Adam.
  - **Notes:**

### FT-05: A Team's Panel Works From the Keyboard

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FT-04.

**Preconditions:** Signed in with this account. **Org chart** open, with **Feature teams** chosen in the teams switch. Select the Feature teams button, then **Search**.

- [ ] **Step 1.** Select the **Add member** box, type **Rosendo**, press the Down Arrow key, and press Enter.
  - **Expected:** Rosendo Champlin is listed among the members with a yellow dot and **Draft**. A notice offers **Undo**.
  - **Notes:**

- [ ] **Step 2.** Select the **Add member** box again, and press Tab repeatedly.
  - **Expected:** A visible outline moves in turn to **Discard draft** and **Remove feature team**.
  - **Notes:**

- [ ] **Step 3.** Press Shift and Tab together to return to **Discard draft**, and press Enter.
  - **Expected:** The draft mark goes, and Rosendo Champlin is no longer listed.
  - **Notes:**

**Afterwards:** R1.

### FT-06: The Org Chart Moves Through Time

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FT-05.

**Preconditions:** R1 has been run. Signed in with this account. **Org chart** open, with **Feature teams** chosen in the teams switch.

- [ ] **Step 1.** Look at the row between the page's heading and the chart.
  - **Expected:** A **Date** box shows today's date, written as year, month and day. Beside it are a left arrow, a timeline marked with one month in each year, such as **Nov 2024** and **Nov 2025**, a right arrow, and a **Today** button, which is greyed out.
  - **Notes:**

- [ ] **Step 2.** Select the left arrow once.
  - **Expected:** The **Date** box shows the first day of last month. Below the row, text reads **Showing** with that date, then **Changes take effect from this date.** The chart redraws without the page going blank, and the **Draft** menu stays.
  - **Notes:**

- [ ] **Step 3.** Open the Feature teams button and choose any team.
  - **Expected:** The team's panel shows its members with an **×** beside each, and an **Add member** box, but no **Rename** or **Remove feature team** button.
  - **Notes:**

- [ ] **Step 4.** Drag the timeline's handle well to the left, and let go.
  - **Expected:** While dragging, a label shows the month under the handle. The handle stays where you let it go. The chart redraws once, showing only the teams with members or a draft that month, which may be none, and the **Date** box shows the first day of that month.
  - **Notes:**

- [ ] **Step 5.** Clear the **Date** box, and type a date in the middle of a month, as digits alone, such as 20250315.
  - **Expected:** Below the row, text reads **Showing Mar 15, 2025. Changes take effect from this date.**, and the timeline's handle moves to March 2025.
  - **Notes:**

- [ ] **Step 6.** Select **Reporting teams** in the teams switch.
  - **Expected:** The date stays. The chart shows managers and their reports as of that date, and the text below the row ends **Nothing can be changed on this date.** The **Draft** menu is gone.
  - **Notes:**

- [ ] **Step 7.** Select **Today**.
  - **Expected:** The text below the row goes, **Today** is greyed out, the **Date** box shows today's date, and the **Draft** menu is back.
  - **Notes:**

- [ ] **Step 8.** Switch Fathom between light and dark mode.
  - **Expected:** The row is easy to read in both, and the timeline's month labels do not overlap each other or the chart.
  - **Notes:**

### FT-07: Readers Without Restricted Details Move by Month

**Account:** Resource Planner, `resource.planner@fathom.test`, changed from FT-06.

**Preconditions:** Signed in with this account. **Org chart** open, with **Reporting teams** chosen in the teams switch.

- [ ] **Step 1.** Look at the area between the page's heading and the chart.
  - **Expected:** There is no date control.
  - **Notes:**

- [ ] **Step 2.** Select **Feature teams** in the teams switch.
  - **Expected:** The arrows, timeline and **Today** appear, with no **Date** box.
  - **Notes:**

- [ ] **Step 3.** Select the left arrow once.
  - **Expected:** Text below the row reads **Showing** with last month and its year, such as **Showing Oct 2026.**, then **Nothing can be changed on this date.** No day of the month is shown.
  - **Notes:**

### FT-08: Changes Take Effect From the Date Shown

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from FT-07.

**Preconditions:** Signed in with this account. **Org chart** open, with **Feature teams** chosen in the teams switch, showing today.

- [ ] **Step 1.** Select the right arrow once.
  - **Expected:** The **Date** box shows the first day of next month, and the text below the row ends **Changes take effect from this date.**
  - **Notes:**

- [ ] **Step 2.** Select the Feature teams button, then **Platform reliability**. In **Add member**, choose the first person listed. Note their name: the joiner.
  - **Expected:** A notice offers **Undo**. The joiner is listed among the members with a yellow dot and **Draft**, with no date after it, and a card for them appears under the team on the chart.
  - **Notes:**

- [ ] **Step 3.** Select **Today**.
  - **Expected:** The joiner is still listed in the team panel, now marked **Draft, from** and the first day of next month, such as **Draft, from Dec 1, 2026**.
  - **Notes:**

- [ ] **Step 4.** Select **Drafts** in the left-hand menu, and type **Platform reliability** in the search box.
  - **Expected:** The entry's **Joining and leaving dates** line gives the joiner and the first day of next month.
  - **Notes:**

- [ ] **Step 5.** Select **Org chart** in the left-hand menu, and choose **Feature teams** in the teams switch. Select the Feature teams button, then **Platform reliability**, and select **Discard draft**.
  - **Expected:** The draft mark goes, and the joiner is no longer listed.
  - **Notes:**

### FT-09: An Earlier Date Is Read Only Without the Right to Change Dates

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from FT-08.

**Preconditions:** Signed in with this account. **Org chart** open, with **Feature teams** chosen in the teams switch, showing today.

- [ ] **Step 1.** Select the left arrow once.
  - **Expected:** The text below the row ends **Nothing can be changed on this date.** The **Draft** menu is gone.
  - **Notes:**

- [ ] **Step 2.** Select the Feature teams button, then any team.
  - **Expected:** The team's panel shows its members with no **×** beside them, and no **Add member** box.
  - **Notes:**

- [ ] **Step 3.** Select the right arrow twice.
  - **Expected:** The text below the row ends **Changes take effect from this date.** The **Draft** menu is back, and the team's panel shows an **×** beside each member and an **Add member** box.
  - **Notes:**

**Afterwards:** R1.
