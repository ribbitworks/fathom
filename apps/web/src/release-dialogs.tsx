// SPDX-License-Identifier: Apache-2.0

// The dialogs of the Releases page: naming a release stream; changing a stream's cycles from a day,
// with their length and how they are named, showing the first names they make; one cycle's length,
// showing the cycles it makes and the releases that move; the day a stream's cycles are made
// until; and making or changing a release from consecutive cycles of its stream
// that no other release includes, shipping at the end of its last cycle or on a day of its own.
// Each saves its change as a draft, and cannot be closed while it saves.

import {
  addDays,
  addMonths,
  type Cycle,
  cyclesOf,
  defaultNaming,
  isDay,
  longestCycle,
  namingTokens,
  releaseLengths,
  type CyclePattern,
  type CycleUnit,
  type LaterCycles,
  type Release,
  type PaletteColour,
  paletteColours,
  type ReleaseStream,
  shipsBeforeStart,
} from "@fathom/shared";
import {
  Group,
  NumberInput,
  Radio,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Swatch } from "./colour-swatch.tsx";
import { DialogActions } from "./dialog-actions.tsx";
import { DayInput } from "./day-input.tsx";
import { Count } from "./list-dialog.tsx";
import classes from "./pages.module.css";
import {
  changeCycleLength,
  colourName,
  createStream,
  defaultColour,
  lastCycleEnd,
  lengthChangeOf,
  renameStream,
  type SavedStream,
  setCyclesUntil,
  shipsOffCycle,
  shownColour,
  savePattern,
  saveRelease,
} from "./releases.ts";
import { projectPlanQuery } from "./projects.ts";

interface Saving {
  onSaved: (saved: SavedStream) => void;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
}

function useSave<Request>(
  save: (request: Request) => Promise<SavedStream>,
  { onSaved, onBusy }: Saving,
) {
  return useMutation({
    mutationFn: save,
    onMutate: () => {
      onBusy(true);
    },
    onSettled: () => {
      onBusy(false);
    },
    onSuccess: onSaved,
  });
}

const same = (first: string, second: string) =>
  first.trim().toLowerCase() === second.trim().toLowerCase();

// A name's problem, if any: missing, too long, or one another record has.
function nameProblem(name: string, taken: boolean): string | undefined {
  if (name.trim() === "") return "Give a name";
  if (name.trim().length > releaseLengths.name) return "Too long";
  return taken ? "Already used" : undefined;
}

export function StreamDialog({
  stream,
  streams,
  ...saving
}: {
  // The stream being renamed; absent when adding one.
  stream?: ReleaseStream | undefined;
  streams: readonly ReleaseStream[];
} & Saving) {
  const [name, setName] = useState(stream?.name ?? "");
  const [tried, setTried] = useState(false);
  const save = useSave(
    (wanted: string) =>
      stream === undefined
        ? createStream(wanted)
        : renameStream(stream.id, wanted),
    saving,
  );
  const problem = nameProblem(
    name,
    streams.some((other) => other.id !== stream?.id && same(other.name, name)),
  );
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (problem === undefined) save.mutate(name.trim());
      }}
    >
      <Stack gap="md">
        <TextInput
          label="Name"
          data-autofocus
          value={name}
          error={tried || name !== "" ? problem : undefined}
          rightSection={
            <Count length={name.trim().length} maximum={releaseLengths.name} />
          }
          rightSectionWidth={56}
          onChange={(event) => {
            setName(event.currentTarget.value);
          }}
        />
        <DialogActions
          error={save.error}
          pending={save.isPending}
          label={stream === undefined ? "Add stream" : "Save"}
          onCancel={saving.onCancel}
        />
      </Stack>
    </form>
  );
}

