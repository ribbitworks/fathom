# Fathom: Issues

**Status:** Moved to GitHub Issues
**Last updated:** 2026-11-13

Known problems and deferred work not yet scheduled in the [Implementation Plan](design/implementation-plan.md) are kept in [GitHub Issues](https://github.com/jlarue26/fathom/issues), moved there from this document on 2026-11-12, as the owner decided.

## Filing an Issue

- **Owner's approval:** An agent files an issue only with the owner's explicit approval. It proposes the title, labels and body to the owner first, and files only those the owner approves; one not approved is named in the pull request or the agent's report instead. A gap in a document is fixed on the branch in hand rather than proposed. Decided by the owner on 2026-11-13.
- **Forms:** [New issue](https://github.com/jlarue26/fathom/issues/new/choose) offers one form for each kind: Bug, Quality of life, Feature and Debt. Blank issues are turned off.
- **What each asks:** What happens or what is wanted, why it matters, where, the background someone new to Fathom needs, with links, and how to tell it is done. A bug adds its steps, what was expected, its probability and its severity; the others add when.
- **Links:** Every link in an issue is a full GitHub link to a file or heading on `main`.
- **One place:** Once something is an issue, it lives only on GitHub. Documents link to the issue rather than repeat it.

## Labels

- **Kind:** `bug`, `quality-of-life`, `enhancement` for a feature, and `debt`. Each form sets its own.
- **Priority, for a bug:** `P1` to `P4`, from its probability and severity, as the table below sets out. P1 is fixed next, P2 in the next change that touches its area, and P3 and P4 in a cleanup pass.
- **When, for the rest:** `now` for the current work, `next` for soon after, `later` for when its area is next changed or it is wanted, and `maybe` for only if a need arises.
- **Area:** One `area: …` label, such as `area: planning`.
- **May be fixed:** `may-be-fixed` marks an issue that later work may already have fixed. Check whether it still happens before working on it, and close it if not.

| Probability | Severe | Moderate | Minor |
| --- | --- | --- | --- |
| Likely | P1 | P2 | P3 |
| Possible | P2 | P3 | P4 |
| Rare | P3 | P4 | P4 |

## Triage and Milestones

- **Who decides:** The owner decides stages and priorities. Whoever proposes an issue suggests its labels.
- **Milestones:** Each stage of the [Roadmap](product/roadmap.md) is a [GitHub milestone](https://github.com/jlarue26/fathom/milestones), holding a Feature issue for each feature in it. An issue in no milestone is not yet placed.
- **No project board** at first.

## Fixing an Issue

- **Before a task:** List the open issues for each area the task touches, with `gh issue list -R jlarue26/fathom --label "area: <area>" --state open`, and search the issues for the files it will change.
- **Along the way:** Fix the area's P2 bugs, and its cheap `later` items too if they add little to the pull request. Check a `may-be-fixed` issue first, as [Labels](#labels) sets out.
- **The pull request:** Says `Fixes #n` in its description for each issue it fixes, so merging it closes the issue, never in commit messages or code comments. It names any open issues it leaves in its areas, and why.

## Issue Batches

A task that is a set of issues in one area is a batch, worked in Autonomous mode only. A batch is an exception to the [Autonomous workflow](standards/shared/agent-workflow.md#autonomous-mode), which reviews each change and has the owner approve it before it is committed, as the owner decided on 2026-11-13:

- **One branch per area:** Such as `fix/releases-issues`, holding one area only and under about 1,500 added lines.
- **Each issue:** Fixed, checked with `pnpm test:changed`, the linters and type checking, as [Testing Standards](standards/testing.md#running-tests) runs them while working, and committed on its own.
- **Once, for the whole branch:**
  1. The owner's screen check, if any screen changed
  1. One full `pnpm check`
  1. One separate-agent review of the whole branch
  1. The owner's approval of the batch
  1. The pull request, as [Fixing an Issue](#fixing-an-issue) sets out
- **Failures found at the end:** Fixed in a new commit, never by changing earlier ones.
