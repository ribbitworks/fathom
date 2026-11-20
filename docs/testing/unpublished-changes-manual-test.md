---
title: "Manual Test: Unpublished Changes"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/data/**", "packages/seed/src/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/design/visual-design.md"]
last_updated: "2026-11-20"
---

# Manual Test: Unpublished Changes

## Scope

Verifies that changes are seen only by the person who made them until they're published, that a record someone else is changing is held, that publishing and Discard all… in the top bar work, and that publishing leaves the changes the role in use can't make. [Drafts](drafts-manual-test.md) verifies drafts on the People and Lists pages, and [Drafts Page](drafts-page-manual-test.md) publishing and discarding chosen changes on the Drafts page.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Workforce Administrator:** `engineering.operations.manager@fathom.test`, shown in Fathom as "Engineering Operations Manager"
- **Engineering Director:** `engineering.director@fathom.test`
- **Feature Lead:** `feature.lead@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms this test uses.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### DRAFT-15: Unpublished Changes Are Seen Only by the Person Who Made Them

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`; the first test case. Step `8F00` signs in as another account.

**Preconditions:** Run Restore the Seed Data first. Signed in with this account. **People** page open.

- [ ] `AC61` Look at the top bar, beside the account's name.
  - **Expected:**
    - It shows **Publish 3 changes**.
    - A **⋯** button is beside it.
  - **Notes:**

- [ ] `3DBD` Select the **⋯** button beside **Publish 3 changes**.
  - **Expected:** The menu shows, in order:
    - "Unpublished changes", then a divider.
    - "Nobody else sees these changes until they're published."
    - "Added" the choice 'Laptop' in 'Equipment'.
    - "Added" the list 'Equipment'.
    - "Changed" 'Mariana Metz'.
    - **Discard all…**.
  - **Notes:**

- [ ] `61B5` Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `D8C1` Type `Mariana Metz` in the search box above the table.
  - **Expected:** In her row:
    - Nothing in the slot
    - A hollow yellow dot before the new **Site**
    - The **Site** cell yellow
  - **Notes:**

- [ ] `8F00` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `D858` Select the **People** page in the left-hand menu.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] `40D2` Type `Mariana Metz` in the search box.
  - **Expected:**
    - Her row has the grey lock in its slot.
    - Her **Site** has no dot before it.
    - Her **Site** cell is not yellow.
    - The top bar shows no **Publish** button.
  - **Notes:**

### DRAFT-16: A Record Someone Else Is Changing Is Held

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-15.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] `E97E` Clear the search box above the table, and type `Viktoria Holmberg` in it.
  - **Expected:** In her row:
    - The grey lock in the slot
    - A yellow dot before each value her published draft changes
  - **Notes:**

- [ ] `B5C4` Select the **⋯** button at the end of her row.
  - **Expected:**
    - The menu says "Being changed by Second Engineering Operations Manager. It can be changed once they publish or discard their changes."
    - It has no **Discard draft** or **Remove person**.
  - **Notes:**

### DRAFT-17: Changing a Published Draft Keeps Others Seeing It as Published

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, the same as DRAFT-16. Step `A1FC` signs in as another account.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] `49A5` Clear the search box, and type `E10002` in it.
  - **Expected:** The table shows the row whose **ID** is `E10002`.
  - **Notes:**

- [ ] `84D8` Select that person's **ID** cell, type `E20002`, and press Enter.
  - **Expected:**
    - The cell reads `E20002`.
    - A hollow yellow dot is before it.
    - The cell is yellow.
    - The top bar shows **Publish 4 changes**.
  - **Notes:**

- [ ] `A1FC` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `47E4` Select the **People** page in the left-hand menu.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] `4E79` Clear the search box, and type `E10002` in it.
  - **Expected:**
    - The row still reads `E10002`.
    - No dot before `E10002`.
    - The grey lock is in the row's slot.
  - **Notes:**

### DRAFT-18: Publishing Shows the Changes to Everyone

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-17. Step `A2AB` signs in as another account.

**Preconditions:** DRAFT-17 done. Signed in with this account. **People** page open.

- [ ] `E65D` Select **Publish 4 changes** in the top bar.
  - **Expected:**
    - A notice reads "Published 4 changes."
    - The **Publish** button is gone from the top bar.
  - **Notes:**

- [ ] `FA4F` Clear the search box, and type `Mariana Metz` in it.
  - **Expected:** A solid yellow dot before her new **Site**.
  - **Notes:**

- [ ] `A2AB` Sign out, and sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The top bar's right end reads "Engineering Director".
  - **Notes:**

- [ ] `54CE` Select the **People** page in the left-hand menu.
  - **Expected:** The People table shows.
  - **Notes:**

- [ ] `450E` Clear the search box, and type `Mariana Metz` in it.
  - **Expected:**
    - A yellow dot before her new **Site**
    - The **Site** cell yellow
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.

### DRAFT-19: Discard All Removes Every Unpublished Change

**Account:** Workforce Administrator, `engineering.operations.manager@fathom.test`, changed from DRAFT-18.

**Preconditions:** Signed in with this account. **People** page open.

- [ ] `711C` Select the **⋯** button beside **Publish 3 changes**, then **Discard all…**.
  - **Expected:**
    - A dialog titled "Discard 3 changes?" opens.
    - It reads "The unpublished changes are discarded. This cannot be undone."
  - **Notes:**

- [ ] `AB77` Select **Discard**.
  - **Expected:**
    - A notice reads "Discarded 3 changes."
    - The **Publish** button is gone from the top bar.
  - **Notes:**

### DRAFT-20: Publishing Leaves Changes the Role in Use Can't Make

**Account:** Feature Lead, `feature.lead@fathom.test`, changed from DRAFT-19.

**Preconditions:** Signed in with this account. **Projects** page open from the left-hand menu, on the **Projects** tab.

- [ ] `C7A2` Choose **Engineering Manager** in the role menu.
  - **Expected:** The top bar's right end reads "Engineering Manager".
  - **Notes:**

- [ ] `5E9B` In the row 'Crane Control', double-click the **Name** cell, clear it, type `Crane Control Two` and press Enter.
  - **Expected:**
    - The cell shows `Crane Control Two`.
    - The top bar shows **Publish 1 change**.
  - **Notes:**

- [ ] `0B4D` Choose **Feature Lead** in the role menu.
  - **Expected:** The top bar still shows **Publish 1 change**.
  - **Notes:**

- [ ] `E61F` Select **Publish 1 change**.
  - **Expected:**
    - A notice reads "Nothing was published. 1 change needs another role."
    - The top bar still shows **Publish 1 change**.
  - **Notes:**

- [ ] `9A30` Choose **Engineering Manager** in the role menu.
  - **Expected:** The top bar's right end reads "Engineering Manager".
  - **Notes:**

- [ ] `D85C` Select **Publish 1 change**.
  - **Expected:**
    - A notice reads "Published 1 change."
    - The **Publish** button is gone from the top bar.
  - **Notes:**

**Afterwards:** Run Restore the Seed Data.
