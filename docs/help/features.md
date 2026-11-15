# Features

**Features** lists every planned feature, one row each, grouped by the cycle it targets. A feature is a body of work that one feature team delivers, such as **Offline Sync**.

## What to Know First

- **Release streams and cycles:** a release stream is a line of releases, such as **Platform**. Its work is planned in cycles of a set length, such as quarters. You set them up on [Releases](releases.md).
- **Target cycle:** the cycle a feature is planned to ship in. **Later** holds the features that don't target a cycle yet.
- **Feature team:** a group that works on features together, whoever its members report to.
- **Drafts:** every change you make here is a draft. Nobody else sees it until you select **Publish** in the top bar. It goes live once someone whose role approves features and releases approves it on the **Drafts** page. A hollow dot marks a change you haven't published yet.

See [Drafts](drafts.md) for more.

## Main Tasks

### Add a Feature

1. Select **New feature**.
1. Type the feature's **Name**.
1. Fill in anything else you know.
1. Select **Add**.

To add one quickly, type its name in the empty row at the end of the table, and press Enter.

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

### Plan When a Feature Ships

Choose a cycle in the feature's **Target cycle**.

**Release** then names the release that covers that cycle. Once the view changes, the feature moves under that cycle's heading.

You're done when **Target cycle** shows the cycle, with a hollow dot.

### Give a Feature to a Team

Choose a team in the feature's **Feature team**.

You're done when **Feature team** shows the team, with a hollow dot.

### Give an Estimate

An estimate is how much work the feature needs, in a unit such as person-days.

1. Type a number in the feature's **Effort**, in the unit the column shows.
1. To show another unit, open the **Effort** column's menu, and choose one under **Show in**.

Each unit says what it stands for, such as **Person-days (8 hours)**. The hours come from the planning settings on [Capacity](capacity.md#in-settings).

You're done when **Effort** shows your estimate, with a hollow dot.

### Group the Table

1. Select **Group by**.
1. Choose **Cycle**, **Release**, **Needed by**, a list such as **Status** or **Priority**, **Feature team**, **Staffed**, or **None**.

### See Features as a Board

The board shows one release stream's cycles side by side, with a card for each feature in the cycle it targets. **Later** is its last column.

1. Choose **Board** beside the **Features** heading.
1. To see another stream, select **Stream**, and choose one.
1. To see other cycles, select **‹** or **›**, or a cycle in the row of cycles.
1. To go back to the current cycle, select **Today**.
1. To choose what the cards show, select **Card**, and tick or untick each part.
1. To put the cards in rows, select **Group by**, and choose how, such as **Feature team**.

While **Staffed months** is ticked under **Card**, a card marked **Not staffed** is planned or in progress, but nobody is allocated to it yet. Select a card to see the feature's details. The search, the **Draft** menu and **Metrics** work on the board as they do on the table. So does **Views**: the table and the board share one view, and a saved view keeps the board's stream and what its cards show. See [Saved views](saved-views.md).

You're done when the board shows the stream and cycles you want.

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

Fathom won't remove a feature while a project or proposal names it. It also won't once people are allocated to it, since that time was spent. Choose a status that means Cancelled instead.

You're done when the row is struck through. It's removed once the removal is approved.

## Marks and Terms

- **Later** heads the features that target no cycle yet.
- **Not released yet**, after a stream's name, such as **Platform: Not released yet**, means the feature's cycle isn't in any release.
- **No team** marks a planned or in-progress feature that has no feature team yet.
- **Needed by** is the month the feature is wanted. Type it as digits, such as `2027-03`, and it shows as Mar 2027. It's a rough wish; **Target cycle** is the commitment.
- **Status** says how far along the feature is. Statuses are named on the **Lists** page, and each one means Possible, Planned, In progress, Done or Cancelled. A new feature starts on the first status that means Possible.
- **Projects** and **Proposals** name the projects that need the feature, and the proposals that propose it. Changing them changes that project or proposal. If you take a feature off a proposal, you give the reason on the proposal; see [Projects](projects.md#give-a-reason-for-removing-a-feature-from-a-proposal).
- **Effort** is the work the feature needs, such as 2.5 PD for person-days. Point at it to see the hours.
- **Priority** says how much the feature matters, apart from its status, from **Critical** to **Low**.
- **Size** is the feature's rough size before it's estimated, from **XS** to **XL**.
- **Risk** says how much could go wrong in building it, from **Low** to **High**.
- **Priority**, **Size** and **Risk** are optional. Their choices are kept on the **Lists** page.
- **Release** follows from **Target cycle**, so you can't change it.
- **Staffed** says **Yes** when someone is allocated to a planned or in-progress feature, and **No** when nobody is. It's empty for other features. Fathom works it out from the allocations, so you can't change it. To find features nobody is on, filter **Staffed** to **No**.
