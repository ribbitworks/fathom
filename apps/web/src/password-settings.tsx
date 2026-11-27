// SPDX-License-Identifier: Apache-2.0

// The password settings on the Settings page: the rules every chosen password must meet, and the
// recipe for the passwords Fathom makes for new accounts and resets.

import {
  type CharacterKind,
  characterKinds,
  type CharacterType,
  characterTypes,
  kindsIn,
  generatedPasswordLength,
  lookAlikeCharacters,
  passwordLength,
  type PasswordSettings,
  passwordSettingsSchema,
  recipeProblems,
} from "@fathom/shared";
import {
  Alert,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { describeProblem, sendJsonFor } from "./api.ts";
import { notifySuccess } from "./notices.tsx";
import { sessionQuery } from "./session.ts";

const savePasswordSettings = (settings: PasswordSettings) =>
  sendJsonFor(
    "PUT",
    "/api/settings/passwords",
    settings,
    passwordSettingsSchema,
  );

const capitalized = (words: string) =>
  `${words.charAt(0).toUpperCase()}${words.slice(1)}`;

const spaced = (characters: string) => Array.from(characters).join(" ");

// A recipe's symbols are named, since Fathom uses only some.
const recipeLabel = (kind: CharacterKind) =>
  kind.type === "symbols"
    ? `${capitalized(kind.all)}: ${spaced(kind.characters)}`
    : capitalized(kind.all);

const typesIn = (flags: Record<CharacterType, boolean>) =>
  kindsIn(flags).map(({ type }) => type);

// A length as typed, which may be empty or not yet a whole number.
type Typed = number | string;

interface Draft {
  minimumLength: Typed;
  required: CharacterType[];
  length: Typed;
  used: CharacterType[];
  avoidLookAlikes: boolean;
}

const draftOf = ({ rules, recipe }: PasswordSettings): Draft => ({
  minimumLength: rules.minimumLength,
  required: typesIn(rules),
  length: recipe.length,
  used: typesIn(recipe),
  avoidLookAlikes: recipe.avoidLookAlikes,
});

const flags = (chosen: readonly CharacterType[]) =>
  Object.fromEntries(
    characterTypes.map((type) => [type, chosen.includes(type)]),
  ) as Record<CharacterType, boolean>;

// The settings the draft makes, which are not valid while a length is not a whole number in range.
const settingsOf = (draft: Draft) => ({
  rules: { minimumLength: draft.minimumLength, ...flags(draft.required) },
  recipe: {
    length: draft.length,
    ...flags(draft.used),
    avoidLookAlikes: draft.avoidLookAlikes,
  },
});

interface Range {
  minimum: number;
  maximum: number;
}

const inRange = (value: Typed, { minimum, maximum }: Range) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= minimum &&
  value <= maximum;

// Needed when no number is typed, or else the range alone.
const rangeProblem = (value: Typed, { minimum, maximum }: Range) =>
  typeof value === "number"
    ? `Type a number from ${String(minimum)} to ${String(maximum)}`
    : "Number needed";

// A whole number of characters in its range, refused under it when outside.
function LengthInput({
  label,
  range,
  readOnly,
  value,
  onChange,
}: {
  label: string;
  range: Range;
  readOnly: boolean;
  value: Typed;
  onChange: (value: Typed) => void;
}) {
  return (
    <NumberInput
      label={label}
      min={range.minimum}
      max={range.maximum}
      allowDecimal={false}
      allowNegative={false}
      readOnly={readOnly}
      value={value}
      onChange={onChange}
      error={!inRange(value, range) && rangeProblem(value, range)}
    />
  );
}

// A tick box for each kind of character, such as upper-case letters.
function KindsChoice({
  label,
  kindLabel,
  readOnly,
  value,
  onChange,
}: {
  label: string;
  kindLabel: (kind: CharacterKind) => string;
  readOnly: boolean;
  value: CharacterType[];
  onChange: (value: CharacterType[]) => void;
}) {
  return (
    <Checkbox.Group
      label={label}
      readOnly={readOnly}
      value={value}
      onChange={onChange}
    >
      <Stack gap="xs" mt="xs">
        {characterKinds.map((kind) => (
          <Checkbox key={kind.type} value={kind.type} label={kindLabel(kind)} />
        ))}
      </Stack>
    </Checkbox.Group>
  );
}

export function PasswordSettingsPanel({
  passwords,
  canEdit,
}: {
  passwords: PasswordSettings;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [draft, setDraft] = useState(() => draftOf(passwords));
  const change = (changes: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...changes }));
  };
  const settings = passwordSettingsSchema.safeParse(settingsOf(draft));
  const problems = settings.success ? recipeProblems(settings.data) : [];
  const unchanged =
    settings.success &&
    JSON.stringify(settings.data) === JSON.stringify(passwords);
  const saving = useMutation({
    mutationFn: async (saved: Draft) =>
      savePasswordSettings(passwordSettingsSchema.parse(settingsOf(saved))),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
      await router.invalidate();
      notifySuccess("Saved the password settings.");
    },
  });
  return (
    <Paper withBorder p="md" component="section" aria-label="Passwords">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (canEdit) saving.mutate(draft);
        }}
      >
        <Stack>
          <Title order={2} size="h4">
            Password requirements
          </Title>
          <LengthInput
            label="Minimum length"
            range={passwordLength}
            readOnly={!canEdit}
            value={draft.minimumLength}
            onChange={(minimumLength) => {
              change({ minimumLength });
            }}
          />
          <KindsChoice
            label="Must have"
            kindLabel={(kind) => capitalized(kind.one)}
            readOnly={!canEdit}
            value={draft.required}
            onChange={(required) => {
              change({ required });
            }}
          />
          <Text size="sm" c="dimmed">
            Changes apply the next time each person changes their password.
          </Text>
          <Title order={2} size="h4" mt="sm">
            Generated passwords
          </Title>
          <LengthInput
            label="Length"
            range={generatedPasswordLength}
            readOnly={!canEdit}
            value={draft.length}
            onChange={(length) => {
              change({ length });
            }}
          />
          <KindsChoice
            label="Use"
            kindLabel={recipeLabel}
            readOnly={!canEdit}
            value={draft.used}
            onChange={(used) => {
              change({ used });
            }}
          />
          <Checkbox
            label={`Leave out characters that look alike: ${spaced(lookAlikeCharacters)}`}
            readOnly={!canEdit}
            checked={draft.avoidLookAlikes}
            onChange={(event) => {
              change({ avoidLookAlikes: event.currentTarget.checked });
            }}
          />
          {problems.length > 0 && (
            <Alert color="red" role="alert">
              <Stack gap={4}>
                {problems.map((problem) => (
                  <Text key={problem} size="sm">
                    {problem}
                  </Text>
                ))}
              </Stack>
            </Alert>
          )}
          {saving.error && (
            <Alert color="red" role="alert">
              {describeProblem(
                saving.error,
                "Fathom could not save the password settings. Try again in a moment.",
              )}
            </Alert>
          )}
          {canEdit && (
            <Group justify="flex-end">
              <Button
                type="submit"
                loading={saving.isPending}
                disabled={!settings.success || unchanged || problems.length > 0}
              >
                Save
              </Button>
            </Group>
          )}
        </Stack>
      </form>
    </Paper>
  );
}
