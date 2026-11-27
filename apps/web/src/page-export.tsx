// SPDX-License-Identifier: Apache-2.0

// The Export icon in a page's header, offered by a table on the page.

import { ActionIcon, Menu, Tooltip, VisuallyHidden } from "@mantine/core";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppMenu } from "./app-menu.tsx";
import { type ExportFormat, exportFormats, formatLabel } from "./exports.ts";
import { Icon } from "./icons.tsx";
import { type ReasonLineProps, useTurnedOff } from "./turned-off.tsx";

type Exporter = (format: ExportFormat) => void;

export const nothingToExport = "There's nothing to export";

interface PageExport {
  // Who is signed in, whom an exported file's name names.
  person: string;
  offered: boolean;
  // Whether the table offering its export shows no rows.
  empty: boolean;
  offer: (exporter: Exporter | undefined, empty?: boolean) => void;
  exportAs: Exporter;
}

// Without a page around it, as when a table is drawn alone, nothing offers or exports.
const nothing = () => undefined;

const PageExportContext = createContext<PageExport>({
  person: "",
  offered: false,
  empty: false,
  offer: nothing,
  exportAs: nothing,
});

export function PageExportProvider({
  person,
  children,
}: {
  person: string;
  children: ReactNode;
}) {
  // The latest exporter, which changes as the table's view does, without redrawing the header.
  const exporter = useRef<Exporter | undefined>(undefined);
  const [offered, setOffered] = useState(false);
  const [empty, setEmpty] = useState(false);
  // Kept the same while the page is shown, so a table offering its export again doesn't withdraw it.
  const offer = useCallback((next: Exporter | undefined, isEmpty = false) => {
    exporter.current = next;
    setOffered(next !== undefined);
    setEmpty(isEmpty);
  }, []);
  const exportAs = useCallback((format: ExportFormat) => {
    exporter.current?.(format);
  }, []);
  const value = useMemo(
    (): PageExport => ({ person, offered, empty, offer, exportAs }),
    [person, offered, empty, offer, exportAs],
  );
  return (
    <PageExportContext.Provider value={value}>
      {children}
    </PageExportContext.Provider>
  );
}

// Who is signed in, for an exported file's name.
export const useExportingPerson = (): string =>
  useContext(PageExportContext).person;

// Offers a table's export to its page's header while the table is shown, for a table that has one,
// saying whether the table shows no rows.
export function useOfferedExport(
  exporter: Exporter | undefined,
  empty: boolean,
): void {
  const { offer } = useContext(PageExportContext);
  useEffect(() => {
    offer(exporter, empty);
  });
  useEffect(
    () => () => {
      offer(undefined);
    },
    [offer],
  );
}

// Its tip shows the reason, so the line is for screen readers alone.
const HiddenReason = ({ id, children }: ReasonLineProps) => (
  <VisuallyHidden id={id}>{children}</VisuallyHidden>
);

// The Export icon in a page's header, shown while a table on the page offers its export, and turned
// off while the table shows no rows.
export function PageExportMenu() {
  const { offered, empty, exportAs } = useContext(PageExportContext);
  const turnedOff = useTurnedOff(
    empty ? nothingToExport : undefined,
    HiddenReason,
  );
  if (!offered) return null;
  const icon = (
    <ActionIcon
      variant="default"
      // As tall as the buttons beside it.
      size="input-sm"
      aria-label="Export"
      {...turnedOff.control}
    >
      <Icon name="export" />
    </ActionIcon>
  );
  if (empty) {
    return (
      <>
        <Tooltip label={nothingToExport}>
          {/* A turned-off control takes no pointer, so its tip shows from around it. */}
          <span>{icon}</span>
        </Tooltip>
        {turnedOff.line}
      </>
    );
  }
  return (
    <AppMenu position="bottom-end" hideDetached={false}>
      <AppMenu.Target>
        <Tooltip label="Export">{icon}</Tooltip>
      </AppMenu.Target>
      <AppMenu.Dropdown>
        {exportFormats.map((format) => (
          <Menu.Item
            key={format}
            onClick={() => {
              exportAs(format);
            }}
          >
            {formatLabel(format)}
          </Menu.Item>
        ))}
      </AppMenu.Dropdown>
    </AppMenu>
  );
}
