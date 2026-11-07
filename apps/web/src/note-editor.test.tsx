// SPDX-License-Identifier: Apache-2.0

// Tests for notes in the browser: how a note is shown, letting through only what notes allow, and
// the side panel that edits a note in the editor or as Markdown, which edit the same note and save
// it cleaned to what notes allow. The note format itself is tested in the shared package's
// notes.test.ts.

import { colourTag } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import {
  NoteCell,
  noteCellChars,
  NotePanel,
  notePreview,
  NoteView,
} from "./note-editor.tsx";
import { noteExtensions } from "./note-format.ts";
import { docToNote } from "./note-markdown.ts";
import { testTheme } from "./test-support.tsx";

const teal = colourTag("teal");

// The test browser lays nothing out, so the editor's measurements of where text is find nothing.
beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});

const view = (note: string) =>
  render(
    <MantineProvider theme={testTheme}>
      <NoteView note={note} />
    </MantineProvider>,
  ).container;

describe("a note as it reads", () => {
  it("shows each format notes allow", () => {
    const shown = view(
      `**Bold** _italic_ ~~struck~~ \`code\` [Site](https://example.com/) ${teal}teal</span>\n\n- One`,
    );
    expect(
      [...shown.querySelectorAll("strong, em, del, code, a, span, li")].map(
        (element) => element.tagName.toLowerCase(),
      ),
    ).toEqual(["strong", "em", "del", "code", "a", "span", "li"]);
    const link = screen.getByRole("link", { name: "Site" });
    expect([link.getAttribute("target"), link.getAttribute("rel")]).toEqual([
      "_blank",
      "noopener noreferrer",
    ]);
    expect(shown.querySelector("span")?.getAttribute("style")).toBe(
      "color: var(--mantine-color-teal-text);",
    );
  });

  it.each([
    ["<script>alert(1)</script>\n\nAfter", "script"],
    ["<img src=x onerror=alert(1)>", "img"],
    ["![Picture](https://example.com/a.png)", "img"],
    ["Some <mark>marked</mark> text", "mark"],
    ["#### Deep", "h4"],
    [
      '<input type="text" value="typed">',
      'input:not([type="checkbox"][disabled])',
    ],
    ['<iframe src="https://example.com/"></iframe>', "iframe"],
  ])("never puts %j on the screen as %s", (note, tag) => {
    expect(view(note).querySelector(tag)).toBeNull();
  });

  it("shows headings three levels deep, and checkboxes that only show whether they are ticked", () => {
    const shown = view(
      "# One\n\n## Two\n\n### Three\n\n- [ ] Open\n- [x] Done",
    );
    expect(
      [...shown.querySelectorAll("h1, h2, h3")].map(
        (heading) => heading.textContent,
      ),
    ).toEqual(["One", "Two", "Three"]);
    const boxes = screen.getAllByRole<HTMLInputElement>("checkbox");
    expect(boxes.map((box) => [box.checked, box.disabled])).toEqual([
      [false, true],
      [true, true],
    ]);
  });

  it("shows a link that only repeats its address as the host", () => {
    view(
      "<https://www.example.com/news> and [example.com/news](https://example.com/news)",
    );
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(
      ["example.com", "example.com"],
    );
  });

  it("never links anywhere but the web", () => {
    view(
      '[Run](javascript:alert(1)) and <a href="javascript:alert(1)">this</a> [here](/api/session) [there](//example.test/) [site](https://example.com/)',
    );
    expect(
      [...document.querySelectorAll("a")].map((link) =>
        link.getAttribute("href"),
      ),
    ).toEqual([null, null, null, null, "https://example.com/"]);
  });

  it("shows a colour off the palette, or a style of its own, without it", () => {
    const shown = view(
      'Some <span data-colour="sea">sea</span> and <span style="color: red">red</span>',
    );
    expect(
      [...shown.querySelectorAll("span")].map((span) =>
        span.getAttribute("style"),
      ),
    ).toEqual([null, null]);
  });
});

