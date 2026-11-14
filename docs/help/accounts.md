# Accounts

The **Accounts** page lists everyone who can sign in to Fathom. You find it under **Administration** in the left-hand menu, if your role sees administration. If your role also manages accounts, as the Administrator does, you can make and change accounts there.

## What to Know First

- **Accounts and roles:** each account holds one or more roles. A role decides what its holder sees and does. You make and change roles on the [Roles](roles.md) page.
- **Default role:** an account with several roles acts as one at a time. Its holder chooses which from their account menu. A new sign-in starts as the role last chosen in that browser, or else as the account's default role.
- **Generated passwords:** you never choose a password for someone. Fathom makes one, shows it to you once, and asks its holder to change it at their first sign-in.
- **No drafts:** changes to accounts take effect straight away. Nobody approves them. Each one is recorded in the access history.

See [Access history](access-history.md) for more.

The table shows each account's **Person**, **Roles**, **Status** and the day it was **Created**.

## Make an Account

1. Select **New account**.
1. Type the person's **Name**.
1. Type their **Email address**. No other account can have the same one.
1. Tick each role the account holds. **Team Member** starts ticked.
1. If you ticked more than one, choose the **Default role**.
1. Select **Create account**. Fathom shows the account's new password.
1. Select **Copy**, and give the password to its holder.
1. Select **Done**.

The password isn't shown again. If it's lost, reset it. How long it is, and what it's made of, follow the rules for generated passwords on the **Settings** page.

You're done when the new account's row shows its name, roles and **Active**.

See [Settings](settings.md) for more.

## Change an Account

1. Select **Edit** in the account's row.
1. Change the **Name**, the **Email address**, the roles or the **Default role**.
1. Select **Save**.

You're done when the account's row shows your change.

## Reset a Password

1. Select **Edit** in the account's row.
1. Select **Reset password**.
1. Select **Reset password** again in the dialog. Fathom shows a new password.
1. Select **Copy**, and give the password to its holder.
1. Select **Done**.

The holder is signed out everywhere, and changes the password at their next sign-in.

You can't reset your own password here. You change it from your account menu instead.

You're done when you've given the new password to its holder.

## Deactivate an Account

Deactivating an account stops it signing in. Fathom never deletes accounts, since the change history and the access history name them.

1. Select **Edit** in the account's row.
1. Select **Deactivate**.
1. Select **Deactivate** again in the dialog.

You're done when the row says **Deactivated**. The account is signed out everywhere.

## Reactivate an Account

1. Select **Edit** in the account's row.
1. Select **Reactivate**.
1. Select **Reactivate** again in the dialog.

If you deactivate your own account, someone else who manages accounts has to reactivate it.

You're done when the row says **Active**.

## Find an Account

- Type part of a name or an email address in the search box.
- Choose **All**, **Active** or **Deactivated** beside it to show only those accounts.

## Marks on the Page

- **This account** marks your own row.
- **(default)** after a role, in **Roles**, marks the account's default role.
- **Active** or **Deactivated**, in **Status**, says whether the account can sign in.
- **A greyed-out role or Deactivate** means the change would leave no active account that manages accounts. Fathom always keeps one, so nobody is locked out.
