---
title: "Manual Test: Org Chart"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/org-chart*", "apps/server/src/data/org-chart.ts", "packages/seed/src/**", "packages/fixtures/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md", "docs/design/pages/org-chart.md"]
last_updated: "2026-11-27"
---

# Manual Test: Org Chart

## Scope

Verifies the **Org chart** page:

- The levels it opens on, each person's card, and showing reports.
- Finding a person or team, and one team shown alone.
- Panning and zooming.
- Teams' colours and choosing them, and naming a team as a draft.
- The red **Left** box on a manager who has left, and drafted team names and positions marked on cards.
- Planned hires drawn as placeholders.
- Changing a manager from an earlier date.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Engineering Manager:** `engineering.manager@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as the chart, the finder, cards, bands, marks and the Publish button. This test adds:

- **Date row:** the row between the finder and the chart, holding a **Date** box, a left arrow, a timeline, a right arrow and **Today**.
- **Colour square:** the small rounded square of a team's colour just before its name on a card or in the **Teams** panel.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### ORG-01: The Org Chart Page Opens

**Account:** Engineering Manager, `engineering.manager@fathom.test`; the first test case.

**Preconditions:** Signed in with this account.

- [ ] `B4D3` Select the **Org chart** page in the **People** section of the left-hand menu.
  - **Expected:**
    - The page's heading reads **Org chart**, followed by the teams switch, with **Reporting teams** chosen.
    - The top bar reads "People / Org chart".
    - Above the chart, on the left: the finder, the **Draft** button reading **Drafts & Live**, and **Views**.
    - On the right: **Show levels**, **+**, **−** and **Fit to screen**.
    - The date row is between them and the chart.
  - **Notes:**

### ORG-02: The Chart Opens on the Top Two Levels

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ORG-01.

**Preconditions:** Signed in with this account. **Org chart** page open from the left-hand menu, with **Reporting teams** chosen in the teams switch.

- [ ] `2A30` Read the card at the top left of the chart.
  - **Expected:**
    - It reads 'Silje Holm-Schrøder'.
    - 'Engineering Manager' is under the name.
    - 'Platform team' is under 'Engineering Manager'.
    - It ends with "Hide 8 reports".
    - Two cards with dashed edges are beside it at the top:
      - "TBD-" and a number, with 'Engineering Manager' under it
      - 'REQ-2047', with 'Software Engineer' under it
  - **Notes:**

- [ ] `39D8` Read the cards under it.
  - **Expected:**
    - Eight cards, each joined to 'Silje Holm-Schrøder' by a line.
    - Five are in a column under her card's left edge, from the top: 'Blaise Gislason', 'Cleora Jerde', 'Jedidiah Funk', 'Simone Jean' and 'Tanushree Patel-Singh'.
    - The other three are in a row to the right of that column: 'Lorenza Thiel', 'Viktoria Holmberg' and '武井 聡'.
    - There is nothing below the row.
  - **Notes:**

- [ ] `53AB` Read the card for 'Viktoria Holmberg'.
  - **Expected:**
    - A red **Left** box follows the name.
    - 'Engineering Manager' is under the name.
    - 'Search team' is under that.
  - **Notes:**

### ORG-03: A Manager's Reports and All Levels Are Shown

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ORG-02.

**Preconditions:** As ORG-02.

- [ ] `D2FA` On the card for 'Lorenza Thiel', select **Show 8 reports**.
  - **Expected:**
    - Eight cards appear under 'Lorenza Thiel', each joined to her by a line:
      - seven in a column under her card's left edge, from 'Candice Swift' to 'Valéry Caron', then 'REQ-2042', with 'SDET' under it and a dashed edge
      - 'Atmananda Ganaka' to the right of them
    - The button now reads "Hide 8 reports".
  - **Notes:**

- [ ] `B38D` Select **Show levels**, then **All levels**.
  - **Expected:** No card ends with a **Show** button.
  - **Notes:**

- [ ] `68C9` Select **Fit to screen**.
  - **Expected:**
    - The whole chart fits in the panel.
    - Its cards are too small to read.
    - It reaches down further than across.
  - **Notes:**

### ORG-04: Finding a Person Brings Them to the Centre

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ORG-03.

**Preconditions:** As ORG-02. Select **Show levels**, then **1 level**, first.

- [ ] `5C31` Select the finder, and type `Gloria`.
  - **Expected:**
    - A list opens under the finder offering 'Gloria Armas Guardado'.
    - 'Software Engineer' is under the name.
    - An **×** is at the right of the finder, before the arrow.
  - **Notes:**

- [ ] `98ED` Select 'Gloria Armas Guardado'.
  - **Expected:**
    - The finder reads 'Gloria Armas Guardado'.
    - The chart opens out and moves until the card for 'Gloria Armas Guardado' is in the middle of the panel.
    - The card has a blue ring around it.
    - The card shows 'Software Engineer'.
    - A line joins it to the card for 'Joaquin Rice' above.
    - The card for 'Joaquin Rice' shows 'Billing team'.
  - **Notes:**

- [ ] `92E7` Select the **×** at the right of the finder.
  - **Expected:** The finder is empty.
  - **Notes:**

- [ ] `AB8F` Type `Billing`.
  - **Expected:**
    - The list offers 'Billing team'.
    - "Led by Joaquin Rice" is under it.
  - **Notes:**

- [ ] `D826` Select 'Billing team'.
  - **Expected:**
    - The finder reads 'Joaquin Rice'.
    - His card is in the middle of the panel.
    - His card has a blue ring around it.
    - His reports' cards are shown under it.
    - His card ends with "Hide 5 reports".
  - **Notes:**

**Afterwards:** Select **Show levels**, then **2 levels**.

### ORG-05: The Chart Pans and Zooms

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ORG-04.

**Preconditions:** As ORG-02.

- [ ] `BF3E` Hold the mouse button down on an empty part of the chart and drag to the left.
  - **Expected:** The cards move to the left with the pointer.
  - **Notes:**

- [ ] `16D9` With the pointer over the chart, scroll the mouse wheel, or move two fingers on the trackpad, up.
  - **Expected:** The chart zooms in around the pointer.
  - **Notes:**

- [ ] `D1F2` With the pointer over the chart, scroll the mouse wheel, or move two fingers on the trackpad, down.
  - **Expected:** The chart zooms out around the pointer.
  - **Notes:**

### ORG-06: A Card Shows the Person's Details Beside the Chart

Covered by [DETAILS-01](person-details-manual-test.md#details-01-a-persons-details-open-beside-the-org-chart) in Person Details.

### ORG-07: One Team Is Shown Alone

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ORG-05.

**Preconditions:** As ORG-02.

- [ ] `7D8E` Select the small org chart button at the top right of the card for 'Lorenza Thiel'.
  - **Expected:**
    - 'Lorenza Thiel' is at the top of the chart.
    - Her eight reports are under her.
    - 'Silje Holm-Schrøder' is not shown.
    - To the right of the heading, the page reads "Only the team of Lorenza Thiel is shown."
    - **Show everyone** is beside it.
    - Her card has no org chart button.
  - **Notes:**

- [ ] `A2DE` Select **Show everyone**.
  - **Expected:**
    - 'Silje Holm-Schrøder' is at the top of the chart again.
    - The line "Only the team of Lorenza Thiel is shown." is gone.
  - **Notes:**

- [ ] `B75A` Go back with the browser's back button.
  - **Expected:** Only the team of 'Lorenza Thiel' is shown again.
  - **Notes:**

**Afterwards:** Select **Show everyone**.

### ORG-08: Only Readers Who See Personal Details Are Told a Manager Has Left

Proved by automated tests in `apps/server/src/org-chart.test.ts` and `apps/web/src/org-chart-page-feature-team-changes.test.tsx`.

### ORG-09: Each Team Is Drawn in Its Colour, Reaching Down to Teams With None

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ORG-07.

**Preconditions:** As ORG-02.

- [ ] `E696` Read the card for 'Silje Holm-Schrøder'.
  - **Expected:**
    - A teal colour square comes before 'Platform team'.
    - The card has no band.
  - **Notes:**

- [ ] `447D` Read the eight cards under her, and the lines to them.
  - **Expected:**
    - Each card has a teal band.
    - Each line from her card is teal.
  - **Notes:**

- [ ] `7FC3` On the card for 'Lorenza Thiel', select **Show 8 reports**.
  - **Expected:**
    - Her card shows no team name.
    - Her eight reports' cards have teal bands.
    - The lines to them are teal.
  - **Notes:**

- [ ] `AD3D` On the card for 'Atmananda Ganaka', select **Show 9 reports**.
  - **Expected:**
    - His card has a teal band.
    - A grape (purple) colour square comes before 'Payments team'.
    - His nine reports' cards have grape bands.
    - The lines to them are grape.
  - **Notes:**

- [ ] `7C65` In the finder, type `Candice`, and select 'Candice Swift'.
  - **Expected:**
    - Her card has a blue ring around it.
    - Its band is blue too while she is found.
  - **Notes:**

### ORG-10: A Team's Colour Is Chosen on the Chart, at Once

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ORG-09.

**Preconditions:** Signed in with this account. **Org chart** page open from the left-hand menu, with **Reporting teams** chosen in the teams switch. The number on the Publish button written down.

- [ ] `F922` On the card for 'Silje Holm-Schrøder', select the teal colour square before 'Platform team'.
  - **Expected:**
    - A menu opens headed "Colour of Platform team".
    - It lists **Indigo**, **Violet**, **Grape**, **Pink**, **Red**, **Orange**, **Yellow**, **Lime**, **Green** and **Teal**, each after a small square of its colour, then, under a line, **No colour**.
    - **Teal** has a tick.
  - **Notes:**

- [ ] `B3FC` Select **Grape**.
  - **Expected:**
    - The menu closes.
    - A notification says "Platform team now has the colour Grape.", with **Undo**.
    - The colour square before 'Platform team' is grape (purple).
    - The bands of the eight cards under her and the lines to them are grape.
    - The Publish button's number is the one written down.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### ORG-11: A Team Is Named on the Chart as a Draft

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as ORG-10.

**Preconditions:** Signed in with this account. **Org chart** page open from the left-hand menu, with **Reporting teams** chosen in the teams switch. The number on the Publish button written down.

- [ ] `1CCE` On the card for 'Silje Holm-Schrøder', select 'Platform team'.
  - **Expected:**
    - A box opens under it with a field holding 'Platform team'.
    - The field has an **×** at its end.
    - **Cancel** and **Save** are under the field.
  - **Notes:**

- [ ] `9EA5` Replace the name with `Platform crew`.
  - **Expected:** The field holds `Platform crew`.
  - **Notes:**

- [ ] `FFD5` Select **Save**.
  - **Expected:**
    - The box closes.
    - A notification says "Draft saved. The team's name becomes Platform crew once approved."
    - The Publish button's number is one more than the number written down.
    - The card is tinted faint yellow.
    - The card is taller.
    - It reads `Platform crew`.
    - A hollow yellow dot is before it.
    - Under that, a green dot before 'Platform team', in grey.
  - **Notes:**

- [ ] `79AC` Select **Teams** above the chart, just right of the **Draft** button.
  - **Expected:**
    - A panel titled **Teams** opens on the right.
    - It lists the named teams first, by name, then the unnamed teams.
    - Each team has "Led by" and its manager's name under it.
    - Each team whose name is approved has a square button before it holding its colour square, or a dashed square where it has no colour.
    - Each unnamed team reads "Add a name", with no square button; among them is the team led by 'Lorenza Thiel'.
    - `Platform crew` has a hollow yellow dot before it.
    - Under `Platform crew`, a green dot before 'Platform team', in grey.
    - 'Observability team' has a yellow dot before it, and no square button.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### ORG-12: A Person Drafted to Another Manager Is Drawn in Both Places

**Account:** Engineering Manager, `engineering.manager@fathom.test`, changed from ORG-11.

**Preconditions:** As ORG-02.

- [ ] `C32D` On the card for 'Viktoria Holmberg', select **Show 3 reports**.
  - **Expected:**
    - Three cards appear in a column under her: 'Simone Jean', '우아현' and '西尾 亮'.
    - The card for 'Simone Jean' is faded and light green.
    - The card for 'Simone Jean' has a dashed edge.
    - On it, a green dot before her name, in grey.
    - The line to it is dashed and faded.
  - **Notes:**

- [ ] `E6C8` Select the name on the light green card for 'Simone Jean'.
  - **Expected:**
    - Nothing opens.
    - No card changes colour.
  - **Notes:**

- [ ] `AFD0` Look at the tinted card under 'Silje Holm-Schrøder' and the light green card under 'Viktoria Holmberg'.
  - **Expected:**
    - Both are easy to tell apart from the untinted cards.
    - Every word on them is easy to read.
  - **Notes:**

### ORG-13: A Drafted Team Name or Position Is Marked

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ORG-12.

**Preconditions:** As ORG-02.

- [ ] `96C8` In the finder, type `本間`, and select '本間 稔'.
  - **Expected:**
    - The card for '本間 稔' is in the middle of the panel.
    - The card is tinted faint yellow.
    - 'Observability team' is under the position.
    - A yellow dot is before it.
    - There is no line under 'Observability team'.
  - **Notes:**

- [ ] `854F` Select the **×** at the right of the finder.
  - **Expected:** The finder is empty.
  - **Notes:**

- [ ] `EA3D` Type `우아`, and select '우아현'.
  - **Expected:**
    - The card for '우아현' is in the middle of the panel.
    - The card is tinted faint red.
    - 'Test Engineer' is under the name.
    - A red dot in a ring is before it.
    - Under that, a green dot before 'Software Engineer', in grey.
    - The card is taller than the card for '西尾 亮' under it.
    - Nothing on the card is cut off.
  - **Notes:**

### ORG-14: The Draft Menu Applies Drafts or Leaves Them Out

Covered by [MARK-06](draft-marks-manual-test.md#mark-06-drafts-applied-shows-dots-without-tints-or-live-rows) and [MARK-07](draft-marks-manual-test.md#mark-07-live-only-marks-what-a-waiting-draft-would-change) in Draft Marks.

### ORG-15: Readers Who Do Not See Personal Details See No Drafted Manager

Proved by automated tests in `apps/server/src/org-chart.test.ts`.

### ORG-16: Planned Hires Are Placeholders, and a Planned Manager Heads Its Team

**Account:** Engineering Manager, `engineering.manager@fathom.test`, the same as ORG-13.

**Preconditions:** As ORG-02.

- [ ] `A6AC` Read the card at the top of the chart that reads "TBD-" and a number, with 'Engineering Manager' under it.
  - **Expected:**
    - The card has a grey dashed edge.
    - The card has no shadow.
    - "TBD-" and its number are grey and in italics.
    - Under that, a grey box reads "Planned, no target date".
    - It ends with "Hide 2 reports".
  - **Notes:**

- [ ] `C338` Read the two cards under it.
  - **Expected:**
    - The cards are:
      - 'Platform engineer', with 'Software Engineer' under the name
      - "TBD-" and a number, in grey italics, with 'SDET' under it
    - Each has a dashed edge.
    - Each is joined to the planned Engineering Manager's card by a line.
    - 'Platform engineer' reads "Planned, expected" and the month six months after the month Restore the Seed Data was run, such as "May 2027" for a run in November 2026.
  - **Notes:**

- [ ] `47AC` On the planned Engineering Manager's card, select the small org chart button at the top right.
  - **Expected:**
    - That card is at the top of the chart.
    - Its two planned hires are under it.
    - The page reads "Only the team of Engineering Manager, TBD-", the card's number, then "is shown."
  - **Notes:**

**Afterwards:** Select **Show everyone**.

### ORG-17: A Manager Is Changed From an Earlier Date

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from ORG-16.

**Preconditions:** Restore the Seed Data has been run. Signed in with this account. **Org chart** page open from the left-hand menu, showing today, with **Reporting teams** chosen in the teams switch. Select **Show levels**, then **All levels**, first.

- [ ] `76C4` In the date row, select the left arrow once.
  - **Expected:**
    - The **Date** box shows the first day of last month.
    - The **Draft** button stays just right of the finder.
    - **Teams** is gone.
  - **Notes:**

- [ ] `B101` In the finder, type `Candice`, and select 'Candice Swift'.
  - **Expected:**
    - The card for 'Candice Swift' is in the middle of the panel.
    - It has a blue ring around it.
  - **Notes:**

- [ ] `7CFA` Select the name on her card.
  - **Expected:**
    - Her details slide out in a panel on the right.
    - **Manager** reads 'Lorenza Thiel'.
    - **Manager** has a change button.
    - **Reporting team name** has no change button.
  - **Notes:**

- [ ] `DEBB` Select the change button beside **Manager**, and choose 'Max Munk'.
  - **Expected:**
    - In the panel, **Manager** reads 'Max Munk'.
    - A hollow yellow dot is before it.
    - **Manager assigned** reads the first day of last month, such as "Oct 1, 2026".
    - On the chart, the card for 'Candice Swift' is under 'Max Munk'.
    - That card is tinted faint yellow.
    - It has a hollow yellow dot before the name.
    - It has no date.
    - A light green copy of her card is under 'Lorenza Thiel'.
    - On that copy, a green dot before her name.
  - **Notes:**

- [ ] `2AD0` Select **Today** in the date row.
  - **Expected:**
    - **Teams** is back.
    - On the card for 'Candice Swift' under 'Max Munk', a hollow yellow dot comes before her full name.
    - Under 'SDET', a grey line reads "From" and the first day of last month, such as "From Oct 1, 2026".
    - Nothing on the card is cut off.
  - **Notes:**

- [ ] `FFA8` Select the left arrow twice.
  - **Expected:**
    - The card for 'Candice Swift' is under 'Lorenza Thiel'.
    - That card is untinted.
    - That card has no dot.
    - There is no card for her under 'Max Munk'.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### ORG-18: Planned Hires Are Drawn on Later Dates

Proved by automated tests in `apps/server/src/org-chart-hires.test.ts`.

### ORG-19: A Team's Colour Shows Before Its Name on People and in Details

Covered by [MGR-01](managers-manual-test.md#mgr-01-manager-shows-who-is-marked-as-a-manager) and [MGR-07](managers-manual-test.md#mgr-07-a-team-name-is-edited-on-its-managers-row) in Managers and Teams on People, and [DETAILS-01](person-details-manual-test.md#details-01-a-persons-details-open-beside-the-org-chart) in Person Details.
