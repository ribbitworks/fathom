---
title: "Manual Test: Acceptance, Feature Teams"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/testing/acceptance/acceptance-reporting-lines-manual-test.md", "docs/help/setting-up-fathom.md", "docs/product/roles.md"]
last_updated: "2026-11-19"
---

# Manual Test: Acceptance, Feature Teams

## Scope

Verifies the end of the last round of setting up a brand-new Fathom as [Setting Up Fathom](../../help/setting-up-fathom.md) describes. The Workforce Administrator records two feature teams from six months ago and publishes the whole round, with the managers, team names, sites and planned hire [Reporting Lines](acceptance-reporting-lines-manual-test.md) drafted. The Engineering Director signs in for the first time, approves them all in one pass, and reads the people and teams that result.

## Test Environment

What [Reporting Lines](acceptance-reporting-lines-manual-test.md) left, run straight after it:

- Fathom running on its installation, at `https://localhost:10443`, in a browser window at least 1,440 pixels wide, signed in as the Workforce Administrator with eight changes not yet published.
- The password list, open in a plain text editor.

## Test Accounts

[The Team's Accounts](acceptance-team-accounts-manual-test.md) made these:

- **Workforce Administrator:** `ines.harrow@fathom.test`, shown in Fathom as `Ines Harrow`
- **Engineering Director:** `odile.brandt@fathom.test`, shown in Fathom as `Odile Brandt`, whose first sign-in is in this test, with the new password `fictional odile password`

## Common Procedures

This test uses [Change a Generated Password](../manual-test-basics.md#change-a-generated-password) and [Publish](../manual-test-basics.md#publish). [Start Again](../manual-test-basics.md#start-again) removes the installation, for a fresh run from [Installing Fathom](acceptance-installing-fathom-manual-test.md).

## Terms

[Manual Test Basics](../manual-test-basics.md#terms) defines the terms every test uses, such as marks, the Publish button, the teams switch, the Feature teams button, the team panel, cards and the tick box. This test adds:

- **Typed dates:** unlike the Basics' dates, this test's steps type dates as digits with no separators, such as `20260501`.
- **Months from today:** the steps name months by where they fall from the current month: **six months ago** is the sixth month before it, and **three months from now** the third month after it. The examples after "such as" are for a run in November 2026, such as `20260501` for the first day of six months ago.
- **Date box:** the box labelled **Date** between the **Org chart** heading and the chart, before the left arrow, timeline, right arrow and **Today**.

## Test Cases

Run the test cases in order, in about 30 minutes, straight after [Reporting Lines](acceptance-reporting-lines-manual-test.md). Check each step whose expected result you see, and write anything else under its notes.

### FTEAM-01: Two Feature Teams Are Recorded From Six Months Ago

**Account:** Workforce Administrator, `ines.harrow@fathom.test`, the same as LINES-04 in [Reporting Lines](acceptance-reporting-lines-manual-test.md); the first test case.

**Preconditions:** [Reporting Lines](acceptance-reporting-lines-manual-test.md) run just before.

- [ ] `F0C5` Select the **Org chart** page in the left-hand menu.
  - **Expected:**
    - The chart opens.
    - The **Date** box shows today.
  - **Notes:**

- [ ] `545D` Choose **Feature teams** in the teams switch.
  - **Expected:** **Feature teams** is chosen in the teams switch.
  - **Notes:**

- [ ] `CCA4` Clear the **Date** box, type the first day of six months ago, such as `20260501`, and press Enter.
  - **Expected:** Below the date row, text reads "Showing" and that day, such as "Showing May 1, 2026.", then "Changes take effect from this date."
  - **Notes:**

- [ ] `D6C7` Select the Feature teams button.
  - **Expected:**
    - The menu reads "No feature teams yet".
    - Under it is **New feature team**.
  - **Notes:**

- [ ] `8E74` Select **New feature team**.
  - **Expected:**
    - A panel titled **New feature team** opens.
    - A **Details** section has a **Name** row with an empty box.
    - A **Members** section has the rows **Feature lead** and **Members**, each with a change button.
    - **Cancel** and **Add** are at the foot.
  - **Notes:**

- [ ] `DA42` Type `Tide team` in the **Name** box.
  - **Expected:** The **Name** box holds `Tide team`.
  - **Notes:**

- [ ] `CAB2` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `90A3` Type `Ada`, and press Enter.
  - **Expected:** `Ada Quill` has a tick.
  - **Notes:**

- [ ] `4EA6` Type `Bram`, and press Enter.
  - **Expected:** `Bram Oakes` has a tick.
  - **Notes:**

- [ ] `631D` Type `Cleo`, and press Enter.
  - **Expected:** `Cleo Marsh` has a tick.
  - **Notes:**

- [ ] `950B` Press Enter.
  - **Expected:** **Members** lists `Ada Quill`, `Bram Oakes` and `Cleo Marsh`, one to a line.
  - **Notes:**

- [ ] `F9E7` Select **Add**.
  - **Expected:**
    - The panel is titled `Tide team`, with a hollow yellow dot before it.
    - **Members** lists `Ada Quill`, `Bram Oakes` and `Cleo Marsh`, each with a hollow yellow dot before the name.
    - On the chart, a card named `Tide team` reads "No feature lead".
  - **Notes:**

- [ ] `17A8` Select the Feature teams button, then **New feature team**.
  - **Expected:** A panel titled **New feature team** opens.
  - **Notes:**

- [ ] `E1FB` Type `Harbour team` in the **Name** box.
  - **Expected:** The **Name** box holds `Harbour team`.
  - **Notes:**

- [ ] `E7AA` Select the change button in the **Members** row.
  - **Expected:**
    - A list of people opens under the row.
    - The cursor is in a box above it.
  - **Notes:**

- [ ] `56CF` Type `Dara`, and press Enter.
  - **Expected:** `Dara Finch` has a tick.
  - **Notes:**

- [ ] `BA84` Type `Emil`, and press Enter.
  - **Expected:** `Emil Stone` has a tick.
  - **Notes:**

- [ ] `2E48` Press Enter.
  - **Expected:** **Members** lists `Dara Finch` and `Emil Stone`, one to a line.
  - **Notes:**

- [ ] `CB1E` Select the change button in the **Feature lead** row, type `Dara`, and press Enter.
  - **Expected:** **Feature lead** reads `Dara Finch`.
  - **Notes:**

- [ ] `688D` Select **Add**.
  - **Expected:**
    - The panel is titled `Harbour team`, with a hollow yellow dot before it.
    - **Feature lead** reads `Dara Finch`.
    - **Members** lists `Dara Finch` and `Emil Stone`.
  - **Notes:**

### FTEAM-02: Today's Chart Shows the Teams

**Account:** Workforce Administrator, `ines.harrow@fathom.test`, the same as FTEAM-01.

**Preconditions:** FTEAM-01 done. **Org chart** page open, showing six months ago.

- [ ] `E7C3` Select **Today**.
  - **Expected:**
    - The text below the date row is gone.
    - `Tide team` has `Ada Quill`, `Bram Oakes` and `Cleo Marsh` under its card.
    - `Harbour team`'s first card is `Dara Finch`'s, with `Emil Stone` under it.
  - **Notes:**

### FTEAM-03: The Round Is Published

**Account:** Workforce Administrator, `ines.harrow@fathom.test`, the same as FTEAM-02.

**Preconditions:** FTEAM-02 done.

- [ ] `5F11` Run Publish.
  - **Expected:** The Publish button, which read **Publish 10 changes**, is gone.
  - **Notes:**

### FTEAM-04: The Engineering Director Signs In for the First Time

**Account:** Engineering Director, `odile.brandt@fathom.test`, changed from FTEAM-03. The first step signs out the Workforce Administrator.

**Preconditions:** FTEAM-03 done.

- [ ] `507F` Sign out from the account menu.
  - **Expected:** The **Sign in** page shows.
  - **Notes:**

- [ ] `386D` Sign in as the Engineering Director, `odile.brandt@fathom.test`, with the password beside it in the password list.
  - **Expected:** A page headed **Change password** shows, with no left-hand menu.
  - **Notes:**

- [ ] `AA16` Run Change a Generated Password, with the new password `fictional odile password`.
  - **Expected:**
    - Fathom opens on the **Overview**.
    - The top bar's right end shows `Odile Brandt`.
  - **Notes:**

### FTEAM-05: The Engineering Director Approves the Whole Round

**Account:** Engineering Director, `odile.brandt@fathom.test`, the same as FTEAM-04.

**Preconditions:** FTEAM-04 done.

- [ ] `2D2B` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **To decide** is chosen beside the page's title.
    - Ten rows are shown, each with a tick box, whose **Record** reads:
      - each of the seven people, with **Type** "Person"
      - `Fictional tide engineer`, with **Type** "Planned hire"
      - `Tide team` and `Harbour team`, each with **Type** "Feature team"
  - **Notes:**

- [ ] `58F3` Tick the tick box before **Record** in the table's header.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 10 drafts…**.
  - **Notes:**

- [ ] `29DA` Select **Approve 10 drafts…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 10 drafts?" opens.
  - **Notes:**

- [ ] `6BEB` Select **Approve** in the dialog.
  - **Expected:**
    - A notification says "Approved 10 drafts."
    - The table reads "No drafts".
  - **Notes:**

### FTEAM-06: The Engineering Director Reads the People and Teams

**Account:** Engineering Director, `odile.brandt@fathom.test`, the same as FTEAM-05.

**Preconditions:** FTEAM-05 done.

- [ ] `0DFB` Select the **People** page in the left-hand menu.
  - **Expected:**
    - No row has a dot.
    - **Team** reads `Lamp crew` for `Bram Oakes`, `Cleo Marsh`, `Freya Holt` and `Fictional tide engineer`.
    - **Team** reads `Keepers` for `Ada Quill`, `Dara Finch` and `Emil Stone`.
    - **Site** reads `Harbourside` for `Odile Brandt`, `Bram Oakes`, `Dara Finch` and `Emil Stone`.
    - **Site** reads `Northmere` for `Ada Quill`, `Cleo Marsh` and `Freya Holt`.
  - **Notes:**

- [ ] `F023` Select the **Org chart** page in the left-hand menu.
  - **Expected:**
    - `Odile Brandt` is at the top, with `Engineering Director` under the name and `Keepers` under that.
    - `Dara Finch` and `Emil Stone` are in a column under her.
    - `Ada Quill`, with `Engineering Manager` under the name and `Lamp crew` under that, is to the right of that column.
    - Her card ends with "Show 4 reports".
  - **Notes:**

- [ ] `0B32` On the card for `Ada Quill`, select **Show 4 reports**.
  - **Expected:**
    - `Bram Oakes`, `Cleo Marsh` and `Freya Holt` appear in a column under her.
    - After them is a card with a grey dashed edge for `Fictional tide engineer`, with "Software Engineer" under the name.
    - On that card, a grey box reads "Planned, expected" and the month three months from now.
  - **Notes:**

**Afterwards:** Run [Start Again](../manual-test-basics.md#start-again) to end the run here.
