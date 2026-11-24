// SPDX-License-Identifier: Apache-2.0

// The newest starters' onboarding notes: their checklists, and the handbook the starter furthest
// along keeps.

import { onboardingColumn } from "./lists.ts";
import type { FictionalPerson } from "./types.ts";

// Who has an onboarding note: the newest few who start after the reference date, and the newest
// who have already started.
export const onboarding = { starting: 2, started: 6 } as const;

// The steps of an onboarding checklist, the second naming the starter's buddy.
export const onboardingSteps = (buddy: string): string[] => [
  "Laptop and accounts ready",
  `Met the team and their buddy, **${buddy}**`,
  "First change merged",
  "Shadowed an on-call shift",
];

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// A day, given as YYYY-MM-DD, in words, such as 18 February 2027, the same whatever the computer's
// language.
function inWords(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return `${String(date)} ${String(months.at(Number(month) - 1))} ${String(year)}`;
}

// An onboarding checklist as a note, with its first steps done and a status in colour: to start on
// a day, on track, or done once every step is.
function onboardingNote(
  buddy: string,
  done: number,
  startsOn: string | null,
): string {
  const steps = onboardingSteps(buddy);
  const status =
    startsOn !== null
      ? `<span data-colour="orange">Starts on ${inWords(startsOn)}</span>`
      : done === steps.length
        ? '<span data-colour="green">Done</span>'
        : '<span data-colour="teal">On track</span>';
  return [
    startsOn === null ? "## First weeks" : "## Before day one",
    "",
    ...steps.map((step, index) => `- [${index < done ? "x" : " "}] ${step}`),
    "",
    status,
    "",
    "Steps from the [onboarding guide](https://example.com/onboarding).",
  ].join("\n");
}

