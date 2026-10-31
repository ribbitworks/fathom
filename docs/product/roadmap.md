# Fathom — Roadmap

**Status:** Proposal for the owner's review
**Last updated:** 2026-10-30

A proposed order for delivering Fathom's goals. Goals are defined in the [Product Brief](brief.md), and this document only sequences them, noting where a stage delivers a cut-down version. The principles, stage contents, and order are not yet agreed. The privacy approval gate is agreed.

## Guiding Principles

- **Immediate needs first:** The first stage covers the owner's immediate needs.
- **Complete stages:** Each stage is fully functional and fully tested. Stages are cut down in scope, never in quality.
- **Only the sensitive data each stage needs:** Each stage holds only the employee details it uses, so the first privacy review stays small.
- **Owner's requirements first:** Each feature meets the owner's requirements and use cases first, then becomes as configurable as practical. Configuration already decided in the [Decisions Log](decisions.md) ships with its feature.

## Before Development

Development uses fictional data only.

## After Hello Fathom

- **Component evaluation:** UI components, styling, and charts are chosen, and Gantt, timeline, and org chart components are evaluated, before any UI work beyond Hello Fathom. By the owner's choice, Hello Fathom's placeholder page counts as groundwork rather than UI work.
- **Visual design:** A visual and user experience design is agreed before the rest of the first stage's screens are built.

## Before Going Live

- **IT approval:** IT approves the [IT Overview](../operations/it-overview.md), the Security Plan, and the [Deployment](../operations/deployment.md) document before Fathom is deployed to company infrastructure, including for deployment testing.
- **Privacy approval:** Before the first stage goes live, HR approves the data protection document for the data it holds.
- **Roles:** A first set of roles is agreed, from the proposal in [Roles](roles.md).
- **Hosting:** Hosting and backups are set up as described in [ADR 0001](../adr/0001-tech-stack.md) and [Supported Platforms](../operations/supported-platforms.md).
- **Security:** Scanning from the [Security Plan](../security/security-plan.md) is in place, and the threat model has been reviewed for the stage going live.

## Stage: Who Is Working on What

Covers the owner's immediate needs. Each goal starts in its simplest useful form, and the first stage shows the plan in tables and simple charts rather than an interactive Gantt view.

- **People and teams:** Includes feature teams and feature leads. Employee details are limited to the General tier plus start and end dates.
- **Org structure:** People managers and their current direct reports, without planned changes or the org chart.
- **Projects, features, and milestones**
- **Release planning**
- **Resource assignment** and **Capacity visibility**
- **Team composition:** Reports per manager compared with a target, without filters.
- **Hiring plan:** Planned hires and ramp-up, without the role-controlled hiring workflow.
- **Demand forecasting:** One estimate per feature.
- **Roles:** A fixed set of roles, with access tiers and access history for start and end dates, and the hiring plan. Software Project Managers can see that teams are in place and give input, in a form still to be confirmed in the [Product Brief](brief.md)'s open questions.

Until plan approval arrives in the next stage, edits go straight to the live plan.

## Stage: Trust and History

- **Plan approval**, including the hiring workflow and feature team approval
- **Snapshots**
- **Exports**
- **People and teams:** Gender.

## Stage: Your Own Fields and Tables

- **Custom fields and tables**, as set out in the [Decisions Log](decisions.md#configuration)

## Stage: The Organization

- **Org structure:** Planned reporting changes and the org chart.
- **Own record and reports:** Users see their own record and their reports' records through a link to their person record, as proposed in [Roles](roles.md).
- **Unified people view**
- **Team composition:** The remaining measures, such as test-to-development ratios.
- **Timeline / Gantt view**
- **Roadmap view**

## Stage: Planning Ahead

- **What-if scenarios**, if confirmed

These five stages make up v1. Broader configuration for other domains, and the future possibilities listed in the brief, come after v1.

## Open Questions

1. **First stage scope:** Is the first stage the right size, and are the cut-down versions acceptable?
1. **Editing before approval:** Is it acceptable for edits to go straight to the live plan until plan approval arrives?
1. **Stage order:** Is the order after the first stage right? For example, should the org chart come before plan approval, and should custom fields and tables come right after it, as proposed, so that changes to them can be approved?
