# Fathom: Administration Pages

**Last updated:** 2026-11-17

The Administration pages hold accounts, roles, settings, lists and data classes. They sit in the sidebar's Administration section in that order, each shown only to a role allowed to open it.

[Accounts help](../../help/accounts.md), [Roles help](../../help/roles.md), [Settings help](../../help/settings.md), [Lists help](../../help/lists.md) and [Data classes help](../../help/data-classes.md) describe them for the people who use them. [Visual Design](../visual-design.md) covers what every page shares.

## Accounts

- **Table:** The shared table, read only: Name, Email address, Roles (the default first), Status and Created.
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
- **Grid:** View, Approve and Edit columns over the areas, then General, Personal and Confidential under a Data classification heading, without Approve boxes.
  - **Classify data** and **Approve own drafts** are boxes of their own below.
  - A tick that comes with another is greyed; a box that needs another is unticked and greyed until that one is ticked.
  - The role that alone gives an active account Edit Administration has that box ticked and greyed.
- **Summary:** Beside the grid, plain English says what the role sees, what it misses and what its holders can do.
  - A missed view names what it needs, never the details in a class.
  - Lines gained since the dialog opened are bold teal; lines lost stay, struck through in red.
- **Saving:** A change to a role held by accounts first lists what each account gains and loses. Starting roles also get **Restore template**.

## Settings

- **Panels:** One panel per setting, each with its own **Save**, turned off until something differs. Those who can't change settings get read-only fields and no **Save**.
- **Time zone:** The time there now shows under the choice, before it is saved.
- **Passwords:** Password requirements and Generated passwords, each under a small heading.
  - While the generated recipe would break the requirements, a red box says why and **Save** stays off.

## Lists

- **Place:** In Administration, since lists hold choices for the plan and features as well as people.
- **Switch:** **All**, **Built in** and **Custom** beside the search.
- **Built-in lists:** A "Built in" label, a dimmed line from Fathom saying what the list is for, and no **Retire list** or **Remove list**.
- **Lists with meanings:** In a [list with meanings](../../product/decisions.md#configuration), each choice shows its meaning, chosen from a menu.
  - The only choice with a given meaning, and the last choice offered in Positions, can't be retired or removed.
- **Feature sizes:** Each choice ends with its weight, typed as a Number column's value is.

## Data Classes

- **Place:** After Lists, for a role that may Classify data.
- **Sections:** Built-in details, Columns and Lists, the last two only for a role that reads them.
- **Tables:** Each has the item, its class as [A class's mark](../../standards/ui-conventions.md#access) sets out, and **About**. The three tables share column widths so they line up.
- **Change class…:** Ends each row, as [Changing a class](../../standards/ui-conventions.md#access) sets out. It is turned off for a role that can't see the item's class, and absent on columns that take their list's class.
- **Class names elsewhere:** Lines Fathom writes put the class's symbol before Personal and Confidential; typed words show as typed. The export question colours them as the [Decisions Log](../../product/decisions.md#platform-and-operations) sets out.
