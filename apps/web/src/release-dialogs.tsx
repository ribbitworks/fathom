// SPDX-License-Identifier: Apache-2.0

// The dialogs of the Releases page: a release stream, its cycles, and a release.

import { MarkRow } from "./status-mark.tsx";
import {
  addDays,
  addMonths,
  type Cycle,
  cyclesOf,
  defaultNaming,
  isDay,
  longestCycleIn,
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
  allOf,
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
import { focusRefusedSoon } from "./focus.ts";
import { DayInput } from "./day-input.tsx";
import { CountedInput } from "./counted-input.tsx";
import { nameProblem } from "./lists.ts";
import classes from "./pages.module.css";
import {
  changeCycleLength,
  colourName,
  createStream,
  defaultColour,
  includesCycle,
  keptReleases,
  lastCycleEnd,
  lengthChangeOf,
  renameStream,
  type SavedStream,
  shipsOffCycle,
  shownColour,
  cycleNamed,
  savePattern,
  saveRelease,
} from "./releases.ts";
import { projectPlanQuery } from "./projects.ts";
import { cycleUnitWords, patternOn } from "./schedules.ts";
import { sessionQuery } from "./session.ts";
import { formatDay, formatDayRange } from "./day-formats.ts";

export interface Saving {
  onSaved: (saved: SavedStream) => void;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
}

export function useSave<Request>(
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

const releaseNameProblem = (name: string, taken: boolean) =>
  nameProblem(name, releaseLengths.name, taken, "Already used");

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
  const problem = releaseNameProblem(
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
        else focusRefusedSoon(event.currentTarget);
      }}
    >
      <Stack gap="md">
        <CountedInput
          label="Name"
          data-autofocus
          value={name}
          maximum={releaseLengths.name}
          error={tried || name !== "" ? problem : undefined}
          onValue={setName}
        />
        <DialogActions
          error={save.error}
          pending={save.isPending}
          label={stream === undefined ? "Add schedule" : "Save"}
          onCancel={saving.onCancel}
        />
      </Stack>
    </form>
  );
}

// A few cycles by name, with their days, as a dialog shows what a change makes.
export function CyclesPreview({
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
                {formatDayRange(startsOn, endsOn)}
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
  return cyclesOf(others, stream.cyclesUntil, stream.endsOn).map((cycle) => ({
    value: cycle.startsOn,
    label: `${formatDay(cycle.startsOn)} (${cycle.name})`,
  }));
}

export function PatternDialog({
  stream,
  pattern,
  from,
  ...saving
}: {
  stream: ReleaseStream;
  // The pattern being changed; absent when adding one.
  pattern?: CyclePattern | undefined;
  // The start of the cycle a new pattern starts from, which then starts like the one in force there.
  from?: string | undefined;
} & Saving) {
  const choices = startChoices(stream, pattern);
  const like =
    pattern ?? (from === undefined ? undefined : patternOn(stream, from));
  const [startsOn, setStartsOn] = useState(
    pattern?.startsOn ?? from ?? choices?.at(-1)?.value ?? "",
  );
  const [length, setLength] = useState<number | string>(like?.length ?? 3);
  const [unit, setUnit] = useState<CycleUnit>(like?.unit ?? "months");
  const [naming, setNaming] = useState(like?.naming ?? defaultNaming);
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
    Number(length) <= longestCycleIn(unit);
  const startOk = isDay(startsOn);
  const namingProblem = nameProblem(
    naming,
    releaseLengths.naming,
    false,
    "",
    "Names needed",
    "Names are too long",
  );
  const namingOk = namingProblem === undefined;
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
        else focusRefusedSoon(event.currentTarget);
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
            error={tried && !startOk ? "Choose a cycle" : undefined}
            onOptionSubmit={setStartsOn}
          />
        )}
        <Group align="flex-start" gap="sm">
          <NumberInput
            label="Each cycle lasts"
            min={1}
            max={longestCycleIn(unit)}
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
          error={tried ? namingProblem : undefined}
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

function MovedList({
  title,
  names,
}: {
  title: string;
  names: readonly string[];
}) {
  if (names.length === 0) return null;
  return (
    <Stack gap={2}>
      <Text fz="sm" fw={500}>
        {title}
      </Text>
      <Text fz="sm">{allOf(names)}</Text>
    </Stack>
  );
}

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
  const longest = longestCycleIn(unit);
  const [length, setLength] = useState<number | string>(maker.length);
  const [later, setLater] = useState<LaterCycles>("move");
  const [tried, setTried] = useState(false);
  // Those who see only configuration do not see the plan's features, and name none.
  const plan = useQuery(projectPlanQuery);
  const session = useQuery(sessionQuery);
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
    session.data?.permissions ?? [],
    plan.data?.features,
  );
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (lengthOk && problem === undefined) save.mutate(undefined);
        else focusRefusedSoon(event.currentTarget);
      }}
    >
      <Stack gap="md">
        <NumberInput
          label="Length"
          description={formatDayRange(cycle.startsOn, cycle.endsOn)}
          data-autofocus
          min={1}
          max={longest}
          w={220}
          value={length}
          rightSection={
            <Text fz="sm" c="dimmed" pr="xs">
              {cycleUnitWords(Number(length), unit)}
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
        <MovedList title="Releases that move" names={moved.releases} />
        <MovedList title="Features that move" names={moved.features} />
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
  const others = keptReleases(stream).filter(
    (other) => other.id !== release?.id,
  );
  return stream.cycles
    .filter(
      ({ startsOn }) => !others.some((other) => includesCycle(other, startsOn)),
    )
    .map((cycle) => ({
      value: cycle.startsOn,
      label: `${cycle.name} (${formatDayRange(cycle.startsOn, cycle.endsOn)})`,
    }));
}

