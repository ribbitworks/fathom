// SPDX-License-Identifier: Apache-2.0

// Tests for picking choices: checks, Enter and Tab, descriptions, the word for none, the list's
// width, and the New option.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChoicePicker, fitList } from "./choice-picker.tsx";
import { testTheme } from "./test-support.tsx";

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
];

function renderPicker(
  multiple: boolean,
  onDone: (values: string[], finish: string) => void = () => undefined,
) {
  render(
    <MantineProvider theme={testTheme}>
      <ChoicePicker
        id="picker"
        label="Teams"
        options={options}
        multiple={multiple}
        initial={["b"]}
        typed=""
        onDone={onDone}
        onCancel={() => undefined}
      />
    </MantineProvider>,
  );
}

const checkOf = (label: string) =>
  screen.getByRole("option", { name: label }).querySelector("svg");

describe("picking choices", () => {
  it("checks each choice picked where several can be", () => {
    renderPicker(true);

    expect(checkOf("Beta")?.getAttribute("visibility")).toBe("visible");
    expect(checkOf("Alpha")?.getAttribute("visibility")).toBe("hidden");
  });

  it("checks the word for none where nothing is picked", () => {
    // Given an optional value with nothing picked
    renderOptional(undefined, false, []);

    // Then only the word for none is ticked
    expect(checkOf("No site")?.getAttribute("visibility")).toBe("visible");
    expect(checkOf("Alpha")?.getAttribute("visibility")).toBe("hidden");
  });

  it("checks the choice picked where one can be, as a Select does", () => {
    renderPicker(false);

    expect(checkOf("Beta")?.getAttribute("visibility")).toBe("visible");
    expect(checkOf("Alpha")?.getAttribute("visibility")).toBe("hidden");
  });

  it.each([
    ["typed", "alp{Enter}{Enter}"],
    ["moved to", "{ArrowDown}{Enter}{Enter}"],
  ])(
    "finishes with Enter after picking the choice %s, where several can be",
    async (_, keys) => {
      const onDone = vi.fn();
      renderPicker(true, onDone);

      await userEvent.click(screen.getByLabelText("Teams"));
      await userEvent.keyboard(keys);

      expect(onDone).toHaveBeenCalledExactlyOnceWith(["a", "b"], "enter");
    },
  );
});

function renderOptional(
  onDone: (values: string[], finish: string) => void = () => undefined,
  multiple = false,
  initial = ["a"],
) {
  render(
    <MantineProvider theme={testTheme}>
      <ChoicePicker
        id="picker"
        label="Site"
        options={[
          { value: "a", label: "Alpha" },
          { value: "n", label: "Northmere", description: "The research site." },
        ]}
        none="No site"
        multiple={multiple}
        initial={initial}
        typed=""
        onDone={onDone}
        onCancel={() => undefined}
      />
    </MantineProvider>,
  );
}

const optionNames = () =>
  screen.getAllByRole("option").map(({ textContent }) => textContent);

describe("a choice's description", () => {
  it("shows under the choice's name", () => {
    renderOptional();

    expect(optionNames()).toContain("NorthmereThe research site.");
  });

  it("finds the choice when typed", async () => {
    renderOptional();

    await userEvent.type(screen.getByLabelText("Site"), "research");

    expect(optionNames()).toEqual(["NorthmereThe research site."]);
  });
});

describe("choosing none", () => {
  it("is offered first, and empties the value when picked", async () => {
    const onDone = vi.fn();
    renderOptional(onDone);

    expect(optionNames()[0]).toBe("No site");
    await userEvent.click(screen.getByRole("option", { name: "No site" }));

    expect(onDone).toHaveBeenCalledExactlyOnceWith([], "enter");
  });

  it("is not offered once something is typed, when the first match is picked with Enter", async () => {
    const onDone = vi.fn();
    renderOptional(onDone);

    await userEvent.type(screen.getByLabelText("Site"), "n{Enter}");

    expect(onDone).toHaveBeenCalledExactlyOnceWith(["n"], "enter");
  });

  it("is not offered where several can be picked", () => {
    renderOptional(undefined, true);

    expect(optionNames()).not.toContain("No site");
  });

  it("highlights nothing as the list opens, so Enter and Tab change nothing", async () => {
    const onDone = vi.fn();
    renderOptional(onDone, false, ["n"]);

    expect(
      screen
        .getAllByRole("option")
        .some((option) => option.hasAttribute("data-combobox-selected")),
    ).toBe(false);
    await userEvent.click(screen.getByLabelText("Site"));
    await userEvent.keyboard("{Enter}");

    expect(onDone).toHaveBeenCalledExactlyOnceWith(["n"], "enter");
  });

  it("goes with Down to the first choice after none", async () => {
    const onDone = vi.fn();
    renderOptional(onDone, false, ["n"]);

    await userEvent.click(screen.getByLabelText("Site"));
    await userEvent.keyboard("{ArrowDown}");

    expect(
      screen
        .getByRole("option", { name: "Alpha" })
        .hasAttribute("data-combobox-selected"),
    ).toBe(true);
    await userEvent.keyboard("{Enter}");
    expect(onDone).toHaveBeenCalledExactlyOnceWith(["a"], "enter");
  });
});

