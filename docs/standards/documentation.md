---
title: "Documentation Standards (Fathom)"
category: "Standards"
audience: "AI Coding Assistant"
applies_to: ["**/*"]
dependencies: ["docs/standards/shared/documentation.md", "docs/standards/shared/markdown-style-guidelines.md", "docs/standards/help-pages.md"]
last_updated: "2026-11-15"
---

# Documentation Standards

Fathom's additions to the shared [Documentation](shared/documentation.md) standard, which sets out how every document is structured and written, with [Markdown Style Guidelines](shared/markdown-style-guidelines.md) for formatting. Help pages also follow [Help Page Standards](help-pages.md), and manual tests [Testing Standards § Manual Tests](testing.md#manual-tests).

## Rules

- **Must** write documents and on-screen text in Canadian English, such as colour, harbour, centre, and licence as a noun, decided by the owner on 2026-11-11.
- **Must** file known problems and deferred work as GitHub issues through the issue forms, only with the owner's explicit approval and with the labels [Issues](../issues.md) sets out, rather than in a document, and link to the issue from any document that needs it. A pull request that fixes one says `Fixes #n` in its description, never in commit messages or code comments.
- **Must** record each fact in one document only, and link to it from others instead of repeating it. Each document owns what [Which Document Owns What](#which-document-owns-what) lists.
- **Must** keep each open question in the document that will own its answer.

## Which Document Owns What

- Contributing (`CONTRIBUTING.md`): who may contribute, and how issues and questions come in
- Security policy (`SECURITY.md`): how to report a vulnerability, and which versions are supported
- Code of conduct (`CODE_OF_CONDUCT.md`): the Contributor Covenant, with where reports go
- Product brief (`docs/product/brief.md`): what Fathom is, its users, goals, scope, and constraints, with one-line key decisions that link to the decisions log or an ADR
- Domain concepts (`docs/product/domain.md`): definitions of terms
- Decisions log (`docs/product/decisions.md`): product decisions and their details
- Use cases (`docs/product/use-cases.md`): scenarios
- Roles (`docs/product/roles.md`): role definitions and what each role can do
- Roadmap (`docs/product/roadmap.md`): the order in which Fathom's goals are delivered
- Domain model (`docs/design/domain-model.md`): entities, relationships, and modeling proposals
- Architecture (`docs/design/architecture.md`): a high-level view of Fathom's parts and how they connect, kept at the level of containers and networks
- Development setup (`docs/design/development-setup.md`): repository layout, local development, and seed data
- Visual design (`docs/design/visual-design.md`): how Fathom's screens look and behave
- UI conventions (`docs/design/conventions.md`): the conventions every screen shares, each with the shared piece that draws it and an example
- Implementation plan (`docs/design/implementation-plan.md`): how the roadmap's stages are built, slice by slice
- Architecture decision records (`docs/adr/`): technical decisions
- Issues ([GitHub Issues](https://github.com/jlarue26/fathom/issues), as `docs/issues.md` sets out): known problems and deferred work not yet scheduled in the implementation plan
- Security plan (`docs/security/security-plan.md`): threats and their mitigations, vulnerability scanning, and source code assurance
- Manual tests (`docs/testing/`, with each role's acceptance test in `docs/testing/acceptance/`): lasting step-by-step tests of a feature by hand in a real browser, following [Testing Standards § Manual Tests](testing.md#manual-tests)
- Manual test basics (`docs/testing/manual-test-basics.md`): what every manual test shares, its environment, where its accounts come from, the common procedures, named, and the common terms
- Help pages (`docs/help/`): how to use each page of Fathom, and the workflows each role does most, for the people who use it, listed in `docs/help/index.md`; a guide that repeats facts the documents above own, kept consistent with them, and updated by every change to the page it covers
- Securing your environment (`docs/operations/securing-your-environment.md`): what whoever runs Fathom must secure, since Fathom can't
- Supported platforms (`docs/operations/supported-platforms.md`): the platforms Fathom is tested and supported on, and their setup needs
- How Fathom is built (`docs/how-fathom-is-built.md`): for outside readers, how Fathom is made and how its quality is checked; a summary that repeats facts the standards, the Security Plan, the data protection summary and the manual tests own, kept consistent with them; and the one home of the AI tool and models used, updated when either changes
- Data protection summary (`docs/privacy/data-protection.md`): a short list of what safeguards Fathom's data, linking to the documents above that own the facts; update it whenever those facts change
