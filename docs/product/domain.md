# Fathom — Domain Concepts

**Status:** Draft
**Last updated:** 2026-11-03

The terms Fathom uses, defined so they fit any software organization, whatever its titles and practices. How an organization works with them, such as who leads what or how often it releases, is its own configuration. See also the [Product Brief](brief.md) and the [Decisions Log](decisions.md).

## Planning Terms

- **Project:** Work delivered to its customers, identified by its name and, optionally, a Project ID. A project's scope is the features it needs.
- **Proposal:** Work offered or requested that may become a project, such as a bid or a customer request, with the features it proposes.
- **Customer:** Who a project's work is for, external or internal.
- **Product:** What a feature is part of.
- **Feature:** The unit Fathom plans: a body of related work, sized in weeks to months of effort, that one feature team delivers. A feature is like an epic: it groups stories or tasks, which Fathom does not hold. What counts as one feature is set out in the [Decisions Log](decisions.md#planning).
- **Initiative:** A larger effort made of several related features, such as the increments of work too large for one cycle. Not built in; an organization that uses initiatives adds them as a column.
- **Milestone:** A dated point in a project or a feature.
- **Cycle:** A repeating planning period of a set length, such as six months, a quarter, or a program increment. Features target cycles.
- **Release:** A named delivery that includes one or more cycles, and ships the features that target them.
- **Release stream:** A sequence of releases with its own cycle length, such as major releases or patches.
- **Estimate:** A rough size of the effort a feature needs, not its cost, such as a rough order of magnitude (ROM) or a SWAG, given in a unit of effort such as hours or person-months.

## People Terms

- **Resource:** Anything that can be allocated to work, currently people and planned hires.
- **Planned hire:** A role to be filled, planned before anyone is hired for it, which is filled by a new or existing employee.
- **Team:** The people who report to a manager.
- **Manager flag:** Marks a person who can be named as others' manager. Not the People Manager role, which grants users access.
- **Feature team:** The people working on a set of related features. Membership is separate from reporting lines.
- **Feature lead:** The person who leads a feature team.

## Table Terms

- **Retired:** A retired choice or list stays on records that already have it, but is no longer offered for new ones, and can be restored.
- **View:** What a table shows: its search, filters, sort, which version of each record it shows, and its metrics.
- **Metrics:** Counts of a table's rows shown, broken down by the values of one column, or of two crossed, each with its share of those rows.
- **Draft row:** A row to be added, changed, or removed, waiting for an Approver to approve it, which makes it live, or reject it, which marks it Rejected, with a reason, until it is changed or discarded.
- **Live:** Approved, and so part of the plan everyone works from.
- **Saved view:** A view saved under a name, shared with everyone who sees the table, and applied again from the table's Views menu.