// The handbook the starter furthest along keeps in their onboarding note, a few pages long, so a
// long note shows folded in their details.
export const starterHandbook = [
  "## Starter handbook",
  "",
  "These are the notes kept through the first weeks, so the next starter can pick them up. Each section is short on its own; together they cover what comes up most often.",
  "",
  "### The first day",
  "",
  "Arrive by half past nine. The team meets by the windows on the third floor, and the first hour goes on getting into the laptop and the accounts it needs. Bring identification for the building pass; the pass desk closes at noon.",
  "",
  "- Sign in to the laptop and change the password it came with",
  "- Join the team's chat channels and the shared calendar",
  "- Read the team's working agreement, which takes about twenty minutes",
  "- Book a short call with the buddy for the end of the day",
  "",
  "Lunch on the first day is with the whole team. Nobody expects any real work before the afternoon, and most of the afternoon goes on reading.",
  "",
  "### The first week",
  "",
  "The first week is for reading and asking. Every question is a good one, and the buddy answers or knows who can. Keep a list of anything that surprised you; the team uses it to improve this handbook.",
  "",
  "- Read the architecture overview and the decisions behind it",
  "- Build the product on the laptop, and run its tests",
  "- Pair with the buddy on a small change, from the first line to its review",
  "- Sit in on the planning meeting and the review at the end of the week",
  "- Write down three things that could be clearer, and share them",
  "",
  "By Friday, the aim is to have made one small change and to know where to look for help.",
  "",
  "### How the team works",
  "",
  "The team plans in two-week cycles. Each cycle starts with planning on a Monday and ends with a review and a short look back on the second Friday. Work is picked from the top of the backlog, and anything urgent is talked about in the morning stand-up before it is started.",
  "",
  "- **Stand-up:** fifteen minutes at ten, standing or on a call",
  "- **Reviews:** every change is read by someone else before it merges",
  "- **Pairing:** encouraged for anything new or tricky, and for the first month",
  "- **Focus time:** no meetings on Wednesday afternoons",
  "",
  "Questions about priorities go to the team lead. Questions about the product go to its product manager, who sits with the team two days a week.",
  "",
  "### Tools to learn",
  "",
  "Most of the tools are the usual ones, set up the team's way. Learn them in this order, since each builds on the last.",
  "",
  "- The editor and the shared settings for it",
  "- Version control, and the branch and review rules",
  "- The build and its tests, and how to run one test alone",
  "- The issue tracker, and the labels the team uses",
  "- The dashboards that show how the product is doing",
  "",
  "### On call",
  "",
  "Nobody goes on call alone in their first three months. After the first month, shadow two shifts, then take one with the buddy as a second. The runbooks are kept beside the code, and each alert links to the one it needs.",
  "",
  "- [x] Read the runbooks for the three busiest alerts",
  "- [x] Shadow a weekday shift",
  "- [ ] Shadow a weekend shift",
  "- [ ] Take a shift with the buddy as second",
  "",
  "### The first month",
  "",
  "By the end of the first month, the aim is to work on the team's usual changes without help, to have reviewed others' changes, and to have taken part in a planning meeting with ideas of one's own.",
  "",
  "- [x] Merge a change that users see",
  "- [x] Review three changes by others",
  "- [ ] Lead the demonstration at a review",
  "- [ ] Suggest an improvement to this handbook",
  "",
  "### People to meet",
  "",
  "Besides the team, a few people are worth meeting early, each for half an hour. The buddy can set up the meetings.",
  "",
  "- The product manager, about where the product is heading",
  "- The designer, about how screens are decided and checked",
  "- Someone from support, about what users ask most",
  "- The team lead of the neighbouring team, about the work the two teams share",
  "",
  "### Where things are",
  "",
  "The kitchen is at the end of the corridor, and the quiet room beside it can be booked for calls. Printers are on every floor. The first-aid kit is in the kitchen, and the fire exits are marked at both ends of the floor.",
  "",
  "### Common questions",
  "",
  "**When are changes released?** At the end of each cycle, after the review. Small fixes can go out between cycles once the team lead agrees, and the release notes say what went out and why.",
  "",
  "**What if a review takes a long time?** Mention it at stand-up. Reviews are meant to be done within a working day, and anyone on the team may pick one up, not only the person asked.",
  "",
  "**How much should a change hold?** As little as makes sense on its own. A change that can be read in ten minutes gets a better review than one that takes an hour, and it is easier to undo.",
  "",
  "**Who decides what goes in a cycle?** The team, at planning, from the backlog the product manager keeps in order. Anyone may suggest moving something up, with a reason.",
  "",
  "**What happens when something breaks?** Whoever notices says so in the team's channel straight away. The person on call leads, others help where asked, and a short write-up follows within the week, without blame.",
  "",
  "**Where do ideas go?** Into the backlog, as a short description of the problem rather than a solution. The product manager looks at new ideas every week and talks about them at planning.",
  "",
  "**How is time off booked?** In the shared calendar, as early as possible, and mentioned at planning if it falls in the cycle. Cover for on call is swapped with someone on the rota and noted in the calendar too.",
  "",
  "### Habits that help",
  "",
  "- Write down what you learn the day you learn it",
  "- Ask early rather than late; an hour stuck is long enough",
  "- Leave the code a little clearer than you found it",
  "- Say what you are working on, so nobody does it twice",
  "- Take the breaks; the work is better for them",
  "",
  "### Looking back",
  "",
  "At the end of the third month, the starter and their manager look back together: what went well, what was hard, and what to change for the next starter. Add what you learn here, so the handbook keeps getting better.",
].join("\n");

// The newest starters who have not left, each with a buddy who started before all of them: those
// still to start have done nothing yet, and those who have started are further along the earlier
// they started, the earliest done. A buddy is never the starter, so an organization too small for
// every starter to have one gives notes to fewer.
export function addOnboardingNotes(
  people: readonly FictionalPerson[],
  referenceDate: string,
): void {
  const current = people
    .filter(({ endDate }) => endDate === null)
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  const starting = current
    .filter(({ startDate }) => String(startDate) > referenceDate)
    .slice(0, onboarding.starting);
  const started = current
    .filter(({ startDate }) => String(startDate) <= referenceDate)
    .slice(0, onboarding.started);
  const buddies = current.filter(
    (person) =>
      String(person.startDate) <= referenceDate && !started.includes(person),
  );
  const paired = [...starting, ...started].flatMap((person, index) => {
    const buddy = buddies.at(index);
    return buddy === undefined ? [] : [{ person, buddy }];
  });
  const begun = paired.filter(({ person }) => started.includes(person));
  const stepCount = onboardingSteps("").length;
  for (const { person, buddy } of paired) {
    const at = begun.findIndex((pair) => pair.person === person);
    const note = onboardingNote(
      buddy.preferredName,
      at < 0 ? 0 : Math.ceil(((at + 1) * stepCount) / begun.length),
      at < 0 ? String(person.startDate) : null,
    );
    // The starter furthest along, the last of those begun, keeps the handbook too.
    person.notes[onboardingColumn.id] =
      person === begun.at(-1)?.person ? `${note}\n\n${starterHandbook}` : note;
  }
}
