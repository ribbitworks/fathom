// SPDX-License-Identifier: Apache-2.0

// Settings for the whole of Fathom: the time zone that decides which day is today, for everyone,
// on every screen and in the server, the password settings, and the classes of built-in details.

import { z } from "zod";
import { dataClassesSchema } from "./data-classes.ts";
import { passwordSettingsSchema } from "./passwords.ts";

export const defaultTimeZone = "America/Vancouver";

// The time zones offered for choosing, by name, with UTC, which some browsers leave out. Offsets,
// such as +05:00, are not offered, since PostgreSQL reads them the other way round.
export function timeZoneChoices(): string[] {
  return [...new Set([...Intl.supportedValuesOf("timeZone"), "UTC"])].sort();
}

// Whether dates can be worked out in a time zone here, which a browser with older time zone data
// may not manage for a name added since.
export function knowsTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

// A named time zone, in the spelling the list gives it when it is listed, or as given otherwise:
// browsers list current names, such as Asia/Kolkata, that Node lists by older ones, such as
// Asia/Calcutta. Offsets, such as +05:00, are refused, since PostgreSQL reads them the other way
// round.
export function namedTimeZone(text: string): string | undefined {
  const asked = text.trim();
  const listed = timeZoneChoices().find(
    (zone) => zone.toLowerCase() === asked.toLowerCase(),
  );
  if (listed !== undefined) return listed;
  if (!knowsTimeZone(asked)) return undefined;
  const resolved = new Intl.DateTimeFormat("en", {
    timeZone: asked,
  }).resolvedOptions().timeZone;
  return /^[+-]/.test(resolved) ? undefined : asked;
}

export const timeZoneSchema = z.string().transform((text, context) => {
  const zone = namedTimeZone(text);
  if (zone !== undefined) return zone;
  context.addIssue({
    code: "custom",
    message: "Fathom does not know that time zone.",
  });
  return z.NEVER;
});

// The day a moment falls on in a time zone, such as 2026-11-05, put together from its parts, since
// no language's own way of writing days is sure to stay in this form.
export function dayIn(timeZone: string, moment: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(moment);
  return (["year", "month", "day"] as const)
    .flatMap((type) =>
      parts.filter((part) => part.type === type).map(({ value }) => value),
    )
    .join("-");
}

export const timeZoneSettingSchema = z.object({ timeZone: z.string() });

export type TimeZoneSetting = z.infer<typeof timeZoneSettingSchema>;

// The classes the organization keeps its built-in details in travel with the settings, since every
// screen needs them to know which pages and views a role gets.
export const settingsSchema = timeZoneSettingSchema.extend({
  passwords: passwordSettingsSchema,
  dataClasses: dataClassesSchema,
});

export type Settings = z.infer<typeof settingsSchema>;

export const timeZoneRequestSchema = z.object({ timeZone: timeZoneSchema });

export type TimeZoneRequest = z.input<typeof timeZoneRequestSchema>;
