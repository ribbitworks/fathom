# Fathom: Administration Pages

**Last updated:** 2026-11-18

The Administration pages hold accounts, roles, settings, lists and data classes. They sit in the sidebar's Administration section in that order, each shown only to a role allowed to open it.

[Accounts help](../../help/accounts.md), [Roles help](../../help/roles.md), [Settings help](../../help/settings.md), [Lists help](../../help/lists.md) and [Data classes help](../../help/data-classes.md) describe them for the people who use them. [Visual Design](../visual-design.md) covers what every page shares.

## Accounts

- **Table:** The shared table, read only: Name, Email address, Roles (the default first), Status and Created.
  - Status is filtered as any choice column is, rather than chosen in the Views menu.
- **New account:** Shown only to those who may edit administration.
- **The user's own row:** A grey "This account" box after the name.
- **Details:** A [side panel](../../standards/ui-conventions.md#details-panels) ending in **Edit…**, **Reset password…** (not on the user's own account) and **Deactivate…** or **Reactivate…**, only for those who may edit administration.
- **Edit dialog:** Every role is a tick box with its description. Once several are ticked, radio buttons choose the default.
- **Refused changes:** Turned off, such as removing the last role able to manage accounts.
- **New accounts:** They start on Team Member, and no password is asked.
- **Generated passwords:** Shown once after creating or resetting, hidden behind an eye button as on the [sign-in page](sign-in.md), with **Copy**. Only **Done** closes the dialog.

## Roles

- **Rows:** The role, its description and how many active accounts hold it, ending in **Edit** and **Copy**, or **View** for those who can't edit roles.
- **New role:** The page's main action, only for those who may edit roles, which [Edit Administration](../../product/roles.md#safeguards-for-administrators) grants.
- **Descriptions:** Shown under the role's name wherever a role is chosen.
- **Grid:** View, Approve and Edit columns over the areas, then General, Personal and Confidential under a Data classification heading, without Approve boxes. No lines under it explain greyed ticks.
  - **Classify data** and **Approve own drafts** are boxes of their own below.
  - A tick that comes with another is greyed; a box that needs another is unticked and greyed until that one is ticked.
  - The role that alone gives an active account Edit Administration has that box ticked and greyed.
- **Summary:** Beside the grid, under Sees, Doesn't see, Can and Cannot, plain English says what the role sees, what it misses and what its holders can do. Pages it doesn't reach are under Doesn't see.
  - A missed view names what it needs, such as "Org chart on other dates: needs Personal", never the details in a class, which each organization decides.
  - Each permission says what it allows and what a role without it can't do, such as "Cannot change allocations".
  - The lines come from the same list the pages use to decide what they show, so they can't drift apart.
  - Lines gained since the dialog opened are bold teal; lines lost stay, struck through in red.
- **Reset:** Puts the boxes back as the dialog opened them.
- **Saving:** A change to a role held by accounts first lists what each account gains and loses; Cancel there returns to the grid. Starting roles also get **Restore template**.
- **Description:** Never emptied when what the role grants changes.

## Settings

- **Panels:** One panel per setting, each with its own **Save**, turned off until something differs. Those who can't change settings get read-only fields and no **Save**.
- **Changes:** Take effect at once, with no draft, and are recorded in the access history.
- **Time zone:** The time there now shows under the choice, before it is saved.
  - One zone, America/Vancouver until changed, so today is the same for everyone and for the server's checks: today's line on timelines, a change's date when none is given, who still works here, and the access history's once-a-day entries.
  - Dates and times shown still follow each person's own settings.
- **Passwords:** Password requirements and Generated passwords, each under a small heading. Fathom sets no policy of its own; a change is marked worth checking.
  - While the generated recipe would break the requirements, a red box says why and **Save** stays off: a recipe with no kind of character, shorter than the minimum, or without a kind the requirements need.

### Password Requirements

- **Minimum length:** 8 to 128 characters, 12 until changed.
- **Kinds:** An uppercase letter, a lowercase letter, a digit and a symbol, each off until changed. A symbol is any character but a letter, a digit or a space.
- **A tighter rule:** Applies from each person's next change, so nobody must change a password that met the old rules.

### Generated Passwords

- **Length:** 12 to 128 characters, 20 until changed.
- **Kinds:** Uppercase letters, lowercase letters and digits until changed; symbols come from `! # $ % & * + - = ? @ ^ _ ~`.
- **Look-alikes:** I, L, O, i, l, o, 0 and 1 are left out until changed.
- **Each kind used:** At least one character of it, at a random place.

## Lists

- **Place:** In Administration, since lists hold choices for the plan and features as well as people.
- **Switch:** **All**, **Built in** and **Custom** beside the search.
- **Built-in lists:** A "Built in" label, a dimmed line from Fathom saying what the list is for, and no **Retire list** or **Remove list**.
- **Lists with meanings:** In a [list with meanings](../../product/domain.md#people-terms), each choice shows its meaning, chosen from a menu.
  - The only choice with a given meaning, and the last choice offered in Positions, can't be retired or removed.
- **Feature sizes:** Each choice ends with its weight, typed as a Number column's value is.

## Data Classes

- **Place:** After Lists, for a role that may Classify data.
- **Sections:** Built-in details, Columns and Lists, the last two only for a role that reads them.
- **Tables:** Each has the item, its class as [A class's mark](../../standards/ui-conventions.md#access) sets out, and **About**. The three tables share column widths so they line up.
- **About:** Plain sentences, such as "These People columns use it: Site."
- **Class dialog:** Names the classes, with no description under them.
- **In the access history:** A move reads such as "Engineering Director changed Start date's class: from Personal to General".
- **Change class…:** Ends each row, as [Changing a class](../../standards/ui-conventions.md#access) sets out. It is turned off for a role that can't see the item's class, and absent on columns that take their list's class.
- **Class names elsewhere:** Lines Fathom writes put the class's symbol before Personal and Confidential; typed words show as typed.
- **The export question:** Titled such as Export Confidential and Personal data?, then This file holds, and each class, its name semibold in its own colour, with its columns in semibold, such as Confidential data (Salary), then Export and Cancel.
  - Once confirmed and a place to save is chosen, the access history records the table and those columns, then the file is written. Cancelling writes nothing.
