# Fathom — Roles

**Status:** Proposal for the owner's review
**Last updated:** 2026-10-30

Proposed roles for controlling what each user can see, edit, and approve, built on the access decisions in the [Decisions Log](decisions.md). The owner has confirmed the role list, that People Managers and the VP see Restricted data, that the Director plans, the split between Project Planner and Resource Planner, and that the Director is the first Administrator. Items marked **proposal** are not yet agreed.

## Proposed Roles

- **Viewer:** Sees General-tier data. Every account gets this role unless it is left off, as for a person who runs Fathom without seeing people data.
- **Project Planner:** Edits initiatives, projects, features, milestones, release contents, and estimates across the whole plan.
- **Resource Planner:** Edits allocations across the whole plan.
- **People Manager:** Proposes feature teams, and sees Restricted details for everyone, because people move between managers over time and levels are commonly visible across the company.
- **Workforce Administrator:** Maintains people, teams, reporting lines, the hiring plan, and planning configuration, approves feature teams, and sees all Restricted and Confidential data.
- **Leadership:** Sees Restricted and Confidential data, without editing it.
- **Approver:** Approves draft plan changes.
- **Administrator:** Manages user accounts, role assignments, and system settings, without access to Restricted or Confidential data.

## What Each Role Can Do

| Area | Viewer | Project Planner | Resource Planner | People Manager | Workforce Administrator | Leadership | Approver | Administrator |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Plan: initiatives, projects, features, milestones, release contents, which cycles become releases (**proposal**), and estimates | View | Edit | View | View | View | View | View | None |
| Allocations | View | View | Edit | View | View | View | View | None |
| People, teams, and reporting lines (General) | View | View | View | View | Edit | View | View | None |
| Feature teams (General) | View | View | View | Propose | Edit and approve | View | View | None |
| Restricted employee details | None | None | None | View | Edit | View | None | None |
| Confidential data | None | None | None | None | Edit | View | None | None |
| Planning configuration: cycles, cycle names, patch frequency, composition targets, and the lists of choices for people's details | View | View | View | View | Edit | View | View | None |
| Draft plan changes | None | Submit | Submit | None | None | None | Approve | None |
| User accounts, role assignments, and system settings | None | None | None | None | None | None | None | Edit |
| Access history | None | None | None | None | None | None | None | View (**proposal**) |

## Custom Fields and Tables

**Proposal:** The Workforce Administrator defines custom fields on people, teams, and planned hires, and any custom field or table that links to people or holds personal information. Project Planners define other custom fields on the plan, such as on projects and features, and custom tables for reference lists. A user can assign a field or table only to a tier their own roles let them see. This waits for the [Roadmap](roadmap.md)'s stage for custom fields and tables.

## Releases

**Proposal:** Project Planners, such as Software Project Managers, confirm which candidate cycles become releases, along with release contents. The Workforce Administrator sets up cycles, their naming pattern, and patch frequency.

## Planned Hires in the Plan

**Proposal:** In the plan, a planned hire appears as a placeholder showing only its position, team, and the first month it can be allocated, which are General-tier data. Its other hiring details stay Confidential. This lets Viewers and Resource Planners see and allocate planned hires without seeing the hiring plan.

## Safeguards for Administrators

**Proposal:** Administrators cannot change their own roles, reset their own password, or deactivate their own account, and every account created, role change, password reset, and deactivation is recorded in the access history, and granting the Workforce Administrator role needs the Director's confirmation. The first Administrator's roles are assigned when Fathom is set up. Separation of duties applies to the Administrator role itself; a person who also holds other roles sees what those roles allow. While the Director is the only Administrator and also confirms Workforce Administrator grants, these safeguards rely on the access history alone. A second person should take the Administrator role or the confirming duty later. With local passwords, an Administrator can still reach other roles' data by creating another account or resetting another user's password and signing in as them; the access history is what reveals it.

## Default Roles by Persona

| Persona | Roles |
| --- | --- |
| Software Project Manager | Viewer, Project Planner |
| Software Product Manager | Viewer, Project Planner |
| Software Engineering Manager | Viewer, Project Planner, Resource Planner, People Manager |
| Director | Viewer, Project Planner, Resource Planner, Workforce Administrator, Approver |
| VP | Viewer, Leadership |
| Person running Fathom, initially the Director | Administrator |

How Software Project Managers give input on whether teams are in place is an open question in the [Product Brief](brief.md), and may add to their roles.

## First Stage

The first stage of the [Roadmap](roadmap.md) uses Viewer, Project Planner, Resource Planner, People Manager, Workforce Administrator, Leadership, and Administrator. Until plan approval arrives (see the Roadmap), People Managers edit feature teams directly instead of proposing them.

Roadmap themes and priorities follow the open question in the [Domain Model](../design/domain-model.md).

## Open Questions

1. **Self-approval:** May an Approver approve their own draft changes? While the Director is the only Approver, they would.
