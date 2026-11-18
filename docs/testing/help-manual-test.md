---
title: "Manual Test: Help"
category: "How-To"
audience: "AI Coding Assistant"
applies_to: ["apps/web/src/**", "docs/help/**"]
dependencies: ["docs/standards/testing.md", "docs/design/visual-design.md"]
last_updated: "2026-11-18"
---

# Manual Test: Help

## Scope

Verifies what only a person can judge of Help in Fathom: how a Help page reads, and following links between Help pages to a page and to a heading on it, from the mouse and the keyboard, and going back.

## Test Environment

As [Manual Test Basics](manual-test-basics.md#test-environment) sets out.

## Test Accounts

As [Manual Test Basics](manual-test-basics.md#test-accounts) sets out, this test uses:

- **Team Member:** `team.member@fathom.test`

## Common Procedures

This test uses [Start Fathom](manual-test-basics.md#start-fathom).

## Terms

[Manual Test Basics](manual-test-basics.md#terms) defines the terms every test uses.

## Test Cases

Start with Start Fathom. Record each step's result as [Manual Test Basics](manual-test-basics.md#recording-results) sets out.

### HELP-01: Reading Help and Following Its Links

**Account:** Team Member, `team.member@fathom.test`; the first test case.

**Preconditions:** Signed in with this account. **Overview** page open.

- [ ] `34DB` Select **Help pages** under **Help** in the left-hand menu.
  - **Expected:**
    - The page is headed **Help**.
    - Under it, headings each sit over a list of links, spaced so each heading and list read as one group.
    - The text sits in one bordered panel as wide as the page.
  - **Notes:**

- [ ] `3076` Select **Working as a Team Member** under **Working in Fathom**.
  - **Expected:**
    - The page is headed **Working as a Team Member**, and the window shows its top.
    - Its numbered steps count from 1 under each heading.
  - **Notes:**

- [ ] `E536` Select the **Features** link at the end of the step about grouping by **Cycle** or **Release**.
  - **Expected:**
    - The **Features** Help page opens in the same tab.
    - The window has scrolled to the heading **Group the Table**, at its top.
  - **Notes:**

- [ ] `A5BD` Select the browser's Back button.
  - **Expected:** **Working as a Team Member** shows again.
  - **Notes:**

- [ ] `5764` Select the heading **See What's Planned**.
  - **Expected:** Nothing opens.
  - **Notes:**

- [ ] `2269` Press Tab.
  - **Expected:** The **Features** link at the end of the next step shows a focus ring.
  - **Notes:**

- [ ] `6B8B` Press Enter.
  - **Expected:** The **Features** Help page opens in the same tab.
  - **Notes:**

- [ ] `1041` Select **Help pages** under **Help** in the left-hand menu.
  - **Expected:** The page headed **Help** shows.
  - **Notes:**

- [ ] `BF3A` Select **Pages** under **Finding Your Way**.
  - **Expected:**
    - The page is headed **Pages**.
    - Each page listed is a link followed by what it's for, with two lines set in under it, easy to tell apart from the next page.
  - **Notes:**
