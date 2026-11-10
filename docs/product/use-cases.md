# Fathom — Use Cases

**Status:** Draft
**Last updated:** 2026-11-09

The core scenarios Fathom must support in v1, derived from the [Product Brief](brief.md) and the [Decisions Log](decisions.md). Each use case names the main actor, their goal, and the outcome. Steps and detail are added when each feature is designed.

## Planning Work

### Plan a Project

- **Actor:** Project Manager
- **Goal:** Put a new project on the plan, with its owner, the features it needs, and its milestones, such as customer delivery dates.
- **Outcome:** Once approved, the project appears on the timeline and the roadmap.

### Track a Proposal

- **Actor:** Project Manager
- **Goal:** Record a bid or customer request with the features it proposes, and keep its status up to date.
- **Outcome:** Its features count toward the forecast by their own status. Once it is Lost or Withdrawn, Fathom warns about features that no project and no open proposal needs.

A proposal starts Open, and its status is one of the built-in Proposal statuses, whose choices can be changed, with no rules tied to them, so any status may follow any other, as the [Decisions Log](decisions.md#planning) sets out. Each change is a draft that needs [approval](decisions.md#planning). A project links to one or more proposals. No project is made from a proposal, and nothing marks a proposal Won.

```mermaid
flowchart TD
    open[Proposal, status Open] -->|status changed| draft[Draft, waiting for approval]
    draft -->|approved| status[New status: Open, Won, Lost, Withdrawn, or the organization's own]
    draft -->|rejected| rejected[Rejected, back with its makers]
    status -->|status changed| draft
    status -->|Lost or Withdrawn| warn[Warning on features nothing else needs]
```

### Shape the Roadmap

- **Actor:** Product Manager
- **Goal:** Add the features that may come, with rough estimates, prioritize them, and target them at cycles.
- **Outcome:** Once approved, the roadmap shows what may come in each cycle, and whether it fits the capacity available.

### Assign People to Work

- **Actor:** Engineering Manager
- **Goal:** Staff a project or feature for the coming months, using current staff or planned hires and a monthly allocation percentage.
- **Outcome:** The assignments are saved as drafts, one for each person's work on each feature, for an Approver to approve. Fathom warns when someone has more than two assignments in a month, and refuses allocations outside a person's employment dates to those who see the dates; the Approver is told of the rest.

### Resolve Over-Allocation

- **Actor:** Engineering Manager
- **Goal:** Find people who are over- or under-allocated, and adjust allocations or timing.
- **Outcome:** The team's plan is realistic.

### Reschedule Work

- **Actor:** Project Manager
- **Goal:** Move a feature to another cycle, or a milestone to a new date.
- **Outcome:** The new timing is saved as a draft row.

### Approve Plan Changes

- **Actors:** An editor, and a user with the approver role
- **Goal:** Make sure changes are approved before they reach the live plan.
- **Outcome:** Approved draft rows become part of the live plan, and rejected ones stay as drafts with the reason, as the [Decisions Log](decisions.md#planning) sets out.

## Planning the Workforce

### Maintain Employee Records

- **Actor:** Engineering Operations Manager
- **Goal:** Keep Fathom's copy of employee details from the company's HR system current, including teams, managers, and end dates.
- **Outcome:** People can be planned for. People who leave are kept, with their end date, rather than deleted.

Details are typed or pasted into People, changed in a person's details beside People or the org chart, or [imported](decisions.md#people-and-privacy) from a file:

```mermaid
flowchart TD
    export[Save people as a CSV or TSV file] --> headers[Rename headers to People's column names]
    headers --> choose[Choose the file on People]
    choose --> check{Any problems?}
    check -- Yes --> fix[Fix the rows and columns listed] --> choose
    check -- No --> preview[See how many people are added and changed]
    preview --> import[Import: unpublished drafts]
    import --> publish[Publish] --> approve[An Approver approves or rejects]
```

### Plan a Hire

- **Actor:** Engineering Operations Manager
- **Goal:** Plan a role that needs to be filled, with its target date, and track it through the hiring states.
- **Outcome:** The planned hire appears in the plan and can be allocated to work. When the role is filled, the new hire takes over its allocations.

### Maintain Feature Teams

- **Actors:** Engineering Managers, with an Approver, such as the Engineering Director, approving
- **Goal:** Keep feature teams, their members, and their feature leads current.
- **Outcome:** Once approved, each feature has a feature team that owns and delivers it.

### Evaluate Team Composition

- **Actor:** To be confirmed
- **Goal:** Check teams and feature teams for balance, such as test-to-development ratios and reports per manager compared with a target.
- **Outcome:** Imbalances are visible and can be addressed in the plan.

### Plan a Reporting Change

- **Actor:** Engineering Operations Manager
- **Goal:** Plan a future change in who reports to whom, such as a reorg.
- **Outcome:** The change takes effect on its planned date.

## Viewing the Plan

### See the Organization

- **Actors:** Users, according to their role
- **Goal:** Understand who works for the organization, who is planned to be hired, who reports to whom, and what everyone is working on.
- **Outcome:** The user sees current staff and planned hires in the people view and the org chart, limited to what their role allows.

### Review the Roadmap

- **Actor:** Executive
- **Goal:** See where the roadmap stands without asking for a status deck.
- **Outcome:** The Executive has a current view of the roadmap by cycle and release.

### Export the Plan

- **Actors:** Users, according to their role
- **Goal:** Share the plan or roadmap outside Fathom.
- **Outcome:** The export contains only what the user's roles allow, in one of the formats in the Decisions Log.

### View an Earlier Snapshot

- **Actors:** Users, according to their role (to be confirmed)
- **Goal:** See what the plan looked like at an earlier point in time, from a snapshot taken manually or on a schedule.
- **Outcome:** The user can view the plan as it was when the snapshot was taken.

## Running Fathom

### Manage Users and Roles

- **Actor:** Fathom Administrator, a persona in the [Product Brief](brief.md#users), with the Administrator role in [Roles](roles.md)
- **Goal:** Create local accounts and give each user one or more roles, one of them the default.
- **Outcome:** Each user sees and changes only what their role allows.

### Back Up and Restore

- **Actor:** The owner's department
- **Goal:** Make sure Fathom's data can be recovered from automated, encrypted backups.
- **Outcome:** Fathom's data can be recovered after a failure.

## Not Yet Covered

- **What-if scenarios:** Comparing alternative plans with the approved plan and with each other depends on an open question in the brief.
- **Configuring cycles and releases:** Setting up release streams, with their cycle lengths and cycle names, and choosing which cycles each release includes, have no use case yet.
- **Custom fields and tables:** Defining custom fields and tables comes in a later stage of the [Roadmap](roadmap.md), and has no use case yet.
