---
title: "Manual Test: Acceptance, Reporting Lines"
category: "How-To"
audience: "Contributors"
applies_to: ["apps/web/src/**", "apps/server/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/testing/acceptance/acceptance-setting-up-fathom-manual-test.md", "docs/help/setting-up-fathom.md", "docs/product/roles.md"]
last_updated: "2026-11-23"
---

# Manual Test: Acceptance, Reporting Lines

## Scope

Verifies the start of the last round of setting up a brand-new Fathom as [Setting Up Fathom](../../help/setting-up-fathom.md) describes, on the people [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md) added. Once each manager's **Manager?** tick is approved, the Workforce Administrator chooses everyone's manager, names the two reporting teams, gives each person a site, and adds a planned hire. [Feature Teams](acceptance-feature-teams-manual-test.md) finishes the round and publishes it.

## Test Environment

What [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md) left, run straight after it: Fathom running on its installation, at `https://localhost:10443`, in a browser window at least 1,440 pixels wide.

## Test Accounts

[The Team's Accounts](acceptance-team-accounts-manual-test.md) made this account:

- **Workforce Administrator:** `ines.harrow@fathom.test`, shown in Fathom as `Ines Harrow`, with the password `fictional ines password`

## Common Procedures

[Start Again](../manual-test-basics.md#start-again) removes the installation, for a fresh run from [Installing Fathom](acceptance-installing-fathom-manual-test.md).

## Terms

[Manual Test Basics](../manual-test-basics.md#terms) defines the terms every test uses, such as marks and the side panel. This test adds:

- **Typed dates:** unlike the Basics' dates, this test's steps type dates as digits with no separators, such as `20270201`.
- **Three months from now:** the third month after the current one. The steps type its first day as digits; the example after "such as" is for a run in November 2026.

## Test Cases

Run the test cases in order, in about 20 minutes, straight after [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md). Check each step whose expected result you see, and write anything else under its notes. [Feature Teams](acceptance-feature-teams-manual-test.md) follows on from the last test case.

### LINES-01: Each Person's Manager Is Chosen

**Account:** Workforce Administrator, `ines.harrow@fathom.test`, changed from SETUP-12 in [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md); the first test case.

**Preconditions:** [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md) run just before.

- [ ] `C1E7` Sign out from the account menu, and sign in as the Workforce Administrator, `ines.harrow@fathom.test`, with the password `fictional ines password`.
  - **Expected:** The top bar's right end shows `Ines Harrow`.
  - **Notes:**

- [ ] `32BF` Select the **People** page in the left-hand menu.
  - **Expected:**
    - Seven rows are listed, none with a dot.
    - Only `Odile Brandt` and `Ada Quill` have **Manager?** checked.
  - **Notes:**

- [ ] `9C19` Select the **Manager** cell of `Ada Quill`, press Enter, type `Odile`, and choose `Odile Brandt`.
  - **Expected:**
    - The **Manager** cell reads `Odile Brandt`, with a hollow yellow dot before it.
    - **Manager assigned** holds today's date.
  - **Notes:**

- [ ] `66CE` Select the **Manager** cell of `Dara Finch`, press Enter, type `Odile`, and choose `Odile Brandt`.
  - **Expected:** The **Manager** cell of `Dara Finch` reads `Odile Brandt`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `32EA` Select the **Manager** cell of `Emil Stone`, press Enter, type `Odile`, and choose `Odile Brandt`.
  - **Expected:** The **Manager** cell of `Emil Stone` reads `Odile Brandt`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `BE6A` Select the **Manager** cell of `Bram Oakes`, press Enter, type `Ada`, and choose `Ada Quill`.
  - **Expected:** The **Manager** cell of `Bram Oakes` reads `Ada Quill`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `B9D9` Select the **Manager** cell of `Cleo Marsh`, press Enter, type `Ada`, and choose `Ada Quill`.
  - **Expected:** The **Manager** cell of `Cleo Marsh` reads `Ada Quill`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `BDF6` Select the **Manager** cell of `Freya Holt`, press Enter, type `Ada`, and choose `Ada Quill`.
  - **Expected:**
    - Each of the six rows reads its new manager, with a hollow yellow dot before it.
    - `Odile Brandt` has no manager.
  - **Notes:**

### LINES-02: The Reporting Teams Are Named

**Account:** Workforce Administrator, `ines.harrow@fathom.test`, the same as LINES-01.

**Preconditions:** LINES-01 done. **People** page open.

- [ ] `2F9F` Select the **Team name** cell of `Odile Brandt`, type `Keepers`, and press Enter.
  - **Expected:** The cell reads `Keepers`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `29C5` Select the **Team name** cell of `Ada Quill`, type `Lamp crew`, and press Enter.
  - **Expected:** The cell reads `Lamp crew`, with a hollow yellow dot before it.
  - **Notes:**

### LINES-03: Each Person Is Given a Site

**Account:** Workforce Administrator, `ines.harrow@fathom.test`, the same as LINES-02.

**Preconditions:** LINES-02 done. **People** page open.

- [ ] `B58B` Select the **Site** cell of `Odile Brandt`, press Enter, choose `Harbourside`, and press Enter.
  - **Expected:** The cell reads `Harbourside`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `A1B3` Select the **Site** cell of `Ada Quill`, press Enter, choose `Northmere`, and press Enter.
  - **Expected:** The cell reads `Northmere`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `AB90` Select the **Site** cell of `Bram Oakes`, press Enter, choose `Harbourside`, and press Enter.
  - **Expected:** The cell reads `Harbourside`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `C20B` Select the **Site** cell of `Cleo Marsh`, press Enter, choose `Northmere`, and press Enter.
  - **Expected:** The cell reads `Northmere`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `2E88` Select the **Site** cell of `Dara Finch`, press Enter, choose `Harbourside`, and press Enter.
  - **Expected:** The cell reads `Harbourside`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `B4C7` Select the **Site** cell of `Emil Stone`, press Enter, choose `Harbourside`, and press Enter.
  - **Expected:** The cell reads `Harbourside`, with a hollow yellow dot before it.
  - **Notes:**

- [ ] `93E7` Select the **Site** cell of `Freya Holt`, press Enter, choose `Northmere`, and press Enter.
  - **Expected:** Each of the seven rows reads its site, with a hollow yellow dot before it.
  - **Notes:**

### LINES-04: A Planned Hire Is Added

**Account:** Workforce Administrator, `ines.harrow@fathom.test`, the same as LINES-03.

**Preconditions:** LINES-03 done. **People** page open.

- [ ] `1A4E` Select **New person** at the top right of the page.
  - **Expected:** The details panel opens, headed **New person**.
  - **Notes:**

- [ ] `83A1` Select the change button beside **State**, and choose **Request to hire**.
  - **Expected:** **State** reads "Request to hire".
  - **Notes:**

- [ ] `C885` Type `Fictional tide engineer` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `AB5D` Type `REQ-7001` in **ID**.
  - **Expected:** **ID** shows what was typed.
  - **Notes:**

- [ ] `681B` Type the first day of three months from now in **Start**, such as `20270201`.
  - **Expected:** **Start** shows the date typed.
  - **Notes:**

- [ ] `CDF1` Choose **Software Engineer** in **Position** from its change button.
  - **Expected:** **Position** reads "Software Engineer".
  - **Notes:**

- [ ] `6FE0` Choose `Ada Quill` in **Manager** from its change button.
  - **Expected:** **Manager** reads `Ada Quill`.
  - **Notes:**

- [ ] `251A` Select **Add**.
  - **Expected:**
    - The panel shows `Fictional tide engineer`.
    - Its row reads "Request to hire" in **State** and `Ada Quill` in **Manager**.
    - Its row has a hollow yellow dot in its slot.
    - The Publish button reads **Publish 8 changes**.
  - **Notes:**

**Afterwards:** Run [Feature Teams](acceptance-feature-teams-manual-test.md) next, staying signed in, without publishing. To stop here instead, run [Start Again](../manual-test-basics.md#start-again).
