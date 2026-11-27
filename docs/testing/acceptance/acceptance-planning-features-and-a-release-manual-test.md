---
title: "Manual Test: Acceptance, Planning Features and a Release"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/testing/acceptance/acceptance-planning-projects-manual-test.md", "docs/help/working-as-a-product-manager.md", "docs/help/features.md", "docs/help/releases.md", "docs/product/roles.md"]
last_updated: "2026-11-25"
---

# Manual Test: Acceptance, Planning Features and a Release

## Scope

Verifies that a Product Manager finishes a first plan, as [Working as a Product Manager](../../help/working-as-a-product-manager.md) describes, on the projects [Planning Projects](acceptance-planning-projects-manual-test.md) drafted:

- Features pasted in from a file, each planned for a cycle and a month.
- The features tied to the projects and the proposal that need them.
- A release made with a note.

The whole plan is then published in one go, for the Project Manager to decide in [Reviewing the Plan](acceptance-reviewing-the-plan-manual-test.md).

## Test Environment

What [Planning Projects](acceptance-planning-projects-manual-test.md) left, run straight after it:

- Fathom running on its installation, at `https://localhost:10443`, in a browser window at least 1,440 pixels wide, signed in as the Product Manager, with the changes of Planning Projects not yet published.
- This test's file, `docs/testing/acceptance/data/features.tsv` in the clone, open in a plain text editor. It starts with a line naming its columns, which is never copied, and separates its columns with tabs.

## Test Accounts