function sheet(note: string, canEdit = true) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <MantineProvider theme={testTheme}>
      <NotePanel
        id="note"
        title="Fictional Note"
        note={note}
        canEdit={canEdit}
        onSave={onSave}
        onClose={onClose}
      />
    </MantineProvider>,
  );
  return { onSave, onClose };
}

const markdownBox = () => screen.getByRole("textbox", { name: "Markdown" });

// A note opens as it reads; writing in it starts from the editor.
async function editing(note: string) {
  const opened = sheet(note);
  await userEvent.click(await screen.findByText("Editor"));
  return opened;
}

describe("a note's preview", () => {
  it("is the note's words on one line, cut short when long", () => {
    expect([
      notePreview("**One**\n\n- two"),
      notePreview("word ".repeat(60)).length,
      notePreview("word ".repeat(60)).at(-1),
    ]).toEqual(["One two", 200, "…"]);
  });

  it("is cut short at its cell's width, so a long note never widens its column", () => {
    render(
      <MantineProvider theme={testTheme}>
        <NoteCell note={"word ".repeat(60)} />
      </MantineProvider>,
    );
    const words = screen.getByTitle(notePreview("word ".repeat(60)));
    expect([getComputedStyle(words).display, words.style.maxWidth]).toEqual([
      "block",
      `${String(noteCellChars)}ch`,
    ]);
  });
});

