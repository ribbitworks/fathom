---
title: "Manual Test: Record Keys and Links"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/data/**"]
dependencies: ["docs/standards/testing.md", "docs/design/development-setup.md", "docs/standards/ui-conventions.md"]
last_updated: "2026-11-27"
---

# Manual Test: Record Keys and Links

## Scope

Verifies records' keys and links, as the [Domain Model](../design/domain-model.md#change-and-history-entities) and [UI Conventions § Links to Records](../standards/ui-conventions/pages-and-panels.md#links-to-records) set out:

- Each record's key under its details' title, and a table's **Key** column.
- Copying its link and key from there and from row, card and column menus, with one table row's buttons shown at a time.
- The key and menu on the Features Board's cards, and finding a person on the Org chart by key.
- Following a link to the record, Back after it, and signing in first, with a release's and a schedule's links opening on their own tabs.
- A link a role may not follow.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Engineering Director:** `engineering.director@fathom.test`
- **Team Member:** `team.member@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom) and [Restore the Seed Data](manual-test-basics.md#restore-the-seed-data).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms this test uses.

- **Key:** the dimmed word, hyphen and number after a **#** under a details panel's title, such as **#FEATURE-12**.
- **Row's buttons:** the details button and the **⋯** that show at the right of a table row's **Name** cell.

## Test Cases

Run the test cases in order. Start with Start Fathom, then Restore the Seed Data. Record each step's result as [Recording Results](manual-test-basics.md#recording-results) sets out.

### KEY-01: A Key Shows Under Its Title, and Copies

**Account:** Engineering Director, `engineering.director@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Features** page open from the left-hand menu.

- [ ] `B71E` Select the details button over 'Offline Sync''s **Name** cell, and write down the key under the title.
  - **Expected:**
    - The details open beside the table, titled **Offline Sync**.
    - Under the title, in grey, **#FEATURE-** and a number.
  - **Notes:**

- [ ] `0C4A` Point at the key.
  - **Expected:** A thin outline shows around it, and its text darkens.
  - **Notes:**

- [ ] `5D92` Select the key.
  - **Expected:** A menu opens under it with **Copy link** and **Copy key**.
  - **Notes:**

- [ ] `A40D` Select **Copy key**.
  - **Expected:**
    - The menu closes.
    - A notification says "Key copied."
  - **Notes:**

- [ ] `7F18` Paste into the search box above the table.
  - **Expected:** The search box holds the key written down in `B71E`, starting with **#**.
  - **Notes:**

**Afterwards:** Open the **Views** menu above the table and select **Clear view**.

### KEY-02: A Link Opens Its Record, and Back Returns

**Account:** Engineering Director, `engineering.director@fathom.test`, the account KEY-01 ended with.

**Preconditions:** **Features** page open, with 'Offline Sync''s details beside the table.

- [ ] `D2FA` Select the key under the details' title.
  - **Expected:** A menu opens under it with **Copy link** and **Copy key**.
  - **Notes:**

- [ ] `E3A6` Select **Copy link**.
  - **Expected:**
    - The menu closes.
    - A notification says "Link copied."
  - **Notes:**

- [ ] `15D8` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page shows.
  - **Notes:**

- [ ] `62C8` Paste the link into the browser's address bar, and press Enter.
  - **Expected:**
    - The **Features** page opens, with 'Offline Sync''s details beside the table.
    - The key under the title is the one written down in KEY-01 `B71E`.
  - **Notes:**

- [ ] `D57B` Press the browser's Back button.
  - **Expected:** The **People** page shows again.
  - **Notes:**

### KEY-03: A Link Opens Once Signed In

**Account:** Engineering Director, `engineering.director@fathom.test`, the account KEY-02 ended with.

**Preconditions:** The link to 'Offline Sync' copied in KEY-02 `E3A6`, which nothing has been copied over since.

- [ ] `9B6B` Select **Sign out** in the account menu.
  - **Expected:** The **Sign in** page shows.
  - **Notes:**

- [ ] `7DB4` Paste the link into the browser's address bar, and press Enter.
  - **Expected:** The **Sign in** page shows.
  - **Notes:**

- [ ] `E06F` Sign in as the Engineering Director, `engineering.director@fathom.test`.
  - **Expected:** The **Features** page opens, with 'Offline Sync''s details beside the table.
  - **Notes:**

### KEY-04: A List's Key Copies Its Link

**Account:** Engineering Director, `engineering.director@fathom.test`, the account KEY-03 ended with.

**Preconditions:** **Lists** page open from the left-hand menu.

- [ ] `46AA` Select the details button of 'Sites', and write down the key under its name.
  - **Expected:** Under the list's name, in grey, **#LIST-** and a number.
  - **Notes:**

- [ ] `2B67` Select the key.
  - **Expected:** A menu opens under it with **Copy link** and **Copy key**.
  - **Notes:**

- [ ] `1A95` Select **Copy link**.
  - **Expected:** A notification says "Link copied."
  - **Notes:**

### KEY-05: A Link the Role May Not Follow Finds Nothing

**Account:** Team Member, `team.member@fathom.test`, changed from KEY-04.

**Preconditions:** Signed in with this account. The link to 'Sites' copied in KEY-04 `1A95`, which nothing has been copied over since.

- [ ] `93E1` Paste the link into the browser's address bar, and press Enter.
  - **Expected:** The page's heading says "Nothing found for #LIST-" and the number written down in KEY-04 `46AA`.
  - **Notes:**

### KEY-06: Rows' and Cards' Menus

**Account:** Engineering Director, `engineering.director@fathom.test`, changed from KEY-05.

**Preconditions:** Signed in with this account. **Features** page open from the left-hand menu.

- [ ] `C81D` Right-click 'Offline Sync''s **Status** cell.
  - **Expected:** A menu opens beside the pointer, titled **Offline Sync**, with **Show details** and **Copy link** among its items.
  - **Notes:**

- [ ] `0F6B` Select **Copy link**.
  - **Expected:** A notification says "Link copied."
  - **Notes:**

- [ ] `023B` Select 'Offline Sync''s **Name** cell.
  - **Expected:** The row's buttons show over 'Offline Sync''s **Name** cell.
  - **Notes:**

- [ ] `4A46` Point at 'Report Builder''s **Status** cell.
  - **Expected:**
    - The row's buttons show over 'Report Builder''s **Name** cell.
    - No buttons show over 'Offline Sync''s **Name** cell.
  - **Notes:**

- [ ] `5D7B` Point at the **Features** heading above the table.
  - **Expected:** The row's buttons show over 'Offline Sync''s **Name** cell again, and over no other row.
  - **Notes:**

- [ ] `B39E` Select **Board** beside the **Features** heading.
  - **Expected:** Under each card's name, small and grey, its key, such as **#FEATURE-** and a number.
  - **Notes:**

- [ ] `90DD` Point at 'Offline Sync''s card.
  - **Expected:** A **⋯** shows at the card's top right, clear of its name.
  - **Notes:**

- [ ] `4AC2` Select the **⋯** on 'Offline Sync''s card.
  - **Expected:** A menu opens under it, titled **Offline Sync**, with **Show details** and **Copy link** among its items.
  - **Notes:**

- [ ] `91A9` Press Esc.
  - **Expected:** The menu closes.
  - **Notes:**

- [ ] `33D0` Select 'Offline Sync''s card.
  - **Expected:** 'Offline Sync''s details open beside the Board.
  - **Notes:**

- [ ] `35E4` Press Esc.
  - **Expected:**
    - The details close.
    - 'Offline Sync''s card has a blue outline.
  - **Notes:**

- [ ] `3BB4` Press Shift+F10.
  - **Expected:** A menu opens under the card, titled **Offline Sync**, with **Show details** and **Copy link** among its items.
  - **Notes:**

**Afterwards:** Select **Table** beside the **Features** heading.

### KEY-07: The Org Chart Finds a Person by Key

**Account:** Engineering Director, `engineering.director@fathom.test`, the account KEY-06 ended with.

**Preconditions:** **People** page open from the left-hand menu.

- [ ] `DE5F` Search for `Lorenza Thiel`.
  - **Expected:** The row of 'Lorenza Thiel' shows.
  - **Notes:**

- [ ] `D25A` Select the details button over 'Lorenza Thiel''s **Name** cell, and write down the key under the title.
  - **Expected:** Her details open, with **#PERSON-** and a number under the title.
  - **Notes:**

- [ ] `C6AD` Select the **Org chart** page in the left-hand menu.
  - **Expected:** The **Org chart** page shows.
  - **Notes:**

- [ ] `38C9` Type the key written down in `D25A`, with its **#**, in the **Find a person or team** field.
  - **Expected:** The field's list offers 'Lorenza Thiel' alone.
  - **Notes:**

- [ ] `E70B` Choose 'Lorenza Thiel' in the field's list.
  - **Expected:**
    - Her card is in the middle of the chart, with a blue ring around it.
    - No **⋯** shows on the card.
  - **Notes:**

- [ ] `99DF` Right-click her card.
  - **Expected:** A menu opens beside the pointer, titled **Lorenza Thiel**, with **Show details** and **Copy link** among its items.
  - **Notes:**

### KEY-08: A Column's Link Opens Its Menu

**Account:** Engineering Director, `engineering.director@fathom.test`, the account KEY-07 ended with.

**Preconditions:** **People** page open from the left-hand menu.

- [ ] `A7E1` Select the **Skills** column's heading.
  - **Expected:** A menu opens, titled **Skills**, offering **Copy link** under its title.
  - **Notes:**

- [ ] `1C5D` Select **Copy link**.
  - **Expected:** A notification says "Link copied."
  - **Notes:**

- [ ] `5C1E` Select the **Lists** page in the left-hand menu.
  - **Expected:** The **Lists** page shows.
  - **Notes:**

- [ ] `F04A` Paste the link into the browser's address bar, and press Enter.
  - **Expected:** The **People** page opens with the **Skills** column in view and its menu open.
  - **Notes:**

### KEY-09: The Key Column Shows Whole Keys

**Account:** Engineering Director, `engineering.director@fathom.test`, the account KEY-08 ended with.

**Preconditions:** **Features** page open from the left-hand menu.

- [ ] `FDB3` Open the **Views** menu.
  - **Expected:**
    - Under the heading **Hidden**, the menu lists **Key**.
    - The table has no **Key** column.
  - **Notes:**

- [ ] `A9C0` Select **Key** under **Hidden**.
  - **Expected:**
    - A **Key** column shows straight after the **Name** column.
    - Each row's **Key** cell shows **#FEATURE-** and a number.
    - Every key shows whole, with none cut short.
  - **Notes:**

- [ ] `3E7C` Write down the first row's key, then search for it.
  - **Expected:** The table shows that row alone, its **Key** cell showing the key typed.
  - **Notes:**

### KEY-10: A Release's and a Schedule's Links Open on Their Tabs

**Account:** Engineering Director, `engineering.director@fathom.test`, the account KEY-09 ended with.

**Preconditions:** **Releases** page open from the left-hand menu, on the **Releases** tab.

- [ ] `27AA` Select the details button at the right of the first cell of the row for 'Harbor 2 LTS', and write down the key under the title.
  - **Expected:**
    - The details open beside the table, titled **Harbor 2 LTS**.
    - Under the title, in grey, **#RELEASE-** and a number.
  - **Notes:**

- [ ] `8367` Select the key, then **Copy link**.
  - **Expected:** A notification says "Link copied."
  - **Notes:**

- [ ] `9517` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page shows.
  - **Notes:**

- [ ] `7B66` Paste the link into the browser's address bar, and press Enter.
  - **Expected:**
    - The **Releases** page opens, with the **Releases** tab chosen.
    - 'Harbor 2 LTS''s details are beside the table, with the key written down in `27AA` under the title.
  - **Notes:**

- [ ] `A4D6` Select the **Schedules** tab.
  - **Expected:** The **Schedules** tab is chosen.
  - **Notes:**

- [ ] `7FD4` Select the details button at the right of the first cell of the row for 'Platform', and write down the key under the title.
  - **Expected:**
    - The details open beside the table, titled **Platform**.
    - Under the title, in grey, **#SCHEDULE-** and a number.
  - **Notes:**

- [ ] `0586` Select the key, then **Copy link**.
  - **Expected:** A notification says "Link copied."
  - **Notes:**

- [ ] `D625` Select the **People** page in the left-hand menu.
  - **Expected:** The **People** page shows.
  - **Notes:**

- [ ] `CB73` Paste the link into the browser's address bar, and press Enter.
  - **Expected:**
    - The **Releases** page opens, with the **Schedules** tab chosen.
    - 'Platform''s details are beside the table, with the key written down in `7FD4` under the title.
  - **Notes:**
