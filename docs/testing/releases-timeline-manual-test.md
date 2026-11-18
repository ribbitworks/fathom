---
title: "Manual Test: Release Timelines and Links"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md"]
last_updated: "2026-11-18"
---

# Manual Test: Release Timelines and Links

## Scope

Verifies the timeline on each tab of the Releases page, its zoom and strip, the features each tab names, and the links from a record's details and the timeline's marks to the records they name on the other tabs. [Releases](releases-manual-test.md), [Cycles](release-cycles-manual-test.md) and [Schedules](release-schedules-manual-test.md) verify each tab's table and details.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Team Member:** `team.member@fathom.test`
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**
- **Product Manager:** `product.manager@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom), [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data) and [Discard the Unpublished Changes](manual-test-basics.md#discard-the-unpublished-changes).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses, such as marks and the Draft menu. This test adds:

- **Tabs:** the tabs **Releases**, **Cycles** and **Schedules** just after the **Releases** heading, on the same line. The page opens on **Releases**, or on the tab it last showed.
- **Timeline:** the section headed **Timeline** above each tab's table, with **−** and **+** buttons and the zoom buttons **All**, **Year**, **6 months**, **Quarter**, **Month**, **Week** and **Days** at its top right, and the strip under them. It has a row for each schedule the table lists, named on the left, under an axis of two rows of dates, with a red line on today. On **Releases**, each release is a strip of its colour with a diamond on the day it ships, over the schedule's cycles, which are drawn faint; on **Cycles**, each cycle is a block with its name inside, with each release's diamond; on **Schedules**, each cycle is a block, with the schedule's end. Pointing at a mark shows its tip.
- **Strip:** the row between the timeline's zoom buttons and its rows: **‹**, a box for each quarter of the timeline, **›**, and **Today** while today is on the timeline.
- **Seeded dates in this test:** **This quarter** is the quarter today is in, and **the first half** is Platform's first half-year cycle, three quarters after this quarter. The examples after "such as" are as the seed data is when added on 17 November 2026.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out. To run the test again, start again from Restore the Seed Data.

### Part 1: The Timeline

#### REL-18: The Timeline Shows Each Schedule's Releases

**Account:** Team Member, `team.member@fathom.test`; the first test case.

**Preconditions:** Restore the Seed Data run, then signed in with this account. **Releases** page open from the left-hand menu.

- [ ] `56D9` Select **Year** at the top right of the timeline.
  - **Expected:**
    - **Year** is highlighted.
    - The timeline has three rows, named 'Platform', 'Patches' and 'Field Apps'.
    - The axis's top row names years, such as "2027", and its second row half years, such as "Jan to Jun 27".
    - A red line crosses every row, about a sixth of the way across the timeline, labelled **Today** above the axis.
  - **Notes:**

- [ ] `1FC4` Read the releases of 'Platform'.
  - **Expected:**
    - 'Harbor 3' has a yellow dot before its name, and spans the cycle after next quarter's to the cycle after the first half, such as '27.2' to '28.1'.
    - In a lane under it, a faded 'Harbor 3' after a green dot spans next quarter's cycle to the first half, such as '27.1' to '27.3'.
  - **Notes:**

- [ ] `A150` Point at the strip of 'Harbor 2 LTS'.
  - **Expected:** Its tip starts with its name, its cycles and the day it ships, such as "Harbor 2 LTS: 26.3 to 26.4, ships 2026-12-31."
  - **Notes:**

- [ ] `A8FF` Read the name 'Patches' on the left of the timeline.
  - **Expected:** A yellow dot is before 'Patches', and a **Retired** box after it, on the same line.
  - **Notes:**

- [ ] `6CC2` Choose **Drafts applied** in the Draft menu.
  - **Expected:**
    - 'Harbor 3' still spans '27.2' to '28.1', with a yellow dot before its name.
    - 'Platform' has no faded 'Harbor 3'.
  - **Notes:**

- [ ] `FAE7` Choose **Live only** in the Draft menu.
  - **Expected:**
    - 'Harbor 3' spans next quarter's cycle to the first half, such as '27.1' to '27.3', with a green dot before its name.
    - 'Harbor 4' is not on the timeline.
    - No release on the timeline has a yellow dot.
  - **Notes:**

#### REL-19: The Timeline Zooms In and Out

**Account:** Team Member, `team.member@fathom.test`, the account REL-18 ended with.

**Preconditions:** Run after REL-18. **Releases** page selected again in the left-hand menu.

- [ ] `060D` Select **All**.
  - **Expected:**
    - The whole timeline fits across, with no scrolling sideways.
    - The **−** button is greyed out.
  - **Notes:**

- [ ] `FC03` Select **Quarter**.
  - **Expected:**
    - The axis's top row names quarters, such as "Q1 2027", and its second row months, such as "Jan".
    - The red **Today** line crosses the timeline at today's date on the axis.
  - **Notes:**

- [ ] `82FE` Select **Year**.
  - **Expected:** **Year** is highlighted.
  - **Notes:**

#### REL-20: The Strip Follows the Timeline

**Account:** Team Member, `team.member@fathom.test`, the account REL-19 ended with.

**Preconditions:** Run after REL-19. **Releases** page open, with the timeline at **Year**.

- [ ] `C9C3` Select **Quarter**.
  - **Expected:**
    - Under the zoom buttons, the strip shows a box for each quarter of the timeline, such as "Q1 2027", with **‹** before it, and **›** and **Today** after it.
    - The quarters in view on the timeline are tinted blue, and the others are not.
    - This quarter's box is underlined in red and its name in bold.
  - **Notes:**

- [ ] `7A96` Select the box for the quarter after next in the strip, such as "Q2 2027".
  - **Expected:**
    - The timeline scrolls so that quarter starts about a sixth of the way across.
    - The tint moves to the quarters in view.
    - That quarter's box is filled blue, with its name in white.
  - **Notes:**

- [ ] `040D` Select **Today**.
  - **Expected:**
    - The red **Today** line is back about a sixth of the way across the timeline.
    - No quarter's box is filled blue.
  - **Notes:**

- [ ] `77FB` Press Shift+Tab until a box in the strip has focus.
  - **Expected:** The box has a focus ring.
  - **Notes:**

- [ ] `35C1` Press the right arrow key.
  - **Expected:**
    - Focus moves to the next quarter's box.
    - The timeline does not scroll.
  - **Notes:**

- [ ] `5A49` Press Enter.
  - **Expected:**
    - The timeline scrolls so that quarter starts about a sixth of the way across.
    - That quarter's box is filled blue.
  - **Notes:**

#### REL-21: A Release's Own Ship Day Is Marked on the Timeline

Covered by [REL-17](releases-manual-test.md#rel-17-a-release-ships-on-a-day-of-its-own), which reads a release's own ship day on the timeline.

#### REL-36: Each Tab's Timeline Draws What Its Table Lists

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from REL-20.

**Preconditions:** Signed in with this account. **Releases** page open on the **Releases** tab, with no side panel open, and **Year** chosen on the timeline.

- [ ] `0651` Read the releases of 'Platform' on the timeline.
  - **Expected:**
    - Each release is a strip of its colour along its cycles, with its diamond under its end.
    - Under the strips, 'Platform''s cycles are drawn faint, each a different shade from the one before.
    - Above each strip wide enough for it: a dot, if it has a draft, then a small square of its colour, then its name.
  - **Notes:**

- [ ] `EB18` Read the releases of 'Patches' on the timeline.
  - **Expected:** The strips too short for their names show no dot, square or name above them.
  - **Notes:**

- [ ] `7B4D` Select the **Schedules** tab.
  - **Expected:**
    - On the timeline, each schedule's row shows its cycles as blocks, each a different shade from the one before.
    - The cycles that have ended are fainter than the current one and those after it.
    - No releases are drawn.
  - **Notes:**

- [ ] `2E93` Select the details button at the right of the first cell of the row for 'Field Apps'.
  - **Expected:** The side panel opens, headed 'Field Apps'.
  - **Notes:**

- [ ] `9F18` Select the pencil at the right of the **Schedule ends** row.
  - **Expected:** A dialog titled "Change when Field Apps ends" opens.
  - **Notes:**

- [ ] `A5C2` Type 30 September three years after this year in **Schedule ends**, as its digits, such as `20290930`.
  - **Expected:** The last cycle in the table under the field ends on the day typed.
  - **Notes:**

- [ ] `4D7E` Select **Save**.
  - **Expected:** The dialog closes, and **Schedule ends** in the side panel reads that day, such as "Sep 30, 2029".
  - **Notes:**

- [ ] `5E7C` Select **All** at the top right of the timeline.
  - **Expected:**
    - At the right end of 'Field Apps''s row, its cycles stop at that day, with a short upright grey line there.
    - After the line, it reads "Ends" and the day, such as "Ends Sep 30, 2029".
  - **Notes:**

**Afterwards:** Run Discard the Unpublished Changes.

#### REL-44: The Cycles Timeline Names Each Cycle and Marks Today's

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the account REL-36 ended with.

**Preconditions:** **Releases** page open on the **Cycles** tab, with no side panel open, and **Year** chosen on the timeline.

- [ ] `7EAF` Read the row for 'Field Apps' on the timeline.
  - **Expected:**
    - Each cycle is a block with its name inside it, as **Cycle** reads it in the table.
    - The first block is the cycle whose **Current** reads "Current" in the table.
  - **Notes:**

- [ ] `8973` Point at the first block in the row for 'Field Apps'.
  - **Expected:** Its tip reads the cycle's name, its first and last days, then ", current".
  - **Notes:**

- [ ] `202F` Point at the diamond after the end of the first block.
  - **Expected:** Its tip reads "Lantern 2 ships" and its day.
  - **Notes:**

- [ ] `AD62` Select **Show past cycles** in the **Views** menu.
  - **Expected:** The row for 'Field Apps' starts with two more blocks, before the one whose tip ends ", current".
  - **Notes:**

### Part 2: Features and Links Between the Tabs

#### REL-45: Each Tab Names the Features of Its Records

**Account:** Product Manager, `product.manager@fathom.test`, changed from REL-44.

**Preconditions:** Signed in with this account. **Releases** page open on the **Releases** tab, with no side panel open.

- [ ] `3F83` Point at the **Features** cell of the row for 'Harbor 2 LTS'.
  - **Expected:**
    - The cell reads "Bulk Import, Offline Sync, Single Sign-On Setup, Usage Alerts", cut short where it doesn't fit.
    - Its tip names the same four features, one to a line.
  - **Notes:**

- [ ] `4D31` Select the details button at the right of the first cell of the row for 'Lantern 2'.
  - **Expected:**
    - The **Features** row lists 'Barcode Scanning', 'Offline Forms', 'Parts Lookup', 'Signature Capture' and 'Site Diary', one to a line, then **Show all (7)**.
    - **Show on Features** and **Show on the Board** follow.
  - **Notes:**

- [ ] `34D2` Select **Show all (7)**.
  - **Expected:** 'Timesheet Sync' and 'Weather Alerts' follow 'Site Diary', then **Show less**.
  - **Notes:**

- [ ] `F073` Select 'Parts Lookup'.
  - **Expected:** The **Features** page opens, with the details of 'Parts Lookup' beside the table.
  - **Notes:**

- [ ] `92EB` Select **Releases** in the left-hand menu.
  - **Expected:** The **Releases** tab shows, with no side panel open.
  - **Notes:**

- [ ] `07D9` Select the details button at the right of the first cell of the row for 'Harbor 2 LTS'.
  - **Expected:** The **Features** row lists 'Bulk Import', 'Offline Sync', 'Single Sign-On Setup' and 'Usage Alerts', one to a line.
  - **Notes:**

- [ ] `671F` Select **Show on Features**.
  - **Expected:**
    - The **Features** page opens with a **Release** filter on.
    - The table lists 'Bulk Import', 'Offline Sync', 'Single Sign-On Setup' and 'Usage Alerts', and no other feature.
  - **Notes:**

- [ ] `9B5F` Select **Releases** in the left-hand menu.
  - **Expected:** The **Releases** tab shows, with no side panel open.
  - **Notes:**

- [ ] `B62F` Select the details button at the right of the first cell of the row for 'Harbor 2 LTS'.
  - **Expected:** The release's details open beside the table.
  - **Notes:**

- [ ] `C274` Select **Show on the Board**.
  - **Expected:**
    - The **Features** page opens on its board for 'Platform', with a **Release** filter on.
    - Its cards are 'Bulk Import', 'Offline Sync', 'Single Sign-On Setup' and 'Usage Alerts', and no other.
  - **Notes:**

- [ ] `43EF` Select **Releases** in the left-hand menu.
  - **Expected:** The **Releases** tab shows, with no side panel open.
  - **Notes:**

- [ ] `0492` Select the **Cycles** tab.
  - **Expected:** In the row whose **Schedule** reads 'Platform' and whose **Current** reads "Current", **Features** reads "Offline Sync, Usage Alerts".
  - **Notes:**

- [ ] `2C6B` Select the **Schedules** tab.
  - **Expected:**
    - **Features this cycle** reads "Offline Sync, Usage Alerts" in the row for 'Platform'.
    - It is blank in the row for 'Patches'.
  - **Notes:**

**Afterwards:** Select the **Releases** tab.

#### REL-46: A Record's Details Link the Records They Name

**Account:** Product Manager, `product.manager@fathom.test`, the account REL-45 ended with.

**Preconditions:** Signed in with this account. **Releases** page open from the left-hand menu, on the **Releases** tab, with no side panel open.

- [ ] `FAB7` Select the details button at the right of the first cell of the row for 'Harbor 2 LTS'.
  - **Expected:**
    - The **Cycles** row lists the release's two cycles, one to a line, each underlined as a link.
    - The **Schedule** row reads 'Platform', underlined as a link.
    - Under the release's name, its key reads "#RELEASE-" and a number.
  - **Notes:**

- [ ] `8210` Select the second cycle in the **Cycles** row.
  - **Expected:** The **Cycles** tab shows, with that cycle's details beside the table.
  - **Notes:**

- [ ] `E2AA` Select 'Harbor 2 LTS' in the **Release** row.
  - **Expected:** The **Releases** tab shows, with the details of 'Harbor 2 LTS' beside the table.
  - **Notes:**

- [ ] `9191` Select 'Platform' in the **Schedule** row.
  - **Expected:** The **Schedules** tab shows, with the details of 'Platform' beside the table.
  - **Notes:**

- [ ] `E50C` Select the cycle in the **Current cycle** row.
  - **Expected:**
    - The **Cycles** tab shows, with that cycle's details beside the table.
    - Its **Current** row reads "Current".
  - **Notes:**

#### REL-47: A Schedule Shows Its Releases and Its Cycles

**Account:** Product Manager, `product.manager@fathom.test`, the account REL-46 ended with.

**Preconditions:** Run after REL-46, which ends on the **Cycles** tab.

- [ ] `233B` Select the **Schedules** tab.
  - **Expected:** The table of schedules shows, with no side panel open.
  - **Notes:**

- [ ] `F21E` Select the details button at the right of the first cell of the row for 'Platform'.
  - **Expected:** The details of 'Platform' open beside the table.
  - **Notes:**

- [ ] `C4C8` Select **Show its cycles**.
  - **Expected:**
    - The **Cycles** tab shows.
    - Every row's **Schedule** reads 'Platform'.
  - **Notes:**

- [ ] `3D3D` Select the **Schedules** tab.
  - **Expected:** The table of schedules shows, with no side panel open.
  - **Notes:**

- [ ] `EE04` Select the details button at the right of the first cell of the row for 'Platform'.
  - **Expected:** The details of 'Platform' open beside the table.
  - **Notes:**

- [ ] `9C98` Select **Show its releases**.
  - **Expected:**
    - The **Releases** tab shows.
    - Every row's **Schedule** reads 'Platform'.
  - **Notes:**

**Afterwards:** Open the **Views** menu above the table and select **Clear view**.

#### REL-48: The Timeline's Marks Open Their Records

**Account:** Product Manager, `product.manager@fathom.test`, the account REL-47 ended with.

**Preconditions:** Signed in with this account. **Releases** page open from the left-hand menu, on the **Releases** tab, with no side panel open.

- [ ] `BB2C` Select the span of 'Harbor 3' on the timeline.
  - **Expected:** The details of 'Harbor 3' open beside the table.
  - **Notes:**

- [ ] `3981` Select the name 'Field Apps' at the left of the timeline.
  - **Expected:** The **Schedules** tab shows, with the details of 'Field Apps' beside the table.
  - **Notes:**

- [ ] `11C5` Select the block that today's red line crosses in the row for 'Platform' on the timeline.
  - **Expected:**
    - The **Cycles** tab shows, with that cycle's details beside the table.
    - Its **Current** row reads "Current".
  - **Notes:**

- [ ] `E850` Select **Releases** in the left-hand menu.
  - **Expected:** The **Cycles** tab shows, with no side panel open.
  - **Notes:**

- [ ] `B7D1` Select the **Releases** tab.
  - **Expected:** The **Releases** tab shows, with no side panel open.
  - **Notes:**

- [ ] `1EAC` Press Tab until the span of 'Harbor 3' on the timeline has focus.
  - **Expected:** A ring shows around the span.
  - **Notes:**

- [ ] `57F2` Press Enter.
  - **Expected:** The details of 'Harbor 3' open beside the table.
  - **Notes:**
