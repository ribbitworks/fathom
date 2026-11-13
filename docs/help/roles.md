# Roles

Roles lists the roles accounts can hold, and what each lets its holders see and do. Roles that see administration see the page, under **Administration**, and roles that manage accounts, such as Administrator, change roles and make new ones. Which accounts hold a role is chosen on [Accounts](accounts.md).

## Main Tasks

### See What a Role Gives

Select **View** in the role's row. Roles that may change roles see **Edit** and **Copy** there instead. The dialog shows the role's grid on the left and a summary on the right. **Roles** under **Help** in the left-hand menu says what each role Fathom starts with is for.

### Change a Role

1. Select **Edit** in the role's row.
1. Tick or untick boxes in the grid, and change the **Name** or **Description** if needed. The summary marks what each change adds and takes away.
1. Select **Save**.
1. If the change alters what any account may do, a list says what each of those accounts **Gains** and **Loses**. Check it, then select **Save changes**, or **Cancel** to go back to the grid. Otherwise the role is saved at once.

### Undo Changes Before Saving

- **Reset** puts the boxes back as they were when the dialog opened. It leaves the name and description as they are.
- **Restore template**, on a role Fathom starts with, puts back Fathom's own name, description and boxes for it, keeping ticked any box that must stay, such as **Edit** on **Administration** when no other active account would keep it.

Neither changes the role until **Save**. **Cancel** closes the dialog without saving, and is the way back from a name or description changed by mistake.

### Make a New Role

1. Select **Copy** in the row of the role closest to what's needed, or **New role** to start with nothing ticked.
1. Type the **Name**, and a **Description** if it helps.
1. Tick the boxes the role needs.
1. Select **Create role**. Each role needs a name no other role has.

A new role is held by no one until it's given to accounts on [Accounts](accounts.md).

## Reading the Grid

- **Rows** are the areas a role may reach: **Plan**, **Features and releases**, **Allocations**, **People**, **Feature teams**, **Hiring plan**, **Configuration** and **Administration**.
- **View** lets the role see the area, and **Edit** change it, as drafts where the area has them. **Edit** brings **View** with it.
- **Approve** lets the role approve or reject others' drafts in the area. **Administration** has none, since its changes aren't drafts. It doesn't let the role see anything: a draft can be approved only by a role that sees all its data.
- **Data classification** rows say which classes of data the role sees and changes within the areas it reaches. **General** comes with every area. **Personal** and **Confidential** are each ticked on their own, as [Data classes](data-classes.md) explains.
- **Classify data** lets the role move details, lists and columns between the classes it sees.
- **Approve own drafts** lets the role approve drafts its holders changed themselves, in the areas it approves, which otherwise need another approver.

## Reading the Summary

- **Sees** lists the pages the role opens, and the views on them its classes allow, such as **Org chart on other dates**.
- **Doesn't see** lists the pages it doesn't reach, and each view it misses, with the class that view needs.
- **Can** and **Cannot** say, in a sentence each, what the role does and doesn't do.
- **Highlighted** lines are new since the dialog opened, and **struck-through** lines are taken away.

## Marks and Terms

- **A greyed-out tick** comes with another box, such as **View** with **Edit**, or must stay, such as **Edit** on **Administration** when no other active account would keep it. Fathom always keeps one account that manages accounts.
- **A greyed-out, unticked box** needs another first, such as **Approve** on **People**, which needs **View** on **People**. Unticking a box also unticks those that need it.
- **Accounts** gives how many active accounts hold the role.
- **Personal** and **Confidential** are coloured in descriptions, so the classes stand out.

## Where Changes Go

A change to a role takes effect at once for every account that holds it, with no draft. Each is recorded in the [access history](access-history.md), and marked as worth a second look.
