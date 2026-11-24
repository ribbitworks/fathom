// SPDX-License-Identifier: Apache-2.0

// The Releases page's dialog for the day a schedule ends, if any, refusing the days the server
// refuses, and showing how many cycles it then has and the last ones.

import {
  cyclesOf,
  type ReleaseStream,
  scheduleEndProblem,
} from "@fathom/shared";
import { Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DayInput } from "./day-input.tsx";
import { DialogActions } from "./dialog-actions.tsx";
import { focusRefusedSoon } from "./focus.ts";
import { projectPlanQuery } from "./projects.ts";
import { CyclesPreview, type Saving, useSave } from "./release-dialogs.tsx";
import { plannedOnStream, setStreamEnd } from "./releases.ts";
import { sessionQuery } from "./session.ts";

const cycleCount = (count: number): string =>
  `${String(count)} ${count === 1 ? "cycle" : "cycles"} in all`;

export function EndsDialog({
  stream,
  ...saving
}: { stream: ReleaseStream } & Saving) {
  const [day, setDay] = useState(stream.endsOn ?? undefined);
  const [typed, setTyped] = useState(stream.endsOn !== null);
  const [tried, setTried] = useState(false);
  // Those who see only configuration do not see the plan's features; the server judges those.
  const plan = useQuery(projectPlanQuery);
  const session = useQuery(sessionQuery);
  const save = useSave(
    (endsOn: string | null) => setStreamEnd(stream.id, endsOn),
    saving,
  );
  const patterns = stream.patterns.filter(
    ({ draft }) => draft?.action !== "deleted",
  );
  // Undefined while a day is half typed.
  const endsOn = day ?? (typed ? undefined : null);
  const made =
    typeof endsOn === "string" ? cyclesOf(patterns, endsOn, endsOn) : undefined;
  const problem =
    endsOn === undefined
      ? undefined
      : scheduleEndProblem(
          patterns,
          endsOn,
          plannedOnStream(stream, plan.data?.features),
          session.data?.permissions ?? [],
        );
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (endsOn !== undefined && problem === undefined) save.mutate(endsOn);
        else focusRefusedSoon(event.currentTarget);
      }}
    >
      <Stack gap="md">
        <DayInput
          label="Schedule ends"
          description="Its last cycle ends on this day."
          placeholder="No end date"
          autoFocus
          required={false}
          value={stream.endsOn ?? undefined}
          problem={problem}
          shown={tried}
          onChange={(next, isTyped) => {
            setDay(next);
            setTyped(isTyped);
          }}
        />
        {made !== undefined && made.length > 0 && (
          <>
            <Text fz="sm" c="dimmed">
              {cycleCount(made.length)}
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
