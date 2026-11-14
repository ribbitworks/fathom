# Data classes

The **Data classes** page shows the class of everything Fathom keeps in one, and lets you change it. You find it under **Administration** in the left-hand menu, if your role may classify data.

## What to Know First

A class decides who sees the data.

- **General** data is seen by everyone whose role opens the page that holds it.
- **Personal** data, people's private and HR details, is seen only by roles given **Personal**.
- **Confidential** data, business data not yet announced, is seen only by roles given **Confidential**.

A page or view that needs a class opens only for roles that see it. So changing a class changes which pages each role has.

## See What Each Class Holds

The page has up to three sections:

- **Built-in details** are the details Fathom has from the start, such as **Start date** and **Hiring plan**. **Needed by** lists the pages, views and columns that need each one.
- **Columns** are the columns your organization added to **People**. A column that picks from a list takes that list's class, so it has no **Change class…** of its own. You see this section if your role sees people.
- **Lists** are your organization's lists of choices, with the columns on **People** that use each one. You see this section if your role sees configuration.

## Change a Class

1. Select **Change class…** in the row.
1. Choose the class.
1. Select **Change**.

The new class shows in the row, and every page follows it at once. To go back, change the class again.

You can also change a class from a list's panel on the **Lists** page, and from an added column's menu on **People**.

## When Change Class… Is Greyed Out

A line under it says why:

- **This role can't see** a class: your role doesn't see the class the data is in now, so it can't move it.
- **Being changed by** someone: they have unpublished changes to it. You can change its class once they publish or discard them.

In the dialog, a class your role can't see can't be chosen, so data never moves out of sight of the people who keep it. A list that a column on **Features** uses stays **General**, since everyone who sees the plan sees those columns.

## Marks on the Page

- **A grey box with a lock and Personal or Confidential** gives a class beyond **General**. You see it in **Class** on this page, after a column's heading on **People**, and after a list's name on **Lists**.

A change of class takes effect at once, and has no Undo. It isn't a draft, a change that waits for someone's approval, so it never shows on the **Drafts** page. It's recorded in the access history, and marked as worth checking. See [Access history](access-history.md).

You're done when the row shows the class you chose.