const colourChoices = [
  { value: defaultColour, label: `${colourName(null)} (default)` },
  ...paletteColours.map((colour) => ({
    value: colour,
    label: colourName(colour),
  })),
];

// What a release's dialog asks for, when it changes one of the release's values rather than all.
export type ReleasePart = "name" | "cycles" | "shipsOn" | "colour";

const noStreams: readonly ReleaseStream[] = [];

const scheduleChoices = (streams: readonly ReleaseStream[]) =>
  streams.map(({ id, name }) => ({ value: id, label: name }));

export function ReleaseDialog({
  stream: given,
  streams = noStreams,
  release,
  part,
  ...saving
}: (
  | { stream: ReleaseStream; streams?: undefined }
  // For a new release, the schedules it may be made in, one of which is chosen first.
  | { stream?: undefined; streams: readonly ReleaseStream[] }
) & {
  // The release being changed; absent when making one.
  release?: Release | undefined;
  // The one value asked for, when only it is changed.
  part?: ReleasePart | undefined;
} & Saving) {
  const [streamId, setStreamId] = useState(given?.id ?? "");
  const stream = given ?? streams.find(({ id }) => id === streamId);
  const choices = stream === undefined ? [] : freeCycles(stream, release);
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
    (inStream: string) =>
      saveRelease(
        inStream,
        { name: name.trim(), firstCycle, lastCycle, shipsOn, colour },
        release?.id,
      ),
    saving,
  );
  const asks = (wanted: ReleasePart) => part === undefined || part === wanted;
  const problem = releaseNameProblem(
    name,
    stream?.releases.some(
      (other) => other.id !== release?.id && same(other.name, name),
    ) === true,
  );
  // The cycles must follow one another with none between them that another release includes.
  const between = (stream?.cycles ?? []).filter(
    ({ startsOn }) => startsOn >= firstCycle && startsOn <= lastCycle,
  );
  const consecutive =
    firstCycle !== "" &&
    lastCycle >= firstCycle &&
    between.every(({ startsOn }) =>
      choices.some(({ value }) => value === startsOn),
    );
  const end =
    consecutive && stream !== undefined
      ? lastCycleEnd(stream, lastCycle)
      : undefined;
  const shipsProblem =
    shipsOn !== null && firstCycle !== "" && shipsOn < firstCycle
      ? shipsBeforeStart
      : undefined;
  const wrong =
    stream === undefined ||
    (asks("name") && problem !== undefined) ||
    (asks("cycles") && !consecutive) ||
    (asks("shipsOn") && shipsUnfinished) ||
    ((asks("shipsOn") || asks("cycles")) && shipsProblem !== undefined);
  // Without Ships on, a change of cycles that would ship the release before it starts says so here.
  const firstCycleProblem =
    firstCycle === ""
      ? "Choose a cycle"
      : asks("shipsOn")
        ? undefined
        : shipsProblem;
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (stream !== undefined && !wrong) save.mutate(stream.id);
        else focusRefusedSoon(event.currentTarget);
      }}
    >
      <Stack gap="md">
        {given === undefined && (
          <Select
            label="Schedule"
            data-autofocus
            data={scheduleChoices(streams)}
            value={streamId || null}
            searchable
            error={
              tried && stream === undefined ? "Choose a schedule" : undefined
            }
            onOptionSubmit={(value) => {
              // The cycles chosen are another schedule's once another is chosen.
              if (value !== streamId) {
                setFirst("");
                setLast("");
              }
              setStreamId(value);
            }}
          />
        )}
        {asks("name") && (
          <CountedInput
            label="Name"
            data-autofocus={given !== undefined || undefined}
            value={name}
            maximum={releaseLengths.name}
            error={tried || name !== "" ? problem : undefined}
            onValue={setName}
          />
        )}
        {asks("cycles") && (
          <>
            <Select
              label="First cycle"
              data-autofocus={part === "cycles" || undefined}
              data={choices}
              value={firstCycle || null}
              searchable
              error={tried ? firstCycleProblem : undefined}
              onOptionSubmit={(value) => {
                setFirst(value);
                if (lastCycle === "" || value > lastCycle) setLast(value);
              }}
            />
            <Select
              label="Last cycle"
              data={choices.filter(({ value }) => value >= firstCycle)}
              value={lastCycle || null}
              searchable
              error={
                tried && firstCycle !== "" && !consecutive
                  ? "Choose cycles no other release includes"
                  : undefined
              }
              onOptionSubmit={setLast}
            />
          </>
        )}
        {asks("shipsOn") && (
          <DayInput
            label="Ships on"
            autoFocus={part === "shipsOn"}
            description={
              shipsOn !== null && consecutive && stream !== undefined
                ? offCycleWords(shipsOffCycle(stream, { lastCycle, shipsOn }))
                : undefined
            }
            {...(end === undefined || stream === undefined
              ? {}
              : {
                  placeholder: `${formatDay(end)} (end of ${cycleNamed(stream, lastCycle)})`,
                })}
            required={false}
            value={release?.shipsOn ?? undefined}
            problem={shipsProblem}
            shown={tried}
            onChange={(day, typed) => {
              setShipsOn(day ?? null);
              setShipsUnfinished(typed && day === undefined);
            }}
          />
        )}
        {asks("colour") && (
          <Select
            label="Colour"
            data-autofocus={part === "colour" || undefined}
            data={colourChoices}
            value={shownColour(colour)}
            leftSection={<Swatch colour={shownColour(colour)} alone />}
            renderOption={({ option }) => (
              <MarkRow>
                <Swatch colour={option.value} />
                {option.label}
              </MarkRow>
            )}
            onChange={(value) => {
              setColour(
                paletteColours.find((choice) => choice === value) ?? null,
              );
            }}
          />
        )}
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