// A few cycles by name, with their days, as a dialog shows what a change makes.
function CyclesPreview({
  id,
  title,
  cycles,
}: {
  id: string;
  title: string;
  cycles: readonly Cycle[];
}) {
  return (
    <Stack gap={2}>
      <Text fz="sm" fw={500} id={id}>
        {title}
      </Text>
      <Table
        aria-labelledby={id}
        withRowBorders={false}
        verticalSpacing={2}
        horizontalSpacing="xs"
        fz="sm"
      >
        <Table.Tbody>
          {cycles.map(({ name, startsOn, endsOn }) => (
            <Table.Tr key={startsOn}>
              <Table.Td fw={500}>{name}</Table.Td>
              <Table.Td className={classes.figures}>
                {startsOn} to {endsOn}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

const offCycleWords = (off: string | undefined) =>
  off === undefined ? undefined : `Ships ${off}`;

// How many cycles a stream would have, beside how many it has now.
function cycleCount(count: number, now: number): string {
  const all = `${String(count)} ${count === 1 ? "cycle" : "cycles"} in all`;
  if (count === now) return `${all}, as now`;
  const by = Math.abs(count - now);
  return `${all}, ${String(by)} ${count > now ? "more" : "fewer"} than now`;
}

// The earliest day a stream's cycles may be made until: the start of the last cycle any release
// includes, so every release keeps its cycles.
const leastCyclesUntil = (stream: ReleaseStream): string | undefined =>
  stream.releases
    .filter(({ draft }) => draft?.action !== "deleted")
    .map(({ lastCycle }) => lastCycle)
    .sort()
    .at(-1);

export function CyclesUntilDialog({
  stream,
  ...saving
}: { stream: ReleaseStream } & Saving) {
  const [day, setDay] = useState<string | undefined>(stream.cyclesUntil);
  const [tried, setTried] = useState(false);
  const save = useSave(
    (wanted: string) => setCyclesUntil(stream.id, wanted),
    saving,
  );
  const least = leastCyclesUntil(stream);
  const problem =
    day !== undefined && least !== undefined && day < least
      ? `A release includes the cycle from ${least}; choose that day or later`
      : undefined;
  const made =
    day === undefined
      ? undefined
      : cyclesOf(
          stream.patterns.filter(({ draft }) => draft?.action !== "deleted"),
          day,
        );
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (day !== undefined && problem === undefined) save.mutate(day);
      }}
    >
      <Stack gap="md">
        <DayInput
          label="Planned to"
          description="The last cycle starts by this day"
          autoFocus
          value={stream.cyclesUntil}
          problem={problem}
          shown={tried}
          onChange={(next) => {
            setDay(next);
          }}
        />
        {made !== undefined && made.length > 0 && (
          <>
            <Text fz="sm" c="dimmed">
              {cycleCount(made.length, stream.cycles.length)}
            </Text>
            <CyclesPreview
              id="last-cycles"
              title="Last cycles"
              cycles={made.slice(-3)}
            />
          </>
        )}
        <DialogActions
          error={save.error}
          pending={save.isPending}
          label="Save"
          onCancel={saving.onCancel}
        />
      </Stack>
    </form>
  );
}

const unitLabels: Record<CycleUnit, string> = {
  weeks: "Weeks",
  months: "Months",
};

// The days a stream's cycles may change from: any day when it has no cycles yet or the pattern is
// its earliest, and otherwise the start of one of the cycles its other patterns make.
function startChoices(
  stream: ReleaseStream,
  pattern: CyclePattern | undefined,
): { value: string; label: string }[] | undefined {
  const others = stream.patterns.filter(
    (other) => other.id !== pattern?.id && other.draft?.action !== "deleted",
  );
  // The earliest pattern may start on any day before the others.
  if (
    others.length === 0 ||
    (pattern !== undefined &&
      others.every((other) => pattern.startsOn < other.startsOn))
  ) {
    return undefined;
  }
  return cyclesOf(others, stream.cyclesUntil).map((cycle) => ({
    value: cycle.startsOn,
    label: `${cycle.startsOn} (${cycle.name})`,
  }));
}

export function PatternDialog({
  stream,
  pattern,
  ...saving
}: {
  stream: ReleaseStream;
  // The pattern being changed; absent when adding one.
  pattern?: CyclePattern | undefined;
} & Saving) {
  const choices = startChoices(stream, pattern);
  const [startsOn, setStartsOn] = useState(
    pattern?.startsOn ?? choices?.at(-1)?.value ?? "",
  );
  const [length, setLength] = useState<number | string>(pattern?.length ?? 3);
  const [unit, setUnit] = useState<CycleUnit>(pattern?.unit ?? "months");
  const [naming, setNaming] = useState(pattern?.naming ?? defaultNaming);
  const [tried, setTried] = useState(false);
  const save = useSave(
    () =>
      savePattern(
        stream.id,
        { startsOn, length: Number(length), unit, naming: naming.trim() },
        pattern?.id,
      ),
    saving,
  );
  const lengthOk =
    Number.isInteger(Number(length)) &&
    Number(length) >= 1 &&
    Number(length) <= longestCycle[unit === "weeks" ? "weeks" : "months"];
  const startOk = isDay(startsOn);
  const namingOk =
    naming.trim() !== "" && naming.trim().length <= releaseLengths.naming;
  // The first three cycles from the day chosen, named as the stream will name them, counting the
  // cycles of its other patterns before them.
  const following =
    startOk && lengthOk
      ? cyclesOf(
          [
            ...stream.patterns.filter(
              (other) =>
                other.id !== pattern?.id && other.draft?.action !== "deleted",
            ),
            { startsOn, length: Number(length), unit, naming: naming.trim() },
          ],
          unit === "weeks"
            ? addDays(startsOn, 7 * 2 * Number(length))
            : addMonths(startsOn, 2 * Number(length)),
        )
          .filter((cycle) => cycle.startsOn >= startsOn)
          .slice(0, 3)
      : [];
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (startOk && lengthOk && namingOk) save.mutate(undefined);
      }}
    >
      <Stack gap="md">
        {choices === undefined ? (
          <DayInput
            label="First cycle starts"
            placeholder="2027-01-01"
            autoFocus
            value={startsOn}
            shown={tried}
            onChange={(day) => {
              setStartsOn(day ?? "");
            }}
          />
        ) : (
          <Select
            label="From the start of"
            description="Cycles before it keep their names and dates"
            data={choices}
            value={startsOn}
            searchable
            allowDeselect={false}
            error={tried && !startOk ? "Choose a cycle" : undefined}
            onOptionSubmit={setStartsOn}
          />
        )}
        <Group align="flex-start" gap="sm">
          <NumberInput
            label="Each cycle lasts"
            min={1}
            max={longestCycle[unit === "weeks" ? "weeks" : "months"]}
            w={140}
            value={length}
            error={tried && !lengthOk ? "From 1 to two years" : undefined}
            onChange={setLength}
          />
          <SegmentedControl
            mt={25}
            aria-label="Unit"
            value={unit}
            onChange={(value) => {
              setUnit(value === "weeks" ? "weeks" : "months");
            }}
            data={(["weeks", "months"] as const).map((value) => ({
              value,
              label: unitLabels[value === "weeks" ? "weeks" : "months"],
            }))}
          />
        </Group>
        <TextInput
          label="Names"
          value={naming}
          error={
            tried && !namingOk ? "Give a pattern for the names" : undefined
          }
          onChange={(event) => {
            setNaming(event.currentTarget.value);
          }}
        />
        <Table
          aria-label="What names can hold"
          withRowBorders={false}
          verticalSpacing={0}
          horizontalSpacing={4}
          fz="xs"
          c="dimmed"
          mt={-8}
        >
          <Table.Tbody>
            {namingTokens.map(({ token, means }) => (
              <Table.Tr key={token}>
                <Table.Td fw={600} w={56}>
                  {token}
                </Table.Td>
                <Table.Td>{means}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {following.length > 0 && (
          <CyclesPreview
            id="first-cycles"
            title="First cycles"
            cycles={following}
          />
        )}
        <DialogActions
          error={save.error}
          pending={save.isPending}
          label={
            pattern !== undefined
              ? "Save"
              : choices === undefined && stream.patterns.length === 0
                ? "Set up cycles"
                : "Change cycles"
          }
          onCancel={saving.onCancel}
        />
      </Stack>
    </form>
  );
}

const unitWords = (length: number, unit: CycleUnit) =>
  `${unit === "weeks" ? "week" : "month"}${length === 1 ? "" : "s"}`;

const listed = new Intl.ListFormat("en", { type: "conjunction" });

const movedWords = (moved: readonly string[]) =>
  `${listed.format(moved)} ${moved.length === 1 ? "moves with its" : "move with their"} cycles.`;

export function CycleLengthDialog({
  stream,
  cycle,
  ...saving
}: {
  stream: ReleaseStream;
  cycle: Cycle;
} & Saving) {
  // Every cycle is made by the last pattern to start on or before it.
  const maker = stream.patterns
    .filter(
      ({ draft, startsOn }) =>
        draft?.action !== "deleted" && startsOn <= cycle.startsOn,
    )
    .at(-1) as CyclePattern;
  const { unit } = maker;
  const longest = unit === "weeks" ? longestCycle.weeks : longestCycle.months;
  const [length, setLength] = useState<number | string>(maker.length);
  const [later, setLater] = useState<LaterCycles>("move");
  const [tried, setTried] = useState(false);
  // Those who see only configuration do not see the plan's features, and name none.
  const plan = useQuery(projectPlanQuery);
  const save = useSave(
    () =>
      changeCycleLength(stream.id, cycle.startsOn, {
        length: Number(length),
        later,
      }),
    saving,
  );
  const lengthOk =
    Number.isInteger(Number(length)) &&
    Number(length) >= 1 &&
    Number(length) <= longest;
  // A length that is not a whole number of the unit shows the cycles as they are now.
  const { cycles, moved, ships, problem } = lengthChangeOf(
    stream,
    cycle.startsOn,
    {
      length: lengthOk ? Number(length) : maker.length,
      later,
    },
    plan.data?.features,
  );
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (lengthOk && problem === undefined) save.mutate(undefined);
      }}
    >
      <Stack gap="md">
        <NumberInput
          label="Length"
          description={`${cycle.startsOn} to ${cycle.endsOn}`}
          data-autofocus
          min={1}
          max={longest}
          w={220}
          value={length}
          rightSection={
            <Text fz="sm" c="dimmed" pr="xs">
              {unitWords(Number(length), unit)}
            </Text>
          }
          rightSectionWidth={72}
          error={tried && !lengthOk ? "From 1 to two years" : undefined}
          onChange={setLength}
        />
        <Radio.Group label="Later cycles" value={later} onChange={setLater}>
          <Stack gap="xs" mt={4}>
            <Radio value="move" label="Move with it" />
            <Radio
              value="keep"
              label="Keep their dates"
              description="The next cycle stretches or shrinks to fit"
            />
          </Stack>
        </Radio.Group>
        <CyclesPreview
          id="changed-cycles"
          title="New dates"
          cycles={cycles.slice(0, 3)}
        />
        {moved.length > 0 && <Text fz="sm">{movedWords(moved)}</Text>}
        {ships.map(({ name, on }) => (
          <Text key={name} fz="sm">
            {name} ships {on}.
          </Text>
        ))}
        {lengthOk &&
          (tried || Number(length) !== maker.length) &&
          problem !== undefined && (
            <Text fz="sm" c="red" role="alert">
              {problem}
            </Text>
          )}
        <DialogActions
          error={save.error}
          pending={save.isPending}
          label="Change length"
          onCancel={saving.onCancel}
        />
      </Stack>
    </form>
  );
}