describe("the list's width", () => {
  const fitted = (cell: number) => {
    const floating = document.createElement("div");
    fitList({ rects: { reference: { width: cell } }, elements: { floating } });
    return [floating.style.minWidth, floating.style.maxWidth];
  };

  it("is at least the cell's, growing to 320 pixels to fit a choice", () => {
    expect(fitted(80)).toEqual(["80px", "320px"]);
  });

  it("grows no wider than a cell wider than that", () => {
    expect(fitted(400)).toEqual(["400px", "400px"]);
  });
});

describe("finding a choice", () => {
  it("finds every word typed, ignoring accents and letters drawn with a stroke, as every search does", async () => {
    render(
      <MantineProvider theme={testTheme}>
        <ChoicePicker
          id="picker"
          label="Members"
          options={[
            { value: "s", label: "Silje Holm-Schrøder" },
            { value: "e", label: "Élodie Marchand" },
            { value: "o", label: "Other Fictional" },
          ]}
          multiple
          initial={[]}
          typed=""
          onDone={() => undefined}
          onCancel={() => undefined}
        />
      </MantineProvider>,
    );

    await userEvent.type(screen.getByLabelText("Members"), "schroder");
    expect(
      screen.getAllByRole("option").map(({ textContent }) => textContent),
    ).toEqual(["Silje Holm-Schrøder"]);

    await userEvent.clear(screen.getByLabelText("Members"));
    await userEvent.type(screen.getByLabelText("Members"), "silje schroder");
    expect(
      screen.getAllByRole("option").map(({ textContent }) => textContent),
    ).toEqual(["Silje Holm-Schrøder"]);

    await userEvent.clear(screen.getByLabelText("Members"));
    await userEvent.type(screen.getByLabelText("Members"), "elodie");
    expect(
      screen.getAllByRole("option").map(({ textContent }) => textContent),
    ).toEqual(["Élodie Marchand"]);
  });
});

function renderAdding(
  onNew: (typed: string) => void,
  onDone = vi.fn(),
  multiple = true,
) {
  render(
    <MantineProvider theme={testTheme}>
      <ChoicePicker
        id="picker"
        label="Customers"
        options={options}
        multiple={multiple}
        initial={["b"]}
        typed=""
        adding={{ one: "customer", onNew }}
        onDone={onDone}
        onCancel={() => undefined}
      />
    </MantineProvider>,
  );
  return onDone;
}

describe("adding the record a picker names", () => {
  it("offers New last, with what was typed in quotes", async () => {
    renderAdding(vi.fn());
    expect(optionNames().at(-1)).toBe("New customer");

    await userEvent.type(screen.getByLabelText("Customers"), "al");

    expect(optionNames()).toEqual(["Alpha", "New customer “al”"]);
  });

  it("picks New with Enter when nothing else matches, keeping what was picked", async () => {
    const onNew = vi.fn();
    const onDone = renderAdding(onNew);

    await userEvent.type(screen.getByLabelText("Customers"), "Gamma");
    expect(screen.queryByText("No matches")).toBeNull();
    expect(optionNames()).toEqual(["New customer “Gamma”"]);
    await userEvent.keyboard("{Enter}");

    expect([onDone.mock.calls, onNew.mock.calls]).toEqual([
      [[["b"], "leave"]],
      [["Gamma"]],
    ]);
  });

  it("offers no New to a picker that may not add", () => {
    renderPicker(true);

    expect(optionNames()).toEqual(["Alpha", "Beta"]);
  });
  it.each([
    ["several", true],
    ["one", false],
  ])(
    "moves on with Tab from New, picking nothing, where %s can be picked",
    async (_, multiple) => {
      const onNew = vi.fn();
      const onDone = renderAdding(onNew, vi.fn(), multiple);

      await userEvent.type(screen.getByLabelText("Customers"), "Gamma");
      await userEvent.keyboard("{Tab}");

      expect([onDone.mock.calls, onNew.mock.calls]).toEqual([
        [[["b"], "next"]],
        [],
      ]);
    },
  );
});

describe("keys typed before the picker has focus", () => {
  const picker = (typed: string) => (
    <MantineProvider theme={testTheme}>
      <ChoicePicker
        id="picker"
        label="Teams"
        options={options}
        multiple
        initial={[]}
        typed={typed}
        onDone={() => undefined}
        onCancel={() => undefined}
      />
    </MantineProvider>
  );

  it("adds them to the search while nothing has been typed into it since", async () => {
    const { rerender } = render(picker("A"));
    rerender(picker("Al"));
    const search = screen.getByLabelText<HTMLInputElement>("Teams");
    expect(search.value).toBe("Al");

    await userEvent.type(search, "p");
    rerender(picker("Alx"));

    expect(search.value).toBe("Alp");
  });
});
