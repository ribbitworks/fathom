---
title: "Manual Test: Acceptance, Hiring and Who Sees What"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/testing/acceptance/acceptance-feature-teams-manual-test.md", "docs/help/working-as-an-engineering-director.md", "docs/product/roles.md"]
last_updated: "2026-11-20"
---

# Manual Test: Acceptance, Hiring and Who Sees What

## Scope

Verifies the Engineering Director's own work, as [Working as an Engineering Director](../../help/working-as-an-engineering-director.md) describes, on the organization the earlier acceptance tests set up: agreeing the planned hire and filling it with a new person, approving the director's own drafts each round; moving someone to another manager; moving the Sites list to **Personal**; and sharing a view of People with everyone who opens the page.

## Test Environment

What [Feature Teams](acceptance-feature-teams-manual-test.md) left, run straight after it: Fathom running on its installation, at `https://localhost:10443`, in a browser window at least 1,440 pixels wide, signed in as the Engineering Director.

## Test Accounts

[The Team's Accounts](acceptance-team-accounts-manual-test.md) made this account:

- **Engineering Director:** `odile.brandt@fathom.test`, shown in Fathom as `Odile Brandt`, with the password `fictional odile password`

## Common Procedures

This test uses [Publish](../manual-test-basics.md#publish). [Start Again](../manual-test-basics.md#start-again) removes the installation, for a fresh run from [Installing Fathom](acceptance-installing-fathom-manual-test.md).

## Terms

[Manual Test Basics](../manual-test-basics.md#terms) defines the terms every test uses, such as marks, a row's slot, the Publish button, the tick box, the Group by menu and the Views menu.

## Test Cases

Run the test cases in order, in about 30 minutes, straight after [Feature Teams](acceptance-feature-teams-manual-test.md). Check each step whose expected result you see, and write anything else under its notes. [Planning Projects](acceptance-planning-projects-manual-test.md) follows on from the last test case.

### HIRING-01: The Planned Hire Is Agreed, and the Director Approves It

**Account:** Engineering Director, `odile.brandt@fathom.test`, the same as FTEAM-06 in [Feature Teams](acceptance-feature-teams-manual-test.md); the first test case.

**Preconditions:** [Feature Teams](acceptance-feature-teams-manual-test.md) run just before.

- [ ] `060E` Select the **People** page in the left-hand menu.
  - **Expected:** The row of `Fictional tide engineer` reads "Request to hire" in **State**.
  - **Notes:**

- [ ] `42AD` Select the **State** cell of `Fictional tide engineer`, press Enter, choose **Approved to hire**, and press Enter.
  - **Expected:** The cell reads "Approved to hire", with a hollow yellow dot before it.
  - **Notes:**

- [ ] `4DE1` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `5BAF` Select the **Drafts** page in the left-hand menu.
  - **Expected:**
    - **To decide** is chosen beside the page's title.
    - One row is shown, whose **Record** reads `Fictional tide engineer`, with a tick box.
    - Its **Made by** reads "Odile Brandt as Engineering Director".
  - **Notes:**

- [ ] `779C` Tick the tick box before **Record** in the table's header.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `5A8F` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `84AF` Select **Approve** in the dialog.
  - **Expected:**
    - A notification says "Approved 1 draft."
    - The table reads "No drafts".
  - **Notes:**

### HIRING-02: The Planned Hire Is Filled With a New Person

**Account:** Engineering Director, `odile.brandt@fathom.test`, the same as HIRING-01.

**Preconditions:** HIRING-01 done.

- [ ] `F108` Select the **People** page in the left-hand menu.
  - **Expected:** A **Fill** button is at the right of the **Name** cell of `Fictional tide engineer`.
  - **Notes:**

- [ ] `5B37` Select **Fill**.
  - **Expected:**
    - The details panel is headed `Fictional tide engineer`.
    - Under **Fill this planned hire**, **New person** is selected.
    - The fields are **Name**, **ID**, **Position**, **Start** and **Manager**.
    - **Position** reads "Software Engineer", and **Manager** `Ada Quill`.
  - **Notes:**

- [ ] `2B01` Type `Gil Ashby` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `BE07` Type `EMP-107` in **ID**.
  - **Expected:** **ID** shows what was typed.
  - **Notes:**

- [ ] `0B9F` Select **Fill** at the foot of the panel.
  - **Expected:**
    - The panel is headed with a hollow yellow dot before `Gil Ashby`.
    - The row of `Fictional tide engineer` has no **Fill** button, and has a hollow yellow dot in its slot.
  - **Notes:**

- [ ] `C8A9` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `26A1` Select the **Drafts** page in the left-hand menu.
  - **Expected:** Two rows are shown, whose **Record** reads `Fictional tide engineer` and `Gil Ashby`.
  - **Notes:**

- [ ] `6FB6` Tick the tick box of the row whose **Record** reads `Fictional tide engineer`.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `0AD6` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** The dialog reads "Also approves the drafts these depend on:" and names `Gil Ashby`.
  - **Notes:**

- [ ] `EDB2` Select **Approve** in the dialog.
  - **Expected:** The table reads "No drafts".
  - **Notes:**

- [ ] `49EB` Select the **People** page in the left-hand menu.
  - **Expected:**
    - A row for `Gil Ashby` reads `EMP-107` in **ID**, "Software Engineer" in **Position**, `Ada Quill` in **Manager** and `Lamp crew` in **Team**, with no dot.
    - No row is named `Fictional tide engineer`.
  - **Notes:**

### HIRING-03: Someone Moves to Another Manager

**Account:** Engineering Director, `odile.brandt@fathom.test`, the same as HIRING-02.

**Preconditions:** HIRING-02 done. **People** page open.

- [ ] `8F34` Select the **Manager** cell of `Emil Stone`, press Enter, type `Ada`, and choose `Ada Quill`.
  - **Expected:**
    - The cell reads `Ada Quill`, with a hollow yellow dot before it.
    - **Team** reads `Lamp crew`.
  - **Notes:**

- [ ] `594C` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The chart opens, with **Reporting teams** chosen in the teams switch.
  - **Notes:**

- [ ] `3A86` Select **Show levels**, then **All levels**.
  - **Expected:**
    - Under `Ada Quill`, a card for `Emil Stone` has a hollow yellow dot before his name.
    - Under `Odile Brandt`, a faded light green card with a dashed edge shows where `Emil Stone` is now.
  - **Notes:**

- [ ] `92BF` Run Publish.
  - **Expected:** The Publish button is gone.
  - **Notes:**

- [ ] `4DFF` Select the **Drafts** page in the left-hand menu.
  - **Expected:** One row is shown, whose **Record** reads `Emil Stone`, and whose **What changes** changes **Manager** from "Odile Brandt" to "Ada Quill".
  - **Notes:**

- [ ] `1DA4` Tick that row's tick box.
  - **Expected:** At the right of the page's heading: **Reject…** and **Approve 1 draft…**.
  - **Notes:**

- [ ] `73CF` Select **Approve 1 draft…** at the right of the page's heading.
  - **Expected:** A dialog titled "Approve 1 draft?" opens.
  - **Notes:**

- [ ] `59DA` Select **Approve** in the dialog.
  - **Expected:** A notification says "Approved 1 draft."
  - **Notes:**

### HIRING-04: The Sites List Is Moved to Personal

**Account:** Engineering Director, `odile.brandt@fathom.test`, the same as HIRING-03.

**Preconditions:** HIRING-03 done.

- [ ] `7D86` Select the **Data classes** page under **Administration** in the left-hand menu.
  - **Expected:**
    - Three sections follow the heading: **Built-in details**, **Columns** and **Lists**.
    - Under **Lists**, `Sites` reads **General**.
  - **Notes:**

- [ ] `28BF` Select **Change class…** in the row of `Sites`.
  - **Expected:**
    - A dialog titled "Change the class of Sites" opens.
    - **General** is chosen.
  - **Notes:**

- [ ] `F1EB` Select **Personal**.
  - **Expected:** **Personal** is chosen.
  - **Notes:**

- [ ] `6C2D` Select **Change**.
  - **Expected:**
    - The dialog closes.
    - `Sites` reads an eye with a line through it, then **Personal**.
    - The Publish button doesn't appear.
  - **Notes:**

- [ ] `EE9D` Select the **Access history** page in the left-hand menu.
  - **Expected:** The newest entry names `Odile Brandt` and the class of `Sites`, and ends in a grey **Worth checking** box.
  - **Notes:**

### HIRING-05: A View of People Is Shared

**Account:** Engineering Director, `odile.brandt@fathom.test`, the same as HIRING-04.

**Preconditions:** HIRING-04 done.

- [ ] `E872` Select the **People** page in the left-hand menu.
  - **Expected:** The **Site** column's name has an eye with a line through it before it.
  - **Notes:**

- [ ] `9FE5` Select **Manager** in the Group by menu.
  - **Expected:**
    - The headings read "Ada Quill, Lamp crew", "Odile Brandt, Keepers" and "No manager", in that order.
    - Each heading says how many people it holds.
  - **Notes:**

- [ ] `F9DB` Open the Views menu, and select **Save view…**.
  - **Expected:** The dialog shows a checkbox, **Share with everyone who sees this page**, not ticked, below **Name**.
  - **Notes:**

- [ ] `ADB7` Type `Fictional teams` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `B76F` Tick **Share with everyone who sees this page**.
  - **Expected:** The checkbox is ticked.
  - **Notes:**

- [ ] `37FA` Select **Save view**.
  - **Expected:**
    - The dialog closes.
    - The Views button reads `Fictional teams`.
  - **Notes:**

- [ ] `BF8B` Open the Views menu.
  - **Expected:** The heading **Shared views** is above `Fictional teams`.
  - **Notes:**

**Afterwards:** Run [Planning Projects](acceptance-planning-projects-manual-test.md) next, on this installation. To stop here instead, run [Start Again](../manual-test-basics.md#start-again).
