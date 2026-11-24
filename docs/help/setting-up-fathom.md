# Setting Up Fathom

This page takes you, as the Workforce Administrator, from a brand-new Fathom to one others can plan with.

Before you start, an Administrator signs in as Fathom Administrator, the account Fathom makes when it's installed. They make your account and one for whoever approves your changes, such as the Engineering Director, and they set Fathom's time zone. See [Working as an Administrator](working-as-an-administrator.md).

## What to Know First

A few ideas come up on every step.

- **Tables:** the **People** page is a table, much like a spreadsheet. Each row is a person, and each column is one thing about them, such as their position or their manager.
- **Lists:** many columns don't take free text. You pick the value from a list instead, such as a position from the list of positions, so everyone's values are spelled the same way.
- **Classes:** each list and column has a class, which decides who sees it. **General** is seen by everyone who can open the page. **Personal** is for people's private and HR details, and **Confidential** is for business data not yet announced; only roles allowed to see them do.
- **Drafts:** most changes you make are drafts. Nobody else sees them until you select **Publish** in the top bar, and they go live once someone approves them. A hollow dot marks a change you haven't published yet, and a yellow dot one that's waiting for approval.

Because columns pick from lists, you set things up in this order: the lists, then the columns that use them, then the people. New positions and hiring states need approving before anyone can be given them.

## Fill In the Lists

A new Fathom comes with only the lists it can't work without, such as **Positions** and **Hiring states**.

1. Select the **Lists** page, open **Positions**, and add the positions.
1. Open **Hiring states**. It starts with **Request to hire**, **Approved to hire**, **Hired** and **Left**.
1. Rename those to the words you use, if they differ. You can add more too, choosing a meaning for each, but keep at least one for each meaning shown beside them.
1. Make a list for anything else you'll describe people by, such as their site or their level. Select **New list**, and give it a name.
1. If its values are private, choose **Personal** or **Confidential** as its class on that form too.
1. Add its choices.

See [Lists](lists.md) for more.

## Add Columns to People

**People** starts with the columns Fathom needs, such as **Position**, **Manager** and **Team**. Add a column for each list you made. You can also add a column that holds a web link, a note or a number.

1. Select the **People** page, then **New column**.
1. Type the column's name, and choose its type. If the column uses one of your lists, choose **Choice from a list**, then the list.
1. Select **Add column**.

A column that uses a list takes the list's class. Any other new column starts as **General**, and you can choose another class as you add it. See [People](people.md#add-a-column).

## Get the Lists Approved

A person's **Position** and **State** can only be choices that are approved. So if you added positions or hiring states, get them approved before you add anyone:

1. Select **Publish**.
1. Ask your approver to approve the changes on the **Drafts** page.

## Add the People

The quickest way to add everyone is to paste them in from a spreadsheet.

1. Put your spreadsheet's columns in the same order as the table's, from **Name** across.
1. Make each value that comes from a list match a choice's name. Capitals and spaces at either end don't matter.
1. On **People**, select the **Name** cell of the empty row at the end of the table, and paste the rows there.
1. Tick **Manager?** for everyone who manages others.
1. Add your planned hires: the jobs you plan to fill. Give each one a hiring state in **State**, such as **Request to hire**.
1. Select **Publish**, and ask your approver to approve the changes on the **Drafts** page.

Fathom only lets you choose a manager once their **Manager?** tick is approved. So once it is:

1. Choose the **Manager** of each person and each planned hire.
1. On each manager's own row, type their team's name in **Team name**. Everyone who reports to them then shows that team in **Team**.

## Set Up Planning

Plans in Fathom are built on releases and on who's available to do the work.

1. On **Releases**, a schedule is a repeating set of cycles, such as one product line's quarters, and its releases ship the work planned in them. On its **Schedules** tab, add a schedule for each product line, and set up its cycles as you add it.
1. On **Capacity**, choose **Settings**.
1. Set the **Working time**, so Fathom can work out how much work people can deliver.
1. On the **Org chart**, choose **Feature teams** in the switch beside the heading. A feature team is a group that works on features together, whoever its members report to.
1. Select the **Feature teams** button above the chart, then **New feature team**, and add each team with its lead and its members.

See [Releases](releases.md), [Capacity](capacity.md) and [Org chart](org-chart.md) for more on each.

## Get the Changes Approved

1. Select **Publish**. It shows how many changes are waiting.
1. Ask your approver, such as a Project Manager or the Engineering Director, to approve them on the **Drafts** page. See [Drafts page](drafts-page.md#approve-drafts).

Some changes skip the draft and take effect straight away: a team's colour, and a change of class.

You're done when **People** shows everyone with their manager and team, and the **Org chart** shows how they report.
