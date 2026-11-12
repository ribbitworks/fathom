# Data Classes

Data classes shows the class of everything Fathom keeps in one, and changes it. A class decides who sees the data: **General** data is seen by everyone whose role reaches the page that holds it, **Personal** data, people's private and HR details, only by roles that see Personal data, and **Confidential** data, business data not yet announced, only by roles that see Confidential data. Roles that may classify data see the page, under **Administration**.

## Main Tasks

### See What Each Class Holds

The page has three sections:

- **Built-in details**, such as **Start date** or **Hiring plan**, each with the pages, views and columns that need it. A page or view that needs a detail opens only for roles that see its class.
- **Columns** added to People. A column that picks from a list takes that list's class.
- **Lists**, each with People's columns that use it.

### Change a Class

1. Select **Change class…** on the row.
1. Choose the class, then select **Change**.

The change takes effect at once, with no draft and no Undo, and every page follows it. It's recorded in the access history and marked worth checking. To go back, change the class again. A class the role can't see can't be chosen, so data is never moved out of sight of those who keep it.

Change class… is also in a list's panel on the Lists page and in an added column's menu on People.

## Marks and Terms

- **A lock with Personal or Confidential**, in a grey box, gives the class of a column or list beyond General, on this page, after a column's heading, and after a list's name.
- **Change class…** greyed out, with a line under it, says why the class can't change now: the role can't see the data's class, or someone else has unpublished changes to it.
- **A column on Features draws on this list, so it stays General** greys out Personal and Confidential for a list a column on Features uses, since everyone who sees the plan sees those columns.
