---
title: "Manual Test: Acceptance, Reading the Plan"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/testing/acceptance/acceptance-deciding-the-changes-manual-test.md", "docs/help/working-as-a-team-member.md", "docs/help/working-as-an-executive.md", "docs/product/roles.md"]
last_updated: "2026-11-20"
---

# Manual Test: Acceptance, Reading the Plan

## Scope

Verifies that those who read the plan find what the team built, without changing it. The Team Member finds someone on the org chart, sees what each cycle and release holds, looks at a project's milestones, and applies the view of People the Engineering Director shared, as [Working as a Team Member](../../help/working-as-a-team-member.md) describes, without seeing the Personal sites. The Executive reads the plan by release, the feature teams in a later month, and the access history of the whole run, and sees the accounts without changing them, as [Working as an Executive](../../help/working-as-an-executive.md) describes. It is the last acceptance test.

## Test Environment

What [Deciding the Changes](acceptance-deciding-the-changes-manual-test.md) left, run straight after it:

- Fathom running on its installation, at `https://localhost:10443`, in a browser window at least 1,440 pixels wide.
- The password list, open in a plain text editor.

## Test Accounts

[The Team's Accounts](acceptance-team-accounts-manual-test.md) made these, and each signs in for the first time in this test:

- **Team Member:** `bram.oakes@fathom.test`, shown in Fathom as `Bram Oakes`, with the new password `fictional bram password`
- **Executive:** `vera.marlow@fathom.test`, shown in Fathom as `Vera Marlow`, with the new password `fictional vera password`

## Common Procedures

This test uses [Change a Generated Password](../manual-test-basics.md#change-a-generated-password) and [Start Again](../manual-test-basics.md#start-again).

## Terms

[Manual Test Basics](../manual-test-basics.md#terms) defines the terms every test uses, such as the finder, cards, the teams switch, the Draft menu, the Group by menu and the Views menu. This test adds:

- **Next month:** the month after the current one.
- **Next year:** the year after the current one. Its first cycles are named by its last two digits and their number, such as "27.1" and "27.2" for the first two in 2027; the examples after "such as" are for a run in 2026.

## Test Cases

Run the test cases in order, in about 30 minutes, straight after [Deciding the Changes](acceptance-deciding-the-changes-manual-test.md). Check each step whose expected result you see, and write anything else under its notes.

### READ-01: The Team Member Signs In for the First Time

**Account:** Team Member, `bram.oakes@fathom.test`, changed from DECIDE-05 in [Deciding the Changes](acceptance-deciding-the-changes-manual-test.md); the first test case. The first step signs out the Engineering Director.

**Preconditions:** [Deciding the Changes](acceptance-deciding-the-changes-manual-test.md) run just before.

- [ ] `2CC6` Sign out from the account menu.
  - **Expected:** The **Sign in** page shows.
  - **Notes:**

- [ ] `5D35` Sign in as the Team Member, `bram.oakes@fathom.test`, with the password beside it in the password list.
  - **Expected:** A page headed **Change password** shows, with no left-hand menu.
  - **Notes:**

- [ ] `FC6F` Run Change a Generated Password, with the new password `fictional bram password`.
  - **Expected:**
    - Fathom opens on the **Overview**.
    - The top bar's right end shows `Bram Oakes`.
  - **Notes:**

- [ ] `A740` Look at the left-hand menu.
  - **Expected:**
    - The **Plan** section shows **Overview**, **Projects**, **Features** and **Releases**.
    - The **People** section shows **People** and **Org chart**, with no **Feature assignments** and no **Capacity**.
  - **Notes:**

### READ-02: The Team Member Finds Someone on the Org Chart

**Account:** Team Member, `bram.oakes@fathom.test`, the same as READ-01.

**Preconditions:** READ-01 done.

- [ ] `48E8` Select the **Org chart** page in the left-hand menu.
  - **Expected:** `Odile Brandt` is at the top of the chart.
  - **Notes:**

- [ ] `D55D` In the finder, type `Cleo`, and select `Cleo Marsh`.
  - **Expected:** The chart moves until the card for `Cleo Marsh` is in the middle of the panel, with a blue ring around it.
  - **Notes:**

- [ ] `AB2A` Select the name on the card for `Cleo Marsh`.
  - **Expected:**
    - The details panel opens on the right, headed `Cleo Marsh`.
    - No row shows a **Site**, and the panel shows no change buttons.
  - **Notes:**

### READ-03: The Team Member Sees What's Planned

**Account:** Team Member, `bram.oakes@fathom.test`, the same as READ-02.

**Preconditions:** READ-02 done.

- [ ] `F6AB` Select the **Features** page in the left-hand menu.
  - **Expected:**
    - The table lists the three features.
    - There is no **New feature** button, and no empty row at the table's end.
  - **Notes:**

- [ ] `E6A7` Select **Cycle** in the Group by menu.
  - **Expected:**
    - Under a heading for next year's first cycle, such as **Fictional Mainline: 27.1**: `Fictional Tide Tables` and `Fictional Gauge Alerts`.
    - Under a heading for its second cycle, such as **Fictional Mainline: 27.2**: `Fictional Lamp Schedule`.
  - **Notes:**

- [ ] `1A49` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - The **Releases** tab lists `Fictional Spring`, with no dot.
    - There is no **New release** button.
  - **Notes:**

- [ ] `62AD` Select **All** on the timeline.
  - **Expected:** `Fictional Spring` is drawn across next year's first two cycles, with a diamond under it at its end.
  - **Notes:**

### READ-04: The Team Member Looks at a Project's Milestones

**Account:** Team Member, `bram.oakes@fathom.test`, the same as READ-03.

**Preconditions:** READ-03 done.

- [ ] `149C` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** tab lists the three projects, with no empty row.
  - **Notes:**

- [ ] `577C` Select **Show milestones** in the ⋯ menu of `Fictional Lamp Room`.
  - **Expected:**
    - The **Milestones** tab opens, showing only `Fictional Lamp Room`'s milestones.
    - They are `Lamp trial`, `Lamps lit` and `Keepers trained`, with no dots.
  - **Notes:**

### READ-05: The Team Member Applies the Shared View of People

**Account:** Team Member, `bram.oakes@fathom.test`, the same as READ-04.

**Preconditions:** READ-04 done.

- [ ] `CE0B` Select the **People** page in the left-hand menu.
  - **Expected:**
    - The table lists the people, from `Ada Quill` to `Odile Brandt`.
    - There is no **Site** column.
  - **Notes:**

- [ ] `0B85` Open the Views menu.
  - **Expected:** **Shared views** lists `Fictional teams`.
  - **Notes:**

- [ ] `9A2B` Select `Fictional teams`.
  - **Expected:**
    - The Views button reads `Fictional teams`.
    - The headings read "Odile Brandt, Keepers", "Ada Quill, Lamp crew" and **No manager**.
  - **Notes:**

### READ-06: The Executive Signs In for the First Time

**Account:** Executive, `vera.marlow@fathom.test`, changed from READ-05. The first step signs out the Team Member.

**Preconditions:** READ-05 done.

- [ ] `C7A0` Sign out from the account menu.
  - **Expected:** The **Sign in** page shows.
  - **Notes:**

- [ ] `6A71` Sign in as the Executive, `vera.marlow@fathom.test`, with the password beside it in the password list.
  - **Expected:** A page headed **Change password** shows, with no left-hand menu.
  - **Notes:**

- [ ] `AD61` Run Change a Generated Password, with the new password `fictional vera password`.
  - **Expected:**
    - Fathom opens on the **Overview**.
    - The top bar's right end shows `Vera Marlow`.
  - **Notes:**

### READ-07: The Executive Reads the Plan

**Account:** Executive, `vera.marlow@fathom.test`, the same as READ-06.

**Preconditions:** READ-06 done.

- [ ] `FCF5` Select the **Features** page in the left-hand menu.
  - **Expected:** The table lists the three features, with no **New feature** button.
  - **Notes:**

- [ ] `42FB` Select **Release** in the Group by menu.
  - **Expected:** The three features are under the heading "Fictional Mainline: Fictional Spring, ships" and June 30 of next year.
  - **Notes:**

- [ ] `72C7` Choose **Live only** in the Draft menu.
  - **Expected:**
    - The Draft button reads **Live only**.
    - The same three features are under the same heading, with no dots.
  - **Notes:**

### READ-08: The Executive Sees the Feature Teams Next Month

**Account:** Executive, `vera.marlow@fathom.test`, the same as READ-07.

**Preconditions:** READ-07 done.

- [ ] `B1FA` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens.
  - **Notes:**

- [ ] `2F64` Choose **Feature teams** in the teams switch.
  - **Expected:**
    - `Tide team` is led by `Ada Quill`, with `Bram Oakes` and `Cleo Marsh` under her.
    - `Harbour team` is led by `Dara Finch`, with `Bram Oakes` and `Emil Stone` under her.
  - **Notes:**

- [ ] `FEB7` Select the right arrow, **Next month**, once.
  - **Expected:**
    - Text below the date row reads "Showing" with the first day of next month, then "Nothing can be changed on this date."
    - `Freya Holt` is under `Tide team` too.
  - **Notes:**

- [ ] `E5B0` Select **Today**.
  - **Expected:** The text below the date row is gone, and `Freya Holt` is not under `Tide team`.
  - **Notes:**

### READ-09: The Executive Follows the Whole Run and Sees the Accounts

**Account:** Executive, `vera.marlow@fathom.test`, the same as READ-08.

**Preconditions:** READ-08 done.

- [ ] `A067` Select the **Access history** page in the left-hand menu.
  - **Expected:** The **Access history** page opens.
  - **Notes:**

- [ ] `F62B` Type `own password` in the search box at the top of the page.
  - **Expected:** Nine entries are shown, each reading "changed their own password": one for each of the eight accounts [The Team's Accounts](acceptance-team-accounts-manual-test.md) made, newest first from `Vera Marlow`, and the oldest for "Fathom Administrator".
  - **Notes:**

- [ ] `35A1` Select the **Accounts** page in the left-hand menu.
  - **Expected:**
    - The table lists nine accounts, each "Active".
    - There is no **New account** button.
  - **Notes:**

**Afterwards:** Run [Start Again](../manual-test-basics.md#start-again) to end the run.
