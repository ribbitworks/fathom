# Data classes

The **Data classes** page shows the class of everything Fathom keeps in one, and lets you change it. You find it under **Administration** in the left-hand menu, if your role may classify data.

## What to Know First

A class decides who sees the data.

- **General** data is seen by everyone whose role opens the page that holds it.
- **Personal** data is people's private and HR details. Only roles given **Personal** see it.
- **Confidential** data is business data not yet announced. Only roles given **Confidential** see it.

A page or view that needs a class opens only for roles that see that class. So when you change a class, you can change which pages each role has.

Most changes in Fathom are drafts, which wait for someone to approve them before they go live. A change of class isn't: it takes effect straight away, and it has no **Undo**. So it never shows on the **Drafts** page. It's recorded in the access history, marked as worth checking. See [Access history](access-history.md).

A new list or column that isn't approved yet is different. Its class is part of its draft, so changing it changes the draft. The access history records its class once the draft is approved.

## See What Each Class Holds

The page has up to three sections:

- **Built-in details** are the details Fathom has from the start, such as **Start date** and **Hiring plan**. **About** lists the pages, views and columns that need each one, and for **Hiring plan**, the parts of planned hires its class keeps from view.
- **Columns** are the columns your organization added to **People**. **About** says where each one shows, and the list it takes its class from, if it has one. You see this section if your role sees people.
- **Lists** are your organization's lists of choices. **About** names the columns on **People** that use each one. You see this section if your role sees configuration.

A column that picks from a list takes that list's class. So it has no **Change class…** of its own; you change its list's class instead.

## Change a Class

1. In the row, select **Change class…**.
1. Choose the class.
1. Select **Change**.

Every page follows the new class straight away. To go back, change the class again.

You can also change a class from a list's panel on the **Lists** page, and from an added column's menu on **People**.

You're done when the row shows the class you chose.

## When Change Class… Is Greyed Out

A line under it says why:

- **This role can't see** a class: your role doesn't see the class the data is in now, so it can't move it.
- **Being changed by** someone: they have unpublished changes to it. You can change its class once they publish or discard them.

In the dialog, you can't choose a class your role can't see, so data never moves out of sight of the people who keep it. A list that a column on **Features** uses stays **General**, since everyone who sees the plan sees those columns.

## Marks on the Page

- **A symbol before a class's name** shows the class: an open eye for **General**, an eye with a line through it for **Personal**, and a lock with a keyhole for **Confidential**.
- **The same symbol before a column's or list's name** gives its class, on **People** and **Lists**. Point at it to see the class's name. A **General** column or list has no symbol there.
