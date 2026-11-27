---
title: "Manual Test: Help"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "docs/help/**"]
dependencies: ["docs/standards/testing.md", "docs/design/visual-design.md"]
last_updated: "2026-11-27"
---

# Manual Test: Help

## Scope

Verifies what only a person can judge of Help in Fathom:

- How a Help page and its diagram read, in a wide and a narrow window.
- Following links between Help pages, to a page and to a heading on it, from the mouse and the keyboard, and going back.
- The role's jobs on the Overview, and their links to the pages and to Help.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Team Member:** `team.member@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses.

## Test Cases

Start with Start Fathom. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### HELP-01: Reading Help and Following Its Links

**Account:** Team Member, `team.member@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Overview** page open.

- [ ] `34DB` Select **Help pages** under **Help** in the left-hand menu.
  - **Expected:**
    - The page is headed **Help**.
    - Under it, headings each sit over a list of links, spaced so each heading and list read as one group.
    - The text sits in one bordered panel as wide as the page.
  - **Notes:**

- [ ] `3076` Select **Working as a Team Member** under **Working in Fathom**.
  - **Expected:**
    - The page is headed **Working as a Team Member**, and the window shows its top.
    - Its numbered steps count from 1 under each heading.
  - **Notes:**

- [ ] `E536` Select the **Features** link in the line "See Features." under **See What Each Cycle or Release Holds**.
  - **Expected:**
    - The **Features** Help page opens in the same tab.
    - The window has scrolled to the heading **Group the Table**, at its top.
  - **Notes:**

- [ ] `A5BD` Select the browser's Back button.
  - **Expected:** **Working as a Team Member** shows again.
  - **Notes:**

- [ ] `5764` Select the heading **See What's Planned**.
  - **Expected:** Nothing opens.
  - **Notes:**

- [ ] `2269` Press Tab.
  - **Expected:** The **Features** link in the line "See Features." under **See What Each Cycle or Release Holds** shows a focus ring.
  - **Notes:**

- [ ] `6B8B` Press Enter.
  - **Expected:** The **Features** Help page opens in the same tab.
  - **Notes:**

- [ ] `1041` Select **Help pages** under **Help** in the left-hand menu.
  - **Expected:** The page headed **Help** shows.
  - **Notes:**

- [ ] `BF3A` Select **Pages** under **Finding Your Way**.
  - **Expected:**
    - The page is headed **Pages**.
    - Each page listed is a link followed by what it's for, with two lines set in under it, easy to tell apart from the next page.
  - **Notes:**

### HELP-02: A Help Page's Diagram

**Account:** Team Member, `team.member@fathom.test`, the account HELP-01 ended with.

**Preconditions:** Signed in with this account, in a browser window at least 1,000 pixels wide. **Help** open, from **Help pages** under **Help** in the left-hand menu.

- [ ] `7E9C` Select **How Fathom fits together**.
  - **Expected:**
    - Under the heading **How They Connect**, a diagram shows boxes grouped under **People**, **Plan** and **Ship**, joined by arrows.
    - Each arrow's words, such as **needed by** and **ships in**, are easy to read and stand clear of the arrow.
  - **Notes:**

- [ ] `1722` Make the browser window narrower than 768 pixels.
  - **Expected:**
    - The diagram keeps its size, with its words as large as before.
    - Its right-hand side is cut off, with a slim scroll bar under it.
  - **Notes:**

- [ ] `C7A9` Press Tab until the diagram shows a focus ring.
  - **Expected:** The diagram shows a focus ring.
  - **Notes:**

- [ ] `FBA4` Press the right arrow key several times.
  - **Expected:** The diagram scrolls until its right-hand side shows, with **Cycle** and **Release** under **Ship**.
  - **Notes:**

### HELP-03: The Overview's Jobs

**Account:** Team Member, `team.member@fathom.test`, the account HELP-02 ended with.

**Preconditions:** Signed in with this account, in a browser window at least 1,000 pixels wide.

- [ ] `23BA` Select **Overview** under **Plan** in the left-hand menu.
  - **Expected:**
    - A greeting such as "Good morning, Team Member", with "Acting as Team Member" under it, dimmed.
    - Under it, a bordered section shows **Plan**, listing **See What's Planned** and **Look at a Project**, then **People**, listing **Find Someone** and **Look at the Teams**, then **History**, listing **Follow What Changed**.
    - Each job's row shows, on one line, a chevron pointing right, its name, the page where it's done, such as **Features**, and **Help** at the right.
    - No finer tasks show.
  - **Notes:**

- [ ] `0A44` Select **See What's Planned**.
  - **Expected:**
    - Its chevron points down.
    - **See What Each Cycle or Release Holds**, **See Features as a Board**, **See When Each Release Ships** and **See Only What's Approved** show under it, in that order, each name lined up under the job's name.
    - Each shows **Features**, but **See When Each Release Ships**, which shows **Releases**.
  - **Notes:**

- [ ] `6F4D` Select **See What's Planned** again.
  - **Expected:** Its tasks are hidden, and its chevron points right.
  - **Notes:**

- [ ] `4F04` Select **Projects** on the **Look at a Project** row.
  - **Expected:** The **Projects** page opens.
  - **Notes:**

- [ ] `14C8` Go back.
  - **Expected:** The **Overview** shows again.
  - **Notes:**

- [ ] `77D8` Select **Help** on the **Find Someone** row.
  - **Expected:** The **Working as a Team Member** Help page opens, with the heading **Find Someone** at the top of the window.
  - **Notes:**

- [ ] `2F29` Go back.
  - **Expected:** The **Overview** shows again.
  - **Notes:**

- [ ] `D49E` Make the browser window narrower than 760 pixels.
  - **Expected:**
    - Each job's page link moves under its name, lined up with it.
    - **Help** stays at the right of each name, and nothing is cut off.
  - **Notes:**
