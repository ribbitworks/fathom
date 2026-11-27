---
title: "Manual Test: Planning Settings"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/data/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/design/pages/administration.md"]
last_updated: "2026-11-27"
---

# Manual Test: Planning Settings

## Scope

Verifies the Planning settings page:

- How it reads for someone who may only see it.
- Drafting a change, undoing it and publishing it.
- Choosing the working days from the keyboard, none refused, and the day a week starts on.
- The change in the change history.
- Approving a draft and seeing the Effort column on Features follow it once approved.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Executive:** `executive@fathom.test`.
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**.
- **Engineering Director:** `engineering.director@fathom.test`.

## Common Procedures

[Start Fathom](manual-test-basics.md#start-fathom), [Reset the Database](manual-test-basics.md#reset-the-database) and [Publish](manual-test-basics.md#publish), from Manual Test Basics.

## Terms

As [Manual Test Basics](manual-test-basics.md#terms) sets out, and:

- **Change button:** as [Manual Test Basics](manual-test-basics.md#terms) sets out, here at the right of a setting's row.
- **Draft button:** the button above **Working time**, which opens a menu choosing how drafts show.
- **Row menu:** the ⋯ button at the right of a setting's row that a draft changes, which opens a menu of the whole draft of the settings and what can be done with it.
- **Day boxes:** the seven boxes, one for each day of the week, that open in place of the value of **Working days**.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### PSET-01: The Settings Read Only

**Account:** Executive, `executive@fathom.test`; the first test case.

**Preconditions:** Signed in with this account.

- [ ] `662D` Select the **Planning settings** page in the left-hand menu.
  - **Expected:**
    - The top bar reads "Administration / Planning settings".
    - The page is headed **Planning settings**, with no tabs.
    - Under **Working time**, the rows read, from the top:
      - **Hours a day**: "8"
      - **Working days**: "Mon to Fri"
      - **Week starts on**: "Monday"
      - **Working days a month**: "20"
    - Under **Forecasts**, the rows read:
      - **Default focus**: "80%"
      - **Default buffer**: "0%"
    - No row has a change button.
    - Above **Working time** is a **Draft** button.
  - **Notes:**

### PSET-02: A Change Drafted, Undone and Published

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from PSET-01.

**Preconditions:** Signed in with this account.

- [ ] `F224` Select the **Planning settings** page in the left-hand menu.
  - **Expected:** Every row has a change button at its right.
  - **Notes:**

- [ ] `93FD` Press Tab until the change button of **Hours a day** has focus.
  - **Expected:** A focus ring shows around the change button of **Hours a day**.
  - **Notes:**

- [ ] `E7A7` Press Enter.
  - **Expected:**
    - A field in place of "8" holds "8".
    - The focus is in the field.
  - **Notes:**

- [ ] `08BD` Replace the value with `4`, and press Enter.
  - **Expected:**
    - **Hours a day** reads "4" after a hollow yellow dot.
    - Under it, "8" follows a green dot.
    - The change button of **Hours a day** has focus.
    - No notification shows.
    - The Publish button reads **Publish 1 change**.
  - **Notes:**

- [ ] `B912` Press Cmd+Z on a Mac, or Ctrl+Z elsewhere.
  - **Expected:**
    - **Hours a day** reads "8", with no mark and nothing under it.
    - The change button of **Hours a day** has focus.
  - **Notes:**

- [ ] `91E5` Press Enter.
  - **Expected:**
    - A field in place of "8" holds "8".
    - The focus is in the field.
  - **Notes:**

- [ ] `318F` Replace the value with `4`, and press Enter.
  - **Expected:** **Hours a day** reads "4" after a hollow yellow dot.
  - **Notes:**

- [ ] `E18C` Run Publish.
  - **Expected:** The mark before "4" beside **Hours a day** is filled yellow.
  - **Notes:**

### PSET-03: A Value Refused

Proved by automated tests in `apps/web/src/planning-settings-page.test.tsx`.

### PSET-04: The Working Days Changed From the Keyboard

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as PSET-02.

**Preconditions:** **Planning settings** page open.

- [ ] `C840` Press Tab until the change button of **Working days** has focus.
  - **Expected:** A focus ring shows around the change button of **Working days**.
  - **Notes:**

- [ ] `9A41` Press Enter.
  - **Expected:**
    - In place of "Mon to Fri", the day boxes read, from the left: **Mon**, **Tue**, **Wed**, **Thu**, **Fri**, **Sat**, **Sun**.
    - **Mon** to **Fri** are tinted blue, with a blue outline.
    - **Sat** and **Sun** are white, with a grey outline.
    - The boxes are on one line.
    - **Mon** has focus.
  - **Notes:**

- [ ] `4B0D` Press the Right arrow key five times.
  - **Expected:** **Sat** has focus.
  - **Notes:**

- [ ] `B803` Press Space.
  - **Expected:** **Sat** is tinted blue, with a blue outline.
  - **Notes:**

- [ ] `0D22` Press Enter.
  - **Expected:**
    - **Working days** reads "Mon to Sat" after a hollow yellow dot.
    - Under it, "Mon to Fri" follows a green dot.
    - The change button of **Working days** has focus.
  - **Notes:**

### PSET-05: No Working Day Refused

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as PSET-04.

**Preconditions:** **Planning settings** page open, with **Working days** reading "Mon to Sat", as PSET-04 ends.

- [ ] `B1D4` Select "Mon to Sat" beside **Working days**.
  - **Expected:** The day boxes show, **Mon** to **Sat** tinted blue.
  - **Notes:**

- [ ] `4EA5` Select each of **Mon**, **Tue**, **Wed**, **Thu**, **Fri** and **Sat**.
  - **Expected:**
    - No box is tinted.
    - The boxes are outlined together in red.
    - Under them, in red, reads "Working day needed".
  - **Notes:**

- [ ] `C809` Press Esc.
  - **Expected:**
    - **Working days** reads "Mon to Sat" after a hollow yellow dot.
    - The red message is gone.
    - The change button of **Working days** has focus.
  - **Notes:**

### PSET-06: The Week Started on Sunday

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as PSET-05.

**Preconditions:** **Planning settings** page open, with **Working days** reading "Mon to Sat", as PSET-05 ends.

- [ ] `53C3` Select "Monday" beside **Week starts on**, and choose **Sunday**.
  - **Expected:**
    - **Week starts on** reads "Sunday" after a hollow yellow dot.
    - Under it, "Monday" follows a green dot.
    - **Working days** still reads "Mon to Sat".
  - **Notes:**

- [ ] `642A` Select "Mon to Sat" beside **Working days**.
  - **Expected:**
    - The day boxes read, from the left: **Sun**, **Mon**, **Tue**, **Wed**, **Thu**, **Fri**, **Sat**.
    - **Sun** is white; the rest are tinted blue.
  - **Notes:**

- [ ] `2110` Press Esc.
  - **Expected:** **Working days** reads "Mon to Sat".
  - **Notes:**

- [ ] `5F7A` Narrow the browser window to 760 pixels wide or a little less.
  - **Expected:** The left-hand menu is hidden, and a menu button shows at the left of the top bar.
  - **Notes:**

- [ ] `E25C` Zoom the browser in to 300%, with Cmd and + on a Mac or Ctrl and + elsewhere.
  - **Expected:** Each label, such as **Working days**, sits above its value.
  - **Notes:**

- [ ] `C6A1` Select "Mon to Sat" under **Working days**.
  - **Expected:**
    - The day boxes stay on one line.
    - The last boxes are cut off at the right, or out of view.
    - Scrolling the boxes sideways brings **Sat** into view.
  - **Notes:**

- [ ] `7768` Press Esc.
  - **Expected:** **Working days** reads "Mon to Sat".
  - **Notes:**

- [ ] `D3B2` Zoom the browser back to 100%, with Cmd and 0 on a Mac or Ctrl and 0 elsewhere.
  - **Expected:** Each label sits beside its value again.
  - **Notes:**

- [ ] `4C2F` Widen the browser window to its full size.
  - **Expected:** The left-hand menu shows again, at the left of the page.
  - **Notes:**

### PSET-08: The Change in the Change History

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as PSET-06.

**Preconditions:** **Planning settings** page open.

- [ ] `5160` Select the change button of **Default buffer**.
  - **Expected:**
    - A field in place of "0%" holds "0".
    - The focus is in the field.
  - **Notes:**

- [ ] `7E66` Replace the value with `10`, and press Enter.
  - **Expected:** **Default buffer** reads "10%" after a hollow yellow dot.
  - **Notes:**

- [ ] `D295` Select the **Change history** page in the left-hand menu.
  - **Expected:**
    - The newest entry reads "Engineering Operations Manager drafted changes to the planning settings".
    - Its details read "Default buffer from 0% to 10%".
  - **Notes:**

**Afterwards:** Run Reset the Database, to leave the planning settings as Fathom starts them.

### PSET-09: A Draft Approved, Then Followed on Features

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from PSET-08. Step `2C26` signs in as another account.

**Preconditions:** Signed in with this account. Reset the Database has been run, as PSET-08 ends. **Features** page open.

- [ ] `02DD` Open the column menu of **Effort**, and select **Person-days (8 hours)** under **Show in**.
  - **Expected:** 'Audit Export' reads "39.5 PD".
  - **Notes:**

- [ ] `887A` Select the **Planning settings** page in the left-hand menu.
  - **Expected:** **Hours a day** reads "8".
  - **Notes:**

- [ ] `5DF7` Select "8" beside **Hours a day**.
  - **Expected:** A field in place of "8" holds "8".
  - **Notes:**

- [ ] `DA6A` Replace the value with `4`, and press Enter.
  - **Expected:** **Hours a day** reads "4" after a hollow yellow dot.
  - **Notes:**

- [ ] `6AB7` Run Publish.
  - **Expected:** The mark before "4" beside **Hours a day** is filled yellow.
  - **Notes:**

- [ ] `6D1E` Select the **Features** page in the left-hand menu, then open the column menu of **Effort**.
  - **Expected:**
    - Under **Show in**, **Person-days (8 hours)** is ticked.
    - **Person-weeks (8h / PD, 5 days / PW)** is under it.
    - 'Audit Export' still reads "39.5 PD".
  - **Notes:**

- [ ] `2C26` Sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The right end of the top bar reads "Engineering Director".
  - **Notes:**

- [ ] `B2C3` Select the **Planning settings** page in the left-hand menu.
  - **Expected:**
    - **Hours a day** reads "4" after a yellow dot.
    - Under it, "8" follows a green dot.
  - **Notes:**

- [ ] `7CF7` Select the row menu of **Hours a day**.
  - **Expected:**
    - A menu headed **Planning settings** opens.
    - Under the heading, a yellow dot and "Draft: changed".
    - Under that, "Hours a day from 8 to 4, by Engineering Operations Manager".
    - Then **Approve…** and **Reject…**, with no **Discard draft**.
    - No other row has a row menu.
  - **Notes:**

- [ ] `8FB0` Select **Approve…**.
  - **Expected:**
    - A dialog headed "Approve 1 draft?" opens.
    - It has an **Approve** button.
  - **Notes:**

- [ ] `77B6` Select **Approve**.
  - **Expected:**
    - The dialog closes.
    - A notification says "Approved 1 draft."
    - **Hours a day** reads "4", with no mark and nothing under it.
  - **Notes:**

- [ ] `3F90` Select the **Features** page in the left-hand menu, then open the column menu of **Effort**.
  - **Expected:**
    - Under **Show in**, **Person-days (4 hours)** is ticked.
    - 'Audit Export' reads "79 PD".
  - **Notes:**

**Afterwards:** Run Reset the Database, to leave the planning settings as Fathom starts them.
