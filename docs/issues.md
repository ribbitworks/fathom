# Fathom: Issues

**Status:** Moved to GitHub Issues
**Last updated:** 2026-11-12

Known problems and deferred work not yet scheduled in the [Implementation Plan](design/implementation-plan.md) are kept in [GitHub Issues](https://github.com/jlarue26/fathom/issues), moved there from this document on 2026-11-12, as the owner decided.

## Filing an Issue

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

- **Who decides:** The owner decides stages and priorities. Whoever files an issue suggests its labels.
- **Milestones:** Each stage of the [Roadmap](product/roadmap.md) is a [GitHub milestone](https://github.com/jlarue26/fathom/milestones), holding a Feature issue for each feature in it. An issue in no milestone is not yet placed.
- **No project board** at first.

## Fixing an Issue

A pull request that fixes an issue says `Fixes #n` in its description, so merging it closes the issue. Never in commit messages or code comments.
