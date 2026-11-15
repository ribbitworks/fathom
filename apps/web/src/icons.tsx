// SPDX-License-Identifier: Apache-2.0

// Small line icons drawn in the current text colour: one for each page in the sidebar, and the
// controls and marks that need one. Each is hidden from screen readers, so its control must have a
// name, and a mark must be read aloud in words.

import type { ReactNode } from "react";

const lock = (
  <>
    <rect x="3.5" y="7" width="9" height="7" rx="1.5" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </>
);

const eye = (
  <>
    <path d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4z" />
    <circle cx="8" cy="8" r="1.8" />
  </>
);

const paths = {
  overview: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </>
  ),
  projects: (
    <path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
  ),
  releases: <path d="M3.5 14V2.5M3.5 3h8l-1.5 2.5L11.5 8h-8" />,
  people: (
    <>
      <circle cx="6" cy="5.5" r="2.5" />
      <path d="M1.5 13.5c.5-2.5 2.3-3.5 4.5-3.5s4 1 4.5 3.5M10.5 3.2a2.5 2.5 0 0 1 0 4.6M12 10.3c1.3.4 2.2 1.5 2.5 3.2" />
    </>
  ),
  orgChart: (
    <>
      <rect x="5.5" y="1.5" width="5" height="4" rx="1" />
      <rect x="1.5" y="10.5" width="5" height="4" rx="1" />
      <rect x="9.5" y="10.5" width="5" height="4" rx="1" />
      <path d="M8 5.5v2.5M4 10.5V8h8v2.5" />
    </>
  ),
  capacity: <path d="M2.5 13.5V9M6.2 13.5V5.5M9.8 13.5V7.5M13.5 13.5V2.5" />,
  assignments: <path d="M2.5 3h11v10h-11zM2.5 6.5h11M6 3v10" />,
  features: (
    <>
      <path d="M8 2 14 5 8 8 2 5z" />
      <path d="M2 8l6 3 6-3M2 11l6 3 6-3" />
    </>
  ),
  lists: (
    <>
      <path d="M6 4h8M6 8h8M6 12h8" />
      <circle cx="2.8" cy="4" r=".6" />
      <circle cx="2.8" cy="8" r=".6" />
      <circle cx="2.8" cy="12" r=".6" />
    </>
  ),
  accounts: (
    <>
      <circle cx="5.5" cy="8" r="3" />
      <path d="M8.5 8h6M12.5 8v2.5" />
    </>
  ),
  roles: (
    <>
      <path d="M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z" />
      <path d="M6 8l1.5 1.5L10.5 6.5" />
    </>
  ),
  settings: (
    <>
      <path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6" />
      <circle cx="10" cy="4.5" r="1.5" />
      <circle cx="6" cy="11.5" r="1.5" />
    </>
  ),
  history: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </>
  ),
  drafts: (
    <>
      <path d="M4 2.5h5l3 3v8H4z" />
      <path d="M6 9.5l1.5 1.5 3-3" />
    </>
  ),
  changes: (
    <>
      <path d="M2.5 4h7M2.5 8h5M2.5 12h3.5" />
      <path d="M9 13.5l.6-2.1 3.3-3.3 1.5 1.5-3.3 3.3z" />
    </>
  ),
  rail: (
    <>
      <rect x="2" y="2.5" width="12" height="11" rx="2" />
      <path d="M6 2.5v11" />
    </>
  ),
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  edit: <path d="M10.5 2.5l3 3L6 13H3v-3zM9 4l3 3" />,
  sidePanel: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M9.5 3v10M10.8 6h1.7M10.8 8h1.7M10.8 10h1.7" />
    </>
  ),
  link: (
    <path d="M6.5 9.5l3-3M7 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 0 1 4.5 9l1-1" />
  ),
  helpPages: (
    <>
      <path d="M4 2.5h5l3 3v8H4z" />
      <path d="M6.6 7.4a1.4 1.4 0 0 1 2.8.3c0 .9-1.4 1.1-1.4 1.9" />
      <circle cx="8" cy="11.3" r=".4" />
    </>
  ),
  aboutHelp: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.2V11" />
      <circle cx="8" cy="5" r=".4" />
    </>
  ),
  more: (
    <>
      <circle cx="3.5" cy="8" r="0.8" />
      <circle cx="8" cy="8" r="0.8" />
      <circle cx="12.5" cy="8" r="0.8" />
    </>
  ),
  grip: (
    <>
      <circle cx="5.5" cy="3.5" r="0.6" />
      <circle cx="10.5" cy="3.5" r="0.6" />
      <circle cx="5.5" cy="8" r="0.6" />
      <circle cx="10.5" cy="8" r="0.6" />
      <circle cx="5.5" cy="12.5" r="0.6" />
      <circle cx="10.5" cy="12.5" r="0.6" />
    </>
  ),
  plus: <path d="M8 3v10M3 8h10" />,
  minus: <path d="M3 8h10" />,
  export: <path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M2.5 13.5h11" />,
  check: <path d="M3 8.5l3.2 3L13 4.5" />,
  pending: <circle cx="8" cy="8" r="3" />,
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5l3 3" />
    </>
  ),
  filter: <path d="M2.5 3.5h11L9.5 8.5v4l-3 1.5v-5.5z" />,
  ascending: <path d="M8 13V3M4.5 6.5L8 3l3.5 3.5" />,
  descending: <path d="M8 3v10M4.5 9.5L8 13l3.5-3.5" />,
  metrics: (
    <>
      <path d="M7 2.5a5.5 5.5 0 1 0 5.5 5.5H7z" />
      <path d="M9.5 1v4.5H14A4.5 4.5 0 0 0 9.5 1z" />
    </>
  ),
  freeze: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M6.5 3v10" />
    </>
  ),
  lock,
  generalData: eye,
  personalData: (
    <>
      {eye}
      <path d="M2.5 13.5l11-11" />
    </>
  ),
  // A keyhole tells it apart from the lock of a record someone else is changing.
  confidentialData: (
    <>
      {lock}
      <path d="M8 9.6v1.8" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* The name is always one of the fixed icons above. */}
      {/* eslint-disable-next-line security/detect-object-injection */}
      {paths[name]}
    </svg>
  );
}
