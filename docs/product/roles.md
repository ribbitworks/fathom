# Fathom — Roles

**Status:** Proposal for the owner's review
**Last updated:** 2026-10-31

Proposed roles for controlling what each user can see, edit, and approve, built on the access decisions in the [Decisions Log](decisions.md). The owner has confirmed the role list, that People Managers and the Executive see Restricted data, that the Engineering Director plans, the split between Project Planner and Resource Planner, and that the Engineering Director is the first Administrator. Items marked **proposal** are not yet agreed.

## Proposed Roles

- **Viewer:** Sees the plan, including everyone's work assignments. Every account gets this role unless it is left off, as for a person who runs Fathom without seeing people data.
- **Project Planner:** Edits projects, features, milestones, releases, products, customers, and estimates across the whole plan.
- **Resource Planner:** Sees people's General details, and edits allocations across the whole plan.
- **People Manager:** Proposes feature teams, and sees people, with Restricted details for everyone, because people move between managers over time.
- **Workforce Administrator:** Maintains people, teams, reporting lines, feature teams, the hiring plan, and planning configuration, and sees all Restricted and Confidential data.
- **Leadership:** Sees people, with their Restricted and Confidential data, without editing it.
- **Approver:** Approves draft plan changes and feature teams.
- **Administrator:** Manages user accounts, role assignments, and system settings, without access to Restricted or Confidential data.

## What Each Role Can Do

| Area | Viewer | Project Planner | Resource Planner | People Manager | Workforce Administrator | Leadership | Approver | Administrator |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Plan: projects, features, milestones, releases and the cycles they include (**proposal**), products and customers (**proposal**), and estimates | View | Edit | View | View | View | View | View | None |
| Allocations | View | View | Edit | View | View | View | View | None |
| People, teams, and reporting lines (General) | None | None | View | View | Edit | View | None | None |
| Feature teams (General), with seeing them coming with seeing the plan (**proposal**) | View | View | View | Propose | Edit | View | Approve | None |
| Restricted employee details | None | None | None | View | Edit | View | None | None |
| Confidential data | None | None | None | None | Edit | View | None | None |
| Planning configuration: release streams, their cycles and cycle names, estimate conversions (**proposal**), and composition targets, with seeing them coming with seeing the plan (**proposal**) | View | View | View | View | Edit | View | View | None |
| Lists of choices, and People's columns and their order | None | None | None | None | Edit | None | None | None |
| Draft changes (**proposal**) | None | Submit | Submit | None | Submit | None | Approve | None |
| Change history, for the data the role sees (**proposal**) | View | View | View | View | View | View | View | None |
| Saved views of tables the role sees | Save, and change their own | Save, and change their own | Save, and change their own | Save, and change their own | Save, and change any | Save, and change their own | Save, and change their own | None |
| User accounts, role assignments, and system settings | None | None | None | None | None | None | None | Edit |
| Access history | None | None | None | None | None | None | None | View (**proposal**) |

**Proposal:** Seeing data comes only from roles, never from approving. A user can approve only drafts whose values their roles let them see, so a draft holding a Restricted detail, such as an end date, needs an Approver who also holds a role that sees Restricted data. Approvers approve every kind of draft, so Project Managers, who hold Approver by default, can approve feature teams too, which the owner accepted on 2026-10-31 until roles are reworked, as [Issues](../issues.md) records.

The owner has decided that a role letting a user edit some data also lets them view it. Until the account change in [Issues](../issues.md) builds it, viewing the plan and allocations comes from the Viewer role, which every account has by default, and roles that edit people or planning configuration are given the matching view.

Seeing people is kept to the roles that work with them, so Product Managers, Project Managers, Feature Leads, and Team Members do not see the People table by default. The choices of a list are seen by everyone who sees data drawn from it, such as People's columns, without seeing the Lists page.

## Custom Fields and Tables

**Proposal:** The Workforce Administrator defines custom fields on people, teams, and planned hires, and any custom field or table that links to people or holds personal information. Project Planners define other custom fields on the plan, such as on projects and features, and custom tables for reference lists. A user can assign a field or table only to a tier their own roles let them see. This waits for the [Roadmap](roadmap.md)'s stage for custom fields and tables.

## Releases

**Proposal:** Project Planners, such as Project Managers, make releases and choose which cycles each includes. The Workforce Administrator sets up release streams, their cycle lengths, and their naming patterns.

## Access to Your Own Record and Your Reports

**Proposal:** Each person record holds the employee's work email address. When it matches a user account's email address, Fathom suggests linking the two, and an Administrator confirms the link, so a mistyped or reused address never grants access by itself. A linked user automatically sees, without editing, their own record and the records of everyone who currently reports to them, directly or through other managers, including Restricted details; planned reporting changes grant nothing until they take effect. Access to anyone else's data still comes from roles, so the People Manager role could then be narrowed from seeing Restricted details for everyone. To stop an Administrator linking themselves to someone else's record, nobody confirms a link to their own account, changing a linked account's email address removes its link, and every link made or removed is recorded in the access history. The work email address is new personal data, brought to HR before it is added.

## Planned Hires in the Plan

**Proposal:** In the plan, a planned hire appears as a placeholder showing only its position, team, and the first month it can be allocated, which are General-tier data. Its other hiring details stay Confidential. This lets Viewers and Resource Planners see and allocate planned hires without seeing the hiring plan.

## Safeguards for Administrators

**Decided, built by the account change in [Issues](../issues.md):** Administrators manage their own account like any other: they can change its roles, name, and email address, and deactivate it. Two guards remain: the last active Administrator cannot lose the Administrator role or be deactivated, so no one can lock everyone out, and nobody resets their own password from the Accounts page, since changing one's own password needs the current one. Until it is built, the [Security Plan](../security/security-plan.md)'s rule applies: Administrators cannot change their own roles, reset their own password, or deactivate their own account.

**Proposal:** Every account created, role change, password reset, and deactivation is recorded in the access history, and granting the Workforce Administrator role needs the Engineering Director's confirmation. The first Administrator's roles are assigned when Fathom is set up. Separation of duties applies to the Administrator role itself; a person who also holds other roles sees what those roles allow. While the Engineering Director is the only Administrator and also confirms Workforce Administrator grants, these safeguards rely on the access history alone. A second person should take the Administrator role or the confirming duty later. With local passwords, an Administrator can still reach other roles' data by creating another account or resetting another user's password and signing in as them; the access history is what reveals it.

## Default Roles by Persona

| Persona | Roles |
| --- | --- |
| Product Manager | Viewer, Project Planner |
| Project Manager | Viewer, Project Planner, Approver |
| Engineering Manager | Viewer, Project Planner, Resource Planner, People Manager |
| Feature Lead | Viewer, Project Planner |
| Engineering Director | Viewer, Project Planner, Resource Planner, Leadership, Approver |
| Engineering Operations Manager | Viewer, Workforce Administrator |
| Executive | Viewer, Leadership |
| Team Member | Viewer |
| Fathom Administrator, initially the Engineering Director | Administrator |

Personas are defined in the [Product Brief](brief.md#users). A Feature Lead who is also an Engineering Manager has both personas' roles.

How Project Managers give input on whether teams are in place is an open question in the [Product Brief](brief.md), and may add to their roles.

## First Stage

The first stage of the [Roadmap](roadmap.md) uses every role: Viewer, Project Planner, Resource Planner, People Manager, Workforce Administrator, Leadership, Approver, and Administrator.

## Open Questions

1. **Self-approval:** May an Approver approve their own draft changes? Project Managers both plan and approve, so without a rule against it they would.
