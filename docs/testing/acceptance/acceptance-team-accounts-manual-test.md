---
title: "Manual Test: Acceptance, The Team's Accounts"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "apps/server/src/**"]
dependencies: ["docs/standards/testing.md", "docs/testing/manual-test-basics.md", "docs/testing/acceptance/acceptance-installing-fathom-manual-test.md", "docs/help/working-as-an-administrator.md", "docs/product/roles.md"]
last_updated: "2026-11-19"
---

# Manual Test: Acceptance, The Team's Accounts

## Scope

Verifies that the first Administrator readies a new installation for its team, as [Working as an Administrator](../../help/working-as-an-administrator.md) describes: setting Fathom's time zone and the rules for passwords, making an account for each person on the team with the role they start with, and checking what the access history records. It runs straight after [Installing Fathom](acceptance-installing-fathom-manual-test.md), on the installation it made.

## Test Environment

What [Installing Fathom](acceptance-installing-fathom-manual-test.md) left, run straight after it:

- Fathom running on its installation, at `https://localhost:10443`, with only the Fathom Administrator's account.
- The browser window Installing Fathom ended in, signed in as the Fathom Administrator on the **Accounts** page.
- A plain text editor, for the password list.

## Test Accounts

This test uses:

- **Administrator:** `install.administrator@fathom.test`, shown in Fathom as "Fathom Administrator", with the password `fictional install password` that [Installing Fathom](acceptance-installing-fathom-manual-test.md) gave it.

This test creates these accounts, each with the one role it starts with. Each has the password this test writes in the password list, until its holder changes it at their first sign-in, in the test named, to the new password listed:

| Name | Email address | Role | First sign-in | New password |
| --- | --- | --- | --- | --- |
| `Ines Harrow` | `ines.harrow@fathom.test` | Workforce Administrator | [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md) | `fictional ines password` |
| `Tomas Reed` | `tomas.reed@fathom.test` | Project Manager | [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md) | `fictional tomas password` |
| `Odile Brandt` | `odile.brandt@fathom.test` | Engineering Director | [Feature Teams](acceptance-feature-teams-manual-test.md) | `fictional odile password` |
| `Priya Lund` | `priya.lund@fathom.test` | Product Manager | [Planning Projects](acceptance-planning-projects-manual-test.md) | `fictional priya password` |
| `Dara Finch` | `dara.finch@fathom.test` | Feature Lead | [Staffing the Work](acceptance-staffing-the-work-manual-test.md) | `fictional dara password` |
| `Ada Quill` | `ada.quill@fathom.test` | Engineering Manager | [Staffing the Work](acceptance-staffing-the-work-manual-test.md) | `fictional ada password` |
| `Bram Oakes` | `bram.oakes@fathom.test` | Team Member | [Reading the Plan](acceptance-reading-the-plan-manual-test.md) | `fictional bram password` |
| `Vera Marlow` | `vera.marlow@fathom.test` | Executive | [Reading the Plan](acceptance-reading-the-plan-manual-test.md) | `fictional vera password` |

## Common Procedures

