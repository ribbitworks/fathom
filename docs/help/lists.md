# Lists

**Lists** holds the lists of choices that columns offer, such as **Sites** or **Levels**. A column on **People** or **Features** picks its values from one list, so everyone's values are spelled the same way. One list can feed several columns.

## What to Know First

- **Choices:** the values in a list, such as each site's name. Each choice can have a description.
- **Built-in lists:** lists Fathom needs, such as **Positions** and **Hiring states**. They're marked **Built in**, and you can't retire or remove them, but their choices can be changed.
- **Meanings:** in some lists, each choice has a meaning that Fathom acts on, such as **Proposed** or **Open**. Fathom shows the choice's own name, so you can call it whatever you like.
- **Classes:** each list has a class, which decides who sees the values picked from it. A list is **General**, seen by everyone, unless its values are private.
- **Drafts:** every change to a list or its choices is a draft, apart from a change of class. Nobody else sees it until you select **Publish** in the top bar. It goes live once someone whose role approves configuration approves it.

See [Drafts](drafts.md) for more.

## Main Tasks

### Make a List

1. Select **New list**.
1. Type the list's **Name**.
1. Type a **Description**, if it helps.
1. If your role may classify data, choose its **Class**: **Personal** or **Confidential** if its values are private, or **General**.
1. Select **Create list**.

If your role can't classify data, the list is **General**.

You're done when the list shows in the table, with a hollow dot until you publish it. Select **Publish** when you're ready.

### Add Choices

1. Select the list's name. Its choices open in a panel beside the table.
1. In the empty row at the end, which starts with **+**, type the choice's **Name**.
1. Type a **Description**, if it helps.
1. Press Enter.
1. Type the next choice the same way.

To add many at once, paste lines into the empty row, one choice per line. A tab on a line starts its description.

In **Feature sizes**, also type each size's **Weight**, such as `2.5`. Pasted lines all take the weight typed in the empty row, and the meaning chosen there, in a list with meanings.

You're done when the panel lists your choices, each with a hollow dot until you publish them. Select **Publish** when you're ready.

### Change a Choice

1. Select the choice, or select **Edit** in its **⋯** menu.
1. Make your change.
1. Press Enter to keep it, or Esc to leave the choice as it was.

You're done when the choice shows a hollow dot.

### Put the Choices in Order

Columns offer the choices in the order the list has them. To move a choice, drag it by its handle. You can also use **Move up**, **Move down**, **Move to top** or **Move to bottom** in its **⋯** menu.

You're done when the choice is where you want it.

### Retire or Remove a Choice

A retired choice stays on the records that hold it, but columns no longer offer it. Removing a choice deletes it, so Fathom refuses to remove a choice that's in use.

1. Open the choice's **⋯** menu.
1. Select **Retire** or **Remove**.

To see retired choices, select **Show retired**. To bring one back, select **Restore** in its menu.

You're done when the choice shows a **Retired** box, or is struck through.

### Change, Retire or Remove a List

To change a list's name or description:

1. In the list's panel, select **Edit list**.
1. Change the name or the description.
1. Select **Save**.

To retire or remove a list:

1. In the list's panel, select **Edit list**.
1. At the foot of the dialog, select **Retire list** or **Remove list**.

Fathom refuses to retire or remove a list while a column uses it. A retired list's dialog has **Restore list** in the same place, to bring it back.

You're done when the list shows your change: a hollow dot, a **Retired** box, or its name struck through.

### Change a List's Class

You can do this if your role may classify data.

1. In the list's panel, select **Change class…**.
1. Choose the class.
1. Select **Change**.

On an approved list, the change takes effect straight away, with no draft, and it's recorded in the access history. On a new list that isn't approved yet, it changes the list's draft instead, just as choosing its **Class** in **Edit list** does, and you can undo it. You can't choose a class your role can't see. A list that a column on **Features** uses stays **General**. You can also change an approved list's class on the **Data classes** page.

You're done when the list's name shows its new class.

See [Data classes](data-classes.md) for more.

### Find a List

- Type in **Search lists**.
- To see only some lists, choose **All**, **Built in** or **Custom** in the switch beside it. With **All**, the built-in lists come first, then your own.

## Marks and Terms

- **Built in** marks a list Fathom needs.
- **A meaning**, such as **Proposed** or **Open**, ends each choice in a list with meanings. Choose the meaning when you add or change the choice.
- **A weight**, such as **2**, ends each choice in **Feature sizes**. It's how many of size S the size counts as.
- **Needed for** and a meaning, under a choice's greyed-out **Retire** and **Remove**, means it's the last choice with that meaning, so it has to stay.
- **Needs a choice**, after a list's name, such as **Positions needs a choice**, says the same for a list that must keep at least one.
- **Retired**, in a yellow box, marks a list or choice drafted to be retired.
- **An eye with a line through it** before a list's name means its class is **Personal**, and **a lock with a keyhole** means **Confidential**. Point at it to see the class. A **General** list has none.
