---
title: "History Pages"
category: "Design"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/design/visual-design.md", "docs/standards/ui-conventions.md"]
last_updated: "2026-11-19"
---

# Fathom: History Pages

Change history and Access history list what was done in Fathom, newest first. They sit after Drafts in the sidebar's History section.

[Change history help](../../help/change-history.md) and [Access history help](../../help/access-history.md) describe them for the people who use them, and [Visual Design](../visual-design.md) covers what every page shares.

## Layout

- **Parts:** A search field, then one row per entry, written as [History](../../standards/ui-conventions/pages-and-panels.md#history) sets out, with Show more at the end of Change history.
- **Change history search:** Runs on the server, in who made each change and the names and values involved.
- **Access history search:** Covers only the entries shown.
- **Someone yet to start:** Readers who don't see Personal data see no change naming them, such as a hire's manager, nor who fills a hire, as [Roles § New employees](../../product/roles.md#who-sees-which-people) sets out.
