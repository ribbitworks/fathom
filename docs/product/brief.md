# Fathom — Product Brief

**Status:** Draft
**Last updated:** 2026-10-26

## Problem

Planning work across several software projects (who works on what, when, and whether the plan is realistic) usually lives in spreadsheets and slide decks. There is also no single view of who is on staff, who reports to whom, and who still needs to be hired. Plans go stale quickly, make over-allocation hard to spot, and give leadership no reliable, current view of the organization or the roadmap.

## Vision

Fathom is the single place where a software organization's managers plan projects, plan their workforce, and communicate the roadmap. It gives one unified view of who works for the organization, who needs to be hired and when, who reports to whom, and what everyone is working on at a high level. Editors keep it current. Leadership can see where things stand at any time without asking for a status deck.

## Users

About 20–30 users in one private company operating in British Columbia, with employees in several countries. Not all of them can edit.

| Persona | Primary needs | Expected access |
| --- | --- | --- |
| Software Project Manager | Build and maintain project timelines and milestones, often own projects | Edit |
| Software Engineering Manager | Assign engineers, balance load across the team | Edit |
| Software Product Manager | Shape the roadmap, prioritize initiatives | Edit |
| Director | See status and capacity across teams, decide on trade-offs, maintain the hiring plan and employee details | View, and edit workforce data |
| VP | See the roadmap and risks at a glance | View |

## Goals for v1

- **Projects, features, and milestones:** Plan projects and their features with owners, dates, milestones, and status.
- **People and teams:** Keep a list of people with their teams, capacity, and the employee details planning needs.
- **Org structure:** Record who reports to whom, including planned changes, and show it as an org chart.
- **Hiring plan:** Track the roles that need to be hired and when, and include planned hires in the plan before they are hired.
- **Unified people view:** See current staff and planned hires together, with their reporting lines and high-level assignments.
- **Resource assignment:** Assign people to projects or features by month.
- **Capacity visibility:** Show over- and under-allocation by person and by team.
- **Timeline / Gantt view:** Show work interactively, with drag-and-drop to change dates and assignments.
- **Roadmap view:** Give leadership a clean, read-only roadmap, grouped by quarter and theme.
- **Roles:** Control what each user can see, edit, and approve through roles.
- **Snapshots:** Save point-in-time snapshots of the plan and view them later.
- **Backups:** Provide automated backup and restore of Fathom's data.

## Out of scope for v1

- Integrations with external systems (Jira, Primavera P6, the HR system)
- Sign-in through a corporate directory
- Live collaborative editing
- Cost, rates, and budget tracking. Fathom tracks people and time only.
- Task-level or sprint-level tracking. Fathom plans at the project and feature level.
- Time tracking and timesheets
- Mobile-specific UI

## Constraints

- **Deployment:** Runs in Docker containers under WSL 2 on a Windows Server, on-premises. No managed cloud services can be assumed.
- **Network:** The server has intranet access only. Fathom must not depend on internet services at runtime, including CDNs, fonts, or external APIs.
- **Scale:** Small. Tens of users and a modest amount of data. Simple, easy-to-run choices matter more than horizontal scaling.
- **Personal data:** Fathom holds employee personal information, expected to be governed by BC's Personal Information Protection Act (PIPA). Access is limited by role, and personal data not needed for planning is kept out of logs and other output.
- **Front end:** The UI needs rich, interactive timeline, Gantt, org chart, and capacity views. This is the biggest driver of the front-end technology choice.

## Key decisions

- **Planning model:** Monthly planning, with allocations as a percentage of a person's month.
- **Planned hires:** Planned hires appear in the plan and can be allocated like current staff.
- **Access:** Role-based. A user can have one or more roles, and roles grant access to tiers of data by sensitivity.
- **Editing:** No live collaboration. Draft changes are approved before they reach the live plan.
- **Employee data:** A manually maintained copy of details held in the HR system.
- **Authentication:** Local accounts managed in Fathom for v1.
- **Tech stack:** TypeScript end to end with PostgreSQL, in Docker. See [ADR 0001](../adr/0001-tech-stack.md).

Detailed decisions are recorded in the [Decisions Log](decisions.md).

## Future possibilities

- Sign-in through the corporate directory (Active Directory / Entra ID / LDAP)
- Reading project data from a Primavera P6 database
- Integrations with Jira and the HR system
- Other integrations as needs emerge

## Open questions

1. **What-if scenarios:** Should planners be able to create and compare alternative plans, and is this the same feature as drafting changes for approval? The owner thinks so for both.
1. **Roles and approval:** Which roles exist, what can each see, edit, and approve, and which changes need approval? The owner will define them.
1. **Privacy review:** Should HR or the company's privacy officer confirm the employee fields, access tiers, and that BC PIPA applies, and what laws apply to employees outside Canada?
1. **Exports:** What formats does leadership need? PDF and Excel are likely for v1.
1. **Backup operations:** Who runs and monitors backups, and where are backup files kept? The owner's department will probably run them, since IT is too busy to support custom applications.
