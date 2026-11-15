// SPDX-License-Identifier: Apache-2.0

// Notes in the browser, as the Decisions Log sets out: a side panel that shows a note, or, for those
// who may change it, edits it in two ways that edit the same note, an editor with a toolbar for
// each format and a Markdown view. The editor loads only the formats notes allow, so
// typing or pasting can make nothing else, and the Markdown view's text is cleaned to them when
// people leave it or save. A note is shown from its Markdown through a sanitiser that lets through
// only what notes allow, never as raw HTML.

import {
  cleanNote,
  isNoteColour,
  type Link,
  type NoteColour,
  noteColours,
  notePlainText,
  noteProblem,
  shownLinkText,
  toggleCheckbox,
} from "@fathom/shared";
import {
  Button,
  Group,
  Menu,
  Popover,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { RichTextEditor } from "@mantine/tiptap";
import { type Editor, useEditor, useEditorState } from "@tiptap/react";
import {
  type ChangeEvent,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown, { type ExtraProps } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { Icon } from "./icons.tsx";
import { useLinkForm } from "./link-field.tsx";
import { Swatch } from "./colour-swatch.tsx";
import { colourWords } from "./colours.ts";
import { docToNote, noteToDoc } from "./note-markdown.ts";
import classes from "./note-editor.module.css";
import {
  colourText,
  noteExtensions,
  shownAddress,
  shownOnly,
} from "./note-format.ts";
import { SidePanelFrame, useNarrow } from "./side-panel.tsx";

function ColourControl({ editor }: { editor: Editor }) {
  const choose = (colour: NoteColour | null) => {
    const chain = editor.chain().focus();
    (colour === null
      ? chain.unsetMark("colour")
      : chain.setMark("colour", { colour })
    ).run();
  };
  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <RichTextEditor.Control aria-label="Colour" title="Colour">
          <Swatch colour="gray" alone />
        </RichTextEditor.Control>
      </Menu.Target>
      <Menu.Dropdown>
        {noteColours.map((colour) => (
          <Menu.Item
            key={colour}
            leftSection={
              <Swatch colour={colour} shown={colourText(colour)} alone />
            }
            onClick={() => {
              choose(colour);
            }}
          >
            {colourWords(colour)}
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item
          onClick={() => {
            choose(null);
          }}
        >
          No colour
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

// The form for a link in the note, as a web link cell has.
function NoteLinkForm({
  id,
  initial,
  onDone,
  onCancel,
}: {
  id: string;
  initial: Link;
  onDone: (link: Link | null) => void;
  onCancel: () => void;
}) {
  const { form } = useLinkForm({
    id,
    name: "Link",
    initial,
    typed: undefined,
    onDone,
    onCancel,
  });
  return form;
}

// What marks where one paragraph or list item ends and the next starts in the words chosen: the
// paragraph separator, which typing never gives.
const blockBreak = "\u2029";

// Adds a link, or changes or removes the one at the cursor: its address and the text to show, which
// shows the address when left empty. Text chosen and left as it was keeps its formatting; text
// across paragraphs or list items cannot be linked as one. Clicking away leaves the note as it was.
function LinkControl({ id, editor }: { id: string; editor: Editor }) {
  // The link as the form starts, and the words chosen as it opened.
  const [editing, setEditing] = useState<{ link: Link; chosen: string }>();
  const { active, across } = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      active: current.isActive("link"),
      across: current.state.doc
        .textBetween(
          current.state.selection.from,
          current.state.selection.to,
          blockBreak,
        )
        .includes(blockBreak),
    }),
  });
  const open = () => {
    editor.chain().extendMarkRange("link").run();
    const { from, to } = editor.state.selection;
    const address =
      (editor.getAttributes("link").href as string | undefined) ?? "";
    const chosen = editor.state.doc.textBetween(from, to);
    setEditing({
      link: {
        address,
        text:
          address !== "" && shownLinkText(address, chosen) !== chosen
            ? ""
            : chosen,
      },
      chosen,
    });
  };
  const done = (link: Link | null, chosen: string) => {
    setEditing(undefined);
    const chain = editor.chain().focus().extendMarkRange("link");
    if (link === null) chain.unsetLink();
    else if (chosen !== "" && link.text === chosen.trim()) {
      chain.setLink({ href: link.address });
    } else {
      chain.insertContent({
        type: "text",
        text: link.text || link.address,
        marks: [{ type: "link", attrs: { href: link.address } }],
      });
    }
    chain.run();
  };
  return (
    <Popover
      opened={editing !== undefined}
      onDismiss={() => {
        setEditing(undefined);
      }}
      trapFocus
      position="bottom-start"
      width={360}
      withinPortal
      shadow="md"
    >
      <Popover.Target>
        <RichTextEditor.Control
          aria-label="Link"
          title="Link"
          active={active}
          disabled={across}
          onClick={open}
        >
          <Icon name="link" />
        </RichTextEditor.Control>
      </Popover.Target>
      <Popover.Dropdown>
        {editing !== undefined && (
          <NoteLinkForm
            id={`${id}-link`}
            initial={editing.link}
            onDone={(link) => {
              done(link, editing.chosen);
            }}
            onCancel={() => {
              setEditing(undefined);
              editor.commands.focus();
            }}
          />
        )}
      </Popover.Dropdown>
    </Popover>
  );
}

type ShownElement = NonNullable<ExtraProps["node"]>;

// A list item's own words, without those of the lists inside it.
const itemWords = (element: ShownElement): string =>
  element.children
    .map((child) => {
      if (child.type === "text") return child.value;
      if (child.type !== "element" || child.tagName === "ul") return "";
      return itemWords(child);
    })
    .join("");

// The words of the list item a checkbox is in, which name it.
const CheckboxName = createContext<string | undefined>(undefined);

function NoteCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: ((event: ChangeEvent<HTMLInputElement>) => void) | undefined;
}) {
  return (
    <input
      type="checkbox"
      aria-label={useContext(CheckboxName)}
      checked={checked}
      disabled={onChange === undefined}
      readOnly={onChange === undefined}
      onChange={onChange}
    />
  );
}

