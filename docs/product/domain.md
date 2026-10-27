# Fathom — Domain Concepts

**Status:** Draft
**Last updated:** 2026-10-26

How the organization's software work is structured. These definitions inform the data model and roadmap planning later. They are not necessarily input into the [Use Cases](use-cases.md). See also the [Product Brief](brief.md) and the [Decisions Log](decisions.md).

## Terms

- **Project:** Software projects are run by Project Managers. Projects contain features and have project numbers. A project delivers requirements from its customers, or from products where the work is driven internally, for example by business development. A project's timeline is not necessarily tied to releases, although a release will likely deliver all of a project's scope. Projects are less important on the roadmap.
- **Initiative:** Not the same as a project, but likely to be allocated to one.
- **Software Engineering Manager:** Has a dotted-line relationship to the Project Managers of the projects their team works on.
- **Customer:** There are one or more customers, which can be external, internal, or both. External customers pay for new or updated features that meet their requirements. A project has one or more customers who drive, and pay for, its requirements. Products can also be sold to new customers whose requirements a product already meets.
- **Product:** There are several products. The aim is to make features available to all customers, although this is not always possible.
- **License:** Controls which features are available to which customer. Licenses wall off customer-specific requirements and control which features are sold and available to each customer.
- **Feature:** Usually part of one product, but can span products. Features have milestones, which may or may not line up with project milestones. Features may span releases, typically by being broken down into incremental functionality, developed on a branch, or gated by feature flags.
- **Cycle:** A periodic development cycle, currently six months. At the end of a cycle, the software can be released if so desired.
- **Release:** Includes one or more cycles. A release may span more than one cycle because release activities carry overhead, some releases must be certified by international organizations, and customers are not always able to keep up with releases.
- **Patch:** Patches are made probably four times a year. A patch is effectively a configured cycle and release.
- **Team:** The people who report to a manager.
- **Feature team:** The people working on a set of related features. Ideally a feature team is made up of the same people as a team, but not always. Feature teams deliver features included in a release, and are less concerned with projects.
- **Feature lead:** The person who leads a feature team.
- **Delivery:** Taking a feature, or an increment of it, from start to finish within a release, from requirements analysis to fully tested.

## Open Questions

1. **Customer and product requirements:** Does the distinction between customer-driven and product-driven requirements matter? The owner is not sure.
1. **Features across projects:** Can a feature belong to more than one project? The owner thinks it probably can.
1. **Software Engineering Manager's projects:** The owner describes Software Engineering Managers delivering scope to "SPMs", who own getting scope to the customer. Does SPM mean Software Project Manager or Software Product Manager, and are "their team's" projects those of their reporting team or of their people's feature teams?
