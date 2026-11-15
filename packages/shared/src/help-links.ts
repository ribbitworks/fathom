// SPDX-License-Identifier: Apache-2.0

// Links to Help pages, which notes allow beside web links: a Help page's file name, such as
// lists.md, with one of its headings after it where wanted, such as lists.md#add-choices, as Help
// pages link to each other. They name only Help's own pages, so following one never leaves Fathom.

const pageFile = /^[a-z\d][a-z\d-]*\.md$/u;
const headingName = /^[a-z\d_-]+$/u;

export interface HelpLink {
  page: string;
  heading: string | undefined;
}

// The Help page, and the heading on it, that an address links to, or undefined for any other
// address.
export function helpLink(address: string): HelpLink | undefined {
  const hash = address.indexOf("#");
  const file = hash === -1 ? address : address.slice(0, hash);
  const heading = hash === -1 ? undefined : address.slice(hash + 1);
  if (!pageFile.test(file)) return undefined;
  if (heading !== undefined && !headingName.test(heading)) return undefined;
  return { page: file.slice(0, -".md".length), heading };
}

export const isHelpLink = (address: string): boolean =>
  helpLink(address) !== undefined;

// A file name ending in .md, before any heading, with no scheme or folder: meant for a Help page,
// so never taken as a web address on the .md domain, whether or not it names one.
const markdownFile = /^[^:/]*\.md(?:#|$)/iu;

export const isMarkdownFile = (address: string): boolean =>
  markdownFile.test(address);

const helpPath = "/help";

// The Help link for Fathom's own address of a Help page, such as lists.md#add-choices for
// /help/lists#add-choices, or index.md for /help, or undefined for any other address.
export function helpLinkOfPath(address: string): string | undefined {
  const hash = address.indexOf("#");
  const path = hash === -1 ? address : address.slice(0, hash);
  if (path !== helpPath && !path.startsWith(`${helpPath}/`)) return undefined;
  const page = path.slice(helpPath.length).replace(/^\/|\/$/gu, "") || "index";
  const file = `${page}.md${hash === -1 ? "" : address.slice(hash)}`;
  return isHelpLink(file) ? file : undefined;
}
