# Working as an Administrator

As an Administrator, you set up what each role lets its holders do, and you manage who can sign in to Fathom. You also check the access history and set Fathom's settings. Your role sees neither the plan nor people's details.

Your pages are under **Administration** in the left-hand menu, with **Access history** under **History**.

## What to Know First

- **Accounts and roles:** each account holds one or more roles, and a role decides what its holder sees and does.
- **No drafts:** your changes to accounts, roles and settings take effect straight away. Nobody approves them, and each one is recorded in the access history.

## Set Up the Roles

### See What a Role Gives

1. Select the **Roles** page.
1. Select **Edit** in the role's row.
1. Read the summary at the right of the grid: what the role **Sees**, **Doesn't see**, **Can** and **Cannot** do.
1. Select **Cancel** to close it without changing anything.

See [Roles](roles.md#see-what-a-role-gives).

### Change What a Role Gives

1. On **Roles**, select **Edit** in the role's row.
1. Tick or untick boxes in the grid.
1. Select **Save**.
1. Check what each account holding the role **Gains** and **Loses**.
1. Select **Save changes**.

If no account is affected, Fathom saves it straight away. See [Roles](roles.md#change-a-role).

### Make a Role From a Copy

1. On **Roles**, select **Copy** in the row of the role closest to what you need.
1. Type the new role's **Name**.
1. Tick or untick the boxes it needs.
1. Select **Create role**.

Nobody holds the new role until you give it to accounts. See [Roles](roles.md#make-a-new-role).

### Restore a Starting Role

A starting role is one Fathom comes with, such as the Team Member.

1. On **Roles**, select **Edit** in the role's row.
1. Select **Restore template**. It puts back Fathom's own name, description and boxes.
1. Select **Save**.
1. Check what each account gains and loses, and select **Save changes**.

See [Roles](roles.md#go-back-before-saving).

## Look After Accounts

To open an account's details, point at its row on **Accounts**, and select the details button at the right of its **Name**. The buttons for changing the account are under its details.

### Make an Account

1. On **Accounts**, select **New account**.
1. Type the person's **Name**.
1. Type their **Email address**.
1. Tick each role the account holds.
1. If you ticked more than one, choose the **Default role**.
1. Select **Create account**.
1. Select **Copy**, and give the password to its holder. They change it when they first sign in.
1. Select **Done**.

The account is ready once its row shows **Active**. See [Accounts](accounts.md#make-an-account).

### Change an Account's Roles

1. Open the account's details.
1. Select **Edit…**.
1. Tick or untick its roles.
1. If it holds more than one, choose its **Default role**.
1. Select **Save**.

See [Accounts](accounts.md#change-an-account).

### Reset a Password

1. Open the account's details.
1. Select **Reset password…**.
1. Select **Reset password** in the dialog.
1. Select **Copy**, and give the new password to its holder.
1. Select **Done**.

You can't reset your own password here; change it from your account menu. See [Accounts](accounts.md#reset-a-password).

### Deactivate an Account

1. Open the account's details.
1. Select **Deactivate…**.
1. Select **Deactivate** in the dialog.

The account can't sign in, and its **Status** says **Deactivated**. To let it sign in again, select **Reactivate…** in its details. See [Accounts](accounts.md#deactivate-an-account).

## Review Who Holds Each Role

Do this from time to time, so each account holds only the roles its holder still needs.

### Filter Accounts by Role

1. On **Accounts**, open the **Roles** column's menu.
1. Select **Filter…**.
1. Tick one role. The table shows only the accounts that hold it.
1. Read down the accounts, noting any whose holder no longer needs the role.
1. Untick that role.
1. Tick the next role, and read its accounts the same way.

See [Accounts](accounts.md#find-an-account).

### Take Away Roles No Longer Needed

1. Open the account's details.
1. Select **Edit…**.
1. Untick each role its holder no longer needs.
1. Select **Save**.

If its holder no longer needs Fathom at all, deactivate the account instead. A greyed-out role can't be taken away, since Fathom always keeps one account able to manage accounts. See [Accounts](accounts.md#change-an-account).

Then check the access history's marked entries, as below, for any role change you didn't expect.

## Check the Access History

### Find an Entry

1. Select the **Access history** page, under **History**.
1. Type a name, an email address or a word such as `switched` in the **Search** box.

The search looks through the latest 200 entries. See [Access history](access-history.md#find-an-entry).

### Check the Marked Entries

1. On **Access history**, look for entries ending in a grey **Worth checking** box.
1. Check each one. They mark changes that could give someone access or take it away, such as a new account or a change to someone's roles.

See [Access history](access-history.md#check-the-marked-entries).

## Change the Settings

### Change the Time Zone

1. Select the **Settings** page.
1. In **Time zone**, type part of the time zone's name, such as `Vancouver`.
1. Choose the time zone.
1. Check the day and time shown under it.
1. Select **Save**.

See [Settings](settings.md#change-the-time-zone).

### Set the Rules for Passwords

1. On **Settings**, under **Password requirements**, set the **Minimum length** and tick what each password **Must have**.
1. Under **Generated passwords**, set the **Length** and tick what they **Use**.
1. Select **Save**.

A tighter rule applies the next time each person changes their password. See [Settings](settings.md#set-the-rules-for-passwords).

You're done when everyone who needs Fathom can sign in with only the roles they need, and you've checked each entry marked **Worth checking**.
