// SPDX-License-Identifier: Apache-2.0

// Web links: an http or https address and the text shown for it. Only web addresses are accepted,
// so following a link can never run anything or open a file. Hosts may be names on the company's
// own network, such as http://wiki/, or IP addresses, as well as names on the internet. An address
// typed without its scheme, as people usually write one, such as example.com/news, is kept with
// https:// before it, but only on a dotted name, so a word typed by mistake is refused rather than
// taken as a host.

import { z } from "zod";
import { isPlainText } from "./text.ts";

export const linkLengths = { address: 2000, text: 200 } as const;

// Empty text shows the address's host instead. Only the shape is checked here, so a link already
// kept is always recognised as one; linkProblems checks what may be kept.
const linkShape = z.object({ address: z.string(), text: z.string() });

export type Link = z.infer<typeof linkShape>;

export const isLink = (value: unknown): value is Link =>
  linkShape.safeParse(value).success;

// A link without text of its own shows only its address's host, without www., however long the
// address, since the rest says little to people reading it.
export const shortAddress = (address: string): string =>
  address
    .replace(/^https?:\/\//iu, "")
    .replace(/[/?#].*$/su, "")
    .replace(/^www\./iu, "");

export const linkLabel = (link: Link): string =>
  link.text || shortAddress(link.address);

// A link in words, as a draft's and the change history's values show it: its text with its address,
// or the address alone.
export const linkInWords = (link: Link): string =>
  link.text === "" ? link.address : `${link.text} (${link.address})`;

// The URL parser gives each address back in the form browsers use, with spaces and invisible
// characters percent-encoded and the host in lower case and in ASCII, and refuses hosts holding
// characters no host may have.
const webAddressSchema = z.url({ protocol: /^https?$/u, normalize: true });

// The host of an address as the URL parser gives it back: a name or an IPv4 address, each part
// letters, digits, hyphens, and underscores, not starting or ending with a hyphen, or an IPv6
// address in brackets.
const hostPart = /^[a-z\d_-]+$/u;
const ipv6Host = /^\[[\da-f:.]+\]$/u;
const isHostName = (host: string) =>
  host
    .replace(/\.$/u, "")
    .split(".")
    .every(
      (part) =>
        hostPart.test(part) && !part.startsWith("-") && !part.endsWith("-"),
    );
const dotted = /\./u;
const port = /:\d*$/u;

// The text up to the first character the pattern finds, or all of it when there is none.
const upTo = (text: string, end: RegExp) => text.slice(0, text.search(end));

// Names the scheme, such as javascript:, rather than starting with the host; a colon before digits
// is a port.
const scheme = /^[a-z][a-z\d+.-]*:(?!\d)/iu;

// An address in the form it is kept, or null when Fathom does not accept it.
export function webAddress(address: string): string | null {
  const value = address.trim();
  const typedScheme = scheme.test(value);
  const parsed = webAddressSchema.safeParse(
    typedScheme ? value : `https://${value}`,
  );
  if (!parsed.success) return null;
  const authority = upTo(parsed.data.replace(/^https?:\/\//u, ""), /[/?#]|$/u);
  // Sign-in details before the host, as in https://example.com@elsewhere.test, can make a link
  // seem to lead somewhere it does not.
  if (authority.includes("@")) return null;
  const host = authority.replace(port, "");
  if (!isHostName(host) && !ipv6Host.test(host)) return null;
  // The host of an address typed without its scheme, as typed, before the URL parser reads it.
  if (!typedScheme && !dotted.test(upTo(value, /[/?#\\]|$/u))) {
    return null;
  }
  return parsed.data;
}

export const addressProblem =
  "Enter a web address starting with http:// or https://, such as https://example.com";

export interface LinkProblems {
  address?: string;
  text?: string;
}

// What is wrong with a link, if anything, by the field that is wrong.
export function linkProblems(link: Link): LinkProblems {
  const address = link.address.trim();
  const text = link.text.trim();
  const problems: LinkProblems = {};
  // The address as it would be kept, which can be longer than typed once https:// is added and
  // characters outside ASCII are encoded.
  const kept = webAddress(address);
  if (address === "") problems.address = "Enter the address";
  else if (kept === null) problems.address = addressProblem;
  else if (kept.length > linkLengths.address) {
    problems.address = `The address is too long; use at most ${String(linkLengths.address)} characters`;
  }
  if (text.length > linkLengths.text) {
    problems.text = `The text is too long; use at most ${String(linkLengths.text)} characters`;
  } else if (!isPlainText(text)) {
    problems.text = "Use plain text, without control characters";
  }
  return problems;
}

// A link as a request sends it: refused unless Fathom accepts it, and kept with its address in the
// form webAddress gives it back.
export const linkValueSchema = z
  .object({ address: z.string(), text: z.string() })
  .superRefine((link, context) => {
    const problems = linkProblems(link);
    for (const field of ["address", "text"] as const) {
      // The field is one of the two named just above.
      // eslint-disable-next-line security/detect-object-injection
      const message = problems[field];
      if (message !== undefined) {
        context.addIssue({ code: "custom", path: [field], message });
      }
    }
  })
  .transform((link): Link => ({
    // Accepted above.
    address: webAddress(link.address) as string,
    text: link.text.trim(),
  }));
