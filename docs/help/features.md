# Features

**Features** lists every planned feature, one row each. A feature is a body of work that one feature team delivers, such as **Offline Sync**.

## What to Know First

- **Schedules and cycles:** a schedule is a repeating set of cycles of a set length, such as **Platform**'s quarters. Its releases ship the features planned in its cycles. You set them up on [Releases](releases.md).
- **Target cycle:** the cycle a feature is planned to ship in. **Later** holds the features that don't target a cycle yet.
- **Feature team:** a group that works on features together, whoever its members report to.
- **Drafts:** every change you make here is a draft. Nobody else sees it until you select **Publish** in the top bar. A hollow dot marks a change you haven't published yet.
- **Approval:** a draft goes live once someone whose role approves features and releases approves it on the **Drafts** page.

See [Drafts](drafts.md) for more.

## Main Tasks

### Add a Feature

1. Select **New feature**.
1. Type the feature's **Name**.
1. Fill in anything else you know.
1. Select **Add**.

To add one quickly, type its name in the empty row at the end of the table, and press Enter. To add several, paste their names into the empty row, one to a line. If Fathom refuses one row, it adds none of them.

You're done when the feature shows in the table with a hollow dot.

### Change a Feature

1. Select the cell you want to change.
1. Start typing, or press Enter.
1. Press Enter to keep the change, or Esc to leave the value as it was.

You can also make changes in a feature's details, which open beside the table:

1. Point at the feature's row.
1. Select the details button: the small box at the right of its **Name** cell.
1. Select the value you want to change.

Instead of the details button, you can also right-click the row and select **Show details**.

The details group the values under **Details**, **Customers and commitments**, **Planning** and **Columns**, in the order the table starts with.

You're done when the changed value shows a hollow dot.

### Add a Customer, Project or Proposal From a Feature

1. Open the feature's details.
1. Select the pencil beside **Customers**, **Projects** or **Proposals**.
1. Type the new record's name.
1. Select **New customer**, **New project** or **New proposal** with the name, last in the list. When nothing matches what you typed, Enter does the same.
1. In the form that opens under the details, with the name filled in, select **Add**. A new project or proposal already names the feature.

You can start from the feature's cell in the table too: select it, press Enter and type the name. The form then opens beside the table.

**New** shows only if your role can change the plan, not only features.

You're done when the feature names the new record. A new customer has a hollow dot before it. A new project or proposal has no dot there, since its own draft is what names the feature.

### Plan When a Feature Ships

Choose a cycle in the feature's **Target cycle**.

**Release** then names the release that covers that cycle. While the table is grouped by cycle, the feature stays under its old heading, so rows don't jump as you work. It moves under the new cycle's heading the next time you change the view, such as a sort or a filter, or open the page again.

You're done when **Target cycle** shows the cycle, with a hollow dot.

### Give a Feature to a Team

Only a role that edits feature teams, such as the Feature Lead's or the Engineering Manager's, gives a feature to a team.

Choose a team in the feature's **Feature team**.

You're done when **Feature team** shows the team, with a hollow dot.

### Give an Estimate

An estimate is how much work the feature needs, in a unit such as person-days.

1. Type a number in the feature's **Effort**, in the unit the column shows.
1. To show another unit, open the **Effort** column's menu, and choose one under **Show in**.

