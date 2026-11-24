// SPDX-License-Identifier: Apache-2.0

// Fictional people's names, from several countries and in several scripts.

import {
  base,
  da,
  de,
  en,
  en_CA,
  en_IN,
  es,
  type Faker,
  fr,
  fr_CA,
  ja,
  ko,
  ru,
  sv,
  zh_CN,
} from "@faker-js/faker";

// Where people's names come from, and how many in each hundred: mostly Canada, in English and
// French, then India, where the organization also works, then a few from elsewhere, some with
// accented letters and some in other scripts, so every screen and search is tried with them.
// Faker's Canadian locales have no names of their own, so English Canadian names come from its
// English ones and French Canadian names from its French ones. Each source has a generator of its
// own, so names never change anything else generated.
export const nameSources = [
  { weight: 45, locale: [en_CA, en, base], order: "given first" },
  { weight: 10, locale: [fr_CA, fr, en, base], order: "given first" },
  { weight: 15, locale: [en_IN, en, base], order: "given first" },
  { weight: 5, locale: [de, en, base], order: "given first" },
  { weight: 5, locale: [es, en, base], order: "given first" },
  { weight: 3, locale: [sv, en, base], order: "given first" },
  { weight: 2, locale: [da, en, base], order: "given first" },
  { weight: 4, locale: [ko, en, base], order: "as written" },
  { weight: 4, locale: [ja, en, base], order: "as written" },
  { weight: 4, locale: [zh_CN, en, base], order: "as written" },
  { weight: 3, locale: [ru, en, base], order: "given first" },
] as const;

type NameSource = (typeof nameSources)[number];

// A name as people from the country write it: Korean, Japanese, and Chinese names family name first,
// as Faker writes them, and others given name first, with a family name that matches, as Russian
// family names do, and never with a title such as Dr.
export function name(namer: Faker, order: NameSource["order"]): string {
  if (order === "as written") return namer.person.fullName();
  const sex = namer.person.sexType();
  return `${namer.person.firstName(sex)} ${namer.person.lastName(sex)}`;
}
