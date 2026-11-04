# Fathom — Product Brief

**Status:** Draft
**Last updated:** 2026-11-03

## Problem

Planning work across several software projects (who works on what, when, and whether the plan is realistic) usually lives in spreadsheets and slide decks. There is also no single view of who is on staff, who reports to whom, and who still needs to be hired. Plans go stale quickly, make over-allocation hard to spot, and give leadership no reliable, current view of the organization or the roadmap.

## Vision

Fathom is the single place where a software organization's managers plan projects, plan their workforce, and communicate the roadmap. It gives one unified view of who works for the organization, who needs to be hired and when, who reports to whom, and what everyone is working on at a high level. Editors keep it current. Leadership can see where things stand at any time without asking for a status deck.

## Users

About 20–30 users at first, mostly managers and leads, in one private company operating in British Columbia, with employees in several countries. Team members may be given accounts later. Not all users can edit.

Personas are named as they are widely known in the software industry. Each organization matches them to its own titles, such as those shown.

| Persona | Typical titles | Primary needs | Expected access |
| --- | --- | --- | --- |
| Product Manager | Product Manager, Product Owner | Shape the roadmap, prioritize features | Edit |
| Project Manager | Project Manager, Program Manager, Delivery Manager | Deliver projects' scope to customers by their dates, maintain milestones, often own projects, approve plan changes | Edit |
| Engineering Manager | Engineering Manager, Software Development Manager | Manage people, assign them to work, balance load across the team | Edit |
| Feature Lead | Feature Lead, Tech Lead | Lead a feature team, and see its features, members, and their load | Edit |
| Engineering Director | Director, Head of Engineering | See status and capacity across teams, decide on trade-offs, approve plan changes | Edit, and view sensitive data |
| Engineering Operations Manager | Engineering Operations Manager, Chief of Staff, Resource Manager | Maintain employee details, teams, reporting lines, the hiring plan, and planning configuration | Edit workforce data |
| Executive | VP, CTO | See the roadmap and risks at a glance | View, including sensitive data |
| Team Member | Software Engineer, Test Engineer | See their own assignments and the plan they are part of | View |
| Fathom Administrator | System administrator | Run Fathom, its accounts, and its settings, without seeing people data | Accounts and settings only |

## Goals for v1

- **Projects, features, and milestones:** Plan projects with the features they need and their milestones, and the proposals that may become projects.
- **People and teams:** Keep a list of people with their teams, feature teams, capacity, and the employee details planning needs.
- **Org structure:** Record who reports to whom, including planned changes, and show it as an org chart.
- **Hiring plan:** Track the roles that need to be hired and when, and include planned hires in the plan before they are hired.
- **Team composition:** Evaluate teams for balance, such as test-to-development ratios and the number of reports per manager compared with a target.
- **Unified people view:** See current staff and planned hires together, with their reporting lines and high-level assignments.
- **Release planning:** See which features are targeted at which cycles, and which cycles make up each release.
- **Demand forecasting:** See rough estimates (ROMs and SWAGs) for features over the next 6 months, 12 months, 2 years, and beyond, to know what may come and what resources are needed.
- **Resource assignment:** Assign people to projects or features by month.
- **Capacity visibility:** Show over- and under-allocation by person, by manager, and by feature team.
- **Timeline / Gantt view:** Show work interactively, with drag-and-drop to change dates and assignments.
- **Roadmap view:** Let Product Managers shape the roadmap of features by cycle and release, and give leadership a clean, read-only view of it.
- **Roles:** Control what each user can see, edit, and approve through roles.
- **Plan approval:** Save changes as drafts, which are approved before they reach the live plan.
- **Change history:** See who changed what, and when, for the data each user may see.
- **Custom fields and tables:** Let users add their own fields to Fathom's built-in tables, and their own tables, set up in plain language rather than database terms.
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

- **Deployment:** Runs on-premises, on a server shared with other applications. No managed cloud services can be assumed. Details are in [Deployment](../operations/deployment.md).
- **Network:** Fathom must be reachable only from the internal network, never from the internet, even though its server has internet access. Fathom must not depend on internet services at runtime, including CDNs, fonts, or external APIs, so personal data stays inside the company.
- **Scale:** Small. Tens of users and a modest amount of data. Simple, easy-to-run choices matter more than horizontal scaling.
- **Personal data:** Fathom holds personal information about employees, including employees and managers in India. It is expected to be governed by BC's Personal Information Protection Act (PIPA), and Indian law may also apply. Access is limited by role, and personal data not needed for planning is kept out of logs and other output.
- **Configurability:** Fathom needs to be as configurable as possible, to suit multiple domains and organizational structures, but must meet the owner's requirements and use cases first.
- **Front end:** The UI needs rich, interactive timeline, Gantt, org chart, and capacity views. This is the biggest driver of the front-end technology choice.

## Key decisions

- **Planning model:** Monthly planning, with allocations as a percentage of a person's month.
- **Planning level:** Fathom plans features, not their stories or tasks, and is never a clone of a full project management application. See the [Decisions Log](decisions.md#planning).
- **Planned hires:** Planned hires appear in the plan and can be allocated like current staff.
- **Access:** Role-based. A user can have one or more roles, and roles grant access to tiers of data by sensitivity.
- **Editing:** No live collaboration. Draft changes are approved before they reach the live plan.
- **Configurability:** A fixed core of built-in tables, extended with custom fields and tables. See the [Decisions Log](decisions.md#configuration).
- **Employee data:** A manually maintained copy of details held in the HR system.
- **Authentication:** Local accounts managed in Fathom for v1.
- **Tech stack:** TypeScript end to end with PostgreSQL, in Docker. See [ADR 0001](../adr/0001-tech-stack.md).

Detailed decisions are recorded in the [Decisions Log](decisions.md). The order in which goals are delivered is in the [Roadmap](roadmap.md).

## Future possibilities

- Sign-in through the corporate directory (Active Directory / Entra ID / LDAP)
- Reading project data from a Primavera P6 database
- Integrations with Jira and the HR system
- Other integrations as needs emerge
- Physical resources, such as equipment, planned and allocated alongside people

## Open questions

1. **What-if scenarios:** The owner wants to compare a draft with the approved plan, and drafts with each other. Each row has only one draft, as the [Decisions Log](decisions.md#planning) sets out, so comparing alternative plans would be a separate feature, such as named scenarios. It could mature incrementally across versions of Fathom.
1. **Roles and approval:** Which roles exist, and what can each see, edit, and approve? See the proposal in [Roles](roles.md). Which changes need approval is decided in the [Decisions Log](decisions.md#planning).
1. **Privacy review:** A document describing the personal data Fathom holds and how it is protected will be prepared for HR to review and approve. Which laws apply, in Canada, India, and other countries, is to be confirmed in that review.
1. **Backup location:** Where are backup files kept?
1. **Project Manager input:** Project Managers approve feature teams through the Approver role, as [Roles](roles.md) sets out. Is other input needed on whether teams are in place, such as comments or proposals?
1. **Timeline changes:** The timeline goal asks for drag and drop to change dates and assignments. [ADR 0009](../adr/0009-roadmap-and-timeline-views.md) proposes moving features between cycles and feature teams first. Is dragging to shift a feature's allocations by months also needed?
