# Accounts

Accounts lists everyone who can sign in to Fathom, with the roles each holds. Roles that see administration see the page, under **Administration**, and roles that manage accounts, such as Administrator, change them, with **New account** and an **Edit** button in each row. The table gives each account's **Person**, **Roles**, **Status** and the day it was **Created**.

## Main Tasks

### Make an Account

1. Select **New account**.
1. Type the **Name** and **Email address**.
1. Tick each role the account holds. **Team Member** starts ticked.
1. If more than one is ticked, choose the **Default role**.
1. Select **Create account**.
1. Select **Copy**, give the password to its holder, and select **Done**.

The password is shown only once, and must be changed at the first sign-in. Each account needs an email address no other account has. Roles made for the organization are made on the [Roles](roles.md) page.

### Change an Account

1. Select **Edit** in the account's row.
1. Change the **Name**, **Email address**, roles or **Default role**.
1. Select **Save**.

### Reset a Password

1. Select **Edit** in the account's row, then **Reset password**.
1. Select **Reset password** in the dialog.
1. Select **Copy**, give the new password to its holder, and select **Done**.

The holder is signed out everywhere, and changes the password at the next sign-in. **Reset password** isn't offered on the account's own row: its own password is changed from its account menu.

### Deactivate or Reactivate an Account

1. Select **Edit** in the account's row, then **Deactivate**.
1. Select **Deactivate** in the dialog.

A deactivated account is signed out everywhere, and can't sign in until it's reactivated. It stays in the list. An account that deactivates itself needs another account that manages accounts to reactivate it. To let it sign in again, select **Edit**, then **Reactivate**, then **Reactivate** in the dialog.

### Find an Account

- Type a name or email address in the search box.
- Choose **All**, **Active** or **Deactivated** in the switch beside it.

## Marks and Terms

- **This account** marks the signed-in account's own row.
- **(default)** after a role, in the **Roles** column, is the role the account acts as when it signs in, until it chooses another in its account menu. An account acts as one of its roles at a time.
- **Active** or **Deactivated**, in the **Status** column, says whether the account can sign in.
- **A greyed-out role or Deactivate** means the change would leave no active account that manages accounts. Fathom always keeps one.
- **A generated password** follows the rules for generated passwords in [Settings](settings.md).

## Where Changes Go

Changes to accounts take effect at once, with no draft. Each is recorded in the [access history](access-history.md).