[Start Again](../manual-test-basics.md#start-again) removes the installation, for a fresh run from [Installing Fathom](acceptance-installing-fathom-manual-test.md). This test adds:

### Make an Account

For the name, email address and role a step gives, on the **Accounts** page:

1. Select **New account**.
2. Type the name in **Name**, and the email address in **Email address**.
3. Unless the role is **Team Member**, tick the role under **Roles**, then untick **Team Member**, so only the role given is ticked.
4. Select **Create account**.
5. Select the eye button, and copy the password shown into the password list, beside the email address.
6. Select **Done**.
7. Confirm that a notification says "Created the account for" followed by the name.

## Terms

[Manual Test Basics](../manual-test-basics.md#terms) defines the terms every test uses. This test adds:

- **Password list:** a file in the text editor, kept outside the repository, where each new account's password is written beside its email address. Later tests read each password from it for its holder's first sign-in.

## Test Cases

Run the test cases in order, in about 30 minutes, straight after [Installing Fathom](acceptance-installing-fathom-manual-test.md). Check each step whose expected result you see, and write anything else under its notes. [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md) follows on from the last test case.

### TEAM-01: The Time Zone Is Set

**Account:** Administrator, `install.administrator@fathom.test`, the same as INSTALL-04 in [Installing Fathom](acceptance-installing-fathom-manual-test.md); the first test case.

**Preconditions:** [Installing Fathom](acceptance-installing-fathom-manual-test.md) run just before. Signed in with this account.

- [ ] `8DEE` Look at the left-hand menu.
  - **Expected:**
    - The **Administration** section shows **Accounts**, **Roles** and **Settings**.
    - The **History** section shows **Access history**.
    - It shows no page of the plan or of people.
  - **Notes:**

- [ ] `A95D` Select the **Settings** page in the left-hand menu.
  - **Expected:**
    - **Time zone** reads "America/Vancouver".
    - Under it, "It is" and the time there.
  - **Notes:**

- [ ] `4E44` Type `Los` in **Time zone**, and choose **America/Los_Angeles**.
  - **Expected:** **Time zone** reads "America/Los_Angeles".
  - **Notes:**

- [ ] `B1AE` Select the **Save** under **Time zone**.
  - **Expected:** A notification says "Fathom's time zone is now America/Los_Angeles."
  - **Notes:**

### TEAM-02: The Rules for Passwords Are Tightened

**Account:** Administrator, `install.administrator@fathom.test`, the same as TEAM-01.

**Preconditions:** TEAM-01 done. **Settings** page open.

- [ ] `C4F3` Read **Password requirements**.
  - **Expected:**
    - **Minimum length** reads "12".
    - The panel's **Save** is turned off.
  - **Notes:**

- [ ] `372D` Replace the text in **Minimum length** with `16`.
  - **Expected:** The panel's **Save** is turned on.
  - **Notes:**

- [ ] `1C40` Select the panel's **Save**.
  - **Expected:**
    - A notification says "Saved the password settings."
    - The panel's **Save** is turned off again.
  - **Notes:**

### TEAM-03: An Account Is Made for the Workforce Administrator

**Account:** Administrator, `install.administrator@fathom.test`, the same as TEAM-02.

**Preconditions:** TEAM-02 done. The password list open in the text editor.

- [ ] `87BF` Select the **Accounts** page in the left-hand menu.
  - **Expected:** The table lists one account, "Fathom Administrator", marked **This account**.
  - **Notes:**

- [ ] `744C` Select **New account**.
  - **Expected:**
    - A dialog titled "New account" opens.
    - **Roles** lists every role, each with a square tick box and its description.
    - Only **Team Member** is ticked.
  - **Notes:**

- [ ] `A169` Type `Ines Harrow` in **Name**.
  - **Expected:** **Name** shows what was typed.
  - **Notes:**

- [ ] `46B9` Type `ines.harrow@fathom.test` in **Email address**.
  - **Expected:** **Email address** shows what was typed.
  - **Notes:**

- [ ] `2A0A` Under **Roles**, tick **Workforce Administrator**.
  - **Expected:**
    - **Workforce Administrator** and **Team Member** are ticked.
    - **Default role** is under the roles.
  - **Notes:**

- [ ] `7D9B` Untick **Team Member**.
  - **Expected:**
    - Only **Workforce Administrator** is ticked.
    - **Default role** is gone.
  - **Notes:**

- [ ] `9A0C` Select **Create account**.
  - **Expected:** The dialog, titled "Password for Ines Harrow", says "This password is shown only once. Ines Harrow must change it at the next sign-in."
  - **Notes:**

- [ ] `388B` Select the eye button, and copy the password shown into the password list, beside `ines.harrow@fathom.test`.
  - **Expected:** The eye button shows the password.
  - **Notes:**

- [ ] `2F0A` Select **Done**.
  - **Expected:**
    - A notification says "Created the account for Ines Harrow."
    - The row of `Ines Harrow` reads **Workforce Administrator** in **Roles** and "Active" in **Status**.
  - **Notes:**

### TEAM-04: Accounts Are Made for the Rest of the Team

**Account:** Administrator, `install.administrator@fathom.test`, the same as TEAM-03.

**Preconditions:** TEAM-03 done. **Accounts** page open.

- [ ] `6E24` Run Make an Account for `Tomas Reed`, `tomas.reed@fathom.test`, with the role **Project Manager**.
  - **Expected:** The row of `Tomas Reed` reads **Project Manager** in **Roles**.
  - **Notes:**

- [ ] `DCBA` Run Make an Account for `Odile Brandt`, `odile.brandt@fathom.test`, with the role **Engineering Director**.
  - **Expected:** The row of `Odile Brandt` reads **Engineering Director** in **Roles**.
  - **Notes:**

- [ ] `878A` Run Make an Account for `Priya Lund`, `priya.lund@fathom.test`, with the role **Product Manager**.
  - **Expected:** The row of `Priya Lund` reads **Product Manager** in **Roles**.
  - **Notes:**

- [ ] `B2C5` Run Make an Account for `Dara Finch`, `dara.finch@fathom.test`, with the role **Feature Lead**.
  - **Expected:** The row of `Dara Finch` reads **Feature Lead** in **Roles**.
  - **Notes:**

- [ ] `2E08` Run Make an Account for `Ada Quill`, `ada.quill@fathom.test`, with the role **Engineering Manager**.
  - **Expected:** The row of `Ada Quill` reads **Engineering Manager** in **Roles**.
  - **Notes:**

- [ ] `A7EB` Run Make an Account for `Bram Oakes`, `bram.oakes@fathom.test`, with the role **Team Member**.
  - **Expected:** The row of `Bram Oakes` reads **Team Member** in **Roles**.
  - **Notes:**

- [ ] `040F` Run Make an Account for `Vera Marlow`, `vera.marlow@fathom.test`, with the role **Executive**.
  - **Expected:**
    - The row of `Vera Marlow` reads **Executive** in **Roles**.
    - The table lists nine accounts, each with one role, and "Active" in every **Status** cell.
    - The password list holds eight passwords, one beside each email address made in TEAM-03 and TEAM-04.
  - **Notes:**

### TEAM-05: The Access History Records the New Accounts

**Account:** Administrator, `install.administrator@fathom.test`, the same as TEAM-04.

**Preconditions:** TEAM-04 done.

- [ ] `C40F` Select the **Access history** page in the left-hand menu.
  - **Expected:** The newest entry reads "Fathom Administrator", then `install.administrator@fathom.test` in brackets, "created the account for" `Vera Marlow`, then `vera.marlow@fathom.test` in brackets, and ends in a grey **Worth checking** box.
  - **Notes:**

- [ ] `6DFC` Type `ines` in the search box at the top of the page.
  - **Expected:** One entry is shown, reading "Fathom Administrator", then `install.administrator@fathom.test` in brackets, "created the account for" `Ines Harrow`, then `ines.harrow@fathom.test` in brackets.
  - **Notes:**

- [ ] `235A` Sign out from the account menu.
  - **Expected:** The **Sign in** page shows.
  - **Notes:**

**Afterwards:** Run [Setting Up Fathom](acceptance-setting-up-fathom-manual-test.md) next, on this installation. To stop here instead, run [Start Again](../manual-test-basics.md#start-again).
