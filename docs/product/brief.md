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
| Director | See status and capacity across teams, decide on trade-offs, maintain the hiring plan and employee details | Edit, including workforce data |
| VP | See the roadmap and risks at a glance | View, including sensitive data |

## Goals for v1

- **Projects, features, and milestones:** Plan projects and their features with owners, dates, milestones, and status.
- **People and teams:** Keep a list of people with their teams, feature teams, capacity, and the employee details planning needs.
- **Org structure:** Record who reports to whom, including planned changes, and show it as an org chart.
- **Hiring plan:** Track the roles that need to be hired and when, and include planned hires in the plan before they are hired.
- **Team composition:** Evaluate teams for balance, such as test-to-development ratios and the number of reports per manager compared with a target.
- **Unified people view:** See current staff and planned hires together, with their reporting lines and high-level assignments.
- **Release planning:** See which features will be delivered in which cycles, and which cycles will be releases.
- **Demand forecasting:** See rough estimates (ROMs and SWAGs) for features over the next 6 months, 12 months, 2 years, and beyond, to know what may come and what resources are needed.
- **Resource assignment:** Assign people to projects or features by month.
- **Capacity visibility:** Show over- and under-allocation by person and by team.
- **Timeline / Gantt view:** Show work interactively, with drag-and-drop to change dates and assignments.
- **Roadmap view:** Give leadership a clean, read-only roadmap, grouped by quarter and theme.
- **Roles:** Control what each user can see, edit, and approve through roles.
- **Exports:** Export the plan and roadmap, limited to what each user's roles allow.
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
- Recording dotted-line reporting relationships
- Tracking licenses

## Constraints

- **Deployment:** Runs in Docker containers under WSL 2 on a Windows Server, on-premises in Canada. No managed cloud services can be assumed.
- **Network:** The server has internet access, but Fathom must be reachable only from the internal network, never from the internet. Fathom must not depend on internet services at runtime, including CDNs, fonts, or external APIs, so personal data stays inside the company.
- **Scale:** Small. Tens of users and a modest amount of data. Simple, easy-to-run choices matter more than horizontal scaling.
- **Personal data:** Fathom holds personal information about employees, including employees and managers in India. It is expected to be governed by BC's Personal Information Protection Act (PIPA), and Indian law may also apply. Access is limited by role, and personal data not needed for planning is kept out of logs and other output.
- **Configurability:** Fathom needs to be as configurable as possible, to suit multiple domains and organizational structures, but must meet the owner's requirements and use cases first.
- **Front end:** The UI needs rich, interactive timeline, Gantt, org chart, and capacity views. This is the biggest driver of the front-end technology choice.

## Key decisions

- **Planning model:** Monthly planning, with allocations as a percentage of a person's month.
- **Planned hires:** Planned hires appear in the plan and can be allocated like current staff.
- **Access:** Role-based. A user can have one or more roles, and roles grant access to tiers of data by sensitivity.
- **Editing:** No live collaboration. Draft changes are approved before they reach the live plan.
- **Employee data:** A manually maintained copy of details held in the HR system.
- **Authentication:** Local accounts managed in Fathom for v1.
- **Tech stack:** TypeScript end to end with PostgreSQL, in Docker. See [ADR 0001](../adr/0001-tech-stack.md).

Detailed decisions are recorded in the [Decisions Log](decisions.md). The order in which goals are delivered is in the [Roadmap](roadmap.md).

## Future possibilities

- Sign-in through the corporate directory (Active Directory / Entra ID / LDAP)
- Reading project data from a Primavera P6 database
- Integrations with Jira and the HR system
- Other integrations as needs emerge

## Open questions

1. **What-if scenarios:** The owner wants to compare a draft with the approved plan, and drafts with each other. Is this the same feature as drafting changes for approval? The owner thinks it is. It could mature incrementally across versions of Fathom.
1. **Roles and approval:** Which roles exist, what can each see, edit, and approve, and which changes need approval? See the proposal in [Roles](roles.md).
1. **Privacy review:** A document describing the personal data Fathom holds and how it is protected will be prepared for HR to review and approve. Which laws apply, in Canada, India, and other countries, is to be confirmed in that review.
1. **Backup location:** Where are backup files kept?
1. **Project Manager input:** What input do Software Project Managers have on whether teams are in place, for example comments, proposals, or approval?
1. **Capacity in v1:** Does v1 need variable capacity per person, such as for part-time staff, or can it assume a full month for everyone? The owner thinks it may not be needed in v1.