[The Team's Accounts](acceptance-team-accounts-manual-test.md) made this account:

- **Product Manager:** `priya.lund@fathom.test`, shown in Fathom as `Priya Lund`, with the password `fictional priya password`

## Common Procedures

This test uses [Publish](../manual-test-basics.md#publish). [Start Again](../manual-test-basics.md#start-again) removes the installation, for a fresh run from [Installing Fathom](acceptance-installing-fathom-manual-test.md).

## Terms

[Manual Test Basics](../manual-test-basics.md#terms) defines the terms every test uses, such as marks, a row's slot, the side panel, the details button and the ⋯ menu. This test adds:

- **Copy the rows of a file:** open the file named in the text editor, select every line but the first, and copy them.
- **Typed months:** this test's steps type a month as digits with no separators, such as `202703`.
- **Next year:** the year after the current one. Its first cycles are named by its last two digits and their number, such as "27.1" and "27.2" for the first two in 2027; the examples after "such as" are for a run in 2026.
- **Empty row:** the row at the end of a table, with blank cells, where a new record is typed or pasted.

## Test Cases

Run the test cases in order, in about 30 minutes, straight after [Planning Projects](acceptance-planning-projects-manual-test.md). Check each step whose expected result you see, and write anything else under its notes. [Reviewing the Plan](acceptance-reviewing-the-plan-manual-test.md) follows on from the last test case.

### FEAT-01: The Features Are Pasted In

**Account:** Product Manager, `priya.lund@fathom.test`, the same as PROJ-05 in [Planning Projects](acceptance-planning-projects-manual-test.md); the first test case.

**Preconditions:** [Planning Projects](acceptance-planning-projects-manual-test.md) run just before.

- [ ] `A318` Select the **Features** page in the left-hand menu.
  - **Expected:**
    - The table has only its empty row.
    - The count above it reads "0 features".
  - **Notes:**

- [ ] `315E` Copy the rows of `features.tsv`.
  - **Expected:** Three lines are selected in the text editor, from `Fictional Tide Tables` to `Fictional Gauge Alerts`.
  - **Notes:**

- [ ] `F01F` In Fathom, select the **Name** cell of the empty row.
  - **Expected:** The cell has a blue outline.
  - **Notes:**

- [ ] `C373` Paste.
  - **Expected:**
    - Three rows are added, each with its description and a hollow yellow dot in its slot.
    - **Status** reads "Planned" for `Fictional Tide Tables` and `Fictional Gauge Alerts`, and "Possible" for `Fictional Lamp Schedule`.
    - The **Feature team** cell of each "Planned" feature shows **No feature team** in red.
    - The count reads "3 features".
  - **Notes:**

### FEAT-02: Each Feature Is Planned for a Cycle and a Month

**Account:** Product Manager, `priya.lund@fathom.test`, the same as FEAT-01.

**Preconditions:** FEAT-01 done. **Features** page open.

- [ ] `A748` Select the **Target cycle** cell of `Fictional Tide Tables`, press Enter, choose next year's first cycle, such as **Fictional Mainline: 27.1**, and press Enter.
  - **Expected:**
    - The cell reads the cycle chosen, with a hollow yellow dot before it.
    - **Release** reads "Fictional Mainline: Not released yet".
  - **Notes:**

- [ ] `B7D5` Select the **Needed by** cell of `Fictional Tide Tables`, type March of next year, such as `202703`, and press Enter.
  - **Expected:** The cell reads that month, such as "Mar 2027", with a hollow yellow dot before it.
  - **Notes:**

- [ ] `74BE` Select the **Target cycle** cell of `Fictional Lamp Schedule`, press Enter, choose next year's second cycle, such as **Fictional Mainline: 27.2**, and press Enter.
  - **Expected:** The cell reads the cycle chosen, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `73F0` Select the **Target cycle** cell of `Fictional Gauge Alerts`, press Enter, choose next year's first cycle, such as **Fictional Mainline: 27.1**, and press Enter.
  - **Expected:** The cell reads the cycle chosen, with a hollow yellow dot before it.
  - **Notes:**

### FEAT-03: The Features Are Tied to the Projects and the Proposal

**Account:** Product Manager, `priya.lund@fathom.test`, the same as FEAT-02.

**Preconditions:** FEAT-02 done.

- [ ] `3C39` Select the **Projects** page in the left-hand menu.
  - **Expected:** The **Projects** tab lists `Fictional Lamp Room`, `Fictional Tide Gauge` and `Fictional Pier Lights`.
  - **Notes:**

- [ ] `6D9D` Select the **Features** cell of `Fictional Lamp Room`, and press Enter.
  - **Expected:** A list of features opens, with a search box.
  - **Notes:**

- [ ] `83AD` Type `Tide`, and press Enter.
  - **Expected:** `Fictional Tide Tables` has a tick.
  - **Notes:**

- [ ] `66E7` Type `Lamp`, and press Enter.
  - **Expected:** `Fictional Lamp Schedule` has a tick.
  - **Notes:**

- [ ] `959D` Press Enter again.
  - **Expected:** The **Features** cell names `Fictional Tide Tables` and `Fictional Lamp Schedule`.
  - **Notes:**

- [ ] `0B3A` Select the **Features** cell of `Fictional Tide Gauge`, and press Enter.
  - **Expected:** A list of features opens, with a search box.
  - **Notes:**

- [ ] `9CD2` Type `Gauge`, and press Enter.
  - **Expected:** `Fictional Gauge Alerts` has a tick.
  - **Notes:**

- [ ] `C18D` Press Enter again.
  - **Expected:** The **Features** cell names `Fictional Gauge Alerts`.
  - **Notes:**

- [ ] `D383` Select the details button at the right of the **Name** cell of `Fictional Lamp Room`.
  - **Expected:** Under **Scope history**, `Fictional Tide Tables` and `Fictional Lamp Schedule` are listed, each with a hollow yellow dot before it, and "Added" and today's date in grey.
  - **Notes:**

- [ ] `CECB` Select the **Proposals** tab.
  - **Expected:** `Fictional Harbour Bid` is listed.
  - **Notes:**

- [ ] `CA12` Select the **Features** cell of `Fictional Harbour Bid`, and press Enter.
  - **Expected:** A list of features opens, with a search box.
  - **Notes:**

- [ ] `5C03` Type `Tide`, and press Enter.
  - **Expected:** `Fictional Tide Tables` has a tick.
  - **Notes:**

- [ ] `ADA9` Type `Gauge`, and press Enter.
  - **Expected:** `Fictional Gauge Alerts` has a tick.
  - **Notes:**

- [ ] `86BC` Press Enter again.
  - **Expected:** The **Features** cell names `Fictional Tide Tables` and `Fictional Gauge Alerts`.
  - **Notes:**

### FEAT-04: A Release Is Made, With a Note

**Account:** Product Manager, `priya.lund@fathom.test`, the same as FEAT-03.

**Preconditions:** FEAT-03 done.

- [ ] `AC26` Select the **Releases** page in the left-hand menu.
  - **Expected:**
    - In the **Releases** tab's table, dimmed, it reads "No releases yet".
    - A **New release** button is at the top right.
  - **Notes:**

- [ ] `DD51` Select **New release**.
  - **Expected:** A dialog titled "New release" opens, whose first field is **Schedule**.
  - **Notes:**

- [ ] `EF8F` Choose `Fictional Mainline` in **Schedule**.
  - **Expected:** **Name**, **First cycle**, **Last cycle**, an empty **Ships on** and **Colour** follow it.
  - **Notes:**

- [ ] `75DD` Type `Fictional Spring` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `AF81` Choose next year's first cycle in **First cycle**, such as "27.1 (Jan 1 to Mar 31, 2027)".
  - **Expected:**
    - **First cycle** and **Last cycle** both show the cycle chosen.
    - The empty **Ships on** field shows, in grey, the cycle's last day and its name, such as "Mar 31, 2027 (end of 27.1)".
  - **Notes:**

- [ ] `E09E` Select **Make release**.
  - **Expected:**
    - A notification says "Drafted the new release."
    - The side panel is headed with a hollow yellow dot before `Fictional Spring`.
  - **Notes:**

- [ ] `F21E` Select the **⋯** button at the right of the first cell of the row for `Fictional Spring`, then **Add note…**.
  - **Expected:**
    - A panel titled "Note for Fictional Spring" opens under the release's details.
    - **Editor** is chosen.
  - **Notes:**

- [ ] `42C3` Type `Fictional tide tables for every harbour`.
  - **Expected:** The note shows what was typed.
  - **Notes:**

- [ ] `0AC0` Select **Save**.
  - **Expected:**
    - A notification says "Drafted the note on Fictional Spring."
    - The **Note** row in the release's details reads `Fictional tide tables for every harbour`.
  - **Notes:**

### FEAT-05: The Plan Is Published

**Account:** Product Manager, `priya.lund@fathom.test`, the same as FEAT-04.

**Preconditions:** FEAT-04 done.

- [ ] `A3CC` Select the **Features** page in the left-hand menu.
  - **Expected:** The three features are listed, with no group headings.
  - **Notes:**

- [ ] `FC33` Select **Release** in the Group by menu.
  - **Expected:**
    - `Fictional Tide Tables` and `Fictional Gauge Alerts` are under the heading "Fictional Mainline: Fictional Spring, ships" and March 31 of next year.
    - `Fictional Lamp Schedule` is under the heading "Fictional Mainline: Not released yet".
  - **Notes:**

- [ ] `CBCB` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

**Afterwards:** Run [Reviewing the Plan](acceptance-reviewing-the-plan-manual-test.md) next, on this installation. To stop here instead, run [Start Again](../manual-test-basics.md#start-again).