describe("the note panel", () => {
  it("shows the note to those who may not change it, closed by its close button or Esc", async () => {
    const { onClose } = sheet("**Bold** words", false);
    expect((await screen.findByText("Bold")).tagName).toBe("STRONG");
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Close note" }));
    act(() => {
      screen.getByRole("heading", { name: "Fictional Note" }).focus();
    });
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("closes by Save, Cancel or its close button, which cancels, but not by Esc, while the note is being changed", async () => {
    const { onClose } = await editing("Words");
    const content = await screen.findByRole("textbox", { name: "Note" });
    act(() => {
      content.focus();
    });
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Close note" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clears the note, to be saved", async () => {
    const { onSave } = await editing("**Bold** words");
    await userEvent.click(await screen.findByRole("button", { name: "Clear" }));
    await userEvent.click(screen.getByText("Markdown"));
    expect((markdownBox() as HTMLTextAreaElement).value).toBe("");
    await userEvent.type(markdownBox(), "#");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave.mock.calls).toEqual([[""], [""]]);
  });

  it("opens a note as it reads, with its links to follow, and shows what is written in the editor", async () => {
    const { onSave } = sheet("See <https://www.example.com/news>");
    const link = await screen.findByRole("link", { name: "example.com" });
    expect(link.getAttribute("href")).toBe("https://www.example.com/news");
    expect(screen.queryByRole("textbox", { name: "Note" })).toBeNull();
    await userEvent.click(screen.getByText("Markdown"));
    await userEvent.type(markdownBox(), " **now**");
    await userEvent.click(screen.getByText("Note"));
    expect((await screen.findByText("now")).tagName).toBe("STRONG");
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("No note yet.")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("");
  });

  it("closes by Esc too while the note is read unchanged, and offers Save and Cancel once changed", async () => {
    const { onClose } = sheet("Words");
    await screen.findByRole("button", { name: "Close note" });
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Close note" }));
    act(() => {
      screen.getByRole("heading", { name: "Fictional Note" }).focus();
    });
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByText("Markdown"));
    await userEvent.type(markdownBox(), " more");
    await userEvent.click(screen.getByText("Note"));
    expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
    act(() => {
      screen.getByRole("heading", { name: "Fictional Note" }).focus();
    });
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("ticks a checkbox, named by its item's words, on the note as it reads, to be saved", async () => {
    const { onSave } = sheet("- [ ] Open\n- [x] Done");
    await screen.findByRole("button", { name: "Close note" });
    const boxes = () => screen.getAllByRole<HTMLInputElement>("checkbox");
    await userEvent.click(screen.getByRole("checkbox", { name: "Open" }));
    expect(boxes().map((box) => box.checked)).toEqual([true, true]);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("- [x] Open\n- [x] Done");
  });

  it("reads a note kept in another form of Markdown as unchanged", async () => {
    sheet("* One\n* Two");
    await screen.findByRole("button", { name: "Close note" });
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("opens an empty note ready to write", async () => {
    sheet("");
    expect(await screen.findByRole("textbox", { name: "Note" })).toBeDefined();
  });

  it("says when there is no note to show", async () => {
    sheet("", false);
    expect(await screen.findByText("No note yet.")).toBeDefined();
  });

  it("shows the note as Markdown, and saves what is written there", async () => {
    const { onSave } = sheet("**Bold** words");
    await userEvent.click(await screen.findByText("Markdown"));
    expect((markdownBox() as HTMLTextAreaElement).value).toBe("**Bold** words");
    await userEvent.type(markdownBox(), " and _more_");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("**Bold** words and _more_");
  });

  it("cleans the Markdown written to what notes allow", async () => {
    const { onSave } = sheet("");
    await userEvent.click(await screen.findByText("Markdown"));
    await userEvent.click(markdownBox());
    await userEvent.paste(
      '#### Heading\n\nText <mark>marked</mark> <span data-colour="sea">sea</span> [run](javascript:alert(1))',
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("### Heading\n\nText marked sea run");
  });

  it("keeps the note the same when switching between the editor and Markdown", async () => {
    const note = `# Title\n\n**Bold** ${teal}teal</span> [Site](https://example.com/)\n\n- One\n\n## Tasks\n\n- [ ] Open\n- [x] Done\n  - [ ] Nested`;
    const { onSave } = sheet(note);
    await userEvent.click(await screen.findByText("Markdown"));
    expect((markdownBox() as HTMLTextAreaElement).value).toBe(note);
    await userEvent.click(screen.getByText("Editor"));
    await userEvent.click(screen.getByText("Markdown"));
    expect((markdownBox() as HTMLTextAreaElement).value).toBe(note);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith(note);
  });

  it("colours the text chosen from the palette, and takes the colour off again", async () => {
    await editing("Some words");
    const content = await screen.findByRole("textbox", { name: "Note" });
    act(() => {
      content.focus();
    });
    await userEvent.keyboard("{Control>}a{/Control}");
    await userEvent.click(screen.getByRole("button", { name: "Colour" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Teal" }),
    );
    await userEvent.click(screen.getByText("Markdown"));
    expect((markdownBox() as HTMLTextAreaElement).value).toBe(
      `${teal}Some words</span>`,
    );
    await userEvent.click(screen.getByText("Editor"));
    act(() => {
      content.focus();
    });
    await userEvent.keyboard("{Control>}a{/Control}");
    await userEvent.click(screen.getByRole("button", { name: "Colour" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "No colour" }),
    );
    await userEvent.click(screen.getByText("Markdown"));
    expect((markdownBox() as HTMLTextAreaElement).value).toBe("Some words");
  });

  it("refuses a note that is too long", async () => {
    const { onSave } = sheet("");
    await userEvent.click(await screen.findByText("Markdown"));
    await userEvent.click(markdownBox());
    await userEvent.paste("a".repeat(10_001));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert").textContent).toBe(
      "A note can be at most 10,000 characters.",
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("closes on Cancel", async () => {
    const { onClose } = sheet("");
    await userEvent.click(
      await screen.findByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});

describe("a link in the editor", () => {
  const editorWith = async (note: string) => {
    const result = await editing(note);
    const content = await screen.findByRole("textbox", { name: "Note" });
    act(() => {
      content.focus();
    });
    await userEvent.keyboard("{Control>}a{/Control}");
    await userEvent.click(screen.getByRole("button", { name: "Link" }));
    return {
      ...result,
      form: await screen.findByRole("form", { name: "Link" }),
    };
  };
  const field = (form: HTMLElement, name: string) =>
    within(form).getByRole("textbox", { name });
  const markdownOnSave = async () => {
    await userEvent.click(screen.getByText("Markdown"));
    return (markdownBox() as HTMLTextAreaElement).value;
  };

  it("links the text chosen, with the address typed", async () => {
    const { form } = await editorWith("Some words");
    expect((field(form, "Text to show") as HTMLInputElement).value).toBe(
      "Some words",
    );
    await userEvent.type(field(form, "Address"), "example.com{Enter}");
    expect(await markdownOnSave()).toBe("[Some words](https://example.com/)");
  });

  it("keeps the formatting of what it links, left as chosen", async () => {
    const { form } = await editorWith("**Bold** words");
    await userEvent.type(field(form, "Address"), "example.com{Enter}");
    expect(await markdownOnSave()).toBe(
      "[**Bold** words](https://example.com/)",
    );
  });

  it("cannot link text across paragraphs as one", async () => {
    await editing("One\n\nTwo");
    const content = await screen.findByRole("textbox", { name: "Note" });
    act(() => {
      content.focus();
    });
    await userEvent.keyboard("{Control>}a{/Control}");
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Link" }).disabled,
    ).toBe(true);
  });

  it("changes a link's text and address", async () => {
    const { form } = await editorWith("[Site](https://example.com/)");
    expect((field(form, "Address") as HTMLInputElement).value).toBe(
      "https://example.com/",
    );
    await userEvent.clear(field(form, "Text to show"));
    await userEvent.type(field(form, "Text to show"), "Home");
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect(await markdownOnSave()).toBe("[Home](https://example.com/)");
  });

  it("shows the address when there is no text to show", async () => {
    const { form } = await editorWith("[Site](https://example.com/news)");
    await userEvent.clear(field(form, "Text to show"));
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect(await markdownOnSave()).toBe("<https://example.com/news>");
  });

  it("offers no text to show for a link showing its address", async () => {
    const { form } = await editorWith("<https://example.com/news>");
    expect((field(form, "Text to show") as HTMLInputElement).value).toBe("");
  });

  it("takes the link off its text when both fields are emptied", async () => {
    const { form } = await editorWith("[Site](https://example.com/)");
    await userEvent.clear(field(form, "Address"));
    await userEvent.clear(field(form, "Text to show"));
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect(await markdownOnSave()).toBe("Site");
  });

  it("refuses an address that is not a web address, saying why", async () => {
    const { form } = await editorWith("Some words");
    await userEvent.type(field(form, "Address"), "javascript:alert(1){Enter}");
    expect(field(form, "Address").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("form", { name: "Link" })).toBe(form);
  });

  it("leaves the note as it was on Cancel or clicking away", async () => {
    const { form } = await editorWith("Some words");
    await userEvent.type(field(form, "Address"), "example.com");
    await userEvent.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form", { name: "Link" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Link" }));
    await screen.findByRole("form", { name: "Link" });
    await userEvent.click(
      screen.getByRole("heading", { name: "Fictional Note" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("form", { name: "Link" })).toBeNull();
    });
    expect(await markdownOnSave()).toBe("Some words");
  });
});

describe("pasting into the editor", () => {
  it("keeps only the formats notes allow", () => {
    const editor = new Editor({
      extensions: noteExtensions,
      content:
        '<h1>Heading</h1><h5>Deep</h5><p><b>Bold</b> <mark>marked</mark> <span data-colour="sea">sea</span> <span data-colour="teal">teal</span> <span style="color: red">red</span> <a href="javascript:alert(1)">run</a> <a href="https://example.com/">site</a><img src="x" onerror="alert(1)"></p><script>alert(1)</script><ol><li>One</li></ol>',
    });
    expect(docToNote(editor.getJSON())).toBe(
      `# Heading\n\n### Deep\n\n**Bold** marked sea ${teal}teal</span> red run [site](https://example.com/)\n\n- One`,
    );
    editor.destroy();
  });
});