// The cycles no other release in the stream includes, as choices.
function freeCycles(stream: ReleaseStream, release: Release | undefined) {
  const others = stream.releases.filter(
    (other) => other.id !== release?.id && other.draft?.action !== "deleted",
  );
  return stream.cycles
    .filter(
      ({ startsOn }) =>
        !others.some(
          (other) =>
            startsOn >= other.firstCycle && startsOn <= other.lastCycle,
        ),
    )
    .map((cycle) => ({
      value: cycle.startsOn,
      label: `${cycle.name} (${cycle.startsOn} to ${cycle.endsOn})`,
    }));
}

const colourChoices = [
  { value: defaultColour, label: `${colourName(null)} (default)` },
  ...paletteColours.map((colour) => ({
    value: colour,
    label: colourName(colour),
  })),
];

export function ReleaseDialog({
  stream,
  release,
  ...saving
}: {
  stream: ReleaseStream;
  // The release being changed; absent when making one.
  release?: Release | undefined;
} & Saving) {
  const choices = freeCycles(stream, release);
  const [name, setName] = useState(release?.name ?? "");
  const [firstCycle, setFirst] = useState(release?.firstCycle ?? "");
  const [lastCycle, setLast] = useState(release?.lastCycle ?? "");
  const [shipsOn, setShipsOn] = useState(release?.shipsOn ?? null);
  const [colour, setColour] = useState<PaletteColour | null>(
    release?.colour ?? null,
  );
  // Whether something typed in Ships on is not yet a day.
  const [shipsUnfinished, setShipsUnfinished] = useState(false);
  const [tried, setTried] = useState(false);
  const save = useSave(
    () =>
      saveRelease(
        stream.id,
        { name: name.trim(), firstCycle, lastCycle, shipsOn, colour },
        release?.id,
      ),
    saving,
  );
  const problem = nameProblem(
    name,
    stream.releases.some(
      (other) => other.id !== release?.id && same(other.name, name),
    ),
  );
  // The cycles must follow one another with none between them that another release includes.
  const between = stream.cycles.filter(
    ({ startsOn }) => startsOn >= firstCycle && startsOn <= lastCycle,
  );
  const consecutive =
    firstCycle !== "" &&
    lastCycle >= firstCycle &&
    between.every(({ startsOn }) =>
      choices.some(({ value }) => value === startsOn),
    );
  const end = consecutive ? lastCycleEnd(stream, lastCycle) : undefined;
  const shipsProblem =
    shipsOn !== null && firstCycle !== "" && shipsOn < firstCycle
      ? shipsBeforeStart
      : undefined;
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (
          problem === undefined &&
          consecutive &&
          !shipsUnfinished &&
          shipsProblem === undefined
        ) {
          save.mutate(undefined);
        }
      }}
    >
      <Stack gap="md">
        <TextInput
          label="Name"
          data-autofocus
          value={name}
          error={tried || name !== "" ? problem : undefined}
          rightSection={
            <Count length={name.trim().length} maximum={releaseLengths.name} />
          }
          rightSectionWidth={56}
          onChange={(event) => {
            setName(event.currentTarget.value);
          }}
        />
        <Select
          label="First cycle"
          data={choices}
          value={firstCycle || null}
          searchable
          error={tried && firstCycle === "" ? "Choose a cycle" : undefined}
          onChange={(value) => {
            setFirst(value ?? "");
            if (lastCycle === "" || (value ?? "") > lastCycle) {
              setLast(value ?? "");
            }
          }}
        />
        <Select
          label="Last cycle"
          data={choices.filter(({ value }) => value >= firstCycle)}
          value={lastCycle || null}
          searchable
          error={
            tried && firstCycle !== "" && !consecutive
              ? lastCycle === ""
                ? "Choose a cycle"
                : "Choose cycles no other release includes"
              : undefined
          }
          onChange={(value) => {
            setLast(value ?? "");
          }}
        />
        <DayInput
          label="Ships on"
          description={
            (shipsOn !== null && consecutive
              ? offCycleWords(shipsOffCycle(stream, { lastCycle, shipsOn }))
              : undefined) ??
            (end === undefined
              ? "Leave empty to ship at the end of its last cycle"
              : `Leave empty to ship at the end of its last cycle, on ${end}`)
          }
          required={false}
          value={release?.shipsOn ?? undefined}
          problem={shipsProblem}
          shown={tried}
          onChange={(day, typed) => {
            setShipsOn(day ?? null);
            setShipsUnfinished(typed && day === undefined);
          }}
        />
        <Select
          label="Colour"
          description="How the release is drawn on the timeline"
          data={colourChoices}
          value={shownColour(colour)}
          allowDeselect={false}
          leftSection={<Swatch colour={shownColour(colour)} />}
          renderOption={({ option }) => (
            <Group gap="xs" wrap="nowrap">
              <Swatch colour={option.value} />
              {option.label}
            </Group>
          )}
          onChange={(value) => {
            setColour(
              paletteColours.find((choice) => choice === value) ?? null,
            );
          }}
        />
        <DialogActions
          error={save.error}
          pending={save.isPending}
          label={release === undefined ? "Make release" : "Save"}
          onCancel={saving.onCancel}
        />
      </Stack>
    </form>
  );
}
