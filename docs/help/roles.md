# Roles

The **Roles** page lists the roles accounts can hold, and what each one lets its holders see and do. You find it under **Administration** in the left-hand menu, if your role sees administration. If your role also manages accounts, as the Administrator does, you can change roles and make new ones.

## What to Know First

- **Areas:** Fathom's data is split into areas, such as the plan, people and configuration. A role is given access area by area.
- **Drafts:** most changes in Fathom are drafts. Nobody else sees them until they're published, and they take effect once someone approves them.
- **View, Approve and Edit:** **View** lets the role see an area. **Edit** lets it change the area, as drafts where the area has them. **Approve** lets it approve or reject other people's drafts there.
- **Data classes:** each piece of data has a class, **General**, **Personal** or **Confidential**, which decides who sees it. A role sees an area's **Personal** or **Confidential** data only if it's also given that class. See [Data classes](data-classes.md).
- **Who holds a role:** you give roles to accounts on the [Accounts](accounts.md) page.
- **No drafts for roles:** a change to a role takes effect straight away, for every account that holds it. Nobody approves it. Each change is recorded in the access history, and a change to an existing role is marked as worth checking.

## See What a Role Gives

Select **View** in the role's row. If you may change roles, select **Edit** instead.

The dialog shows a grid of boxes on the left, and a summary of what the role sees and does on the right. Each role Fathom starts with has a Help page saying what it does most, such as [Working as a Team Member](working-as-a-team-member.md), listed under **Working in Fathom** in [Help](index.md).

## Change a Role

1. Select **Edit** in the role's row.
1. Tick or untick boxes in the grid. The summary marks what each change adds and takes away.
1. Change the **Name** or **Description**, if you need to.
1. Select **Save**.

If the change alters what any account may do, Fathom lists those accounts first, with what each one **Gains** and **Loses**. Check the list, then select **Save changes**. To go back to the grid instead, select **Cancel**.

If no account is affected, Fathom saves the role straight away.

You're done when the dialog closes, and the role's row is back in the list.

## Go Back Before Saving

- **Reset** puts the boxes back as they were when you opened the dialog. It leaves the name and description alone.
- **Restore template** puts back Fathom's own name, description and boxes for a role Fathom starts with.
- **Cancel** closes the dialog without saving anything.

## Make a New Role

The quickest way is to copy the role closest to what you need.

1. Select **Copy** in that role's row, or **New role** to start with nothing ticked.
1. Type the **Name**. No other role can have the same one.
1. Type a **Description**, if it helps.
1. Tick the boxes the role needs.
1. Select **Create role**.

Nobody holds a new role until you give it to accounts.

You're done when the new role shows in the list.

## Reading the Grid

- **Rows** are the areas: **Plan**, **Features and releases**, **Allocations**, **People**, **Feature teams**, **Hiring plan**, **Configuration** and **Administration**.
- **Edit** brings **View** with it, so ticking **Edit** ticks **View** too.
- **Schedules** and their cycles are changed with **Edit** on either **Plan** or **Configuration**, and their drafts approved with **Approve** on either one. Either way, the role must also see schedules, with **View** on **Features and releases** or **Configuration**.
- **Approve** doesn't let the role see anything. A role can approve a draft only if it sees all the draft's data.
- **Administration** has no **Approve**, since changes to accounts, roles and settings aren't drafts.
- Under **Data classification**, **General** comes with every area. You tick **Personal** and **Confidential** on their own.
- **Hiring plan** also needs the hiring plan's class, which is **Confidential** unless someone changes it. Without that class, planned hires show only as placeholders.
- **Columns** added to **Features** or **People** are set up with **Edit** on that area, together with **View** on **People**.
- **Classify data**, under the grid, lets the role change the class of details, lists and columns.
- **Approve own drafts**, under the grid, lets the role approve drafts its holders made themselves, which otherwise need someone else.

## Reading the Summary

- **Sees** lists the pages the role opens, and the views its classes allow, such as **Org chart on other dates**.
- **Doesn't see** lists the pages it doesn't open, and each view it misses, with what that view needs.
- **Can** and **Cannot** say, in a sentence each, what the role does and doesn't do.
- A line in bold teal is new since you opened the dialog. A line struck through in red is taken away.

## Marks on the Page

- **A greyed-out tick** comes with another box, such as **View** with **Edit**. It can also mean the box must stay: Fathom always keeps one active account that manages accounts.
- **A greyed-out empty box** needs another box first, such as **Approve** on **People**, which needs **View** on **People**. Unticking a box also unticks the ones that need it.
- **Accounts** gives how many active accounts hold the role.
- **Personal** and **Confidential** have their class's symbol before them in the lines Fathom writes about a role. A description shows exactly as it was typed.
