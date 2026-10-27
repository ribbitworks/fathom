# Fathom — Roadmap

**Status:** Proposal for the owner's review
**Last updated:** 2026-10-26

A proposed order for delivering Fathom's goals. Goals are defined in the [Product Brief](brief.md), and this document only sequences them, noting where a stage delivers a cut-down version. The principles, prerequisites, stage contents, and order are not yet agreed.

## Guiding Principles

- **Immediate needs first:** The first stage covers the owner's immediate needs.
- **Complete stages:** Each stage is fully functional and fully tested. Stages are cut down in scope, never in quality.
- **Only the sensitive data each stage needs:** Each stage holds only the employee details it uses, so the first privacy review stays small.
- **Owner's requirements first:** Each feature meets the owner's requirements and use cases first, then becomes as configurable as practical. Configuration already decided in the [Decisions Log](decisions.md) ships with its feature.

## Before the First Stage

- **Privacy approval:** HR approves the data protection document for the data the first stage holds.
- **Roles:** A first set of roles is agreed.
- **Hosting:** Hosting and backups are set up as described in [ADR 0001](../adr/0001-tech-stack.md).
- **Component evaluation:** Gantt and timeline components are evaluated before UI work starts, as [ADR 0001](../adr/0001-tech-stack.md) calls for.

## Stage: Who Is Working on What

Covers the owner's immediate needs. Each goal starts in its simplest useful form, and the first stage shows the plan in tables and simple charts rather than an interactive Gantt view.

- **People and teams:** Includes feature teams and feature leads. Employee details are limited to the General tier plus level and start and end dates.
- **Org structure:** People managers and their current direct reports, without planned changes or the org chart.
- **Projects, features, and milestones**
- **Release planning**
- **Resource assignment** and **Capacity visibility**
- **Team composition:** Reports per manager compared with a target, without filters.
- **Hiring plan:** Planned hires and ramp-up, without the role-controlled hiring workflow.
- **Demand forecasting:** One estimate per feature.
- **Roles:** A fixed set of roles, with access tiers and access history for level, start and end dates, and the hiring plan. Software Project Managers can see that teams are in place and give input, in a form still to be confirmed in the [Product Brief](brief.md)'s open questions.

Until plan approval arrives in the next stage, edits go straight to the live plan.

## Stage: Trust and History

- **Plan approval**, including the hiring workflow and feature team approval
- **Snapshots**
- **Exports**
- **People and teams:** Gender.

## Stage: The Organization

- **Org structure:** Planned reporting changes and the org chart.
- **Unified people view**
- **Team composition:** The remaining measures, such as test-to-development ratios.
- **Timeline / Gantt view**
- **Roadmap view**

## Stage: Planning Ahead

- **What-if scenarios**, if confirmed

These four stages make up v1. Broader configuration for other domains, and the future possibilities listed in the brief, come after v1.

## Open Questions

1. **First stage scope:** Is the first stage the right size, and are the cut-down versions acceptable?
1. **Editing before approval:** Is it acceptable for edits to go straight to the live plan until plan approval arrives?
1. **Prerequisites:** Should HR approval and agreed roles be required before the first stage goes live?
1. **Stage order:** Is the order after the first stage right? For example, should the org chart come before plan approval?
