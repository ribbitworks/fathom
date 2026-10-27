# Fathom — Product Brief

**Status:** Draft
**Last updated:** 2026-10-26

## Problem

Planning work across several software projects (who works on what, when, and whether the plan is realistic) usually lives in spreadsheets and slide decks. These go stale quickly, make over-allocation hard to spot, and give leadership no reliable, current view of the roadmap.

## Vision

Fathom is the single place where a software organization's managers plan projects, assign people, and communicate the roadmap. Editors keep the plan current. Leadership can see where the plan stands at any time without asking for a status deck.

## Users

About 20–30 people in one organization. Not all of them can edit.

| Persona | Primary needs | Expected access |
|---|---|---|
| Software Project Manager | Build and maintain project timelines and milestones | Edit |
| Software Engineering Manager | Assign engineers, balance load across the team | Edit |
| Software Product Manager | Shape the roadmap, prioritize initiatives | Edit |
| Director | See status and capacity across teams, decide on trade-offs | View (possibly edit) |
| VP | See the roadmap and risks at a glance | View |

## Goals for v1

- **Projects, features, and milestones:** Create projects and the features within them, with dates, milestones, and status.
- **People and teams:** Keep a list of people, their teams, and their available capacity.
- **Resource assignment:** Assign people to projects or features by month.
- **Capacity visibility:** Show over- and under-allocation by person and by team, and flag people split across too many assignments in a month.
- **Timeline / Gantt view:** Show work interactively, with drag-and-drop to change dates and assignments.
- **Roadmap view:** Give leadership a clean, read-only roadmap, grouped by quarter and theme.
- **Roles:** Separate the people who can edit from those who can only view.
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

- **Deployment:** Runs from a Docker container under WSL 2 on a Windows Server, on-premises. No managed cloud services can be assumed.
- **Network:** The server has intranet access only. Fathom must not depend on internet services at runtime, including CDNs, fonts, or external APIs.
- **Scale:** Small. Tens of users and a modest amount of data. Simple, easy-to-run choices matter more than horizontal scaling.
- **Front end:** The UI needs rich, interactive timeline, Gantt, and capacity views. This is the biggest driver of the front-end technology choice.

## Decisions

- **Authentication:** Local accounts managed in Fathom for v1.
- **Editing model:** No live collaboration. Saving a change and refreshing to see others' changes is acceptable.
- **Planning granularity:** Monthly, open to revisiting.
- **Cost:** Not tracked. Allocations record people against projects or features per month.
- **History:** Plan snapshots are in scope.

## Future possibilities

- Sign-in through the corporate directory (Active Directory / Entra ID / LDAP)
- Reading project data from a Primavera P6 database
- Integrations with Jira and the HR system
- Other integrations as needs emerge

## Open questions

1. **Draft and approval workflow:** Should editors make draft changes that someone approves before they reach the live plan? If so, who approves, and is this the same feature as what-if scenarios?
1. **What-if scenarios:** Do planners need alternative plans they can compare before committing?
1. **Allocation unit:** Within a month, is an allocation a percentage, a fraction of a full-time person, or hours?
1. **Multiple assignments:** How many projects or features can one person have in a month? Is the limit enforced, or only warned about?
1. **Projects and features:** How do projects and features relate? Can a feature belong to more than one project, and can people be allocated to a project directly?
1. **Exports:** What formats does leadership need (PDF, PNG, Excel, slide-ready images)?
1. **Snapshots:** Are snapshots taken manually, on a schedule (for example, monthly or quarterly), or both?
1. **Backup operations:** Who runs and monitors backups, and where are backup files stored?
