# Fathom — Domain Model

**Status:** Draft
**Last updated:** 2026-10-31

A first sketch of Fathom's core entities and how they relate. It describes structure only: terms are defined in [Domain Concepts](../product/domain.md), and rules and allowed values are in the [Decisions Log](../product/decisions.md). It describes concepts, not database tables. Items marked **proposal** are suggested modeling choices that have not been agreed.

## Overview

The diagram shows the core relationships only. Dashed lines are proposals or relationships whose cardinality is not yet confirmed. Access records and snapshots are described below but not drawn. Patches appear as release streams.

```mermaid
erDiagram
    PROJECT }o..o{ FEATURE : needs
    PROJECT ||--|| FEATURE : "general feature"
    PROJECT |o--o{ MILESTONE : has
    FEATURE |o--o{ MILESTONE : has
    PROJECT }o--o{ CUSTOMER : "driven by"
    FEATURE }o..o{ PRODUCT : "part of"
    PROJECT }o..o{ PRODUCT : "delivers requirements for"
    FEATURE }o--o| CYCLE : targets
    PERSON |o--o{ PROJECT : owns
    PERSON ||..o{ TEAM : manages
    TEAM |o..o{ PERSON : includes
    FEATURE_TEAM |o--o{ FEATURE : "owns and delivers"
    FEATURE_TEAM ||..o{ MEMBERSHIP : has
    PERSON ||..o{ MEMBERSHIP : holds
    PERSON ||--o{ FEATURE_TEAM : leads
    PERSON ||--o{ REPORTING_LINE : "reports through"
    PERSON ||--o{ REPORTING_LINE : manages
    FEATURE ||--o{ ALLOCATION : receives
    PERSON |o..o{ ALLOCATION : "is allocated"
    PLANNED_HIRE |o..o{ ALLOCATION : "is allocated"
    PLANNED_HIRE }o--|| TEAM : joins
    PLANNED_HIRE }o--|| PERSON : "reports to"
    PLANNED_HIRE |o--o| PERSON : "is filled by"
    USER }o--|{ ROLE : has
    USER |o..o| PERSON : "may be"
    CHANGE_SET ||--|{ CHANGE : groups
    USER |o--o{ CHANGE_SET : makes
    RELEASE_STREAM ||--o{ CYCLE : defines
    RELEASE_STREAM ||--o{ RELEASE : contains
    RELEASE |o--|{ CYCLE : includes
```

## Planning Entities

- **Project:** Has a number, a name, and optionally an owner and customers. Has milestones, which give it its dates, and links to the features it needs. Has one general feature, which takes allocations made to the project directly.
- **Feature:** Has a name, a status, and optionally a target cycle, an estimate, and the feature team that owns and delivers it. Has no owner of its own; ownership comes from its feature team. Can be needed by several projects. Ships in the release that includes its target cycle, and its start and end months follow from its allocations.
- **Milestone:** A dated point in a project or a feature, which says whether it is a customer delivery date.
- **Allocation:** Links one person or planned hire to one feature for one month, with a percentage.
- **Estimate:** A feature's one estimate, kept in one unit of effort and shown in the unit the reader picks.
- **Customer:** A built-in table with a name.
- **Product:** A built-in table with a name. Features are part of products through a column users add.

The values of every built-in field are set out in the [Decisions Log](../product/decisions.md).

## Release Entities

- **Cycle:** A planning period, with a name, a start date, and an end date, made ahead from its release stream's pattern.
- **Release:** A named delivery in one release stream, which includes one or more of its cycles. Its date is the end of its last cycle, and its contents are the features that target those cycles.
- **Release stream:** Defines a cycle length and naming pattern, from a given date, and groups releases. Patches and major releases are separate streams.

## Workforce Entities

- **Person:** An employee, current or former, with their preferred name, Employee ID, start and end dates, values for the columns added to People, and their work email address if the link to user accounts proposed below is adopted. Whether they are active follows from their start and end dates.
- **Team:** Can be named. Links a manager to their direct reports.
- **Feature team:** Can be named. Links a set of features to its members and its feature lead. Membership is separate from reporting lines.
- **Feature team membership:** Links a person to a feature team from a given date. Future-dated memberships represent planned changes.
- **Reporting line:** Links a person to their manager from a given date. Future-dated lines represent planned changes.
- **Planned hire:** A role to be filled, with the details listed in the Decisions Log. Links to its team and manager and, when filled, to the new person.