Each unit says what it stands for, such as **Person-days (8 hours)**. The hours come from the [Planning settings](planning-settings.md#marks-and-terms).

You're done when **Effort** shows your estimate, with a hollow dot.

### Write a Note

**Notes** holds a note for each feature, with formatting such as bold and lists.

1. Select the feature's cell in the **Notes** column.
1. Press Enter. The note opens in a panel beside the table, or under the feature's details if they're open.
1. Write the note.
1. Select **Save**.

A note stays open when you reload the page. A link to the page opens it for anyone who can see it. Anything you typed but didn't save is lost when you reload.

If the note opens under the feature's details, select **Maximize**, the button with four corners at its top right, to give it the whole height.

You're done when the cell shows the start of your note.

See [People](people.md#write-a-note) for more.

### Add a Column

You can add your own columns to Features if your role edits features and sees people, as the Product Manager's does.

1. Select **New column**, at the right of the page's heading.
1. Type the column's **Name**.
1. Choose its **Type**: **Text**, **Number**, **Checkbox**, **Choice from a list**, **Web link** or **Note**. A **Text** column holds plain text, and a **Checkbox** column a tick box, for each feature. See [People](people.md#type-text) for typing text, and [People](people.md#tick-a-box) for ticking a box.
1. If you chose **Choice from a list**, choose a list. Only lists whose class is **General** are offered, since everyone who sees features sees these columns.
1. If the list you need isn't there, choose **New list**, last under **List**, instead. Give the list a name, then type each choice in the row that starts with **+** under **Choices**, pressing Enter after each, or paste several, one to a line. To take one out, select **Remove** in its **⋯** menu. The new list is approved with the column.
1. Select **Add column**.

You're done when the new column shows in the table, with a hollow dot until you publish it.

You can fill the new column's cells straight away, before it's approved. Approving a feature with a value in the column approves the column too. Whoever approves features, such as a Product Manager, approves their columns too, with any list made with **New list**.

### Count Features

1. Select **Metrics**. The **Metrics** panel opens beside the table.
1. Under **Break down by**, choose the column to count by, such as **Status**.
1. To count by two columns at once, choose the second under **and by**.
1. To add up a number column, choose it under **Measure**, which shows once you've chosen a column to count by. It starts on **Effort**; choose **Nothing** to leave it out.

The counts include every row the table shows, but not a feature drafted to be removed. So a search or a filter changes them. **Needed by** counts by each month, in date order. A feature with several projects or proposals adds its effort to each of them, so their totals can add up to more than **All features**. If the panel opens under a feature's details, select **Maximize** to give it the whole height.

A dot before a count marks a draft that changes it, as on [People](people.md#count-people).

You're done when the panel shows how many features hold each value of the column you chose, with each one's total, average and **None**, the count with no value.

### Group the Table

The table starts as one list. You can put the features under headings instead, such as one for each cycle.

1. Select **Group by**.
1. Choose **Cycle**, **Release**, **Needed by**, **Customers**, **Projects**, **Proposals**, a list such as **Status** or **Priority**, **Feature team**, or **Staffed**.
1. To group each heading's features again, such as each cycle's by status, select **Group by** again, and choose how under **Then by**.

A feature with several customers, projects or proposals shows under each of them. Each of its rows has a grey **+1**, or **+2** and on, after its name; point at it to see the other headings. A change in one row shows in the others, since they're the same feature.

To turn the headings round, select **Group by** again, and choose the second order after the groupings, such as **Latest first** for cycles or months, or **Reverse list order** for a list such as **Status**. **Later**, or the heading for none, such as **No date**, then comes first. The board's rows turn round too.

To show one list again, choose **Clear grouping**, at the end of the menu, or **None** under **Group by**.

The board shows only the first grouping. **Then by** comes back when you switch to the table.

You're done when the rows show under the headings you chose.

### See a Customer's Features

1. Select **Projects** in the sidebar, then the **Customers** tab.
1. Open the customer's **⋯** menu.
1. Select **Show all features**.

**Features** opens with a filter above the table named for the customer, such as **For Bluefin Harbour Authority**. It shows the features that name the customer, and those its projects need or its proposals propose. A filter on a column, such as **Status**, narrows them further. To see every feature again, select the **×** on the customer's filter.

You're done when the table shows the customer's features.

### See Features as a Board

The board starts with months side by side, from a year back to a year ahead at the least. Each feature has a card in the month it's needed by, even a month that has passed.

- A feature needed more than a year back isn't on the board.
- **No date** is the board's last column.
- The month you opened it on is the second column, so the month before it stays in view. This month's heading is underlined in red.

The board, its count, **Metrics** and **Export** all leave out features that are done or cancelled. To see and count them too, open **Views** and choose **Show done and cancelled**.

You can show only one schedule's features by months, or that schedule's cycles instead, with a card for each feature in the cycle it targets, and **Later** last.

1. Choose **Board** beside the **Features** heading.
1. To see only one schedule's features by months, select **Columns**, and choose the schedule under **Months**, such as **Platform**. Choose **All schedules** to see every feature again.
1. To see a schedule's cycles, select **Columns**, and choose the schedule under **A schedule's cycles**. Choose **All schedules** under **Months** to go back.
1. To see other months or cycles, select **‹** or **›**, or one in the row above the board. By months, the row names quarters, such as **Q1 2027**, and **‹** and **›** step a quarter, while by cycles, it names each cycle.
1. To go back to this month or the current cycle, select **Today**. The period in the row above the board that holds the month or cycle you went to is filled in blue.
1. To choose what the cards show, select **Card**, and tick or untick each part.
1. To put the cards in rows, select **Group by**, and choose how, such as **Feature team**. Grouped by **Projects**, a feature two projects need has a card in each project's row.

While **Staffed months** is ticked under **Card**, a card that says **Not staffed** in red is planned or in progress, but nobody is allocated to it yet. Select a card to see the feature's details.

The search, the **Draft** menu and **Metrics** work on the board as they do on the table. So does **Views**: the table and the board share one view, and a saved view keeps the board's columns and what its cards show.

On the board, **Views** doesn't offer the sort, units, or hidden, frozen, moved or widened columns, since the board orders its own cards and has no columns to lay out. They come back when you switch to the table. See [Saved views](saved-views.md).

You're done when the board shows the months or cycles you want.

### Export Features

Exporting saves the table as a file you can open in a spreadsheet.

1. Select the **Export** button at the right of the page's heading. Its icon is an arrow pointing down to a line.
1. Choose **CSV file** or **TSV file**.
1. Choose where to save it, if your browser asks.

The file holds what the table shows, and is named after the page, such as **fathom_features_product-manager_drafts-and-live_2027-03-31.csv**. You're done when the file is saved.

See [People](people.md#export-people) for what the file holds.

### Remove a Feature

1. Open the feature's **⋯** menu.
1. Select **Remove feature**.

While a project or proposal names a feature, **Remove feature** is greyed out, with a line under it naming the first of them and counting the rest, such as "P-2017 Depot Operations names this feature." Take the feature off that record first.

Once people are allocated to a feature, **Remove feature** is greyed out too, since that time was spent. Choose a status that means Cancelled instead.

You're done when the row is struck through. It's removed once the removal is approved.

## Marks and Terms

- **Later** heads the features that target no cycle yet.
- **Not released yet**, after a schedule's name, such as **Platform: Not released yet**, means the feature's cycle isn't in any release.
- **No feature team**, in red in the **Feature team** cell, marks a planned or in-progress feature that has no feature team yet.
- **Needed by** is the month the feature is wanted. Type it as digits, such as `2027-03`, and it shows as Mar 2027. It's a rough wish; **Target cycle** is the commitment.
- **Status** says how far along the feature is. Statuses are named on the **Lists** page, and each one means Possible, Planned, In progress, Done or Cancelled. A new feature starts on the first status that means Possible.
- **Feature team** is changed only if your role edits feature teams, as the Feature Lead's does.
- **Customers**, **Projects** and **Proposals** are changed only if your role edits the plan, as the Product Manager's does. **Projects** and **Proposals** name the projects that need the feature, and the proposals that propose it.
- Changing **Projects** or **Proposals** changes that project or proposal, as a draft. One a draft adds has a dot before it, and one it takes away has the dot and is struck through, in the table and in the feature's details.
- If you take a feature off a proposal, you give the reason on the proposal. See [Projects](projects.md#give-a-reason-for-removing-a-feature-from-a-proposal).
- **Effort** is the work the feature needs, such as 2.5 PD for person-days. Point at it to see the hours.
- **Priority** says how much the feature matters, apart from its status, from **Critical** to **Low**.
- **Size** is the feature's rough size before it's estimated, from **XS** to **XL**.
- **Risk** says how much could go wrong in building it, from **Low** to **High**.
- **Priority**, **Size** and **Risk** are optional. Their choices are kept on the **Lists** page.
- **Release** follows from **Target cycle**, so you can't change it.
- **Staffed** says **Yes** when someone is allocated to a planned or in-progress feature, and **No** when nobody is. It's empty for other features.
- Fathom works out **Staffed** from the allocations, so you can't change it. To find features nobody is on, filter **Staffed** to **No**.
