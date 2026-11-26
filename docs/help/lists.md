# Lists

**Lists** holds the lists of choices that columns offer, such as **Sites** or **Levels**. A column on **People** or **Features** picks its values from one list, so everyone's values are spelled the same way. One list can feed several columns.

## What to Know First

- **Choices:** the values in a list, such as each site's name. Each choice can have a description.
- **Built-in lists:** lists Fathom needs, such as **Positions** and **Hiring states**. They're marked **Built in**, and you can't retire or remove them, but their choices can be changed.
- **Meanings:** in some lists, each choice has a meaning that Fathom acts on, such as **Proposed** or **Open**. Fathom shows the choice's own name, so you can call it whatever you like.
- **Classes:** each list has a class, which decides who sees the values picked from it. A list is **General**, seen by everyone, unless its values are private. Only a role that sees a list's class can change the list or approve its drafts; for any other role, the list's panel is read only and says why.
- **Drafts:** every change to a list or its choices is a draft, apart from a change of class. Nobody else sees it until you select **Publish** in the top bar. It goes live once someone whose role approves configuration approves it. A list made with **New list** in a column's dialog on **Features** or **Activities**, with any choice added to it before it's approved, is approved by whoever approves features instead.

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

1. Point at the list's row.
1. Select the details button: the small box at the right of its **Name** cell. Its choices open in a panel beside the table.
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

To rename a list:

1. Double-click its name in the table, or select it and press Enter.
1. Type the new name.
1. Press Enter to keep it, or Esc to leave the name as it was.

To change its description, select **Edit list…** in the list's panel, change the description, and select **Save**.

To retire or remove a list:

1. Open the list's **⋯** menu. It shows when you point at the list's row.
1. Select **Retire** or **Remove list**.

You can also select **Retire list** or **Remove list** at the foot of the **Edit list** dialog. Fathom refuses to retire or remove a list while a column uses it. **Used by** names the approved columns that use it; a column that's still a draft counts too. To bring a retired list back, select **Show retired** in the **Views** menu, then **Restore** in the list's menu.

You're done when the list shows your change: a hollow dot, a **Retired** box, or its name struck through.

### Change a List's Class

You can do this if your role may classify data.

1. In the list's panel, select **Change class…**.
1. Choose the class.
1. Select **Change**.

On an approved list, the change takes effect straight away, with no draft, and it's recorded in the access history. On a new list that isn't approved yet, it changes the list's draft instead, just as choosing its **Class** in **Edit list** does, and you can undo it.

You can't choose a class your role can't see. A list that a column on **Features** uses stays **General**. You can also change an approved list's class on the **Data classes** page.

You're done when the list's name shows its new class.

See [Data classes](data-classes.md) for more.

### Find a List

- Type in **Search lists**. It finds a list by anything its row shows, such as its name, its choices or a column that uses it.
- To see only some lists, choose **All**, **Built in** or **Custom** beside the page's title. With **All**, the built-in lists come first, then your own.
- To narrow the table further, use **Filter**. For example, filter **Used by** to **Empty** to find the lists no column uses, or **Choices** to **Empty** for those with no choices yet.
- To see retired lists, select **Show retired** in the **Views** menu.
- To come back to the same lists later, save the view from the **Views** menu.

See [Saved views](saved-views.md) for more.

### Export the Lists

Exporting saves the table of lists as a file you can open in a spreadsheet.

1. Select the **Export** button at the right of the page's heading. Its icon is an arrow pointing down to a line.
1. Choose **CSV file** or **TSV file**.
1. Choose where to save it, if your browser asks.

The file holds the lists the table shows, with their choices and the columns that use them. You're done when the file is saved.

See [People](people.md#export-people) for what the file holds.

## Marks and Terms

- **Built in** marks a list Fathom needs.
- **Used by** names each column that picks from a list, by its page and name, such as **People: Site**. Point at a cell cut short to see them all.
- **A meaning**, such as **Proposed** or **Open**, ends each choice in a list with meanings. Choose the meaning when you add or change the choice.
- **A weight**, such as **2**, ends each choice in **Feature sizes**. It's how many of size S the size counts as.
- **Needed for** and a meaning, under a choice's greyed-out **Retire** and **Remove**, means it's the last choice with that meaning, so it has to stay.
- **Needs a choice**, after a list's name, such as **Positions needs a choice**, says the same for a list that must keep at least one.
- **Retired**, in a yellow box, marks a list or choice drafted to be retired.
- **An eye with a line through it** before a list's name means its class is **Personal**, and **a lock with a keyhole** means **Confidential**. Point at it to see the class. A **General** list has none.
