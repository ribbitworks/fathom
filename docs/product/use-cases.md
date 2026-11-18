# Fathom: Use Cases

**Status:** Draft
**Last updated:** 2026-11-18

The core scenarios Fathom must support in v1, derived from the [Product Brief](brief.md). Each use case names the main actor, their goal, and the outcome. Steps and detail are added when each feature is designed.

## Planning Work

### Plan a Project

- **Actor:** Project Manager
- **Goal:** Put a new project on the plan, with its owner, the features it needs, and its milestones, such as customer delivery dates.
- **Outcome:** Once approved, the project appears on the timeline and the roadmap.

### Track a Proposal

- **Actor:** Project Manager
- **Goal:** Record a bid or customer request with the features it proposes, and keep its status up to date.
- **Outcome:** The proposal, its status and the features it proposes are kept, each change approved.

A proposal starts Open, and its status is one of the built-in Proposal statuses, whose choices can be changed, with no rules tied to them, so any status may follow any other, as the [Domain Model](../design/domain-model.md#proposal) sets out. Each change is a draft that needs [approval](../design/domain-model.md#drafts-and-approval). A project links to one or more proposals. No project is made from a proposal, and nothing marks a proposal Won.

```mermaid
flowchart TD
    open[Proposal, status Open] -->|status changed| draft[Draft, waiting for approval]
    draft -->|approved| status[New status: Open, Won, Lost, Withdrawn, or the organization's own]
    draft -->|rejected| rejected[Rejected, back with its makers]
    status -->|status changed| draft
```

### Shape the Roadmap

- **Actor:** Product Manager
- **Goal:** Add the features that may come, with rough estimates, prioritize them, and target them at cycles.
- **Outcome:** Once approved, the roadmap shows what may come in each cycle, and whether it fits the capacity available.

A feature usually starts with few details: a name, a short description, notes, a rough Needed by, its status, a rough size, and the customers likely to want it. Its feature team, target cycle, and finer estimate come later, in planning.

### Follow a Feature's Path

- **Actors:** Product Manager and Project Manager, with an Approver
- **Goal:** Take a feature from an idea to a release, whichever comes first, the sale or the work.
- **Outcome:** The feature is planned, staffed and shipped as one record.

A feature comes in two ways, both normal: sold, then built, through a proposal and usually a project; or built, then sold, planned on its own and included in proposals later. Every change along the way is a draft, approved with Approve Plan.

```mermaid
flowchart TD
    A["A Product Manager adds a feature,<br/>status starting as Possible"] --> B{"Which way in?"}
    B -->|"sold, then built"| C["Proposals include it,<br/>each for its customers"]
    B -->|"built, then sold"| E
    C -->|"scope changes"| C2["Removed from a proposal:<br/>kept in the proposal's scope history"]
    C -->|"won: a project links<br/>to the proposal"| D["The project needs it"]
    D -->|"the project funds it"| E["Planning: feature team, target cycle,<br/>and effort; status Planned"]
    E --> H["People allocated by month:<br/>In progress"]
    E --> F{"Is the target cycle<br/>in a release?"}
    F -->|"no"| N["Not released yet"]
    F -->|"yes"| G["Shown under that release"]
    H --> I["Done, or Cancelled"]
    I -.->|"built, then sold"| C
```

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
- **Outcome:** Approved draft rows become part of the live plan, and rejected ones stay as drafts with the reason, as the [Domain Model](../design/domain-model.md#drafts-and-approval) sets out.

## Planning the Workforce

### Maintain Employee Records

- **Actor:** Engineering Operations Manager
- **Goal:** Keep employee details current, including teams, managers, and end dates.
- **Outcome:** People can be planned for. People who leave are kept, with their end date, rather than deleted.

Details are typed or pasted into People, or changed in a person's details beside People or the org chart.

### Plan a Hire

- **Actor:** Engineering Operations Manager
- **Goal:** Plan a role that needs to be filled, with its target date, and track it through the hiring states.
- **Outcome:** The planned hire appears in the plan and can be allocated to work. Once the role is filled, the person who fills it takes its place in People, as the [Domain Model](../design/domain-model.md#planned-hires) sets out.

### Maintain Feature Teams

- **Actors:** Engineering Managers, with an Approver, such as the Engineering Director, approving
- **Goal:** Keep feature teams, their members, and their feature leads current.
- **Outcome:** Once approved, each feature has a feature team that owns and delivers it.

### Evaluate Team Composition

- **Actors:** Users whose role sees people and teams
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
- **Outcome:** The export contains only what the user's roles allow, in one of the formats [Exporting](../standards/ui-conventions.md#exporting) sets out.

### View an Earlier Snapshot

- **Actors:** Users, according to their role
- **Goal:** See what the plan looked like at an earlier point in time, from a snapshot taken manually or on a schedule.
- **Outcome:** The user can view the plan as it was when the snapshot was taken.

## Running Fathom

### Manage Users and Roles

- **Actor:** Fathom Administrator, a persona in the [Product Brief](brief.md#users), with the Administrator role in [Roles](roles.md)
- **Goal:** Create local accounts and give each user one or more roles, one of them the default.
- **Outcome:** Each user sees and changes only what their role allows.

## Not Yet Covered

- **What-if scenarios:** Comparing alternative plans with the approved plan and with each other, which is still to be designed.
- **Configuring cycles and releases:** Setting up schedules, with their cycle lengths and cycle names, and choosing which cycles each release includes, have no use case yet.
- **Custom fields and tables:** Defining custom fields and tables comes in a later stage of the [Roadmap](roadmap.md), and has no use case yet.
