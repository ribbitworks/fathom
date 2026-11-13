# Features

Features lists every feature the organization plans, one row each, grouped by the cycle it targets. A feature is a body of work that one feature team delivers, such as **Offline Sync**.

## Main Tasks

### Add a Feature

1. Select **New feature**.
1. Type the **Name**, and fill in anything else that is known.
1. Select **Add**.

To add one quickly, type its name in the empty row at the end of the table and press Enter.

### Change a Feature

1. Select a cell, then type, or press Enter, to change it.
1. Press Enter to save, or Esc to leave it as it was.

To work in a feature's details instead, point at its row and select the button at the right of its **Name** cell, or select **Show details** in its **⋯** menu. The details group its values under **Details**, **Customers and commitments**, **Planning** and **Columns**, in the order the table starts with. Each value there has a pencil that changes it.

### Plan When a Feature Ships

Choose a cycle in **Target cycle**. The feature moves under that cycle's heading once the view changes, and **Release** names the release the cycle is in.

### Give a Feature to a Team

Choose a team in **Feature team**.

### Give an Estimate

1. Type a number in **Effort**, in the unit the column shows.
1. To show another unit, open the **Effort** column's menu and choose one under **Show in**.

### Group the Table

1. Select **Group by**.
1. Choose **Cycle**, **Release**, **Needed by** or **None**.

### Export Features

1. Choose the **Export** button, the arrow down onto a line, at the right of the page's heading.
1. Choose **CSV file** or **TSV file**.
1. Choose where to save it, if the browser asks.

The file holds what the table shows: the rows the search and filters leave, in their order, and the columns in theirs. While drafts show beside live, each changed row comes as its draft and then its live row, and the **Row** column says which, so a spreadsheet's filter can leave out either; the **Change** column says what each draft does. The file is named after the page, the saved view, who exported it and the day, such as **fathom_features_product-manager_drafts-and-live_2027-03-31.csv**.

### Remove a Feature

Select **Remove feature** in the feature's **⋯** menu. Fathom refuses while a project or proposal names the feature. It also refuses once people are allocated to the feature, since that time was spent; choose a status that means Cancelled instead.

## Marks and Terms

- **Later** heads the features that target no cycle yet.
- **Not released yet** means the feature's cycle is in no release.
- **No team** marks a planned or in-progress feature that has no feature team yet.
- **Needed by** gives the month the feature is wanted. Type it as digits, such as 2027-03, and it shows as Mar 2027. It's a rough wish; **Target cycle** is the commitment.
- **Status** says how far along the feature is. The statuses are the organization's own, and each one means Possible, Planned, In progress, Done or Cancelled. A new feature starts on the first status that means Possible.
- **Projects** and **Proposals** name the projects that need the feature and the proposals that propose it. A change to them changes that project or proposal; the reason for removing a proposal is given afterwards, as [Projects](projects.md#give-a-reason-for-removing-a-feature-from-a-proposal) sets out.
- **Effort** gives the work the feature needs, such as 2.5 PD for person-days. Rest the pointer on it to see the hours.
- **Priority** says how much the feature matters to the organization, apart from its status, from **Critical** to **Low**.
- **Size** gives the feature's rough size before it's estimated, from **XS** to **XL**.
- **Risk** says how much could go wrong in building it, from **Low** to **High**.
- Priority, Size and Risk are optional, and their choices are the organization's own, kept on the **Lists** page.
- **Release** follows from **Target cycle**, so it can't be changed.

## Where Changes Go

Every change is a draft. It goes live once someone whose role approves features and releases approves it. See [Drafts](drafts.md).
