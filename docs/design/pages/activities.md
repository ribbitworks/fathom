---
title: "Activities Page"
category: "Design"
audience: "Contributors"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/design/visual-design.md", "docs/standards/ui-conventions.md", "docs/design/pages/features.md", "docs/help/activities.md"]
last_updated: "2026-11-25"
---

# Fathom: Activities Page

Activities lists the work releases and projects need that isn't a feature, such as release testing or data migration, in one table. It sits in the sidebar's Plan section, after Features, for every role that sees features.

[Activities help](../../help/activities.md) describes it for the people who use it. [Visual Design](../visual-design.md) covers what every page shares, and [Domain Model](../domain-model.md#activity) what an activity is.

## Layout

- **Heading:** the title alone, with no Table or Board switch; at the right, New column for those who edit features and see people, then New activity.
- **The table:** the shared table, edited as Features' is, with its search, Draft menu, Metrics, Group by, Views and Export.
- **Details:** grouped under Details (Name to Notes, then Release and Project), Planning (Priority to Staffed), then Columns, the added ones. The table starts its columns in the details' order.
  - **Release and Project:** links, with their pencils, as a feature's Release and Projects: the release, named with its schedule, opens its schedule on Releases; the project, its Project ID first and dimmed, opens its details on Projects.
- **Built as Features is:** the page is Features' page with another tab of the plan, sharing its record actions, details and New form; activities come with the plan's read.

## Columns

- **Order:** Name, Status, Description, Notes, Release, Project, Priority, Needed by, Effort, Size, Risk, Feature team, Staffed, then added columns.
- **Shared with Features:** every column but Release and Project is Features' own, drawn by the same code, with the same rules, such as No team for a Planned or In progress activity with no feature team.
- **Staffed:** No for every committed activity until allocating to activities is built.
- **Release and Project:** exactly one is filled.
  - **Release:** names a release with its schedule, such as Platform: Harbor 1, as a cycle is named.
  - **Project:** names a project with its Project ID first, as Features' Projects does.
  - **Moving:** choosing a value in the empty one moves the activity there, as a draft, and clears the other.
  - **Clearing:** clearing the filled one is refused under the row, as any refused value is: "Choose a release or a project".
- **New activity:** the shared New form, with Release and Project as two pickers, neither marked required. Add with neither, or both, is refused under Release, with focus there, and nothing is sent: "Choose a release or a project", or "Choose a release or a project, not both".

## Grouping

Group by offers Needed by and each column of choices: Status, Release, Project, Feature team, Priority, Size, Risk and the added choice columns, with Then by. Grouped by Release, a project's activities fall under its empty heading, and the other way round.

## Planned

- **Releases:** a release's details listing its first five activities, its row's name a link to Activities, with Add activity, and Releases' Activities column, come with the Releases changes, as a project's are on [Projects](projects.md#record-details) ([issue #207](https://github.com/ribbitworks/fathom/issues/207)).
- **A project's list:** Total effort under it, and a draft's mark on each activity a draft adds to the project or takes from it, as a project's Features row marks its features.
- **Staffed:** No until allocating to activities is built ([issue #207](https://github.com/ribbitworks/fathom/issues/207)).
- **Duplicate…:** in an activity's row menu and details, with duplicating features.
- **Colour:** an activity's colour, saved at once with no draft, comes with feature colours.
- **A Board of activities** is later.
