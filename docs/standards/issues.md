---
title: "Issues"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*"]
dependencies: ["docs/standards/agent-workflow.md", "docs/standards/code-review.md"]
last_updated: "2026-11-20"
---

# Issues

Known problems and deferred work are kept in [GitHub Issues](https://github.com/ribbitworks/fathom/issues).

## Filing an Issue

- **Maintainer's approval:** An agent files an issue only with the maintainer's explicit approval. It proposes the title, labels and body to the maintainer first, and files only those the maintainer approves; one not approved is named in the pull request or the agent's report instead. A gap in a document is fixed on the branch in hand rather than proposed.
- **From outside:** Issues are welcome from people the maintainer invites into the `ribbitworks` organization, as [Contributing](../../CONTRIBUTING.md) sets out. Others may be closed without a reply.
- **Forms:** [New issue](https://github.com/ribbitworks/fathom/issues/new/choose) offers one form for each kind: Bug, Quality of life, Feature and Debt. Blank issues are turned off, and the page links to private reporting for vulnerabilities, as the [Security Policy](../../SECURITY.md) sets out.
- **What each asks:** What happens or what is wanted, why it matters, where, the background someone new to Fathom needs, with links, and how to tell it is done. A bug adds its steps, what was expected, its probability and its severity; the others add when.
- **Links:** Every link in an issue is a full GitHub link to a file or heading on `main`. Another issue may be named by its number, such as #54, which GitHub links.
- **One place:** Once something is an issue, it lives only on GitHub. Documents link to the issue rather than repeat it.

## Labels

- **Kind:** `bug`, `quality-of-life`, `enhancement` for a feature, and `debt`. Each form sets its own.
- **Priority, for a bug:** `P1` to `P4`, from its probability and severity, as the table below sets out. P1 is fixed next, P2 in the next change that touches its area, and P3 and P4 in a cleanup pass.
- **When, for the rest:** `now` for the current work, `next` for soon after, `later` for when its area is next changed or it is wanted, and `maybe` for only if a need arises.
- **Area:** One `area: …` label, such as `area: planning`. `area: releases` is for the Releases page, `area: release process` for Fathom's own versioning and releases, and `area: tables` for the shared table on every page.
- **May be fixed:** `may-be-fixed` marks an issue that later work may already have fixed. Check whether it still happens before working on it, and close it if not.

| Probability | Severe | Moderate | Minor |
| --- | --- | --- | --- |
| Likely | P1 | P2 | P3 |
| Possible | P2 | P3 | P4 |
| Rare | P3 | P4 | P4 |

## Triage and Milestones

- **Who decides:** The maintainer decides stages and priorities. Whoever proposes an issue suggests its labels.
- **Roadmap:** The pinned [Roadmap](https://github.com/ribbitworks/fathom/issues/398) issue sets the order in which Fathom's goals are delivered. It is edited directly and has no labels. It has a section for each milestone, the five stages, Before Going Live and v1.1, each with its goal, a link to the milestone and its issues. Every milestone's open issues are the Roadmap's sub-issues.
- **Milestones:** Each stage of the Roadmap is a [GitHub milestone](https://github.com/ribbitworks/fathom/milestones), holding a Feature issue for each feature in it. An issue in no milestone is not yet placed. A feature that joins or leaves a milestone changes its milestone, the Roadmap's section and its sub-issues together.
- **No project board.**

## Fixing an Issue

- **Before a task:** List the open issues for each area the task touches, with `gh issue list -R ribbitworks/fathom --label "area: <area>" --state open`, and search the issues for the files it will change.
- **Along the way:** Fix the area's P2 bugs, and its cheap `later` items too if they add little to the pull request. Check a `may-be-fixed` issue first, as [Labels](#labels) sets out.
- **The pull request:** Says `Fixes #n` in its description for each issue it fixes, so merging it closes the issue, never in commit messages or code comments. It names any open issues it leaves in its areas, and why.

## Issue Batches

A task that is a set of issues in one area is a batch, worked in Autonomous mode only. A batch is an exception to the [Autonomous workflow](agent-workflow.md#autonomous-mode), which reviews each change before it is committed:

- **One branch per area:** Such as `fix/releases-issues`, holding one area only and under about 1,500 added lines.
- **Each issue:** Fixed, checked with `pnpm check:push`, as [Testing Standards](testing.md#running-tests) sets out for the checks while working, and committed on its own.
- **Once, for the whole branch:**
  1. The maintainer's screen check, if any screen changed, and the maintainer's approval or run of any manual test the batch adds or significantly changes
  1. One separate-agent review of the whole branch, since its commits had no review of their own, as the [Agent Workflow](agent-workflow.md#pushing-and-pull-requests) sets out for a commit that skipped review
  1. The full check on the pull request, once the review's findings are fixed, as [Testing Standards](testing.md#running-tests) sets out
  1. The pull request, as [Fixing an Issue](#fixing-an-issue) sets out
- **Failures found at the end:** Fixed in a new commit, never by changing earlier ones.
