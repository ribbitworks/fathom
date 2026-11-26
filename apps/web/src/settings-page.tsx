// SPDX-License-Identifier: Apache-2.0

// The Settings page: Fathom's time zone and its password settings.

import {
  knowsTimeZone,
  type PasswordSettings,
  type TimeZoneRequest,
  timeZoneChoices,
  timeZoneSettingSchema,
} from "@fathom/shared";
import {
  Alert,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { describeProblem, sendJsonFor } from "./api.ts";
import { notifySuccess } from "./notices.tsx";
import { PageHeader } from "./page-header.tsx";
import { PasswordSettingsPanel } from "./password-settings.tsx";
import { sessionQuery } from "./session.ts";

// How wide a page of settings is: as wide as its fields need, not the window.
export const settingsPageWidth = 560;

const changeTimeZone = (request: TimeZoneRequest) =>
  sendJsonFor("PUT", "/api/settings/time-zone", request, timeZoneSettingSchema);

// The day and time in a time zone, by the reader's own clock, 12-hour or 24-hour as their language
// settings have it.
const timeIn = (timeZone: string, moment: Date) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(moment);

// Now, kept to the minute while the page is open.
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setTimeout(
      () => {
        setNow(new Date());
      },
      60_000 - (now.getTime() % 60_000),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [now]);
  return now;
}

export function SettingsPage({
  timeZone,
  passwords,
  canEdit,
}: {
  timeZone: string;
  passwords: PasswordSettings;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const choices = useMemo(() => {
    const offered = timeZoneChoices();
    return offered.includes(timeZone) ? offered : [timeZone, ...offered];
  }, [timeZone]);
  const [chosen, setChosen] = useState(timeZone);
  const now = useNow();
  const changing = useMutation({
    mutationFn: changeTimeZone,
    // Every page then works out today in the new time zone.
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
      await router.invalidate();
      notifySuccess(`Fathom's time zone is now ${saved.timeZone}.`);
    },
  });
  return (
    <Stack gap="md" maw={settingsPageWidth}>
      <PageHeader title="Settings" />
      <Paper withBorder p="md" component="section" aria-label="Time zone">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            // Enter in the read-only picker still submits the form.
            if (canEdit) changing.mutate({ timeZone: chosen });
          }}
        >
          <Stack>
            <Select
              label="Time zone"
              description="Decides which day is today for everyone, such as on the Releases timeline and for the date a change takes effect."
              data={choices}
              value={chosen}
              searchable
              readOnly={!canEdit}
              nothingFoundMessage="No time zone has that name"
              onOptionSubmit={setChosen}
            />
            {knowsTimeZone(chosen) && (
              <Text size="sm" c="dimmed">
                It is {timeIn(chosen, now)} there.
              </Text>
            )}
            {changing.error && (
              <Alert color="red" role="alert">
                {describeProblem(
                  changing.error,
                  "Fathom could not change its time zone. Try again in a moment.",
                )}
              </Alert>
            )}
            {canEdit && (
              <Group justify="flex-end">
                <Button
                  type="submit"
                  loading={changing.isPending}
                  disabled={chosen === timeZone}
                >
                  Save
                </Button>
              </Group>
            )}
          </Stack>
        </form>
      </Paper>
      <PasswordSettingsPanel passwords={passwords} canEdit={canEdit} />
    </Stack>
  );
}
