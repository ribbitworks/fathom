---
title: "Domain Concepts"
category: "Domain"
audience: "Contributors"
applies_to: ["**/*"]
dependencies: ["docs/design/domain-model.md"]
last_updated: "2026-11-23"
---

# Fathom: Domain Concepts

The terms Fathom uses, defined so they fit any software organization, whatever its titles and practices. How an organization works with them, such as who leads what or how often it releases, is its own configuration. See also the [Product Brief](brief.md), and the [Domain Model](../design/domain-model.md) for the rules that hold for each entity.

## Planning Terms

- **Project:** Work delivered to its customers, identified by its name and, optionally, a Project ID. A project's scope is the features it needs. A project with no customers is internal; nothing marks it.
- **Proposal:** Work offered or requested that may become a project, such as a bid or a customer request, with the features it proposes.
- **Customer:** Who a project's or proposal's work is for.
- **Product:** What a feature is part of.
- **Feature:** The unit Fathom plans: a body of related work, sized in weeks to months of effort, that one feature team delivers. A feature is like an epic: it groups stories or tasks, which Fathom does not hold. Fathom has one roadmap of features.
  - **One feature:** any planned work, a set of bug fixes included, which a column users add can mark as another kind. Work spanning several cycles is one feature, targeting the cycle it is delivered in, with its earlier work shown by its allocations' months; Fathom has no rule that large work is split. Work on a branch or behind a feature flag is one feature, shipping in the release where it is turned on.
  - **Not one feature:** a variation for another customer is a separate feature. Standing work, such as DevOps, has no record of its own: its features have milestones of their own, or those of a project made for it.
  - **Confidence:** needs no field. How likely a feature is comes from its status, such as Long shot, Maybe or Likely, each meaning Possible, and how firm its timing is from whether it rests on a Size, an estimate, or allocations.
- **Initiative:** A larger effort made of several related features, such as parts an organization chooses to split a large feature into. Not built in; an organization that uses initiatives adds them as a column.
- **Milestone:** A dated point in a project or a feature.
- **Activity:** Work a project or a release needs that isn't a feature, such as data migration or release testing. People are allocated to it as they are to a feature, and it ends with its project or release.
- **Needed by:** The month a feature is wanted by: a rough wish, apart from its target cycle, which is the commitment.
- **Cycle:** A repeating planning period of a set length, such as six months, a quarter, or a program increment. Features target cycles.
- **Release:** A named delivery that includes one or more cycles, and ships the features that target them.
- **Schedule:** A repeating set of cycles with its own cycle length, such as major releases or patches, with releases only where it ships them, since not everything is released.
- **Roadmap:** Intent: the features wanted and roughly when, before anything is costed, shown on the Features page's Board. A feature starts on the Roadmap, as a Possible feature, joins the Plan once it is staffed, and stays on the Roadmap.
- **Plan:** What is staffed: the features with their estimates, allocations, months, and capacity, shown in the Capacity page's Work tab, not built yet. Written with a capital P, apart from the plan Approve Plan approves. Neither the Roadmap nor the Plan holds tasks, sprints, story points, or workflow columns.
- **Late:** Said of a feature forecast to finish after the end of its Needed by month, or, with no Needed by, after the end of its target cycle. A feature with neither is never Late. Not built yet.
- **Estimate:** A rough size of the effort a feature needs, not its cost, such as a rough order of magnitude (ROM) or a SWAG, given in a unit of effort such as hours or person-months.
- **Effort:** Work at full efficiency: a person-day of effort is the hours a working day converts to, not a day on the calendar. Duration, which takes in loading and time off, is apart.
- **Planning settings:** The figures for the whole organization that capacity and forecasts are worked out with: the working time a unit of effort stands for, focus, buffer, and ramp-up.
- **Focus:** The share of a person's time that goes to feature work at all, after meetings, support and other overhead.
- **Buffer:** A percentage added to a feature's effort before forecasting, for what the estimate leaves out. The estimate itself stays as given.
- **Ramp-up:** The share of full output a new starter delivers in each of their first months.

## People Terms

- **Resource:** Anything that can be allocated to work, currently people and planned hires.
- **Planned hire:** A role to be filled, planned before anyone is hired for it, which is filled by a new or existing employee.
- **Requisition:** The ID an organization's HR system gives an opening to be filled. A planned hire's ID is its requisition, or a temporary ID until it has one.
- **Hiring plan:** The planned hires not yet filled, seen as rows of [People](../design/pages/people.md).
- **List with meanings:** A list whose choices are the organization's own, each tied to one of a fixed set of meanings Fathom acts on, such as the hiring states, each meaning Proposed, Open, Hired, or Left, and the feature statuses.
- **Team:** The people who report to a manager.
- **Manager flag:** Marks a person who can be named as others' manager. Not the Engineering Manager role, which grants users access.
- **Feature team:** The people working on a set of related features. Membership is separate from reporting lines.
- **Feature lead:** The person who leads a feature team.
- **Disbanded:** Said of a feature team from the first month in which none of its members are on it, then or later.
- **Dated:** Said of a value kept from a date and in force until its next one, such as a person's manager. Shown on screen as Changes over time.

## Table Terms

- **Key:** A record's short name in Fathom, the word for its kind, a hyphen and a number, shown after a #, such as #FEATURE-123, which a link to the record names. It is Fathom's, apart from an organization's own IDs, such as a Project ID.
- **Retired:** A retired choice or list stays on records that already have it, but is no longer offered for new ones, and can be restored.
- **View:** What a table shows: its search, filters, sort, grouping, which version of each record it shows, its metrics, which of its first columns are frozen, staying in view while the rest scroll sideways, the order of its columns, which are hidden, the widths set for them, the units and decimal places they are shown in, and any of the page's own choices of which records show, such as Show retired.
- **Metrics:** Counts of a table's rows shown, broken down by the values of one column, or of two crossed, each with its share of those rows.
- **Draft row:** A row to be added, changed, or removed, waiting for an Approver to approve it, which makes it live, or reject it, which marks it Rejected, with a reason, until it is changed or discarded.
- **Live:** Approved, and so part of the plan everyone works from.
- **Approver:** Anyone whose role lets them approve drafts of that data. Not a role of its own.
- **Saved view:** A view of one table saved under a name, personal to the user who saved it or shared with everyone who opens the table's page, and applied again from the table's Views menu.
- **Last view:** The view an account last showed on a page, which the page shows again when opened from the menu.

## Access Terms

- **Role:** A set of permissions, as [Roles](roles.md) sets out. An account holds one or more.
- **Default role:** The one of an account's roles it acts as when it signs in on a browser where it has not chosen another.
- **Acting role:** The one role a session acts as, whose permissions alone apply: the role last chosen on that browser, or else the default, until the user switches to another they hold, as [Roles](roles.md) sets out.
- **Data class:** How sensitive a piece of data is, which roles grant access to. Every piece of data has one: General, seen by anyone whose role reaches its page; Personal, people's private and HR details; or Confidential, business data not yet announced, about the organization rather than one person.
