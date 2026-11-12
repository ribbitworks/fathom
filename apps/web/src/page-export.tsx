// SPDX-License-Identifier: Apache-2.0

// Exporting from a page's header: a table on the page offers its export, and the header shows an
// Export icon beside the page's main action while one does, so the bar above the table keeps its
// room for filters. On a page with tabs, the table shown offers it.

import { ActionIcon, Menu, Tooltip } from "@mantine/core";
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

type Exporter = (format: ExportFormat) => void;

interface PageExport {
  // Who is signed in, whom an exported file's name names.
  person: string;
  offered: boolean;
  offer: (exporter: Exporter | undefined) => void;
  exportAs: Exporter;
}

// Without a page around it, as when a table is drawn alone, nothing offers or exports.
const nothing = () => undefined;

const PageExportContext = createContext<PageExport>({
  person: "",
  offered: false,
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
  // Kept the same while the page is shown, so a table offering its export again doesn't withdraw it.
  const offer = useCallback((next: Exporter | undefined) => {
    exporter.current = next;
    setOffered(next !== undefined);
  }, []);
  const exportAs = useCallback((format: ExportFormat) => {
    exporter.current?.(format);
  }, []);
  const value = useMemo(
    (): PageExport => ({ person, offered, offer, exportAs }),
    [person, offered, offer, exportAs],
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

// Offers a table's export to its page's header while the table is shown, for a table that has one.
export function useOfferedExport(exporter: Exporter | undefined): void {
  const { offer } = useContext(PageExportContext);
  useEffect(() => {
    offer(exporter);
  });
  useEffect(
    () => () => {
      offer(undefined);
    },
    [offer],
  );
}

// The Export icon in a page's header, shown while a table on the page offers its export.
export function PageExportMenu() {
  const { offered, exportAs } = useContext(PageExportContext);
  if (!offered) return null;
  return (
    <AppMenu position="bottom-end" hideDetached={false}>
      <AppMenu.Target>
        <Tooltip label="Export">
          <ActionIcon
            variant="default"
            // As tall as the buttons beside it.
            size="input-sm"
            aria-label="Export"
          >
            <Icon name="export" />
          </ActionIcon>
        </Tooltip>
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