// A note as it reads, from its Markdown, with checkboxes ticked by clicking them where the note may
// change.
export function NoteView({
  note,
  onToggle,
}: {
  note: string;
  // Ticks or unticks a checkbox, by its place among the note's checkboxes.
  onToggle?: (at: number) => void;
}) {
  const view = useRef<HTMLDivElement>(null);
  return (
    <div ref={view} className={classes.view}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={shownAddress}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, shownOnly]]}
        components={{
          li: ({ node, className, children }) => (
            <li className={className}>
              <CheckboxName.Provider
                value={node && itemWords(node).trim().replace(/\s+/gu, " ")}
              >
                {children}
              </CheckboxName.Provider>
            </li>
          ),
          input: ({ checked }) => (
            <NoteCheckbox
              checked={checked === true}
              onChange={
                onToggle &&
                ((event) => {
                  const boxes = [
                    ...(view.current as HTMLDivElement).querySelectorAll(
                      'input[type="checkbox"]',
                    ),
                  ];
                  onToggle(boxes.indexOf(event.currentTarget));
                })
              }
            />
          ),
          a: ({ href, children }) => (
            <a
              href={href === "" ? undefined : href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {href !== undefined && typeof children === "string"
                ? shownLinkText(href, children)
                : children}
            </a>
          ),
          span: ({ children, ...props }) => {
            const colour = (props as { "data-colour"?: string })["data-colour"];
            return (
              <span
                style={
                  isNoteColour(colour)
                    ? { color: colourText(colour) }
                    : undefined
                }
              >
                {children}
              </span>
            );
          },
        }}
      >
        {note}
      </ReactMarkdown>
    </div>
  );
}

type View = "note" | "editor" | "markdown";

