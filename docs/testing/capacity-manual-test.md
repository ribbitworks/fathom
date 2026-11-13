---
title: "Manual Test: Capacity"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/design/visual-design.md"]
last_updated: "2026-11-11"
---

# Manual Test: Capacity

## Scope

Verifies the Capacity page's Settings tab, which holds the planning settings: how it reads for someone who may only see it, changing a setting and seeing the Effort column on Features follow it, undoing a change, a value refused, adding and removing months of ramp-up, and the change in the change history.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Executive:** `executive@fathom.test`.
- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as **Engineering Operations Manager**.

## Common Procedures

[Start Fathom](manual-test-basics.md#start-fathom) and [Reset the Database](manual-test-basics.md#reset-the-database), from Manual Test Basics. The planning settings are not part of the seed data, so Restore the Seed Data leaves them as they are.

## Terms

As [Manual Test Basics](manual-test-basics.md#terms) sets out, and:

- **Settings tab:** the tab under the **Capacity** heading, which reads **Settings**.
- **Change button:** as [Manual Test Basics](manual-test-basics.md#terms) sets out, here at the right of a setting's row.
- **× button:** the small × after the change button of a month of ramp-up, which removes that month.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Reset the Database. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### CAP-01: The Settings Read Only

**Account:** Executive, `executive@fathom.test`; the first test case.

**Preconditions:** Signed in with this account.

- [ ] `E86E` Select the **Capacity** page in the left-hand menu.
  - **Expected:**
    - The page is headed **Capacity**.
    - The **Settings** tab is selected.
    - Under **Working time**, the rows read, from the top:
      - **Hours a day**: **8**
      - **Working days a week**: **5**
      - **Working days a month**: **20**
    - Under **Forecasts**, the rows read:
      - **Default focus**: **80%**
      - **Default buffer**: **0%**
    - Under **Ramp-up for new starters**, the rows read:
      - **Month 1**: **50%**
      - **Month 2**: **75%**
      - **From month 3**: **100%**
    - No row has a change button.
    - There are no buttons under the rows.
  - **Notes:**

- [ ] `D92C` Select **Dark** in the Appearance menu.
  - **Expected:**
    - The headings and values are easy to read.
    - The labels are dimmed beside their values.
  - **Notes:**

- [ ] `ED4A` Select **Light** in the Appearance menu.
  - **Expected:**
    - The headings and values are easy to read.
    - The labels are dimmed beside their values.
  - **Notes:**

### CAP-02: A Change Undone, Then Followed on Features

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from CAP-01.

**Preconditions:** Signed in with this account. **Features** page open.

- [ ] `A2D4` Open the column menu of **Effort**, and select **Person-days** under **Show in**.
  - **Expected:** **Audit Export** reads **39.5 PD**.
  - **Notes:**

- [ ] `DCBC` Select the **Capacity** page in the left-hand menu.
  - **Expected:**
    - Every row but **From month 3** has a change button at its right.
    - The rows **Month 1** and **Month 2** each have an × button after their change button.
    - Under the ramp-up rows is one outlined button, **Add month**.
  - **Notes:**

- [ ] `93FD` Press Tab until the change button of **Hours a day** has focus.
  - **Expected:** A focus ring shows around the change button of **Hours a day**.
  - **Notes:**

- [ ] `E7A7` Press Enter.
  - **Expected:**
    - A field in place of **8** holds **8**.
    - The focus is in the field.
  - **Notes:**

- [ ] `08BD` Replace **8** with **4**, and press Enter.
  - **Expected:**
    - **Hours a day** reads **4**.
    - The change button of **Hours a day** has focus.
    - No notification shows.
  - **Notes:**

- [ ] `B912` Press Cmd+Z on a Mac, or Ctrl+Z elsewhere.
  - **Expected:**
    - **Hours a day** reads **8**.
    - The change button of **Hours a day** has focus.
  - **Notes:**

- [ ] `91E5` Press Enter.
  - **Expected:**
    - A field in place of **8** holds **8**.
    - The focus is in the field.
  - **Notes:**

- [ ] `318F` Replace **8** with **4**, and press Enter.
  - **Expected:** **Hours a day** reads **4**.
  - **Notes:**

- [ ] `5C4A` Select the **Features** page in the left-hand menu.
  - **Expected:** The **Features** page opens.
  - **Notes:**

- [ ] `8F7A` Open the column menu of **Effort**, and select **Person-days** under **Show in**.
  - **Expected:** **Audit Export** reads **79 PD**.
  - **Notes:**

### CAP-03: A Value Refused

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as CAP-02.

**Preconditions:** **Capacity** page open, on the **Settings** tab.

- [ ] `B6C0` Select **80%** beside **Default focus**.
  - **Expected:**
    - A field in place of **80%** holds **80**.
    - The focus is in the field.
  - **Notes:**

- [ ] `18AC` Replace **80** with **0**, and press Enter.
  - **Expected:**
    - The field stays open.
    - It holds **0**.
    - It is outlined in red.
    - Under it, in red, reads **Default focus: use 1% to 100%**.
  - **Notes:**

- [ ] `A0AE` Press Esc.
  - **Expected:**
    - **Default focus** reads **80%**.
    - The red message is gone.
  - **Notes:**

### CAP-04: Months of Ramp-Up Added and Removed

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as CAP-03.

**Preconditions:** **Capacity** page open, on the **Settings** tab.

- [ ] `5B9D` Select **Add month**.
  - **Expected:**
    - Under **Ramp-up for new starters**, the rows read, from the top:
      - **Month 1**: **50%**
      - **Month 2**: **75%**
      - **Month 3**: **100%**
      - **From month 4**: **100%**
    - The change button of **Month 3** has focus.
    - **Month 3** has an × button after its change button.
  - **Notes:**

- [ ] `80C1` Press Enter.
  - **Expected:**
    - A field in place of **100%** beside **Month 3** holds **100**.
    - The focus is in the field.
  - **Notes:**

- [ ] `3F77` Replace **100** with **90**, and press Enter.
  - **Expected:** **Month 3** reads **90%**.
  - **Notes:**

- [ ] `2E12` Select the × button of **Month 3**.
  - **Expected:**
    - Under **Ramp-up for new starters**, the rows read, from the top:
      - **Month 1**: **50%**
      - **Month 2**: **75%**
      - **From month 3**: **100%**
    - The × button of **Month 2** has focus.
    - A notification at the top right reads **Removed month 3 of ramp-up.**
    - It offers **Undo**.
  - **Notes:**

- [ ] `A79C` Select **Undo** in the notification.
  - **Expected:**
    - Under **Ramp-up for new starters**, the rows read, from the top:
      - **Month 1**: **50%**
      - **Month 2**: **75%**
      - **Month 3**: **90%**
      - **From month 4**: **100%**
  - **Notes:**

### CAP-05: The Change in the Change History

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as CAP-04.

**Preconditions:** None beyond CAP-04.

- [ ] `D295` Select the **Change history** page in the left-hand menu.
  - **Expected:**
    - The newest entry reads **Engineering Operations Manager changed the planning settings**.
    - Its details read **Ramp-up from 50%, 75% to 50%, 75%, 90%**.
  - **Notes:**

**Afterwards:** Run Reset the Database, to leave the planning settings as Fathom starts them.
