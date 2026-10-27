# Fathom — Domain Concepts

**Status:** Draft
**Last updated:** 2026-10-26

How the organization's software work is structured. These definitions inform the data model and roadmap planning later. They are not necessarily input into the [Use Cases](use-cases.md). See also the [Product Brief](brief.md) and the [Decisions Log](decisions.md).

## Terms

- **Project:** Software projects are run by Project Managers. Projects contain features and have project numbers. A project's timeline is not necessarily tied to releases.
- **Software Engineering Manager:** Has a dotted-line relationship to the Project Managers of the projects their team works on.
- **Customer:** There are one or more customers, which can be external, internal, or both. External customers pay for new or updated features that meet their requirements.
- **Product:** There are several products. The aim is to make features available to all customers, although this is not always possible.
- **License:** Controls which features are available to which customer. Licenses wall off customer-specific requirements and control which features are sold and available to each customer.
- **Feature:** Features may span releases, using feature flags or incremental functionality.
- **Team:** Teams delivering features are responsible for fully tested features included in a release. They are less concerned with projects.

## Open Questions

1. **Customers:** How do customers relate to projects, products, and features?
1. **Products and features:** Does each feature belong to one product, and can a feature belong to more than one project?
1. **Dotted lines in Fathom:** Should Fathom record dotted-line relationships and show them in the org chart and people view?
1. **Releases and licenses in Fathom:** Should Fathom track releases and licenses itself, or only refer to them?