// Shows a note as it reads, and edits it in the editor or as Markdown, which people switch between
// freely, saving it cleaned to what notes allow.
function NoteEditorPanel({
  id,
  title,
  note,
  refused,
  narrow,
  onWriting,
  onChanged,
  onSave,
  onCancel,
}: {
  id: string;
  title: string;
  note: string;
  refused: string | undefined;
  narrow: boolean;
  onWriting: ((writing: boolean) => void) | undefined;
  onChanged: ((changed: boolean) => void) | undefined;
  onSave: (note: string) => void;
  onCancel: () => void;
}) {
  // A note opens as it reads, with its links to follow, and an empty one ready to write.
  const [view, setView] = useState<View>(note === "" ? "editor" : "note");
  const [markdown, setMarkdown] = useState(note);
  // The note as it was, written as the panel writes it, however the server was given it.
  const [original] = useState(() => cleanNote(note));
  const [problem, setProblem] = useState<string>();
  // Whether the editor holds a note different from the one opened, kept as it is typed, which does
  // not draw the panel again.
  const [edited, setEdited] = useState(false);
  const editor = useEditor({
    extensions: noteExtensions,
    content: noteToDoc(note),
    immediatelyRender: true,
    editorProps: {
      attributes: { id, "aria-label": "Note", role: "textbox" },
    },
    shouldRerenderOnTransaction: false,
  });
  const current = (): string =>
    cleanNote(view === "editor" ? docToNote(editor.getJSON()) : markdown);
  // The note as it reads and the Markdown view both show the Markdown kept here.
  const switchTo = (next: View) => {
    const kept = current();
    if (next === "editor") {
      editor.commands.setContent(noteToDoc(kept));
      setEdited(kept !== original);
    } else setMarkdown(kept);
    setView(next);
  };
  // Reading the note as it was, Esc closes the panel, and the table may be used meanwhile; otherwise
  // the table waits for Save, Cancel or the close button.
  const reading = view === "note" && cleanNote(markdown) === original;
  useEffect(() => {
    onWriting?.(!reading);
  }, [reading, onWriting]);
  // Whether the note differs from the one opened, in the editor or as Markdown.
  useEffect(() => {
    const update = () => {
      setEdited(cleanNote(docToNote(editor.getJSON())) !== original);
    };
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor, original]);
  const changed = view === "editor" ? edited : cleanNote(markdown) !== original;
  useEffect(() => {
    onChanged?.(changed);
  }, [changed, onChanged]);
  // A panel closed by its page, rather than by its buttons, leaves nothing being written.
  useEffect(
    () => () => {
      onWriting?.(false);
    },
    [onWriting],
  );
  const clear = () => {
    editor.commands.clearContent();
    setMarkdown("");
    setProblem(undefined);
  };
  return (
    <SidePanelFrame
      id={`${id}-panel`}
      titleId={`${id}-title`}
      title={title}
      narrow={narrow}
      // Closing a note being changed cancels the change, but Esc, pressed easily by mistake, does not.
      close={{ label: "Close note", onClose: onCancel, byEscape: reading }}
      {...(reading
        ? {}
        : {
            foot: (
              <Stack gap="xs">
                {(problem ?? refused) !== undefined && (
                  <Text fz="sm" c="red" role="alert">
                    {problem ?? refused}
                  </Text>
                )}
                <Group justify="space-between" gap="xs">
                  <Button variant="default" onClick={clear}>
                    Clear
                  </Button>
                  <Group gap="xs">
                    <Button variant="default" onClick={onCancel}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        const kept = current();
                        const found = noteProblem(kept);
                        setProblem(found);
                        if (found === undefined) onSave(kept);
                      }}
                    >
                      Save
                    </Button>
                  </Group>
                </Group>
              </Stack>
            ),
          })}
    >
      <Stack gap="sm">
        <SegmentedControl
          aria-label="Show the note as"
          value={view}
          onChange={(value) => {
            switchTo(value);
          }}
          data={[
            { value: "note", label: "Note" },
            { value: "editor", label: "Editor" },
            { value: "markdown", label: "Markdown" },
          ]}
        />
        {view === "note" && (
          <div className={classes.read}>
            {markdown === "" ? (
              <Text fz="sm" c="dimmed">
                No note yet.
              </Text>
            ) : (
              <NoteView
                note={markdown}
                onToggle={(at) => {
                  setMarkdown(toggleCheckbox(markdown, at));
                }}
              />
            )}
          </div>
        )}
        <div hidden={view !== "editor"}>
          {/* @mantine/tiptap's types load Tiptap's CommonJS declarations of the same editor. */}
          <RichTextEditor editor={editor as never} className={classes.editor}>
            {/* Stays in sight as a long note scrolls under it. */}
            <RichTextEditor.Toolbar sticky stickyOffset={0}>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.H1 />
                <RichTextEditor.H2 />
                <RichTextEditor.H3 />
              </RichTextEditor.ControlsGroup>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Bold />
                <RichTextEditor.Italic />
                <RichTextEditor.Strikethrough />
                <RichTextEditor.Code />
                <ColourControl editor={editor} />
              </RichTextEditor.ControlsGroup>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.BulletList />
                <RichTextEditor.TaskList />
              </RichTextEditor.ControlsGroup>
              <RichTextEditor.ControlsGroup>
                <LinkControl id={id} editor={editor} />
                <RichTextEditor.Unlink />
              </RichTextEditor.ControlsGroup>
            </RichTextEditor.Toolbar>
            <RichTextEditor.Content />
          </RichTextEditor>
        </div>
        {view === "markdown" && (
          <Textarea
            aria-label="Markdown"
            autosize
            minRows={10}
            classNames={{ input: classes.markdown }}
            value={markdown}
            onChange={(event) => {
              setMarkdown(event.currentTarget.value);
            }}
          />
        )}
      </Stack>
    </SidePanelFrame>
  );
}

