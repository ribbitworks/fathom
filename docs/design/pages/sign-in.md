---
title: "Sign-In and Problem Pages"
category: "Design"
audience: "Contributors"
applies_to: ["apps/web/src/**"]
dependencies: ["docs/design/visual-design.md", "docs/standards/ui-conventions.md"]
last_updated: "2026-11-23"
---

# Fathom: Sign-In and Problem Pages

The sign-in page, the first password change and the problem pages each show a single card on a background of their own. The first password change replaces every page for a user signed in with a password Fathom generated.

[Accounts help](../../help/accounts.md) describes generated passwords for the people who manage accounts, and [Visual Design](../visual-design.md) covers what every page shares.

## Layout

- **Brand:** Only Fathom's name and mark sit above the card, with no other words.
- **Background:** The theme's `--fathom-sign-in`, a light sea blue or, in dark mode, the sidebar's deep water.
- **First password change:** A Change password panel with the current password and the new one twice, then Sign out and Change password. The new password must differ from the generated one.
- **Password checklist:** Under the new password, here and in the Change password dialog, listing each rule from [Settings](administration.md#password-requirements) from the start, and ending with the check that it isn't common or easy to guess.
  - Each line shows its state by mark and words, never colour alone: a green check, a dimmed circle while typing, a red cross once the field is left.
