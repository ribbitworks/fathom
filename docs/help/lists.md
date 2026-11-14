# Lists

Lists holds the lists of choices that columns offer, such as **Sites** or **Levels**. A column on People or Features picks from one list, and one list can feed several columns.

## Main Tasks

### Make a List

1. Select **New list**.
1. Type the **Name**, and a **Description** if it helps.
1. If the role may classify data, choose its **Class** too: **General**, or **Personal** or **Confidential** for values only roles that see that class may see. Other roles make General lists.
1. Select **Create list**.

### Add Choices

1. Select the list's name. Its choices open in a panel beside the table.
1. In the empty row at the end, starting with **+**, type the choice's **Name**, and a **Description** if it helps.
1. Press Enter, and type the next one.

To add many at once, paste lines into the empty row, one choice per line. A tab on a line starts its description.

In **Feature sizes**, type each size's **Weight** too, such as 2.5. Pasted lines all take the weight typed in the empty row.

### Change a Choice

Select the choice, or select **Edit** in its **⋯** menu. Press Enter to save, or Esc to leave it as it was.

### Put the Choices in Order

Drag a choice by its handle, or use **Move up**, **Move down**, **Move to top** or **Move to bottom** in its **⋯** menu. Columns offer the choices in this order.

### Retire or Remove a Choice

Select **Retire** or **Remove** in the choice's **⋯** menu. A retired choice stays on the records that hold it, but is no longer offered. **Show retired** lists them, and **Restore** in a choice's menu brings it back. Remove is only for a choice nothing uses.

### Change, Retire or Delete a List

Select **Edit list** in the list's panel. Change the name or description, and select **Save**. **Retire list** and **Remove list** are at the foot. A list can't be retired or removed while a column uses it.

### Change a List's Class

For a role that may classify data, select **Change class…** in the list's panel, choose the class, and select **Change**. The change takes effect at once, with no draft, and is recorded in the access history. A class the role can't see can't be chosen, and a list a column on Features uses stays **General**. Every list's class is also on the **Data classes** page.

### Find a List

- Type in **Search lists**.
- Choose **All**, **Built in** or **Custom** in the switch beside it. With **All**, the built-in lists come first, then your own.

## Marks and Terms

- **Built in** marks a list Fathom needs, such as **Positions** or **Hiring states**. It can't be retired or removed, but its choices are the organization's own.
- **A meaning**, such as **Proposed** or **Open**, ends each choice in a list with meanings. Fathom acts on the meaning and shows the choice's name. Choose the meaning when adding or changing the choice.
- **A weight**, such as **2**, ends each choice in **Feature sizes**: how many of the size S it counts as.
- **Needed for** and a meaning, under a choice's greyed-out **Retire** and **Remove**, means it's the last choice with that meaning, so it stays. A list's name and **needs a choice**, such as **Positions needs a choice**, says the same for a list that must keep one.
- **Retired**, in a yellow box, marks a list or choice drafted to be retired.
- **A lock with Personal or Confidential**, in a grey box after a list's name, gives its class: only roles that see that class see the values picked from it. A General list has none.

## Where Changes Go

Every change to a list or its choices is a draft, apart from changing its class. It goes live once someone whose role approves configuration approves it. See [Drafts](drafts.md).