// A note in the side panel beside the page: edited by those who may change it, and otherwise shown,
// closed by its close button or Esc.
export function NotePanel({
  id,
  title,
  note,
  refused,
  canEdit,
  onWriting,
  onChanged,
  onSave,
  onClose,
}: {
  // Where focus goes as the panel opens: the editor, or the title of a note only shown.
  id: string;
  title: string;
  note: string;
  // Why the note last saved was refused, if it was.
  refused?: string | undefined;
  canEdit: boolean;
  // Whether the note is being changed, rather than only read.
  onWriting?: ((writing: boolean) => void) | undefined;
  // Whether the note now differs from the one it opened with.
  onChanged?: ((changed: boolean) => void) | undefined;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const narrow = useNarrow();
  if (canEdit) {
    return (
      <NoteEditorPanel
        id={id}
        title={title}
        note={note}
        refused={refused}
        narrow={narrow}
        onWriting={onWriting}
        onChanged={onChanged}
        onSave={onSave}
        onCancel={onClose}
      />
    );
  }
  return (
    <SidePanelFrame
      id={`${id}-panel`}
      titleId={id}
      title={title}
      narrow={narrow}
      close={{ label: "Close note", onClose }}
    >
      {note === "" ? (
        <Text fz="sm" c="dimmed">
          No note yet.
        </Text>
      ) : (
        <NoteView note={note} />
      )}
    </SidePanelFrame>
  );
}

// How many characters a note's preview holds, so a long note never fills a tooltip or what a screen
// reader says of its cell.
const previewLength = 200;

// A note's words on one line, cut short at the preview's length.
export function notePreview(note: string): string {
  const words = notePlainText(note, true).replaceAll("\n", " ");
  return words.length > previewLength
    ? `${words.slice(0, previewLength - 1)}…`
    : words;
}

// How many characters wide a note's column is, until its width is set.
export const noteCellChars = 15;

// A note's words on one line, as a cell previews it, cut short at the cell's width.
export function NoteCell({ note }: { note: string }) {
  const words = notePreview(note);
  return words === "" ? null : (
    <Text span inherit display="block" truncate="end" title={words}>
      {words}
    </Text>
  );
}