**Proposal:** Measure team composition from people's positions and their team or feature team membership, and compare it with configurable composition targets.

**Proposal:** When variable capacity is added after v1, as the Decisions Log allows, give each person a monthly capacity, defaulting to a full month, so existing data needs no change.

**Proposal:** Model allocations so they point to either a person or a planned hire, and transfer them to the new person when the hire is filled. The alternative is to treat a planned hire as a person record in a "planned" state, which is simpler for allocations but mixes real and hypothetical people.

## Access Entities

- **User:** A local account with one or more roles, identified by its name and email address, which is also its user name, and signing in with a password.
- **Session:** A signed-in user's visit, which records the network address and browser it started from, for investigating security problems, and ends as set in [ADR 0002](../adr/0002-libraries.md).
- **Role:** Grants view or edit access to data tiers, and permissions such as approving plan changes.
- **Access record:** Records who did what, when, and to whom, without the values: a change to a user account, or a view or change of sensitive data. Records can only be added, never changed or removed.

Fields are assigned to tiers as set in the Decisions Log, and tier checks happen in the data access layer, as set in [ADR 0001](../adr/0001-tech-stack.md).

**Proposal:** Allow a user account to be linked to the person record for the same employee, so Fathom can tell who a user is in the org chart and give them access to their own record and their reports, as proposed in [Roles](../product/roles.md), which also sets out how links are made. Not every user needs one.

## Configuration Entities

Built-in tables and custom fields and tables are set out in the [Decisions Log](../product/decisions.md#configuration), and how they are stored is proposed in [ADR 0005](../adr/0005-flexible-data-model.md).

- **Field definition:** A custom field on a built-in or custom table, with a name, field type, sensitivity tier, and whether it must be filled in or be unique. A Person or Link field also names the table it links to. A "Choice from a list" field, the first built, names its list, takes its tier from the list's visibility, and says whether it takes one choice or several.
- **Column order:** The order of a table's columns, built-in and custom alike, the same for every user.
- **Saved view:** A table's search, filters, and sort, saved under a name unique within the table, with the user who saved it. Its sensitivity is that of the most sensitive column it filters or sorts on.
- **Custom table:** A table users define, with a name, a sensitivity tier, and its field definitions.
- **Custom record:** One row of a custom table, holding values for its fields.
- **Custom value:** The value of one custom field for one record, built-in or custom.
- **List:** A list of choices that people define, with a name, a description, a visibility, and whether it is retired. Columns elsewhere draw on lists.
- **Choice:** One entry in a list, with a name, a description, its place in the list's order, and whether it is retired.

## Change and History Entities

- **Change set:** Changes saved together, with who made them and when. Until the Draft and Approval slice of the [Implementation Plan](implementation-plan.md) is built, each is applied as it is saved.
- **Change:** One field of one record changed in a change set, with its sensitivity tier and its old and new values.
- **Snapshot:** A point-in-time copy of part of the plan. Its contents are set in the Decisions Log.

**Proposal:** Extend change sets to drafts. Each plan change is one draft edit, such as a new allocation or moved dates. An editor submits a change set for approval, and approving it applies its changes to the live plan. A change set can be compared with the approved plan or with another change set, which also supports what-if scenarios if they turn out to be the same feature.

## Not Yet Modeled

Initiatives, themes, and priorities are not built in: an organization that uses them adds them as columns. How projects relate to products, if at all, is not yet decided. Physical resources are a future possibility in the [Product Brief](../product/brief.md#future-possibilities). Dotted-line reporting relationships and licenses are out of scope for v1, as listed in the [Product Brief](../product/brief.md).

## Open Questions

1. **Allocations with variable capacity:** Once a person can have less than a full month, does a 50% allocation mean half a month, or half of that person's capacity?
